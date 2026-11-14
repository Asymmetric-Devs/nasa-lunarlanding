import * as Astronomy from 'astronomy-engine'

const D2R = Math.PI / 180
const R2D = 180 / Math.PI
export const MOON_RADIUS_KM = 1737.4
export const AU_KM = 149597870.7
export const SUN_RADIUS_KM = 695700
export const EARTH_RADIUS_KM = 6371.0

export type Vec3 = [number, number, number]
export type Mat3 = [Vec3, Vec3, Vec3]

/** IAU WGCCRE 2015 / Archinal et al. 2018 lunar orientation (Mean Earth / Polar Axis frame, with physical libration terms). */
export function moonOrientation(ttDays: number) {
  const d = ttDays // days since J2000 TT (TDB-TT < 2 ms)
  const T = d / 36525
  const E = (a: number, b: number) => (a + b * d) * D2R
  const E1 = E(125.045, -0.0529921), E2 = E(250.089, -0.1059842), E3 = E(260.008, 13.012),
    E4 = E(176.625, 13.3407154), E5 = E(357.529, 0.9856003), E6 = E(311.589, 26.4057084),
    E7 = E(134.963, 13.064993), E8 = E(276.617, 0.3287146), E9 = E(34.226, 1.7484877),
    E10 = E(15.134, -0.1589763), E11 = E(119.743, 0.0036096), E12 = E(239.961, 0.1643573),
    E13 = E(25.053, 12.9590088)
  const ra = 269.9949 + 0.0031 * T - 3.8787 * Math.sin(E1) - 0.1204 * Math.sin(E2) + 0.07 * Math.sin(E3)
    - 0.0172 * Math.sin(E4) + 0.0072 * Math.sin(E6) - 0.0052 * Math.sin(E10) + 0.0043 * Math.sin(E13)
  const dec = 66.5392 + 0.013 * T + 1.5419 * Math.cos(E1) + 0.0239 * Math.cos(E2) - 0.0278 * Math.cos(E3)
    + 0.0068 * Math.cos(E4) - 0.0029 * Math.cos(E6) + 0.0009 * Math.cos(E7) + 0.0008 * Math.cos(E10) - 0.0009 * Math.cos(E13)
  const W = 38.3213 + 13.17635815 * d - 1.4e-12 * d * d + 3.561 * Math.sin(E1) + 0.1208 * Math.sin(E2)
    - 0.0642 * Math.sin(E3) + 0.0158 * Math.sin(E4) + 0.0252 * Math.sin(E5) - 0.0066 * Math.sin(E6)
    - 0.0047 * Math.sin(E7) - 0.0046 * Math.sin(E8) + 0.0028 * Math.sin(E9) + 0.0052 * Math.sin(E10)
    + 0.004 * Math.sin(E11) + 0.0019 * Math.sin(E12) - 0.0044 * Math.sin(E13)
  return { ra, dec, W }
}

const rz = (a: number): Mat3 => { const c = Math.cos(a), s = Math.sin(a); return [[c, s, 0], [-s, c, 0], [0, 0, 1]] }
const rx = (a: number): Mat3 => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, s], [0, -s, c]] }
const mul = (A: Mat3, B: Mat3): Mat3 => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j])) as Mat3
const apply = (M: Mat3, v: Vec3): Vec3 => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]]

/** EQJ (J2000 equatorial) -> Moon body-fixed (ME) rotation. */
export function eqjToMoonFixed(ttDays: number): Mat3 {
  const { ra, dec, W } = moonOrientation(ttDays)
  return mul(rz(W * D2R), mul(rx((90 - dec) * D2R), rz((90 + ra) * D2R)))
}

export interface SkyState {
  /** Unit vectors, Moon-fixed frame (x toward mean Earth, z north pole) */
  sunDir: Vec3
  earthDir: Vec3
  sunDistKm: number
  earthDistKm: number
}

export function skyState(date: Date | number): SkyState {
  const t = Astronomy.MakeTime(typeof date === 'number' ? new Date(date) : date) // number = epoch ms (MakeTime alone would read it as J2000 days)
  const sunGeo = Astronomy.GeoVector(Astronomy.Body.Sun, t, false)
  const moonGeo = Astronomy.GeoMoon(t)
  const M = eqjToMoonFixed(t.tt)
  const toSun = apply(M, [(sunGeo.x - moonGeo.x) * AU_KM, (sunGeo.y - moonGeo.y) * AU_KM, (sunGeo.z - moonGeo.z) * AU_KM])
  const toEarth = apply(M, [-moonGeo.x * AU_KM, -moonGeo.y * AU_KM, -moonGeo.z * AU_KM])
  const ds = Math.hypot(...toSun), de = Math.hypot(...toEarth)
  return { sunDir: [toSun[0] / ds, toSun[1] / ds, toSun[2] / ds], earthDir: [toEarth[0] / de, toEarth[1] / de, toEarth[2] / de], sunDistKm: ds, earthDistKm: de }
}

/** Local topocentric basis at a selenographic point (east-positive longitude). */
export function localBasis(latDeg: number, lonDeg: number) {
  const p = latDeg * D2R, l = lonDeg * D2R
  const up: Vec3 = [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)]
  const east: Vec3 = [-Math.sin(l), Math.cos(l), 0]
  const north: Vec3 = [-Math.sin(p) * Math.cos(l), -Math.sin(p) * Math.sin(l), Math.cos(p)]
  return { up, east, north }
}
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

export type Basis = ReturnType<typeof localBasis>
/** Azimuth (deg, from north toward east) and geometric elevation (deg) of a direction at a site. */
export function azEl(dir: Vec3, basis: Basis) {
  const el = Math.asin(Math.max(-1, Math.min(1, dot(dir, basis.up)))) * R2D
  let az = Math.atan2(dot(dir, basis.east), dot(dir, basis.north)) * R2D
  if (az < 0) az += 360
  return { az, el }
}

/** Topocentric direction: body at (dir * distKm) from Moon centre, observer at siteRadiusKm along basis.up. Parallax matters for Earth (~0.26 deg). */
export function topoDir(dir: Vec3, distKm: number, basis: Basis, siteRadiusKm = MOON_RADIUS_KM): Vec3 {
  const v: Vec3 = [dir[0] * distKm - basis.up[0] * siteRadiusKm, dir[1] * distKm - basis.up[1] * siteRadiusKm, dir[2] * distKm - basis.up[2] * siteRadiusKm]
  const n = Math.hypot(...v)
  return [v[0] / n, v[1] / n, v[2] / n]
}

export const angularRadiusDeg = (bodyRadiusKm: number, distKm: number) => Math.asin(bodyRadiusKm / distKm) * R2D
export { R2D, D2R }
