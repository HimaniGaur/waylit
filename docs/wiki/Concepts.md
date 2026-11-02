# Concepts

## Route options and inputs

Waylit works with route options supplied by the host navigation app. The SDK does not create directions or connect to a routing provider. The host also defines the factors, observations, and preference policy to evaluate.

This keeps the evaluator provider agnostic: an app can obtain observations from its chosen providers and pass them to the same SDK interface. The core is framework independent; the React demo is a separate consumer rather than a runtime SDK requirement.

## Eligibility before preference scoring

`maxExtraMinutes` sets the allowed detour from the fastest supplied option. Options beyond that limit are excluded before the scoring strategy runs. An excluded option has no score and cannot be recommended.

## Hard constraints and soft preferences

The detour limit is a hard eligibility constraint. Factor direction, factor weights, and optional preset weight overrides express soft preferences among eligible options. A `higher` factor favors larger values; `lower` favors smaller values. Values are normalized against the factor's declared bounds. Scores are preference-fit scores, not probabilities or safety assessments.

## Unknown and stale observations

`null` and omitted registered observations mean unknown; they are not interpreted as zero. An eligible route missing a positively weighted observation has no complete weighted score. If a complete route can be recommended while an eligible alternative is incomplete, the result is marked `provisional`. If no eligible route has complete weighted observations, the result is `insufficient_data`, except for the zero-detour behavior below.

The SDK unit tests cover omitted observations and assert `unknown` status, null normalized value and contribution, and reduced data coverage. They also exercise adding a new factor without changing the evaluator. These tests provide evidence for the intended design; they are not exhaustive validation of every provider or framework integration.

The SDK input has no freshness or provenance fields. If the host considers an observation stale, it should pass `null` and retain the original value, timestamp, and source in its own data model.

## Shortest Walk and determinism

A preset with `maxExtraMinutes: 0` keeps only the fastest option(s) eligible. If the eligible option has incomplete observations, Waylit can still select by duration and stable route ID, marking the result provisional and explaining that no environmental superiority is implied. For normal scored comparisons, equal scores break by shorter duration, then lexicographic route ID.

For identical inputs and strategy, results are deterministic. See the [SDK contract](https://github.com/HimaniGaur/waylit/blob/main/docs/sdk-contract.md) for exact rules.

