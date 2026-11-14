import { skyState, localBasis, azEl, topoDir, angularRadiusDeg, SUN_RADIUS_KM, EARTH_RADIUS_KM, MOON_RADIUS_KM, type SkyState } from './ephemeris'
import { Horizon, horizonAt } from './terrain'
import { angularSeparation, sunCoveredByEarth } from './eclipse'

export const SOLAR_CONSTANT = 1361 // W/m2 at 1 AU
export const AU = 149597870.7

export interface Series { t0: number; stepMs: number; n: number; sky: SkyState[] }
const seriesCache = new Map<string, Series>()
export function buildSeries(t0: number, stepMs: number, n: number): Series {
  const key = `${t0}|${stepMs}|${n}`
  const hit = seriesCache.get(key); if (hit) return hit
  const sky: SkyState[] = new Array(n)
  for (let i = 0; i < n; i++) sky[i] = skyState(t0 + i * stepMs)
  const s = { t0, stepMs, n, sky }
  if (seriesCache.size > 8) seriesCache.delete(seriesCache.keys().next().value!)
  seriesCache.set(key, s); return s
}

export type PanelMode = 'horizontal' | 'vertical' | 'tracking'
export interface Config { minEarthEl: number; panel: PanelMode; mastM: number }
export const defaultConfig: Config = { minEarthEl: 5, panel: 'vertical', mastM: 0 }

export interface Sample {
  sunAz: number; sunEl: number; sunFrac: number; sunRadius: number
  earthAz: number; earthEl: number; earthFrac: number; earthRadius: number
  /** share of the Sun's disc hidden by the Earth (lunar eclipse seen from the Moon), 0..1 */
  sunEclipsed: number
  power: number // fraction of 1 AU solar constant on a unit panel
  earthLink: boolean; sunlit: boolean
}

/** fraction of a disc (radius r, centre elevation e) lying above a horizon at elevation h */
export function discFractionAbove(e: number, r: number, h: number) {
  const d = Math.max(-1, Math.min(1, (e - h) / r))
  return (Math.acos(-d) + d * Math.sqrt(1 - d * d)) / Math.PI
}

export function sampleAt(sky: SkyState, lat: number, lon: number, hor: Horizon, cfg: Config): Sample {
  const b = localBasis(lat, lon)
  const siteR = MOON_RADIUS_KM + (hor.siteHeightM + cfg.mastM) / 1000
  const s = azEl(topoDir(sky.sunDir, sky.sunDistKm, b, siteR), b)
  const e = azEl(topoDir(sky.earthDir, sky.earthDistKm, b, siteR), b)
  const sr = angularRadiusDeg(SUN_RADIUS_KM, sky.sunDistKm), er = angularRadiusDeg(EARTH_RADIUS_KM, sky.earthDistKm)
  const eclipsed = sunCoveredByEarth(sr, er, angularSeparation(s.az, s.el, e.az, e.el))
  const sFrac = discFractionAbove(s.el, sr, horizonAt(hor, s.az)) * (1 - eclipsed) // product: exact when either hiding is total or absent
  const eFrac = discFractionAbove(e.el, er, horizonAt(hor, e.az))
  const dist = sky.sunDistKm / AU
  const elRad = Math.max(0, s.el) * Math.PI / 180
  const geo = cfg.panel === 'horizontal' ? Math.sin(elRad) : cfg.panel === 'vertical' ? Math.cos(elRad) : 1
  const power = sFrac * geo / (dist * dist)
  // Antenna mask = minimum elevation above the LOCAL horizontal plane; terrain blocking is checked separately (whole disc must clear it).
  const earthLink = e.el >= cfg.minEarthEl && eFrac > 0.999
  return { sunAz: s.az, sunEl: s.el, sunFrac: sFrac, sunRadius: sr, earthAz: e.az, earthEl: e.el, earthFrac: eFrac, earthRadius: er, sunEclipsed: eclipsed, power, earthLink, sunlit: sFrac > 0 }
}

export interface Interval { start: number; end: number }
export interface Metrics {
  spanH: number
  sunlitPct: number; meanPowerPct: number; peakSunEl: number; meanSunEl: number
  longestDarkH: number; darkPeriods: number; longestLightH: number
  linkPct: number; longestOutageH: number; linkWindows: Interval[]
  bothPct: number // sun AND earth link simultaneously
  darkIntervals: Interval[]; lightIntervals: Interval[]
}

function intervals(flags: Uint8Array, t0: number, stepMs: number, want: 0 | 1): Interval[] {
  const out: Interval[] = []; let st = -1
  for (let i = 0; i <= flags.length; i++) {
    const v = i < flags.length ? flags[i] : 1 - want
    if (v === want && st < 0) st = i
    if (v !== want && st >= 0) { out.push({ start: t0 + st * stepMs, end: t0 + i * stepMs }); st = -1 }
  }
  return out
}

export interface Analysis { samples: Sample[]; metrics: Metrics; t0: number; stepMs: number }

export function analyze(series: Series, lat: number, lon: number, hor: Horizon, cfg: Config): Analysis {
  const n = series.n, samples: Sample[] = new Array(n)
  const sun = new Uint8Array(n), link = new Uint8Array(n), both = new Uint8Array(n)
  let pw = 0, sl = 0, lk = 0, bt = 0, peak = -90, selSum = 0
  for (let i = 0; i < n; i++) {
    const s = sampleAt(series.sky[i], lat, lon, hor, cfg); samples[i] = s
    sun[i] = s.sunlit ? 1 : 0; link[i] = s.earthLink ? 1 : 0; both[i] = sun[i] & link[i]
    pw += s.power; sl += sun[i]; lk += link[i]; bt += both[i]; if (s.sunEl > peak) peak = s.sunEl; selSum += s.sunEl
  }
  const dark = intervals(sun, series.t0, series.stepMs, 0), light = intervals(sun, series.t0, series.stepMs, 1)
  const outages = intervals(link, series.t0, series.stepMs, 0), windows = intervals(link, series.t0, series.stepMs, 1)
  const maxLen = (iv: Interval[]) => iv.reduce((m, x) => Math.max(m, (x.end - x.start) / 3.6e6), 0)
  return {
    samples, t0: series.t0, stepMs: series.stepMs,
    metrics: {
      spanH: (n * series.stepMs) / 3.6e6, sunlitPct: (100 * sl) / n, meanPowerPct: (100 * pw) / n,
      peakSunEl: peak, meanSunEl: selSum / n,
      longestDarkH: maxLen(dark), darkPeriods: dark.length, longestLightH: maxLen(light),
      linkPct: (100 * lk) / n, longestOutageH: maxLen(outages), linkWindows: windows, bothPct: (100 * bt) / n,
      darkIntervals: dark, lightIntervals: light,
    },
  }
}

/** Time until the next change of a boolean state, from index i (ms), or null if not within series. */
export function nextChange(flags: (i: number) => boolean, i: number, n: number, stepMs: number): number | null {
  const cur = flags(i)
  for (let k = i + 1; k < n; k++) if (flags(k) !== cur) return (k - i) * stepMs
  return null
}
