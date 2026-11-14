import { useMemo } from 'react'
import type { Result } from '../hooks/useAnalysis'
import type { Sample } from '../engine/analysis'
import { compass, fmtDur } from '../lib/format'
import { useT } from '../i18n'
import { Info } from './Info'

function nextFlip(S: Sample[], i: number, pick: (s: Sample) => boolean, stepH: number) {
  const cur = pick(S[i])
  for (let k = i + 1; k < S.length; k++) if (pick(S[k]) !== cur) return { state: cur, h: (k - i) * stepH }
  return { state: cur, h: null as number | null }
}

export function Readouts({ res, now, cursorH }: { res: Result; now: Sample; cursorH: number }) {
  const t = useT()
  const A = res.analysis, stepH = A.stepMs / 3.6e6
  const i = Math.min(A.samples.length - 1, Math.max(0, Math.round(cursorH / stepH)))
  const sun = useMemo(() => nextFlip(A.samples, i, (s) => s.sunlit, stepH), [A, i])
  const earth = useMemo(() => nextFlip(A.samples, i, (s) => s.earthLink, stepH), [A, i])
  const horizonSun = res.hor.el[Math.round(now.sunAz) % 360], horizonEarth = res.hor.el[Math.round(now.earthAz) % 360]
  const tail = (h: number | null) => (h === null ? `> ${fmtDur((A.samples.length - i) * stepH)}` : fmtDur(h))
  return (
    <div className="readouts">
      <div className="ro sun">
        <div className="ro-head"><i className="dot sun" /><span className="lbl">{t('sun')}</span><span className="mono ro-state">{now.sunlit ? t('ro.disc', { n: Math.round(now.sunFrac * 100) }) : t('ro.hidden')}</span></div>
        <div className="ro-big mono">{now.sunEl.toFixed(2)}°<small> {t('ro.elev')}</small></div>
        <dl>
          <div><dt>{t('ro.az')}</dt><dd className="mono">{now.sunAz.toFixed(1)}° {compass(now.sunAz)}</dd></div>
          <div><dt>{t('ro.hor')}<Info text={t('ro.hor.tip')} /></dt><dd className="mono">{horizonSun.toFixed(2)}°</dd></div>
          <div className="hl"><dt>{sun.state ? t('ro.sunset') : t('ro.sunrise')}</dt><dd className="mono">{tail(sun.h)}</dd></div>
        </dl>
      </div>
      <div className="ro earth">
        <div className="ro-head"><i className="dot earth" /><span className="lbl">{t('earth')}</span><span className="mono ro-state">{now.earthLink ? t('ro.link') : now.earthEl > 0 ? t('ro.masked') : t('ro.below')}</span></div>
        <div className="ro-big mono">{now.earthEl.toFixed(2)}°<small> {t('ro.elev')}</small></div>
        <dl>
          <div><dt>{t('ro.az')}</dt><dd className="mono">{now.earthAz.toFixed(1)}° {compass(now.earthAz)}</dd></div>
          <div><dt>{t('ro.hor')}</dt><dd className="mono">{horizonEarth.toFixed(2)}°</dd></div>
          <div className="hl"><dt>{earth.state ? t('ro.earthset') : t('ro.earthrise')}</dt><dd className="mono">{tail(earth.h)}</dd></div>
        </dl>
      </div>
    </div>
  )
}
