import { useEffect, type ReactNode } from 'react'
export function Modal({ onClose, label, children, wide }: { onClose(): void; label: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const f = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f) }, [onClose])
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={label} onClick={onClose}>
      <div className={`modal-card ${wide ? 'wide' : ''}`} onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={onClose} aria-label="×">×</button>
        <div className="modal-scroll">{children}</div>
      </div>
    </div>
  )
}
