import { describe, it, expect } from 'vitest'
import { sunCoveredByEarth, angularSeparation } from '../src/engine/eclipse'
import { skyState, type SkyState } from '../src/engine/ephemeris'
import { sampleAt, type Config } from '../src/engine/analysis'
import type { Horizon } from '../src/engine/terrain'

const flat = (deg: number): Horizon => ({ el: new Float32Array(360).fill(deg), dist: new Float32Array(360).fill(1), siteHeightM: 0, hasTerrain: true })
const cfg = (minEarthEl: number): Config => ({ minEarthEl, panel: 'vertical', mastM: 0 })

describe('Sun covered by the Earth (lunar eclipse seen from the Moon)', () => {
  it('geometry of two discs', () => {
    expect(sunCoveredByEarth(0.27, 0.95, 2)).toBe(0) // far apart
    expect(sunCoveredByEarth(0.27, 0.95, 0.3)).toBe(1) // Sun fully inside the Earth's disc
    expect(sunCoveredByEarth(0.27, 0.95, 0.68)).toBeCloseTo(1, 6) // internally tangent: last instant of totality
    const half = sunCoveredByEarth(1, 1, 1) // equal discs, centres one radius apart: lens = (2π/3 − √3/2) r²
    expect(half).toBeCloseTo((2 * Math.PI / 3 - Math.sqrt(3) / 2) / Math.PI, 9)
    expect(angularSeparation(10, 20, 10, 20)).toBeCloseTo(0, 6)
    expect(angularSeparation(0, 0, 90, 0)).toBeCloseTo(90, 9)
  })

  // Greatest eclipse (UT) from the NASA/GSFC eclipse catalogue (eclipse.gsfc.nasa.gov/OH/OH2028.html and OH2029.html;
  // 2028 Dec 31 from eclipsewise.com, which uses a slightly different ΔT). Seen from the Moon, the instant the Earth's
  // centre is closest to the Sun's centre is the same event.
  const catalogue: [string, number, boolean][] = [
    ['2028-12-31 total', Date.UTC(2028, 11, 31, 16, 52), true],
    ['2029-06-26 total', Date.UTC(2029, 5, 26, 3, 22), true],
    ['2029-12-20 total', Date.UTC(2029, 11, 20, 22, 42), true],
  ]
  for (const [name, tCat, total] of catalogue) {
    it(`${name}: closest approach within 6 min of the catalogue, Sun fully hidden at the sub-Earth point`, () => {
      let best = 99, tBest = 0
      for (let t = tCat - 3 * 3600e3; t <= tCat + 3 * 3600e3; t += 60e3) {
        const s: SkyState = skyState(t)
        const sep = Math.acos(Math.max(-1, Math.min(1, s.sunDir[0] * s.earthDir[0] + s.sunDir[1] * s.earthDir[1] + s.sunDir[2] * s.earthDir[2]))) * 180 / Math.PI
        if (sep < best) { best = sep; tBest = t }
      }
      expect(Math.abs(tBest - tCat) / 60e3).toBeLessThan(6)
      // near-side centre (lat 0, lon 0): Earth near the zenith, so the Sun is above the horizon too
      const x = sampleAt(skyState(tBest), 0, 0, flat(0), cfg(0))
      if (total) { expect(x.sunEclipsed).toBeGreaterThan(0.999); expect(x.sunFrac).toBeLessThan(0.001); expect(x.sunlit).toBe(false) }
    })
  }

  it('full Sun a few hours away from the eclipse', () => {
    const x = sampleAt(skyState(Date.UTC(2029, 5, 25, 20, 0)), 0, 0, flat(0), cfg(0))
    expect(x.sunEclipsed).toBe(0); expect(x.sunFrac).toBeGreaterThan(0.99)
  })
})

describe('Earth link: the antenna mask is an elevation above the local horizontal', () => {
  // Earth ~7° above the local horizontal (geocentric direction; ~6.7° from the surface after parallax)
  const sky: SkyState = { sunDir: [-1, 0, 0], earthDir: [Math.sin(7 * Math.PI / 180), Math.cos(7 * Math.PI / 180), 0], sunDistKm: 1.496e8, earthDistKm: 384400 }
  it('mask 5° is met by Earth at ~6.7°, whatever a lower terrain horizon does', () => {
    expect(sampleAt(sky, 0, 0, flat(3), cfg(5)).earthLink).toBe(true) // previously needed 3° + 5° = 8°
    expect(sampleAt(sky, 0, 0, flat(-2), cfg(5)).earthLink).toBe(true)
  })
  it('a mask above the Earth elevation blocks the link', () => {
    expect(sampleAt(sky, 0, 0, flat(0), cfg(8)).earthLink).toBe(false)
  })
  it('terrain that covers part of the Earth disc still blocks it', () => {
    expect(sampleAt(sky, 0, 0, flat(6.5), cfg(0)).earthLink).toBe(false)
    expect(sampleAt(sky, 0, 0, flat(6.5), cfg(0)).earthFrac).toBeLessThan(0.999)
  })
})
