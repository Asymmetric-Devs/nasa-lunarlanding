const MOON_R_M = 1737400
const D2R = Math.PI / 180
const HALF_WIN_M = 15000

/** Build contextual deep-links to LROC QuickMap and NASA Moon Trek for any lunar (lat, lon) in degrees. */
export function externalSiteLinks(lat: number, lon: number) {
  const lon180 = ((lon + 540) % 360) - 180
  if (lat <= -60) {
    // South Polar Stereographic (meters from the South Pole)
    const r = 2 * MOON_R_M * Math.tan(((90 + lat) * D2R) / 2)
    const x = Math.round(r * Math.sin(lon * D2R))
    const y = Math.round(r * Math.cos(lon * D2R))
    return {
      quickmap: `https://quickmap.lroc.im-ldi.com/?extent=${x - HALF_WIN_M},${y - HALF_WIN_M},${x + HALF_WIN_M},${y + HALF_WIN_M}&proj=27`,
      moontrek: `https://trek.nasa.gov/moon/#v=0.1&x=${x}&y=${y}&z=6&p=urn%3Aogc%3Adef%3Acrs%3AIAU2000%3A%3A30120&d=`,
    }
  }
  // Equidistant Cylindrical / Equirectangular (< 60°S)
  const x = Math.round(MOON_R_M * lon180 * D2R)
  const y = Math.round(MOON_R_M * lat * D2R)
  return {
    quickmap: `https://quickmap.lroc.im-ldi.com/?extent=${x - HALF_WIN_M},${y - HALF_WIN_M},${x + HALF_WIN_M},${y + HALF_WIN_M}&proj=16`,
    moontrek: `https://trek.nasa.gov/moon/#v=0.1&x=${lon180.toFixed(4)}&y=${lat.toFixed(4)}&z=7&p=urn%3Aogc%3Adef%3Acrs%3AEPSG%3A%3A104903&d=`,
  }
}
