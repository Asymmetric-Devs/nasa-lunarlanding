import type { Analysis } from './analysis'
import type { Requirements } from '../store'

export interface WindowGrid {
  startMs: number[]; sun: Float32Array; link: Float32Array; dark: Float32Array; outage: Float32Array; power: Float32Array; score: Float32Array
}

function runs(flags: Uint8Array, want: number) {
  const out: [number, number][] = []; let st = -1
  for (let i = 0; i <= flags.length; i++) { const v = i < flags.length ? flags[i] : 1 - want; if (v === want && st < 0) st = i; if (v !== want && st >= 0) { out.push([st, i]); st = -1 } }
  return out
}
/** longest run (samples) of `ivs` clipped to [a,b) */
function longestIn(ivs: [number, number][], a: number, b: number, lo: { i: number }) {
  while (lo.i < ivs.length && ivs[lo.i][1] <= a) lo.i++
  let best = 0
  for (let k = lo.i; k < ivs.length && ivs[k][0] < b; k++) best = Math.max(best, Math.min(b, ivs[k][1]) - Math.max(a, ivs[k][0]))
  return best
}

/** Slide a mission window of `durH` hours over an hourly analysis, with daily start steps. */
export function slideWindows(an: Analysis, durH: number, stepH: number, req: Requirements, nStarts: number): WindowGrid {
  const S = an.samples, n = S.length, hr = an.stepMs / 3.6e6, dur = Math.round(durH / hr), step = Math.round(stepH / hr)
  const sun = new Uint8Array(n), link = new Uint8Array(n); const cs = new Float32Array(n + 1), cl = new Float32Array(n + 1), cp = new Float32Array(n + 1)
  for (let i = 0; i < n; i++) { sun[i] = S[i].sunlit ? 1 : 0; link[i] = S[i].earthLink ? 1 : 0; cs[i + 1] = cs[i] + sun[i]; cl[i + 1] = cl[i] + link[i]; cp[i + 1] = cp[i] + S[i].power }
  const darks = runs(sun, 0), outs = runs(link, 0)
  const m = Math.min(nStarts, Math.floor((n - dur) / step) + 1)
  const g: WindowGrid = { startMs: [], sun: new Float32Array(m), link: new Float32Array(m), dark: new Float32Array(m), outage: new Float32Array(m), power: new Float32Array(m), score: new Float32Array(m) }
  const lo1 = { i: 0 }, lo2 = { i: 0 }
  for (let k = 0; k < m; k++) {
    const a = k * step, b = a + dur
    g.startMs.push(an.t0 + a * an.stepMs)
    g.sun[k] = (100 * (cs[b] - cs[a])) / dur; g.link[k] = (100 * (cl[b] - cl[a])) / dur; g.power[k] = (100 * (cp[b] - cp[a])) / dur
    g.dark[k] = longestIn(darks, a, b, lo1) * hr; g.outage[k] = longestIn(outs, a, b, lo2) * hr
    g.score[k] = Math.min(1.5, g.sun[k] / req.minSunPct, g.link[k] / req.minLinkPct, req.darkLimitH / Math.max(g.dark[k], 1))
  }
  return g
}

/** top-N best, mutually separated windows */
export function bestWindows(g: WindowGrid, n: number, sepMs: number) {
  const idx = Array.from(g.score, (_, i) => i).sort((a, b) => g.score[b] - g.score[a])
  const out: number[] = []
  for (const i of idx) { if (out.every((j) => Math.abs(g.startMs[i] - g.startMs[j]) >= sepMs)) out.push(i); if (out.length >= n) break }
  return out
}
