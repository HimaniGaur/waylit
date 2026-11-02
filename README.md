# Waylit

**Beyond the shortest path.**

Waylit is an open-source, provider-agnostic TypeScript SDK for evaluating and ranking existing candidate routes using contextual observations and configurable policies. Give it routes, observations, and preferences; it returns eligibility, scores, a deterministic recommendation, and an explanation.

Waylit is not a navigation engine: it does not generate routes, fetch live data, or depend on a mapping provider, React, a backend, or an AI service.

## Installation status

Waylit is **not currently published to npm**. To build and try the package locally:

```sh
git clone https://github.com/HimaniGaur/waylit.git
cd waylit
npm ci
npm run build:sdk
npm pack
mkdir ../waylit-consumer
cd ../waylit-consumer
npm init -y
npm install ../waylit/waylit-0.1.0.tgz
```

The packed package is ESM and includes TypeScript declarations. It has no runtime dependencies. The evaluator targets ES2022; use a JavaScript runtime that supports ES modules and ES2022.

## Quickstart

After installing the package, import its public API from `waylit`:

```ts
import {
  evaluateRoutes,
  type FactorDefinition,
  type PreferencePreset,
  type Route,
  type RouteContext,
} from 'waylit'

const routes: Route[] = [
  { id: 'quiet', name: 'Quiet streets', durationMinutes: 10, description: 'A direct route.' },
  { id: 'active', name: 'Active streets', durationMinutes: 12, description: 'Two minutes longer.' },
]

const factors: FactorDefinition[] = [
  {
    id: 'activity',
    label: 'Street activity',
    description: 'Observed activity on the route.',
    direction: 'higher',
    weight: 1,
    bounds: { min: 0, max: 10 },
  },
]

const contexts: RouteContext[] = [
  { routeId: 'quiet', factors: { activity: 2 } },
  { routeId: 'active', factors: { activity: 9 } },
]

const policy: PreferencePreset = {
  id: 'prefer-activity',
  label: 'Prefer activity',
  description: 'Favor routes with higher observed activity.',
  maxExtraMinutes: 3,
}

const result = evaluateRoutes({ routes, contexts, factors, preset: policy })
const recommended = routes.find((route) => route.id === result.recommendedRouteId)

console.log(recommended?.name) // "Active streets"
console.log(result.explanation)
// Active streets had the highest preference score among eligible routes and adds 2 minutes over the fastest route.
```

The example uses developer-supplied observations; it does not imply that Waylit collects or verifies them.

## Policies, scores, and data

- **Hard constraint:** `maxExtraMinutes` excludes routes that exceed the detour from the fastest candidate before any preference scoring. Excluded routes have no score and cannot be recommended.
- **Soft preference:** factor `weight`, `direction` (`higher` or `lower`), and optional `weightOverrides` determine how eligible routes compare. Values are normalized against each factor's bounds; scores are preference-fit scores from 0 to 100, not probabilities or safety assessments.
- **Missing observations:** use `null`, or omit a registered factor from that route's context. The SDK reports it as `unknown`; it is never treated as zero. An incomplete eligible route has no score if any positively weighted observation is missing. A recommendation based on another complete eligible route is `provisional`; if no complete route can be compared, status is `insufficient_data` and the recommendation is `null`—except a zero-detour policy can select a shortest route by duration, then route ID, while clearly marking the result provisional.
- **Stale observations:** freshness is not part of the SDK input model. If your application considers a value stale, pass `null` to the evaluator and retain freshness/source metadata separately.
- **Determinism:** identical input and strategy produce identical results. Equal scores break by shorter duration, then lexicographic route ID. A zero-detour policy restricts eligibility to the shortest-duration route(s).
- **Validation:** malformed input throws an `Error` with a field-specific message. At least one route, unique non-empty route and factor IDs, finite in-bounds observations, positive total factor weight, and finite non-negative detour limits are required. Missing route contexts are allowed and mean all registered observations are unknown.

See the [SDK contract](docs/sdk-contract.md) for the complete input/output behavior and validation rules.

## Development and demo

```sh
npm ci
npm test
npm run typecheck
npm run build
npm run test:consumer
npm run dev
```

The React demo is supporting evidence, not an SDK dependency. Its routes and observations are synthetic. On the main screen, switch between Better Lighting and Shortest Walk; scroll down to compare synthetic scenarios and try the closure, detour, and incomplete-data controls. The demo calls the SDK evaluator and does not generate directions or make real-world safety claims. See the [hackathon browser evidence](https://github.com/HimaniGaur/waylit/blob/feature/scenario-simulator/docs/hackathon-evidence.md) for recorded verification and its limits.
