/** Small ⓘ with an accessible tooltip (hover/focus). */
export function Info({ text }: { text: string }) {
  return <span className="info" tabIndex={0} role="note" aria-label={text}>i<span className="info-tip" role="tooltip">{text}</span></span>
}
