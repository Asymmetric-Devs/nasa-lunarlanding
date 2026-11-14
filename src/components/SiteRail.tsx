import { useMemo, useState } from 'react'
import { SITES, GROUPS } from '../lib/sites'
import { useStore, makeScenario, makeCustom } from '../store'
import { fmtLat, fmtLon } from '../lib/format'
import { useT, type Key } from '../i18n'

const GKEY: Record<string, Key> = { 'Artemis III region': 'grp.artemis', 'Science target': 'grp.science', 'CLPS / commercial': 'grp.clps', 'Other programs': 'grp.other', Apollo: 'grp.apollo' }

export function SiteRail() {
  const { scenarios, activeId, select, addCompare, updateScenario, lang } = useStore()
  const t = useT()
  const active = scenarios.find((s) => s.id === activeId)!
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<Record<string, boolean>>({ 'Artemis III region': true, 'CLPS / commercial': true })
  const [custom, setCustom] = useState(false)
  const [latS, setLat] = useState('-89.45'), [lonS, setLon] = useState('222.7')
  const err = useMemo(() => { const la = parseFloat(latS), lo = parseFloat(lonS); return Number.isNaN(la) || Number.isNaN(lo) || Math.abs(la) > 90 || Math.abs(lo) > 360 ? t('rail.err') : '' }, [latS, lonS, lang])
  const query = q.trim().toLowerCase()
  const list = SITES.filter((s) => !query || s.name.toLowerCase().includes(query) || t(GKEY[s.group]).toLowerCase().includes(query))
  const inCompare = (id: string) => scenarios.some((s) => s.siteId === id)
  return (
    <aside className="rail">
      <div className="rail-head">
        <span className="lbl">{t('rail.title')}</span>
        <input className="search" placeholder={t('rail.search')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('rail.search')} />
      </div>
      <div className="rail-list">
        {GROUPS.map((g) => { const items = list.filter((s) => s.group === g); if (!items.length) return null; const isOpen = query ? true : !!open[g]; return (
          <section key={g}>
            <button className="grp" aria-expanded={isOpen} onClick={() => setOpen({ ...open, [g]: !isOpen })}><span>{t(GKEY[g])}</span><span className="mono cnt">{items.length}</span><span className="chev" aria-hidden>{isOpen ? '–' : '+'}</span></button>
            {isOpen && items.map((s) => (
              <div key={s.id} className={`site ${active.siteId === s.id ? 'on' : ''}`}>
                <button className="site-main" onClick={() => select(s.id)} title={lang === 'es' ? s.note_es : s.note}>
                  <span className="site-name">{s.name}{s.conf === 'approx' && <i className="approx" title={t('rail.approx')}>~</i>}</span>
                  <span className="site-coord mono">{fmtLat(s.lat)} {fmtLon(s.lon)}</span>
                </button>
                <button className={`site-add ${inCompare(s.id) ? 'in' : ''}`} aria-label={t('rail.add', { n: s.name })} title={inCompare(s.id) ? t('rail.in') : t('rail.addtip')}
                  onClick={() => { if (!inCompare(s.id)) addCompare(makeScenario(s.id, active.t)) }} disabled={inCompare(s.id) || scenarios.length >= 4}>
                  {inCompare(s.id) ? '✓' : '+'}
                </button>
              </div>
            ))}
          </section>) })}
      </div>
      <div className="rail-custom">
        <button className="disclose" aria-expanded={custom} onClick={() => setCustom(!custom)}><span className="lbl">{t('rail.custom')}</span><span className="chev" aria-hidden>{custom ? '–' : '+'}</span></button>
        {custom && <>
          <div className="coords">
            <label>{t('rail.lat')}<input className="mono" value={latS} onChange={(e) => setLat(e.target.value)} inputMode="decimal" /></label>
            <label>{t('rail.lon')}<input className="mono" value={lonS} onChange={(e) => setLon(e.target.value)} inputMode="decimal" /></label>
          </div>
          {err && <p className="err">{err}</p>}
          <div className="row">
            <button className="btn" disabled={!!err} onClick={() => updateScenario(active.id, { siteId: null, name: '', lat: parseFloat(latS), lon: parseFloat(lonS) })}>{t('rail.use')}</button>
            <button className="btn ghost" disabled={!!err || scenarios.length >= 4} onClick={() => addCompare(makeCustom(parseFloat(latS), parseFloat(lonS), active.t))}>{t('rail.addcmp')}</button>
          </div>
          <p className="hint">{t('rail.hint')}</p>
        </>}
      </div>
    </aside>
  )
}
