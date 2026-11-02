import { describe, expect, it, vi } from 'vitest'
import { evaluateRoutes, weightedNormalizedScoring, type FactorDefinition, type PreferencePreset, type Route, type RouteContext, type ScoringStrategy } from './index'
import { contexts, factors, presets, routes } from './example'

describe('Waylit SDK', () => {
  it('recommends Route B for lighting and Route A for shortest walk', () => {
    const betterLighting = evaluateRoutes({ routes, contexts, factors, preset: presets[0] })
    const shortestWalk = evaluateRoutes({ routes, contexts, factors, preset: presets[1] })
    expect(betterLighting.recommendedRouteId).toBe('route-b')
    const routeB = betterLighting.routes.find((route) => route.routeId === 'route-b')!
    expect(routeB.score).toBeCloseTo(95)
    expect(routeB.factorResults.find((factor) => factor.factorId === 'lighting')).toMatchObject({ normalizedValue: 0.95, effectiveWeight: 0.75 })
    expect(routeB.factorResults.find((factor) => factor.factorId === 'disruptions')?.normalizedValue).toBe(1)
    expect(betterLighting.routes.find((route) => route.routeId === 'route-c')?.eligible).toBe(false)
    expect(betterLighting.explanation).toContain('Route B had the highest preference score among eligible routes and adds 4 minutes')
    expect(shortestWalk.recommendedRouteId).toBe('route-a')
    expect(shortestWalk.explanation).toContain('Route A was selected as the only route within the zero-minute limit')
  })

  it('accepts a newly registered factor without changing the evaluator', () => {
    const factor: FactorDefinition = { id: 'tree-cover', label: 'Tree cover', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Canopy along the walk.' }
    const moreContexts = contexts.map((context) => ({ ...context, factors: { ...context.factors, 'tree-cover': context.routeId === 'route-a' ? 100 : 0 } }))
    const preset: PreferencePreset = { id: 'shade', label: 'Shade', description: '', maxExtraMinutes: 8 }
    const result = evaluateRoutes({ routes, contexts: moreContexts, factors: [...factors, factor], preset })
    expect(result.recommendedRouteId).toBe('route-a')
    expect(result.routes[0].factorResults.map((item) => item.factorId)).toContain('tree-cover')
  })

  it('allows preference weights to change the ranking', () => {
    const testRoutes: Route[] = [
      { id: 'dim', name: 'Dim', durationMinutes: 10, description: '' },
      { id: 'bright', name: 'Bright', durationMinutes: 11, description: '' },
    ]
    const testFactors: FactorDefinition[] = [
      { id: 'lighting', label: 'Lighting', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Street lighting.' },
      { id: 'business', label: 'Business', weight: 1, direction: 'higher', bounds: { min: 0, max: 100 }, description: 'Open businesses.' },
    ]
    const testContexts: RouteContext[] = [
      { routeId: 'dim', factors: { lighting: 10, business: 100 } },
      { routeId: 'bright', factors: { lighting: 100, business: 10 } },
    ]
    expect(evaluateRoutes({ routes: testRoutes, contexts: testContexts, factors: testFactors, preset: { id: 'business', label: 'Business', description: '', maxExtraMinutes: 2, weightOverrides: { lighting: 0.1, business: 1 } } }).recommendedRouteId).toBe('dim')
    expect(evaluateRoutes({ routes: testRoutes, contexts: testContexts, factors: testFactors, preset: { id: 'lighting', label: 'Lighting', description: '', maxExtraMinutes: 2, weightOverrides: { lighting: 1, business: 0.1 } } }).recommendedRouteId).toBe('bright')
  })

  it('leaves incomplete weighted routes unscored and marks the result provisional', () => {
    const partialContexts: RouteContext[] = contexts.map((context) => context.routeId === 'route-b'
      ? { routeId: context.routeId, factors: { 'open-businesses': 11, disruptions: 0 } }
      : context)
    const result = evaluateRoutes({ routes, contexts: partialContexts, factors, preset: presets[0] })
    const routeB = result.routes.find((route) => route.routeId === 'route-b')!
    const lighting = routeB.factorResults.find((factor) => factor.factorId === 'lighting')!
    expect(result.status).toBe('provisional')
    expect(result.recommendedRouteId).toBe('route-a')
    expect(routeB.score).toBeNull()
    expect(routeB.dataCoverage).toBeLessThan(1)
    expect(lighting.status).toBe('unknown')
    expect(lighting.normalizedValue).toBeNull()
    expect(lighting.contribution).toBeNull()
    expect(routeB.missingFactors).toContain('lighting')
  })

  it('returns insufficient_data when no eligible route has complete weighted observations', () => {
    const partialContexts = contexts.map((context) => ({ ...context, factors: { ...context.factors, lighting: null } }))
    const result = evaluateRoutes({ routes, contexts: partialContexts, factors, preset: presets[0] })
    expect(result.status).toBe('insufficient_data')
    expect(result.recommendedRouteId).toBeNull()
  })

  it('enforces maximum detour before invoking the scoring strategy', () => {
    const score = vi.fn(weightedNormalizedScoring.score)
    const strategy: ScoringStrategy = { id: 'count-calls', score }
    const result = evaluateRoutes({ routes, contexts, factors, preset: { ...presets[0], maxExtraMinutes: 3 } }, strategy)
    expect(score).toHaveBeenCalledTimes(1)
    expect(result.routes.find((route) => route.routeId === 'route-b')).toMatchObject({ eligible: false, score: null, factorResults: [] })
    expect(result.routes.find((route) => route.routeId === 'route-c')?.exclusionReasons).not.toHaveLength(0)
  })

  it('rejects invalid inputs with field-specific errors', () => {
    const input = { routes, contexts, factors, preset: presets[0] }
    expect(() => evaluateRoutes({ ...input, factors: factors.map((factor) => ({ ...factor, weight: 0 })), preset: { ...presets[0], weightOverrides: { lighting: 0, 'open-businesses': 0, disruptions: 0 } } })).toThrow(/weight/i)
    expect(() => evaluateRoutes({ ...input, factors: [{ ...factors[0], bounds: { min: 2, max: 2 } }] })).toThrow(/bounds/i)
    expect(() => evaluateRoutes({ ...input, routes: [{ ...routes[0], durationMinutes: Number.NaN }], contexts: [] })).toThrow(/duration/i)
    expect(() => evaluateRoutes({ ...input, contexts: [{ routeId: 'route-a', factors: { lighting: Number.NaN } }, ...contexts.slice(1)] })).toThrow(/value/i)
    expect(() => evaluateRoutes({ ...input, contexts: [{ routeId: 'route-a', factors: { unregistered: 1 } }, ...contexts.slice(1)] })).toThrow(/unknown factor/i)
    expect(() => evaluateRoutes({ ...input, preset: { ...presets[0], weightOverrides: { unknown: 1 } } })).toThrow(/override/i)
    expect(() => evaluateRoutes({ ...input, factors: [null as unknown as FactorDefinition] })).toThrow(/factor definition/i)
    expect(() => evaluateRoutes({ ...input, factors: [{ ...factors[0], bounds: null as unknown as FactorDefinition['bounds'] }] })).toThrow(/bounds/i)
    expect(() => evaluateRoutes({ ...input, routes: [] })).toThrow(/at least one route/i)
    expect(() => evaluateRoutes({ ...input, routes: [routes[0], routes[0]] })).toThrow(/route ID/i)
    expect(() => evaluateRoutes({ ...input, contexts: [contexts[0], contexts[0]] })).toThrow(/duplicate context/i)
    expect(() => evaluateRoutes({ ...input, preset: { ...presets[0], maxExtraMinutes: Number.POSITIVE_INFINITY } })).toThrow(/maxExtraMinutes/i)
    expect(() => evaluateRoutes({ ...input, preset: { ...presets[0], weightOverrides: null as unknown as PreferencePreset['weightOverrides'] } })).toThrow(/weightOverrides/i)
    expect(() => evaluateRoutes({ ...input, contexts: [{ routeId: 'route-a', factors: { lighting: -1 } }, ...contexts.slice(1)] })).toThrow(/value/i)
    expect(() => evaluateRoutes({ ...input, contexts: [{ routeId: 'route-a', factors: { lighting: Number.POSITIVE_INFINITY } }, ...contexts.slice(1)] })).toThrow(/value/i)
    expect(() => evaluateRoutes({ ...input, factors: [factors[0], factors[0]] })).toThrow(/factor ID/i)
  })

  it('breaks exact score ties by duration and then route ID deterministically', () => {
    const tiedRoutes: Route[] = [
      { id: 'route-z', name: 'Route Z', durationMinutes: 12, description: '' },
      { id: 'route-a', name: 'Route A', durationMinutes: 13, description: '' },
    ]
    const tiedContexts: RouteContext[] = tiedRoutes.map((route) => ({ routeId: route.id, factors: { lighting: 1 } }))
    const tiedFactors = [factors[0]]
    const preset = { id: 'tie', label: 'Tie', description: '', maxExtraMinutes: 2 }
    const result = evaluateRoutes({ routes: tiedRoutes, contexts: tiedContexts, factors: tiedFactors, preset })
    expect(result.recommendedRouteId).toBe('route-z')

    const sameDurationRoutes = tiedRoutes.map((route) => ({ ...route, durationMinutes: 12 }))
    const sameDurationContexts: RouteContext[] = sameDurationRoutes.map((route) => ({ routeId: route.id, factors: { lighting: 1 } }))
    const lexicalResult = evaluateRoutes({ routes: sameDurationRoutes, contexts: sameDurationContexts, factors: tiedFactors, preset })
    expect(lexicalResult.recommendedRouteId).toBe('route-a')
    expect(evaluateRoutes({ routes: sameDurationRoutes, contexts: sameDurationContexts, factors: tiedFactors, preset })).toEqual(lexicalResult)
  })
})
