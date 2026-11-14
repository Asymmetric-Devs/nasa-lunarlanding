import { it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadGrid } from '../src/engine/loader'
import { Terrain, computeHorizon } from '../src/engine/terrain'
import { externalSiteLinks } from '../src/lib/links'
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

it('80 m site tile covers curated sites outside the 150 km polar core', async () => {
  const cm = JSON.parse(readFileSync(dir + 'core80.json', 'utf8'))
  const tm = JSON.parse(readFileSync(dir + 'tiles.json', 'utf8'))
  const core = await loadGrid(dir.slice(0, -1), 'core80', cm, fetcher, cm.c)
  const tile = await loadGrid(dir.slice(0, -1), 'tile_nobile-rim-2', { ...tm.tiles['nobile-rim-2'], nodata: -32768 }, fetcher, tm.center)
  expect(tile.res_m).toBe(80)
  expect(new Terrain(core).height(-84.202, 60.7)).toBeNull()
  const t = new Terrain(tile, core)
  expect(t.layers[0]).toBe(tile)
  expect(t.height(-84.202, 60.7)).not.toBeNull()
})

it('computes local terrain slope in degrees and exposes siteSlopeDeg on Horizon', async () => {
  const cm = JSON.parse(readFileSync(dir + 'core80.json', 'utf8')), pm = JSON.parse(readFileSync(dir + 'polar240.json', 'utf8'))
  const core = await loadGrid(dir.slice(0, -1), 'core80', cm, fetcher, cm.c)
  const cap = await loadGrid(dir.slice(0, -1), 'polar240', pm, fetcher, pm.center, 457.4)
  const t = new Terrain(core, cap)
  const sRidge = t.slope(-89.534, 209.948)
  const sMal = t.slope(-85.9, 0)
  expect(sRidge).not.toBeNull()
  expect(sMal).not.toBeNull()
  expect(sRidge!).toBeGreaterThanOrEqual(0)
  expect(sRidge!).toBeLessThan(45)
  expect(sMal!).toBeGreaterThanOrEqual(0)
  expect(sMal!).toBeLessThan(45)
  expect(t.slope(-70, 0)).toBeNull()
  const hor = computeHorizon(t, -89.534, 209.948, 50)
  expect(hor.siteSlopeDeg).toBe(sRidge)
})

it('builds contextual QuickMap and Moon Trek deep-links for polar and equatorial coordinates', () => {
  const polar = externalSiteLinks(-89.5, 209.9)
  expect(polar.quickmap).toContain('quickmap.lroc.im-ldi.com/?extent=')
  expect(polar.quickmap).toContain('&proj=27')
  expect(polar.moontrek).toContain('trek.nasa.gov/moon/#v=0.1&')
  expect(polar.moontrek).toContain('p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120')
  expect(polar.moontrek).toMatch(/x=-\d+&y=-\d+/)

  const eq = externalSiteLinks(0.67, 23.47)
  expect(eq.quickmap).toContain('&proj=16')
  expect(eq.quickmap).toMatch(/extent=\d+,\d+,\d+,\d+/)
  expect(eq.moontrek).toContain('p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903')
  expect(eq.moontrek).toContain('x=23.4700&y=0.6700')
})
