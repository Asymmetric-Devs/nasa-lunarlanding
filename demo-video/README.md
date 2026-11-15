# Video de demostración de Sunline (28,9 s)

Proyecto HyperFrames (HTML que se renderiza a video). **Todo lo necesario para regenerar el video está versionado** (escenas, scripts, capturas, voz, música, efectos, fuentes y logo, ~49 MB). **Solo el MP4 no se versiona** (`renders/` está en `.gitignore`, igual que los cachés de la herramienta en `.hyperframes/`): se vuelve a producir con los pasos de abajo.

Resultado: `renders/sunline-demo.mp4` (1920×1080, 30 fps, H.264 + AAC).

## Qué hay

| Ruta | Contenido |
|---|---|
| `index.html` | Raíz: monta las 5 escenas, el audio (voz, música, efectos) y los barridos de transición. Se **genera** con `scripts/build_film.py`. |
| `compositions/s1..s5.html` | Las escenas (gancho, en el navegador, Compare, Planificador, validación y cierre). También generadas. |
| `scripts/build_film.py` | Genera `index.html` y `compositions/`. Aquí están los tiempos, textos y movimientos de cámara. |
| `scripts/capture.mjs` | Captura las imágenes reales de la app con Playwright. |
| `assets/shots/` | Capturas de la app: `horizon_*`, `polar_*` (time‑lapse) y vistas fijas. |
| `assets/voice/vo1..5.wav` | Locución. |
| `assets/music/bed.wav` | Cama ambiental generada con `ffmpeg`. |
| `assets/sfx/` | Efectos del paquete de la skill `media-use` (licencia Pixabay). |
| `assets/fonts/`, `assets/logo/` | Tipografías y logo tomados de la propia app. |

## Regenerar desde cero

1. **Capturas** (desde la raíz del repo):
   ```
   npm run build && npx vite preview --port 4178 --strictPort &
   node demo-video/scripts/capture.mjs demo-video/assets/shots http://localhost:4178/
   ```
   Necesita `playwright` instalado (por ejemplo `npm i --no-save playwright`) y, si no usás el Chromium de Playwright, `CHROME_BIN=<ruta a chromium>`. Con `STILLS_ONLY=1` solo repite las vistas fijas.
2. **Voz** (local, sin cuenta): `pip install kokoro-onnx soundfile` en un entorno virtual y `HYPERFRAMES_PYTHON=<python del venv>`. Voz `am_michael`, velocidad `1.15`, una pasada por línea:
   ```
   npx hyperframes tts "<línea>" -v am_michael -s 1.15 -o assets/voice/voN.wav
   ```
   1. At the lunar south pole, small shifts in place or date cut sunlight and Earth contact.
   2. Sunline solves it in your browser: NASA terrain, precise astronomy, milliseconds.
   3. Navigator reads 360-degree horizons. Compare tests nine landing points.
   4. Date Planner finds windows that survive launch delays.
   5. Validated against JPL Horizons and LOLA maps. Plan safer missions with Sunline.

   Si cambia la duración de alguna línea, ajustá `voice` y los límites de escena `B` en `scripts/build_film.py`.
3. **Montaje y render** (desde `demo-video/`):
   ```
   python3 scripts/build_film.py
   npx hyperframes check
   npx hyperframes render --quality delivery -o renders/sunline-demo.mp4
   ```
   `npx hyperframes preview` abre el editor para ajustar a mano.

## Qué se afirma en pantalla y de dónde sale

- **65 % → 22 %:** cuadrícula de sensibilidad de Compare con la aterrizada a ±100 m, estado por defecto de la app (12/01/2027, ventana de 29,5 días).
- **< 0,005°:** error máximo de Sol y Tierra contra JPL Horizons (`tests/ephemeris.test.ts`; medido 0,0047°).
- **r 0,98 Sol, r 0,99 Tierra, 300 puntos:** `npm run test:validation` (mapas LOLA `AVGVISIB_85S_060M`).
- **"En milisegundos":** medido en Node, ~60 ms de horizonte más 1–5 ms de análisis por sitio. No se midió dentro del navegador.
- **Voz sintética** (Kokoro) y música generada: si el concurso pide declararlo, hay que decirlo.

## Versión en español (para el equipo)

Misma estructura, otro guion: voz femenina (Kokoro `ef_dora`, velocidad 1,05), interfaz de la app en español y más foco en la teoría (proyección estereográfica polar, trazado de rayos sobre 360 acimuts, modelo lunar IAU con libración y paralaje, validación). Dura 29,1 s.

```
SUNLINE_LANG=es node scripts/capture.mjs assets/shots_es http://localhost:4178/   # capturas en español
python3 scripts/build_film.py es                                                   # variants/index.es.html + compositions/es/
npx hyperframes render -c variants/index.es.html --quality delivery -o renders/sunline-demo-es.mp4
```

El raíz en español vive en `variants/` porque un segundo `index*.html` en la raíz hace fallar `hyperframes check`. Voz (una pasada por línea, `-v ef_dora -s 1.05`, salida `assets/voice_es/voN.wav`):

1. En el polo sur de la Luna, unos metros cambian la luz y la señal.
2. Lo calculamos en tu navegador: relieve láser de LOLA y proyección estereográfica polar.
3. Con trazado de rayos en trescientos sesenta direcciones, dibujamos el horizonte exacto de cada sitio.
4. Ubicamos al Sol y a la Tierra con el modelo lunar de la IAU y su libración.
5. Validado contra JPL Horizons, con menos de cinco milésimas de grado de error. Sunline: misiones más seguras.

Las fórmulas en pantalla son las del código: `rho = 2R·tan((90° + lat) / 2)` (proyección en `src/engine/terrain.ts`) y `elev = atan2(r1·cos(th) - r0, r1·sin(th))` (horizonte esférico exacto, `elevationTo`).
