import { useEffect, useMemo, useRef, useState } from 'react'
import type { Result } from '../hooks/useAnalysis'
import type { Sample } from '../engine/analysis'
import { skyState, MOON_RADIUS_KM, D2R, R2D } from '../engine/ephemeris'
import { SITES } from '../lib/sites'
import { polarPixel } from '../engine/terrain'
import { grids } from '../lib/terrainStore'
import { TerrainGL } from '../gl/terrainGL'
import { useStore } from '../store'
import { useT } from '../i18n'
import { PolarMap } from './PolarMap'

const R = MOON_RADIUS_KM

/** Real-time GPU polar map: hillshade + cast shadows + optional contour lines and 3D tilt. Falls back to the CPU map without WebGL2. */
export function TerrainMap({ res, now, tMs }: { res: Result; now: Sample; tMs: number }) {
  if (!TerrainGL.supported()) return <PolarMap res={res} now={now} tMs={tMs} />
  return <Inner res={res} now={now} tMs={tMs} />
}

function Inner({ res, now, tMs }: { res: Result; now: Sample; tMs: number }) {
  const sc = res.scenario, t = useT(), { updateScenario, theme } = useStore()
  const cv = useRef<HTMLCanvasElement>(null), ov = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null)
  const gl = useRef<TerrainGL | null>(null)
  const raf = useRef(0), lastF = useRef(0)
  // coalesce renders to one per animation frame; adapt resolution to the GPU's real speed
  const schedule = () => { if (raf.current) return; raf.current = requestAnimationFrame((n) => { raf.current = 0; const g = gl.current; if (!g) return; if (lastF.current && n - lastF.current < 120) g.adapt(n - lastF.current); lastF.current = n; g.render() }) }
  const [size, setSize] = useState({ w: 800, h: 450 })
  const [radius, setRadius] = useState(sc.lat < -86 ? 18 : 40)
  const [tilt, setTilt] = useState(0)
  const [contours, setContours] = useState(true)
  const [centerPole, setCenterPole] = useState(false)
  const supported = sc.lat <= -75
  const site = useMemo(() => { const p = polarPixel(sc.lat, sc.lon, 1000, 0); return { x: p.col, y: p.row } }, [sc.lat, sc.lon])
  const sky = useMemo(() => skyState(tMs), [tMs])
  const cx = centerPole ? 0 : site.x, cy = centerPole ? 0 : site.y

  useEffect(() => {
    if (!supported) return
    const { core, cap } = grids(); if (!core) return
    const g = new TerrainGL(cv.current!); g.setTerrain(core, cap); gl.current = g
    const ro = new ResizeObserver(() => { const r = wrap.current!.getBoundingClientRect(); setSize({ w: Math.round(r.width), h: Math.round(r.height) }) }); ro.observe(wrap.current!)
    return () => { ro.disconnect(); cancelAnimationFrame(raf.current); raf.current = 0; g.dispose(); gl.current = null }
  }, [supported])

  useEffect(() => {
    const g = gl.current; if (!g || !supported) return
    g.resize(size.w, size.h, Math.min(window.devicePixelRatio || 1, 1.5))
    g.setSunPhysical(sky.sunDir)
    g.setView({ cx, cy, radius, tilt, exag: tilt > 1 ? 2 : 0 })
    g.setLook({ exposure: 1.7, contour: radius > 70 ? 0.5 : radius > 25 ? 0.25 : 0.1, contourStrength: contours ? 0.2 : 0, indexStrength: contours ? 0.42 : 0, lineColor: [1, 0.66, 0.22], steps: g.software ? 48 : 150, shadows: true })
    g.setMarker(site.x, site.y, true)
    schedule()
    // 2D overlay (labels, Sun/Earth directions) only for the top-down view
    const o = ov.current!, dpr = window.devicePixelRatio || 1; if (o.width !== Math.floor(size.w * dpr) || o.height !== Math.floor(size.h * dpr)) { o.width = size.w * dpr; o.height = size.h * dpr }
    const c = o.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, size.w, size.h)
    if (tilt > 1) return
    const k = size.h / (2 * radius), px = (X: number, Y: number) => ({ x: size.w / 2 + (X - cx) * k, y: size.h / 2 + (Y - cy) * k })
    c.font = '11px "Geist Mono Variable", monospace'; c.textBaseline = 'middle'
    const me0 = px(site.x, site.y)
    for (const s of SITES) { if (s.lat > -75 || s.id === sc.siteId) continue; const q = polarPixel(s.lat, s.lon, 1000, 0), p = px(q.col, q.row); if (Math.hypot(p.x - me0.x, p.y - me0.y) < 34) continue; if (p.x < 8 || p.y < 8 || p.x > size.w - 8 || p.y > size.h - 8) continue
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1; c.beginPath(); c.arc(p.x, p.y, 3.5, 0, 7); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.textAlign = 'left'; c.fillText(s.name, p.x + 8, p.y) }
    const me = px(site.x, site.y)
    const arrow = (az: number, col: string, label: string) => { const l = Math.atan2(site.x, -site.y), a = l + az * D2R, L = 54, x2 = me.x + Math.sin(a) * L, y2 = me.y - Math.cos(a) * L
      c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 1.8; c.beginPath(); c.moveTo(me.x, me.y); c.lineTo(x2, y2); c.stroke(); c.beginPath(); c.arc(x2, y2, 5, 0, 7); c.fill(); c.font = '700 10.5px "Geist Mono Variable", monospace'; c.textAlign = 'center'; c.fillText(label, x2 + Math.sin(a) * 18, y2 - Math.cos(a) * 13) }
    arrow(now.sunAz, '#ffb547', t('sun').toUpperCase()); arrow(now.earthAz, '#7cc4ff', t('earth').toUpperCase())
    const pp = px(0, 0); if (pp.x > 0 && pp.x < size.w && pp.y > 0 && pp.y < size.h) { c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(pp.x - 6, pp.y); c.lineTo(pp.x + 6, pp.y); c.moveTo(pp.x, pp.y - 6); c.lineTo(pp.x, pp.y + 6); c.stroke(); c.fillStyle = 'rgba(255,255,255,.8)'; c.font = '11px "Geist Mono Variable", monospace'; c.textAlign = 'left'; c.fillText(t('map.pole'), pp.x + 9, pp.y - 8) }
    const km = radius > 60 ? 50 : radius > 25 ? 20 : radius > 10 ? 10 : 5, len = km * k
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.beginPath(); c.moveTo(16, size.h - 22); c.lineTo(16 + len, size.h - 22); c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(`${km} km`, 16, size.h - 34)
  }, [size, sky, radius, tilt, contours, cx, cy, now, site, supported, theme])

  if (!supported) return <div className="loading mono">{t('map.unsupported')}</div>
  const onClick = (e: React.MouseEvent) => {
    if (tilt > 1) return
    const r = cv.current!.getBoundingClientRect(), k = (2 * radius) / size.h
    const X = cx + (e.clientX - r.left - size.w / 2) * k, Y = cy + (e.clientY - r.top - size.h / 2) * k, rho = Math.hypot(X, Y)
    updateScenario(sc.id, { siteId: null, name: '', lat: -90 + 2 * Math.atan(rho / (2 * R)) * R2D, lon: (Math.atan2(X, -Y) * R2D + 360) % 360 })
  }
  return (
    <div className="mapwrap" ref={wrap}>
      <canvas ref={cv} className="glmap" style={{ cursor: tilt > 1 ? 'default' : 'crosshair' }} onClick={onClick} />
      <canvas ref={ov} className="glover" />
      <div className="map-ctl">
        <span className="lbl">{t('map.fov')}</span>
        <input type="range" min={5} max={160} step={1} value={radius} onChange={(e) => setRadius(+e.target.value)} aria-label={t('map.fov')} />
        <span className="mono">{radius} km</span>
        <span className="lbl">{t('map.tilt')}</span>
        <input type="range" min={0} max={62} step={1} value={tilt} onChange={(e) => setTilt(+e.target.value)} aria-label={t('map.tilt')} />
        <label className="check"><input type="checkbox" checked={contours} onChange={(e) => setContours(e.target.checked)} />{t('map.contours')}</label>
        <label className="check"><input type="checkbox" checked={centerPole} onChange={(e) => setCenterPole(e.target.checked)} />{t('map.center')}</label>
      </div>
      <div className="map-note mono">{t('map.note.gl', { t: new Date(tMs).toISOString().slice(0, 16).replace('T', ' ') })}</div>
    </div>
  )
}
