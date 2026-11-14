import { useEffect, useMemo, useRef, useState } from 'react'
import type { Result } from '../hooks/useAnalysis'
import type { Sample } from '../engine/analysis'
import { skyState, MOON_RADIUS_KM, D2R, R2D } from '../engine/ephemeris'
import { SITES } from '../lib/sites'
import { polarPixel } from '../engine/terrain'
import { useStore } from '../store'
import { useT } from '../i18n'

const NY = 260
const R = MOON_RADIUS_KM

interface Grid { W: number; Hh: number; H: Float32Array; lon: Float32Array; ux: Float32Array; uy: Float32Array; uz: Float32Array; ex: Float32Array; ey: Float32Array; nx: Float32Array; ny: Float32Array; nz: Float32Array; d: number; cx: number; cy: number; ok: Uint8Array }

function buildGrid(res: Result, cx: number, cy: number, radiusKm: number, aspect: number): Grid {
  const W = Math.max(NY, Math.round(NY * aspect)), Hh = NY, n = W * Hh, d = (2 * radiusKm) / Hh
  const H = new Float32Array(n), lon = new Float32Array(n), ok = new Uint8Array(n)
  const ux = new Float32Array(n), uy = new Float32Array(n), uz = new Float32Array(n), ex = new Float32Array(n), ey = new Float32Array(n), nx = new Float32Array(n), ny = new Float32Array(n), nz = new Float32Array(n)
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, X = cx + (i - W / 2 + 0.5) * d, Y = cy + (j - Hh / 2 + 0.5) * d
    const h = res.terrain.heightXY(X, Y)
    if (h === null) { H[k] = 0; ok[k] = 0 } else { H[k] = h / 1000; ok[k] = 1 }
    const rho = Math.hypot(X, Y), lat = (-90 + 2 * Math.atan(rho / (2 * R)) * R2D) * D2R, l = Math.atan2(X, -Y)
    lon[k] = l
    const cl = Math.cos(lat), sl = Math.sin(lat), co = Math.cos(l), so = Math.sin(l)
    ux[k] = cl * co; uy[k] = cl * so; uz[k] = sl; ex[k] = -so; ey[k] = co; nx[k] = -sl * co; ny[k] = -sl * so; nz[k] = cl
  }
  return { W, Hh, H, lon, ux, uy, uz, ex, ey, nx, ny, nz, d, cx, cy, ok }
}

function shade(G: Grid, sun: [number, number, number], out: Uint8ClampedArray) {
  const { H, d, W, Hh } = G
  for (let j = 0; j < Hh; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i, o = k * 4
    if (!G.ok[k]) { out[o] = 7; out[o + 1] = 9; out[o + 2] = 12; out[o + 3] = 255; continue }
    const sEast = sun[0] * G.ex[k] + sun[1] * G.ey[k], sNorth = sun[0] * G.nx[k] + sun[1] * G.ny[k] + sun[2] * G.nz[k]
    const sUp = sun[0] * G.ux[k] + sun[1] * G.uy[k] + sun[2] * G.uz[k]
    const el = Math.asin(Math.max(-1, Math.min(1, sUp))), az = Math.atan2(sEast, sNorth)
    const l = G.lon[k], dirX = Math.sin(l + az), dirY = -Math.cos(l + az)
    // slope normal (map frame, y down)
    const hl = H[k - (i > 0 ? 1 : 0)], hr = H[k + (i < W - 1 ? 1 : 0)], hu = H[k - (j > 0 ? W : 0)], hd = H[k + (j < Hh - 1 ? W : 0)]
    const gx = (hr - hl) / (d * ((i > 0 ? 1 : 0) + (i < W - 1 ? 1 : 0))), gy = (hd - hu) / (d * ((j > 0 ? 1 : 0) + (j < Hh - 1 ? 1 : 0)))
    const nl = Math.hypot(gx, gy, 1), ce = Math.cos(el)
    const lam = Math.max(0, (-gx * dirX * ce - gy * dirY * ce + Math.sin(el)) / nl)
    let lit = el > -0.003
    if (lit) { // cast shadow along local sun azimuth
      const tanE = Math.tan(el), h0 = H[k]
      let s = d
      const px0 = (i + 0.5), py0 = (j + 0.5)
      while (s < 70) {
        const fx = px0 + (dirX * s) / d, fy = py0 + (dirY * s) / d
        const ix = fx | 0, iy = fy | 0
        if (ix < 0 || iy < 0 || ix >= W || iy >= Hh) break
        const kk = iy * W + ix
        if (G.ok[kk]) { const slope = (H[kk] - h0) / s - s / (2 * R); if (slope > tanE + 0.0004) { lit = false; break } }
        s *= 1.045; if (s < d * 1.5) s += d * 0.5
      }
    }
    const amb = 0.035 + 0.04 * Math.max(0, Math.min(1, (H[k] + 4) / 8)), b = lit ? Math.min(1, amb + 0.95 * lam * (0.25 + 0.75 * Math.min(1, el * 12 + 0.3))) : amb
    const tone = lit ? 1 : 0
    out[o] = 8 + b * (tone ? 238 : 120); out[o + 1] = 10 + b * (tone ? 226 : 128); out[o + 2] = 14 + b * (tone ? 196 : 150); out[o + 3] = 255
  }
}

export function PolarMap({ res, now, tMs }: { res: Result; now: Sample; tMs: number }) {
  const sc = res.scenario
  const t = useT()
  const { updateScenario } = useStore()
  const cv = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null), off = useRef<HTMLCanvasElement | null>(null)
  const [size, setSize] = useState({ w: 600, h: 330 })
  const [radius, setRadius] = useState(sc.lat < -86 ? 18 : 40)
  const [centerPole, setCenterPole] = useState(false)
  const supported = sc.lat <= -75
  useEffect(() => { const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) })); wrap.current && ro.observe(wrap.current); return () => ro.disconnect() }, [])
  const site = useMemo(() => { const p = polarPixel(sc.lat, sc.lon, 1000, 0); return { x: p.col, y: p.row } }, [sc.lat, sc.lon]) // km
  const cx = centerPole ? 0 : site.x, cy = centerPole ? 0 : site.y
  const grid = useMemo(() => (supported ? buildGrid(res, cx, cy, radius, size.w / size.h) : null), [res, cx, cy, radius, supported, Math.round((size.w / size.h) * 10)])
  const sky = useMemo(() => skyState(tMs), [tMs])

  useEffect(() => {
    if (!grid || !cv.current) return
    if (!off.current) { off.current = document.createElement('canvas'); }
    off.current.width = grid.W; off.current.height = grid.Hh
    const octx = off.current.getContext('2d')!, img = octx.createImageData(grid.W, grid.Hh)
    shade(grid, sky.sunDir, img.data); octx.putImageData(img, 0, 0)
    const dpr = window.devicePixelRatio || 1, SW = size.w, SH = size.h; cv.current.width = SW * dpr; cv.current.height = SH * dpr
    const g = cv.current.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high'
    g.drawImage(off.current, 0, 0, SW, SH)
    const pxPerKm = SH / (2 * radius)
    const px = (X: number, Y: number) => ({ x: SW / 2 + (X - grid.cx) * pxPerKm, y: SH / 2 + (Y - grid.cy) * pxPerKm })
    // curated sites
    g.font = '11px "Geist Mono Variable", monospace'; g.textBaseline = 'middle'
    for (const s of SITES) { if (s.lat > -75) continue; const p0 = polarPixel(s.lat, s.lon, 1000, 0), p = px(p0.col, p0.row); if (p.x < 6 || p.y < 6 || p.x > SW - 6 || p.y > SH - 6) continue; const on = s.id === sc.siteId
      g.strokeStyle = on ? '#ffb547' : 'rgba(255,255,255,.55)'; g.lineWidth = on ? 2 : 1; g.beginPath(); g.arc(p.x, p.y, on ? 6 : 3.5, 0, 7); g.stroke()
      if (!on) { g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'left'; g.fillText(s.name, p.x + 8, p.y) } }
    // active site marker + sun/earth az arrows
    const me = px(site.x, site.y)
    const arrow = (az: number, col: string, label: string) => { const l = Math.atan2(site.x, -site.y), a = l + az * D2R, L = 46, x2 = me.x + Math.sin(a) * L, y2 = me.y - Math.cos(a) * L
      g.strokeStyle = col; g.fillStyle = col; g.lineWidth = 1.6; g.beginPath(); g.moveTo(me.x, me.y); g.lineTo(x2, y2); g.stroke(); g.beginPath(); g.arc(x2, y2, 4.5, 0, 7); g.fill(); g.font = '600 10.5px "Geist Mono Variable", monospace'; g.textAlign = 'center'; g.fillText(label, x2 + Math.sin(a) * 16, y2 - Math.cos(a) * 12) }
    arrow(now.sunAz, '#ffb547', t('sun').toUpperCase()); arrow(now.earthAz, '#5cb8ff', t('earth').toUpperCase())
    g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.arc(me.x, me.y, 7, 0, 7); g.stroke()
    // pole
    const pp = px(0, 0); if (pp.x > 0 && pp.x < SW && pp.y > 0 && pp.y < SH) { g.strokeStyle = 'rgba(255,255,255,.6)'; g.beginPath(); g.moveTo(pp.x - 6, pp.y); g.lineTo(pp.x + 6, pp.y); g.moveTo(pp.x, pp.y - 6); g.lineTo(pp.x, pp.y + 6); g.stroke(); g.fillStyle = 'rgba(255,255,255,.7)'; g.textAlign = 'left'; g.fillText(t('map.pole'), pp.x + 9, pp.y - 8) }
    // scale bar
    const km = radius > 60 ? 50 : radius > 25 ? 20 : radius > 10 ? 10 : 5, len = km * pxPerKm
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(14, SH - 18); g.lineTo(14 + len, SH - 18); g.stroke(); g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText(`${km} km`, 14, SH - 28)
  }, [grid, sky, size.w, size.h, radius, now, site])

  if (!supported) return <div className="loading mono">{t('map.unsupported')}</div>
  const onClick = (e: React.MouseEvent) => {
    if (!grid || !cv.current) return
    const r = cv.current.getBoundingClientRect(), k = (2 * radius) / size.h
    const X = grid.cx + (e.clientX - r.left - size.w / 2) * k, Y = grid.cy + (e.clientY - r.top - size.h / 2) * k
    const rho = Math.hypot(X, Y), lat = -90 + 2 * Math.atan(rho / (2 * R)) * R2D, lon = (Math.atan2(X, -Y) * R2D + 360) % 360
    updateScenario(sc.id, { siteId: null, name: '', lat, lon })
  }
  return (
    <div className="mapwrap" ref={wrap}>
      <canvas ref={cv} style={{ width: size.w, height: size.h, cursor: 'crosshair' }} onClick={onClick} />
      <div className="map-ctl">
        <span className="lbl">{t('map.fov')}</span>
        <input type="range" min={5} max={150} step={1} value={radius} onChange={(e) => setRadius(+e.target.value)} aria-label="Map radius km" />
        <span className="mono">{radius} km</span>
        <label className="check"><input type="checkbox" checked={centerPole} onChange={(e) => setCenterPole(e.target.checked)} />{t('map.center')}</label>
      </div>
      <div className="map-note mono">{t('map.note', { t: new Date(tMs).toISOString().slice(0, 16).replace('T', ' ') })}</div>
    </div>
  )
}
