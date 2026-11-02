# Waylit SDK Contract — MVP v0.2

**Status:** MVP contract. The package can be built and packed locally but has not been published to npm.
**Goal:** A framework-independent TypeScript API for ranking supplied walking-route alternatives against supplied environmental observations.
**Boundary:** No live maps, GIS feeds, tracking, safety guarantees, backend, plugin loader, or production package publishing in the MVP.

## 1. Intended developer usage

```ts
import { evaluateRoutes, type EvaluationInput } from 'waylit'

const input: EvaluationInput = { routes, contexts, factors, preset }
const result = evaluateRoutes(input)

console.log(result.recommendedRouteId)
console.log(result.routes[0].factorResults)
console.log(result.explanation)
```

## 2. Public TypeScript interfaces

```ts
export type FactorDirection = 'higher' | 'lower';
export type Observation = number | null; // null explicitly means unknown

export interface FactorDefinition {
  id: string;
  label: string;
  description: string;
  direction: FactorDirection;
  weight: number;                  // finite, >= 0; all effective weights must not be zero
  bounds: { min: number; max: number }; // finite, min < max
}

export interface Route {
  id: string;
  name: string;
  durationMinutes: number;        // finite, > 0
  description: string;
}

export interface RouteContext {
  routeId: string;
  factors: Record<string, Observation>;
  // absent factor key also means unknown, NOT zero
}

export interface PreferencePreset {
  id: string;
  label: string;
  description: string;
  maxExtraMinutes: number;        // finite, >= 0; 0 keeps shortest-duration routes only
  weightOverrides?: Partial<Record<string, number>>; // finite, >= 0; known factor IDs only
}

export interface EvaluationInput {
  routes: Route[];
  contexts: RouteContext[];
  factors: FactorDefinition[];
  preset: PreferencePreset;
}

export interface FactorResult {
  factorId: string;
  label: string;
  value: Observation;
  normalizedValue: number | null; // 0..1 if known; null otherwise
  effectiveWeight: number;        // normalized positive configured weight
  contribution: number | null;    // effectiveWeight * normalizedValue if known
  status: 'observed' | 'unknown';
}

export interface RouteResult {
  routeId: string;
  durationMinutes: number;
  extraMinutes: number;
  eligible: boolean;
  exclusionReasons: string[];
  score: number | null;           // 0..100; null when ineligible or weighted data is incomplete
  dataCoverage: number;          // 0..1, fraction of positive factor weight observed
  factorResults: FactorResult[];
  missingFactors: string[];
  explanation: string;
}

export type EvaluationStatus = 'recommended' | 'provisional' | 'insufficient_data';
export type RecommendationBasis = 'preference_score' | 'shortest_duration';

export interface EvaluationResult {
  presetId: string;
  status: EvaluationStatus;
  recommendedRouteId: string | null;
  basis: RecommendationBasis | null;
  routes: RouteResult[];
  explanation: string;
  warnings: string[];
}

export interface FactorContribution {
  factorId: string;
  label: string;
  value: number;
  normalizedValue: number;
  weight: number;                  // configured factor or preset weight, before normalization
  contribution: number;            // contribution on the 0..100 score scale
}

export interface ScoringInput {
  route: Route;
  context: RouteContext;
  factors: FactorDefinition[];
  preset: PreferencePreset;
}

export interface ScoringStrategy {
  readonly id: string;
  score(input: ScoringInput): {
    score: number | null;
    observedFactors: FactorContribution[];
    missingFactors: string[];
  };
}

export declare function evaluateRoutes(input: EvaluationInput, strategy?: ScoringStrategy): EvaluationResult;
```

The input reuses the existing `Route` and `RouteContext` interfaces rather than defining a competing embedded-observation route type. The optional strategy argument preserves the existing `ScoringStrategy` seam. The React demo consumes the SDK but is not an SDK dependency. Import published-package consumers from `waylit`; demo fixture data is not part of the published package.

## 3. Behavior and policy decisions

### Scoring
- For a known numeric value `v`: normalize as `(v - min)/(max-min)` if `direction='higher'`, or `1-(v-min)/(max-min)` if `direction='lower'`.
- Validate `v` is finite and within bounds. **Reject** out-of-bounds numeric values instead of silently clamping.
- Effective weight is the preset override (when present), else factor weight. Normalize positive weights so they sum to 1. Zero weight means not considered by scoring or coverage.
- A route is scored as `100 * Σ(effectiveWeight * normalizedValue)` only when all positively weighted observations are present. Retain numerical precision internally; formatting is a UI concern.

### Missing values — deliberately conservative MVP policy
- `null` or absent key means **unknown**, never `0`, full coverage, or an assertion of danger/safety.
- A factor with positive effective weight and unknown observation gets `normalizedValue: null`, `contribution: null`, and contributes nothing to evidence coverage.
- The SDK has no freshness field. Callers should pass stale observations as `null` and preserve their timestamps/provenance in their own data model.
- A route with any such missing observation has `score: null` and cannot win *on environmental scoring*. Return factor-level missingness and the weight-weighted `dataCoverage` separately. Ineligible routes are excluded before calling the scoring strategy; their score is null and `factorResults` is empty.
- If at least one eligible route has complete weighted observations, the highest-scoring complete route may be selected. **If any eligible competitor is incomplete, mark the outcome `provisional`** and explain that unscored alternatives could change the result.
- If no eligible route has complete weighted observations, return `status: 'insufficient_data'`, `recommendedRouteId: null`, except for the explicitly time-only shortest-walk case below.
- Do not present any normalized score as a personal safety probability.

### Constraints and shortest-walk preset
- Calculate `fastestMinutes = min(routes.durationMinutes)` from the supplied valid routes.
- Eligibility: `durationMinutes <= fastestMinutes + preset.maxExtraMinutes`. Excluded routes **never** win, regardless of score.
- `Shortest Walk` preset sets `maxExtraMinutes: 0`, making only routes tied for minimum duration eligible. Select among these by complete score when there are multiple eligible routes; if none has a complete score, break ties deterministically using route ID. Mark the result's `basis: 'shortest_duration'`, explain the selection basis accurately, state that no environmental superiority is implied, and include uncertainty warnings.
- `Better Lighting` preset uses a nonzero detour allowance and higher weighting on the lighting factor. Select highest scored complete route, with tie breaks: shorter duration, then lexicographic ID.

### Validation
- Reject: empty route collection; duplicate route IDs; duplicate factor IDs; invalid route duration; invalid bounds; negative/non-finite weights; effective total weight <= 0; negative/non-finite detour; preset override of nonexistent factor ID; nonnumeric/NaN/Infinity/out-of-range observed values.
- Error behavior: use existing project error conventions if present; otherwise throw a descriptive `Error` that identifies field and route/factor.
- Unregistered context keys: ignore with an explicit warning or reject consistently; for MVP **reject** to catch typos.

### Explanation
- Must refer to evidence and preferences, e.g., `Route B had the highest weighted preference fit among eligible, fully observed routes; it adds 4 minutes. Route A lacked lighting evidence, so this comparison is provisional.`
- Never output `safe`, `unsafe`, `risk-free`, or `95% safe` on the basis of these inputs.
- All results deterministic given the same input.

The evaluator requires at least one route, and `maxExtraMinutes` must be non-negative. Therefore at least the fastest route is always eligible; `insufficient_data` describes missing weighted evidence, not a case where every non-empty candidate violates the detour constraint.

## 4. Golden synthetic fixture

```ts
const factors: FactorDefinition[] = [
  { id: 'lighting', label: 'Lighting', description: 'Synthetic documented lighting observation.', direction: 'higher', weight: 0.6, bounds: { min: 0, max: 1 } },
  { id: 'open-businesses', label: 'Open businesses', description: 'Synthetic expected-open business count.', direction: 'higher', weight: 0.25, bounds: { min: 0, max: 12 } },
  { id: 'disruptions', label: 'Disruptions', description: 'Synthetic known disruption count.', direction: 'lower', weight: 0.15, bounds: { min: 0, max: 3 } }
];
const routes: Route[] = [
  { id: 'route-a', name: 'Route A', durationMinutes: 12, description: 'A shorter walk along familiar streets.' },
  { id: 'route-b', name: 'Route B', durationMinutes: 16, description: 'A brighter walk through active streets.' },
  { id: 'route-c', name: 'Route C', durationMinutes: 19, description: 'A longer walk with a quieter stretch.' }
];
const contexts: RouteContext[] = [
  { routeId: 'route-a', factors: { lighting: 0.6, 'open-businesses': 2, disruptions: 1 } },
  { routeId: 'route-b', factors: { lighting: 0.95, 'open-businesses': 11, disruptions: 0 } },
  { routeId: 'route-c', factors: { lighting: 0.85, 'open-businesses': 7, disruptions: 0 } }
];
const betterLighting: PreferencePreset = { id: 'better-lighting', label: 'Better lighting', description: 'Prefer routes with better documented lighting.', maxExtraMinutes: 5, weightOverrides: { lighting: 0.75, 'open-businesses': 0.15, disruptions: 0.1 } };
const shortestWalk: PreferencePreset = { id: 'shortest-walk', label: 'Shortest walk', description: 'Keep to the shortest-duration routes.', maxExtraMinutes: 0 };
```

Expected: `betterLighting` recommends **Route B** (Route C is excluded on detour); `shortestWalk` recommends **Route A**. These are **synthetic demonstration inputs**, not factual illumination measurements or safety assessments.

## 5. Acceptance tests (contract tests)

1. Better Lighting fixture recommends Route B and excludes Route C because 19 > 12 + 5.
2. Shortest Walk fixture recommends Route A and excludes all slower routes.
3. A 3-minute maximum detour excludes Route B before the scoring strategy is called.
4. Add a synthetic factor and observations for each route; the evaluator includes it without evaluator changes.
5. Weight overrides can change route rankings in a deliberately crafted fixture.
6. Missing a positively weighted observation yields an unknown factor result, null route score, and coverage below 1; incomplete eligible alternatives make the outcome provisional.
7. Invalid input matrix (NaN, Infinity, negative duration, bad bounds, all zero weights, unknown factor ID) yields descriptive failures.
8. Tie scores => shorter duration wins, then stable lexical route ID.
9. Same input evaluated twice => deterministic result.
10. The React demo imports the SDK. Kane changes preset in the browser and verifies the displayed result; Kane is separate from SDK unit tests.

## 6. Collaboration and integration

1. Reuse `Route`, `RouteContext`, `FactorDefinition`, and `PreferencePreset`; do not create competing definitions.
2. Keep the existing `ScoringStrategy` seam; the evaluator owns route eligibility, result status, and recommendation selection.
3. Keep the SDK framework-independent. The React demo is a consumer, not an SDK dependency.
4. Run build and SDK unit tests; merge only after contract and tests agree. Then attach the demo UI and Kane end-to-end evidence.

## 7. Explicit non-goals

No live routing provider integration, data adapters, backend, database, plugin loading, emergency tracking, or certified safety labeling. The package is ESM-only; CommonJS support is not provided.
