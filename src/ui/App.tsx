import { useMemo, useState } from 'react'
import { evaluateRoutes } from '../sdk'
import { contexts, factors, presets, routes } from '../sdk/example'
import { RouteEvaluationAssistant } from './EvaluationAssistantView'
import { ScenarioSimulator } from './ScenarioSimulator'

export default function App() {
  const [presetId, setPresetId] = useState(presets[0].id)
  const preset = presets.find((item) => item.id === presetId)!
  const result = useMemo(() => evaluateRoutes({ routes, contexts, factors, preset }), [preset])
  const recommendation = routes.find((route) => route.id === result.recommendedRouteId)

  return (
    <main className="shell">
      <header className="topbar"><a className="brand" href="#top" aria-label="Waylit home"><span className="brand-mark">w</span> waylit</a><span className="live"><i /> Route guidance · Demo</span><button className="avatar" aria-label="Your profile">A</button></header>
      <section className="intro" id="top">
        <div className="eyebrow"><span className="sun">✳</span> YOUR WALK, YOUR WAY</div>
        <h1>A better way<br /><em>home.</em></h1>
        <p className="lede">Choose the route that feels right for you tonight.</p>
      </section>
      <section className="journey" aria-label="Trip details">
        <div className="place"><span className="pin origin">○</span><div><small>FROM</small><strong>Market Street</strong></div></div>
        <span className="journey-line" />
        <div className="place"><span className="pin destination">⌖</span><div><small>TO</small><strong>Home</strong></div></div>
        <span className="trip-length">1.2 mi</span>
      </section>
      <section className="results">
        <div className="section-heading"><div><div className="eyebrow muted">YOUR ROUTES</div><h2>Find your way</h2></div><span className="route-count">03 OPTIONS</span></div>
        <div className="preset-tabs" role="tablist" aria-label="Route preference">
          {presets.map((item) => <button key={item.id} role="tab" aria-selected={presetId === item.id} className={presetId === item.id ? 'preset active' : 'preset'} onClick={() => setPresetId(item.id)}>{item.id === 'better-lighting' ? '☼' : '↗'} {item.label}</button>)}
        </div>
        <div className="route-list">
          {routes.map((route, index) => {
            const score = result.routes.find((item) => item.routeId === route.id)!
            const isRecommended = result.recommendedRouteId === route.id
            return <article className={`route-card ${isRecommended ? 'recommended' : ''}`} key={route.id}>
              <div className="route-top"><div className="route-number">0{index + 1}</div><div className="route-title"><div className="route-name">{route.name}{isRecommended && <span className="best-badge">BEST MATCH</span>}</div><p>{route.description}</p></div><div className="route-time"><strong>{route.durationMinutes}</strong><span>min</span></div></div>
              <div className="route-meta"><span>✦ {score.score === null ? 'Not enough data' : `${Math.round(score.score)} match`}</span><span>{score.eligible ? `+${score.extraMinutes} min vs. fastest` : `Outside ${preset.maxExtraMinutes} min detour limit`}</span></div>
              <div className="meter"><span style={{ width: `${score.score ?? 0}%` }} /></div>
              <div className="factor-row">{score.factorResults.filter((factor) => factor.status === 'observed').map((factor) => <span key={factor.factorId} className="factor-chip"><b>{factor.label}</b> {factor.factorId === 'lighting' ? `${Math.round(factor.value! * 100)}%` : factor.value}</span>)}{score.factorResults.filter((factor) => factor.status === 'unknown').map((factor) => <span key={factor.factorId} className="factor-chip unknown">? {factor.label} unknown</span>)}</div>
            </article>
          })}
        </div>
        {recommendation && <aside className="recommendation"><span className="rec-icon">✳</span><div><strong>Made for your {preset.label.toLowerCase()} preference</strong><p>{result.explanation}</p></div></aside>}
        <p className="disclaimer">Route details are sample data. Unknown information stays unknown and is shown as such.</p>
      </section>
      <RouteEvaluationAssistant routes={routes} contexts={contexts} factors={factors} />
      <ScenarioSimulator />
      <footer><a className="brand footer-brand" href="#top"><span className="brand-mark">w</span> waylit</a><span>Go the way that feels right.</span><span>MADE FOR THE WAY HOME&nbsp; ✳</span></footer>
    </main>
  )
}
