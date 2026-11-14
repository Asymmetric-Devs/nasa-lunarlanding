import { Modal } from './Modal'
import { useT, type Key } from '../i18n'
import { useStore } from '../store'

const STEPS: [Key, Key][] = [['guide.s1.h', 'guide.s1.p'], ['guide.s2.h', 'guide.s2.p'], ['guide.s3.h', 'guide.s3.p'], ['guide.s4.h', 'guide.s4.p']]
const TRY: Key[] = ['guide.t1', 'guide.t2', 'guide.t3', 'guide.t4', 'guide.t5', 'guide.t6']
const TERMS: [Key, Key][] = [['g.elev', 'g.elev.d'], ['g.az', 'g.az.d'], ['g.set', 'g.set.d'], ['g.link', 'g.link.d'], ['g.dark', 'g.dark.d']]

export function Guide() {
  const t = useT(); const setGuide = useStore((s) => s.setGuide)
  return (
    <Modal onClose={() => setGuide(false)} label={t('guide.title')} wide>
      <p className="eyebrow">{t('guide.eyebrow')}</p>
      <h2>{t('guide.title')}</h2>
      <p className="lead">{t('guide.lead')}</p>
      <div className="guide-steps">
        {STEPS.map(([h, p], i) => <div key={h}><span className="mono n">0{i + 1}</span><b>{t(h)}</b><p>{t(p)}</p></div>)}
      </div>
      <div className="guide-cols">
        <div className="guide-try"><h3>{t('guide.try')}</h3><ul>{TRY.map((k) => <li key={k}>{t(k)}</li>)}</ul><button className="btn" onClick={() => setGuide(false)}>{t('guide.go')}</button></div>
        <div><h3>{t('guide.keys')}</h3>
          <ul className="keys"><li><kbd>Space</kbd> {t('guide.k.play')}</li><li><kbd>←</kbd><kbd>→</kbd> {t('guide.k.step')}</li><li><kbd>Esc</kbd> {t('guide.k.esc')}</li></ul>
          <h3>{t('guide.terms')}</h3>
          <dl>{TERMS.map(([a, b]) => <div key={a}><dt>{t(a)}</dt><dd>{t(b)}</dd></div>)}</dl>
        </div>
      </div>
    </Modal>
  )
}
