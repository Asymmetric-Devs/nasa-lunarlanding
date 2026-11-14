import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadGrid } from '../src/engine/loader'
import { Terrain } from '../src/engine/terrain'
const dir = new URL('../public/data/', import.meta.url).pathname
const fetcher = async (u: string) => { const b = readFileSync(u); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer }
it('decodes delta terrain within quantisation error of the source DEM', async () => {
  const cm = JSON.parse(readFileSync(dir + 'core80.json', 'utf8')), pm = JSON.parse(readFileSync(dir + 'polar240.json', 'utf8'))
  const core = await loadGrid(dir.slice(0, -1), 'core80', cm, fetcher, cm.c)
  const cap = await loadGrid(dir.slice(0, -1), 'polar240', pm, fetcher, pm.center, 457.4)
  const t = new Terrain(core, cap)
  const mal = t.height(-85.9, 0), conn = t.height(-89.534, 209.948), hw = t.height(-87.5, -5)
  console.log('heights m', mal, conn, hw)
  expect(Math.abs(conn! - 1652)).toBeLessThan(40); expect(mal!).toBeGreaterThan(3500); expect(hw!).toBeLessThan(-2500)
  expect(t.height(-70, 0)).toBeNull()
})
