import { useEffect, useRef, useState } from 'react'
import type { Result } from '../hooks/useAnalysis'
import { fmtDateTime, fmtShort, fmtDur } from '../lib/format'
import { horizonAt } from '../engine/terrain'
import { cssv } from '../lib/theme'
import { useStore } from '../store'
import { useT } from '../i18n'

const SUN = '#ffb547', EARTH = '#4aa8f0', BOTH = '#4cc38a'

export function Timeline({ res, cursorH, onCursor, compact = false, showAxis = true }: { res: Result; cursorH: number; onCursor?: (h: number) => void; compact?: boolean; showAxis?: boolean }) {
  const t = useT(); const theme = useStore((s) => s.theme); useStore((s) => s.lang)
  const ref = useRef<HTMLCanvasElement>(null), wrap = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 900, h: compact ? 120 : 250 })
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => { const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) })); wrap.current && ro.observe(wrap.current); return () => ro.disconnect() }, [])
  const A = res.analysis, n = A.samples.length, spanH = (n * A.stepMs) / 3.6e6
  const padL = compact ? 8 : 54, padR = compact ? 8 : 12
  const trackH = compact ? 7 : 11, tracks = 3
  const chartTop = 8, chartBottom = size.h - (showAxis ? 22 : 6) - tracks * (trackH + 3) - 6

  useEffect(() => {
    const cv = ref.current!, dpr = window.devicePixelRatio || 1; if (cv.width !== Math.floor(size.w * dpr) || cv.height !== Math.floor(size.h * dpr)) { cv.width = size.w * dpr; cv.height = size.h * dpr }
    const g = cv.getContext('2d')!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size.w, size.h)
    const x = (i: number) => padL + (i / (n - 1)) * (size.w - padL - padR)
    const S = A.samples
    const dim = cssv('--dim'), grid = cssv('--grid'), grid2 = cssv('--grid2'), band = cssv('--band'), trackbg = cssv('--trackbg'), ink = cssv('--text')
    void theme
    // effective elevation = elevation minus terrain horizon in that direction
    const elMax = 14, elMin = -14
    const y = (el: number) => chartTop + (1 - (Math.max(elMin, Math.min(elMax, el)) - elMin) / (elMax - elMin)) * (chartBottom - chartTop)
    g.font = '10px "Geist Mono Variable", monospace'; g.textBaseline = 'middle'
    if (!compact) for (let el = -10; el <= 10; el += 5) { g.strokeStyle = el === 0 ? grid2 : grid; g.beginPath(); g.moveTo(padL, y(el)); g.lineTo(size.w - padR, y(el)); g.stroke(); g.fillStyle = dim; g.textAlign = 'right'; g.fillText(`${el}°`, padL - 5, y(el)) }
    else { g.strokeStyle = grid2; g.beginPath(); g.moveTo(padL, y(0)); g.lineTo(size.w - padR, y(0)); g.stroke() }
    // dark bands
    g.fillStyle = band
    for (const iv of A.metrics.darkIntervals) { const a = x((iv.start - A.t0) / A.stepMs), b = x((iv.end - A.t0) / A.stepMs); g.fillRect(a, chartTop, Math.max(1, b - a), chartBottom - chartTop) }
    // terrain-limited sun: effective clearance curve (sun elevation minus horizon)
    const line = (f: (s: (typeof S)[number]) => number, col: string, wdt: number) => { g.strokeStyle = col; g.lineWidth = wdt; g.beginPath(); S.forEach((s, i) => (i ? g.lineTo(x(i), y(f(s))) : g.moveTo(x(i), y(f(s))))); g.stroke() }
    line((s) => s.earthEl, EARTH + 'cc', 1.4)
    line((s) => s.sunEl, SUN + '55', 1)
    // sun clearance above terrain
    g.strokeStyle = SUN; g.lineWidth = 1.6; g.beginPath(); S.forEach((s, i) => { const v = s.sunEl - horizonAt(res.hor, s.sunAz); i ? g.lineTo(x(i), y(v)) : g.moveTo(x(i), y(v)) }); g.stroke()
    // tracks
    const bar = (row: number, test: (s: (typeof S)[number]) => boolean, col: string) => {
      const ty = chartBottom + 6 + row * (trackH + 3); g.fillStyle = trackbg; g.fillRect(padL, ty, size.w - padL - padR, trackH)
      g.fillStyle = col; let st = -1
      for (let i = 0; i <= n; i++) { const on = i < n && test(S[i]); if (on && st < 0) st = i; if (!on && st >= 0) { g.fillRect(x(st), ty, Math.max(1, x(i - 1) - x(st)), trackH); st = -1 } }
      if (!compact) { g.fillStyle = dim; g.textAlign = 'right'; g.fillText([t('tl.sun'), t('tl.link'), t('tl.both')][row], padL - 5, ty + trackH / 2) }
    }
    bar(0, (s) => s.sunlit, SUN); bar(1, (s) => s.earthLink, EARTH); bar(2, (s) => s.sunlit && s.earthLink, BOTH)
    // x axis
    if (showAxis) {
      g.fillStyle = dim; g.textBaseline = 'alphabetic'; g.textAlign = 'center'
      const ticks = spanH <= 96 ? 12 : spanH <= 24 * 20 ? 24 * 3 : spanH < 24 * 40 ? 24 * 5 : 24 * 30
      for (let h = 0; h <= spanH; h += ticks) { const i = (h * 3.6e6) / A.stepMs; const px = x(i); g.fillText(spanH <= 96 ? `${String(new Date(A.t0 + h * 3.6e6).getUTCHours()).padStart(2, '0')}h` : fmtShort(A.t0 + h * 3.6e6), px, size.h - 6); g.strokeStyle = grid; g.beginPath(); g.moveTo(px, size.h - 18); g.lineTo(px, size.h - 14); g.stroke() }
    }
    // cursor
    const ci = (cursorH * 3.6e6) / A.stepMs; const cx = x(Math.min(n - 1, Math.max(0, ci)))
    g.strokeStyle = ink; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, chartTop - 2); g.lineTo(cx, size.h - (showAxis ? 20 : 4)); g.stroke()
    g.fillStyle = ink; g.beginPath(); g.moveTo(cx - 4, chartTop - 3); g.lineTo(cx + 4, chartTop - 3); g.lineTo(cx, chartTop + 3); g.fill()
    if (hover !== null) { const hx = x(hover); g.strokeStyle = grid2; g.beginPath(); g.moveTo(hx, chartTop); g.lineTo(hx, chartBottom); g.stroke() }
  })

  const idxAt = (e: React.PointerEvent | React.MouseEvent) => { const r = ref.current!.getBoundingClientRect(); const f = (e.clientX - r.left - padL) / (size.w - padL - padR); return Math.max(0, Math.min(n - 1, Math.round(f * (n - 1)))) }
  const drag = useRef(false)
  const s = hover !== null ? A.samples[hover] : null
  return (
    <div className="tl" ref={wrap}>
      <canvas ref={ref} style={{ width: '100%', height: '100%', cursor: onCursor ? 'ew-resize' : 'default', touchAction: 'none' }}
        onPointerDown={(e) => { if (!onCursor) return; drag.current = true; (e.target as Element).setPointerCapture(e.pointerId); onCursor((idxAt(e) * A.stepMs) / 3.6e6) }}
        onPointerMove={(e) => { setHover(idxAt(e)); if (drag.current && onCursor) onCursor((idxAt(e) * A.stepMs) / 3.6e6) }}
        onPointerUp={() => (drag.current = false)} onPointerLeave={() => setHover(null)} />
      {s && hover !== null && !compact && (
        <div className="tl-tip mono" style={{ left: Math.min(size.w - 190, Math.max(4, padL + (hover / (n - 1)) * (size.w - padL - padR) + 10)) }}>
          <b>{fmtDateTime(A.t0 + hover * A.stepMs)}</b><br />
          <span style={{ color: 'var(--sun-ink)' }}>{t('sun')} {s.sunEl.toFixed(1)}° {s.sunlit ? t('tl.tip.disc', { n: Math.round(s.sunFrac * 100) }) : t('tl.tip.hidden')}</span><br />
          <span style={{ color: 'var(--earth-ink)' }}>{t('earth')} {s.earthEl.toFixed(1)}° {s.earthLink ? t('tl.tip.link') : t('tl.tip.nolink')}</span>
        </div>
      )}
    </div>
  )
}
export { fmtDur }
