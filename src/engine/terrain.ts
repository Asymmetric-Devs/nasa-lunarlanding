import { MOON_RADIUS_KM, D2R, R2D } from './ephemeris'

export interface PolarGrid { data: Int16Array; n: number; res_m: number; c: number; nodata: number; x0?: number; y0?: number }

/** South polar stereographic (true at pole). Returns fractional col,row in the grid whose pole pixel is at (c,c). */
export function polarPixel(lat: number, lon: number, res_m: number, c: number) {
  const rho = 2 * MOON_RADIUS_KM * Math.tan(((90 + lat) * D2R) / 2) * 1000
  return { col: c + (rho * Math.sin(lon * D2R)) / res_m, row: c - (rho * Math.cos(lon * D2R)) / res_m }
}

function bilinear(g: PolarGrid, col: number, row: number): number | null {
  const lc = col - (g.x0 ?? 0), lr = row - (g.y0 ?? 0)
  const i = Math.floor(lc), j = Math.floor(lr)
  if (i < 0 || j < 0 || i >= g.n - 1 || j >= g.n - 1) return null
  const d = g.data, n = g.n
  const a = d[j * n + i], b = d[j * n + i + 1], e = d[(j + 1) * n + i], f = d[(j + 1) * n + i + 1]
  if (a === g.nodata || b === g.nodata || e === g.nodata || f === g.nodata) return null
  const fx = lc - i, fy = lr - j
  return (a * (1 - fx) + b * fx) * (1 - fy) + (e * (1 - fx) + f * fx) * fy
}

/** Layered elevation sampler, finest first (site tile 80 m -> polar core 80 m -> cap 240 m). Heights in metres, null off-grid. */
export class Terrain {
  layers: PolarGrid[]
  constructor(...layers: (PolarGrid | null | undefined)[]) { this.layers = layers.filter(Boolean) as PolarGrid[] }
  get covers() { return this.layers.length > 0 }
  /** Height at polar-map coordinates (km east, km "down" rows) relative to the pole. */
  heightXY(xKm: number, yKm: number): number | null {
    for (const g of this.layers) {
      const h = bilinear(g, g.c + (xKm * 1000) / g.res_m, g.c + (yKm * 1000) / g.res_m)
      if (h !== null) return h
    }
    return null
  }
  height(lat: number, lon: number): number | null {
    if (lat > -75) return null
    for (const g of this.layers) {
      const p = polarPixel(lat, lon, g.res_m, g.c)
      const h = bilinear(g, p.col, p.row)
      if (h !== null) return h
    }
    return null
  }
  /** Local terrain slope (deg, 0 = flat) from central differences across 1 grid cell of the finest layer covering (lat, lon). */
  slope(lat: number, lon: number): number | null {
    if (lat > -75) return null
    for (const g of this.layers) {
      const p = polarPixel(lat, lon, g.res_m, g.c)
      const h0 = bilinear(g, p.col, p.row)
      if (h0 === null) continue
      const hl = bilinear(g, p.col - 0.5, p.row), hr = bilinear(g, p.col + 0.5, p.row)
      const hu = bilinear(g, p.col, p.row - 0.5), hd = bilinear(g, p.col, p.row + 0.5)
      const hx = hl !== null && hr !== null ? hr - hl : hr !== null ? (hr - h0) * 2 : hl !== null ? (h0 - hl) * 2 : 0
      const hy = hu !== null && hd !== null ? hd - hu : hd !== null ? (hd - h0) * 2 : hu !== null ? (h0 - hu) * 2 : 0
      return Math.atan(Math.hypot(hx, hy) / g.res_m) * R2D
    }
    return null
  }
}

/** Destination point on the sphere from (lat,lon), azimuth, central angle. */
export function destination(latDeg: number, lonDeg: number, azDeg: number, theta: number) {
  const p1 = latDeg * D2R, l1 = lonDeg * D2R, az = azDeg * D2R
  const p2 = Math.asin(Math.sin(p1) * Math.cos(theta) + Math.cos(p1) * Math.sin(theta) * Math.cos(az))
  const l2 = l1 + Math.atan2(Math.sin(az) * Math.sin(theta) * Math.cos(p1), Math.cos(theta) - Math.sin(p1) * Math.sin(p2))
  return { lat: p2 * R2D, lon: ((l2 * R2D + 540) % 360) - 180 }
}

export interface Horizon {
  /** elevation (deg) of terrain/sphere horizon for azimuths 0..359 (1 deg steps) */
  el: Float32Array
  /** distance (km) to the limiting point */
  dist: Float32Array
  siteHeightM: number
  siteSlopeDeg: number | null
  hasTerrain: boolean
}

/** Exact spherical horizon: elevation of a point at central angle th, radius r1, seen from radius r0. */
export const elevationTo = (r0: number, r1: number, th: number) => Math.atan2(r1 * Math.cos(th) - r0, r1 * Math.sin(th)) * R2D

export function computeHorizon(terrain: Terrain, lat: number, lon: number, maxKm = 220, mastM = 0): Horizon {
  const el = new Float32Array(360), dist = new Float32Array(360)
  const h0 = terrain.height(lat, lon)
  const hasTerrain = h0 !== null
  const base = h0 ?? 0
  const r0 = MOON_RADIUS_KM + (base + mastM) / 1000
  for (let az = 0; az < 360; az++) {
    // sphere horizon at zero-height terrain (dip below horizontal)
    // observers below the reference sphere (crater floors) have no geometric dip: terrain marching decides
    const rr = Math.max(r0, MOON_RADIUS_KM)
    let best = -Math.acos(MOON_RADIUS_KM / rr) * R2D, bestD = Math.sqrt(Math.max(0, rr * rr - MOON_RADIUS_KM * MOON_RADIUS_KM))
    if (hasTerrain) {
      let s = 0.04
      while (s < maxKm) {
        const th = s / MOON_RADIUS_KM
        const q = destination(lat, lon, az, th)
        const h = terrain.height(q.lat, q.lon)
        if (h === null) break
        const e = elevationTo(r0, MOON_RADIUS_KM + h / 1000, th)
        if (e > best) { best = e; bestD = s }
        s += Math.max(0.04, s * 0.012)
      }
    }
    el[az] = best; dist[az] = bestD
  }
  return { el, dist, siteHeightM: base, siteSlopeDeg: terrain.slope(lat, lon), hasTerrain }
}

export function horizonAt(h: Horizon, az: number) {
  const a = ((az % 360) + 360) % 360, i = Math.floor(a), f = a - i
  return h.el[i] * (1 - f) + h.el[(i + 1) % 360] * f
}
