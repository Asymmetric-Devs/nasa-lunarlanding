import { it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { en } from '../src/locales/en'
import { es } from '../src/locales/es'

const dir = fileURLToPath(new URL('../src/', import.meta.url)).replace(/\\/g, '/')
const files: string[] = []
const walk = (d: string) => { for (const e of readdirSync(d, { withFileTypes: true })) { const p = d + e.name; if (e.isDirectory()) walk(p + '/'); else if (/\.(tsx?)$/.test(e.name) && !p.includes('/locales/')) files.push(p) } }
walk(dir)

it('EN and ES define exactly the same keys', () => {
  expect(Object.keys(es).sort()).toEqual(Object.keys(en).sort())
})
it('every key used in source exists, and no translation is empty', () => {
  const used = new Set<string>()
  for (const f of files) { const s = readFileSync(f, 'utf8'); for (const m of s.matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)) used.add(m[1]); for (const m of s.matchAll(/['"]((?:guide|g|grp|set|span|cmp|pl|v|ro|rail|date|tl|map|surf|intro|about|hint|nav|tab|grade|sens|pano|ext)\.[\w.]+)['"]/g)) used.add(m[1]) }
  for (let n = 1; n <= 4; n++) for (const k of ['k', 'h', 'p']) used.add(`intro.s${n}.${k}`)
  const missing = [...used].filter((k) => !(k in en))
  expect(missing).toEqual([])
  for (const [k, v] of Object.entries({ ...en })) expect(v.length, k).toBeGreaterThan(0)
  for (const [k, v] of Object.entries(es)) expect(v.length, k).toBeGreaterThan(0)
})
it('placeholders match between languages', () => {
  const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join()
  for (const k of Object.keys(en) as (keyof typeof en)[]) expect(ph(es[k]), k).toBe(ph(en[k]))
})
