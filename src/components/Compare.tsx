import { useEffect, useMemo, useState } from 'react'
import { useStore, makeScenario, type Scenario } from '../store'
import { useResults } from '../hooks/useResults'
import { computeResult, sampleNow, type Result } from '../hooks/useAnalysis'
import { Panorama } from './Panorama'
import { Timeline } from './Timeline'
import { DateControl } from './Controls'
import { grade, GRADE_KEY } from './Verdict'
import { fmtDur, fmtLat, fmtLon } from '../lib/format'
import { MOON_RADIUS_KM, R2D } from '../engine/ephemeris'
import { useT, scName, type Key } from '../i18n'
import { Info } from './Info'

type Row = { label: Key; get: (r: Result) => number; fmt: (v: number) => string; best: 'max' | 'min'; tip?: Key }
const ROWS: Row[] = [
  { label: 'cmp.sunlit', get: (r) => r.analysis.metrics.sunlitPct, fmt: (v) => `${v.toFixed(0)}%`, best: 'max' },
  { label: 'cmp.power', get: (r) => r.analysis.metrics.meanPowerPct, fmt: (v) => `${v.toFixed(0)}%`, best: 'max', tip: 'cmp.power.tip' },
  { label: 'cmp.peak', get: (r) => r.analysis.metrics.peakSunEl, fmt: (v) => `${v.toFixed(1)}°`, best: 'max' },
  { label: 'cmp.dark', get: (r) => r.analysis.metrics.longestDarkH, fmt: (v) => fmtDur(v), best: 'min' },
  { label: 'cmp.periods', get: (r) => r.analysis.metrics.darkPeriods, fmt: (v) => `${v}`, best: 'min' },
  { label: 'cmp.link', get: (r) => r.analysis.metrics.linkPct, fmt: (v) => `${v.toFixed(0)}%`, best: 'max' },
  { label: 'cmp.outage', get: (r) => r.analysis.metrics.longestOutageH, fmt: (v) => fmtDur(v), best: 'min' },
  { label: 'cmp.both', get: (r) => r.analysis.metrics.bothPct, fmt: (v) => `${v.toFixed(0)}%`, best: 'max', tip: 'cmp.both.tip' },
]

function Sensitivity({ sc }: { sc: Scenario }) {
  const { cfg, spanDays } = useStore(); const t = useT()
  const [step, setStep] = useState(100)
  const [cells, setCells] = useState<{ dn: number; de: number; sun: number; dark: number }[] | null>(null)
  useEffect(() => {
    let dead = false; setCells(null)
    const id = setTimeout(async () => {
      const out = []
      for (const dn of [1, 0, -1]) for (const de of [-1, 0, 1]) {
        const lat = sc.lat + ((dn * step) / 1000 / MOON_RADIUS_KM) * R2D, lon = sc.lon + ((de * step) / 1000 / (MOON_RADIUS_KM * Math.cos((sc.lat * Math.PI) / 180))) * R2D
        const r = await computeResult({ ...sc, lat, lon }, spanDays, cfg)
        out.push({ dn, de, sun: r.analysis.metrics.sunlitPct, dark: r.analysis.metrics.longestDarkH })
      }
      if (!dead) setCells(out)
    }, 30)
    return () => { dead = true; clearTimeout(id) }
  }, [sc.lat, sc.lon, sc.t, step, spanDays, cfg.mastM, cfg.minEarthEl, cfg.panel])
  const range = cells ? [Math.min(...cells.map((c) => c.sun)), Math.max(...cells.map((c) => c.sun))] : null
  return (
    <section className="sens card">
      <div className="sens-head"><div><p className="eyebrow">{t('sens.eyebrow')}</p><h3>{t('sens.title')}</h3><p className="dim">{t('sens.sub', { n: scName(sc, t) })}</p></div>
        <label className="field inline"><span>{t('sens.offset')} <b className="mono">{step} m</b></span><input type="range" min={25} max={500} step={25} value={step} onChange={(e) => setStep(+e.target.value)} /></label></div>
      <div className="sens-body">
        <div className="sens-grid">{cells ? cells.map((c, i) => (
          <div key={i} className={`sens-cell ${c.dn === 0 && c.de === 0 ? 'ctr' : ''}`} style={{ background: `color-mix(in srgb, var(--sun) ${Math.round(8 + c.sun * 0.72)}%, var(--s2))` }} title={`${c.dn * step} m N, ${c.de * step} m E`}>
            <b className="mono">{c.sun.toFixed(0)}%</b><small className="mono">{t('sens.dark')} {fmtDur(c.dark)}</small></div>)) : <div className="loading mono" style={{ gridColumn: '1/-1' }}>{t('sens.loading')}</div>}
          <span className="cn">N</span><span className="ce">E</span></div>
        {range && <p className="sens-msg">{t('sens.msg', { s: step, a: range[0].toFixed(0), b: range[1].toFixed(0) })} {range[1] - range[0] > 15 ? t('sens.risk') : t('sens.ok')}</p>}
      </div>
    </section>
  )
}

export function Compare() {
  const { scenarios, cfg, req, removeScenario, setActive, setView, updateScenario, activeId, addCompare, setTab } = useStore()
  const t = useT()
  const { res, busy } = useResults(scenarios, 29.53, cfg)
  const ready = res.every(Boolean) && res.length === scenarios.length
  const best = useMemo(() => ROWS.map((row) => { if (!ready) return -1; const v = res.map((r) => row.get(r!)); const tt = row.best === 'max' ? Math.max(...v) : Math.min(...v); return v.every((x) => x === tt) ? -1 : v.indexOf(tt) }), [res, ready])
  const active = scenarios.find((s) => s.id === activeId) ?? scenarios[0]
  return (
    <div className="page compare">
      <div className="page-head"><p className="eyebrow">{t('nav.compare')}</p><h1>{t('cmp.title')}</h1><p className="lede">{t('cmp.lede')}</p></div>
      {scenarios.length === 1 && <div className="empty"><b>{t('cmp.empty.h')}</b> {t('cmp.empty.p')}<button className="btn ghost" onClick={() => setView('navigator')}>{t('cmp.empty.go')}</button></div>}
      <div className="cmp-grid" style={{ gridTemplateColumns: `repeat(${scenarios.length}, minmax(260px, 1fr))` }}>
        {scenarios.map((sc, i) => { const r = res[i]; const g = r ? grade(r.analysis.metrics, req) : null; return (
          <article key={sc.id} className={`card cmp ${sc.id === activeId ? 'act' : ''}`}>
            <header>
              <div><h4>{scName(sc, t)}</h4><span className="mono dim">{fmtLat(sc.lat)} {fmtLon(sc.lon)}</span></div>
              <div className="cmp-actions">
                {g && <span className={`pill ${g.overall}`}>{t(GRADE_KEY[g.overall])}</span>}
                <button className="xbtn" onClick={() => { setActive(sc.id); setTab('horizon'); setView('navigator') }} title={t('cmp.open')} aria-label={t('cmp.open')}>↗</button>
                {scenarios.length > 1 && <button className="xbtn" onClick={() => removeScenario(sc.id)} aria-label={t('cmp.remove')} title={t('cmp.remove')}>×</button>}
              </div>
            </header>
            <DateControl sc={sc} compact onChange={(tt) => updateScenario(sc.id, { t: tt })} />
            <div className="mini-pano frame">{r ? <Panorama res={r} cfg={cfg} now={sampleNow(r, sc.t, cfg)} trueScale={false} /> : <div className="loading mono">…</div>}</div>
            <div className="mini-tl">{r && <Timeline res={r} cursorH={0} compact showAxis={false} />}</div>
          </article>) })}
      </div>
      {ready && (
        <div className="table-wrap"><table className="cmp-table">
          <thead><tr><th />{scenarios.map((s) => <th key={s.id}>{scName(s, t)}</th>)}</tr></thead>
          <tbody>{ROWS.map((row, ri) => (
            <tr key={row.label}><th>{t(row.label)}{row.tip && <Info text={t(row.tip)} />}</th>{res.map((r, i) => <td key={i} className={`mono ${best[ri] === i ? 'best' : ''}`}>{row.fmt(row.get(r!))}</td>)}</tr>))}
          </tbody>
        </table></div>)}
      {busy && <p className="dim mono">{t('computing')}</p>}
      <Sensitivity sc={active} />
      <div className="tip-row">
        <p className="dim">{t('cmp.tip', { n: 4 - scenarios.length })}</p>
        <button className="btn ghost" disabled={scenarios.length >= 4} onClick={() => addCompare({ ...makeScenario(active.siteId ?? 'conn-ridge', active.t + 29.53 * 86400000), name: active.name, lat: active.lat, lon: active.lon, siteId: active.siteId })}>{t('cmp.dup')}</button>
      </div>
    </div>
  )
}
