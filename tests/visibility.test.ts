import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { Terrain, computeHorizon, polarPixel } from '../src/engine/terrain'
import { buildSeries, analyze } from '../src/engine/analysis'

/** Sun and Earth visibility vs the LOLA average-visibility maps (AVGVISIB_85S_060M_201608[_EARTH]).
 *  Both maps count the share of timesteps with any fraction of the disc above the terrain. Needs data-raw/. */
const raw = new URL('../data-raw/', import.meta.url)
const MAP_N = 5058, MAP_C = 2528.5 // LINES and LINE/SAMPLE_PROJECTION_OFFSET of the labels (0-based pole index)
const DN_SCALE = 0.00004
const bodies = [
  { name: 'Sun', file: 'illum85/AVGVISIB_85S_060M_201608.IMG' },
  { name: 'Earth', file: 'illum85/AVGVISIB_85S_060M_201608_EARTH.IMG' },
] as const

/** 80 m polar DEM as int16 metres: the public int16 product (scripts/fetch_validation_data.sh) or the float one used by build_data.py. */
function loadTerrain() {
  const pub = new URL('dem80s80/LDEM_80S_80M.IMG', raw)
  let d16: Int16Array
  if (existsSync(pub)) {
    const f = readFileSync(pub); const dn = new Int16Array(f.buffer, f.byteOffset, f.byteLength / 2)
    d16 = new Int16Array(dn.length); for (let i = 0; i < dn.length; i++) d16[i] = Math.round(dn[i] * 0.5) // label: HEIGHT = DN * 0.5 m
  } else {
    const f = readFileSync(new URL('dem80s80/ldem_80s_80m_float.img', raw))
    const km = new Float32Array(f.buffer, f.byteOffset, f.byteLength / 4)
    d16 = new Int16Array(km.length); for (let i = 0; i < km.length; i++) d16[i] = Number.isFinite(km[i]) ? Math.round(km[i] * 1000) : -32768
  }
  const n = Math.round(Math.sqrt(d16.length))
  return new Terrain({ data: d16, n, res_m: 80, c: (n - 1) / 2, nodata: -32768 })
}

describe('visibility vs LOLA AVGVISIB_85S_060M (2009-07-13 .. 2013-07-18)', () => {
  for (const body of bodies) {
    const have = existsSync(new URL(body.file, raw))
    it.skipIf(!have)(body.name, () => {
      const terrain = loadTerrain()
      const v = readFileSync(new URL(body.file, raw))
      const map = new Int16Array(v.buffer, v.byteOffset, v.byteLength / 2)
      const t0 = Date.UTC(2009, 6, 13, 17), t1 = Date.UTC(2013, 6, 18, 14)
      const stepMs = 3600e3, N = Math.floor((t1 - t0) / stepMs)
      const series = buildSeries(t0, stepMs, N)
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
      const pts: { lat: number; lon: number; ref: number; mine: number }[] = []
      while (pts.length < 60) {
        const lat = -(85.3 + rnd() * 4.6), lon = rnd() * 360
        const p = polarPixel(lat, lon, 60, MAP_C); const ref = map[Math.round(p.row) * MAP_N + Math.round(p.col)] * DN_SCALE
        if (pts.length % 2 === 0 && !(ref > 0.02)) continue // every other point must have some visibility
        const hor = computeHorizon(terrain, lat, lon, 150)
        if (!hor.hasTerrain) continue
        const a = analyze(series, lat, lon, hor, { minEarthEl: 0, panel: 'vertical', mastM: 0 })
        const seen = body.name === 'Sun' ? a.samples.filter((x) => x.sunFrac > 0) : a.samples.filter((x) => x.earthFrac > 0)
        pts.push({ lat, lon, ref, mine: seen.length / a.samples.length })
      }
      const mean = (a: number[]) => a.reduce((x, y) => x + y) / a.length
      const mr = mean(pts.map((p) => p.ref)), mm = mean(pts.map((p) => p.mine))
      const cov = mean(pts.map((p) => (p.ref - mr) * (p.mine - mm)))
      const corr = cov / Math.sqrt(mean(pts.map((p) => (p.ref - mr) ** 2)) * mean(pts.map((p) => (p.mine - mm) ** 2)))
      const mae = mean(pts.map((p) => Math.abs(p.ref - p.mine)))
      console.log('VALIDATION', body.name, 'n', pts.length, 'corr', corr.toFixed(3), 'MAE', mae.toFixed(3), 'mean ref', mr.toFixed(3), 'mean mine', mm.toFixed(3))
      console.log(pts.slice(0, 12).map((p) => `${p.lat.toFixed(2)},${p.lon.toFixed(0)}: ref ${p.ref.toFixed(2)} mine ${p.mine.toFixed(2)}`).join('\n'))
      expect(corr).toBeGreaterThan(0.8)
    }, 600000)
  }
})
