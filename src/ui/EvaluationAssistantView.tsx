import { useEffect, useMemo, useState } from 'react'
import type { FactorDefinition, Route, RouteContext } from '../sdk'
import { evaluateConfirmedPolicy, explainEvaluation, proposePolicy, summarizeEvidence, type HardExclusions, type ObservationMetadataByRoute } from './routeEvaluationAssistant'
import './routeEvaluationAssistant.css'

const EMPTY_OBSERVATION_METADATA: ObservationMetadataByRoute = {}
const EMPTY_HARD_EXCLUSIONS: HardExclusions = {}

export interface RouteEvaluationAssistantProps {
  routes: Route[]
  contexts: RouteContext[]
  factors: FactorDefinition[]
  observationMetadata?: ObservationMetadataByRoute
  hardExclusions?: HardExclusions
}

export function RouteEvaluationAssistant({ routes, contexts, factors, observationMetadata = EMPTY_OBSERVATION_METADATA, hardExclusions = EMPTY_HARD_EXCLUSIONS }: RouteEvaluationAssistantProps) {
  const initialPriority = factors.find((factor) => factor.id === 'lighting')?.id ?? factors[0]?.id ?? ''
  const [priorityFactorId, setPriorityFactorId] = useState(initialPriority)
  const [maxExtraMinutesText, setMaxExtraMinutesText] = useState('5')
  const [proposal, setProposal] = useState<ReturnType<typeof proposePolicy> | null>(null)
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<ReturnType<typeof evaluateConfirmedPolicy>>(null)
  const maxExtraMinutes = maxExtraMinutesText.trim() ? Number(maxExtraMinutesText) : Number.NaN
  const validDetourLimit = Number.isFinite(maxExtraMinutes) && maxExtraMinutes >= 0
  const evidence = useMemo(() => validDetourLimit ? summarizeEvidence(routes, contexts, factors, maxExtraMinutes, observationMetadata, hardExclusions) : [], [routes, contexts, factors, maxExtraMinutes, validDetourLimit, observationMetadata, hardExclusions])
  const narrative = result ? explainEvaluation(result, routes, hardExclusions) : null

  useEffect(() => {
    setProposal(null)
    setResult(null)
    setMessage('')
  }, [routes, contexts, factors, observationMetadata, hardExclusions])

  function clearProposal() {
    setProposal(null)
    setResult(null)
    setMessage('')
  }

  function handlePropose() {
    try {
      setProposal(proposePolicy(factors, priorityFactorId, maxExtraMinutes))
      setResult(null)
      setMessage('')
    } catch (error) {
      setProposal(null)
      setResult(null)
      setMessage(error instanceof Error ? error.message : 'The policy could not be proposed.')
    }
  }

  function handleConfirm() {
    if (!proposal) return
    try {
      const evaluation = evaluateConfirmedPolicy({ routes, contexts, factors }, proposal, true, hardExclusions)
      setResult(evaluation)
      setMessage('')
    } catch (error) {
      setResult(null)
      setMessage(error instanceof Error ? error.message : 'The confirmed policy could not be evaluated.')
    }
  }

  return (
    <section className="evaluation-assistant" aria-labelledby="evaluation-assistant-title">
      <div className="evaluation-assistant__heading">
        <div>
          <div className="evaluation-assistant__eyebrow">TRANSPARENT WORKFLOW</div>
          <h2 id="evaluation-assistant-title">Route Evaluation Assistant</h2>
        </div>
        <span className="evaluation-assistant__tag">Structured policy · no natural-language parsing</span>
      </div>

      <p className="evaluation-assistant__intro">Choose one evidence priority and a hard detour limit. Review the proposed weights and assumptions before confirming an evaluation.</p>

      <div className="evaluation-assistant__controls">
        <label>
          <span>Soft preference</span>
          <select value={priorityFactorId} onChange={(event) => { setPriorityFactorId(event.target.value); clearProposal() }}>
            {factors.map((factor) => (
              <option key={factor.id} value={factor.id}>
                {factor.direction === 'higher' ? 'More' : 'Fewer'} {factor.label.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Maximum extra time <small>(hard limit, minutes)</small></span>
          <input type="number" min="0" step="1" value={maxExtraMinutesText} onChange={(event) => { setMaxExtraMinutesText(event.target.value); clearProposal() }} />
        </label>
        <button type="button" className="evaluation-assistant__button" onClick={handlePropose} disabled={!priorityFactorId || !validDetourLimit}>
          Propose policy
        </button>
      </div>

      {!validDetourLimit && <p className="evaluation-assistant__error" role="alert">Enter a finite, non-negative maximum extra time.</p>}
      {message && <p className="evaluation-assistant__error" role="alert">{message}</p>}

      <details className="evaluation-assistant__evidence">
        <summary>Evidence in this synthetic scenario</summary>
        <p className="evaluation-assistant__freshness">No sources or timestamps are inferred. Supplied freshness is shown per observation; missing values remain unknown.</p>
        <div className="evaluation-assistant__routes">
          {evidence.map((route) => (
            <article className="evaluation-assistant__route" key={route.routeId}>
              <h4>{route.routeName} <span>{route.durationMinutes} min · +{route.extraMinutes} min</span></h4>
              <p><strong>Available:</strong> {route.available.length ? route.available.map((item) => `${item.label} ${item.value}${item.freshness === 'unknown' ? ' · freshness unknown' : ''}`).join(' · ') : 'none'}</p>
              <p><strong>Stale:</strong> {route.stale.length ? route.stale.map((item) => `${item.label} ${item.value}`).join(' · ') : 'none'}</p>
              <p><strong>Missing:</strong> {route.missing.length ? route.missing.join(', ') : 'none'}</p>
              <p><strong>Explicit constraint:</strong> {route.hardConstraintReason ?? 'none'}</p>
              <p><strong>Hard constraint:</strong> {route.violatesDetourLimit ? `exceeds the current ${maxExtraMinutes}-minute limit` : `within the current ${maxExtraMinutes}-minute limit`}</p>
            </article>
          ))}
        </div>
      </details>

      {proposal && (
        <section className="evaluation-assistant__proposal" aria-labelledby="evaluation-policy-title">
          <h3 id="evaluation-policy-title">Proposed policy</h3>
          <p><strong>Soft preference:</strong> {proposal.priorityLabel}; the selected factor receives the strongest weight.</p>
          <p><strong>Hard constraint:</strong> routes more than {proposal.preset.maxExtraMinutes} extra minutes over the fastest route are ineligible before scoring.</p>
          <ul>
            {factors.map((factor) => <li key={factor.id}>{factor.label}: {(proposal.preset.weightOverrides?.[factor.id] ?? factor.weight).toFixed(2)} weight</li>)}
          </ul>
          <p>Unobserved factors remain unknown, not zero. {Object.keys(hardExclusions).length ? 'Existing hard exclusions are preserved before scoring.' : 'Only the maximum extra time is a hard constraint in this scenario; no other hard constraints were supplied.'}</p>
          <button type="button" className="evaluation-assistant__button" onClick={handleConfirm}>Confirm policy and evaluate</button>
        </section>
      )}

      {result && narrative && (
        <section className="evaluation-assistant__result" aria-labelledby="evaluation-result-title" aria-live="polite">
          <h3 id="evaluation-result-title">Evaluation result · {result.status.replace('_', ' ')}</h3>
          <p className="evaluation-assistant__recommendation">{narrative.recommendedRouteName ? `Recommended: ${narrative.recommendedRouteName}` : 'No route recommended'}</p>
          <p>{narrative.explanation}</p>
          {narrative.influentialFactors.length > 0 && <>
            <h4>Factors influencing the recommendation</h4>
            <ul>{narrative.influentialFactors.map((factor) => <li key={factor.label}>{factor.label}: {factor.points.toFixed(1)} preference points</li>)}</ul>
          </>}
          {narrative.excludedRoutes.length > 0 && <>
            <h4>Ineligible routes</h4>
            <ul>{narrative.excludedRoutes.map((route) => <li key={route.routeName}>{route.routeName}: {route.reason}</li>)}</ul>
          </>}
          {narrative.unknownFactors.length > 0 && <>
            <h4>Important unknowns</h4>
            <ul>{narrative.unknownFactors.map((route) => <li key={route.routeName}>{route.routeName}: {route.factorLabels.join(', ')}</li>)}</ul>
          </>}
          {narrative.warnings.map((warning) => <p className="evaluation-assistant__warning" key={warning}>{warning}</p>)}
        </section>
      )}
    </section>
  )
}