# Waylit: Beyond the shortest path

*Draft for Dev.to. Do not publish without reviewing links and the final submission state.*

Route generation and route evaluation are different jobs. A navigation engine can give someone several candidate routes, but it does not decide which one best fits a person's priorities and the contextual evidence available to them. Waylit focuses on that second job: it is a provider-agnostic, framework-independent TypeScript SDK for evaluating existing candidate routes with observations and configurable policies. It does not generate directions or fetch live conditions.

The SDK takes candidate routes, factor definitions, route contexts, and a preference preset. A policy's maximum detour is a hard constraint: candidates beyond it are excluded before scoring. Factor weights and directions are soft preferences that rank only eligible candidates. The result includes a recommendation status, factor-level results, exclusions, warnings, and an explanation. Missing observations remain unknown rather than becoming zero; stale-data handling and provenance remain the calling application's responsibility. Scores describe preference fit, not safety.

The demo uses synthetic values to make policy changes visible. In the included fixture, Route A takes 12 minutes and has a lighting observation of 0.60; Route B takes 16 minutes with lighting 0.95; Route C takes 19 minutes with lighting 0.85. “Shortest Walk” sets the extra-time limit to zero and selects Route A. “Better Lighting” allows five extra minutes and weights lighting more heavily, so Route B is selected and Route C is excluded. These are illustrative values, not measurements of actual streets. The demo and the scenario simulator call the SDK evaluator; they do not implement a separate scoring rule.

That boundary is intentional. Waylit is an SDK for application developers who already have candidate routes and contextual data—not a replacement for navigation, a map provider, or a live-data feed. An integrating application can supply routes from its chosen source and decide how to collect, qualify, and refresh observations.

The core library, ESM package build, generated TypeScript declarations, unit tests, and a packed-package consumer smoke test are implemented. The local demo is runnable with the commands below. Kane CLI 0.10.0-rc.3 verified the saved preset-flow test (seven steps passed in 126 seconds, including the two rankings and a no-console-errors check) and a separate simulator run (81.3 seconds, including closure exclusion, reopening the candidate, stale and missing observations, and no browser errors). Both finalized evidence packs are local to the development machine, not public share links or event Proof-tab submissions.

What remains unproven matters: the route and observation values are synthetic, and there is no live provider integration, production deployment, mobile validation, or demonstrated real-world safety outcome. No user adoption or market demand is claimed.

## Try it

Repository: https://github.com/HimaniGaur/waylit

There is no hosted demo URL currently verified. Run the demo locally:

```sh
git clone https://github.com/HimaniGaur/waylit.git
cd waylit
npm ci
npm run dev
```

The SDK quickstart and package-build instructions are in the repository [README](https://github.com/HimaniGaur/waylit/blob/main/README.md). The tracked Kane test is [`tests/kane/waylit-evidence-check_test.md`](https://github.com/HimaniGaur/waylit/blob/main/tests/kane/waylit-evidence-check_test.md). Local finalized evidence packs (not committed): `.testmuai/evidence/f9def97e-816f-4d10-9edf-b100e7da1dbe.evidence` and `.testmuai/evidence/8c01bd74-eef2-4a8a-8c4f-caf6038a02ec.evidence`.

## Submission-ready project description

Waylit is an open-source, provider-agnostic TypeScript SDK for evaluating and ranking existing candidate routes using contextual observations and configurable policies. It applies hard eligibility constraints before soft preference scoring and returns deterministic recommendations with factor-level reasoning, exclusions, and explicit handling of unknown data. Waylit does not generate directions or fetch live data; its demo uses synthetic observations and makes no safety guarantees.
