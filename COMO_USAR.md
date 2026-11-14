# Sunline — cómo usarlo y qué probar

Sunline responde una pregunta: **si alunizamos en este sitio, en esta fecha, ¿vamos a tener energía y comunicación directa con la Tierra?**

## Para empezar (1 minuto)

1. **Elegí un sitio** en la lista de la izquierda (o escribí coordenadas en *Coordenadas propias*).
2. **Poné la fecha** arriba (botones −1 mes / −1 d / +1 d / +1 mes). El **veredicto** de la derecha cambia al instante.
3. **Leé el cielo**: ámbar = Sol, azul = Tierra, silueta gris = terreno real. Arrastrá la **línea de tiempo** de abajo (o `Espacio` para reproducir, `←` `→` para avanzar).
4. **Compará y planificá** con las pestañas de arriba: *Comparar* y *Planificador de fechas*.

La barra de arriba tiene **EN / ES**, el botón **claro / oscuro**, la **Guía** y **Método y datos**.

## Qué conviene probar (en este orden)

1. **Haworth** → ¿por qué el Sol da 0%? Es el piso de un cráter que nunca ve la luz. Cambiá a *Superficie 3D*: se ve negro, y el botón *Saltar a la próxima luz solar* lo explica.
2. **Connecting Ridge vs. Malapert** (sumalos con **+** y abrí *Comparar*): ¿cuál mantiene a la Tierra a la vista más tiempo? ¿cuál sufre noches más largas?
3. **“Por qué importan los movimientos chicos”** (abajo en *Comparar*): llevá *Desplazamiento* a 200 m. La misma cresta pasa de iluminada a oscura. Es el argumento central del proyecto.
4. **Planificador de fechas**: sumá 3–4 sitios, pasá a *% con Sol* y mirá el ritmo mensual; hacé clic en una celda verde para abrir esa fecha. Compará **Connecting Ridge** con **Connecting Ridge · Site B**: unos pocos km cambian todo.
5. **Supuestos de la misión** (derecha, tocá el **+**): alterná *Rover solar* / *Módulo* / *Base tripulada*. El mismo sitio puede pasar de *No viable* a *Viable*.
6. **Superficie 3D** → *Mirar a la Tierra* y *Mirar el módulo*. La fase y la rotación de la Tierra son reales para ese instante; la brújula de arriba te orienta.
7. **Mapa polar**: hacé clic en cualquier punto para sondearlo como coordenada propia; el campo de visión se ajusta con el control.
8. **Cambiá a modo claro y a inglés** para ver la app completa en ambos.

## Guion de 3 minutos para la presentación

*Portada* (el Sol girando al polo) → *Navigator* en Connecting Ridge, leer veredicto y horizonte → *Superficie 3D* → *Comparar* con Malapert y el panel de desplazamiento → *Planificador*: “se atrasó el lanzamiento, ¿qué fechas sirven?” → *Método y datos* (validado contra JPL Horizons < 0.005° y contra los mapas de LOLA, r = 0.92).

## Cosas que hay que decir con honestidad

- Hay terreno solo de **75°S a 90°S**; fuera de eso el horizonte es una esfera lisa (la app lo avisa).
- Los sitios con **~** son centros de región, no selecciones oficiales.
- La imagen de portada es una **ilustración** (Sol a 1.6°), no un cálculo de una fecha concreta.
- Es una ayuda de planificación, **no está certificada para vuelo**.

## Correrlo

```bash
cd lunar-landing-site-navigator
npm install
npm run dev      # http://localhost:5173
npm test         # validaciones (Horizons, terreno, iluminación LOLA, traducciones)
npm run build    # sitio estático en dist/
```
