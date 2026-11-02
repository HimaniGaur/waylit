# Waylit

Waylit is an open-source TypeScript SDK that helps navigation apps choose a route using preferences and available context. The app supplies route options, observations, and a preference policy; Waylit applies the policy and returns eligibility, preference scores, and an explanation.

**Keep your navigation app. Make route choices fit preferences.**

Waylit is an evaluation layer, not a directions engine. It does not generate routes, fetch live map or environmental data, or make AI or safety decisions. The current React demo uses synthetic data.

## What makes Waylit different?

Three design principles shape the SDK:

- **Provider agnostic:** the integrating app supplies observations from its own data sources.
- **Framework independent:** the TypeScript evaluator can be used without React or another UI framework.
- **Unknown stays unknown:** missing observations are reported as unknown, not silently converted to zero or treated as evidence for or against a route.

The SDK source and tests support these goals: inputs are passed into a standalone evaluator, the SDK has no runtime dependencies, and tests cover additional caller-defined factors and missing observations. These are architectural properties and test coverage; they do not certify every possible integration.

## Start here

- [Getting Started](Getting-Started) — build the SDK locally (it is not published to npm).
- [SDK Quickstart](SDK-Quickstart) — evaluate route options with the public TypeScript API.
- [API Reference](API-Reference) — inputs, outputs, and extension point.
- [Concepts](Concepts) — eligibility, preferences, scoring, and incomplete data.
- [Demo and Evidence](Demo-and-Evidence) — synthetic demo and documented Kane CLI checks.

## Project

- [Source repository](https://github.com/HimaniGaur/waylit)
- [SDK contract](https://github.com/HimaniGaur/waylit/blob/main/docs/sdk-contract.md)

