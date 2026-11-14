import type { Metrics } from '../engine/analysis'
import type { Horizon } from '../engine/terrain'
import { fmtDur } from '../lib/format'
import { useT, type Key } from '../i18n'
import type { Requirements } from '../store'
import { Info } from './Info'

export type Grade = 'go' | 'marginal' | 'no'

export function grade(m: Metrics, r: Requirements) {
  const power: Grade = m.sunlitPct >= r.minSunPct ? 'go' : m.sunlitPct >= r.minSunPct * 0.6 ? 'marginal' : 'no'
  const comms: Grade = m.linkPct >= r.minLinkPct ? 'go' : m.linkPct >= r.minLinkPct * 0.6 ? 'marginal' : 'no'
  const dark: Grade = m.longestDarkH <= r.darkLimitH ? 'go' : m.longestDarkH <= r.darkLimitH * 1.5 ? 'marginal' : 'no'
  const all = [power, comms, dark]
  const overall: Grade = all.includes('no') ? 'no' : all.includes('marginal') ? 'marginal' : 'go'
  return { power, comms, dark, overall }
}
export const GRADE_KEY: Record<Grade, Key> = { go: 'grade.go', marginal: 'grade.marginal', no: 'grade.no' }

function Row({ label, tip, value, sub, g, frac }: { label: string; tip: string; value: string; sub: string; g: Grade; frac: number }) {
  const t = useT()
  return (
    <div className="vrow">
      <div className="vrow-top"><span className="lbl">{label}<Info text={tip} /></span><span className={`pill ${g}`}>{t(GRADE_KEY[g])}</span></div>
      <div className="vrow-val mono">{value}</div>
      <div className="meter"><i className={g} style={{ width: `${Math.max(2, Math.min(100, frac * 100))}%` }} /></div>
      <div className="sub">{sub}</div>
    </div>
  )
}

export function Verdict({ m, req, hor }: { m: Metrics; req: Requirements; hor?: Horizon }) {
  const t = useT()
  const g = grade(m, req)
  const weakest: Key | null = g.overall === 'go' ? null : g.dark === 'no' || (g.dark === 'marginal' && g.power === 'go' && g.comms === 'go') ? 'v.dark' : g.power !== 'go' && (g.comms === 'go' || g.power === 'no') ? 'v.power' : g.comms !== 'go' ? 'v.comms' : 'v.power'
  return (
    <div className="verdict">
      <div className={`verdict-head ${g.overall}`}>
        <div><span className="lbl">{t('v.title')}</span><strong>{t(GRADE_KEY[g.overall])}</strong></div>
        <p>{weakest ? t('v.weak', { x: t(weakest) }) : t('v.allgood')}</p>
        {hor?.hasTerrain && hor.siteSlopeDeg !== null && (
          <p className="mono">{t('v.slope', { s: hor.siteSlopeDeg.toFixed(1), h: Math.round(hor.siteHeightM) })}{hor.siteSlopeDeg > 10 ? t('v.slope.steep') : ''}</p>
        )}
      </div>
      <Row label={t('v.power')} tip={t('v.power.tip')} value={t('v.sunlit', { n: m.sunlitPct.toFixed(0) })} g={g.power} frac={m.sunlitPct / 100}
        sub={t('v.power.sub', { out: m.meanPowerPct.toFixed(0), peak: m.peakSunEl.toFixed(1), min: req.minSunPct })} />
      <Row label={t('v.dark')} tip={t('v.dark.tip')} value={t('v.longest', { d: fmtDur(m.longestDarkH) })} g={g.dark} frac={1 - Math.min(1, m.longestDarkH / (req.darkLimitH * 2))}
        sub={t('v.dark.sub', { n: m.darkPeriods, lim: fmtDur(req.darkLimitH) })} />
      <Row label={t('v.comms')} tip={t('v.comms.tip')} value={t('v.link', { n: m.linkPct.toFixed(0) })} g={g.comms} frac={m.linkPct / 100}
        sub={t('v.comms.sub', { out: fmtDur(m.longestOutageH), w: m.linkWindows.length, min: req.minLinkPct })} />
    </div>
  )
}
