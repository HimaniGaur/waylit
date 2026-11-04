# Waylit Repository Audit

**Scope:** Review of SDK architecture, evaluation behavior, developer experience, testing, simulator fidelity, and product credibility. This audit does not change implementation code.

**Review basis:** Static inspection of repository files. No tests, builds, package installs, external integrations, or production deployments were run. “Verified” means directly visible in source/configuration/docs, not runtime-tested during this review. Recommendations and complexity are estimates.

**Severity guide:** P0 = release-blocking correctness or safety issue; P1 = material correctness, integration, or credibility gap; P2 = useful improvement with limited immediate impact. No P0 findings were identified from static inspection.

## Executive summary

Waylit has a small, framework-independent evaluator with a clear TypeScript input/output model, explicit unknown-data behavior, deterministic tie-breaking, and hard eligibility checks before scoring. The React demo imports and calls that evaluator; the scenario simulator constructs inputs and renders evaluator results rather than implementing a second ranking engine. Package metadata includes ESM and declaration entry points, and a consumer smoke script is present.

The main audit risks are contract inconsistencies around custom scoring strategies, invalid or non-finite strategy outputs, zero-weight factor semantics, and a likely mismatch between the package's declared `dist/sdk` output paths and the TypeScript build layout. These should be resolved before treating the package surface as stable. The package is not published to npm; the README provides a local tarball path instead. Product claims are generally honest about synthetic inputs and the absence of routing/data integrations, but consumers must manually adapt provider data.

## Findings

### 1. Custom scoring strategies are not validated at the SDK boundary

- **Observation (verified):** `evaluateRoutes` calls `strategy.score` and trusts its `score`, `observedFactors`, and `missingFactors`. It does not check that factor IDs are known and unique, values match the context, normalized values are finite and in range, contributions reconcile with the score, or missing IDs agree with observed factors.
- **Evidence:** `src/sdk/index.ts`, `ScoringStrategy`, `weightedNormalizedScoring`, and `evaluateRoutes` around `strategy.score(...)` and `observedById`.
- **Impact:** A custom strategy can return contradictory or malformed public results, bypassing strict input validation. The extension point's responsibility boundary is unclear.
- **Severity:** P1.
- **Recommended action:** Specify the strategy contract. Validate strategy output at runtime, or narrow the extension point so the evaluator retains normalization, missingness, and result construction while strategies provide only a constrained calculation.
- **Estimated implementation complexity:** Medium (1–3 days), including API decision, implementation, and contract tests.

### 2. Public package export paths may not match the TypeScript build output

- **Observation (verified configuration; output inference unverified):** `package.json` declares `main`, `module`, `types`, and `exports` under `./dist/sdk/`. `tsconfig.sdk.json` sets `rootDir: "./src"`, `outDir: "./dist"`, and includes `src/sdk/index.ts`, which normally emits `dist/index.js` and `dist/index.d.ts`, rather than `dist/sdk/index.*`. The consumer smoke script expects the latter paths. This audit did not run the build.
- **Evidence:** `package.json` entry points and `files`; `tsconfig.sdk.json`; `scripts/consumer-smoke.mjs` required packed paths.
- **Impact:** The tarball may have broken import/type entry points or the consumer smoke script may fail, blocking the main developer integration path. This is a high-confidence static configuration concern; runtime confirmation remains outstanding.
- **Severity:** P1.
- **Recommended action:** Align compiler root/include/output paths with package entry points, or update entry points and smoke expectations to the actual output. Verify a tarball in a clean Node ESM and TypeScript consumer.
- **Estimated implementation complexity:** Low (half day) if path alignment is straightforward; Medium if downstream packaging assumptions need adjustment.

### 3. Zero-weight observations can still appear as missing evidence and affect selection

- **Observation (verified):** A missing factor with effective weight zero is emitted as `unknown` and added to `missingFactors`; it does not null the score or reduce coverage, but it is included in route explanation text. The score calculation excludes zero-weight factors and missing zero-weight factors do not make the score incomplete; however, route explanations still list their unknown labels. In shortest-only mode, complete routes are ranked by scores if any positively weighted environmental factors remain. The contract describes the policy as shortest-duration selection, with route-ID fallback when environmental scores are unavailable.
- **Evidence:** `src/sdk/index.ts`, `evaluateRoutes` factor-result creation, `hasMissingWeightedFactor`, `unknownLabels`, and `shortestOnly` selection; `docs/sdk-contract.md`, missing values and shortest-walk sections.
- **Impact:** Explanations can imply a material evidence gap when the policy does not use that factor. Missing zero-weight factors can create noisy explanations, and the contract would benefit from explicitly distinguishing shortest-only selection from any weighted environmental preference.
- **Severity:** P1.
- **Recommended action:** Decide whether zero-weight factors are outside the policy evidence model or remain informational metadata. Make missing-factor lists and explanations follow the documented zero-weight policy, and confirm shortest-only score selection matches the intended contract.
- **Estimated implementation complexity:** Low to Medium (1–2 days), depending on chosen semantics.

### 4. Custom strategy results are not checked for finite scores or documented ranges

- **Observation (verified):** The default strategy produces expected scores for validated input, but the public `ScoringStrategy` accepts arbitrary results. `evaluateRoutes` does not check that `result.score` is finite or within 0–100 before sorting or returning it.
- **Evidence:** `src/sdk/index.ts`, `ScoringStrategy` and `evaluateRoutes` sort comparator `(b.score! - a.score!)`.
- **Impact:** `NaN`, infinity, or out-of-range scores can destabilize ordering, create invalid UI meter widths, and violate the documented scale.
- **Severity:** P1.
- **Recommended action:** Validate strategy outputs and contributions as finite and within defined ranges; reject malformed values with descriptive errors. Add adversarial strategy tests.
- **Estimated implementation complexity:** Low (half to one day), assuming the strategy result shape remains unchanged.

### 5. Tests cover core flows but leave contract and extension edge cases open

- **Observation (verified):** SDK tests cover baseline ranking, caller-added factors, weight changes, missing observations, detour enforcement, several invalid inputs, and deterministic ties. They do not cover custom strategy malformed output, extreme finite values/weight sums, strategy exceptions, zero-weight missing factors, empty factor definitions, or exact warning/result consistency.
- **Evidence:** `src/sdk/index.test.ts`; `docs/sdk-contract.md`, validation and acceptance-test sections.
- **Impact:** Edge-case regressions can violate the public contract without detection. Strategy and zero-weight behavior are especially under-specified by tests.
- **Severity:** P1.
- **Recommended action:** Add table-driven contract tests for validation invariants and focused custom-strategy tests. Keep consumer integration checks separate from SDK unit tests.
- **Estimated implementation complexity:** Medium (2–4 days) for meaningful behavioral coverage.

### 6. Build and consumer checks exist, but automated repository verification is not visible

- **Observation (verified):** Scripts exist for `build`, `typecheck`, `test`, and `test:consumer`; the smoke script checks tarball contents, consumer TypeScript compilation, and runtime behavior. No automated CI workflow appears in the repository file inventory. This audit did not execute those scripts.
- **Evidence:** `package.json` scripts; `scripts/consumer-smoke.mjs`; repository file inventory has no workflow configuration.
- **Impact:** No visible repository-level gate ensures changes preserve package and app builds. The output-path concern makes clean consumer verification especially important.
- **Severity:** P1.
- **Recommended action:** First make local build and consumer checks pass after resolving output paths; then add CI for install, unit tests, typecheck, SDK build, consumer smoke, and app build.
- **Estimated implementation complexity:** Low to Medium (1–2 days), excluding CI policy or deployment setup.

### 7. Documentation is behaviorally strong, but conventional package installation is unavailable

- **Observation (verified):** README and wiki explain inputs, unknown observations, score bounds, synthetic demo data, and non-goals. They state the package is not published and document local `npm pack` installation. Public types are documented in the contract and API reference.
- **Evidence:** `README.md` installation and quickstart; `docs/sdk-contract.md`; `docs/wiki/Getting-Started.md`; `package.json` version `0.1.0` and local package scripts.
- **Impact:** Developers must clone, build, and pack the source; there is no standard `npm install waylit` flow. This is disclosed, but it limits discoverability and adoption.
- **Severity:** P1 for adoption readiness; not a defect if local-only status is intentional.
- **Recommended action:** Decide the release posture. For external adoption, stabilize exports, state supported Node/TypeScript versions, and publish a versioned package. For prototype-only use, position the local workflow as the intended path.
- **Estimated implementation complexity:** Medium to High (several days to a release cycle), depending on support and maintenance commitments.

### 8. Provider independence is real at the evaluator boundary; integrations remain the consumer's responsibility

- **Observation (verified):** SDK inputs are plain TypeScript objects and `src/sdk/index.ts` imports no mapping/provider code. There are no provider adapters, route conversion helpers, schemas, or freshness/provenance fields. Documentation says the host app supplies routes and observations.
- **Evidence:** `src/sdk/index.ts` public interfaces; `package.json` runtime dependencies; `docs/wiki/Concepts.md`; `docs/sdk-contract.md` non-goals.
- **Impact:** Provider agnosticism is credible architecturally, but developers must build and maintain all data adaptation and freshness handling. “Provider agnostic” does not mean integrations are included.
- **Severity:** P2.
- **Recommended action:** Keep the core provider-neutral. Prioritize an adapter recipe or optional adapter package only after user demand identifies specific providers and data models.
- **Estimated implementation complexity:** Low for a generic integration guide; Medium to High per provider adapter.

### 9. Simulator uses the SDK and synthetic fixtures; some UI summaries are assembled outside SDK output

- **Observation (verified):** `ScenarioSimulator` imports `evaluateRoutes`, renders its recommendation, scores, eligibility, and overall explanation; `scenarios.ts` converts stale observations to `null` before evaluation. The simulator adds UI-only closure reasons and comparison phrasing. `App.tsx` also calls the SDK. Synthetic data is labeled in the simulator and README.
- **Evidence:** `src/ui/ScenarioSimulator.tsx`; `src/ui/scenarios.ts`; `src/ui/App.tsx`; `src/sdk/index.ts`.
- **Impact:** There is no duplicated ranking engine. UI summaries should remain presentation-only and tested against SDK results; stale values are retained for display while the evaluator receives unknown, an intentional distinction that must stay synchronized.
- **Severity:** P2.
- **Recommended action:** Keep scenario construction and formatting separate from scoring. Add tests comparing decision-driving display fields to `EvaluationResult`, and label UI-only constraints clearly.
- **Estimated implementation complexity:** Low to Medium (1–2 days).

### 10. Route evaluation assistant is a separate policy/evidence orchestration layer

- **Observation (verified):** `routeEvaluationAssistant.ts` proposes weights, summarizes freshness and hard exclusions, filters closed routes, calls `evaluateRoutes`, and builds an explanation. This is orchestration rather than a second scoring implementation, but it separately computes fastest-route and exclusion summaries.
- **Evidence:** `src/ui/routeEvaluationAssistant.ts`, `proposePolicy`, `summarizeEvidence`, `evaluateConfirmedPolicy`, and `explainEvaluation`; `src/ui/routeEvaluationAssistant.test.ts`.
- **Impact:** This layer is appropriate for the demo but could become a second source of truth for eligibility and evidence presentation as features grow. The SDK has no hard-exclusion or provenance API by design.
- **Severity:** P2.
- **Recommended action:** Keep this layer outside the core SDK unless reusable consumer demand emerges. Add cases for all routes closed, stale/null combinations, and consistency between summaries and SDK eligibility.
- **Estimated implementation complexity:** Low (about 1 day) for coverage; Medium if promoted into a reusable package.

### 11. Product claims are bounded; license alignment should be confirmed

- **Observation (verified with one unverified detail):** README calls Waylit open-source; a tracked `LICENSE` file exists and package metadata declares MIT. The actual license text and alignment were not inspected in detail. Docs consistently disclaim safety guarantees, live feeds, route generation, and provider integrations.
- **Evidence:** `README.md`; `package.json` `license`; tracked `LICENSE`; `docs/sdk-contract.md`; `docs/wiki/Home.md` and `Concepts.md`.
- **Impact:** Product positioning is appropriately constrained. If the license text is incomplete or does not match MIT metadata, redistribution terms could be ambiguous; that is an assumption pending review.
- **Severity:** P2, conditional on license-text verification.
- **Recommended action:** Confirm the tracked license is complete MIT text and matches package metadata. Keep copy explicit that environmental data accuracy and completeness are supplied by the host.
- **Estimated implementation complexity:** Low (under half a day).

## Six-dimension assessment

| Dimension | Assessment | Verified strengths | Main gaps |
|---|---|---|---|
| SDK architecture | Good foundation | Small evaluator; plain TypeScript API; no provider/UI runtime coupling; caller-defined factors; strategy seam | Strategy boundary trusts custom results; package output paths need verification/alignment |
| Evaluation engine | Strong core policy model | Bounded normalization; hard detour filtering before scoring; explicit unknowns; deterministic tie-breaks; explanations and warnings | Custom strategy output validation; zero-weight semantics; possible mismatch between strategy results and reported coverage |
| Developer experience | Suitable for local evaluation | Typed ESM metadata; declarations configured; quickstart, contract, wiki, consumer smoke script | Not on npm; output/exports mismatch risk; no explicit support matrix or continuous verification |
| Testing | Useful but incomplete | SDK, UI orchestration, and scenario tests; consumer smoke script | Tests not run in this audit; edge-case gaps; no visible CI; package path alignment risk |
| Simulator | Credible evaluator consumer | Imports actual SDK; no duplicated scoring; synthetic data labeled; renders SDK result fields | UI-only closure and comparison summaries need boundary tests |
| Product credibility | Careful scope statements | Explicit non-goals, synthetic fixtures, unknown/stale distinction, no safety guarantees | No live data/adapters; package unpublished; consumer must supply all inputs; license text not inspected |

## Prioritized implementation plan

1. **Resolve and verify package export/build layout (P1).** Align `tsconfig.sdk.json`, emitted files, `package.json` entry points, and `scripts/consumer-smoke.mjs`. Verify clean tarball installation in Node ESM and TypeScript.
2. **Specify and harden `ScoringStrategy` (P1).** Define whether strategies own normalization/missing-data behavior or only scoring. Validate result shape, finiteness, ranges, known factor IDs, and consistency before returning public results.
3. **Settle zero-weight and shortest-only semantics (P1).** Make zero-weight factors unable to affect score selection or status unexpectedly; update contract and test missing zero-weight cases while retaining the positive-total invariant if intended.
4. **Expand contract and edge-case tests (P1).** Cover malformed custom strategies, extreme numeric inputs, tie and zero-detour cases, all-closed assistant scenarios, stale/missing display consistency, and warning/explanation behavior.
5. **Add automated CI verification (P1).** Run install, tests, typecheck, SDK build, consumer smoke, and app build on changes; keep browser/E2E evidence separate.
6. **Decide package release posture (P1/P2).** If external adoption is intended, establish a publishing checklist and supported runtime matrix; if prototype-only, keep local installation and unpublished status prominent.
7. **Improve integration guidance before adding adapters (P2).** Document provider-to-`Route`/`RouteContext` mapping, units, timestamps/provenance, and stale-data policy. Add provider adapters only when a concrete need is validated.
8. **Lock simulator fidelity with tests (P2).** Preserve the current dependency direction and assert that display labels, eligibility, scores, and explanations match SDK outputs plus explicitly declared UI-only constraints.
9. **Verify license text and product wording (P2).** Confirm the tracked license matches MIT metadata and retain explicit boundaries around synthetic data, coverage, and safety.

## Assumptions and unverified items

- No tests, build, `npm pack`, consumer smoke script, or browser session was run during this audit. Their behavior is described as configured or inferred, not as currently passing.
- The `tsconfig.sdk.json` output-path concern is inferred from TypeScript `rootDir`/`outDir`; confirm with an actual clean build.
- npm non-publication is documented in the repository; the npm registry was not queried.
- Provider support, production usage, customer adoption, and runtime compatibility were not externally verified.
- `LICENSE` exists and is tracked, but its legal text was not inspected in detail.
