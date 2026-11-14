# Precisión astronómica y criterio de enlace con la Tierra

Exploración del 14 de noviembre de 2026, hecha sobre la rama `fix/registro-polo-y-validacion` (`650b44c`). Todo lo de abajo se midió con el código del repo y los datos de `data-raw/`. Lo que no se pudo comprobar está marcado.

## Qué se cambió en esta rama

1. **Eclipses: la Tierra tapando al Sol** (`src/engine/eclipse.ts`, `src/engine/analysis.ts`). Antes el motor no los modelaba. Ahora la fracción de Sol visible se multiplica por (1 − fracción tapada por el disco de la Tierra).
2. **Máscara de antena medida sobre la horizontal local** (`sampleAt`). Antes se exigía que el centro de la Tierra estuviera `minEarthEl` por encima de la línea del terreno. Ahora se exige `elevación ≥ minEarthEl` **y** disco de la Tierra entero despejado de terreno (esto último ya existía).
3. Tests nuevos en `tests/eclipse.test.ts` (8 tests).

No se tocó nada de lo que tiene asignado el otro agente: tests de Windows, mapa WebGL a 80 m y tile `im1`, pendiente local. Tampoco `tests/visibility.test.ts` ni `useAnalysis.ts`, que están en su segunda ronda.

## 1. Eclipses

**Qué se midió.** Entre 2027 y 2030 el modelo detecta 9 eventos con la Tierra solapando al Sol. Los tres totales coinciden con el catálogo de eclipses de NASA/GSFC (el de 2028 con Eclipsewise): el punto de mayor acercamiento cae a menos de 6 min de la hora catalogada (test automático, con paso de 1 min).

| Evento | Duración con solape | Tierra tapa al Sol por completo |
|---|---|---|
| 2027‑02‑20, 2027‑08‑17 | 2,5 h, 0,7 h | no |
| 2028‑01‑12, 2028‑07‑06 | 2,8 h, 3,8 h | no |
| 2028‑12‑31 | 4,5 h | 2,3 h |
| 2029‑06‑26 | 4,5 h | 2,7 h |
| 2029‑12‑20 | 4,8 h | 2,3 h |
| 2030‑06‑15, 2030‑12‑09 | 3,5 h, 2,8 h | no |

**Impacto en cuatro años (2027–2030).** Es chico en promedio: Malapert pierde 7,3 h de Sol (0,11 % de energía), IM‑1 pierde 7,3 h (0,13 %), Connecting Ridge y Nobile Rim 2 pierden 0. Pero en una ventana de misión que coincida con un eclipse total, el sitio queda a oscuras unas 2,5 h seguidas, y eso importa para energía y para la temperatura.

**Límites.** La Tierra es un disco opaco de 6371 km. Se ignora el anillo de luz refractada por su atmósfera (rojiza, de orden 1e‑5 a 1e‑3 de la luz plena, cifra de literatura que no verifiqué aquí). La fracción de Sol visible usa el producto de dos ocultaciones: es exacta cuando una de las dos es total o no existe, y aproximada cuando ambas son parciales a la vez.

## 2. Criterio de enlace con la Tierra

**Documentación.** No encontré un valor normativo publicado de máscara de elevación para la superficie lunar. Lo que sí encontré: la definición habitual de máscara es una elevación mínima sobre el **plano horizontal local**, y puede variar por acimut para representar obstáculos; los valores típicos de ejemplo van de 5° a 15°. Esas fuentes son documentación de fabricantes y de software (MathWorks, glosarios GNSS), no un organismo de normalización. El Handbook 810‑005 de la DSN tiene un módulo 301 sobre cobertura y geometría que probablemente cubre los límites de elevación de las antenas en la Tierra, pero **no lo leí**.

**Efecto del cambio.** Año 2028, paso de 60 min, máscara de 5° (porcentaje del tiempo con enlace):

| Sitio | Antes | Ahora | Tierra: elevación máxima |
|---|---|---|---|
| Connecting Ridge | 18,2 | 20,5 | 6,2° |
| Connecting Ridge B | 20,9 | 20,9 | 6,3° |
| Nobile Rim 2 | 0,0 | 22,3 | 9,3° |
| Malapert | 63,0 | 48,6 | 10,7° |
| IM‑1 | 76,2 | 76,8 | 16,5° |
| IM‑2 | 56,7 | 50,7 | 11,1° |

El cambio no es parejo: sube donde el horizonte está sobre la horizontal y baja donde está por debajo (Malapert, IM‑2). Es la consecuencia de usar la definición estándar, no un error.

**Sensibilidad a la máscara** (criterio nuevo, enlace %):

| Sitio | 0° | 2° | 5° | 10° |
|---|---|---|---|---|
| Connecting Ridge | 45,7 | 41,1 | 20,5 | 0,0 |
| Nobile Rim 2 | 22,3 | 22,3 | 22,3 | 0,0 |
| Malapert | 72,5 | 62,7 | 48,6 | 14,7 |
| IM‑2 | 75,6 | 65,1 | 50,7 | 18,0 |

Con máscara de 10° los sitios polares quedan en 0 %, porque la Tierra no sube tanto. **La interfaz no avisa de esto** y es lo que más conviene arreglar a continuación.

**Disco entero o solo el centro.** "Máscara local + centro despejado" da más enlace que "+ disco entero" solo con máscara 0° (Connecting Ridge 50,4 contra 45,7); con 2° o más son casi iguales. Mantuve el disco entero, que ya estaba y es más conservador.

**Lado de la Tierra (DSN).** Con tres complejos (Goldstone, Madrid, Canberra) la Luna está por encima de 6° en al menos uno el 100 % del 2028; por encima de 10°, el 98,55 %, con un hueco máximo de 1 h. Es geometría, no programación de antenas. Así que no hace falta modelarlo.

## 3. Lo que se probó y NO mejora (no se cambió)

| Prueba | Resultado | Decisión |
|---|---|---|
| **Aberración estelar** del Sol (`GeoVector(..., true)`) contra Horizons | Máx. error de elevación: Apolo 11 Sol 17,1″ → 13,4″ (baja); Connecting Ridge Sol 1,1″ → 1,4″ (sube); la Tierra no cambia. | No justifica el cambio. El error máximo es 17″ = 0,0047°, consistente con el "< 0,005°" del README. |
| **Integrar el disco** sobre el perfil de horizonte en vez de usar el acimut central, para la visibilidad | 300 puntos: Sol r 0,977 contra 0,979; Tierra r 0,987 contra 0,987. Sin ganancia. | No se adopta. |
| **Paso de tiempo** 1 h contra 4 h en la validación | Idénticos (r 0,9593 y 0,9800 en ambos, 120 puntos). | Se mantiene 4 h. |
| **Paso de 180 min** de la app (lapsos > 31 d) contra 60 min | Diferencias ≤ 0,1 punto y ≤ 1 h en noches largas (3 sitios, 1 año). | Sin urgencia. |

**Validación con más muestra** (5 semillas × 60 puntos = 300, paso de 4 h): Sol r = 0,979, error medio 1,22 pp, sesgo −0,12 pp; Tierra r = 0,987, error medio 1,17 pp, sesgo +0,20 pp. Por semilla el Sol va de r 0,952 a 0,997 y el error de 0,7 a 2,0 pp. **El umbral actual de r > 0,95 se cumple en las 5, pero una semilla lo roza (0,952).** Conviene que el test agrupe semillas; esa tarea es del otro agente.

## 4. Pendiente y no verificado

- Aviso en la interfaz cuando la máscara iguala o supera la elevación máxima de la Tierra en el sitio (cambia textos de la interfaz; se dejó fuera para no pisar al otro agente).
- Leer el módulo 301 del DSN 810‑005 y los requisitos de comunicación de Artemis, para fijar una máscara por defecto con respaldo. Hoy el 5° es una elección nuestra.
- La aberración se probó con la velocidad del centro de la Tierra, no con la de la Luna (difieren ~3 %).
- Cuánto del error residual de 1–2 pp en la validación viene de la resolución del relieve (80 m contra 60 m del mapa de referencia) no se midió.
- No se comparó el marco lunar IAU 2015 (el nuestro) con el marco DE421 que usaron los mapas LOLA.

## 5. Verificación de la ronda 2 (macOS, rama `feat/windows-tiles-and-slope` `55b999f`)

- `tsc --noEmit` limpio, 23 tests pasan y `vite build` funciona.
- **Validación con 300 puntos** (semillas 7, 13, 29, 43, 71; `npm run test:validation` con `data-raw/`): **Sol r = 0,982, error medio 1,1 pp; Tierra r = 0,988, error medio 1,2 pp.** Las cifras anteriores (0,97 / 1,2 pp / 1,8 pp) venían de una sola semilla. Se actualizaron README, modal "Método y datos" (ES/EN) y el chip de la portada (r 0,98). Los umbrales del test pasaron de r > 0,95 y error < 3 pp a r > 0,97 y error < 2 pp; se fijaron mirando esta misma muestra, así que protegen contra regresiones, no contra una mala elección de muestra.
- **`build_data.py` regenerado** (corrido en un directorio aparte y comparado): el núcleo de 80 m y los 7 tiles existentes salen idénticos byte a byte; se agrega `tile_im1.d8` (con el recorte de borde) y `tiles.json`; `polar240.d8` cambia solo en el anillo exterior a 75°S (r ≥ 1905 px, 0 diferencias dentro del círculo útil), que es el medio píxel que señaló Tobías. Los tres archivos están aplicados en esta rama. Con el tile, IM‑1 da 36,7 % de Sol contra 38,6 % sin él.
- **Pendiente local** (escala de 80 m): Connecting Ridge 0,5°, Nobile Rim 2 2,9°, Haworth 8,9°, Malapert 18,3°, Cabeus 10,7°, IM‑1 13,9°, IM‑2 5,0°. Es plausible, pero a esa escala subestima la inclinación en la base de un módulo (unos metros). El texto de la interfaz ya dice que viene del relieve de 80–240 m.
- Probado en navegador: los links a QuickMap y Moon Trek se generan con las coordenadas correctas (Connecting Ridge: x = −7054 m, y = −12244 m, que coincide con el cálculo a mano), y el aviso de máscara sale con las dos redacciones. **No abrí QuickMap ni Moon Trek** para confirmar que los parámetros de URL sigan siendo válidos; eso lo verificaron ellos.
