import { useStore, SPAN_OPTIONS, type Scenario } from '../store'
import { fromInputValue, toInputValue } from '../lib/format'
import { useT } from '../i18n'

const DAY = 86400000
export function DateControl({ sc, onChange, compact }: { sc: Scenario; onChange: (t: number) => void; compact?: boolean }) {
  const t = useT()
  const step = (d: number) => () => onChange(sc.t + d * DAY)
  return (
    <div className="datectl">
      <span className="lbl">{t('date.landing')}</span>
      {!compact && <button className="step" onClick={step(-29.53)} title={t('date.minusmo')}>−1 {t('date.mo')}</button>}
      <button className="step" onClick={step(-1)}>−1 d</button>
      <input type="datetime-local" className="mono" value={toInputValue(sc.t)} onChange={(e) => { const v = fromInputValue(e.target.value); if (v !== null) onChange(v) }} aria-label={t('date.aria')} />
      <span className="utc mono">UTC</span>
      <button className="step" onClick={step(1)}>+1 d</button>
      {!compact && <button className="step" onClick={step(29.53)} title={t('date.plusmo')}>+1 {t('date.mo')}</button>}
    </div>
  )
}

export function SpanControl() {
  const { spanDays, setSpan } = useStore(); const t = useT()
  return (
    <div className="seg" role="tablist" aria-label={t('span.aria')}>
      {SPAN_OPTIONS.map((o) => <button key={o.d} role="tab" aria-selected={Math.abs(spanDays - o.d) < 0.01} className={Math.abs(spanDays - o.d) < 0.01 ? 'on' : ''} onClick={() => setSpan(o.d)}>{t(o.key as any)}</button>)}
    </div>
  )
}
