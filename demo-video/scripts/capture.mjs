import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
// usage: node capture.mjs <out dir> [url]   (STILLS_ONLY=1 skips the time-lapses)
const OUT = process.argv[2]; mkdirSync(OUT, { recursive: true })
const URL = process.argv[3] ?? 'http://localhost:4178/'
const EXE = process.env.CHROME_BIN // path to a headless chromium; unset = Playwright's own
const b = await chromium.launch({ ...(EXE ? { executablePath: EXE } : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
const errs = []
async function open(dsf) {
  const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: dsf })
  const p = await ctx.newPage(); p.on('pageerror', (e) => errs.push(e.message))
  await p.addInitScript(() => { try { localStorage.setItem('sunline.lang', 'en'); localStorage.setItem('sunline.theme', 'dark'); localStorage.setItem('sunline.tour', '1') } catch {} })
  await p.goto(URL, { waitUntil: 'load' })
  await p.waitForSelector('.hud-top .slant:not([disabled])', { timeout: 60000 }); await p.waitForSelector('.pre', { state: 'detached', timeout: 30000 })
  await p.evaluate(() => document.querySelector('.hud-top .slant').click()); await p.waitForSelector('.intro', { state: 'detached' }); await p.waitForTimeout(1500)
  return p
}
const tab = (p, i) => p.evaluate((i) => document.querySelectorAll('.tabs button')[i].click(), i)
const view = (p, t) => p.evaluate((t) => [...document.querySelectorAll('.views button')].find((x) => x.textContent.trim().startsWith(t))?.click(), t)

if (!process.env.STILLS_ONLY) {
// ---- time-lapses at DSF 1 ----
{
  const p = await open(1)
  await tab(p, 2); await p.waitForTimeout(2500)                       // polar map
  for (let i = 0; i < 30; i++) { await p.screenshot({ path: `${OUT}/polar_${String(i).padStart(2, '0')}.png` }); for (let k = 0; k < 4; k++) await p.keyboard.press('ArrowRight'); await p.waitForTimeout(450) }
  await p.reload({ waitUntil: 'load' }); await p.waitForSelector('.pre', { state: 'detached', timeout: 30000 }).catch(() => {})
  await p.close()
}
{
  const p = await open(1)
  await tab(p, 0); await p.waitForTimeout(1500)
  for (let i = 0; i < 24; i++) { await p.screenshot({ path: `${OUT}/horizon_${String(i).padStart(2, '0')}.png` }); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(350) }
  await p.close()
}
}
// ---- stills at DSF 2 ----
{
  const p = await open(2)
  await tab(p, 0); await p.waitForTimeout(1500); await p.screenshot({ path: `${OUT}/nav_horizon.png` })
  await tab(p, 1); await p.waitForTimeout(3500); await p.screenshot({ path: `${OUT}/nav_surface.png` })
  await tab(p, 2); await p.waitForTimeout(2500); await p.screenshot({ path: `${OUT}/nav_polar.png` })
  await tab(p, 0)
  // add three more scenarios with the "+" of the rail
  for (const name of ['Malapert', 'Nobile Rim 2', 'IM-2']) {
    await p.evaluate((n) => { for (const bt of document.querySelectorAll('.rail button')) { if (bt.textContent.trim() === '+' && bt.parentElement?.textContent.includes(n)) { bt.click(); return } } }, name)
    await p.waitForTimeout(500)
  }
  await view(p, 'Compare'); await p.waitForTimeout(6000)
  await p.screenshot({ path: `${OUT}/compare_top.png` })
  await p.evaluate(() => { const c = document.querySelector('.page.compare'); c.scrollTop = c.scrollHeight }); await p.waitForTimeout(3000)
  await p.screenshot({ path: `${OUT}/compare_bottom.png` })
  await p.evaluate(() => { const s = document.querySelector('.sens'); s?.scrollIntoView({ block: 'center' }) }); await p.waitForTimeout(1500)
  await p.screenshot({ path: `${OUT}/compare_sens.png` })
  await view(p, 'Date planner'); await p.waitForTimeout(6000); await p.screenshot({ path: `${OUT}/planner.png` })
  console.log('rail "+" count / scenarios on planner rows:', await p.$$eval('main *', (e) => e.length))
  await p.close()
}
console.log(errs.join('\n') || 'no page errors'); await b.close()
