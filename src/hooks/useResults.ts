import { useEffect, useState } from 'react'
import type { Config } from '../engine/analysis'
import type { Scenario } from '../store'
import { computeResult, type Result } from './useAnalysis'

export function useResults(scenarios: Scenario[], spanDays: number, cfg: Config) {
  const [res, setRes] = useState<(Result | null)[]>(scenarios.map(() => null))
  const [busy, setBusy] = useState(true)
  const key = scenarios.map((s) => `${s.id}${s.siteId}${s.lat}${s.lon}${s.t}`).join('|')
  useEffect(() => {
    let dead = false; setBusy(true)
    const id = setTimeout(async () => { const out: Result[] = []; for (const s of scenarios) out.push(await computeResult(s, spanDays, cfg)); if (!dead) { setRes(out); setBusy(false) } }, 0)
    return () => { dead = true; clearTimeout(id) }
  }, [key, spanDays, cfg.mastM, cfg.minEarthEl, cfg.panel])
  return { res, busy }
}
