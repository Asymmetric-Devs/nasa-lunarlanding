import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useT } from '../i18n'
import { Logo } from './Logo'
import { TerrainGL } from '../gl/terrainGL'
import { grids, terrainFor, horizonFor } from '../lib/terrainStore'
import { polarPixel } from '../engine/terrain'
import { sampleAt, defaultConfig } from '../engine/analysis'
import { skyState } from '../engine/ephemeris'
import { compass, fmtDur } from '../lib/format'
import './intro.css'

const STILL = new URLSearchParams(location.search).has('still')
let frames = 0, lastP = -1
const RIDGE = { lat: -89.534, lon: 209.948 }
const clamp01 = (x: number) => Math.min(1, Math.max(0, x))
const smooth = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t) }
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Sunrise preloader: a giant telemetry numeral fills with amber as the terrain loads while the Sun climbs a jagged lunar ridge, then floods the screen. */
const RIDGE_PTS = (() => {
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) - 0.5
  const N = 256, h = new Array(N + 1).fill(0); h[0] = 0; h[N] = 6
  for (let step = N, amp = 70; step > 1; step /= 2, amp *= 0.56) for (let i = step / 2; i < N; i += step) h[i] = (h[i - step / 2] + h[i + step / 2]) / 2 + rnd() * amp
  const hi = Math.max(...h), lo = Math.min(...h)
  return h.map((v, i) => `${((i / N) * 1600).toFixed(1)},${(250 - ((v - lo) / (hi - lo)) * 150 + 34 * Math.exp(-(((i - 170) / 30) ** 2))).toFixed(1)}`)
})()
const STEPS = ['pre.s1', 'pre.s2', 'pre.s3', 'pre.s4'] as const
function Preloader({ progress, onDone }: { progress: number; onDone(): void }) {
  const t = useT()
  const [out, setOut] = useState(false), [go, setGo] = useState(false), [gone, setGone] = useState(false), [shown, setShown] = useState(0)
  const t0 = useRef(performance.now()), target = useRef(0)
  target.current = progress
  useEffect(() => { let raf = 0; const tick = () => { setShown((v) => { const d = target.current - v; return Math.abs(d) < 0.002 ? target.current : v + d * 0.08 }); raf = requestAnimationFrame(tick) }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf) }, [])
  useEffect(() => {
    if (progress < 1) return
    const wait = Math.max(0, 2500 - (performance.now() - t0.current))
    const a = setTimeout(() => setOut(true), wait), b = setTimeout(() => setGo(true), wait + 100), c = setTimeout(() => setGone(true), wait + 1100), d = setTimeout(onDone, wait + 1900)
    return () => { clearTimeout(a); clearTimeout(b); clearTimeout(c); clearTimeout(d) }
  }, [progress])
  const k = Math.min(1, shown), pct = Math.round(k * 100)
  return (
    <div className={`pre ${out ? 'rise' : ''} ${gone ? 'wipe' : ''}`} style={{ ['--k' as any]: k }} aria-live="polite">
      <svg className="pre-rings" viewBox="-400 -400 800 800" aria-hidden>{[60, 110, 170, 240, 320, 410, 510].map((r, i) => <circle key={r} r={r} fill="none" stroke="#ffa91f" strokeWidth="1" vectorEffect="non-scaling-stroke" strokeDasharray={`${r * 6.28 * 0.62} ${r * 6.28}`} style={{ opacity: Math.min(0.5, 0.06 + k * 0.5) * (1 - i * 0.09), transform: `rotate(${i * 47 + k * (i % 2 ? 90 : -70)}deg)` }} />)}</svg>
      <div className="pre-top mono"><span>SUNLINE</span><span>{t('pre.tag')}</span></div>
      <div className="pre-num" aria-label={`${pct}%`}><span className="pre-n">{String(pct).padStart(2, '0')}</span><span className="pre-pc">%</span></div>
      <ul className="pre-steps mono">{STEPS.map((s, i) => <li key={s} className={k >= (i + 1) / 4 - 0.02 || go ? 'ok' : k >= i / 4 ? 'now' : ''}><i />{t(s)}</li>)}</ul>
      <p className={`pre-go ${go ? 'on' : ''}`}>{t('pre.go')}</p>
      <div className="pre-sky" aria-hidden>
        <div className="pre-halo" /><div className="pre-sun" />
        <svg className="pre-ridge" viewBox="0 0 1600 300" preserveAspectRatio="none">
          <polygon points={`0,300 ${RIDGE_PTS.join(' ')} 1600,300`} fill="#07080b" />
          <polyline points={RIDGE_PTS.join(' ')} fill="none" stroke="#ffa91f" strokeWidth="1.6" vectorEffect="non-scaling-stroke" opacity={0.4 + 0.6 * k} />
          {[14, 30, 48, 68].map((d, i) => <polyline key={d} points={RIDGE_PTS.map((q) => { const [x, y] = q.split(','); return `${x},${(+y + d).toFixed(1)}` }).join(' ')} fill="none" stroke="#ffa91f" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={0.3 - i * 0.07} />)}
        </svg>
      </div>
    </div>
  )
}

function Hero({ onPin, children }: { onPin(p: number): void; children: React.ReactNode }) {
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), sunEl = useRef<HTMLDivElement>(null), sunTxt = useRef<HTMLSpanElement>(null)
  const pin = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const canvas = cv.current!, root = wrap.current!.closest('.intro') as HTMLElement
    const { core, cap } = grids(); if (!core) return
    let gl: TerrainGL
    try { gl = new TerrainGL(canvas) } catch { return }
    gl.setTerrain(core, cap)
    gl.setLook({ exposure: 3.1, contour: 0.25, contourStrength: 0.3, indexStrength: 0.5, lineColor: [1, 0.64, 0.2], steps: gl.software ? 48 : 140 })
    const ridge = polarPixel(RIDGE.lat, RIDGE.lon, 1000, 0)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    const size = () => { const r = wrap.current!.getBoundingClientRect(); gl.resize(r.width, r.height, dpr) }
    size(); const ro = new ResizeObserver(size); ro.observe(wrap.current!)
    const ptr = { x: 0.62, y: 0.38, tx: 0.62, ty: 0.38, last: -1e9 }
    const onMove = (e: PointerEvent) => { const r = wrap.current!.getBoundingClientRect(); ptr.tx = (e.clientX - r.left) / r.width; ptr.ty = (e.clientY - r.top) / r.height; ptr.last = performance.now() }
    window.addEventListener('pointermove', onMove)
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, visible = true, p = 0
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting)); io.observe(canvas)
    const sc = () => { const h = pin.current!.clientHeight - window.innerHeight; p = clamp01(root.scrollTop / Math.max(1, h)); onPin(p) }
    root.addEventListener('scroll', sc, { passive: true }); sc()
    const t0 = performance.now(); let azAuto = 0.9
    let lastT = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick); if (!visible) return
      if (STILL && frames++ > 4 && Math.abs(p - lastP) < 1e-4) return; lastP = p
      gl.adapt(now - lastT); lastT = now
      const idle = now - ptr.last > 3500
      if (idle || reduce) { azAuto += 0.0035; ptr.tx = 0.5 + 0.34 * Math.cos(azAuto + p * 5), ptr.ty = 0.5 + 0.34 * Math.sin(azAuto + p * 5) }
      ptr.x = lerp(ptr.x, ptr.tx, 0.09); ptr.y = lerp(ptr.y, ptr.ty, 0.09)
      const dx = ptr.x - 0.5, dy = (ptr.y - 0.5) * (gl.h / gl.w), dist = Math.min(1, Math.hypot(ptr.x - 0.5, (ptr.y - 0.5)) * 2)
      const elDeg = lerp(7.5, 1.1, dist ** 0.8)
      gl.setSunIllustrative(dx, dy, (elDeg * Math.PI) / 180)
      // scroll-driven camera: flat map -> tilted 3D -> zoom on the ridge
      const tilt = smooth(0.16, 0.46, p) * 58 - smooth(0.86, 1, p) * 18
      const zoom = smooth(0.52, 0.95, p), radius = lerp(104, 30, zoom ** 1.1) * lerp(1, 0.82, smooth(0.16, 0.46, p))
      gl.setView({ cx: ridge.col * smooth(0.52, 0.95, p), cy: ridge.row * smooth(0.52, 0.95, p), radius, tilt, exag: smooth(0.12, 0.44, p) * 2.8 })
      gl.setLook({ contourStrength: lerp(0.3, 0.14, smooth(0.1, 0.5, p)), indexStrength: lerp(0.5, 0.26, smooth(0.1, 0.5, p)) })
      gl.render()
      if (sunEl.current) { const r = wrap.current!.getBoundingClientRect(); sunEl.current.style.transform = `translate(${ptr.x * r.width}px, ${ptr.y * r.height}px)` }
      if (sunTxt.current) sunTxt.current.textContent = `${elDeg.toFixed(1)}°`
      void t0
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); window.removeEventListener('pointermove', onMove); root.removeEventListener('scroll', sc); gl.dispose() }
  }, [])
  return (
    <div className="pin" ref={pin}>
      <div className="hstage" ref={wrap}>
        <canvas ref={cv} className="gl" />
        <div className="sun-cursor" ref={sunEl} aria-hidden><i /><span className="mono"><b ref={sunTxt}>0°</b> SUN</span></div>
        {children}
      </div>
    </div>
  )
}

function Ticker() {
  const t = useT()
  const [s, setS] = useState<{ sunEl: number; sunAz: number; earthEl: number; link: boolean; tleft: string } | null>(null)
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])
  useEffect(() => {
    let dead = false
    terrainFor('conn-ridge').then((terr) => {
      const hor = horizonFor(terr, 'intro-ridge', RIDGE.lat, RIDGE.lon, 0)
      const upd = () => { if (dead) return; const q = sampleAt(skyState(Date.now()), RIDGE.lat, RIDGE.lon, hor, defaultConfig); let h: number | null = null
        for (let m = 20; m < 60 * 24 * 40; m += 20) { const z = sampleAt(skyState(Date.now() + m * 60000), RIDGE.lat, RIDGE.lon, hor, defaultConfig); if (z.sunlit !== q.sunlit) { h = m / 60; break } }
        setS({ sunEl: q.sunEl, sunAz: q.sunAz, earthEl: q.earthEl, link: q.earthLink, tleft: fmtDur(h, '>40 d') }) }
      upd(); const i = setInterval(upd, 20000); return () => clearInterval(i)
    })
    return () => { dead = true }
  }, [])
  const d = new Date(now), utc = d.toISOString().slice(11, 19)
  const items = s ? [
    `${t('tk.live')} · ${t('tk.site')} 89.534°S`, `${t('sun').toUpperCase()} ${s.sunEl >= 0 ? '+' : ''}${s.sunEl.toFixed(2)}° · AZ ${s.sunAz.toFixed(0)}° ${compass(s.sunAz)}`,
    `${t('earth').toUpperCase()} ${s.earthEl >= 0 ? '+' : ''}${s.earthEl.toFixed(2)}° · ${s.link ? t('tk.link') : t('tk.nolink')}`, `${s.sunEl > -0.3 ? t('ro.sunset') : t('ro.sunrise')} ${s.tleft}`, `UTC ${utc}`,
  ] : [`${t('tk.live')} · ${t('tk.site')} 89.534°S`, 'UTC ' + utc]
  const row = items.map((x, i) => <span key={i}>{x}<em>◆</em></span>)
  return <div className="ticker mono" aria-label="Live telemetry"><div className="ticker-track">{row}{row}{row}{row}</div></div>
}

export default function Intro({ progress }: { progress: { p: number; label: string } }) {
  const { setIntro, setGuide, lang, setLang, theme, setTheme } = useStore()
  const t = useT()
  const [pre, setPre] = useState(true), [p, setP] = useState(0), [leaving, setLeaving] = useState(false)
  const ready = progress.p >= 1
  const go = () => { setLeaving(true); setTimeout(() => setIntro(false), 520) }
  useEffect(() => { const f = (e: KeyboardEvent) => { if (e.key === 'Enter' && !pre) go() }; window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [pre])
  const ch = p < 0.34 ? 0 : p < 0.68 ? 1 : 2
  return (
    <div className={`intro ${leaving ? 'leaving' : ''}`} style={{ ['--p' as any]: p }}>
      {ready && <Hero onPin={setP}>
      <div className="hud-top">
        <span className="brand static"><Logo /><span>Sunline</span></span>
        <span className="kick mono">{t('hero.kicker')}</span>
        <div className="top-right">
          <button className="ghost-link" onClick={() => setGuide(true)}>{t('nav.guide')}</button>
          <div className="seg tiny" role="group" aria-label={t('nav.language')}>{(['en', 'es'] as const).map((l) => <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}</div>
          <button className="iconbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('nav.theme')}>{theme === 'dark' ? '☀' : '☾'}</button>
          <button className="slant" disabled={!ready} onClick={go}><span>{t('hero.enter')}</span><b aria-hidden>▸</b></button>
        </div>
      </div>
      <div className="hud-copy">
        <h1 style={{ ['--shift' as any]: `${-smooth(0.04, 0.3, p) * 26}vh`, opacity: 1 - smooth(0.05, 0.28, p) }}>
          <span className="big">{t('hero.h1a')}</span>
          <span className="serif">{t('hero.h1b')}</span>
        </h1>
        <p className="hint mono" style={{ opacity: 1 - smooth(0, 0.06, p) }}>{t('hero.hint')} <i aria-hidden /></p>
      </div>
      <div className="chapters" aria-live="polite">
        {[1, 2, 3].map((n, i) => <article key={n} className={ch === i && p > 0.1 ? 'on' : ''}><span className="mono">0{n} / 03</span><h2>{t(`ch${n}.h` as any)}</h2><p>{t(`ch${n}.p` as any)}</p></article>)}
      </div>
      <div className="meter-bar" aria-hidden><i style={{ transform: `scaleX(${p})` }} /></div>
      <Ticker />
      </Hero>}
      <section className="paper-block">
        <div className="pb-in">
          <p className="eyebrow">{t('intro.how.eyebrow')}</p>
          <h2><span className="big">{t('how.a')}</span> <span className="serif">{t('how.b')}</span></h2>
          <ol>{(['1', '2', '3', '4'] as const).map((n) => <li key={n}><span className="num">0{n}</span><b>{t(`intro.s${n}.h` as any)}</b><p>{t(`intro.s${n}.p` as any)}</p></li>)}</ol>
          <div className="facts2">
            <div><b>&lt;0.005°</b><span>{t('intro.f1')}</span></div><div><b>r 0.97</b><span>{t('intro.f2')}</span></div><div><b>80 m</b><span>{t('facts.res')}</span></div>
          </div>
        </div>
      </section>
      <section className="final">
        <p className="big">{t('final.big')}</p>
        <button className="slant xl" onClick={go}><span>{t('hero.enter')}</span><b aria-hidden>▸</b></button>
        <button className="plain" onClick={() => setGuide(true)}>{t('intro.how')}</button>
        <p className="credit mono">LRO/LOLA · NASA SVS · JPL Horizons · Astronomy Engine</p>
      </section>
      {pre && <Preloader progress={progress.p} onDone={() => setPre(false)} />}
    </div>
  )
}
