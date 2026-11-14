import raw from '../data/sites.json'
export interface Site { id: string; name: string; group: string; lat: number; lon: number; conf: 'published' | 'mission' | 'approx'; note: string; note_es: string }
export const SITES = raw as Site[]
export const siteById = (id: string) => SITES.find((s) => s.id === id)
export const GROUPS = ['Artemis III region', 'Science target', 'CLPS / commercial', 'Other programs', 'Apollo']
