import { useMemo, useState } from 'react'
import { evaluateRoutes, type EvaluationResult, type Route, type RouteResult } from '../sdk'
import { factors, routes } from '../sdk/example'
import './scenarioSimulator.css'
import { createScenarioEvaluation, scenarios, type ObservationFreshness, type ScenarioId, type SyntheticObservation } from './scenarios'

function formatObservation(factorId: string, observation: SyntheticObservation) {
  if (observation.freshness === 'missing' || observation.value === null) return 'Unknown · no observation'
  const value = factorId === 'lighting'
    ? `${Math.round(observation.value * 100)}%`
    : factorId === 'open-businesses'
      ? `${observation.value} expected open`
      : `${observation.value} known`
  return observation.freshness === 'stale' ? `Stale · last recorded ${value}` : value
}

function getRouteReason(
  route: Route,
  routeResult: RouteResult | undefined,
  isClosed: boolean,
  evaluation: EvaluationResult,
  winner: Route | undefined,
  winnerResult: RouteResult | undefined,
) {
  if (isClosed) return 'Hard constraint: this route is marked closed and was excluded before scoring.'
  if (!routeResult) return 'This route was not included in the evaluation.'
  if (!routeResult.eligible) return routeResult.exclusionReasons.join(' ')
  if (route.id === evaluation.recommendedRouteId) return evaluation.explanation
  if (routeResult.score === null) return routeResult.explanation
  if (winnerResult?.score !== null && winnerResult?.score !== undefined && winner) {
    if (routeResult.score < winnerResult.score) {
      return `Scored ${Math.round(routeResult.score)}; ${winner.name} scored ${Math.round(winnerResult.score)}.`
    }
    if (routeResult.score === winnerResult.score) {
      return `Equal preference score; ${winner.name} was selected by the evaluator's tie-break rules.`
    }
  }
  return winner ? `${winner.name} was selected by the evaluator.` : routeResult.explanation
}

function currentFreshness(
  freshness: ObservationFreshness,
  routeId: string,
  factorId: string,
  routeBLightingCurrent: boolean,
): ObservationFreshness {
  return routeId === 'route-b' && factorId === 'lighting' && routeBLightingCurrent ? 'current' : freshness
}

export function ScenarioSimulator() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('better-lighting')
  const [maxExtraMinutes, setMaxExtraMinutes] = useState(5)
  const [routeBClosed, setRouteBClosed] = useState(true)
  const [routeBLightingCurrent, setRouteBLightingCurrent] = useState(false)
  const scenario = scenarios.find((item) => item.id === scenarioId)!
  const scenarioEvaluation = useMemo(
    () => createScenarioEvaluation(scenarioId, { maxExtraMinutes, routeBClosed, routeBLightingCurrent }),
    [scenarioId, maxExtraMinutes, routeBClosed, routeBLightingCurrent],
  )
  const result = useMemo(() => evaluateRoutes(scenarioEvaluation.input), [scenarioEvaluation])
  const recommendation = routes.find((route) => route.id === result.recommendedRouteId)
  const winningResult = result.routes.find((route) => route.routeId === result.recommendedRouteId)

  return (
    <section className="scenario-sim" aria-label="Synthetic route scenario simulator">
      <header className="scenario-sim__header">
        <div>
          <div className="scenario-sim__eyebrow">SYNTHETIC SCENARIOS</div>
          <h2>Compare route options</h2>
          <p>Waylit evaluates existing candidate routes; it does not generate directions.</p>
        </div>
        <span className="scenario-sim__data-label">SYNTHETIC DATA</span>
      </header>
      <div className="scenario-sim__choices" role="tablist" aria-label="Choose a synthetic scenario">
        {scenarios.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={scenarioId === item.id}
            className={scenarioId === item.id ? 'scenario-sim__choice is-active' : 'scenario-sim__choice'}
            onClick={() => setScenarioId(item.id)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
      <section className="scenario-sim__what-if" aria-label="What if controls">
        <div>
          <div className="scenario-sim__eyebrow">WHAT IF?</div>
          <strong>Change one input and reevaluate</strong>
        </div>
        {scenarioId === 'better-lighting' && (
          <label className="scenario-sim__range">
            <span>Maximum additional travel time <b>{maxExtraMinutes} min</b></span>
            <input
              type="range"
              min="0"
              max="8"
              step="1"
              value={maxExtraMinutes}
              onChange={(event) => setMaxExtraMinutes(Number(event.target.value))}
              aria-label="Maximum additional travel time"
            />
          </label>
        )}
        {scenarioId === 'road-closure' && (
          <label className="scenario-sim__toggle">
            <input type="checkbox" checked={routeBClosed} onChange={(event) => setRouteBClosed(event.target.checked)} />
            <span>Route B is marked closed</span>
          </label>
        )}
        {scenarioId === 'incomplete-data' && (
          <label className="scenario-sim__toggle">
            <input type="checkbox" checked={routeBLightingCurrent} onChange={(event) => setRouteBLightingCurrent(event.target.checked)} />
            <span>Route B's lighting observation is current</span>
          </label>
        )}
        {scenarioId === 'shortest-route' && <p className="scenario-sim__fixed-policy">Duration priority keeps the maximum detour at 0 minutes.</p>}
      </section>
      <details className="scenario-sim__route-details">
        <summary>Show route-by-route scores and evidence</summary>
        <div className="scenario-sim__routes">
          {routes.map((route, index) => {
            const routeResult = result.routes.find((item) => item.routeId === route.id)
            const isClosed = scenarioEvaluation.closedRouteIds.includes(route.id)
            const isRecommended = result.recommendedRouteId === route.id
            const observations = scenarioEvaluation.observations[route.id]
            const scoreLabel = isClosed
              ? 'Not scored · closed'
              : routeResult?.score === null || routeResult?.score === undefined
                ? routeResult?.eligible ? 'Score unavailable' : 'Not scored'
                : `${Math.round(routeResult.score)} / 100`
            const reason = getRouteReason(route, routeResult, isClosed, result, recommendation, winningResult)

            return (
              <article
                className={`scenario-sim__route ${isRecommended ? 'is-recommended' : ''} ${isClosed ? 'is-closed' : ''}`}
                key={route.id}
              >
                <div className="scenario-sim__route-top">
                  <span className="scenario-sim__number">0{index + 1}</span>
                  <div className="scenario-sim__route-title">
                    <div className="scenario-sim__route-name">
                      {route.name}
                      {isRecommended && <span className="scenario-sim__best">TOP MATCH</span>}
                      <span className={`scenario-sim__eligibility ${isClosed || routeResult?.eligible === false ? 'is-excluded' : 'is-eligible'}`}>
                        {isClosed ? 'CLOSED · EXCLUDED' : routeResult?.eligible ? 'ELIGIBLE' : 'INELIGIBLE'}
                      </span>
                    </div>
                    <p>{route.description}</p>
                  </div>
                  <div className="scenario-sim__time"><strong>{route.durationMinutes}</strong><span>min</span></div>
                </div>
                <div className="scenario-sim__meta">
                  <span className="scenario-sim__score">{scoreLabel}</span>
                  {!isClosed && routeResult && <span>{routeResult.extraMinutes > 0 ? `+${routeResult.extraMinutes} min vs. fastest` : 'Fastest duration'}</span>}
                </div>
                {routeResult?.score !== null && routeResult?.score !== undefined && !isClosed && (
                  <div className="scenario-sim__meter" aria-label={`SDK preference score ${Math.round(routeResult.score)} out of 100`}>
                    <span style={{ width: `${routeResult.score}%` }} />
                  </div>
                )}
                <div className="scenario-sim__observations" aria-label={`${route.name} synthetic observations`}>
                  {factors.map((factor) => {
                    const observation = observations[factor.id]
                    const freshness = currentFreshness(observation.freshness, route.id, factor.id, routeBLightingCurrent)
                    return (
                      <span key={factor.id} className={`scenario-sim__observation is-${freshness}`}>
                        <b>{factor.label}</b> {formatObservation(factor.id, { ...observation, freshness })}
                      </span>
                    )
                  })}
                </div>
                <p className={`scenario-sim__reason ${isClosed || routeResult?.eligible === false ? 'is-exclusion' : ''}`}>{reason}</p>
              </article>
            )
          })}
        </div>
      </details>
      {recommendation ? (
        <aside className="scenario-sim__recommendation">
          <span aria-hidden="true">✳</span>
          <div>
            <strong>{recommendation.name} is the top match · {scenario.label}</strong>
            <p>{result.explanation}</p>
            {result.warnings.map((warning) => <p className="scenario-sim__warning" key={warning}>{warning}</p>)}
          </div>
        </aside>
      ) : (
        <aside className="scenario-sim__recommendation is-empty">
          <span aria-hidden="true">!</span>
          <div><strong>No route can be recommended from the available evidence.</strong><p>{result.explanation}</p></div>
        </aside>
      )}
      <p className="scenario-sim__disclaimer">Every route and observation shown is synthetic demo data. Unknown or stale observations are not treated as evidence of safety or danger.</p>
    </section>
  )
}
