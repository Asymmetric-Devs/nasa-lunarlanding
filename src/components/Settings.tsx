import { useState } from 'react'
import { useStore, type PresetId } from '../store'
import { fmtDur } from '../lib/format'
import { useT, type Key } from '../i18n'
import { Info } from './Info'
import { earthMaskWarning } from './Verdict'

const PRESET_KEYS: [Exclude<PresetId, 'custom'>, Key][] = [['rover', 'set.p.rover'], ['lander', 'set.p.lander'], ['crew', 'set.p.crew']]

export function Settings({ peakEarthEl }: { peakEarthEl?: number }) {
  const { cfg, setCfg, req, setReq, preset, setPreset } = useStore()
  const t = useT()
  const [open, setOpen] = useState(false)
  const maskWarn = earthMaskWarning(t, cfg.minEarthEl, peakEarthEl)
  return (
    <section className="settings">
      <button className="disclose" aria-expanded={open} onClick={() => setOpen(!open)}><span className="lbl">{t('set.title')}</span><span className="chev" aria-hidden>{open ? '–' : '+'}</span></button>
      <div className="chips" role="group" aria-label={t('set.profile')}>
        {PRESET_KEYS.map(([k, l]) => <button key={k} className={`chip ${preset === k ? 'on' : ''}`} aria-pressed={preset === k} onClick={() => setPreset(k)}>{t(l)}</button>)}
        {preset === 'custom' && <span className="chip on">{t('set.p.custom')}</span>}
      </div>
      {!open && maskWarn && <div className="v-warn">{maskWarn}</div>}
      {open && (
        <div className="set-body">
          <label className="field"><span>{t('set.dark')}<Info text={t('set.dark.tip')} /> <b className="mono">{fmtDur(req.darkLimitH)}</b></span>
            <input type="range" min={12} max={360} step={12} value={req.darkLimitH} onChange={(e) => setReq({ darkLimitH: +e.target.value })} /></label>
          <label className="field"><span>{t('set.sun')} <b className="mono">{req.minSunPct}%</b></span>
            <input type="range" min={5} max={95} step={5} value={req.minSunPct} onChange={(e) => setReq({ minSunPct: +e.target.value })} /></label>
          <label className="field"><span>{t('set.link')} <b className="mono">{req.minLinkPct}%</b></span>
            <input type="range" min={5} max={95} step={5} value={req.minLinkPct} onChange={(e) => setReq({ minLinkPct: +e.target.value })} /></label>
          <label className="field"><span>{t('set.mask')}<Info text={t('set.mask.tip')} /> <b className="mono">{cfg.minEarthEl}°</b></span>
            <input type="range" min={0} max={15} step={1} value={cfg.minEarthEl} onChange={(e) => setCfg({ minEarthEl: +e.target.value })} />
            {maskWarn && <span className="v-warn">{maskWarn}</span>}</label>
          <label className="field"><span>{t('set.mast')}<Info text={t('set.mast.tip')} /> <b className="mono">{cfg.mastM} m</b></span>
            <input type="range" min={0} max={20} step={1} value={cfg.mastM} onChange={(e) => setCfg({ mastM: +e.target.value })} /></label>
          <div className="field"><span>{t('set.array')}<Info text={t('set.array.tip')} /></span>
            <div className="seg small">
              {([['horizontal', 'set.flat'], ['vertical', 'set.vert'], ['tracking', 'set.track']] as const).map(([k, l]) => <button key={k} className={cfg.panel === k ? 'on' : ''} onClick={() => setCfg({ panel: k })}>{t(l)}</button>)}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
