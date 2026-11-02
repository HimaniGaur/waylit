export type FactorDirection = 'higher' | 'lower'
export type Observation = number | null

export interface FactorDefinition {
  id: string
  label: string
  weight: number
  direction: FactorDirection
  bounds: { min: number; max: number }
  description: string
}

export interface RouteContext {
  routeId: string
  /** A number is an observation; null explicitly means unknown. Omitted registered factors are also unknown. */
  factors: Record<string, Observation>
}

export interface Route {
  id: string
  name: string
  durationMinutes: number
  description: string
}

export interface PreferencePreset {
  id: string
  label: string
  description: string
  weightOverrides?: Partial<Record<string, number>>
  maxExtraMinutes: number
}

export interface EvaluationInput {
  routes: Route[]
  contexts: RouteContext[]
  factors: FactorDefinition[]
  preset: PreferencePreset
}

export interface FactorContribution {
  factorId: string
  label: string
  value: number
  normalizedValue: number
  /** Configured factor or preset weight before normalization. */
  weight: number
  /** Contribution on the 0..100 score scale. */
  contribution: number
}

export type FactorStatus = 'observed' | 'unknown'

export interface FactorResult {
  factorId: string
  label: string
  value: number | null
  normalizedValue: number | null
  effectiveWeight: number
  contribution: number | null
  status: FactorStatus
}

export interface RouteResult {
  routeId: string
  durationMinutes: number
  extraMinutes: number
  eligible: boolean
  exclusionReasons: string[]
  score: number | null
  dataCoverage: number
  factorResults: FactorResult[]
  missingFactors: string[]
  explanation: string
}

export type EvaluationStatus = 'recommended' | 'provisional' | 'insufficient_data'
export type RecommendationBasis = 'preference_score' | 'shortest_duration'

export interface EvaluationResult {
  presetId: string
  status: EvaluationStatus
  recommendedRouteId: string | null
  basis: RecommendationBasis | null
  routes: RouteResult[]
  explanation: string
  warnings: string[]
}

export interface ScoringInput {
  route: Route
  context: RouteContext
  factors: FactorDefinition[]
  preset: PreferencePreset
}

export interface ScoringStrategy {
  readonly id: string
  score(input: ScoringInput): { score: number | null; observedFactors: FactorContribution[]; missingFactors: string[] }
}

/** Default strategy. Missing observations are excluded and remaining weights are renormalized. */
export const weightedNormalizedScoring: ScoringStrategy = {
  id: 'weighted-normalized',
  score({ context, factors, preset }) {
    const missingFactors: string[] = []
    const observed: Array<Omit<FactorContribution, 'contribution' | 'weight'>> = []
    let totalWeight = 0
    for (const factor of factors) {
      const weight = preset.weightOverrides?.[factor.id] ?? factor.weight
      const value = context.factors[factor.id]
      if (value === undefined || value === null) { missingFactors.push(factor.id); continue }
      const raw = (value - factor.bounds.min) / (factor.bounds.max - factor.bounds.min)
      const normalizedValue = Math.max(0, Math.min(1, factor.direction === 'higher' ? raw : 1 - raw))
      totalWeight += weight
      observed.push({ factorId: factor.id, label: factor.label, value, normalizedValue })
    }
    return {
      score: totalWeight === 0 ? null : observed.reduce((sum, factor) => sum + factor.normalizedValue * (preset.weightOverrides?.[factor.factorId] ?? factors.find((item) => item.id === factor.factorId)!.weight) / totalWeight, 0) * 100,
      observedFactors: observed.map((factor) => {
        const weight = preset.weightOverrides?.[factor.factorId] ?? factors.find((item) => item.id === factor.factorId)!.weight
        return { ...factor, weight, contribution: factor.normalizedValue * weight / totalWeight * 100 }
      }),
      missingFactors,
    }
  },
}

function validateInputs(routes: Route[], contexts: RouteContext[], factors: FactorDefinition[], preset: PreferencePreset) {
  if (!Array.isArray(routes)) throw new Error('routes must be an array.')
  if (!Array.isArray(contexts)) throw new Error('contexts must be an array.')
  if (!Array.isArray(factors)) throw new Error('factors must be an array.')
  if (!preset || typeof preset !== 'object') throw new Error('A preference preset is required.')
  if (typeof preset.id !== 'string' || !preset.id || typeof preset.label !== 'string' || !preset.label || typeof preset.description !== 'string') throw new Error('Preset id, label, and description must be strings.')
  if (!routes.length) throw new Error('At least one route is required.')
  if (!Number.isFinite(preset.maxExtraMinutes) || preset.maxExtraMinutes < 0) throw new Error('maxExtraMinutes must be a finite non-negative number.')
  if (preset.weightOverrides !== undefined && (!preset.weightOverrides || typeof preset.weightOverrides !== 'object' || Array.isArray(preset.weightOverrides))) throw new Error('weightOverrides must be an object keyed by factor ID.')
  const ids = new Set<string>()
  const factorIds = new Set<string>()
  for (const [index, factor] of factors.entries()) {
    if (!factor || typeof factor !== 'object') throw new Error(`Invalid factor definition at index ${index}.`)
    if (typeof factor.id !== 'string' || !factor.id || factorIds.has(factor.id)) throw new Error(`Factor ID must be unique and non-empty: ${factor.id}`)
    factorIds.add(factor.id)
    if (typeof factor.label !== 'string' || !factor.label || typeof factor.description !== 'string' || !factor.description || !['higher', 'lower'].includes(factor.direction)) throw new Error(`Invalid factor definition for ${factor.id}.`)
    if (!Number.isFinite(factor.weight) || factor.weight < 0) throw new Error(`Invalid weight for ${factor.id}.`)
    if (!factor.bounds || typeof factor.bounds !== 'object' || !Number.isFinite(factor.bounds.min) || !Number.isFinite(factor.bounds.max) || factor.bounds.max <= factor.bounds.min) throw new Error(`Invalid bounds for ${factor.id}.`)
  }
  const weights = factors.map((factor) => preset.weightOverrides?.[factor.id] ?? factor.weight)
  for (const [id, weight] of Object.entries(preset.weightOverrides ?? {})) {
    if (!factorIds.has(id) || !Number.isFinite(weight) || weight! < 0) throw new Error(`Invalid weight override for ${id}.`)
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
  if (!Number.isFinite(totalWeight) || totalWeight <= 0) throw new Error('Total factor weight must be finite and greater than zero.')
  for (const route of routes) {
    if (!route || typeof route.id !== 'string' || !route.id || ids.has(route.id)) throw new Error(`Route ID must be unique and non-empty: ${route?.id}`)
    if (typeof route.name !== 'string' || typeof route.description !== 'string') throw new Error(`Route name and description must be strings: ${route.id}.`)
    ids.add(route.id)
    if (!Number.isFinite(route.durationMinutes) || route.durationMinutes <= 0) throw new Error(`Invalid duration for route ${route.id}.`)
  }
  const contextById = new Map<string, RouteContext>()
  for (const context of contexts) {
    if (!context || typeof context.routeId !== 'string' || !context.routeId || !context.factors || typeof context.factors !== 'object' || Array.isArray(context.factors)) throw new Error('Each route context must include a routeId and factors object.')
    if (contextById.has(context.routeId)) throw new Error(`Duplicate context for route ${context.routeId}.`)
    contextById.set(context.routeId, context)
    if (!ids.has(context.routeId)) throw new Error(`Context references unknown route ${context.routeId}.`)
    for (const [factorId, value] of Object.entries(context.factors)) {
      const definition = factors.find((factor) => factor.id === factorId)
      if (!definition) throw new Error(`Unknown factor ${factorId} on route ${context.routeId}.`)
      if (value !== null && (!Number.isFinite(value) || value < definition.bounds.min || value > definition.bounds.max)) throw new Error(`Malformed value for ${factorId} on route ${context.routeId}.`)
    }
  }
  return contextById
}

export function evaluateRoutes(
  input: EvaluationInput,
  strategy: ScoringStrategy = weightedNormalizedScoring,
): EvaluationResult {
  if (!input || typeof input !== 'object') throw new Error('An evaluation input object is required.')
  const { routes, contexts, factors, preset } = input
  const contextById = validateInputs(routes, contexts, factors, preset)
  const shortest = Math.min(...routes.map((route) => route.durationMinutes))
  const totalWeight = factors.reduce((sum, factor) => sum + (preset.weightOverrides?.[factor.id] ?? factor.weight), 0)
  const routeResults: RouteResult[] = routes.map((route) => {
    const extraMinutes = route.durationMinutes - shortest
    const eligible = extraMinutes <= preset.maxExtraMinutes
    if (!eligible) {
      return {
        routeId: route.id,
        durationMinutes: route.durationMinutes,
        extraMinutes,
        eligible,
        exclusionReasons: [`Exceeds the ${preset.maxExtraMinutes}-minute maximum detour.`],
        score: null,
        dataCoverage: 0,
        factorResults: [],
        missingFactors: [],
        explanation: `${route.name} exceeds the maximum detour and was not scored.`,
      }
    }

    const context = contextById.get(route.id) ?? { routeId: route.id, factors: {} }
    const result = strategy.score({ route, context, factors, preset })
    const observedById = new Map(result.observedFactors.map((factor) => [factor.factorId, factor]))
    const factorResults = factors.map((factor): FactorResult => {
      const value = context.factors[factor.id]
      const observed = observedById.get(factor.id)
      const effectiveWeight = (preset.weightOverrides?.[factor.id] ?? factor.weight) / totalWeight
      if (value === null || value === undefined || !observed) {
        return { factorId: factor.id, label: factor.label, value: null, normalizedValue: null, effectiveWeight, contribution: null, status: 'unknown' }
      }
      return { factorId: factor.id, label: factor.label, value, normalizedValue: observed.normalizedValue, effectiveWeight, contribution: observed.normalizedValue * effectiveWeight, status: 'observed' }
    })
    const missingFactors = factorResults.filter((factor) => factor.status === 'unknown').map((factor) => factor.factorId)
    const hasMissingWeightedFactor = factorResults.some((factor) => factor.status === 'unknown' && factor.effectiveWeight > 0)
    const score = hasMissingWeightedFactor ? null : result.score
    const dataCoverage = factorResults.reduce((sum, factor) => sum + (factor.status === 'observed' ? factor.effectiveWeight : 0), 0)
    const unknownLabels = factorResults.filter((factor) => factor.status === 'unknown').map((factor) => factor.label)
    const explanation = unknownLabels.length
      ? `${route.name} has unknown ${unknownLabels.join(', ').toLowerCase()} data${hasMissingWeightedFactor ? '; its weighted score is unavailable' : ''}.`
      : `${route.name} has observations for all positively weighted factors.`
    return { routeId: route.id, durationMinutes: route.durationMinutes, extraMinutes, eligible, exclusionReasons: [], score, dataCoverage, factorResults, missingFactors, explanation }
  })

  const eligible = routeResults.filter((route) => route.eligible)
  const complete = eligible.filter((route) => route.score !== null)
  const incomplete = eligible.filter((route) => route.score === null)
  const shortestOnly = preset.maxExtraMinutes === 0
  const routeById = new Map(routes.map((route) => [route.id, route]))
  const byScore = (a: RouteResult, b: RouteResult) =>
    (b.score! - a.score!) ||
    (a.durationMinutes - b.durationMinutes) ||
    (a.routeId < b.routeId ? -1 : a.routeId > b.routeId ? 1 : 0)
  complete.sort(byScore)

  let recommendedRouteId: string | null = null
  let basis: RecommendationBasis | null = null
  let status: EvaluationStatus
  if (complete.length) {
    recommendedRouteId = complete[0].routeId
    basis = shortestOnly ? 'shortest_duration' : 'preference_score'
    status = incomplete.length ? 'provisional' : 'recommended'
  } else if (shortestOnly) {
    eligible.sort((a, b) => a.routeId < b.routeId ? -1 : a.routeId > b.routeId ? 1 : 0)
    recommendedRouteId = eligible[0]?.routeId ?? null
    basis = recommendedRouteId ? 'shortest_duration' : null
    status = recommendedRouteId ? 'provisional' : 'insufficient_data'
  } else {
    status = 'insufficient_data'
  }

  const warnings: string[] = []
  if (incomplete.length) warnings.push('One or more eligible routes are missing positively weighted observations; the comparison is provisional.')
  if (!complete.length && shortestOnly && recommendedRouteId) warnings.push('No eligible route has complete environmental observations; the shortest route was selected by duration, then route ID.')
  if (!complete.length && !shortestOnly) warnings.push('No eligible route has complete observations for all positively weighted factors.')
  if (routeResults.some((route) => !route.eligible)) warnings.push('Routes outside the maximum detour were excluded before scoring.')

  const winner = recommendedRouteId ? routeResults.find((route) => route.routeId === recommendedRouteId)! : null
  const winnerRoute = recommendedRouteId ? routeById.get(recommendedRouteId)! : null
  const explanation = winner && winnerRoute
    ? shortestOnly
      ? `${winnerRoute.name} was selected ${eligible.length === 1 ? 'as the only route within the zero-minute limit' : winner.score === null ? 'by route ID because complete environmental scores were unavailable' : 'by preference score among routes tied for shortest duration'}. No environmental superiority is implied.`
      : `${winnerRoute.name} had the highest preference score among eligible routes and adds ${winner.extraMinutes} minutes over the fastest route.${status === 'provisional' ? ' This comparison is provisional because an eligible alternative has missing weighted observations.' : ''}`
    : 'No eligible route has complete observations for all positively weighted factors.'

  return { presetId: preset.id, status, recommendedRouteId, basis, routes: routeResults, explanation, warnings }
}
