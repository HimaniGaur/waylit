import { describe, expect, it } from 'vitest'
import { contexts, factors, routes } from '../sdk/example'
import { evaluateConfirmedPolicy, explainEvaluation, proposePolicy, summarizeEvidence } from './routeEvaluationAssistant'

describe('route evaluation assistant workflow', () => {
  it('maps a supported lighting priority to deterministic weights and a hard detour limit', () => {
    const proposal = proposePolicy(factors, 'lighting', 5)
    expect(proposal.priorityLabel).toBe('More lighting')
    expect(proposal.preset.maxExtraMinutes).toBe(5)
    expect(proposal.preset.weightOverrides?.lighting).toBeCloseTo(0.75)
    expect(proposal.preset.weightOverrides?.['open-businesses']).toBeCloseTo(0.15625)
    expect(proposal.preset.weightOverrides?.disruptions).toBeCloseTo(0.09375)
  })

  it('respects lower-is-better direction for fewer disruptions', () => {
    const proposal = proposePolicy(factors, 'disruptions', 3)
    expect(proposal.priorityLabel).toBe('Fewer disruptions')
    expect(proposal.preset.maxExtraMinutes).toBe(3)
    expect(proposal.preset.weightOverrides?.disruptions).toBe(0.75)
  })

  it('summarizes available and missing values without inventing freshness, and flags detour violations', () => {
    const partialContexts = contexts.map((context) => context.routeId === 'route-b'
      ? { routeId: context.routeId, factors: { 'open-businesses': 11, disruptions: 0 } }
      : context)
    const summary = summarizeEvidence(routes, partialContexts, factors, 5, {
      'route-b': { lighting: { value: 0.95, freshness: 'stale' } },
    }, {
      'route-b': 'Marked closed in the selected scenario.',
    })
    const routeB = summary.find((route) => route.routeId === 'route-b')!
    const routeC = summary.find((route) => route.routeId === 'route-c')!
    expect(routeB.available.map((item) => item.label)).toContain('Open businesses')
    expect(routeB.stale).toContainEqual({ factorId: 'lighting', label: 'Lighting', value: 0.95 })
    expect(routeB.missing).not.toContain('Lighting')
    expect(routeB.hardConstraintReason).toBe('Marked closed in the selected scenario.')
    expect(routeC.violatesDetourLimit).toBe(true)
  })

  it('does not invoke evaluation until the proposed policy is confirmed', () => {
    const proposal = proposePolicy(factors, 'lighting', 5)
    const input = { routes, contexts, factors }
    expect(evaluateConfirmedPolicy(input, proposal, false)).toBeNull()
    expect(evaluateConfirmedPolicy(input, proposal, true)?.recommendedRouteId).toBe('route-b')
  })

  it('preserves an explicit hard closure before SDK evaluation and explains the exclusion', () => {
    const proposal = proposePolicy(factors, 'lighting', 5)
    const hardExclusions = { 'route-b': 'Marked closed in the selected scenario.' }
    const result = evaluateConfirmedPolicy({ routes, contexts, factors }, proposal, true, hardExclusions)!
    const narrative = explainEvaluation(result, routes, hardExclusions)
    expect(result.routes.some((route) => route.routeId === 'route-b')).toBe(false)
    expect(result.recommendedRouteId).toBe('route-a')
    expect(narrative.excludedRoutes).toContainEqual({ routeName: 'Route B', reason: 'Marked closed in the selected scenario.' })
  })

    it('keeps missing observations unknown in the confirmed SDK result and explanation', () => {
      const proposal = proposePolicy(factors, 'lighting', 5)
      const partialContexts = contexts.map((context) => context.routeId === 'route-b'
        ? { routeId: context.routeId, factors: { 'open-businesses': 11, disruptions: 0 } }
        : context)
      const result = evaluateConfirmedPolicy({ routes, contexts: partialContexts, factors }, proposal, true)!
      const narrative = explainEvaluation(result, routes)
      const routeB = result.routes.find((route) => route.routeId === 'route-b')!
      expect(routeB.score).toBeNull()
      expect(result.status).toBe('provisional')
      expect(narrative.unknownFactors).toContainEqual({ routeName: 'Route B', factorLabels: ['Lighting'] })
    })

  it('builds recommendation explanations and exclusions from the SDK result', () => {
    const proposal = proposePolicy(factors, 'lighting', 5)
    const result = evaluateConfirmedPolicy({ routes, contexts, factors }, proposal, true)!
    const narrative = explainEvaluation(result, routes)
    expect(narrative.recommendedRouteName).toBe('Route B')
    expect(narrative.explanation).toBe(result.explanation)
    expect(narrative.influentialFactors.length).toBeGreaterThan(0)
    expect(narrative.excludedRoutes).toContainEqual({
      routeName: 'Route C',
      reason: 'Exceeds the 5-minute maximum detour.',
    })
  })
})