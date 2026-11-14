# NASA Space Apps Challenge 2026 — Lunar Landing Site Navigator

Repositorio del equipo para el **NASA International Space Apps Challenge 2026** (tema "The Next Frontier").

- Hackatón: **14–15 de noviembre de 2026** (48 horas, equipos de hasta 6 personas). Evaluación desde el 16 de noviembre.
- Sitio oficial: https://www.spaceappschallenge.org/2026/challenges/
- Los briefs completos y los recursos de datos se publicaron el 28 de octubre de 2026.

## Desafío

Herramienta para comparar sitios y fechas de aterrizaje en el polo sur lunar, mostrando la posición del Sol y de la Tierra sobre el horizonte, para estimar energía disponible y ventanas de comunicación directa con la Tierra.

> Este resumen es una paráfrasis. El texto oficial del brief está en el sitio de Space Apps y es la referencia.

## Datos públicos de referencia

- LRO / LOLA (NASA PDS): relieve lunar y mapas de iluminación.
- JPL Horizons: efemérides del Sol y la Tierra vistos desde la Luna.

---

# Sunline — Lunar Landing Site Navigator

NASA Space Apps 2026 · challenge *Lunar Landing Site Navigator*.
A web tool to compare lunar landing sites and dates in seconds: Sun and Earth over a **real LOLA terrain horizon**, power and direct-to-Earth windows, scenario comparison and a launch-date planner.

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/ (relative paths, host anywhere)
npm test           # ephemeris vs JPL Horizons, terrain decode, illumination vs LOLA
```

## What it does

| View | Purpose |
|---|---|
| **Navigator** | One site and date: 360° horizon panorama with Sun/Earth discs, 3D surface view (LOLA mesh, shadows, Earth phase and rotation), polar map with cast shadows, live readouts (time to sunset / Earthset), verdict against editable mission assumptions, 3 d – 1 year timeline with scrubbing and playback. |
| **Compare** | Up to 4 site-date scenarios side by side, best value per metric, and a *sensitivity* panel: the same site displaced by ±25–500 m (shows why a landing ellipse matters). |
| **Date planner** | Sites × launch dates heat-map (mission length 3–30 d): which dates still work when the schedule slips; best windows per site, one click back to the Navigator. |

Custom coordinates, mission profiles (solar rover / hibernating lander / crewed outpost), antenna elevation mask, mast height and solar-array orientation are adjustable under *Mission assumptions*.

Also: **English / Spanish**, **light / dark** theme, an in-app **Guide**, keyboard control (Space, ←/→), and shareable links (state lives in the URL hash). See `COMO_USAR.md` for a Spanish usage summary and a test checklist.

## Method

- **Ephemeris**: [Astronomy Engine](https://github.com/cosinekitty/astronomy) positions → Moon-fixed Mean Earth frame via the IAU 2015 / Archinal 2018 lunar orientation model (13 libration terms) → topocentric directions (includes Earth parallax, 0.26°).
- **Horizon**: LOLA gridded DEMs, ray-marched in 360 azimuths to 220 km with exact spherical geometry. Sun and Earth are discs; partial occultation is computed.
- **Terrain layers**: 80 m site tiles → 80 m polar core (≤150 km from the pole) → 240 m cap (75°S–90°S). Shipped as int8-delta files (4 m vertical step, 11.6 MB gzip total).

## Validation (reproducible)

| Check | Result | Where |
|---|---|---|
| Sun & Earth az/el vs **JPL Horizons** (DE441, MEAN_ME), Apollo 11 + a south-polar ridge | **max error < 0.005°** | `tests/ephemeris.test.ts`, fixtures from `scripts/fetch_horizons.sh` |
| Annual Sun visibility vs **LOLA average-illumination map** (AVGVISIB_85S_060M, 60 random points 85.3–89.9°S, 2009–2013) | **r = 0.92, MAE 2.2 pp** | `tests/illumination.test.ts` (needs `data-raw/`) |

Finding worth knowing: results depend on DEM resolution (one site went from 21 % to 45 % annual sunlight between 240 m and 80 m terrain) — the tool says so rather than hiding it.

## Rebuild the data

```bash
# download (see scripts/ and the data section of the app for URLs)
#   LOLA LDEM_75S_240M and LDEM_80S_80M float IMG  -> data-raw/dem75s240, data-raw/dem80s80
#   SVS CGI Moon Kit (lroc_color_2k.jpg, ldem_3_8bit.jpg) -> data-raw/moonkit
#   LOLA AVGVISIB_85S_060M (+ .LBL)                -> data-raw/illum85   (validation only)
python3 -I scripts/build_data.py "$PWD/data-raw" "$PWD"
```

## Limits

- Terrain exists for 75°S–90°S only; elsewhere the horizon is the geometric sphere (flagged in the UI).
- Site coordinates marked *approximate* are region centres, not NASA selections; only the Connecting Ridge points and Nobile Rim 2 come from published studies.
- Earth-link requires the whole Earth disc above terrain + antenna mask; no relay satellites are modelled.
- Planning aid, not flight-certified.

## Credits

NASA LRO/LOLA (PDS Geosciences Node), NASA SVS CGI Moon Kit, NASA Blue Marble, JPL Horizons, Astronomy Engine, IAU WGCCRE.
