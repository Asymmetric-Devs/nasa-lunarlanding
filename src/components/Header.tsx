import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore, type View } from '../store'
import { useT } from '../i18n'
import { About } from './About'
import { Logo } from './Logo'

export function Header() {
  const { view, setView, scenarios, setIntro, lang, setLang, theme, setTheme, setGuide } = useStore()
  const t = useT()
  const [about, setAbout] = useState(false)
  const tabs: [View, string][] = [['navigator', t('nav.navigator')], ['compare', scenarios.length > 1 ? `${t('nav.compare')} · ${scenarios.length}` : t('nav.compare')], ['planner', t('nav.planner')]]
  return (
    <header className="top">
      <button className="brand" onClick={() => setIntro(true)} aria-label={t('nav.home')}>
        <Logo /><span>Sunline</span>
      </button>
      <nav className="views" role="tablist" aria-label={t('nav.views')}>
        {tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>{l}</button>)}
      </nav>
      <div className="top-right">
        <button className="ghost-link" onClick={() => setGuide(true)}>{t('nav.guide')}</button>
        <button className="ghost-link" onClick={() => setAbout(true)}>{t('nav.method')}</button>
        <div className="seg tiny" role="group" aria-label={t('nav.language')}>
          {(['en', 'es'] as const).map((l) => <button key={l} className={lang === l ? 'on' : ''} aria-pressed={lang === l} onClick={() => setLang(l)}>{l.toUpperCase()}</button>)}
        </div>
        <button className="iconbtn" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} aria-label={t('nav.theme')} title={t('nav.theme')}>
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>}
        </button>
      </div>
      {about && createPortal(<About onClose={() => setAbout(false)} />, document.body)}
    </header>
  )
}
