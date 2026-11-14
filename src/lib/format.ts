const pad = (n: number, w = 2) => String(n).padStart(w, '0')
let lang: 'en' | 'es' = 'en'
export const setFormatLang = (l: 'en' | 'es') => { lang = l }
export const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const MONTHS_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const months = () => (lang === 'es' ? MONTHS_ES : MONTHS_EN)
export function fmtDate(ms: number) { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
export function fmtTime(ms: number) { const d = new Date(ms); return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
export function fmtDateTime(ms: number) { return `${fmtDate(ms)} ${fmtTime(ms)} UTC` }
export function fmtShort(ms: number) { const d = new Date(ms); return `${d.getUTCDate()} ${months()[d.getUTCMonth()]}` }
export function toInputValue(ms: number) { return `${fmtDate(ms)}T${fmtTime(ms)}` }
export function fromInputValue(v: string) { const t = Date.parse(v + ':00Z'); return Number.isNaN(t) ? null : t }
/** hours -> "3 d 4 h" / "5 h 20 m" (units are identical in EN/ES) */
export function fmtDur(h: number | null, empty = '—') {
  if (h === null || !Number.isFinite(h)) return empty
  if (h < 1 / 60) return '0 m'
  if (h < 1) return `${Math.round(h * 60)} m`
  if (h < 48) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm === 60 ? `${hh + 1} h` : mm ? `${hh} h ${mm} m` : `${hh} h` }
  const d = Math.floor(h / 24), hh = Math.round(h - d * 24); return hh === 24 ? `${d + 1} d` : hh ? `${d} d ${hh} h` : `${d} d`
}
export const fmtDeg = (v: number, p = 1) => `${v.toFixed(p)}°`
export const fmtLat = (v: number) => `${Math.abs(v).toFixed(3)}°${v < 0 ? 'S' : 'N'}`
export const fmtLon = (v: number) => { const w = ((v + 540) % 360) - 180; return `${Math.abs(w).toFixed(3)}°${w < 0 ? (lang === 'es' ? 'O' : 'W') : 'E'}` }
export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))
export const compass = (az: number) => (lang === 'es' ? ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'] : ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'])[Math.round(az / 22.5) % 16]
