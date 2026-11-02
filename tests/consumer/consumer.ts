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
const factors: FactorDefinition[] = [{
  id: 'activity',
  label: 'Street activity',
  description: 'Observed activity on the route.',
  direction: 'higher',
  weight: 1,
  bounds: { min: 0, max: 10 },
}]
const contexts: RouteContext[] = [
  { routeId: 'quiet', factors: { activity: 2 } },
  { routeId: 'active', factors: { activity: 9 } },
]
const preset: PreferencePreset = {
  id: 'prefer-activity',
  label: 'Prefer activity',
  description: 'Favor routes with higher observed activity.',
  maxExtraMinutes: 3,
}

const result = evaluateRoutes({ routes, contexts, factors, preset })
const recommendation = routes.find((route) => route.id === result.recommendedRouteId)
if (recommendation?.name !== 'Active streets') {
  throw new Error(`Expected Active streets, got ${recommendation?.name ?? 'no recommendation'}.`)
}
if (!result.explanation.includes('adds 2 minutes over the fastest route')) {
  throw new Error(`Unexpected recommendation explanation: ${result.explanation}`)
}

console.log(`${recommendation.name}: ${result.explanation}`)
