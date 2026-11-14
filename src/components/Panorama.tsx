import { useEffect, useRef, useState } from 'react'
import type { Result } from '../hooks/useAnalysis'
import type { Config, Sample } from '../engine/analysis'
import { horizonAt } from '../engine/terrain'
import { compass } from '../lib/format'
import { useT } from '../i18n'

const SUN = '#ffb547', EARTH = '#5cb8ff'

/** 360° horizon panorama: terrain silhouette, Sun and Earth discs (exaggerated), sun/earth tracks over the analysis window. */
export function Panorama({ res, cfg, now, trueScale }: { res: Result; cfg: Config; now: Sample; trueScale: boolean }) {
  const t = useT()
  const ref = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 800, h: 360 })
  const [hover, setHover] = useState<{ az: number; el: number } | null>(null)
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }))
    if (wrap.current) ro.observe(wrap.current); return () => ro.disconnect()
  }, [])

  const hMax = Math.max(...res.hor.el)
  const elMin = -4, elMax = Math.max(12, Math.ceil(hMax + 4))
  const geom = (w: number, h: number) => { const padL = 36, padR = 12, padT = 14, padB = 30; return { padL, padR, padT, padB, x: (az: number) => padL + (az / 360) * (w - padL - padR), y: (el: number) => padT + (1 - (el - elMin) / (elMax - elMin)) * (h - padT - padB) } }

  useEffect(() => {
    const cv = ref.current!; const dpr = window.devicePixelRatio || 1
    if (cv.width !== Math.floor(size.w * dpr) || cv.height !== Math.floor(size.h * dpr)) { cv.width = size.w * dpr; cv.height = size.h * dpr }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size.w, size.h)
    const { w, h } = { w: size.w, h: size.h }; const G = geom(w, h)
    const css = getComputedStyle(document.documentElement)
    // sky
    const sky = g.createLinearGradient(0, G.y(elMax), 0, G.y(0)); sky.addColorStop(0, '#04060a'); sky.addColorStop(1, '#0a0f17')
    g.fillStyle = sky; g.fillRect(0, 0, w, h)
    // deterministic stars
    let s = 12345; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647
    for (let i = 0; i < 140; i++) { const x = G.padL + rnd() * (w - G.padL - G.padR), y = G.padT + rnd() * (G.y(0) - G.padT), a = 0.15 + rnd() * 0.5; g.fillStyle = `rgba(255,255,255,${a})`; g.fillRect(x, y, rnd() > 0.9 ? 1.6 : 1, rnd() > 0.9 ? 1.6 : 1) }
    // grid
    g.lineWidth = 1; g.font = '10px "Geist Mono Variable", monospace'; g.textBaseline = 'middle'
    for (let el = Math.ceil(elMin / 2) * 2; el <= elMax; el += 2) {
      const y = G.y(el); g.strokeStyle = el === 0 ? 'rgba(255,255,255,.28)' : 'rgba(255,255,255,.06)'; g.beginPath(); g.moveTo(G.padL, y); g.lineTo(w - G.padR, y); g.stroke()
      g.fillStyle = 'rgba(160,170,182,.8)'; g.textAlign = 'right'; g.fillText(`${el}°`, G.padL - 6, y)
    }
    for (let az = 0; az <= 360; az += 45) { const x = G.x(az); g.strokeStyle = 'rgba(255,255,255,.05)'; g.beginPath(); g.moveTo(x, G.padT); g.lineTo(x, h - G.padB); g.stroke() }
    // tracks over the analysis window
    const A = res.analysis.samples, stride = Math.max(1, Math.floor(A.length / 360))
    const drawTrack = (az: (s: Sample) => number, el: (s: Sample) => number, col: string) => {
      g.strokeStyle = col; g.globalAlpha = 0.35; g.setLineDash([2, 4]); g.lineWidth = 1.25; g.beginPath(); let prev = -999
      for (let i = 0; i < A.length; i += stride) { const a = az(A[i]), x = G.x(a), y = G.y(el(A[i])); if (prev === -999 || Math.abs(a - prev) > 180) g.moveTo(x, y); else g.lineTo(x, y); prev = a }
      g.stroke(); g.setLineDash([]); g.globalAlpha = 1
    }
    drawTrack((q) => q.sunAz, (q) => q.sunEl, SUN); drawTrack((q) => q.earthAz, (q) => q.earthEl, EARTH)
    // Earth antenna mask
    if (cfg.minEarthEl > 0) { g.strokeStyle = 'rgba(92,184,255,.45)'; g.setLineDash([5, 4]); g.beginPath(); for (let az = 0; az <= 360; az += 1) { const x = G.x(az), y = G.y(res.hor.el[az % 360] + cfg.minEarthEl); az ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke(); g.setLineDash([]) }
    // discs (behind terrain), exaggeration so they are visible
    const pxPerDegY = (h - G.padT - G.padB) / (elMax - elMin)
    const exag = trueScale ? 1 : 4
    const disc = (az: number, el: number, rDeg: number, col: string, glow: number, earth = false) => {
      const x = G.x(az), y = G.y(el), r = Math.max(2.2, rDeg * pxPerDegY * exag)
      const gl = g.createRadialGradient(x, y, r * 0.6, x, y, r * glow); gl.addColorStop(0, col + '66'); gl.addColorStop(1, col + '00'); g.fillStyle = gl; g.beginPath(); g.arc(x, y, r * glow, 0, 7); g.fill()
      g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip()
      const fill = earth ? (() => { const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r); gr.addColorStop(0, '#9fd8ff'); gr.addColorStop(0.55, '#3d86d6'); gr.addColorStop(1, '#16335f'); return gr })() : col
      g.fillStyle = fill; g.fillRect(x - r, y - r, 2 * r, 2 * r); g.restore()
    }
    disc(now.sunAz, now.sunEl, now.sunRadius, SUN, 4); disc(now.earthAz, now.earthEl, now.earthRadius, EARTH, 3, true)
    // terrain silhouette
    const tg = g.createLinearGradient(0, G.y(hMax), 0, G.y(elMin)); tg.addColorStop(0, '#2a2d31'); tg.addColorStop(0.6, '#15171a'); tg.addColorStop(1, '#0b0c0e')
    g.beginPath(); g.moveTo(G.x(0), G.y(elMin))
    for (let az = 0; az <= 360; az += 0.5) g.lineTo(G.x(az), G.y(horizonAt(res.hor, az)))
    g.lineTo(G.x(360), G.y(elMin)); g.closePath(); g.fillStyle = tg; g.fill()
    g.strokeStyle = 'rgba(214,208,196,.75)'; g.lineWidth = 1.2; g.beginPath()
    for (let az = 0; az <= 360; az += 0.5) { const x = G.x(az), y = G.y(horizonAt(res.hor, az)); az ? g.lineTo(x, y) : g.moveTo(x, y) } g.stroke()
    // cardinal labels
    g.fillStyle = '#8b95a1'; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.font = '11px "Geist Mono Variable", monospace'
    ;[0, 45, 90, 135, 180, 225, 270, 315, 360].forEach((a) => g.fillText(compass(a), G.x(a), h - 10))
    // labels on discs
    const tag = (az: number, el: number, rDeg: number, text: string, col: string) => {
      const x = G.x(az), r = Math.max(2.2, rDeg * pxPerDegY * exag), y = Math.max(G.padT + 12, G.y(el) - r - 8)
      g.font = '600 10.5px "Geist Mono Variable", monospace'; g.fillStyle = col; g.textAlign = 'center'; g.fillText(text, Math.min(w - 50, Math.max(G.padL + 30, x)), y)
    }
    tag(now.sunAz, now.sunEl, now.sunRadius, `${t('sun').toUpperCase()} ${now.sunEl.toFixed(1)}°`, SUN); tag(now.earthAz, now.earthEl, now.earthRadius, `${t('earth').toUpperCase()} ${now.earthEl.toFixed(1)}°`, EARTH)
    if (hover) { const x = G.x(hover.az); g.strokeStyle = 'rgba(255,255,255,.3)'; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(x, G.padT); g.lineTo(x, h - G.padB); g.stroke(); g.setLineDash([]) }
  })

  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect(); const G = geom(size.w, size.h)
    const az = ((e.clientX - r.left - G.padL) / (size.w - G.padL - G.padR)) * 360
    if (az < 0 || az > 360) return setHover(null); setHover({ az, el: horizonAt(res.hor, az) })
  }
  return (
    <div className="pano" ref={wrap}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {hover && <div className="pano-tip mono">{t('pano.tip', { az: hover.az.toFixed(0), c: compass(hover.az), el: hover.el.toFixed(2), d: res.hor.dist[Math.floor(hover.az) % 360].toFixed(1) })}</div>}
      <div className="pano-note mono">{res.hor.hasTerrain ? t('pano.lola') : t('pano.geo')} · {trueScale ? t('pano.true') : t('pano.exag')}</div>
    </div>
  )
}
