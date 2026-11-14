import { Modal } from './Modal'
import { useT } from '../i18n'
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
    </Modal>
  )
}
