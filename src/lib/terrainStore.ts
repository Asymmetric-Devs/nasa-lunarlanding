import { Terrain, computeHorizon, type Horizon, type PolarGrid } from '../engine/terrain'
import { loadGrid } from '../engine/loader'

const BASE = `${import.meta.env.BASE_URL}data`.replace(/\/\.\//, '/')
export type Progress = (p: number, label: string) => void
let core: PolarGrid | null = null, cap: PolarGrid | null = null, tilesMeta: any = null
let loading: Promise<void> | null = null
const tiles = new Map<string, PolarGrid | null>()
const horizons = new Map<string, Horizon>()

export function terrainReady() { return !!core && !!cap }

export function loadTerrain(onProgress?: Progress) {
  if (loading) return loading
  loading = (async () => {
    onProgress?.(0.02, 'Reading metadata')
    const [cm, pm, tm] = await Promise.all(['core80', 'polar240', 'tiles'].map((n) => fetch(`${BASE}/${n}.json`).then((r) => r.json())))
    tilesMeta = tm
    onProgress?.(0.1, 'LOLA polar DEM · 240 m')
    cap = await loadGrid(BASE, 'polar240', pm, undefined, pm.center, 457.4)
    onProgress?.(0.6, 'LOLA polar core · 80 m')
    core = await loadGrid(BASE, 'core80', cm, undefined, cm.c)
    onProgress?.(1, 'Terrain ready')
  })()
  return loading
}

async function tileFor(siteId: string): Promise<PolarGrid | null> {
  if (tiles.has(siteId)) return tiles.get(siteId)!
  const m = tilesMeta?.tiles?.[siteId]
  if (!m) { tiles.set(siteId, null); return null }
  const g = await loadGrid(BASE, `tile_${siteId}`, { ...m, nodata: -32768 }, undefined, tilesMeta.center)
  tiles.set(siteId, g); return g
}

/** Terrain for a site: fine tile (curated sites) -> 80 m core -> 240 m cap. */
export async function terrainFor(siteId: string | null) {
  await loadTerrain()
  const tile = siteId ? await tileFor(siteId) : null
  return new Terrain(tile, core, cap)
}

export function horizonFor(t: Terrain, key: string, lat: number, lon: number, mastM: number) {
  const k = `${key}|${mastM}`
  let h = horizons.get(k)
  if (!h) { h = computeHorizon(t, lat, lon, 220, mastM); horizons.set(k, h); if (horizons.size > 64) horizons.delete(horizons.keys().next().value!) }
  return h
}
export const grids = () => ({ core, cap })
