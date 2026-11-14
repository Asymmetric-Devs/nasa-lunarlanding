import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadGrid } from '../src/engine/loader'
import { Terrain } from '../src/engine/terrain'
const dir = fileURLToPath(new URL('../public/data/', import.meta.url)).replace(/\\/g, '/')
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

it('240 m cap and 80 m core are registered on the same pole pixel', async () => {
  const cm = JSON.parse(readFileSync(dir + 'core80.json', 'utf8')), pm = JSON.parse(readFileSync(dir + 'polar240.json', 'utf8'))
  const core = new Terrain(await loadGrid(dir.slice(0, -1), 'core80', cm, fetcher, cm.c))
  const cap = new Terrain(await loadGrid(dir.slice(0, -1), 'polar240', pm, fetcher, pm.center, 457.4))
  let sum = 0, k = 0
  for (let y = -140; y <= 140; y += 0.9) for (let x = -140; x <= 140; x += 0.9) {
    const a = core.heightXY(x, y), b = cap.heightXY(x, y); if (a === null || b === null) continue
    sum += (a - b) ** 2; k++
  }
  const rms = Math.sqrt(sum / k)
  console.log('cap vs core RMS m', rms.toFixed(2), 'n', k)
  // a half-pixel (120 m) offset of the cap gives ~25 m here; aligned grids give ~4 m
  expect(k).toBeGreaterThan(50000); expect(rms).toBeLessThan(8)
})
