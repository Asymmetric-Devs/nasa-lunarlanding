import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store'
import { useT, scName } from '../i18n'
import { cssv } from '../lib/theme'
import { Info } from './Info'
import { buildSeries, analyze, type Analysis } from '../engine/analysis'
import { slideWindows, bestWindows, type WindowGrid } from '../engine/planner'
import { terrainFor, horizonFor } from '../lib/terrainStore'
import { siteKey } from '../hooks/useAnalysis'
import { fmtDate, fmtDur, fmtShort, months } from '../lib/format'

type Metric = 'verdict' | 'sun' | 'link' | 'dark'
const DAY = 86400000

const mix = (a: number[], b: number[], k: number) => `rgb(${Math.round(a[0] + (b[0] - a[0]) * k)},${Math.round(a[1] + (b[1] - a[1]) * k)},${Math.round(a[2] + (b[2] - a[2]) * k)})`
function colorFor(metric: Metric, g: WindowGrid, k: number, light: boolean): string {
  const lo = light ? [232, 224, 209] : [40, 34, 36]
  if (metric === 'verdict') {
    const sc = g.score[k]
    if (sc >= 1) return mix([60, 150, 100], [50, 220, 140], Math.min(1, (sc - 1) / 0.5))
    return mix(lo, [226, 150, 52], Math.max(0, sc) ** 1.3)
  }
  if (metric === 'sun') return mix(lo, [255, 176, 60], g.sun[k] / 100)
  if (metric === 'link') return mix(lo, [60, 160, 255], g.link[k] / 100)
  return mix(lo, [60, 190, 130], 1 - Math.min(1, g.dark[k] / 360))
}

export function Planner() {
  const { scenarios, cfg, req, updateScenario, setView, setActive, setAllDates, theme } = useStore()
  const t = useT()
  const [dur, setDur] = useState(14), [metric, setMetric] = useState<Metric>('verdict')
  const [startMs, setStart] = useState(() => Date.UTC(2027, 0, 1)), [rangeDays, setRange] = useState(365)
  const [grids, setGrids] = useState<{ id: string; name: string; g: WindowGrid; an: Analysis }[] | null>(null)
  const [busy, setBusy] = useState(true)
  const key = scenarios.map((s) => `${s.id}${s.siteId}${s.lat}${s.lon}`).join('|')
  // heavy part: hourly analysis over range + max mission length
  const analyses = useRef<Map<string, Analysis>>(new Map())
  useEffect(() => {
    let dead = false; setBusy(true)
    const t = setTimeout(async () => {
      const out: { id: string; name: string; g: WindowGrid; an: Analysis }[] = []
      const nH = (rangeDays + 31) * 24
      for (const s of scenarios) {
        const k = `${siteKey(s)}|${startMs}|${rangeDays}|${cfg.mastM}|${cfg.minEarthEl}|${cfg.panel}`
        let an = analyses.current.get(k)
        if (!an) { const terr = await terrainFor(s.siteId); const hor = horizonFor(terr, siteKey(s), s.lat, s.lon, cfg.mastM); an = analyze(buildSeries(startMs, 3600e3, nH), s.lat, s.lon, hor, cfg); analyses.current.set(k, an); if (analyses.current.size > 12) analyses.current.delete(analyses.current.keys().next().value!) }
        if (dead) return
        out.push({ id: s.id, name: s.name, g: undefined as any, an })
      }
      if (!dead) { setGrids(out); setBusy(false) }
    }, 20)
    return () => { dead = true; clearTimeout(t) }
  }, [key, startMs, rangeDays, cfg.mastM, cfg.minEarthEl, cfg.panel])

  const rows = useMemo(() => (grids ? grids.map((r) => ({ ...r, g: slideWindows(r.an, dur * 24, 24, req, rangeDays) })) : null), [grids, dur, req, rangeDays])
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(1000)
  const [hov, setHov] = useState<{ r: number; k: number } | null>(null)
  useEffect(() => { const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width))); wrap.current && ro.observe(wrap.current); return () => ro.disconnect() }, [])
  const rowH = 44, padL = w < 520 ? 96 : 150, padT = 26, H = padT + (rows?.length ?? 1) * rowH + 8

  useEffect(() => {
    if (!rows || !cv.current) return
    const dpr = window.devicePixelRatio || 1, c = cv.current; c.width = w * dpr; c.height = H * dpr
    const g = c.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, H)
    const cols = rows[0].g.startMs.length, cw = (w - padL - 8) / cols
    g.font = '10.5px "Geist Mono Variable", monospace'; g.textBaseline = 'middle'
    // month ticks
    let lastLbl = -99
    for (let k = 0; k < cols; k++) { const d = new Date(rows[0].g.startMs[k]); if (d.getUTCDate() === 1) { const x = padL + k * cw; g.fillStyle = cssv('--dim'); g.textAlign = 'left'; if (x - lastLbl > 30) { g.fillText(`${months()[d.getUTCMonth()]}${d.getUTCMonth() === 0 && w >= 520 ? ' ' + d.getUTCFullYear() : ''}`, x + 3, 10); lastLbl = x } g.strokeStyle = cssv('--grid'); g.beginPath(); g.moveTo(x, 18); g.lineTo(x, H - 4); g.stroke() } }
    rows.forEach((r, ri) => {
      const y = padT + ri * rowH
      g.fillStyle = cssv('--text'); g.textAlign = 'left'; g.font = '600 12px "Geist Variable", sans-serif'; const nm = scName(scenarios[ri], t); g.fillText(nm.length > (w < 520 ? 13 : 20) ? nm.slice(0, w < 520 ? 12 : 19) + '…' : nm, 8, y + rowH / 2 - 1); g.font = '10.5px "Geist Mono Variable", monospace'
      for (let k = 0; k < cols; k++) { g.fillStyle = colorFor(metric, r.g, k, theme === 'light'); g.fillRect(padL + k * cw, y + 4, Math.ceil(cw) + 0.5, rowH - 10) }
      const sc = scenarios[ri]; const kk = Math.round((sc.t - startMs) / DAY)  // current landing date marker
      if (kk >= 0 && kk < cols) { const x = padL + kk * cw + cw / 2; g.strokeStyle = cssv('--text'); g.lineWidth = 2; g.beginPath(); g.moveTo(x, y + 1); g.lineTo(x, y + rowH - 3); g.stroke(); g.lineWidth = 1 }
      if (metric === 'verdict') for (const b of bestWindows(r.g, 3, dur * DAY)) { if (r.g.score[b] < 1) continue; const x = padL + b * cw + cw / 2; g.fillStyle = cssv('--text'); g.strokeStyle = cssv('--bg'); g.lineWidth = 1; g.beginPath(); g.arc(x, y + rowH / 2 - 1, 3, 0, 7); g.fill(); g.stroke() }
    })
    if (hov) { const x = padL + hov.k * cw; g.strokeStyle = cssv('--text'); g.strokeRect(x - 0.5, padT + hov.r * rowH + 3.5, Math.max(2, cw), rowH - 9) }
  void theme
  })
  const cell = (e: React.MouseEvent) => { if (!rows) return null; const r0 = cv.current!.getBoundingClientRect(), cols = rows[0].g.startMs.length, cw = (w - padL - 8) / cols
    const k = Math.floor((e.clientX - r0.left - padL) / cw), r = Math.floor((e.clientY - r0.top - padT) / rowH); return k >= 0 && k < cols && r >= 0 && r < rows.length ? { r, k } : null }
  const tip = hov && rows ? { row: rows[hov.r], k: hov.k } : null

  return (
    <div className="page planner">
      <div className="page-head">
        <p className="eyebrow">{t('nav.planner')}</p><h1>{t('pl.title')}</h1><p className="lede">{t('pl.lede', { d: dur })}</p>
      </div>
      <div className="pl-ctl">
        <label className="field inline"><span>{t('pl.len')} <b className="mono">{dur} d</b></span><input type="range" min={3} max={30} step={1} value={dur} onChange={(e) => setDur(+e.target.value)} /></label>
        <div className="seg">{([['verdict', t('pl.m.verdict')], ['sun', t('pl.m.sun')], ['link', t('pl.m.link')], ['dark', t('pl.m.dark')]] as [Metric, string][]).map(([k, l]) => <button key={k} className={metric === k ? 'on' : ''} onClick={() => setMetric(k)}>{l}</button>)}</div>
        <div className="seg">{[[365, t('pl.r12')], [182, t('pl.r6')], [90, t('pl.r3')]].map(([d, l]) => <button key={d} className={rangeDays === d ? 'on' : ''} onClick={() => setRange(d as number)}>{l}</button>)}</div>
        <label className="field inline"><span>{t('pl.from')}</span><input type="date" className="mono datein" value={fmtDate(startMs)} onChange={(e) => { const t = Date.parse(e.target.value + 'T00:00:00Z'); if (!Number.isNaN(t)) setStart(t) }} /></label>
        <span className="grow" />
        <span className="hint">{t('pl.hint')}</span>
      </div>
      <div className="pl-chart" ref={wrap}>
        {busy && <div className="pl-busy mono">{t('pl.busy', { n: scenarios.length, d: rangeDays + 30 })}</div>}
        <canvas ref={cv} style={{ width: w, height: H, cursor: 'pointer', opacity: busy ? 0.35 : 1 }}
          onMouseMove={(e) => setHov(cell(e))} onMouseLeave={() => setHov(null)}
          onClick={(e) => { const c = cell(e); if (c && rows) { const s = scenarios[c.r]; updateScenario(s.id, { t: rows[c.r].g.startMs[c.k] }); setActive(s.id); setView('navigator') } }} />
        {tip && (
          <div className="pl-tip mono" style={{ left: Math.min(w - 230, 150 + (hov!.k / tip.row.g.startMs.length) * (w - 160)), top: 30 + hov!.r * rowH + rowH }}>
            <b>{scName(scenarios[hov!.r], t)}</b> · {t('pl.start')} {fmtDate(tip.row.g.startMs[tip.k])}<br />
            {t('pl.tip.a', { s: tip.row.g.sun[tip.k].toFixed(0), l: tip.row.g.link[tip.k].toFixed(0) })}<br />
            {t('pl.tip.b', { d: fmtDur(tip.row.g.dark[tip.k]), o: fmtDur(tip.row.g.outage[tip.k]) })}<br />
            <span style={{ color: tip.row.g.score[tip.k] >= 1 ? 'var(--go)' : 'var(--no)' }}>{tip.row.g.score[tip.k] >= 1 ? t('pl.meets') : t('pl.misses')}</span> · {t('pl.click')}
          </div>)}
      </div>
      <div className="pl-legend mono">
        {metric === 'verdict' ? <><i style={{ background: 'rgb(220,160,60)' }} />{t('pl.lg.miss')}<i style={{ background: 'rgb(60,150,100)' }} />{t('pl.lg.meet')}<i style={{ background: 'rgb(50,220,140)' }} />{t('pl.lg.margin')} · {t('pl.lg.dot')}</> : t('pl.lg.bright')}
      </div>
      {rows && (
        <div className="pl-best">
          <h3>{t('pl.best', { d: dur })}</h3>
          <div className="pl-best-grid">
            {rows.map((r) => { const b = bestWindows(r.g, 3, dur * DAY); return (
              <div key={r.id} className="card">
                <h4>{scName(scenarios.find((x) => x.id === r.id)!, t)}</h4>
                {b.map((k) => <button key={k} className="bw" onClick={() => { updateScenario(r.id, { t: r.g.startMs[k] }); setActive(r.id); setView('navigator') }}>
                  <span className="mono">{fmtShort(r.g.startMs[k])} → {fmtShort(r.g.startMs[k] + dur * DAY)}</span>
                  <span className={`pill ${r.g.score[k] >= 1 ? 'go' : r.g.score[k] >= 0.6 ? 'marginal' : 'no'}`}>{r.g.score[k] >= 1 ? t('pl.p.meets') : r.g.score[k] >= 0.6 ? t('pl.p.near') : t('pl.p.misses')}</span>
                  <span className="mono dim">{t('pl.row', { s: r.g.sun[k].toFixed(0), l: r.g.link[k].toFixed(0), d: fmtDur(r.g.dark[k]) })}</span></button>)}
                {!b.length && <p className="dim">{t('pl.none')}</p>}
              </div>) })}
          </div>
          <button className="btn ghost sync" onClick={() => setAllDates(scenarios[0].t)}>{t('pl.sync')}</button>
        </div>)}
    </div>
  )
}
