import { Modal } from './Modal'
import { useT } from '../i18n'
const TOOLS = [
  { k: 'quickmap', href: 'https://quickmap.lroc.im-ldi.com/' },
  { k: 'trek', href: 'https://trek.nasa.gov/moon/' },
  { k: 'horizons', href: 'https://ssd.jpl.nasa.gov/horizons/' },
  { k: 'csa', href: 'https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/' },
] as const
export function About({ onClose }: { onClose(): void }) {
  const t = useT()
  return (
    <Modal onClose={onClose} label={t('about.title')}>
      <p className="eyebrow">{t('about.eyebrow')}</p>
      <h2>{t('about.title')}</h2>
      <h3>{t('about.eph.h')}</h3><p>{t('about.eph.p')}</p><p>{t('about.eph.v')}</p>
      <h3>{t('about.ter.h')}</h3><p>{t('about.ter.p')}</p><p>{t('about.ter.v')}</p>
      <h3>{t('about.lim.h')}</h3><p>{t('about.lim.p')}</p>
      <h3>{t('about.src.h')}</h3><p>{t('about.src.p')}</p>
      <h3>{t('about.go.h')}</h3><p>{t('about.go.p')}</p>
      <ul className="about-tools">
        {TOOLS.map((x) => (
          <li key={x.k}>
            <a href={x.href} target="_blank" rel="noopener noreferrer">{t(`about.go.${x.k}` as never)} ↗</a>
            <span>{t(`about.go.${x.k}.d` as never)}</span>
          </li>
        ))}
      </ul>
      <p className="about-note">{t('about.go.note')}</p>
    </Modal>
  )
}
