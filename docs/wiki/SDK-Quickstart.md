# SDK Quickstart

The host app supplies the route options and context it already has. Each observation is a numeric value within the factor's declared bounds, or `null` when unknown.

```ts
import { evaluateRoutes } from 'waylit'
import type { FactorDefinition, PreferencePreset, Route, RouteContext } from 'waylit'

const routes: Route[] = [
  { id: 'direct', name: 'Direct', durationMinutes: 10, description: 'The shorter option.' },
  { id: 'lit', name: 'Better lit', durationMinutes: 12, description: 'A longer option.' },
]

const factors: FactorDefinition[] = [
  {
    id: 'lighting',
    label: 'Lighting',
    description: 'Lighting observation supplied by the host app.',
    direction: 'higher',
    weight: 1,
    bounds: { min: 0, max: 10 },
  },
]

const contexts: RouteContext[] = [
  { routeId: 'direct', factors: { lighting: 3 } },
  { routeId: 'lit', factors: { lighting: 8 } },
]

const preference: PreferencePreset = {
  id: 'prefer-lighting',
  label: 'Prefer lighting',
  description: 'Favor routes with a higher lighting observation.',
  maxExtraMinutes: 3,
}

const result = evaluateRoutes({ routes, contexts, factors, preset: preference })
const selected = routes.find((route) => route.id === result.recommendedRouteId)

console.log(selected?.name) // Better lit
console.log(result.explanation)
```

The example is illustrative. The SDK evaluates the values supplied by the host app; it does not collect, refresh, or verify observations. For missing or stale data handling, see [Concepts](Concepts).

