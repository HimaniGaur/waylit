# Demo and Evidence

## Demo

The React demo consumes the SDK and uses synthetic route options and observations. Switch between **Better Lighting** and **Shortest Walk** to see how a preference policy changes the result. The scenario simulator also demonstrates closure exclusion, reopening a route, and incomplete observations. These examples are not live navigation data or safety assessments.

To run locally, use `npm ci && npm run dev` from the repository root.

## Kane CLI checks recorded in the repository

The repository's [hackathon evidence notes](https://github.com/HimaniGaur/waylit/blob/main/docs/hackathon-evidence.md) describe the recorded browser runs and their limits. They document a preset-flow run and a simulator run, including expected recommendations, detour exclusions, unknown data handling, and console checks.

Local `.evidence` packs are ignored and are not included in the repository or this wiki. The notes state that local/account evidence is not proof of submission to the event team's Proof tab. Do not treat a locally recorded run as team-submitted evidence unless the event page confirms it.

## Scope of verification

The documented runs check the browser demo against synthetic fixtures. They do not verify live map integrations, live environmental feeds, production hosting, mobile behavior, customer adoption, or safety outcomes.

