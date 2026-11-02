import type { EvaluationInput, PreferencePreset } from '../sdk'
import { factors, presets, routes } from '../sdk/example'

export type ScenarioId = 'shortest-route' | 'better-lighting' | 'road-closure' | 'incomplete-data'
export type ObservationFreshness = 'current' | 'stale' | 'missing'

export interface SyntheticObservation {
  value: number | null
  freshness: ObservationFreshness
}

export interface ScenarioDefinition {
  id: ScenarioId
  label: string
  description: string
  preset: PreferencePreset
  observations: Record<string, Record<string, SyntheticObservation>>
}

export interface ScenarioOptions {
  maxExtraMinutes?: number
  routeBClosed?: boolean
  routeBLightingCurrent?: boolean
}

export interface ScenarioEvaluation {
  input: EvaluationInput
  closedRouteIds: string[]
  observations: ScenarioDefinition['observations']
}

const lightingPreset = presets.find((preset) => preset.id === 'better-lighting')!

const completeObservations = {
  'route-a': {
    lighting: { value: 0.6, freshness: 'current' },
    'open-businesses': { value: 2, freshness: 'current' },
    disruptions: { value: 1, freshness: 'current' },
  },
  'route-b': {
    lighting: { value: 0.95, freshness: 'current' },
    'open-businesses': { value: 11, freshness: 'current' },
    disruptions: { value: 0, freshness: 'current' },
  },
  'route-c': {
    lighting: { value: 0.85, freshness: 'current' },
    'open-businesses': { value: 7, freshness: 'current' },
    disruptions: { value: 0, freshness: 'current' },
  },
} satisfies ScenarioDefinition['observations']

export const scenarios: ScenarioDefinition[] = [
  {
    id: 'shortest-route',
    label: 'Shortest route',
    description: 'Prioritize duration; only the fastest route is eligible.',
    preset: { id: 'shortest-route', label: 'Shortest route', description: 'Prioritize duration.', maxExtraMinutes: 0 },
    observations: completeObservations,
  },
  {
    id: 'better-lighting',
    label: 'Better lighting',
    description: 'Prefer higher documented lighting within a detour limit.',
    preset: lightingPreset,
    observations: completeObservations,
  },
  {
    id: 'road-closure',
    label: 'Road closure',
    description: 'Apply a hard closure constraint before preference scoring.',
    preset: { ...lightingPreset, id: 'road-closure', label: 'Road closure', maxExtraMinutes: 7 },
    observations: completeObservations,
  },
  {
    id: 'incomplete-data',
    label: 'Incomplete data',
    description: 'Compare routes with missing and stale observations kept unknown.',
    preset: { ...lightingPreset, id: 'incomplete-data', label: 'Incomplete data', maxExtraMinutes: 7 },
    observations: {
      'route-a': {
        lighting: { value: 0.6, freshness: 'current' },
        'open-businesses': { value: 2, freshness: 'current' },
        disruptions: { value: 1, freshness: 'current' },
      },
      'route-b': {
        lighting: { value: 0.95, freshness: 'stale' },
        'open-businesses': { value: 11, freshness: 'current' },
        disruptions: { value: 0, freshness: 'current' },
      },
      'route-c': {
        lighting: { value: 0.85, freshness: 'current' },
        'open-businesses': { value: null, freshness: 'missing' },
        disruptions: { value: 0, freshness: 'current' },
      },
    },
  },
]

export function createScenarioEvaluation(
  scenarioId: ScenarioId,
  options: ScenarioOptions = {},
): ScenarioEvaluation {
  const scenario = scenarios.find((item) => item.id === scenarioId)
  if (!scenario) throw new Error(`Unknown scenario: ${scenarioId}`)

  const observations = scenario.observations
  const routeBLightingCurrent = scenarioId === 'incomplete-data' && options.routeBLightingCurrent === true
  const isRouteBClosed = scenarioId === 'road-closure' && options.routeBClosed !== false
  const closedRouteIds = isRouteBClosed ? ['route-b'] : []
  const candidateRoutes = routes.filter((route) => !closedRouteIds.includes(route.id))
  const candidateContexts = candidateRoutes.map((route) => ({
    routeId: route.id,
    factors: Object.fromEntries(
      Object.entries(observations[route.id]).map(([factorId, observation]) => {
        const isCurrent = observation.freshness === 'current' ||
          (route.id === 'route-b' && factorId === 'lighting' && routeBLightingCurrent)
        return [factorId, isCurrent ? observation.value : null]
      }),
    ),
  }))
  const preset = scenarioId === 'better-lighting' && options.maxExtraMinutes !== undefined
    ? { ...scenario.preset, maxExtraMinutes: options.maxExtraMinutes }
    : scenario.preset

  return {
    input: {
      routes: candidateRoutes,
      contexts: candidateContexts,
      factors,
      preset,
    },
    closedRouteIds,
    observations,
  }
}
