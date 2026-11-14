import { useStore, type Scenario } from './store'
import { en } from './locales/en'
import { es } from './locales/es'

export type Key = keyof typeof en
const dicts = { en, es } as const
export type TFn = (k: Key, vars?: Record<string, string | number>) => string

export function translate(lang: 'en' | 'es', k: Key, vars?: Record<string, string | number>) {
  let s: string = dicts[lang][k] ?? en[k] ?? k
  if (vars) for (const [a, b] of Object.entries(vars)) s = s.replaceAll(`{${a}}`, String(b))
  return s
}
export function useT(): TFn {
  const lang = useStore((s) => s.lang)
  return (k, vars) => translate(lang, k, vars)
}
export const scName = (sc: Pick<Scenario, 'siteId' | 'name'>, t: TFn) => (sc.siteId ? sc.name : sc.name || t('custom.point'))
