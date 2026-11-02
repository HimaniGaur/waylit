import { evaluateRoutes, type EvaluationInput, type EvaluationResult, type FactorDefinition, type PreferencePreset, type Route, type RouteContext } from '../sdk'

export interface PolicyProposal {
  priorityFactorId: string
  priorityLabel: string
  preset: PreferencePreset
}

export interface AvailableObservation {
  factorId: string
  label: string
  value: number
  freshness: 'current' | 'unknown'
}

export interface StaleObservation {
  factorId: string
  label: string
  value: number
}

export interface ObservationMetadata {
  value: number | null
  freshness: 'current' | 'stale' | 'missing'
}

export interface RouteEvidenceSummary {
  routeId: string
  routeName: string
  durationMinutes: number
  extraMinutes: number
  available: AvailableObservation[]
  stale: StaleObservation[]
  missing: string[]
  violatesDetourLimit: boolean
  hardConstraintReason: string | null
}

export type ObservationMetadataByRoute = Record<string, Record<string, ObservationMetadata>>
export type HardExclusions = Record<string, string>

export interface EvaluationNarrative {
  recommendedRouteName: string | null
  explanation: string
  influentialFactors: Array<{ label: string; points: number }>
  excludedRoutes: Array<{ routeName: string; reason: string }>
  unknownFactors: Array<{ routeName: string; factorLabels: string[] }>
  warnings: string[]
}

export function proposePolicy(
  factors: FactorDefinition[],
  priorityFactorId: string,
  maxExtraMinutes: number,
): PolicyProposal {
  if (!Number.isFinite(maxExtraMinutes) || maxExtraMinutes < 0) {
    throw new Error('Maximum extra minutes must be a finite non-negative number.')
  }
  const priorityFactor = factors.find((factor) => factor.id === priorityFactorId)
  if (!priorityFactor) throw new Error(`Unknown priority factor: ${priorityFactorId}`)

  const remainingFactors = factors.filter((factor) => factor.id !== priorityFactorId && factor.weight > 0)
  const remainingWeight = remainingFactors.reduce((total, factor) => total + factor.weight, 0)
  const weightOverrides: Record<string, number> = Object.fromEntries(factors.map((factor) => [factor.id, 0]))
  weightOverrides[priorityFactorId] = remainingWeight > 0 ? 0.75 : 1
  for (const factor of remainingFactors) {
    weightOverrides[factor.id] = remainingWeight > 0 ? 0.25 * factor.weight / remainingWeight : 0
  }

  const priorityLabel = `${priorityFactor.direction === 'higher' ? 'More' : 'Fewer'} ${priorityFactor.label.toLowerCase()}`
  return {
    priorityFactorId,
    priorityLabel,
    preset: {
      id: `assistant-${priorityFactorId}`,
      label: priorityLabel,
      description: `Softly prioritize ${priorityLabel.toLowerCase()}.`,
      maxExtraMinutes,
      weightOverrides,
    },
  }
}

export function summarizeEvidence(
  routes: Route[],
  contexts: RouteContext[],
  factors: FactorDefinition[],
  maxExtraMinutes: number,
  observationMetadata: ObservationMetadataByRoute = {},
  hardExclusions: HardExclusions = {},
): RouteEvidenceSummary[] {
  if (!routes.length) return []
  const contextByRoute = new Map(contexts.map((context) => [context.routeId, context]))
  const candidates = routes.filter((route) => !hardExclusions[route.id])
  const fastestMinutes = Math.min(...(candidates.length ? candidates : routes).map((route) => route.durationMinutes))

  return routes.map((route) => {
    const observations = contextByRoute.get(route.id)?.factors ?? {}
    const available: AvailableObservation[] = []
    const stale: StaleObservation[] = []
    const missing: string[] = []
    for (const factor of factors) {
      const value = observations[factor.id]
      const metadata = observationMetadata[route.id]?.[factor.id]
      if (metadata?.freshness === 'stale') {
        if (metadata.value === null) missing.push(factor.label)
        else stale.push({ factorId: factor.id, label: factor.label, value: metadata.value })
      } else if (metadata?.freshness === 'missing' || value === null || value === undefined) {
        missing.push(factor.label)
      } else {
        available.push({ factorId: factor.id, label: factor.label, value, freshness: metadata?.freshness ?? 'unknown' })
      }
    }
    const extraMinutes = route.durationMinutes - fastestMinutes
    return {
      routeId: route.id,
      routeName: route.name,
      durationMinutes: route.durationMinutes,
      extraMinutes,
      available,
      stale,
      missing,
      violatesDetourLimit: extraMinutes > maxExtraMinutes,
      hardConstraintReason: hardExclusions[route.id] ?? null,
    }
  })
}

export function evaluateConfirmedPolicy(
  input: Omit<EvaluationInput, 'preset'>,
  proposal: PolicyProposal,
  confirmed: boolean,
  hardExclusions: HardExclusions = {},
): EvaluationResult | null {
  if (!confirmed) return null
  const excludedRouteIds = new Set(Object.keys(hardExclusions))
  const candidateRoutes = input.routes.filter((route) => !excludedRouteIds.has(route.id))
  if (!candidateRoutes.length) throw new Error('No candidate routes remain after applying the selected hard constraints.')
  return evaluateRoutes({
    ...input,
    routes: candidateRoutes,
    contexts: input.contexts.filter((context) => !excludedRouteIds.has(context.routeId)),
    preset: proposal.preset,
  })
}

export function explainEvaluation(result: EvaluationResult, routes: Route[], hardExclusions: HardExclusions = {}): EvaluationNarrative {
  const recommended = routes.find((route) => route.id === result.recommendedRouteId)
  const recommendedResult = result.routes.find((route) => route.routeId === result.recommendedRouteId)
  const influentialFactors = (recommendedResult?.factorResults ?? [])
    .filter((factor) => factor.status === 'observed' && factor.effectiveWeight > 0)
    .map((factor) => ({ label: factor.label, points: (factor.contribution ?? 0) * 100 }))
    .sort((left, right) => right.points - left.points)
  const sdkExcludedRoutes = result.routes
    .filter((route) => !route.eligible)
    .map((route) => ({
      routeName: routes.find((item) => item.id === route.routeId)?.name ?? route.routeId,
      reason: route.exclusionReasons.join(' '),
    }))
  const explicitExclusions = routes
    .filter((route) => hardExclusions[route.id])
    .map((route) => ({ routeName: route.name, reason: hardExclusions[route.id] }))
  const excludedRoutes = [...explicitExclusions, ...sdkExcludedRoutes]
  const unknownFactors = result.routes
    .filter((route) => route.eligible)
    .map((route) => ({
      routeName: routes.find((item) => item.id === route.routeId)?.name ?? route.routeId,
      factorLabels: route.factorResults
        .filter((factor) => factor.status === 'unknown' && factor.effectiveWeight > 0)
        .map((factor) => factor.label),
    }))
    .filter((route) => route.factorLabels.length > 0)

  return {
    recommendedRouteName: recommended?.name ?? null,
    explanation: result.explanation,
    influentialFactors,
    excludedRoutes,
    unknownFactors,
    warnings: result.warnings,
  }
}