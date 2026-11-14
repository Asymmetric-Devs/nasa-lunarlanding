import { create } from 'zustand'
import { defaultConfig, type Config } from './engine/analysis'
import { SITES, siteById } from './lib/sites'
import { setFormatLang } from './lib/format'

export type Lang = 'en' | 'es'
export type Theme = 'dark' | 'light'
export interface Requirements { darkLimitH: number; minSunPct: number; minLinkPct: number }
export type PresetId = 'rover' | 'lander' | 'crew' | 'custom'
export const PRESETS: Record<Exclude<PresetId, 'custom'>, Requirements> = {
  rover: { darkLimitH: 48, minSunPct: 60, minLinkPct: 30 },
  lander: { darkLimitH: 168, minSunPct: 30, minLinkPct: 30 },
  crew: { darkLimitH: 72, minSunPct: 70, minLinkPct: 50 },
}
export const defaultReq = PRESETS.lander

export interface Scenario { id: string; siteId: string | null; name: string; lat: number; lon: number; t: number }
export type View = 'navigator' | 'compare' | 'planner'
export type Tab = 'horizon' | 'map' | 'surface'
export const SPAN_OPTIONS = [{ d: 3, key: 'span.3d' }, { d: 14.77, key: 'span.day' }, { d: 29.53, key: 'span.month' }, { d: 365, key: 'span.year' }]

const DEFAULT_T = Date.UTC(2027, 0, 12, 0, 0)
let uid = 1
export const makeScenario = (siteId: string, t = DEFAULT_T): Scenario => { const s = siteById(siteId)!; return { id: `s${uid++}`, siteId, name: s.name, lat: s.lat, lon: s.lon, t } }
export const makeCustom = (lat: number, lon: number, t = DEFAULT_T): Scenario => ({ id: `s${uid++}`, siteId: null, name: '', lat, lon, t })

const ls = {
  get: (k: string): string | null => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}
const initialLang = (): Lang => { const s = ls.get('sunline.lang'); if (s === 'es' || s === 'en') return s; return (navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en' }
const initialTheme = (): Theme => { const s = ls.get('sunline.theme'); if (s === 'dark' || s === 'light') return s; return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark' }

interface State {
  intro: boolean
  view: View
  tab: Tab
  spanDays: number
  scenarios: Scenario[]
  activeId: string
  cursorH: number
  cfg: Config
  req: Requirements
  preset: PresetId
  playing: boolean
  lang: Lang
  theme: Theme
  guide: boolean
  tourSeen: boolean
  setIntro(v: boolean): void
  setView(v: View): void
  setTab(t: Tab): void
  setSpan(d: number): void
  setCursor(h: number): void
  setCfg(c: Partial<Config>): void
  setReq(r: Partial<Requirements>): void
  setPreset(p: Exclude<PresetId, 'custom'>): void
  setPlaying(p: boolean): void
  setLang(l: Lang): void
  setTheme(t: Theme): void
  setGuide(v: boolean): void
  select(siteId: string): void
  addCompare(s: Scenario): void
  removeScenario(id: string): void
  setActive(id: string): void
  updateScenario(id: string, p: Partial<Scenario>): void
  setAllDates(t: number): void
}

export const useStore = create<State>((set, get) => {
  const first = makeScenario('conn-ridge')
  const lang = initialLang()
  setFormatLang(lang)
  return {
    intro: true, view: 'navigator', tab: 'horizon', spanDays: 29.53, scenarios: [first], activeId: first.id, cursorH: 0, cfg: defaultConfig,
    req: defaultReq, preset: 'lander', playing: false, lang, theme: initialTheme(), guide: false, tourSeen: ls.get('sunline.tour') === '1',
    setIntro: (intro) => set({ intro }),
    setView: (view) => set({ view }),
    setTab: (tab) => set({ tab }),
    setSpan: (spanDays) => set({ spanDays, cursorH: 0 }),
    setCursor: (cursorH) => set({ cursorH }),
    setCfg: (c) => set({ cfg: { ...get().cfg, ...c } }),
    setReq: (r) => set({ req: { ...get().req, ...r }, preset: 'custom' }),
    setPreset: (p) => set({ req: PRESETS[p], preset: p }),
    setPlaying: (playing) => set({ playing }),
    setLang: (l) => { ls.set('sunline.lang', l); setFormatLang(l); set({ lang: l }) },
    setTheme: (t) => { ls.set('sunline.theme', t); set({ theme: t }) },
    setGuide: (guide) => { if (!guide) ls.set('sunline.tour', '1'); set({ guide, tourSeen: guide ? get().tourSeen : true }) },
    select: (siteId) => {
      const { scenarios, activeId } = get(); const s = siteById(siteId)!
      set({ scenarios: scenarios.map((x) => (x.id === activeId ? { ...x, siteId, name: s.name, lat: s.lat, lon: s.lon } : x)), cursorH: 0 })
    },
    addCompare: (s) => { const { scenarios } = get(); if (scenarios.length >= 4) return; set({ scenarios: [...scenarios, s] }) },
    removeScenario: (id) => { const { scenarios, activeId } = get(); if (scenarios.length <= 1) return; const rest = scenarios.filter((s) => s.id !== id); set({ scenarios: rest, activeId: activeId === id ? rest[0].id : activeId }) },
    setActive: (activeId) => set({ activeId, cursorH: 0 }),
    updateScenario: (id, p) => set({ scenarios: get().scenarios.map((s) => (s.id === id ? { ...s, ...p } : s)), cursorH: 0 }),
    setAllDates: (t) => set({ scenarios: get().scenarios.map((s) => ({ ...s, t })), cursorH: 0 }),
  }
})
export { SITES }
