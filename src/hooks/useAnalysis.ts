import { useEffect, useState } from 'react'
import { analyze, buildSeries, sampleAt, type Analysis, type Config, type Sample } from '../engine/analysis'
import { skyState } from '../engine/ephemeris'
import type { Horizon, Terrain } from '../engine/terrain'
import { horizonFor, terrainFor } from '../lib/terrainStore'
import type { Scenario } from '../store'

export interface Result { key: string; terrain: Terrain; hor: Horizon; analysis: Analysis; scenario: Scenario; spanDays: number }
export const siteKey = (s: Scenario) => `${s.siteId ?? 'c'}|${s.lat.toFixed(5)},${s.lon.toFixed(5)}`

export function stepFor(spanDays: number) { return spanDays <= 4 ? 10 : spanDays <= 16 ? 20 : spanDays <= 31 ? 30 : 180 } // minutes

const cache = new Map<string, Result>()
export async function computeResult(sc: Scenario, spanDays: number, cfg: Config): Promise<Result> {
  const k = `${siteKey(sc)}|${sc.t}|${spanDays}|${cfg.mastM}|${cfg.minEarthEl}|${cfg.panel}`
  const hit = cache.get(k); if (hit) return { ...hit, scenario: sc }
  const terrain = await terrainFor(sc.siteId)
  const hor = horizonFor(terrain, siteKey(sc), sc.lat, sc.lon, cfg.mastM)
  const stepMs = stepFor(spanDays) * 60000, n = Math.round((spanDays * 86400000) / stepMs)
  const analysis = analyze(buildSeries(sc.t, stepMs, n), sc.lat, sc.lon, hor, cfg)
  const r = { key: k, terrain, hor, analysis, scenario: sc, spanDays }
  cache.set(k, r); if (cache.size > 40) cache.delete(cache.keys().next().value!)
  return r
}

export function useAnalysis(sc: Scenario | undefined, spanDays: number, cfg: Config) {
  const [res, setRes] = useState<Result | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    if (!sc) return
    let dead = false; setBusy(true)
    const id = setTimeout(() => { computeResult(sc, spanDays, cfg).then((r) => { if (!dead) { setRes(r); setBusy(false) } }).catch(console.error) }, 0)
    return () => { dead = true; clearTimeout(id) }
  }, [sc?.siteId, sc?.lat, sc?.lon, sc?.t, spanDays, cfg.mastM, cfg.minEarthEl, cfg.panel])
  return { res, busy }
}

/** Precise sample at an arbitrary instant. */
export function sampleNow(res: Result, tMs: number, cfg: Config): Sample {
  return sampleAt(skyState(tMs), res.scenario.lat, res.scenario.lon, res.hor, cfg)
}

/** Hours until the boolean state at tMs changes, using a fine scan (10 min) up to maxH. null if none. */
export function timeToChange(res: Result, tMs: number, cfg: Config, pick: (s: Sample) => boolean, maxH = 24 * 40, stepMin = 20) {
  const now = pick(sampleNow(res, tMs, cfg))
  let prev = tMs
  for (let m = stepMin; m <= maxH * 60; m += stepMin) {
    const t = tMs + m * 60000
    if (pick(sampleNow(res, t, cfg)) !== now) { // refine to 1 minute
      let a = prev, b = t
      while (b - a > 60000) { const mid = (a + b) / 2; if (pick(sampleNow(res, mid, cfg)) === now) a = mid; else b = mid }
      return { state: now, hours: (b - tMs) / 3.6e6 }
    }
    prev = t
  }
  return { state: now, hours: null as number | null }
}
