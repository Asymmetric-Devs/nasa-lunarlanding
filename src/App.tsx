import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useStore, SITES, type Tab, type View } from './store'
import { useAnalysis, sampleNow } from './hooks/useAnalysis'
import { SiteRail } from './components/SiteRail'
import { Panorama } from './components/Panorama'
import { Timeline } from './components/Timeline'
import { Verdict } from './components/Verdict'
import { Readouts } from './components/Readouts'
import { DateControl, SpanControl } from './components/Controls'
import { Settings } from './components/Settings'
import { Header } from './components/Header'
import { Guide } from './components/Guide'
import { fmtDateTime, fmtLat, fmtLon } from './lib/format'
import { loadTerrain } from './lib/terrainStore'
import { useT, scName } from './i18n'
import Intro from './components/Intro'
import { TerrainMap } from './components/TerrainMap'
import { Compare } from './components/Compare'
import { Planner } from './components/Planner'
const SurfaceView = lazy(() => import('./components/SurfaceView').then((m) => ({ default: m.SurfaceView })))

function Navigator() {
  const { scenarios, activeId, spanDays, cfg, req, cursorH, setCursor, updateScenario, tab, setTab, playing, setPlaying, lang, tourSeen, setGuide } = useStore()
  const t = useT()
  const sc = scenarios.find((s) => s.id === activeId)!
  const { res, busy } = useAnalysis(sc, spanDays, cfg)
  const [trueScale, setTrue] = useState(false)
  const tc = sc.t + cursorH * 3.6e6
  const now = useMemo(() => (res ? sampleNow(res, tc, cfg) : null), [res, tc, cfg])
  const site = sc.siteId ? SITES.find((s) => s.id === sc.siteId) : null
  const [hint, setHint] = useState(!tourSeen)

  useEffect(() => { // playback: the whole window in ~24 s
    if (!playing || !res) return
    const spanH = spanDays * 24, rate = spanH / 24
    let raf = 0, last = performance.now()
    const tick = (n: number) => { const dt = (n - last) / 1000; last = n; const s = useStore.getState(); const next = s.cursorH + dt * rate; s.setCursor(next >= spanH ? 0 : next); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf)
  }, [playing, res, spanDays])

  return (
    <div className="nav-grid">
      <SiteRail />
      <main className="stage">
        {hint && (
          <div className="hintbar" role="status">
            <span><b>{t('hint.new')}</b> {t('hint.body')}</span>
            <span className="grow" />
            <button className="step" onClick={() => setGuide(true)}>{t('hint.guide')}</button>
            <button className="xbtn" aria-label={t('hint.dismiss')} onClick={() => { setHint(false); useStore.setState({ tourSeen: true }); try { localStorage.setItem('sunline.tour', '1') } catch { /* */ } }}>×</button>
          </div>
        )}
        <div className="stage-head">
          <div className="title">
            <h1>{scName(sc, t)}</h1>
            <p className="mono">{fmtLat(sc.lat)} · {fmtLon(sc.lon)}{res ? ` · ${(res.hor.siteHeightM / 1000).toFixed(2)} km ${t('elevation')}` : ''}</p>
          </div>
          <DateControl sc={sc} onChange={(v) => updateScenario(sc.id, { t: v })} />
        </div>
        {site && <p className="site-note">{lang === 'es' ? site.note_es : site.note}</p>}
        <div className="tabs" role="tablist">
          {([['horizon', t('tab.horizon')], ['surface', t('tab.surface')], ['map', t('tab.map')]] as [Tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>)}
          <span className="grow" />
          {tab === 'horizon' && <label className="check"><input type="checkbox" checked={trueScale} onChange={(e) => setTrue(e.target.checked)} />{t('tab.true')}</label>}
        </div>
        <div className="viewport frame">
          {!res || !now ? <div className="loading mono">{t('computing')}</div> : tab === 'horizon' ? <Panorama res={res} cfg={cfg} now={now} trueScale={trueScale} />
            : tab === 'map' ? <TerrainMap res={res} now={now} tMs={tc} /> : <Suspense fallback={<div className="loading mono">{t('loading3d')}</div>}><SurfaceView res={res} now={now} tMs={tc} /></Suspense>}
          {busy && res && <div className="busy mono">{t('updating')}</div>}
        </div>
        <div className="tl-head">
          <div className="tl-title"><button className="play" onClick={() => setPlaying(!playing)} aria-label={playing ? t('pause') : t('play')} title={`${playing ? t('pause') : t('play')} (Space)`}>{playing ? '❚❚' : '▶'}</button><span className="mono">{fmtDateTime(tc)}</span><span className="dim tl-help">{t('tl.help')}</span></div>
          <SpanControl />
        </div>
        <div className="tl-wrap">{res && <Timeline res={res} cursorH={cursorH} onCursor={setCursor} />}</div>
      </main>
      <aside className="side">
        {res && now && <><Verdict m={res.analysis.metrics} req={req} /><Readouts res={res} now={now} cursorH={cursorH} /></>}
        <Settings />
      </aside>
    </div>
  )
}

/** Shareable state in the URL hash: #v=navigator&s=conn-ridge&t=1799...&tab=horizon (or &c=lat,lon). */
function useHashState() {
  useEffect(() => {
    const p = new URLSearchParams(location.hash.slice(1)); const st = useStore.getState()
    const v = p.get('v') as View | null, tab = p.get('tab') as Tab | null, s = p.get('s'), c = p.get('c'), tt = Number(p.get('t'))
    const act = st.scenarios.find((x) => x.id === st.activeId)!
    if (s && SITES.some((x) => x.id === s)) st.select(s)
    else if (c) { const [la, lo] = c.split(',').map(Number); if (Number.isFinite(la) && Number.isFinite(lo)) st.updateScenario(act.id, { siteId: null, name: '', lat: la, lon: lo }) }
    if (Number.isFinite(tt) && tt > 0) st.updateScenario(act.id, { t: tt })
    if (v && ['navigator', 'compare', 'planner'].includes(v)) st.setView(v)
    if (tab && ['horizon', 'map', 'surface'].includes(tab)) st.setTab(tab)
    if (p.get('go') === '1') st.setIntro(false)
  }, [])
  const { scenarios, activeId, view, tab } = useStore()
  useEffect(() => {
    const a = scenarios.find((x) => x.id === activeId)!
    const p = new URLSearchParams({ v: view, tab, t: String(a.t) })
    if (a.siteId) p.set('s', a.siteId); else p.set('c', `${a.lat.toFixed(4)},${a.lon.toFixed(4)}`)
    history.replaceState(null, '', `#${p.toString()}`)
  }, [scenarios, activeId, view, tab])
}

function useKeys() {
  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; if (/INPUT|TEXTAREA|SELECT/.test(el.tagName) && (el as HTMLInputElement).type !== 'range') return
      const s = useStore.getState(); if (s.intro || s.view !== 'navigator') return
      if (e.code === 'Space') { e.preventDefault(); s.setPlaying(!s.playing) }
      else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); const stepH = s.spanDays <= 4 ? 1 : 6; s.setCursor(Math.max(0, Math.min(s.spanDays * 24 - 0.01, s.cursorH + (e.key === 'ArrowRight' ? stepH : -stepH)))) }
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [])
}

export default function App() {
  const { view, intro, theme, lang, guide } = useStore()
  const [progress, setProgress] = useState({ p: 0, label: '' })
  useHashState(); useKeys()
  useEffect(() => { loadTerrain((p, label) => setProgress({ p, label })) }, [])
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.lang = lang }, [theme, lang])
  return (
    <div className="app">
      {intro && <Intro progress={progress} />}
      <Header />
      <div className="body">{view === 'navigator' ? <Navigator /> : view === 'compare' ? <Compare /> : <Planner />}</div>
      {guide && <Guide />}
    </div>
  )
}
