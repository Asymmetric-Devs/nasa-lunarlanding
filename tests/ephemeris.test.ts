import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { skyState, localBasis, azEl, topoDir } from '../src/engine/ephemeris'

function load(file: string) {
  const txt = readFileSync(new URL(`./fixtures/${file}`, import.meta.url), 'utf8')
  const body = txt.split('$$SOE')[1].split('$$EOE')[0].trim().split('\n')
  return body.map((l) => { const p = l.split(','); return { date: new Date(p[0].trim().replace(/(\d{4})-(\w{3})-(\d{2}) (.*)/, '$2 $3, $1 $4 UTC')), az: +p[3], el: +p[4] } })
}
const cases: [string, number, number][] = [['ridge', -89.45, 222.7], ['ap11', 0.6741, 23.4729]]
describe('Sun/Earth az-el vs JPL Horizons (DE441, MEAN_ME)', () => {
  for (const [name, lat, lon] of cases) for (const [body, f] of [['sun', 10], ['earth', 399]] as const) {
    it(`${name} ${body}`, () => {
      const rows = load(`${name}.${f}.txt`); let maxEl = 0, maxAz = 0
      for (const r of rows) {
        const s = skyState(r.date); const b = localBasis(lat, lon); const a = azEl(body === 'sun' ? topoDir(s.sunDir, s.sunDistKm, b) : topoDir(s.earthDir, s.earthDistKm, b), b)
        maxEl = Math.max(maxEl, Math.abs(a.el - r.el))
        if (Math.abs(r.el) < 85) { let da = Math.abs(a.az - r.az); if (da > 180) da = 360 - da; maxAz = Math.max(maxAz, da) }
      }
      console.log(name, body, 'max |dEl|', maxEl.toFixed(4), 'max |dAz|', maxAz.toFixed(4))
      expect(maxEl).toBeLessThan(0.05)
    })
  }
})
