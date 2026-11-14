const D2R = Math.PI / 180

/** Angular separation (deg) between two directions given as azimuth/elevation (deg). */
export function angularSeparation(az1: number, el1: number, az2: number, el2: number) {
  const a = el1 * D2R, b = el2 * D2R
  const c = Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos((az1 - az2) * D2R)
  return Math.acos(Math.max(-1, Math.min(1, c))) / D2R
}

/**
 * Share (0..1) of the Sun's disc hidden by the Earth's disc, seen from the Moon.
 * This is what a lunar eclipse is from the Moon's side: Earth passing in front of the Sun.
 * rs, re = angular radii of Sun and Earth, sep = centre-to-centre separation (all degrees).
 * The Earth is a plain opaque disc (radius 6371 km): the thin ring of sunlight refracted through its
 * atmosphere (reddish light, ~1e-5..1e-3 of full sunlight even in totality) is ignored.
 */
export function sunCoveredByEarth(rs: number, re: number, sep: number) {
  if (sep >= rs + re) return 0
  if (sep <= Math.abs(re - rs)) return re >= rs ? 1 : (re * re) / (rs * rs)
  const a = Math.acos((sep * sep + rs * rs - re * re) / (2 * sep * rs))
  const b = Math.acos((sep * sep + re * re - rs * rs) / (2 * sep * re))
  const lens = rs * rs * (a - Math.sin(2 * a) / 2) + re * re * (b - Math.sin(2 * b) / 2)
  return lens / (Math.PI * rs * rs)
}
