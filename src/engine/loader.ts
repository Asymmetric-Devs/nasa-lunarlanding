import type { PolarGrid } from './terrain'

export interface GridMeta { n: number; res_m: number; q: number; nodata: number; c?: number; center?: number; x0?: number; y0?: number; radius_km?: number; extent_latmax?: number }

/** Decode int8-delta terrain (per-row int16 first value in q-steps, then int8 deltas). Output: Int16 metres. */
export function decodeDelta(buf: ArrayBuffer, n: number, q: number): Int16Array {
  const firsts = new DataView(buf, 0, n * 2)
  const deltas = new Int8Array(buf, n * 2, n * (n - 1))
  const out = new Int16Array(n * n)
  for (let r = 0; r < n; r++) {
    let v = firsts.getInt16(r * 2, true)
    const o = r * n, d = r * (n - 1)
    out[o] = v * q
    for (let c = 1; c < n; c++) { v += deltas[d + c - 1]; out[o + c] = v * q }
  }
  return out
}

export type Fetcher = (url: string) => Promise<ArrayBuffer>
export const browserFetcher: Fetcher = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.arrayBuffer() }

export async function loadGrid(base: string, name: string, meta: GridMeta, fetcher: Fetcher = browserFetcher, c: number, maskCircleKm?: number): Promise<PolarGrid> {
  const buf = await fetcher(`${base}/${name}.d8`)
  const data = decodeDelta(buf, meta.n, meta.q)
  if (maskCircleKm) { // cap: invalidate pixels outside the 75S circle
    const rmax = maskCircleKm * 1000 / meta.res_m, n = meta.n
    for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) if (Math.hypot(k - c, r - c) > rmax) data[r * n + k] = meta.nodata
  }
  return { data, n: meta.n, res_m: meta.res_m, c, nodata: meta.nodata, x0: meta.x0, y0: meta.y0 }
}
