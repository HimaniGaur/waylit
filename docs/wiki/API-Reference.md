# API Reference

The package's public entry point is `waylit`. The public function is `evaluateRoutes`; its optional second parameter accepts a `ScoringStrategy` and defaults to `weightedNormalizedScoring`.

## Main input types

- `EvaluationInput`: `routes`, `contexts`, `factors`, and `preset`.
- `Route`: `id`, `name`, `durationMinutes`, and `description`.
- `RouteContext`: `routeId` and a `factors` record. A registered factor can be a number or `null`; an omitted registered factor is also unknown.
- `FactorDefinition`: `id`, `label`, `description`, `direction` (`higher` or `lower`), `weight`, and numeric `bounds` (`min` and `max`).
- `PreferencePreset`: `id`, `label`, `description`, `maxExtraMinutes`, and optional per-factor `weightOverrides`.

## Result

`EvaluationResult` contains the selected `presetId`, an `EvaluationStatus`, `recommendedRouteId` (or `null`), recommendation `basis`, per-route results, an overall `explanation`, and `warnings`.

Each `RouteResult` reports `eligible`, any `exclusionReasons`, `extraMinutes`, `score` (0–100 or `null`), `dataCoverage`, `factorResults`, `missingFactors`, and an explanation. Factor results identify the observation status and normalized value, effective weight, and contribution.

Statuses are `recommended`, `provisional`, or `insufficient_data`. Recommendation basis is `preference_score`, `shortest_duration`, or `null`.

## Validation and extension

The evaluator rejects invalid input with a descriptive `Error`: for example duplicate or empty IDs, invalid durations or bounds, out-of-bounds observations, unknown factor keys, invalid weights, and negative detour limits. See the [full SDK contract](https://github.com/HimaniGaur/waylit/blob/main/docs/sdk-contract.md) for complete behavior and exact interfaces.

`ScoringStrategy` is the extension point for scoring. The evaluator retains responsibility for validation, detour eligibility, result status, and recommendation selection. The demo fixture is not part of the package API.

