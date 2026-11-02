import { describe, expect, it } from 'vitest'
import { evaluateRoutes } from '../sdk'
import { createScenarioEvaluation } from './scenarios'

describe('synthetic scenario configuration', () => {
  it('prioritizes Route B lighting within the configured detour and reevaluates when it changes', () => {
    const defaultInput = createScenarioEvaluation('better-lighting')
    const defaultResult = evaluateRoutes(defaultInput.input)
    expect(defaultResult.recommendedRouteId).toBe('route-b')
    expect(defaultResult.routes.find((route) => route.routeId === 'route-c')?.eligible).toBe(false)

    const strictInput = createScenarioEvaluation('better-lighting', { maxExtraMinutes: 0 })
    const strictResult = evaluateRoutes(strictInput.input)
    expect(strictResult.recommendedRouteId).toBe('route-a')
    expect(strictResult.routes.find((route) => route.routeId === 'route-b')).toMatchObject({
      eligible: false,
      score: null,
    })
  })

  it('excludes a closed candidate before evaluation regardless of its preference score', () => {
    const closed = createScenarioEvaluation('road-closure')
    expect(closed.closedRouteIds).toEqual(['route-b'])
    expect(closed.input.routes.map((route) => route.id)).not.toContain('route-b')
    expect(evaluateRoutes(closed.input).recommendedRouteId).toBe('route-c')

    const open = createScenarioEvaluation('road-closure', { routeBClosed: false })
    expect(open.closedRouteIds).toEqual([])
    expect(evaluateRoutes(open.input).recommendedRouteId).toBe('route-b')
  })

  it('keeps stale and missing observations unknown, and reevaluates when stale data becomes current', () => {
    const stale = createScenarioEvaluation('incomplete-data')
    const staleResult = evaluateRoutes(stale.input)
    const staleRouteB = staleResult.routes.find((route) => route.routeId === 'route-b')!
    expect(stale.input.contexts.find((context) => context.routeId === 'route-b')?.factors.lighting).toBeNull()
    expect(staleRouteB.factorResults.find((factor) => factor.factorId === 'lighting')).toMatchObject({
      status: 'unknown',
      value: null,
    })
    expect(stale.observations['route-b'].lighting).toMatchObject({ value: 0.95, freshness: 'stale' })
    expect(stale.input.contexts.find((context) => context.routeId === 'route-c')?.factors['open-businesses']).toBeNull()
    expect(staleResult.status).toBe('provisional')
    expect(staleResult.recommendedRouteId).toBe('route-a')

    const current = createScenarioEvaluation('incomplete-data', { routeBLightingCurrent: true })
    const currentResult = evaluateRoutes(current.input)
    expect(current.input.contexts.find((context) => context.routeId === 'route-b')?.factors.lighting).toBe(0.95)
    expect(currentResult.recommendedRouteId).toBe('route-b')
    expect(currentResult.status).toBe('provisional')
  })

  it('selects the shortest route with an explicit zero-minute detour policy', () => {
    const evaluation = createScenarioEvaluation('shortest-route')
    const result = evaluateRoutes(evaluation.input)
    expect(evaluation.input.preset.maxExtraMinutes).toBe(0)
    expect(result.recommendedRouteId).toBe('route-a')
    expect(result.basis).toBe('shortest_duration')
    expect(result.explanation).toContain('No environmental superiority is implied')
  })
})
