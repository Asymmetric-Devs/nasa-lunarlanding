# Viabilidad de integrar las fuentes oficiales del desafío

Fecha del análisis: 14 de noviembre de 2026. Todo lo de abajo se probó con peticiones reales ese día, salvo lo marcado como **no verificado**.

> **Revisión posterior (mismo día).** Las cifras de validación de este documento (Tierra r = 0,894; Sol r = 0,92) salieron de leer los mapas LOLA corridos un píxel. Corregido eso, dan **r = 0,97** para ambos. Los dos puntos con diferencia grande y la duda del período quedaron resueltos; ver la sección 6. El resto del análisis (Trek, Horizons, Quickmap, CSA) no cambia.

## Resumen

| Fuente | ¿Tiene API usable? | ¿Se puede llamar desde el navegador? | Veredicto |
|---|---|---|---|
| **Moon Trek (NASA)** | Sí: tiles WMTS documentados y un catálogo de capas | Sí, responde con `Access-Control-Allow-Origin: *` | **Integrable** como capa opcional |
| **Horizons (JPL)** | Sí: `ssd.jpl.nasa.gov/api/horizons.api` | **No**: no envía cabeceras CORS | **No integrar en vivo.** Ya lo usamos offline y coincide en menos de 0,005° |
| **Quickmap (ASU/LROC)** | No documentada | No aplica | **No integrar.** Solo enlazar |
| **CSA** | No | No aplica | Solo contexto; ya está en el modal "Método y datos" |

Hallazgo más valioso: **ya teníamos en `data-raw/` el mapa LOLA de visibilidad de la Tierra y nunca lo usamos para validar.** Lo comparé con nuestro cálculo y da correlación **0,894** y error medio **3,7 puntos porcentuales** (60 puntos entre 85,3°S y 89,9°S). Hasta hoy solo teníamos validado el Sol (r = 0,92). Esto es gratis, local y refuerza el argumento ante los jurados.

## 1. Moon Trek

**Qué probé**
- La página `trek.nasa.gov/moon/` no muestra nada sin JavaScript. La renderizé con un navegador y vi que pide tiles a `trek.nasa.gov/tiles/Moon/...` y un catálogo a `trek.nasa.gov/moon/TrekServices/...`.
- La documentación de tiles es `trek.nasa.gov/tiles/apidoc/trekAPI.html?body=moon`. Los tiles son WMTS RESTful: `.../{Capa}/1.0.0/default/default028mm/{zoom}/{fila}/{columna}.png`. Si falta un tile (404), no hay cobertura ahí.
- El catálogo del polo sur devolvió **329 capas** y responde con CORS abierto.
- Bajé tiles reales de cuatro capas del polo sur (iluminación, visibilidad de la Tierra, regiones en sombra permanente, relieve sombreado de un sitio): todos devuelven 200, PNG y CORS abierto.

**Capas relevantes para Sunline (polo sur)**
- Visibilidad media de la Tierra, 60 m y 120 m (`AVGVISIB_85S_060M_201608_EARTH_SP`).
- Iluminación WAC en porcentaje y ponderada por tiempo, 100 m.
- Regiones en sombra permanente LOLA, 240 m.
- Relieve sombreado y pendiente a 5 m para nuestros sitios curados: Connecting Ridge, Haworth, Shackleton Rim, Nobile Rim 1 y 2, Malapert Massif, de Gerlache Rim, Leibnitz Beta, Shoemaker.
- Mosaicos NAC (imágenes) de hasta 0,5 m por píxel en algunos sitios.
- Temperaturas Diviner (verano e invierno), hidrógeno (Lunar Prospector), abundancia de rocas, estabilidad del hielo.

**Cómo se integraría**
1. Capa opcional "Overlay NASA" sobre el mapa polar, con un interruptor, que pide tiles al vuelo.
2. Para el overlay hace falta convertir latitud y longitud a coordenadas estereográficas polares. Cada capa trae su propio rectángulo de cobertura en `WMTSCapabilities.xml` (la de 60 m cubre ±151 740 m).

**Esfuerzo estimado:** 2 a 3 horas para un overlay de 2 o 3 capas. Es una estimación mía, no medida.

**Riesgos y costos**
- **Rompe la promesa "todo local, sin servidores"** que decimos hoy. Habría que hacerlo opcional y decirlo en la interfaz. Sin conexión no funciona.
- No hay SLA ni límites publicados que yo haya encontrado. **No verificado:** términos de uso y límites de tasa.
- Los tiles son imágenes coloreadas, no valores. Sirven para mirar, no para calcular. Para calcular seguimos usando nuestros datos LOLA.
- **No verificado:** que la alineación de los tiles con nuestra grilla de 80 m sea exacta. Habría que comprobarla marcando sitios conocidos.
- Los datos cargan imágenes de un tercero: conviene citar la fuente en pantalla.

**Recomendación:** sí, como extra opcional si sobra tiempo. Es lo que más se nota en una demo, pero no cambia los números.

## 2. Horizons (JPL)

**Qué probé**
- La API funciona para la Luna: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='0,-89.5,0'` devolvió la efeméride del Sol con fuente DE441. Para ángulos usé `QUANTITIES='4'`.
- **No envía `Access-Control-Allow-Origin`** en un GET con `Origin`, y un `OPTIONS` devuelve 405. Un navegador la bloquearía.

**Conclusión**
- Llamarla en vivo desde la app requeriría un servidor intermedio, y eso rompe "local".
- No hace falta: nuestro cálculo ya coincide con Horizons en menos de 0,005° (`tests/ephemeris.test.ts`, con datos guardados). Lo que sí podemos decir con honestidad es que Horizons es nuestra referencia de validación.

**Recomendación:** no integrar. Mantener como referencia y, si se quiere, ampliar los datos de prueba guardados con más sitios.

## 3. Quickmap (ASU/LROC)

- Es una aplicación React con Cesium y OpenLayers. Pide tiles a `lroc-tiles.quickmap.io`.
- **No encontré documentación de API pública.** Usar esos tiles sería depender de un servicio interno sin garantías.
- Moon Trek ofrece capas parecidas con API documentada.

**Recomendación:** no integrar. Dejar el enlace en el modal. No inventé parámetros de URL para abrirlo en una ubicación: no los verifiqué.

## 4. CSA (Agencia Espacial Canadiense)

- Es un portal de contenido, sin API. Aporta contexto: la noche lunar dura unas dos semanas con hasta −200 °C, y las fechas de Artemis son metas que pueden cambiar. Ya está en el modal.
- Los datos de potencia y comunicaciones de Gateway, Canadarm3 y los rovers **no figuran** en las páginas que leí.

## 5. Qué hacer, en orden

1. **Validación de la Tierra** (listo el experimento, falta decidir). Agregar la prueba al repo y una fila en la tabla de validación del README y del modal. Costo: casi cero.
   - Detalle a revisar: en dos de los puntos de muestra la diferencia es grande (−86,81° / 271°: referencia 0,07 contra nuestro 0,41; −88,77° / 195°: 0,15 contra 0,00). Probablemente es resolución del terreno o error de píxel, **pero no lo investigué**.
   - Otra duda: la descripción de Trek dice que el promedio abarca 18,6 años, mientras que la etiqueta de PDS dice 2009–2013. Mi prueba usó 2009–2013 y coincide bien, pero conviene confirmar el período.
2. **Overlay de Moon Trek**, opcional, si queda tiempo.
3. **No hacer:** Horizons en vivo, Quickmap.

Idea fuera de las fuentes externas: Trek publica capas de **pendiente**, pero son imágenes coloreadas. Nuestro propio relieve LOLA de 80 m permite calcular la pendiente directamente y agregar una métrica de seguridad de aterrizaje que hoy no tenemos. No lo probé.

## Archivos del experimento

- `tests/visibility.test.ts`: valida el Sol y la Tierra con una sola prueba parametrizada. Reemplaza a `tests/illumination.test.ts` y a `tests/earth-experiment.test.ts`, que era su copia.
- `scripts/fetch_validation_data.sh`: baja los archivos públicos de LOLA (unos 220 MB) a `data-raw/`.
- `npm run test:validation`: corre la validación y falla si faltan los datos, en lugar de saltearla.

## 6. Revisión: qué cambió después de este análisis

**Error de un píxel al leer los mapas LOLA.** La etiqueta da `LINE_PROJECTION_OFFSET = 2528.5`, que ya es el índice del polo contando desde 0. Las pruebas usaban 2527,5, así que leían cada valor de referencia 60 m corrido en cada eje.

| | Antes | Píxel corregido | Además, promedio de 18,6 años |
|---|---|---|---|
| Tierra | r = 0,894, error medio 3,6 pp | r = 0,966, 2,4 pp | r = 0,968, 1,8 pp |
| Sol | r = 0,921, error medio 2,2 pp | r = 0,966, 1,3 pp | r = 0,967, 1,2 pp |

**Los dos puntos con diferencia grande** eran ese error: en −86,81° / 271° la referencia pasa de 0,07 a 0,47 (nuestro cálculo: 0,45), y en −88,77° / 195° pasa de 0,15 a 0,00 (nuestro: 0,03).

**Período del mapa.** La etiqueta no dice qué período se simuló. Las fechas 2009–2013 son `START_TIME`/`STOP_TIME`, y la etiqueta del relieve empieza en el mismo instante, así que corresponden a las mediciones del altímetro. La prueba ahora promedia un ciclo nodal de 18,6 años; el ajuste mejora un poco, lo que es consistente con la descripción de Trek sin llegar a probarla.

**El mismo tipo de error estaba en la app.** El relieve de 240 m tenía el polo en 1905,0 en vez de 1905,5: medio píxel, 120 m en cada eje. Contra el relieve de 80 m, la diferencia baja de 24,6 m RMS a 3,3 m al corregirlo. **No medido:** cuánto cambian los porcentajes de los sitios que dependen de esa capa.

**Alcance de lo validado.** Los mapas cuentan "cualquier fracción del disco visible". Eso valida la geometría de visibilidad de la Tierra, no el criterio de enlace de la app (disco entero más la máscara de antena), que no tiene mapa de referencia.

**Sigue sin verificar:** términos de uso y límites de Trek, y la alineación de sus tiles con nuestra grilla. Después de este error de registro en datos propios, esa comprobación es obligatoria antes de mostrar un overlay.
