# Hackathon Evidence

Updated 2026-10-24 for the SDK release-candidate work on `feature/scenario-simulator`.
PR #2 and the release-candidate follow-up PR #3 are merged. At the time of this check,
`origin/main` was `6f14ac5`, which includes release-candidate commit `348dd02`.

## Latest Kane CLI verification

- Command: `KANE_CLI_USER_AGENT=codex kane-cli testmd run tests/kane/waylit-evidence-check_test.md --agent --headless`.
- CLI: 0.10.0-rc.3, installed in an isolated prefix because the machine-wide 0.9.0 executable occupied its Homebrew link.
- Result: passed; all 7 test steps passed in 126 seconds. The test verified the initial Better Lighting state (including Route B as BEST MATCH and Route C outside the 5-minute detour), no console errors, then Shortest Walk (Route A as BEST MATCH, Route B outside the zero-minute detour, and the no-environmental-superiority explanation).
- Session: `c00faed4-2c57-4b72-ae58-2258e6776f3f`.
- Evidence pack: `.testmuai/evidence/f9def97e-816f-4d10-9edf-b100e7da1dbe.evidence` (local and ignored by Git). `kane-cli evidence validate` returned `valid: true`, `status: finalized`, with no diagnostics. It contains per-step screenshots and console/network logs.
- Kane also returned a Test Manager share URL and reported evidence ingest and bundle sync as successful. This was saved under the configured `KaneAI Generated / route_cause` project; team access was not independently verified, and this run was not submitted to the event team's Proof tab. `kanehack consent status` returned “not decided,” so no run summary was sent.

### Scenario simulator run

- Command, using the local app at `http://127.0.0.1:5173`:

  ```sh
  PATH="/tmp/waylit-kane-cli/node_modules/.bin:$PATH" \
    KANE_CLI_USER_AGENT=codex kane-cli run "Open http://127.0.0.1:5173 and scroll to the Synthetic Route Scenario Simulator. Choose Road Closure. Verify Route B is labeled CLOSED · EXCLUDED and its reason says it was excluded before scoring, while Route C is the top match. Uncheck Route B is marked closed and verify Route B becomes the top match. Choose Incomplete Data. Verify Route B lighting is shown as stale with its last recorded 95% value, Route C open businesses is shown as unknown with no observation, and unknown data is not described as zero. Verify there are no browser console errors." \
    --agent --headless --name waylit-scenario-smoke
  ```

- CLI: 0.10.0-rc.3.
- Result: passed in 81.3 seconds. Kane verified the Road Closure case excluded Route B before scoring and recommended Route C; unchecking the closure made Route B top match; Incomplete Data displayed Route B lighting as stale (95%) and Route C open businesses as unknown rather than zero. Kane reported no browser errors.
- Session: `4c4fe364-a866-41a8-a05c-f8e22c975ada`.
- Evidence pack: `.testmuai/evidence/8c01bd74-eef2-4a8a-8c4f-caf6038a02ec.evidence` (local and ignored by Git). Validation returned `valid: true`, `status: finalized`, with no diagnostics. It contains simulator screenshots, an annotated screenshot, and console/network logs.
- The named run generated a replayable test at `.testmuai/tests/waylit-scenario-smoke_test.md` and output at `.testmuai/tests/output-waylit-scenario-smoke/`; both are local Kane artifacts and are not tracked in Git.

## Earlier evidence

Evidence reviewed on 2026-10-24 for the `initial-setup` branch and PR #1.

## SDK and build checks

- `npm test`: passed, 8 tests.
- `npm run build`: passed after the favicon and explanation changes.
- The React demo imports `evaluateRoutes` from `src/sdk` and renders its recommendation, scores, eligibility, factor observations, and explanation. No separate recommendation calculation is used in the UI.
- Synthetic fixture: Better Lighting selects Route B and excludes Route C at +7 minutes; Shortest Walk selects Route A and excludes the longer routes.

## Kane browser runs

### Existing run: `waylit-preset-check`

- Result: passed in 82.6 seconds, using 31.48 credits.
- Verified Better Lighting initially selected Route B, then Shortest Walk selected Route A and marked Route B outside the 0-minute detour limit.
- The saved console log contained one resource 404. The HAR did not identify a failed request; a direct check confirmed `/favicon.ico` returned 404.
- Local evidence pack: `49807f3c-da4e-4886-8fdb-53580b8431a6.evidence`; validation status: finalized.

### Follow-up run: `waylit-evidence-check`

- Result: passed in 63.9 seconds, using 27.63 credits.
- Verified the displayed route times and lighting values, Route B's Better Lighting recommendation, Route C's +5-minute exclusion, and the Better Lighting explanation.
- After switching presets, verified Route A's Shortest Walk recommendation, Route B's zero-minute exclusion, and the explanation that no environmental superiority is implied.
- Kane reported zero browser console errors at both preset checkpoints.
- Local evidence pack: `0b70ad53-af70-411b-b9a3-446c0f3ae442.evidence`; validation status: finalized.

Screenshots from that run:

![Waylit demo with Better Lighting selected and Route B recommended](assets/waylit-better-lighting.jpg)

![Waylit demo with Shortest Walk selected and Route A recommended](assets/waylit-shortest-walk.jpg)

### Tracked-test replay

- Command: `KANE_CLI_USER_AGENT=codex kane-cli testmd run tests/kane/waylit-evidence-check_test.md --agent --headless`.
- Result: passed in 13 seconds; 1/1 test step passed, 16 recorded actions replayed, and no steps were re-authored.
- The replay result was uploaded to Test Manager, but no share URL was returned.

The second run confirmed and fixed the 404 by declaring `/favicon.svg` in `index.html` and adding `public/favicon.svg`. A direct request to the new asset returned HTTP 200.

The Kane-generated test definition is in [`tests/kane/waylit-evidence-check_test.md`](../tests/kane/waylit-evidence-check_test.md). Re-run from the repository root with:

```sh
KANE_CLI_USER_AGENT=codex kane-cli testmd run tests/kane/waylit-evidence-check_test.md --agent --headless
```

Only the generated test definition is included in the repository. Its 260 KB local replay bundle was omitted because generated metadata contains personal Test Manager identifiers and remote screenshot URLs; a clean checkout may author the test once and consume credits.

The sealed `.evidence` packs remain in the ignored local `.testmuai/evidence/` directory and are not shared by this repository. The Test Manager records were saved to the account's `KaneAI Generated / route_cause` project; team access has not been verified. The Hack Day consent status is still undecided, so no run summary has been submitted to the team's Proof tab. Do not treat the personal Test Manager records or local packs as team-shared evidence.

## Not verified

- Live mapping providers, external environmental data, production hosting, and mobile behavior were not tested.
- No team-shared Kane evidence or submission draft has been verified.
- The demo uses synthetic observations and does not make safety guarantees.