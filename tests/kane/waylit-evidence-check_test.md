---
mode: testing
max_steps: 50
target: chrome
headless: true
---

# Session: waylit-evidence-check

## Step 1
Go to http://127.0.0.1:5173 and verify the Better lighting tab is selected, Route A shows 12 minutes and 60% lighting, Route B shows 16 minutes and 95% lighting and is marked BEST MATCH, Route C shows 19 minutes and is outside the 5-minute detour limit, and the recommendation explanation says Route B had the highest preference score and adds 4 minutes. Verify there are no console errors. Click the Shortest walk tab and verify Route A is marked BEST MATCH, Route B is outside the 0-minute detour limit, the explanation says Route A was selected as the only route within the zero-minute limit and says no environmental superiority is implied, and there are no console errors.
