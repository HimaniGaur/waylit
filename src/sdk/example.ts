import type { FactorDefinition, PreferencePreset, Route, RouteContext } from './index'

export const factors: FactorDefinition[] = [
  { id: 'lighting', label: 'Lighting', weight: 0.6, direction: 'higher', bounds: { min: 0, max: 1 }, description: 'Synthetic documented lighting observation.' },
  { id: 'open-businesses', label: 'Open businesses', weight: 0.25, direction: 'higher', bounds: { min: 0, max: 12 }, description: 'Synthetic expected-open business count.' },
  { id: 'disruptions', label: 'Disruptions', weight: 0.15, direction: 'lower', bounds: { min: 0, max: 3 }, description: 'Synthetic known disruption count.' },
]

export const presets: PreferencePreset[] = [
  { id: 'better-lighting', label: 'Better lighting', description: 'Prefer routes with better documented lighting.', weightOverrides: { lighting: 0.75, 'open-businesses': 0.15, disruptions: 0.1 }, maxExtraMinutes: 5 },
  { id: 'shortest-walk', label: 'Shortest walk', description: 'Keep to the shortest-duration routes.', maxExtraMinutes: 0 },
]

export const routes: Route[] = [
  { id: 'route-a', name: 'Route A', durationMinutes: 12, description: 'A shorter walk along familiar streets.' },
  { id: 'route-b', name: 'Route B', durationMinutes: 16, description: 'A brighter walk through active streets.' },
  { id: 'route-c', name: 'Route C', durationMinutes: 19, description: 'A longer walk with a quieter stretch.' },
]

export const contexts: RouteContext[] = [
  { routeId: 'route-a', factors: { lighting: 0.6, 'open-businesses': 2, disruptions: 1 } },
  { routeId: 'route-b', factors: { lighting: 0.95, 'open-businesses': 11, disruptions: 0 } },
  { routeId: 'route-c', factors: { lighting: 0.85, 'open-businesses': 7, disruptions: 0 } },
]
