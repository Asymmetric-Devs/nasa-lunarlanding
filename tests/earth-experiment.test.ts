import { it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { Terrain, computeHorizon, polarPixel, type PolarGrid } from '../src/engine/terrain'
import { buildSeries, analyze } from '../src/engine/analysis'

const raw = new URL('../data-raw/', import.meta.url)
const have = existsSync(new URL('illum85/AVGVISIB_85S_060M_201608_EARTH.IMG', raw))
const R = 1737.4
it.skipIf(!have)('EARTH visibility vs LOLA AVGVISIB_85S_060M_EARTH (2009-07-13 .. 2013-07-18)', () => {
  const f = readFileSync(new URL('dem80s80/ldem_80s_80m_float.img', raw))
  const km = new Float32Array(f.buffer, f.byteOffset, f.byteLength / 4)
  const d16 = new Int16Array(km.length); for (let i = 0; i < km.length; i++) d16[i] = Number.isFinite(km[i]) ? Math.round(km[i] * 1000) : -32768
  const n = Math.round(Math.sqrt(km.length))
  const terrain = new Terrain({ data: d16, n, res_m: 80, c: (n - 1) / 2, nodata: -32768 })
  const v = readFileSync(new URL('illum85/AVGVISIB_85S_060M_201608_EARTH.IMG', raw))
  const map = new Int16Array(v.buffer, v.byteOffset, v.byteLength / 2); const mn = 5058, mc = 2527.5
  const t0 = Date.UTC(2009, 6, 13, 17), t1 = Date.UTC(2013, 6, 18, 14)
  const stepMs = 3600e3, N = Math.floor((t1 - t0) / stepMs)
  const series = buildSeries(t0, stepMs, N)
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  const pts: { lat: number; lon: number; ref: number; mine: number }[] = []
  while (pts.length < 60) {
    const lat = -(85.3 + rnd() * 4.6), lon = rnd() * 360
    const p = polarPixel(lat, lon, 60, mc); const ref = map[Math.round(p.row) * mn + Math.round(p.col)] * 0.00004
    if (!(pts.length % 2 === 0 ? ref > 0.02 : true)) continue
    const hor = computeHorizon(terrain, lat, lon, 150)
    if (!hor.hasTerrain) continue
    const a = analyze(series, lat, lon, hor, { minEarthEl: 0, panel: 'vertical', mastM: 0 })
    pts.push({ lat, lon, ref, mine: a.samples.filter((x) => x.earthFrac > 0).length / a.samples.length })
  }
  const mean = (a: number[]) => a.reduce((x, y) => x + y) / a.length
  const mr = mean(pts.map((p) => p.ref)), mm = mean(pts.map((p) => p.mine))
  const cov = mean(pts.map((p) => (p.ref - mr) * (p.mine - mm)))
  const corr = cov / Math.sqrt(mean(pts.map((p) => (p.ref - mr) ** 2)) * mean(pts.map((p) => (p.mine - mm) ** 2)))
  const mae = mean(pts.map((p) => Math.abs(p.ref - p.mine)))
  console.log('VALIDATION n', pts.length, 'corr', corr.toFixed(3), 'MAE', mae.toFixed(3), 'mean ref', mr.toFixed(3), 'mean mine', mm.toFixed(3))
  console.log(pts.slice(0, 12).map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(0)}: ref ${p.ref.toFixed(2)} mine ${p.mine.toFixed(2)}`).join('\n'))
  expect(corr).toBeGreaterThan(0.8)
}, 600000)
