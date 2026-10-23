> **Sinaloa Pro** — editor de vídeo gratuito y de código abierto. Este documento conserva el nombre antiguo, «Corte 15», en las entradas históricas y en el nombre del formato de archivo (`.corte15`), que no cambia para que los proyectos guardados se sigan abriendo.

# Verificación — Sinaloa Pro

Informe de lo que se ejecutó, con qué, qué salió y qué **no** se pudo comprobar. Ninguna función se marca como
verificada sin una ejecución que la respalde; la matriz de estado está en [FEATURES.md](FEATURES.md).

## 1. Entorno de las pruebas

| Elemento | Valor |
|---|---|
| Fecha de la sesión | 9 de octubre de 2026 || Sistema | Windows, navegadores de escritorio en `127.0.0.1` |
| Node.js / npm | v24.15.0 / 12.0.2 |
| MediaBunny | 1.61.3 (decodificación, codificación y multiplexado) |
| Chrome / Edge | Instalaciones reales del sistema, controladas con Playwright (`channel: chrome` / `msedge`) |
| Firefox / WebKit | Binarios de Playwright (`firefox`, `webkit` 27.2) descargados en esta sesión |
| Medios de prueba | Generados con ffmpeg: `Video_A.mp4` (H.264+AAC 320×180), `Video_B.mp4` (H.264), `Audio.wav` (PCM 48 kHz), `corrupto.mp4` |

**No se probó** en macOS ni en Linux, ni con Safari real: solo había un equipo Windows en esta sesión. Las
conclusiones sobre WebKit corresponden al binario de Playwright en Windows y **no deben extrapolarse a Safari**.

## 2. Comandos ejecutados y resultado

| Comando | Resultado |
|---|---|
| `npx tsc --noEmit` | 0 errores |
| `npm test` | **415/415 pruebas correctas** (motor, comandos, mezcla, tomas de audio, medidores, timecode SMPTE, composición, efectos, transiciones, claves, edición de precisión, máscaras, panoramización con el centro de giro, la selección de recorte que acerca, los preestablecidos de recorte, la suavidad de la interpolación, el encaje que cubre el fotograma y el estirado de *Mantener relación de aspecto*, la forma de onda del audio, títulos con las doce animaciones y el karaoke, las posiciones del texto con nombre, plantillas de proyecto, plantillas de texto, subtítulos **agrupados en líneas de k palabras**, composición 3D, región de bucle, lote de renderizado, contenedores reales, ámbito de render, análisis de XML/EDL, `.veg`, puente con VEGAS, WAV, **Pexels por palabra** (partición en palabras con sus tiempos y plan de un clip por palabra) y los interruptores del evento) |
| `npm run build` | Correcto: `dist/index.html` 1,18 kB · CSS 206,74 kB (gzip 34,88 kB) · JS 1 434,20 kB (gzip 409,01 kB) |
| `npm run lint` | 0 errores, 13 avisos (no bloqueantes). Se añadieron `dist`, `test-results` y `playwright-report` a los directorios ignorados, porque el informe HTML de Playwright generaba cientos de avisos que no son código del proyecto |
| `node outputs/probe-encoding.mjs` | 0 archivos con daño de codificación (U+FFFD, doble codificación o BOM) en el código y la documentación |
| `npm run capture:ui` tras cada cambio de interfaz | Las capturas del espacio de trabajo más las de la ventana de recorte (incluida la disposición nueva), la galería de plantillas de texto, los botones de recorte del evento y el pie de la línea de tiempo, generadas sin fallos |
| `npm run serve` tras el build | Sirve `dist/` en `127.0.0.1:5173`: la página y el paquete JS responden 200 y una ruta fuera de `dist/` responde 404 |
| `npx playwright test` (4 proyectos, ronda 19) | **250 correctas, 22 omitidas por capacidad, 0 fallos** en 19,3 min: los 68 flujos corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 22 que necesitan WebCodecs o Web Audio (§2.1.1). La corrida se lanzó con `--trace=off` porque la escritura de trazas de Playwright falla con `ENOENT`/`EPERM` al cerrar el contexto (un problema de la carpeta `test-results` en este equipo, no de la aplicación: los mismos flujos pasan con la traza apagada) |
| `npx playwright test --project=chrome` (ronda 19) | **68/68 correctas** (43 de `browser.spec.ts` + 25 de `parity.spec.ts`), 4,9 min; incluye la prueba nueva del zoom de la vista previa con la rueda, que además comprueba que la caja de las asas coincide con el vídeo en un proyecto horizontal y en uno vertical |
| `npx playwright test --project=webkit` (ronda 19) | **46 correctas, 22 omitidas, 0 fallos**: los flujos que importan medios reales se omiten diciendo qué API falta (WebKit no trae WebCodecs ni Web Audio), en lugar de fallar. La prueba del zoom de la vista previa corre en WebKit, así que la rueda y el desplazamiento del monitor están comprobados también ahí |
| `npx playwright test --config=playwright.diagnostics.config.ts` | Informe de capacidades por motor y **medición de renderizado**: 300 fotogramas a 1280×720 en 5,09 s (≈59 fps de render) |
| `npx playwright test` (4 proyectos, ronda 20) | **254 correctas, 22 omitidas por capacidad, 0 fallos** en 19,8 min: los **69 flujos** (44 de `browser.spec.ts` + 25 de `parity.spec.ts`) corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 22 que necesitan WebCodecs o Web Audio (§2.1.1). Por motor: **Chrome 69/69, Edge 69/69, Firefox 69/69 y WebKit 47 correctas + 22 omitidas**. Corrida con `--trace=off`, por el problema ya conocido de la carpeta `test-results` en este equipo |
| `npx playwright test --project=chrome` (ronda 20) | **69/69 correctas**, 4,9 min; incluye el flujo nuevo de *Mantener relación de aspecto*, que **lee los píxeles del monitor** con la casilla puesta y quitada y comprueba el campo `maintainAspect` del autoguardado |
| `npx playwright test --project=webkit` (ronda 20) | **47 correctas, 22 omitidas, 0 fallos**: los flujos que importan medios reales se omiten diciendo qué API falta (WebKit no trae WebCodecs ni Web Audio), en lugar de fallar. El flujo nuevo de *Mantener relación de aspecto* corre en WebKit (importa un PNG, no necesita códecs) y también pasa ahí |
| `npx playwright test` (4 proyectos, ronda 21) | **258 correctas, 22 omitidas por capacidad, 0 fallos** en 20,1 min: los **70 flujos** (45 de `browser.spec.ts` + 25 de `parity.spec.ts`) corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 22 que necesitan WebCodecs o Web Audio (§2.1.1). Por motor: **Chrome 70/70, Edge 70/70, Firefox 70/70 y WebKit 48 correctas + 22 omitidas**. Corrida con `--trace=off` |
| `npx playwright test --project=chrome` (ronda 21) | **70/70 correctas**, 5,1 min; incluye el flujo nuevo de la **selección de recorte**, que busca la esquina dibujada en los píxeles del monitor, la arrastra (recorte y zoom en el autoguardado), la agranda (aleja) y comprueba que la rueda mueve la vista sin tocar el encuadre |
| WebKit en la corrida de los cuatro proyectos (ronda 21) | **48 correctas, 22 omitidas, 0 fallos** (el desglose sale de la corrida completa de arriba, no de una corrida aparte): los flujos que importan medios reales se omiten diciendo qué API falta (WebKit no trae WebCodecs ni Web Audio), en lugar de fallar. El flujo nuevo de la selección de recorte corre también aquí (importa un PNG, no necesita códecs) |
| `npx playwright test` (4 proyectos, ronda 22) | **262 correctas, 22 omitidas por capacidad, 0 fallos** en 20,6 min: los **71 flujos** (46 de `browser.spec.ts` + 25 de `parity.spec.ts`) corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 22 que necesitan WebCodecs o Web Audio. Por motor: **Chrome 71/71, Edge 71/71, Firefox 71/71 y WebKit 49 correctas + 22 omitidas**. Corrida con `--trace=off`, limpia a la primera |
| `npx playwright test` (4 proyectos, ronda 23) | **265 correctas, 23 omitidas por capacidad, 0 fallos** en 20,7 min: los **72 flujos** (47 de `browser.spec.ts` + 25 de `parity.spec.ts`) corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 23 que necesitan WebCodecs o Web Audio (el flujo de la forma de onda se suma a los que se omiten ahí, porque sin decodificadores de audio no hay onda que medir). Por motor: **Chrome 72/72, Edge 72/72, Firefox 72/72 y WebKit 49 correctas + 23 omitidas**. Corrida con `--trace=off`, limpia a la primera |
| `npx playwright test` (4 proyectos, ronda 24) | **268 correctas, 24 omitidas por capacidad, 0 fallos** en 22,1 min: los **73 flujos** (48 de `browser.spec.ts` + 25 de `parity.spec.ts`) corren enteros en Chrome, Edge y Firefox, y en WebKit se omiten los 24 que necesitan WebCodecs o Web Audio (el de la aguja desde los carriles se suma: importa un MP4 para tener un evento encima). Por motor: **Chrome 73/73, Edge 73/73, Firefox 73/73 y WebKit 49 correctas + 24 omitidas**. Corrida con `--trace=off`, limpia a la primera |
| `npx playwright test` (4 proyectos, ronda 25) | **268 correctas, 24 omitidas por capacidad, 0 fallos** en 20,9 min: los mismos **73 flujos** corren enteros en Chrome, Edge y Firefox y en WebKit se omiten los 24 de siempre. Por motor: **Chrome 73/73, Edge 73/73, Firefox 73/73 y WebKit 49 correctas + 24 omitidas**. Es la corrida que confirma que la optimización de rendimiento y la restricción de la rueda al recuadro del monitor no cambiaron nada de lo que se ve ni de lo que se guarda. La **primera** corrida de la ronda no salió limpia (267 correctas y 1 fallo: los medidores en WebKit, con el primer arrastre sin prender) y se endureció esa prueba con el mismo reintento que ya tenía el segundo arrastre; las tres repeticiones sueltas en WebKit y la corrida completa de arriba salen limpias |
| `npx tsx outputs/probe-3d-rendimiento.ts` | Coste del mapeo 3D por fotograma y por evento girado: 12 ms a 640×360, 46 ms a 1280×720 y 103 ms a 1080p |
| `npm run test:perf` (ronda 25) | **Sonda nueva de rendimiento de la interfaz** (`playwright.perf.config.ts`, fuera de la suite; informe en `outputs/rendimiento-ui.json`): con un montaje de quince eventos mide los fotogramas reales del navegador (`requestAnimationFrame`) reproduciendo, arrastrando la aguja, haciendo zoom con la rueda y en reposo tras editar. **Antes**: reproducción p95 83,4 ms, peor 116,8 ms y 21 fotogramas por encima de 50 ms en 3 s; zoom p95 50,1 ms y 10 fotogramas largos. **Después** (tres corridas, que coinciden): reproducción **p95 16,8 ms, peor 83,2 ms y 2 fotogramas largos**; zoom **p95 50 ms** (el coste del reflow al cambiar el ancho no baja) y **6 fotogramas largos**; arrastre de la aguja p95 16,8 ms con 0 largos; autoguardado sin fotogramas largos |
| `npm run capture:ui` | Capturas en `evidencias/` (`editor-1600x900.png`, `editor-1280x720.png`, `tramo-render.png`, `bucle-region.png`, `exportar.png`, `lote-render.png`, `propiedades-evento.png`, `pancrop-ventana.png`, `pancrop-vegas.png`, `informe-importacion.png`, `grupo-sombreado.png`, `pista-seleccionada.png`, `panoramizacion-boton-*.png`, `titles-plantillas.png`, `pie-1280x720.png`) y comprobación medida de que el pie de la línea de tiempo no recorta ningún control a 1600×900 ni a 1280×720. Otras capturas las toman los propios flujos de navegador en Chrome: `plantilla-tiktok.png`, `menu-clic-derecho.png`, `vista-previa-redimensionar.png`, `pegado-atributos.png`, `bandas-negras.png`, `exportar-marcadores.png`, `audio-por-pista.png`, `relacion-aspecto.png`, `seleccion-recorte.png`, `titles-posiciones.png`, `onda-audio.png`, `onda-trimmer.png` y las de las rondas 18 y 19 (`evento-icono-texto.png`, `titles-editor-cabe.png`, `aguja-regla.png`, `medidores-anchos.png`, `vista-previa-zoom.png`) |

Dos pruebas se endurecieron al hilo de la primera corrida de la ronda 20, que no salió limpia: el desplegable
*Transición de entrada* del diálogo (un `Select` propio, no un `<select>` nativo) se cerraba a veces sin aplicar
la opción elegida cuando la máquina estaba cargada, y ahora se comprueba el texto del disparador y se reintenta
la elección; y el flujo de los medidores agarraba el divisor por la posición que tenía **antes** de ensanchar el
panel, así que el segundo arrastre podía caer al lado del asa y no estrechar nada (falló así en WebKit). Las dos
se volvieron a medir: la corrida de arriba, con los arreglos, sale limpia.

En la ronda 21 la **primera** corrida completa (4 motores) no salió limpia y destapó **dos pruebas frágiles** con
la máquina cargada, ninguna de ellas relacionada con lo que se estaba cambiando: dio **256 correctas y 2 fallos**
—las plantillas de proyecto en Firefox y los medidores en WebKit—. El flujo de las plantillas elegía la opción del
desplegable mientras la lista anterior aún se estaba retirando (y el clic podía caer en la que se cierra y cerrar
la ventana), y el de los medidores podía perder el segundo «down» al caer en el mismo punto donde acababa de
haber un «up». Ahora la plantilla espera a que la lista esté **una sola vez** en el documento y el arrastre de los
medidores se reintenta midiendo otra vez el divisor; con los dos arreglos, la **segunda** corrida completa (la de
la tabla: 258 correctas) y la de Chrome sola (70/70) salen limpias, y las dos pruebas arregladas se comprobaron
además por separado en su motor (Firefox y WebKit).

### 2.1 Suite funcional en navegador (`tests/browser.spec.ts`)

| Prueba | Chrome | Edge | Firefox | WebKit |
|---|---|---|---|---|
| Flujo real: 2 videos + audio, recorte, dividir, texto, fundido, guardar, reabrir, exportar | ✅ 14,8 s | ✅ 15,6 s | ✅ 21,6 s | ⏭️ omitida (sin WebCodecs ni Web Audio) |
| Archivo corrupto con extensión `.mp4` produce un error comprensible | ✅ | ✅ | ✅ | ✅ |
| La exportación se puede cancelar y volver a iniciar | ✅ | ✅ | ✅ | ⏭️ omitida (sin codificadores: se comprueba el aviso y el bloqueo del botón) |
| Exportación a 1280×720 con resolución, audio y texto reales | ✅ 4,8 s | ✅ 4,8 s | ✅ 7,9 s | ⏭️ omitida |
| Un clic en un evento lo selecciona y coloca la aguja en ese punto | ✅ | ✅ | ✅ | ⏭️ omitida (no puede importar el MP4) |
| La rueda del ratón hace zoom horizontal sobre la línea de tiempo | ✅ | ✅ | ✅ | ✅ |
| Renderiza solo el tramo seleccionado (duración del archivo comprobada) | ✅ 4,3 s | ✅ 4,4 s | ✅ 6,4 s | ⏭️ omitida |
| Importa un XML exportado por VEGAS, informa y sombrea el grupo de audio y video | ✅ | ✅ | ✅ | ✅ |
| Importa un EDL CMX 3600 con sus pistas y eventos | ✅ | ✅ | ✅ | ✅ |
| Un `.veg` se rechaza explicando por qué y cómo exportarlo desde VEGAS | ✅ | ✅ | ✅ | ✅ |
| Un `.veg` se analiza con sus datos reales y se declara qué no se reconstruye | ✅ | ✅ | ✅ | ✅ |
| Un `.veg` que solo imita la firma avisa en vez de inventar datos | ✅ | ✅ | ✅ | ✅ |
| El botón «Generar subtítulos» está en la barra del panel de medios, junto al buscador | ✅ | ✅ | ✅ | ✅ |
| Subtítulos generados: `.srt` en Medios de proyecto y eventos en la línea de tiempo | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores de audio) |
| Recursos de Pexels descargados, colocados en la línea de tiempo y en Medios de proyecto | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| Recursos colocados según la transcripción, una palabra cada uno | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| El proyecto se recupera solo al recargar la página | ✅ | ✅ | ✅ | ✅ |
| Un medio faltante se revincula con su archivo y deja de faltar | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| El bucle de reproducción repite el tramo cuando no hay región de bucle | ✅ | ✅ | ✅ | ⏭️ omitida (sin Web Audio) |
| Avisa cuando no hay espacio local para guardar la copia de los medios | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| Exportación solo audio (WAV) y solo vídeo, con ffprobe | ✅ | ✅ | ✅ | ⏭️ omitida (sin codificadores) |
| La aguja se puede arrastrar manteniendo el clic | ✅ | ✅ | ✅ | ✅ |
| La aguja se agarra desde los carriles y se arrastra sin tocar el evento de debajo | ✅ | ✅ | ✅ | ⏭️ omitida (no puede importar el MP4) |
| La pista seleccionada se sombrea, también su carril | ✅ | ✅ | ✅ | ✅ |
| Arrastrar en un hueco de la línea de tiempo crea el tramo (y los tiradores lo ajustan) | ✅ | ✅ | ✅ | ✅ |
| Ctrl + rueda desplaza la línea de tiempo de arriba abajo | ✅ | ✅ | ✅ | ✅ |
| La región de bucle se marca con Ctrl, se ajusta con sus tiradores y repite la reproducción | ✅ 9,3 s | ✅ | ✅ | ⏭️ omitida (sin Web Audio) |
| Lote: dos trabajos en la cola se renderizan en serie y se descargan | ✅ 6,0 s | ✅ | ✅ | ⏭️ omitida (sin codificadores) |
| Panoramización y recorte: la ventana se organiza como la de VEGAS | ✅ 6,4 s | ✅ | ✅ | ✅ |
| Panoramización y recorte: la ventana flotante se mueve y se redimensiona | ✅ 8,9 s | ✅ | ✅ | ✅ |
| Cada evento de vídeo lleva el botón de Panoramización y recorte en su barra, y los de audio no | ✅ 2,0 s | ✅ 2,0 s | ✅ 2,9 s | ✅ 2,7 s |
| Panoramización y recorte: barra de herramientas, grupos plegables, candado y centro de giro | ✅ | ✅ | ✅ | ✅ |
| Plantillas de proyecto: TikTok, Reels y Shorts son verticales 1080×1920 | ✅ | ✅ | ✅ | ✅ |
| El clic derecho abre el menú del editor en toda la línea de tiempo (y no el del navegador) | ✅ | ✅ | ✅ | ✅ |
| Plantillas de texto estilo CapCut: se aplican, se pintan en el monitor y no se mezclan | ✅ | ✅ | ✅ | ✅ |
| Copiar y pegar los atributos de un clip en otro, y elegir qué grupos | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| La vista previa redimensiona el recurso seleccionado (escalar, mover y recortar) | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores) |
| Quitar bandas negras: detecta la banda incrustada en la imagen y la recorta | ✅ | ✅ | ✅ | ✅ |
| Mantener relación de aspecto: quitarla estira el material hasta cubrir el fotograma | ✅ | ✅ | ✅ | ✅ |
| La selección de recorte: las esquinas recortan y acercan, y la rueda acerca la vista | ✅ | ✅ | ✅ | ✅ |
| Las posiciones del texto: centrado, arriba, abajo y el tercio inferior colocan el texto | ✅ | ✅ | ✅ | ✅ |
| La forma de onda del audio: una columna por píxel, leída del sonido y con la línea del cero | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores de audio) |
| Exportar los marcadores: capítulos para YouTube, CSV, XML y subtítulos .srt | ✅ | ✅ | ✅ | ✅ |
| Una salida por pista de audio: la cola recibe un trabajo WAV por pista | ✅ | ✅ | ✅ | ⏭️ omitida (sin decodificadores de audio) |
| Las pistas se mueven de sitio: menú, `Alt`+flechas y arrastre (con deshacer) | ✅ | ✅ | ✅ | ✅ |
| La línea de tiempo no deja hueco a la derecha en ventanas anchas | ✅ | ✅ | ✅ | ✅ |

Las omisiones son intencionadas y explícitas: la prueba comprueba primero las APIs y, si faltan, informa qué
API falta en lugar de fallar como si fuera un defecto del editor.

### 2.1.1 Resultado por motor (ronda 13)

Los 62 flujos (38 de `browser.spec.ts` y 24 de `parity.spec.ts`) se ejecutan en los cuatro motores. Cada uno
comprueba antes las APIs que necesita y, si no están, se omite diciendo cuál falta.

| Motor | Superadas | Omitidas | Fallos | Motivo de las omisiones |
|---|---|---|---|---|
| Chrome | 62 | 0 | 0 | Motor de referencia |
| Edge | 62 | 0 | 0 | Mismo motor Chromium |
| Firefox | 62 | 0 | 0 | Detecta VP9/Opus en lugar de H.264/AAC y elige WebM solo (el flujo del lote comprueba esa variante) |
| WebKit (Playwright) | 40 | 22 | 0 | Sin WebCodecs (`VideoDecoder`/`AudioDecoder`/`VideoEncoder`) ni Web Audio (`AudioContext`): se omiten los flujos que importan MP4 o WAV y los que reproducen o renderizan audio |
| **Total** | **226** | **22** | **0** | 17,3 min en una sola corrida de los cuatro proyectos |

Los flujos de la región de bucle y del lote de renderizado se omiten en WebKit por la misma razón: los dos
reproducen o codifican audio. El resto de las ventanas nuevas (Pan/Crop con su barra de herramientas, títulos
con la galería de plantillas, efectos, generadores, transiciones, claves, zoom anclado, subtítulos desde `.srt`
y máscaras libres) sí se ejecuta en WebKit y pasa, igual que el menú del clic derecho y las plantillas de
proyecto, que no dependen de códecs.

### 2.2 Qué comprueba exactamente el flujo completo

1. Importa dos MP4 y un WAV por el selector de archivos y espera a que aparezcan los 3 elementos.
2. Inserta video A, video B y audio; recorta A a 2,5 s desde el diálogo de propiedades.
3. Divide con la tecla `S`, deshace con `Ctrl+Z` y rehace con `Ctrl+Y`, verificando el recuento de eventos.
4. Añade un título con el generador de texto, con fundido de entrada y de salida.
5. Reproduce y pausa, comprobando que el timecode avanzó.
6. Descarga el `.corte15`, lo reabre desde el disco y verifica que el número de eventos coincide y que el
   editor informa de que el proyecto se restauró.
7. Exporta a 320×180 y verifica el archivo resultante con **ffprobe** (pista de video + pista de audio,
   duración > 4,9 s) y con **ffmpeg** (pico de audio > 0,03; extracción de un fotograma).
8. Comprueba que no hubo ningún error de página durante todo el recorrido.

La cuarta prueba exporta a **1280×720** y verifica además con ffprobe que el archivo tiene exactamente esa
resolución, y con ffmpeg que el fotograma de 1,5 s contiene píxeles casi blancos del texto dibujado: es decir,
que el texto no solo existe en el modelo, sino en los píxeles del archivo exportado.

Otras dos pruebas cubren el tramo y las interacciones nuevas: una marca un tramo de 2 s con los botones `[` y
`]`, comprueba que el diálogo cambia solo al ámbito «Tramo» y que el archivo exportado dura esos 2 s; la otra
comprueba que un clic en un evento lo selecciona y mueve la aguja, y que la rueda cambia el ancho de la línea
de tiempo en ambos sentidos.

La prueba de la región de bucle marca el bucle con `Ctrl` y arrastrar sobre un hueco (sin crear tramo), lo
ajusta ±1 s con su tirador, comprueba que el autoguardado lleva el rango en ticks, lo activa con `Alt+L`,
reproduce 4,2 s con un bucle de 2 s para ver que el cursor sigue dentro de la zona, copia el tramo al bucle con
el botón *Desde tramo* y lo quita con `Ctrl+Mayús+L` sin tocar el tramo.

La prueba del lote prepara dos trabajos en la cola (un vídeo de 160×90 y un WAV), comprueba la lista (etiqueta,
nombre de archivo, estado y resumen de fotogramas), pulsa *Renderizar la cola* y espera **dos descargas**:
verifica los nombres (`Sin título--MP4 160x90 30 fps.mp4` y `Sin título--WAV solo audio.wav`), que los dos
trabajos quedan en «Hecho» y, con ffprobe, que el primero tiene pista de vídeo y dura lo que el proyecto (1 s) y
el segundo solo tiene audio.

### 2.3 Evidencias generadas

| Archivo | Qué demuestra |
|---|---|
| `test-results/.../Sin título.mp4` (Chrome, Edge) | MP4 H.264/AAC real, decodificable por ffmpeg |
| `test-results/.../Sin título.webm` (Firefox) | WebM VP9/Opus real: la alternativa se elige automáticamente cuando no hay AAC |
| `test-results/.../roundtrip.corte15` | Proyecto descargado y reabierto; conserva eventos, efectos y referencias |
| `test-results/.../export-frame.png` | Fotograma extraído del archivo exportado |
| `evidencias/editor-1600x900.png`, `editor-1280x720.png` | Espacio de trabajo real a dos tamaños de escritorio |
| `evidencias/tramo-render.png` | Tramo dibujado sobre la regla con su duración, controles `[`/`]` en el pie y aviso en la barra de estado |
| `evidencias/bucle-region.png` | Tramo y región de bucle a la vez sobre la regla (barra clara abajo, verde arriba), grupo *Bucle* del pie y estado con «(activo)» |
| `evidencias/pie-1280x720.png` | El pie de la línea de tiempo a 1280×720: envuelve en dos filas y no recorta ningún control (comprobado con medidas en `tests/screens.spec.ts`) |
| `evidencias/lote-render.png` | Lote de renderizado: cinco trabajos preparados (uno a mano y las cuatro plantillas del motor) con su etiqueta, su nombre de archivo, su estado y el resumen de fotogramas |
| `evidencias/pancrop-ventana.png` | Ventana de Panoramización y recorte como la de VEGAS: barra de título con `ƒx`, fila de preestablecido, parámetros a la izquierda (Posición, Rotación, Recorte) con los valores en píxeles del proyecto, monitor sobre el tablero de cuadros, tira de fotogramas clave y barra inferior con las claves |
| `evidencias/exportar.png` | Diálogo de renderizado: plantilla, ámbito con tramo, resolución, calidad, bitrate, salidas, salida prevista y barra de progreso |
| `evidencias/propiedades-evento.png` | Diálogo de propiedades del evento (Pan/Crop y efectos) |
| `evidencias/propiedades-replica-vegas.png` | Pestaña **Evento de vídeo** de la ventana «Propiedades» replicada de VEGAS 15: nombre de toma activa, grupo Modificadores con sus interruptores, los tres botones de re-muestreo, el ajuste al fotograma del proyecto, la velocidad de reproducción y la velocidad de inframuestreo (capturada por el flujo de navegador en Chrome) |
| `evidencias/propiedades-replica-medios.png` | Pestaña **Medios** de la misma ventana: nombre de archivo, nombre de cinta, grupo Código de tiempo y las diez filas de *Propiedades de reproducción* |
| `evidencias/menu-clic-derecho.png` | Menú del clic derecho del editor: en la ronda 16 pasa a ser el del evento de VEGAS 15, con sus submenús «▸» |
| `evidencias/evento-icono-texto.png` | Barra de los eventos de texto y de los subtítulos con la chapa del editor de texto (la pantalla con la página), delante del botón de recorte y del `ƒx` |
| `evidencias/aguja-regla.png` | La aguja como la de VEGAS —cabeza de flecha en la regla y línea por todas las pistas— con el tramo marcado después de moverla desde la franja de abajo de la regla |
| `evidencias/titles-editor-cabe.png` | El editor de texto en dos columnas: vista previa a la izquierda, ajustes a la derecha y las acciones al pie, todo dentro de la pantalla |
| `evidencias/medidores-anchos.png` | El panel de medidores ensanchado arrastrando su divisor: las barras siguen dentro y la nota de sonoridad se lee en tres líneas en vez de nueve |
| `evidencias/vista-previa-zoom.png` | La vista previa al 182 % después de girar la rueda: el fotograma se agranda, el monitor queda desplazable y el encuadre del evento sigue en el 100 % |
| `evidencias/pancrop-vegas.png` | La ventana de Panoramización y recorte con lo de la ronda 17: las migas `[‹] Panoramización/Recorte [›]` con el candado, los números con el formato de VEGAS (`1,920.0`, `1,080.0`, `960.0`, `540.0`), el recuadro del contenido **estarcido** con su trama de puntos, el círculo del centro de giro y la fila de preestablecidos con los botones de guardar y borrar |
| `evidencias/subtitulos.png` | Subtítulos generados: `.srt` en Medios de proyecto y eventos en la pista «Subtítulos» |
| `evidencias/subtitulos-palabras.png` | El diálogo **Generar subtítulos** preguntando *Palabras por subtítulo*, con «2 palabras» elegido, la explicación del reparto y los botones *Transcribir y crear subtítulos* / *Cancelar* |
| `evidencias/recursos-transcripcion.png` | Recursos de Pexels colocados **una palabra cada uno**: nueve eventos seguidos en la pista «Pexels» (uno por palabra de la transcripción, el del centro con sus asas) y el mensaje que resume la cobertura: «9 de 9 palabra(s) con su clip… 4 clip(s) distinto(s) para 4 término(s)» |
| `evidencias/subtitulos-reales.png` | Transcripción real de Groq dentro del editor: el texto aparece compuesto en la vista previa y en la pista «Subtítulos» |
| `tests/fixtures/voz-prueba.wav`, `tests/live.spec.ts` | Voz de prueba y prueba contra los servicios reales (`npm run test:live`) |
| `ANALISIS-VEG.md` | Análisis completo del `.veg` del usuario, con la estructura de bloques y todo lo leído |
| `ANALISIS-REA-VEG.md` | REA del formato `.veg` (contenedor de bloques, tabla de clases del serializador en el ejecutable, comparación de tres proyectos) y de `vegas150.exe` (PE, 24 DLL importadas, recursos, versión, flujo de carga y límites de la automatización), con la evidencia REA y las observaciones con herramientas corrientes separadas |
| `outputs/rea/veg-*.json`, `pe-vegas150.json`, `exe-*.json/.txt`, `rea-*.json` | Las evidencias en bruto de ese análisis y los guiones que las producen (§9 de `ANALISIS-REA-VEG.md`) |
| `tests/fixtures/vegas-real.veg` | El `.veg` real del usuario, usado por las pruebas del lector |
| `evidencias/informe-importacion.png` | Informe que se muestra al importar un proyecto de intercambio |
| `evidencias/grupo-sombreado.png` | Video seleccionado y su audio agrupado sombreado a la vez |
| `tests/fixtures/vegas-montaje.xml`, `vegas-montaje.edl` | Proyectos de intercambio usados por las pruebas unitarias y por el E2E |
| `tests/fixtures/proyecto-ejemplo.veg` | Solo la firma `riff.`: comprueba la detección y el rechazo explicado, no es un proyecto real |
| `test-results/browser-exportación-a-1280-…/Sin título.mp4` (Chrome, Edge, 60,6 kB) y `Sin título.webm` (Firefox, 19,8 kB) | Exportación a 1280×720 real en los tres motores, con el formato que cada uno detecta |
| `test-results/browser-renderiza-solo-el-tramo…/Sin título (tramo).mp4` y `.webm` | Renderizado limitado al tramo: el nombre del archivo y su duración (2 s) lo confirman |

## Arrastres sobre la línea de tiempo (medios y transiciones)

Ronda de dos funciones nuevas, verificada con las pruebas del proyecto:

- **Soltar un medio sin pista de su clase crea la pista.** La decisión vive en `lib/editor/drop-targets.ts`
  (`planMediaDrop`) y la usa `insertMedia`, así que la misma regla vale para el arrastre, el doble clic y el
  menú. Cubierto por `tests/drop-targets.test.ts` (8 casos) y por `tests/arrastres.spec.ts`: se borra la pista
  de audio, se suelta el audio en el hueco de la línea de tiempo y la pista reaparece con el clip dentro.
- **Transiciones arrastradas al borde de un clip.** `lib/editor/transition-drop.ts` decide el destino: mitad
  izquierda es la entrada del clip; mitad derecha con otro clip pegado es el corte, o sea la entrada del
  siguiente; mitad derecha sin vecino es `transitionOut` del propio clip, que el compositor dibuja con el
  progreso espejado sobre el fundido de salida.
- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test` (358 pruebas), `npm run lint` (los mismos 4
  errores y 16 avisos previos, ninguno nuevo de esta ronda), `npm run build` (correcto),
  `npx playwright test --project=chrome tests/arrastres.spec.ts` (4 correctas) y, para comprobar que no se
  rompió lo anterior, las pruebas de arrastre de la regla, de la aguja desde los carriles y de reordenar pistas
  (4 correctas) más la de transiciones desde la pestaña (`parity.spec.ts`, 1 correcta).

## Archivos del explorador arrastrados al editor

Soltar archivos del explorador de Windows **sobre la línea de tiempo** ahora hace las dos cosas de una vez:
**Regla de la pista nueva.** Si el puntero no está sobre ninguna pista —la regla o el hueco por debajo de todas
las pistas—, se crea una **pista nueva de la clase del material, aunque ya existan otras de esa clase**: es lo
que se espera al arrastrar ahí y evita mezclar el recurso con lo que ya había (si es de audio, pista de audio; si
es de vídeo o una imagen, pista de vídeo). Si se suelta **sobre una pista**, se usa esa (o una compatible) y no se
crea nada. Al soltar varios archivos de una vez, los del mismo tipo comparten una sola pista nueva. Probado en
`tests/drop-targets.test.ts` (4 casos nuevos) y en `tests/arrastres.spec.ts` (hueco de abajo con audio y regla
con vídeo: la cuenta de pistas sube de 3 a 5 y cada clip cae en la pista recién creada).




El soltado vale en **toda la sección de la línea de tiempo**, no solo sobre su contenido: también sobre los
**encabezados de pista** (el clip va a esa pista) y sobre el **hueco del contenedor con scroll** cuando el
contenido no lo cubre, que es el caso de un proyecto **sin pistas**: ahí se crean las pistas que el material
necesita. Las dos zonas que fallaban se cubren con una prueba más en `tests/arrastres.spec.ts`.


importa el archivo y lo coloca como clip en el punto donde se suelta (uno detrás de otro si se sueltan varios),
en la pista que corresponda y creándola si el proyecto no tiene ninguna de su clase. Soltarlos en cualquier otra
zona del editor sigue importándolos sin colocarlos, como antes. La importación es la misma de siempre
(`importFiles`): decodifica, mide, guarda la copia local si cabe y lo añade al panel de medios; lo nuevo es la
opción `{insertAt, lane}` y el reconocimiento del arrastre de archivos (`Files`) en `dragging()`.

- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test`, `npm run lint` (sin avisos nuevos),
  `npm run build`, y `npx playwright test --project=chrome tests/arrastres.spec.ts` (**6 correctas**): las dos
  nuevas sueltan un `File` real leído del disco dentro de un `DataTransfer` —una sobre la línea de tiempo
  (se importa, se crea la pista que falta y el clip empieza donde se soltó) y otra sobre el panel de medios
  (se importa pero no se coloca nada)—.
- **Captura**: `evidencias/arrastre-archivo-del-explorador.png`.

## Arrastrar un evento que ya está en la línea crea pistas nuevas

Un evento **que ya está** en la línea de tiempo se puede llevar al límite de arriba (la regla) o al hueco de
debajo de la última pista: al soltarlo ahí se crea una **pista nueva de su clase** en ese extremo —audio arriba o
abajo según el material; vídeo, imagen o texto a una pista de vídeo— y el clip se muda a ella con su tiempo
intacto. Un grupo enlazado (vídeo + su audio) crea una pista por cada clase. La pista creada mantiene su
identificador durante todo el gesto, para que el carril no se recree en cada movimiento.

De paso se corrigieron tres cosas que lo impedían:

- El gesto descartaba los movimientos **verticales** (el umbral solo miraba la X), así que bajar un clip a otra
  pista no hacía nada.
- El **arrastre nativo** del navegador sobre las imágenes y el SVG de la onda cancelaba el gesto del editor; ahora
  está apagado en las filas.
- Sobre la línea de la aguja, el agarre de la aguja se comía el gesto del clip: ahora, sobre un clip, decide el
  **primer movimiento** (horizontal: la aguja, como hasta ahora; vertical: el clip).
- El objeto de acciones de las filas era nuevo en cada repintado y las filas memoizadas se quedaban con el viejo
  (llamaban a funciones con el proyecto anterior); ahora es un objeto estable cuyas propiedades se actualizan.

- **Comprobado**: `npx tsc --noEmit`, `npm test` (362), `npm run lint` (sin avisos nuevos), `npm run build`,
  `npx playwright test --project=chrome tests/arrastres.spec.ts` (**9 correctas**, incluida la nueva de bajar el
  audio y subir el vídeo) y las cinco pruebas de la aguja y del arrastre en la regla (`tests/browser.spec.ts`),
  que siguen en verde.
- **Captura**: `evidencias/arrastrar-evento-crea-pista.png`.

## Borrar una mitad de un tramo dividido y mover la otra: el tramo borrado no vuelve

El fallo que se reportó: dividir un tramo en dos, borrar una de las mitades y **mover** la otra hacía reaparecer la
mitad borrada. La causa que se encontró leyendo los gestos es de clase: cada gesto guardaba como «estado de
partida» el proyecto del **repintado** en el que se enganchó el puntero (`p`), no el que hay en ese instante en
`pRef.current`; y varios gestos lo **volvían a escribir entero** al terminar o al cancelarse (`replace(...)`), con
lo que cualquier edición hecha entre medias —un borrado, otra división— se perdía y reaparecía material ya
eliminado. En la barra de opacidad era el caso extremo: cancelar el gesto restauraba el proyecto viejo completo.

Lo corregido, en `components/editor/editor.tsx`:

- Los cinco gestos que copian el proyecto al empezar (mover y recortar un evento, los dos extremos del tramo y del
  bucle, y el alto de una pista) copian ahora `pRef.current` (`clone(pRef.current ?? p)`), que es el proyecto
  vigente y no el del repintado.
- `previewOpacity` escribe sobre el proyecto vigente y, si el evento ya no existe, no hace nada.
- `endOpacity(cancel)`, al cancelar, ya **no** restaura el proyecto entero: devuelve solo la opacidad de **ese**
  evento sobre el proyecto vigente, de modo que un borrado o una división hechos durante el gesto se conservan.

- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test` (**362/362**), `npm run lint` (los mismos 21 problemas
  de siempre: 4 errores y 17 avisos, ninguno nuevo), `npm run build` correcto y
  `npx playwright test --project=chrome tests/arrastres.spec.ts` (**11 correctas**: las 9 anteriores más dos nuevas
  de regresión, «dividir, borrar la mitad segunda y mover la otra…» y «…la primera…»).
- **Lo que no se pudo comprobar**: el síntoma **no** se reprodujo con las pruebas automatizadas ni con guiones de
  sondeo que repiten el caso (borrar la mitad segunda y mover la primera, borrar la primera y mover la segunda, sin
  pausa entre el borrado y el arrastre, borrado con el menú contextual en vez de `Supr`, arrastre vertical a otra
  pista y arrastre fuera de las pistas creando una pista): en todos el tramo borrado siguió borrado también con el
  código anterior, así que las dos pruebas
  nuevas son una **guarda** contra la clase de fallo (restaurar una copia vieja del proyecto), no una reproducción
  del síntoma. Si vuelve a aparecer, hacen falta los pasos exactos o una grabación para clavarlo.
- **Evidencia**: `evidencias/division-borrado-sin-reaparecer.png` (tras dividir en `00:00:01:15`, borrar la mitad
  derecha y arrastrar la izquierda 80 px: el proyecto guardado queda en **2 eventos · 3 pistas**, un vídeo y su
  audio enlazado, y en la línea de tiempo se ve un único tramo de vídeo).

## Onda de la línea de tiempo: se quita el barrido de PCM que trababa el editor

Corrección pedida por el usuario, y con razón: el editor se trababa y quien lo resolvió fue otro asistente (Codex);
en mi ronda anterior, para dejar en verde una prueba mía, **volví a poner** `pcm={pcm}` en la fila del evento
(commit `ca542e3`), y con eso regresó el barrido de muestras decodificadas por fila y por repintado. No me lo había
pedido nadie y deshacía un arreglo ajeno.

Lo cambiado (en el árbol de trabajo, sin commitear):

- `components/editor/editor.tsx`: la fila ya **no** recibe `pcm` (ni se calcula `library.current.items.get(...)?.pcm`
  en el recorrido de eventos).
- `components/editor/timeline-event-row.tsx`: se quita la propiedad `pcm` y la onda se dibuja solo con
  `media.peaks` (1024 picos por canal), que es lo que se guarda en el proyecto.
- `tests/browser.spec.ts`: la prueba de la forma de onda fija ahora `data-waveform-source="guardado"` en la línea de
  tiempo, en vez de aceptar `pcm`.

- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test` (**362/362**), `npm run build` correcto,
  `npx playwright test --project=chrome tests/browser.spec.ts -g "la forma de onda del audio"` (**1 correcta**, con
  la silueta real: picos arriba y abajo y pausas en la línea del cero) y `tests/arrastres.spec.ts` (**11
  correctas**).
- **Medido** (`node --experimental-strip-types` sobre el módulo real, con `tests/fixtures/Audio.wav` a 48 kHz
  estirado a 60 s y 240 columnas por fila, 40 repintados seguidos; banco en `outputs/banco-onda.mjs`):
  barrido de PCM **0,444 ms de media y 0,982 ms p95** por fila y repintado, frente a **0,039 ms y 0,099 ms** con los
  picos guardados: unas **11 veces menos**. Con veinte filas de audio en pantalla es la diferencia entre ~9 ms y
  ~0,8 ms de trabajo por repintado.
- **Lo que no se pudo comprobar**: no he reproducido el «trabado» completo en un banco de interfaz propio ni puedo
  atribuirme su arreglo; el número de arriba es el coste por fila y repintado del camino que se quita. El trabajo en
  curso de Codex sobre lo mismo (`lib/editor/waveform-source.ts`, `trimmer.tsx`, `timeline-event-row.tsx`) queda en el
  árbol sin tocar y **sin commitear**, para no volver a barrer cambios ajenos.

## Barra de transporte y edición copiada de Vegas Pro 15, con sus atajos

Se copió la barra de la captura del usuario: los botones de reproducción y grabación, las cuatro herramientas de
edición, los interruptores y los marcadores. Los nombres de los botones salen de la tabla del manual de Vegas Pro 15
en español («Barra de herramientas de transporte y edición», páginas 28-30, y «Herramienta de edición», página 17) y
los atajos de la tabla «Métodos abreviados de teclado» (páginas 636-651) del mismo manual. El archivo
`lib/editor/shortcuts.ts` se reescribió para que sus teclas sean **las del manual**, no las que tenía el editor.

Una comprobación que cambió el resultado: la captura del usuario y las páginas del manual describen **una** barra
(«transporte y edición»), pero la fila de iconos grises del centro de la captura no aparece en ninguna de las tablas
del manual; por eso no se inventaron: se dejaron fuera y quedan anotadas abajo como pendientes de que el usuario
diga qué son (en su Vegas están deshabilitados y el manual no los documenta).

Qué hace cada botón (comprobado en el navegador, no solo pintado):

- **Transporte**: reproducir en bucle (Q), reproducir (Espacio), pausa (Entrar), detener (Esc), ir al inicio y al
  final (Inicio/Fin, Ctrl+Inicio/Ctrl+Fin), reproducir desde el inicio (Mayús+Espacio, y el cursor vuelve a donde
  estaba al detener), fotograma anterior y siguiente (Alt+flecha en el manual; ver la nota de conflictos).
- **Herramientas**: normal (Ctrl+D), envolventes, selección (rectángulo) y zoom (clic acerca, Alt+clic aleja,
  arrastrar encuadra el tramo).
- **Interruptores**: ajuste (F8), fundidos automáticos (Ctrl+Mayús+X), rizo (desplegable con los tres modos), bloquear
  envolventes a los eventos, ignorar la agrupación (Ctrl+Mayús+U) y cuantizar a fotogramas (Alt+F8). Los fundidos
  automáticos pasan a estar **encendidos por defecto**, como en Vegas: antes el editor creaba el cruce siempre.
- **Marcadores**: insertar marcador (M) e insertar región (R).
- **Grabar** (Ctrl+R en el manual): deshabilitado, con la explicación en su rótulo. Corte 15 no graba audio ni vídeo, y
  capturar Ctrl+R se llevaría por delante la recarga de la página, así que no se captura.

Lo que **no** se igualó, y por qué:

- **Alt+←/→** (fotograma en el manual): el navegador se queda con esa combinación para su historial. Se midió con
  Chrome: el evento llega a la página con `altKey`, pero la navegación ocurre igualmente. Se mantiene en el mapa (el
  rótulo lo anuncia) y, para que el paso fino funcione de verdad en el navegador, **←/→** hacen lo que el manual llama
  «un píxel», que con la cuantización a fotogramas encendida es **un fotograma**.
- **Ctrl+T** (recortar a la selección): el navegador lo usa para abrir pestaña; el editor lo captura mientras tiene el
  foco, como hace Vegas, y así queda documentado.
- **Ctrl+R** (grabar): no se captura (ver arriba).
- Las envolventes de pista existen (volumen y panorámica) y «bloquear envolventes a los eventos» desplaza los puntos
  que caen dentro del evento movido; no se replicó el resto de la automatización de Vegas (grabar automatización, buses).

- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test` (**377/377**, con `tests/timeline-tools.test.ts` y
  `tests/shortcuts.test.ts` reescrito contra las tablas del manual), `npm run lint` (los mismos 21 problemas de
  siempre: 4 errores y 17 avisos), `npm run build` correcto y
  `npx playwright test --project=chrome tests/barra-vegas.spec.ts` (**5 correctas**: los 21 botones con su rótulo y su
  atajo, los interruptores con F8 / Ctrl+Mayús+X / Alt+F8 / Ctrl+Mayús+U / Q, M y R guardados en el proyecto, las
  teclas de herramienta y zoom, y el rectángulo de selección y el clic de zoom sobre la línea de tiempo).
- **Evidencia**: `evidencias/barra-vegas-15.png` (la barra sola) y `evidencias/barra-vegas-15-en-editor.png` (la barra
  encima de la línea de tiempo, con un montaje abierto). Los iconos del manual se descargaron para contrastarlos
  (`outputs/vegas-icons/`) y están en `outputs/vegas-iconos-rejilla.png`.
- **La suite de navegador completa** (`tests/browser.spec.ts`, Chrome): **41 correctas y 7 fallos**. Dos de esos fallos
  vienen del trabajo que otro asistente tiene a medias en este mismo árbol: el guardado del proyecto ya no descarga el
  archivo sino que escribe con la API de acceso al sistema de archivos (`lib/editor/project-file.ts`, 09:50 de hoy) y la
  onda está a medio cambiar (`waveform-source.ts`), así que el flujo real espera una descarga que ya no llega y la
  prueba de la forma de onda mira una fuente que se está moviendo. Los otros cinco son los flujos de Pan/Crop, vista
  previa y atributos que ya fallaban en la línea base (15 fallos en la suite completa antes de esta ronda) y que esta
  ronda no toca. **No commiteo nada**: los archivos compartidos (`editor.tsx`, `timeline-event-row.tsx`, la onda) tienen
  cambios en curso de ese otro asistente y no quiero volver a barrerlos.
- **Pendiente de que lo aclare el usuario**: los cinco iconos grises centrales de su captura (una X y cuatro recuadros
  con trama) no están en ninguna tabla del manual y en su Vegas aparecen deshabilitados; si son «fundido de entrada,
  fundido de salida, fundido cruzado y cortar», se añaden en la siguiente ronda.

## Mayús+clic selecciona el rango, y pegar atributos alcanza a toda la selección

Dos comportamientos que se pidieron y que el editor no tenía:

1. **Mayús+clic = rango, dentro de la pista.** El clic sin modificadores fija el **ancla**; **Mayús+clic** en otro
   evento selecciona lo que queda entre los dos (**el tramo que los une y los eventos que lo tocan, pero solo de la
   pista del evento pulsado**; los de otras pistas entran únicamente si van agrupados con los elegidos), y
   **Ctrl/Comando+clic** sigue sumando o quitando eventos de uno en uno, que es lo que dice el manual en «Edición y
   selección de eventos» («Seleccionar rango: Mayús+hacer clic en eventos»; «Seleccionar múltiple: Ctrl+hacer clic»).
   Los grupos enlazados (el audio que va con su vídeo) entran con el rango, salvo que esté encendido «ignorar la
   agrupación»; el ancla se mueve cuando se hace clic sin Mayús, así que el siguiente rango se cuenta desde ahí.
   Corregido tras la primera versión, que arrastraba los eventos de todas las pistas: un audio suelto dentro del tramo
   ya no se selecciona, y sigue entrando su compañero de grupo cuando lo hay.
2. **Pegar atributos a toda la selección.** «Pegar atributos de evento» del menú del clic derecho pega ahora en
   **todos los eventos seleccionados** que admitan lo copiado —no solo en el que se pulsó—, en **un único paso de
   deshacer**, y el estado dice cuántos lo recibieron y cuántos quedaron fuera. Mayús+V hace lo mismo. Se añadió
   además «Copiar los efectos y el estilo» al mismo menú, porque el mensaje de estado lo nombraba y no existía.

- **Comprobado**: `npx tsc --noEmit` (0 errores), `npm test` (**382/382**, con las cinco pruebas de
  `tests/range-selection.test.ts`), `npm run lint` (los mismos 21 problemas de siempre), `npm run build` correcto y
  `npx playwright test --project=chrome tests/seleccion-rango.spec.ts` (**2 correctas**: el rango con Mayús+clic y el
  pegote en los tres eventos con un solo deshacer). `tests/arrastres.spec.ts` y `tests/barra-vegas.spec.ts` siguen
  en verde después del cambio de los clics.
- **Lo que cambia para quien ya lo usaba**: Mayús+clic ya no suma un evento suelto (eso es Ctrl/Comando+clic). Queda
  dicho en la ayuda y en `FEATURES.md`.
- **Evidencia**: `evidencias/seleccion-rango.png` (tres tramos seleccionados tras Mayús+clic de extremo a extremo).

## Aplicación instalable en el escritorio (PWA)

Se añadió lo necesario para que Corte 15 se instale como aplicación de escritorio y se abra en su propia ventana:

- `public/manifest.webmanifest`: nombre «Corte 15 — Editor de vídeo», `display: standalone`, `start_url` y `scope`
  en `/`, idioma español, y los iconos que Chrome pide para instalar (192 y 512, más un `maskable` de 512).
- `public/icons/`: los iconos, dibujados con la identidad del favicon (`node scripts/generate-icons.mjs`).
- `public/sw.js`: service worker **en red primero** (la caché solo entra si la red falla, así que no puede servir una
  versión vieja del editor) y precarga del armazón para abrir sin conexión. Se registra en `client.tsx`.
- `index.html`: enlaces al manifiesto y al icono de iOS, y `theme-color` con el color de la ventana.
- Botón «Instalar Corte 15 en el escritorio» en la barra superior, que usa `beforeinstallprompt`. Si el navegador
  todavía no ofrece la instalación, el botón dice dónde está; cuando ya está instalada, queda encendido con ese
  rótulo. El aviso `appinstalled` lo actualiza sin recargar.

- **Comprobado**:
  - `npx tsc --noEmit` (0 errores), `npm test` (**382/382**), `npm run lint` (los mismos 21 problemas de siempre),
    `npm run build` correcto (el build copia `manifest.webmanifest`, `sw.js` e `icons/` a `dist/`).
  - `npx playwright test --project=chrome tests/instalable.spec.ts` (**3 correctas**): el manifiesto se sirve con los
    campos y los iconos esperados (los tres iconos responden 200 con `image/png`), el service worker queda activo y
    **controla la página tras recargar**, y el botón recorre sus tres estados (sin oferta explica la ruta manual, con
    oferta abre el diálogo, y tras `appinstalled` queda en «ya está instalado»).
  - **Instalabilidad medida con el propio Chrome** (CDP `Page.getInstallabilityErrors`) sobre `npm run build` +
    `vite preview` en `http://127.0.0.1:4173/`: con un perfil real la lista sale **vacía** (el contexto normal de
    Playwright sale como `in-incognito`, que es una restricción del contexto de prueba, no de la aplicación).
    `Page.getAppManifest` lee `name: Corte 15 — Editor de vídeo`, `display: standalone`, `start_url: /` e iconos
    `192x192 any`, `512x512 any` y `512x512 maskable`.
  - **Ventana de aplicación** (Chrome con `--app=http://127.0.0.1:4173/`, sin barras): `matchMedia('(display-mode:
    standalone)')` es **true**, el botón aparece como «Corte 15 ya está instalado» y **`Alt+flecha derecha` avanzó el
    cursor de `00:00:01:15` a `00:00:01:16` sin navegar** (la URL siguió siendo la aplicación). En una pestaña normal
    el mismo atajo también edita y no navega, pero el navegador sigue teniendo pestañas y barra de direcciones: eso es
    lo que desaparece al instalarla.
- **Evidencia**: `evidencias/instalada-ventana-propia.png` (la aplicación en una ventana propia, sin barras del
  navegador) y `evidencias/instalar-boton.png` (el botón «Instalar» en la barra superior).
- **Lo que no se pudo comprobar aquí**: el diálogo nativo de instalación de Chrome no se puede manejar desde las
  pruebas. Instalar de verdad (crear el acceso del escritorio y abrirlo desde ahí) queda en manos del usuario; lo que
  sí está medido es que el navegador considera la aplicación instalable y que una ventana de aplicación se comporta
  como la instalada. Si se instala desde el servidor de desarrollo (`npm run dev`), la ventana instalada depende de
  ese servidor; para una instalación estable: `npm run build` y `npm start` (`http://127.0.0.1:4173/`).

## `Iniciar.cmd`: arranca el servidor y abre la aplicación (la instalada, si está)

Windows no deja que un icono de aplicación web ejecute un script local (el navegador no puede lanzar procesos), así
que el camino que funciona es un acceso directo normal con el icono de la aplicación que ejecuta el lanzador. Se
unificó todo en **un solo archivo**, `Iniciar.cmd` (se eliminó el `iniciar.bat` que había hecho de puente):

- `Iniciar.cmd`: la carpeta del proyecto es la del propio archivo (`%~dp0`), sin rutas absolutas. Comprueba con una
  petición HTTP si el servidor responde; si no, compila si falta `dist/` y lo arranca
  (`node scripts\start-production.mjs`, salida en `%LOCALAPPDATA%\Corte15\servidor.log`), espera a que responda y
  abre la aplicación. **Si la aplicación está instalada, abre la instalada** (el acceso de Chrome/Edge con el nombre de
  la app, el mismo que se ancla a la barra de tareas); si no, abre una ventana de aplicación con el mismo aspecto y
  recuerda cómo instalarla. Se descarta a propósito el acceso del propio lanzador (apunta a `powershell.exe`).
  Opciones: `/sin-ventana`, `/navegador`, `/depurar`; variables `CORTE15_PUERTO`, `CORTE15_PERFIL`, `CORTE15_APP`.
- `abrir-corte15.ps1`: lanzador estable del acceso directo anclado (vive en `%LOCALAPPDATA%\Corte15`). Busca
  `Iniciar.cmd` y solo acepta carpetas que sean de Corte 15 (por `crear-acceso-directo.bat`, `abrir-corte15.ps1`,
  `components\editor\editor.tsx` o el nombre del paquete).
- `crear-acceso-directo.bat`: copia el lanzador estable y el icono a esa carpeta, apunta la ubicación y crea «Corte 15»
  en el escritorio.

- **Comprobado**:
  - `Iniciar.cmd /depurar`: imprime la carpeta, el puerto, la comprobación y qué abriría.
  - **Aplicación instalada simulada** con `CORTE15_APP` apuntando a un acceso directo cuyo destino es
    `chrome.exe`: `/depurar` lo detecta («Aplicacion instalada: …») y dice que abriría **esa**. Sin esa variable, con
    el acceso del lanzador en el escritorio (destino `powershell.exe`), **no** lo confunde: propone la ventana de
    aplicación.
  - **Servidor ya en marcha**: «El servidor ya estaba en marcha: solo se abre la aplicacion» y no arranca nada.
  - **Servidor parado en un puerto libre** (`CORTE15_PUERTO=4190`): lo arranca, espera y termina; `http://127.0.0.1:4190/`
    responde **HTTP 200**.
  - **La cadena completa del icono**: `%LOCALAPPDATA%\Corte15\abrir-corte15.ps1` (lo que ejecuta el acceso) encontró
    `…\Corte15\Iniciar.cmd`, arrancó el servidor y abrió la ventana de aplicación
    (`chrome.exe --app=http://127.0.0.1:5173/ --window-size=1600,1000`); la ventana de prueba se cerró después.
  - **Tras «mover» el proyecto**: con `ubicacion.txt` estropeado a propósito, `abrir-corte15.ps1 -Buscar` devolvió
    `…\Corte15\Iniciar.cmd` (y no el lanzador de otro proyecto que hay al lado) y corrigió la ubicación.
  - `npx tsc --noEmit` 0 errores, `npm test` **382/382**, `npm run build` correcto, `npm run lint` 21 problemas
    (línea base).
- **Lo que no se pudo comprobar aquí**: anclar el icono a la barra de tareas lo hace el usuario (Windows no ofrece API
  para eso); y la instalación real de la PWA tampoco se puede automatizar, así que el camino «abre la instalada» se
  verificó con un acceso directo de Chrome que hace de aplicación instalada.
- **Evidencia**: `evidencias/instalada-ventana-propia.png` (la ventana que abre el lanzador) y
  `public/icons/corte15.ico` (el icono del acceso directo).


## Pan/Crop aparecía fuera de sitio: el diálogo flotante llevaba una traslación

El síntoma que reportó el usuario: «la panoramización y recorte aparece en un lugar que no puedo ver bien». La ventana
se coloca centrada desde el componente (`event-pan-crop.tsx`: `x = (innerWidth − 940) / 2`, `y = (innerHeight −
580) / 2`), así que el desplazamiento venía de fuera: el diálogo flotante del editor (Radix + utilidades de Tailwind
`translate-x-[-50%] translate-y-[-50%]`) conservaba su `translate(-50%, -50%)`. Como `.ec-window` es
`position: fixed`, esa traslación del diálogo lo movía media pantalla.

La regla `.editor-dialog.floating-dialog` ya intentaba anularla con `translate: none !important`, pero **el
minimizador de la compilación (Lightning CSS) fusiona `transform: none; translate: none; scale: none` en un solo
`transform: translate(0) scale(1)` y borra la declaración `translate`**. Se comprobó en el CSS servido: la regla
compilada no tenía `translate` y la utilidad de Tailwind seguía ganando. En el servidor de desarrollo (sin minificar)
no se veía; en la aplicación compilada, sí.

Lo corregido: en `app/globals.css` la regla del diálogo flotante anula ahora las **variables** que usa la utilidad de
Tailwind (`--tw-translate-x: 0px !important` y `--tw-translate-y: 0px !important`) además de `translate: 0px 0px`,
que sobrevive a la minificación. No se tocó el componente de la ventana.

- **Medido** (Chrome, compilación servida en `http://127.0.0.1:5173/`):
  - Antes: con la ventana en la barra de estilo `left: 280px; top: 180px`, el rectángulo real era
    `x = −470, y = −290` en una pantalla de 1500×940: justo el desplazamiento de `−750 px` y `−470 px` (media
    pantalla). Se veía arriba a la izquierda y cortada, como en la captura del usuario.
  - Después: `x = 280, y = 180` con 940×580 sobre 1500×940 → centrada y entera. Con la pantalla del usuario
    (1914×1000): `x = 487, y = 210`. Con una ventana pequeña (1200×700): `x = 130, y = 60`, también dentro.
  - Arrastrar la barra de título sigue moviendo la ventana (de 487,210 a 427,240) y el doble clic la maximiza
    (0,0 · 1914×1000).
- **Comprobado**: `npx playwright test --project=chrome tests/pancrop-centrado.spec.ts` (**2 correctas**: centrada y
  entera a 1500×940 y a 1200×700, y sin traslación en el diálogo); `tests/dialogo-flotante.test.ts` (lee el CSS de
  `dist/` y exige que la regla anule `--tw-translate-*`, para que la minificación no vuelva a colarse); `npm test`
  **383/383**; `npx tsc --noEmit` 0 errores; `npm run lint` 21 problemas (línea base); `npm run build` correcto.
- **Evidencia**: `evidencias/pancrop-centrado.png` (la ventana de Panoramización y recorte en el centro, con el
  editor detrás).
- **Lo que no se pudo comprobar**: otras ventanas flotantes comparten el mismo diálogo y la misma corrección, pero solo
  se midió Pan/Crop; Movimiento de pista no llegó a abrirse con el guion de prueba (no se inspeccionó su menú).

## La tecla `D` toca las herramientas de la barra, no la envolvente del pie

Se pidió que `D` (siguiente herramienta de edición) solo afecte a los botones de herramienta de la barra de
transporte y edición (normal, envolventes, selección, zoom) y **no** al selector «Envolvente: Ninguna / Volumen /
Panorámica» del pie. Antes, al entrar en la herramienta de envolventes se encendía también `envelopeMode = volume`, así
que la tecla movía los dos controles.

Lo corregido en `components/editor/editor.tsx`:

- `chooseTool` ya no toca `envelopeMode`; solo cambia la herramienta y, si es la de envolventes y no hay ninguna a
  la vista, lo dice en el estado («Para editar puntos, muestra antes la envolvente (Volumen o Panorámica) en el pie»).
- La clase que hace que los clics vayan a la envolvente (`tool-envelope`) se aplica **solo** cuando la herramienta de
  envolventes está elegida **y** hay una envolvente visible; sin envolvente, los eventos del carril siguen siendo
  interactivos, como antes.

- **Medido** en el navegador (compilación servida en `http://127.0.0.1:5173/`):
  - Al empezar: herramienta normal, envolvente «Ninguna». Tras `D`: herramienta de envolventes y envolvente
    **«Ninguna»** (antes pasaba a «Volumen»). Tras `D` otra vez: selección, y la envolvente sigue «Ninguna».
  - Con «Volumen» elegido en el pie y la herramienta de envolventes: aparece `tool-envelope` y un clic en el carril
    de audio **añade un punto** (el proyecto guarda 1 punto en la curva de esa pista).
  - Al volver a «Ninguna» en el pie, la herramienta sigue siendo la de envolventes y la clase desaparece.
- **Comprobado**: `npx playwright test --project=chrome tests/barra-vegas.spec.ts` (**5 correctas**, con las
  aserciones nuevas de que `D` no mueve el selector del pie y de que el botón del pie no cambia la herramienta); `npm
  test` **383/383**; `npx tsc --noEmit` 0 errores; `npm run build` correcto; `npm run lint` 21 problemas (línea base).

## El editor arranca limpio; la copia automática solo se ofrece si el proyecto quedó sin guardar

Antes, al abrir el editor se restauraba siempre la última copia automática, aunque el proyecto se hubiera guardado. Se
pidió lo contrario: arranque limpio, salvo que la sesión anterior se cerrara sin guardar (cierre inesperado, apagón),
que es cuando hay que recuperarla.

Cómo queda:

- En `lib/editor/storage.ts` hay una marca nueva, `corte15-pendiente-v1`: `marcarPendiente(true/false)`,
  `hayCambiosSinGuardar()` (si la marca no existe se responde que sí, para no perder trabajo de versiones anteriores)
  y `olvidarProyecto()`, que borra la copia y la marca.
- En `components/editor/editor.tsx`: todo cambio pasa por `replace`, que marca «pendiente» (salvo el proyecto del
  propio arranque). Guardar (Ctrl+S, con archivo o descarga) y abrir un `.corte15` marcan «guardado»; crear un
  proyecto nuevo también. Al arrancar: si hay copia **y** está pendiente, se recupera y se avisa; si hay copia
  **guardada**, se descarta (`olvidarProyecto`) y se abre un proyecto nuevo, también con aviso.

- **Medido** en el navegador, con la compilación servida en `http://127.0.0.1:5173/`:
  - Nada guardado → editor limpio, 0 eventos.
  - Editar (marca pasa a `1`) y recargar (equivale a un cierre inesperado) → **se recupera** el montaje y el estado
    dice «Se recuperó el proyecto que no llegaste a guardar…».
  - Guardar (descarga de `Sin título.corte15`, marca pasa a `0`) y recargar → **arranque limpio** (0 eventos), la
    copia automática se borra y el estado dice «Proyecto nuevo: la sesión anterior ya estaba guardada».
  - Abrir el archivo guardado no cuenta como trabajo pendiente (marca `0`); dividir después del abrir vuelve a dejar
    el proyecto pendiente (`1`) y esa sesión sí se recupera al recargar.
- **Comprobado**: `npx playwright test --project=chrome tests/arranque-limpio.spec.ts` (**4 correctas**: arranque sin
  copia, recuperación tras cierre sin guardar, no reabrir al estar guardado, y recuperar si se edita después de
  abrir); `tests/arranque-almacen.test.ts` (5 pruebas de la marca y del almacén con un `localStorage` de mentira);
  `npm test` **388/388**; `npx tsc --noEmit` 0 errores; `npm run lint` 21 problemas (línea base); `npm run build`
  correcto.
- **Lo que no se pudo comprobar**: un apagón de verdad; se simula recargando la página justo después de editar, que es
  el mismo estado del almacén. La copia automática se escribe 450 ms después del último cambio, así que un cierre en
  ese margen puede perder el último retoque (es el comportamiento que ya tenía el autoguardado).

## Sinaloa Pro: nombre nuevo y ventana de bienvenida

El editor pasa a llamarse **Sinaloa Pro** («editor de vídeo gratuito y de código abierto», hecho con cariño de parte de
**@andresibarrali**) y, al abrirse o al crear un proyecto nuevo, sale una ventana de bienvenida que se quita sola a los
7 segundos o al pulsar la X.

Lo cambiado:

- **Marca**: barra de título (`… — Sinaloa Pro`, chapa «S»), `index.html`, `app/layout.tsx`, manifiesto de la PWA
  (`name`/`short_name`), la ayuda («Sinaloa Pro · Funciones y atajos»), los mensajes de instalación, los atajos propios
  («propio de Sinaloa Pro»), el informe de capítulos, los avisos de importación e intercambio y el puente `.veg`. Los
  iconos se regeneraron con la «S» (`node scripts/generate-icons.mjs`), incluido el `.ico` del acceso directo, que pasa a
  `sinaloa-pro.ico`.
- **Lanzadores**: `Iniciar.cmd`, `crear-acceso-directo.bat` y `abrir-sinaloa.ps1` (antes `abrir-corte15.ps1`) usan
  `%LOCALAPPDATA%\SinaloaPro`, crean el acceso «Sinaloa Pro» y buscan la aplicación instalada por `Sinaloa*.lnk`.
- **Ventana de bienvenida** (`components/editor/welcome-splash.tsx`): tarjeta centrada con el nombre, la licencia, la
  firma, tres consejos y una barra que marca los 4 segundos. Se cierra sola (`BIENVENIDA_MS = 4000`), con la X o con
  Escape; el fondo es `pointer-events: none`, así que no bloquea el editor. Se muestra al arrancar y al crear un
  proyecto nuevo, y **no** se muestra con `?bienvenida=no` (que es lo que usan las pruebas para no tapar la interfaz).
- **El formato no cambia**: el archivo sigue siendo `.corte15`, la marca del proyecto en el almacén
  (`corte15-autosave-v1`) y el identificador `format: 'corte15'`. Así los proyectos guardados se abren igual.

- **Comprobado**: `npx playwright test --project=chrome tests/bienvenida.spec.ts` (**5 correctas**: aparece con el
  nombre, la licencia y la firma; se va sola; la X la cierra; Escape la cierra; vuelve al crear un proyecto nuevo; y
  `?bienvenida=no` no la muestra). `tests/barra-vegas.spec.ts`, `seleccion-rango`, `arrastres`, `pancrop-centrado`,
  `instalable` y `arranque-limpio` siguen en verde (**27 correctas** juntas). `npm test` **388/388**;
  `npx tsc --noEmit` 0 errores; `npm run lint` 21 problemas (línea base); `npm run build` correcto.
- **Medido en el navegador** (compilación servida): la bienvenida aparece al cargar, el texto es «Sinaloa Pro · Editor
  de vídeo gratuito y de código abierto · Hecho con cariño de parte de @andresibarrali», desaparece a los ~4 s (seguía
  a los 0 s y ya no estaba a los 4,6 s), la X la quita al instante y con el editor detrás se puede seguir trabajando.
- **Evidencia**: `evidencias/bienvenida-sinaloa-pro.png` y `public/icons/icon-512.png` (la «S»).

## Insertar texto con el clic derecho en la pista (y abrir el editor de textos)

Como en VEGAS, el menú del botón derecho de una pista ofrece crear un texto ahí mismo. Se añadió:

- `insertTextOnTrack(trackId)` en `components/editor/editor.tsx`: crea un evento de texto (`kind: 'text'`) en la
  **aguja**, en la pista pulsada, con la duración por defecto del generador de texto (5 s); lo deja seleccionado y abre
  el **editor de textos** (`setDialog('titles')`) para escribir el texto recién creado.
- La orden «Insertar texto en esta pista…» está en `trackMenuItems`, así que sale tanto en el menú del **carril** como
  en el de la **cabecera**. En las pistas de audio aparece deshabilitada con la aclaración «Solo en pistas de vídeo,
  imágenes, textos o subtítulos».
- De paso se quitó una entrada repetida del menú del carril («Propiedades de la pista…» salía dos veces).

- **Comprobado** en el navegador (compilación servida): clic derecho en un carril de vídeo → «Insertar texto en esta
  pista…» → se abre «Títulos y texto» con el texto «Escribe tu título»; el proyecto guarda un evento `text` de 5 s en
  esa pista, empezando en la aguja (timecode 00:00:04:18 → evento a 4,93 s). Al escribir «Bienvenidos a Sinaloa Pro»
  en el editor, el evento lo guarda. Con el botón derecho en la **cabecera** de «Títulos» el texto se crea en esa
  pista. En la pista de audio la orden aparece deshabilitada y no crea nada.
- **Pruebas**: `npx playwright test --project=chrome tests/insertar-texto.spec.ts` (**3 correctas**); `npm test`
  **388/388**; `npx tsc --noEmit` 0 errores; `npm run lint` 21 problemas (línea base); `npm run build` correcto;
  `tests/barra-vegas.spec.ts`, `seleccion-rango`, `arrastres`, `pancrop-centrado`, `instalable`, `arranque-limpio` y
  `bienvenida` siguen en verde.
- **Evidencia**: `evidencias/insertar-texto-menu.png` (la orden en el menú del carril) y
  `evidencias/insertar-texto-editor.png` (el editor abierto con el texto nuevo).
- **Lo que no se comprobó**: crear el texto sobre una pista de subtítulos «de verdad» (en este proyecto las pistas de
  subtítulos son pistas de vídeo con ese nombre, y se comportan igual que las demás).

## Bienvenida de 7 segundos y soltar archivos en la aplicación instalada

Dos cambios pedidos:

1. **La bienvenida dura 7 segundos** (antes 4): `BIENVENIDA_MS = 7000` en `welcome-splash.tsx`, la barra del tiempo
   pasa a `animation: welcome-timer 7s` y el texto lo dice. Se sigue cerrando antes con la X o con Escape.
2. **Soltar archivos del explorador no hacía nada en la aplicación instalada.** Se encontraron dos causas de código:

   - **El candado de importación podía quedarse echado.** `importFiles` hacía `setBusy(true)` y solo lo soltaba al
     final del recorrido: si algo lanzaba una excepción a mitad (una importación que falla, el cache local lleno, un
     archivo que el navegador no sabe leer), `busy` se quedaba en `true` y **a partir de ahí todos los soltados e
     importaciones no hacían nada, sin ningún aviso** (`if(rendering||busy)return []`). Ahora el cuerpo va en
     `try/catch/finally`: el candado se suelta siempre, el error se cuenta en el estado y, si ya hay una importación en
     curso, el aviso lo dice en vez de callarse. `restoreMedia` también suelta el candado con `finally`.
   - **El soltado solo se atendía dentro del editor.** Lo resuelve el componente nuevo
     `components/editor/drop-files-anywhere.tsx`. La ventana instalada puede tener delante un **diálogo** (que se
     dibuja en un portal fuera de `<main>`) o la **bienvenida**: el archivo caía ahí y no pasaba nada. Ahora la
     **ventana entera** atiende el arrastre: se cancela el comportamiento del navegador (abrir el archivo y sacarte de
     la app), se muestra el aviso «Suelta los archivos para importarlos» y, si el destino no lo atendió (se comprueba
     `defaultPrevented`), se importa en el editor. El aviso se apaga también cuando un destino corta la propagación
     (oyente en captura) para que no se quede pegado.
   - La tarjeta de la bienvenida ya no intercepta clics ni soltados (solo su X), y la caché del service worker pasa a
     `sinaloa-v2`, de modo que la aplicación instalada se queda con esta versión.

- **Medido** con Chrome (compilación servida y ventana de aplicación `--app`, que Chrome marca como
  `display-mode: standalone`):
  - La bienvenida tardó **7,0 s** en irse sola (medido con reloj).
  - En la ventana de aplicación, arrastrar un archivo muestra el aviso (**1** superpuesto) y al soltarlo en el carril:
    **1 medio importado y 2 clips colocados**, aviso retirado (0) y estado «1 medio(s) importado(s) y colocado(s)».
  - Soltar sobre el **diálogo de ayuda** importa (antes no hacía nada); soltar sobre la **bienvenida** también; soltar
    sobre la **vista previa** (fuera de la línea de tiempo) también.
- **Comprobado**: `npx playwright test --project=chrome tests/soltar-archivos-ventana.spec.ts tests/bienvenida.spec.ts`
  (**9 correctas**); `arrastres`, `barra-vegas`, `seleccion-rango`, `instalable`, `arranque-limpio`,
  `insertar-texto` y `pancrop-centrado` (**30 correctas**); `npm test` **388/388**; `npx tsc --noEmit` 0 errores;
  `npm run lint` 22 problemas (los 4 errores de la línea base y un aviso más por el trabajo en curso del otro
  asistente); `npm run build` correcto.
- **Evidencia**: `evidencias/soltar-archivos-ventana.png` (ventana de aplicación con el archivo soltado ya colocado) y
  `evidencias/bienvenida-sinaloa-pro.png`.
- **Lo que no se pudo comprobar**: un arrastre real desde el Explorador de Windows (las pruebas simulan el
  `DataTransfer` con un `File` de verdad, que es el mismo camino de código); y el caso de una instalación con una
  versión vieja cacheada: la caché nueva (`sinaloa-v2`) se descarga al abrir la app con el servidor en marcha.

## Abrir en el navegador (con la opción de instalar) y, si está instalada, como aplicación

Se pidió que la aplicación se abra **en el navegador, en localhost**, con la opción de instalar a la vista (el diálogo
«¿Usar este sitio a menudo? Instalar la aplicación…» con «Instalar» y «Ahora no»), y que si está instalada se abra como
una aplicación normal, y si se desinstala vuelva al navegador.

- **Lanzador** (`Iniciar.cmd`): por defecto arranca el servidor y abre **el navegador en
  `http://127.0.0.1:5173/`**, que es donde Chrome ofrece instalar (icono de la barra de direcciones). Si detecta la
  aplicación **instalada** (acceso de Chrome/Edge con el nombre de la app), abre **esa**. Opciones: `/navegador` (lo
  mismo que por defecto), `/app` (ventana sin barras), `/sin-ventana` (solo el servidor). Antes abría siempre la
  ventana sin barras, y por eso no aparecía la opción de instalar.
- **Editor**: el botón «Instalar Sinaloa Pro en el escritorio» se **destaca** (pulso azul, `data-instalable="true"`)
  en cuanto el navegador ofrece la instalación, y al pulsarlo se abre el diálogo del navegador (el de la captura). El
  manifiesto ya cumple los requisitos y los iconos existen.
- **Instalarla o no**: al instalarla, el icono de la app abre una ventana propia (`display-mode: standalone`); si se
  desinstala, el siguiente arranque de `Iniciar.cmd` vuelve a abrir el navegador en localhost.

- **Medido**:
  - `Iniciar.cmd /depurar` → «despues se abriria el navegador en http://127.0.0.1:5173/, con la opcion de instalar».
  - `Iniciar.cmd /navegador` con un perfil de prueba: Chrome abrió **una pestaña** (`chrome.exe
    http://127.0.0.1:5173/ --user-data-dir=…`, sin `--app`).
  - Con un acceso de Chrome como aplicación instalada (`CORTE15_APP`): «Aplicacion instalada: …\Sinaloa Pro.lnk» y el
    plan dice que abriría esa aplicación.
  - En el navegador: el botón de instalar existe y **no** está destacado; al recibir `beforeinstallprompt` pasa a
    `data-instalable="true"` y, al pulsarlo, se abre el diálogo del navegador (la prueba simula la elección «Ahora no»).
- **Comprobado**: `npx playwright test --project=chrome tests/instalable.spec.ts` (**3 correctas**, con el destacado del
  botón); `npm test` **388/388**; `npx tsc --noEmit` 0 errores; `npm run build` correcto; `npm run lint` 22 problemas
  (los 4 errores de la línea base y el aviso añadido por el trabajo en curso del otro asistente).
- **Evidencia**: `evidencias/boton-instalar.png` (el botón de instalar destacado en la barra).
- **Lo que no se pudo comprobar**: el diálogo nativo de Chrome no se puede manejar desde las pruebas; se simula la
  oferta (`beforeinstallprompt`) y la elección. Instalar de verdad y comprobar que se abre como aplicación es una
  acción del usuario.

## Aviso al cerrar: solo pregunta si hay cambios sin guardar

Se pidió que al cerrar la aplicación instalada o la pestaña del navegador aparezca el aviso de que no se ha guardado el
proyecto, pero que si ya se guardó se cierre sin preguntar nada.

- El aviso se monta con `beforeunload` en `components/editor/editor.tsx`: si hay cambios sin guardar se cancela el
  cierre para que el navegador pida confirmación; si no los hay, no se hace nada y la pestaña o la ventana se cierran
  directamente. **El texto del diálogo lo pone el navegador** (Chrome y Edge muestran su propio mensaje genérico y no
  permiten personalizarlo desde la página: es una medida de seguridad), así que el «No has guardado tu proyecto» no
  puede escribirse literalmente; para que el estado se vea, la barra de título añade « · sin guardar».
- La marca de guardado (`lib/editor/storage.ts`) pasa a tener **tres estados**: `pendiente` (hay cambios),
  `guardado` y `sin-marca` (proyectos de antes de esta regla). El aviso al cerrar solo cuenta `pendiente`; al
  arrancar se sigue ofreciendo la copia automática también sin marca, para no perder trabajo. Se escribe «pendiente» en
  cada cambio del proyecto y «guardado» al guardar (botón, Ctrl+S, con archivo o descarga) y al abrir un `.corte15`.
- La barra de título dice « · sin guardar» mientras el estado es pendiente y lo quita al guardar.

- **Medido** en Chrome (compilación servida):
  - Proyecto recién abierto, sin tocar: al recargar **no** sale ningún diálogo; al cerrar la pestaña tampoco.
  - Tras montar un clip (marca `1`): al recargar aparece el diálogo de tipo `beforeunload` y al cerrar la ventana
    (`page.close({runBeforeUnload:true})`) también.
  - Después de guardar (descarga, marca `0`): al recargar **no** aparece; la página se recarga sin preguntar.
  - La barra de título: «Sin título.corte15 — Sinaloa Pro» → tras editar «… · sin guardar» → tras guardar vuelve a
    quedar limpia.
- **Comprobado**: `npx playwright test --project=chrome tests/aviso-cerrar.spec.ts` (**3 correctas**: sin cambios no
  pregunta, con cambios sí, guardado no pregunta); `arranque-limpio`, `bienvenida`, `instalable`,
  `soltar-archivos-ventana` y `arrastres` (**27 correctas** juntas); `npm test` **388/388** (con las pruebas
  actualizadas de la marca de tres estados); `npx tsc --noEmit` 0 errores; `npm run lint` 22 problemas (los 4 errores
  de la línea base y el aviso del trabajo en curso del otro asistente); `npm run build` correcto.
- **Evidencia**: `evidencias/sin-guardar.png` (barra de título tras guardar; el « · sin guardar» se ve en la captura
  previa a guardar del flujo).
- **Lo que no se pudo comprobar**: el texto exacto del diálogo del navegador (no se puede personalizar) ni un cierre
  real de la ventana instalada desde las pruebas: se comprueba con el mismo evento y con `page.close({runBeforeUnload})».

## Versión nativa en Rust: primera entrega

Se creó la subcarpeta `rust/`: un programa de escritorio escrito íntegramente en Rust que replica el editor web (mismo
formato, mismos atajos, misma interfaz). No es un envoltorio: no hay navegador ni HTML.

- **Herramientas**: Rust 1.99.1 (MSVC) instalado con rustup en `%USERPROFILE%\.cargo`; `eframe`/`egui` 0.30 para la
  ventana; `ffprobe`/`ffmpeg` del sistema (los mismos que usa la versión web) para los medios.
- **Módulos**: `model.rs` (el `.corte15`, tics, cuantización, timecode, historial), `shortcuts.rs` (la tabla de 59
  atajos), `media.rs` (sondeo con `ffprobe`), `theme.rs` (colores de `app/editor.css`), `app.rs` (acciones e interfaz) y
  `main.rs` (la ventana).
- **Comprobado**:
  - `cargo test`: **19 pruebas correctas** (14 de los módulos + 5 del proyecto real). Una de ellas abre
    `tests/fixtures/proyecto-real.corte15` (copia de un `.corte15` generado por la suite del editor web), lo reescribe y
    comprueba **campo por campo** que no se pierde ni cambia ningún dato, y que los ids de los eventos son los mismos.
  - `cargo clippy --all-targets`: **sin avisos**.
  - `cargo build --release`: binario de **5,3 MB** en 44 s; `rust\ejecutar.cmd` lo compila si falta y lo abre.
  - La ventana (1502×932) se abrió con `--abrir` sobre ese proyecto real y se capturó: se ven el medio importado
    («Video_A.mp4 · 00:00:03.00»), el evento de vídeo azul `#5572a9` en «Títulos», el evento de audio rosa `#843e4e` con
    su onda en «Audio», las tres pistas, la regla y la barra de estado «2 eventos · 3 pistas · 00:00:03.00 · guardado».
- **Evidencia**: `evidencias/rust-interfaz.png`.
- **Ronda 2 (vista previa real)**: el port ya **decodifica fotogramas** con `ffmpeg` (`src/preview.rs`): la vista previa
  pide el fotograma del cursor en un hilo aparte, lo sube como textura y lo pinta encajado; las miniaturas de la lista y
  los **picos de las formas de onda** salen del mismo motor. Los archivos de los medios se copian a
  `%LOCALAPPDATA%\SinaloaPro\medios` (lo que en la web hace IndexedDB) y se resuelven por ruta guardada, por id en la
  caché o por nombre junto al proyecto (`src/medios.rs`). La vista previa compone el **texto encima del vídeo**.
  - Comprobado: `cargo test` **27/27** (22 de los módulos + 5 del proyecto real), `cargo clippy --all-targets` sin
    avisos, `cargo build --release` correcto. La captura `evidencias/rust-interfaz.png` muestra el fotograma azul de
    `video-corto.mp4`, su miniatura, la onda real de `voz.wav`, el texto «Sinaloa Pro en Rust» compuesto encima y el
    cursor en 00:00:01.06.
  - Lo que sigue faltando: reproducción continua (30 fps) con audio, recorte por bordes, rizo, envolventes, diálogos de
    títulos y Panoramización y recorte, efectos, transiciones, exportación y el aviso de «sin guardar».
- **Ronda 3 (recorte, rizo, M/S y exportación)**: la línea de tiempo ya **recorta por los bordes** (arrastrando el borde
  del evento, con ajuste a fotogramas y los eventos enlazados a la vez), el **rizo** se elige en la barra
  (Desactivado/Pista/Todas) y afecta a recortar, borrar y desplazar, los botones **M/S** de cada pista se pulsan, y la
  app **exporta con ffmpeg** («Renderizar como…»: 1080p/720p/480p, progreso, o `--exportar` sin ventana).
  - Comprobado: `cargo test` **37/37** (32 de los módulos + 5 del proyecto real), incluida una **exportación real** que
    ffprobe verifica (h264 + aac, 3,000 s) y pruebas de los límites del recorte y del rizo; `cargo clippy` sin avisos.
  - Exportación de verdad del proyecto de demostración: `sinaloa-pro-rust --abrir demo.corte15 --exportar salida.mp4`
    → **1920×1080, h264 + aac, 3,000 s, 71 KB**, y el fotograma de 1,2 s (`evidencias/rust-export-fotograma.png`) sale
    con el vídeo azul y el texto «Sinaloa Pro en Rust» compuesto.
  - Límite honesto: la exportación compone **una** pista de vídeo (avisa si hay varias con imagen a la vez).
- **Ronda 4 (diálogos, autoguardado y aviso de cierre)**: se añadieron los diálogos que faltaban para editar de verdad —
  **Títulos y texto** (vista previa, 6 plantillas, 8 fuentes, tamaño, color, alineación, negrita/cursiva y 8 animaciones),
  **Propiedades del evento** (nombre, inicio, duración, opacidad, escala, brillo, contraste, saturación, tono, silenciado y
  bloqueado) y **Sin guardar** (Guardar y salir / Salir sin guardar / Cancelar) —, además del **autoguardado** con
  recuperación al arrancar.
  - Comprobado: `cargo test` **37/37**, `cargo clippy --all-targets` sin avisos, `cargo build --release` correcto.
  - Capturas nuevas: `rust-propiedades.png` (diálogo de propiedades con los valores del evento de texto),
    `rust-aviso-cerrar.png` (el aviso aparece y la ventana **no** se cierra: el proceso siguió vivo) y
    `rust-recuperacion.png` (sesión anterior recuperada, con la barra de título en «· sin guardar» y el fotograma real ya
    resuelto porque la marca guarda la ruta del proyecto).
  - Límite honesto: la vista previa del diálogo de títulos es estática; las animaciones se guardan en el `.corte15` y se
    aplican al exportar, pero no se ven animadas dentro del diálogo.
- **Ronda 5 (Panoramización y recorte, marcadores y tramos)**: el diálogo de **Panoramización y recorte** mueve, escala,
  rota, cambia la opacidad y recorta por los cuatro lados, con vista previa en vivo y **la misma transformación en la
  exportación** (ffmpeg `scale`/`rotate`/`colorchannelmixer`/`overlay`). Los **marcadores** (M, doble clic para borrar,
  Mayús+←/→ para saltar) y el **tramo** (I/O, R, Mayús+U) se dibujan en el riel y como banda sobre las pistas.
  - Comprobado: `cargo test` **38/38** (33 de los módulos + 5 del proyecto real), con prueba nueva de que la
    transformación entra en los argumentos de ffmpeg; `cargo clippy --all-targets` sin avisos; `cargo build --release`.
  - Capturas: `rust-pancrop.png` (diálogo con el vídeo rotado −8°, escala 0,62 y opacidad 0,85) y
    `rust-marcadores.png` (tres marcadores con nombre y banda de tramo).
- **Ronda 6 (audio, portapapeles, grupos, soltar archivos)**: al dar Play el port **mezcla el audio con ffmpeg y lo
  reproduce con ffplay** (sin enlazar bibliotecas de audio), el bucle (Q) repite el tramo o el proyecto y el cursor se
  para al final; además hay **copiar/cortar/pegar** con eventos enlazados, **pegar atributos** en un solo paso de
  historial, **agrupar/desagrupar** (campo `group` del `.corte15`) e **importar soltando archivos** sobre la ventana.
  - Comprobado: `cargo test` **42/42** (37 de los módulos + 5 del proyecto real), incluida una prueba que **mezcla un WAV
    de verdad** con ffmpeg; `cargo clippy --all-targets` sin avisos; `cargo build --release` correcto; la exportación
    sigue dando h264+aac de 3,000 s tras los cambios.
  - Captura `rust-reproduccion.png`: el cursor llegó al final (00:00:03.00) con el estado «Reproduciendo con audio.».
  - Límite honesto: el audio tarda un momento en prepararse (se mezcla a un WAV) y el vídeo no corre a 30 fps constantes.
- **Ronda 7 (edición fina y subtítulos)**: **deslizar contenido** (Alt+J/K), **desplazar sin huecos** (Alt+Mayús+J/K),
  **recortar hasta el cursor** (Alt+R/Alt+E), **seleccionar hasta el final** (E) y **mover pistas** (Ctrl+↑/↓) ya
  funcionan, y se pueden **importar subtítulos `.srt`** (se crea un evento de texto por subtítulo, con su tiempo).
  - Comprobado: `cargo test` **50/50** (45 de los módulos + 5 del proyecto real), con pruebas nuevas para `slip`, `slide`,
    `recortar_a_cursor`, `seleccionar_hasta_el_final` y el lector de SubRip (incluye un `.srt` con etiquetas `<i>` y sin
    horas). `cargo clippy --all-targets` sin avisos; `cargo build --release` correcto.
  - Captura `rust-subtitulos.png`: los tres subtítulos en la pista «Títulos» y «Hola, bienvenidos a Sinaloa Pro» compuesto
    sobre el vídeo, con el estado «3 subtítulo(s) importados.».
- **Ronda 8 (fundidos, color, pistas y arrastre de medios)**: los **fundidos de entrada y salida** se ven en la vista previa
  y se aplican al exportar (`fade`/`afade`), el **color** del evento (brillo/contraste/saturación/tono) se exporta con
  `eq`/`hue` (el brillo también se ve en la vista previa), se pueden **añadir y eliminar pistas** y arrastrar un medio de
  la lista a una pista (implementado; ver límite abajo).
  - Comprobado: `cargo test` **52/52** (47 de los módulos + 5 del proyecto real), con prueba nueva de que los fundidos, el
    color, el tono, el volumen y los fundidos de audio entran en los argumentos de ffmpeg; `cargo clippy --all-targets` sin
    avisos; `cargo build --release` correcto.
  - Captura `rust-fundidos.png`: el mismo fotograma a 00:00:00.07 sale **oscurecido** por el fundido de entrada de 1 s
    (antes se pintaba a plena opacidad: se corrigió el color premultiplicado de la textura).
  - Límite honesto: el **arrastre de un medio a la pista** quedó implementado pero **no se pudo verificar con el ratón
    sintético** en esta ronda (las coordenadas del clic no dieron en la tarjeta); está en la matriz como 🟡.
- **Ronda 9 (fundido automático y capturas fiables)**: `model::auto_crossfade` calcula el solape entre dos eventos de la
  misma pista y ajusta los fundidos, con pruebas (`el_fundido_automatico_marca_el_solape`, `sin_solape_no_hay_fundido_automatico`);
  se aplica al soltar un evento y al insertar un medio, y hay orden en el menú. También se reescribió el script de captura
  para que elija la **ventana visible más grande** del proceso (antes a veces cogía una ventana auxiliar de 16×16 y la
  evidencia salía en blanco).
  - Comprobado: `cargo test` **54/54** (49 de los módulos + 5 del proyecto real); `cargo clippy --all-targets` sin avisos;
    `cargo build --release` correcto; captura nueva con el script arreglado (1502×932).
  - Límite honesto: el **arrastre de un medio a la pista** sigue sin poder verificarse con el ratón sintético (las
    coordenadas llegan a la ventana pero el gesto no se registra en egui); queda como 🟡 y se probará a mano.
    La **vista previa aún no mezcla** los dos fotogramas de un solape, así que el fundido automático se aprecia al exportar.
- **Ronda 10 (compositor de capas y cruce visible)**: la vista previa ahora compone **todas las capas** del cursor de abajo
  arriba (cada pista de vídeo en orden y los textos encima), cada una con su fundido, opacidad, transformación y recorte,
  y pide hasta cuatro fotogramas a la vez. Con eso el **fundido automático se ve**: `model::capas_en` devuelve las capas
  con su alfa (`fade_factor × opacidad`).
  - Comprobado: `cargo test` **56/56** (51 de los módulos + 5 del proyecto real), con pruebas nuevas
    (`las_capas_se_ordenan_de_abajo_arriba_y_suman_el_solape`, `dos_eventos_solapados_son_dos_capas_con_sus_fundidos`);
    `cargo clippy --all-targets` sin avisos; `cargo build --release` correcto.
  - Captura `rust-cruce.png`: dos eventos de color solapados (rojo fundiendo a la salida, azul a la entrada) pintan el
    fotograma **morado** a 00:00:02.15; antes se veía solo el de encima.
  - Límite honesto: en la **exportación** el cruce se hace superponiendo los dos segmentos con sus `fade`, no con mezcla
    aditiva (la vista previa sí mezcla); la exportación sigue componiendo **una** pista de vídeo.
- **Ronda 11 (exportación con todas las pistas y cruce real)**: `src/exportar.rs` compone **todas las pistas de vídeo** de
  abajo arriba (vídeo, imágenes y **colores sólidos** generados con `lavfi`), coloca cada capa en su instante
  (`setpts=PTS+inicio/TB`) y hace los fundidos **con canal alfa** (`fade=...:alpha=1`), así que un cruce **mezcla** los dos
  fotogramas también en el MP4.
  - Comprobado: `cargo test` **58/58** (53 de los módulos + 5 del proyecto real), con pruebas nuevas
    (`los_fundidos_usan_alfa_para_que_el_cruce_mezcle`, `exporta_las_pistas_de_video_de_abajo_arriba`);
    `cargo clippy --all-targets` sin avisos; `cargo build --release` correcto.
  - Exportación real de `demo-cruce.corte15` (rojo con fundido de salida + azul con fundido de entrada, solapados de 2 a
    3 s): el fotograma de **2,5 s sale morado** y el de 3,5 s azul (`evidencias/rust-export-cruce.png`); antes salía azul
    plano porque `overlay` consumía la segunda capa con su fundido ya agotado.
  - Límite honesto: siguen sin existir efectos y transiciones de la biblioteca; el cruce es alfa sobre `overlay`.
- **Ronda 12 (envolventes de volumen)**: la pista de audio tiene **curva de volumen** editable en el carril (línea amarilla
  con sus puntos: clic añade o mueve, Alt+clic quita), se guarda en `volumeCurve` del `.corte15`, se aplica al **audio
  exportado** (`volume=volume='…':eval=frame`) y a la reproducción con ffplay.
  - Comprobado: `cargo test` **62/62** (57 de los módulos + 5 del proyecto real), con pruebas nuevas de la interpolación
    (`la_envolvente_interpola_entre_puntos`), del orden y acotado de puntos, de la expresión de ffmpeg y de que la curva
    entra en los argumentos de exportación; `cargo clippy --all-targets` sin avisos; `cargo build --release` correcto;
    exportación del proyecto con envolvente → h264 + aac, 3,000 s.
  - Captura `rust-envolvente.png`: la curva (0,10 → 1,00 → 0,40) dibujada sobre el carril «Audio».
  - Incidencia: al mover el bloque de dibujo de la envolvente se corrompió `app.rs` (quedó duplicado); se detectó por el
    error de compilación y se **reconstruyó** desde la copia duplicada, verificando después con `cargo test` y la captura.
- **Ronda 13 (cierre de verificación)**: pasada completa de comprobaciones y documentación de estado.
  - `cargo test` **62/62** (57 de los módulos + 5 del proyecto real), `cargo clippy --all-targets` **sin avisos**,
    `cargo build --release` correcto (**6,1 MB**), **6.192 líneas** en 12 módulos.
  - `rust/README.md` reescrito: requisitos, lanzador, argumentos, mapa de módulos, fixtures, tabla de comprobaciones
    medidas y resumen del estado. `rust/PARIDAD.md` abre con el recuento **55 ✅ · 6 🟡 · 4 ⬜**.
  - Lo que queda pendiente, sin adornos: efectos de vídeo y transiciones de la biblioteca, envolventes de panorámica,
    reproducción a 30 fps constantes, verificación manual del arrastre de medios y la barra de herramientas de vídeo del
    editor web. **La paridad no está completa.**
- **Lo que falta** (matriz en `rust/PARIDAD.md`): decodificar la vista previa con ffmpeg, miniaturas y ondas reales,
  recorte por bordes, rizo, envolventes, diálogos de títulos y Panoramización y recorte, efectos, transiciones, audio y
  exportación. También el aviso de «sin guardar» al cerrar y el autoguardado, que en la versión web se apoyan en
  `localStorage`/`beforeunload` y aquí se harán con archivos y un cierre controlado.
- **No se afirma** que la paridad esté completa: la versión Rust es, por ahora, el armazón funcional con el modelo, los
  atajos y la línea de tiempo. El trabajo sigue en la carpeta `rust/`, sin tocar la versión web.

- **Corrección: S (cortar) volvía a fallar con un clip seleccionado.** Al hacer que el transporte se atendiera siempre,
  quedó una guarda que cedía el paso a «botones y deslizadores» para el **resto** de atajos; como los clips de la línea de
  tiempo son botones, con un clip seleccionado el foco estaba en él y `S` no hacía nada. Se quitó esa guarda (el
  espacio del transporte ya se atiende antes y las flechas de un deslizador siguen siendo suyas porque el foco en
  campos/deslizadores se filtra arriba). Comprobado con `tests/cortar-con-s.spec.ts` **3/3**: corta con el foco en el
  clip, corta con el foco en el panel de medios y **no** corta si el cursor quedó fuera de los clips. Sin regresiones:
  `tests/shortcut-espacio.spec.ts` 5/5 y `tests/reproduccion-sin-pausa.spec.ts` 2/2.
- **Espacio siempre responde**: el atajo dependía del foco. Si el foco estaba en un botón (la biblioteca de medios, la
  propia barra de transporte) o en un clip con `role="button"`, el manejador cedía el paso y el navegador se quedaba con
  el espacio para activar ese elemento: el atajo «a veces» no hacía nada. Ahora el **transporte se atiende primero**
  (`transport`, `playPause`, `stop`, `playAll`) con `preventDefault` para que el elemento enfocado no reciba la
  activación; el resto de atajos siguen cediendo el paso a botones y deslizadores, y escribiendo en un campo el espacio
  escribe. Comprobado con `tests/shortcut-espacio.spec.ts` **5/5**: foco en medio, en clip, en botón de la barra (una
  sola alternancia, sin doble activación), en deslizador y en el buscador (el espacio llega al texto y no reproduce).
  `npm test` **395/395**, `tsc` y `npm run build` correctos.
- **Editar sin que se pare la previsualización**: `edit()` ya no llama a `pause()`, así que cortar (S), mover, recortar, borrar y
  pegar se hacen mientras se reproduce. Además:
  - el **bucle de reproducción** lee el proyecto por referencia (`pRef.current`) y no depende del estado `p`, así que una
    edición no lo reinicia (antes se recreaba en cada cambio, con su tirón de monitor y audio);
  - **cortar y marcar siguen usando el cursor de edición**, como estaban: no se tocó esa parte (la aguja de
    reproducción no hace cortes);
  - el audio sigue programando los bloques siguientes con el proyecto ya editado.
  - Comprobado: `npm test` **395/395**, `tsc --noEmit` y `npm run build` correctos, y E2E `tests/reproduccion-sin-pausa.spec.ts`
    **2/2** (cortar y mover con la reproducción en marcha: la barra sigue en «Reproduciendo» y el reloj del timecode avanza).
    Se añadió `--autoplay-policy=no-user-gesture-required` a la configuración de Playwright: sin eso el reloj de Web Audio
    no arranca en el navegador de pruebas y la reproducción parece congelada.
  - Límite honesto: al cortar un clip que se está reproduciendo el monitor puede mostrar un fotograma del montaje anterior
    durante un instante (la composición es asíncrona); no se detiene, pero tampoco es instantáneo.

- **Audio largo (fin del tope de 256 MB)**: el editor decodifica el audio entero porque el mezclador necesita leer
  cualquier instante. El tope fijo de 256 MB hacía fallar la importación de vídeos/audios largos («El audio descomprimido
  excede el límite local de 256 MB»). Ahora:
  - presupuesto **por archivo** (192 MB) y **total** (1 GB), mucho más holgado;
  - si un archivo no cabe, se **reduce la frecuencia de muestreo** promediando muestras (factor potencia de 2, hasta 1/16)
    en vez de rechazarlo: un archivo de 12 minutos entra a la mitad de frecuencia; uno de una hora, a 1/8;
  - la onda y los picos se calculan sobre el audio ya reducido, y el mezclador usa esa misma frecuencia.
  - Comprobado: `npm test` **393/393** (5 pruebas nuevas de `pcm-budget`), `npm run build` correcto, `tsc --noEmit` sin
    errores, y E2E `tests/audio-largo.spec.ts` **2/2** con un AAC real de **12 minutos** (00:12:00): se importa, se monta
    en la línea de tiempo y guarda picos estéreo. `lint` sigue **sin errores** (solo los avisos que ya había).
  - Evidencia: `evidencias/audio-largo.png`.
  - Límite honesto: los archivos muy largos pierden agudos al reducirse la frecuencia (documentado en el código); si un
    proyecto junta más de 1 GB de audio decodificado, se pide dividirlo.

## Un recurso de Pexels por palabra de la transcripción

Se pidió que haya **un recurso de Pexels por palabra** de la transcripción y los subtítulos, no uno por frase.

- **Qué hace ahora** (modo *Según la transcripción* de **Recursos Pexels**):
  - `wordCuesOf` parte la transcripción en palabras con su instante. Si el `.srt` ya viene palabra a palabra (lo que
    genera el editor al transcribir) respeta sus tiempos; si es un `.srt` de otra fuente, con frases enteras, reparte
    el tiempo de la frase entre sus palabras.
  - `planWordResources` coloca **un evento por palabra** en la pista «Pexels», en el instante en que se dice, con la
    duración **hasta la palabra siguiente**: dentro de una frase los clips se tocan (sin huecos ni solapes) y entre
    frases separadas por un silencio largo queda el hueco que dura el silencio, sin estirar la imagen.
  - Cada palabra con búsqueda propia (sustantivos, verbos, adjetivos) usa **su** término; las muletillas, números y
    palabras sin clip descargado se apoyan en el **recurso principal de su frase**, así que ninguna palabra se queda
    sin imagen. Las palabras repetidas reutilizan el clip ya descargado.
  - El nombre de cada evento dice qué palabra lo pidió: `dinero · dinero-9-9-1920p.mp4` o `del · dinero-9-9-1920p.mp4`.
  - Límite por tanda: hasta 24 clips distintos (4 por cada clip pedido en *Cantidad*) y el mensaje final informa de la
    cobertura («Recursos por palabra: 9 de 9 palabra(s) con su clip… 4 clip(s) distinto(s) para 4 término(s)»).
- **Comprobado**:
  - `npm test` **414/414**, con dos pruebas nuevas: la partición en palabras (tiempos dentro de la frase, orden, un
    `.srt` que ya viene por palabras conserva sus tiempos y se agrupa en frases por el silencio y la puntuación, y
    muletillas y números no se buscan) y el plan de colocación (una entrada por palabra, duración hasta la
    siguiente, clip propio frente al de la frase, sin bajar de un fotograma y sin pasarse de lo que dura el clip).
  - E2E `browser.spec.ts` «los recursos de Pexels se colocan según lo que dice la transcripción, en su momento», en
    Chrome, Edge y Firefox (**3/3**): 9 palabras → **9 eventos** en la pista «Pexels», en orden; «hola» empieza con su
    frase (0,2 s), «dinero» cae **dentro** de la suya (5,3–6,7 s) y la muletilla «esto» comparte el clip de «hola».
  - Los seis flujos de subtítulos y Pexels (botón de subtítulos, subtítulos generados, Pexels por texto, Pexels por
    palabra, exportar marcadores y `.srt` importado) pasan en Chrome, Edge y Firefox: **18/18**.
  - `npx tsc --noEmit` sin errores; `lint` de los archivos tocados, 0 errores.
- **Evidencia**: `evidencias/recursos-transcripcion.png` (nueve clips seguidos, uno por palabra, y el resumen de
  cobertura en la barra de estado).
- **Límite honesto**: la cobertura depende del presupuesto de descargas. Con una transcripción larga, las palabras
  que no tienen clip propio ni el de su frase se quedan sin recurso, y el mensaje dice cuántas son. Tampoco hay
  búsqueda semántica: se busca la palabra tal cual, así que un sinónimo no se encuentra.

## Cuántas palabras por subtítulo

Se pidió que, al generar los subtítulos, el editor **pregunte cuántas palabras** quieres en cada subtítulo/texto.

- **Qué hace ahora**: el botón **Generar subtítulos** ya no transcribe de golpe; abre el diálogo **Generar
  subtítulos** con la pregunta *Palabras por subtítulo* (1, 2, 3, 4, 5, 6, 8 u *Una línea por frase*). La elección
  se recuerda en el navegador (por defecto, 4) y se aplica al archivo `.srt` y a los eventos de la pista
  «Subtítulos», que se crean **por línea**:
  - `groupWordCues` (en `lib/editor/speech.ts`) agrupa las palabras de la transcripción de *k* en *k*: cada línea
    empieza cuando se dice su primera palabra y acaba cuando termina la última, así que los tiempos son los de la
    transcripción y no un reparto a ojo; lo que sobra al final queda en una línea más corta. Con 0 se deja **una
    línea por frase** (cada intervención del servicio).
  - El mensaje de la barra de estado lo dice: *«Subtítulos listos: 4 línea(s) de 2 palabras por subtítulo a partir
    de 8 palabra(s)…»*.
  - Los recursos de Pexels siguen colocándose **palabra a palabra** con los tiempos finos de la transcripción
    (`transcriptWords`), aunque el `.srt` vaya agrupado.
- **Comprobado**:
  - `npm test` **415/415**, con una prueba nueva del agrupado: una palabra por línea, dos por línea (la línea va de
    la primera a la última palabra), el resto en una línea corta, una línea por frase con 0 y el reparto previo de
    una frase de entrada en palabras.
  - E2E `browser.spec.ts` «los subtítulos se generan…», en Chrome, Edge y Firefox: se abre el diálogo, se elige
    **2 palabras**, se confirma, la barra dice «2 palabras por subtítulo», la pista tiene las cuatro líneas
    («Hola, esto», «es una», «prueba de», «subtítulos automáticos»), el `.srt` guardado tiene **cuatro líneas** con
    ese texto, el doble clic en el `.srt` las vuelve a insertar, `Ctrl+Z` lo deshace, al reabrir el diálogo sigue en 2
    palabras y, eligiendo **Una línea por frase**, el segundo `.srt` queda en **dos líneas** con la frase completa.
  - Los seis flujos de subtítulos y Pexels, en los tres motores: **18/18**. `tsc` sin errores; `lint` de los
    archivos tocados, 0 errores.
- **Evidencia**: `evidencias/subtitulos-palabras.png`.
- **Límite honesto**: el reparto es por número de palabras, no por puntuación: una línea puede partir una frase por
  la mitad («…prueba de» / «subtítulos automáticos»). Tampoco se ajusta al ancho del fotograma, así que una palabra
  muy larga puede ocupar más de lo que convendría en una línea de 8; para eso está el editor de textos de cada
  evento.

## 3. Comprobaciones del encargo, una por una

| Comprobación pedida | Estado | Cómo se comprobó |
|---|---|---|
| Recortar y dividir conserva el contenido esperado | ✅ | `model.test.ts`: el lado derecho conserva `offset` y duración; el recorte de inicio mantiene el fotograma de origen |
| Deshacer y rehacer restaura el proyecto | ✅ | `model.test.ts` (igualdad exacta) + E2E con `Ctrl+Z`/`Ctrl+Y` |
| Audio y video permanecen sincronizados | ✅ | `model.test.ts`: mezcla exacta a nivel de muestra (la señal empieza en la muestra 24 000 con 0,5 s de retardo); ffprobe confirma ambas pistas con la duración esperada |
| El proyecto reabierto conserva las ediciones | ✅ | E2E: descarga, reapertura y recuento idéntico de eventos; `model.test.ts`: ida y vuelta idéntica con efectos, claves, marcadores y región |
| La exportación contiene imagen, texto, transiciones y audio correctos | ✅ | ffprobe (pistas, duración, resolución) + ffmpeg (pico de audio y píxeles del texto). La mezcla de fundido cruzado se verifica al 50 % en `composition.test.ts` sobre el mismo motor que exporta |
| La cancelación no deja procesos ni recursos activos | 🟡 | E2E: tras cancelar, el estado indica «cancelada» y se puede volver a renderizar. Comprobado por comportamiento, **no** con medición de memoria ni de recursos de GPU |
| Los formatos incompatibles producen errores comprensibles | ✅ | E2E con `corrupto.mp4`: «Contenedor desconocido. Prueba convertirlo a MP4 H.264/AAC o WebM VP9/Opus». `media.test.ts` confirma que la detección es real, no por extensión |
| El tramo define lo que se renderiza | ✅ | E2E: tramo de 2 s marcado con `[` y `]`, renderizado en modo «Tramo» y duración del archivo comparada con el tramo (tolerancia 0,25 s) |
| La rueda del ratón hace zoom sobre la línea de tiempo | ✅ | E2E: el ancho del contenido crece al girar hacia arriba y se reduce al girar hacia abajo |
| Un clic en un evento lo selecciona y mueve la aguja | ✅ | E2E: el evento queda marcado como seleccionado y el timecode grande deja de ser `00:00:00.00` |
| El renderizado es más rápido y muestra trabajo real | ✅ | 300 fotogramas a 1280×720 en 5,09 s (≈59 fps de render) y barra con fotogramas, fps, transcurrido y restante |
| Los eventos agrupados se sombrean juntos | ✅ | E2E: al pulsar sobre el video, el audio de su grupo recibe la clase de sombreado; captura en `evidencias/grupo-sombreado.png` |
| Análisis del `.veg` enviado por el usuario | ✅ | Datos leídos sobre el archivo real (duración, fps, resolución, 4 medios, 2 títulos, 187 bloques) y comprobados en `tests/ai.test.ts`; informe en `ANALISIS-VEG.md` |
| Clave de Pexels | ✅ | Comprobada en vivo: la búsqueda de fotos y la de vídeos responden 200 y el contrato coincide con el analizador |
| Clave de Groq | ✅ | Comprobada en vivo: `GET /openai/v1/models` responde 200 y `whisper-large-v3` está disponible |
| Transcripción real de voz con Groq | ✅ | WAV de voz en español → dos frases con sus tiempos (`0,00–4,34 s` y `5,30–6,66 s`), tanto por consola como **desde el propio editor** (`npm run test:live`), con los dos eventos en la línea de tiempo |
| Remuestreo del audio antes de enviarlo | ✅ | Un error de proporción invertía la ratio y destrozaba el audio (Groq devolvía «.»); se detectó con una prueba real de voz, se corrigió y ahora la prueba unitaria usa una rampa y un tono de 440 Hz que habrían fallado antes |
| Un proyecto de VEGAS se puede traer al editor | 🟡 | Sí por XML (Final Cut Pro 7/DaVinci Resolve) y EDL, con informe de lo leído; **no** por `.veg`, que es propietario y sin especificación |
| Comparación visual con la captura de referencia | ⬜ | **No realizada: la captura no estaba disponible en ninguna de las sesiones de trabajo** |
| Pruebas en Chrome, Edge, Firefox y Safari en sus sistemas | 🟡 | Chrome, Edge y Firefox: automatizadas y correctas. Safari/WebKit real en macOS: no probado |
| Matriz de funciones con estados diferenciados | ✅ | [FEATURES.md](FEATURES.md) |
| Composición 3D con giros y distancia (ronda 8) | ✅ | `tests/threed.test.ts`: 11 pruebas. La proyección se compara contra un modelo de cámara escrito aparte (diferencia máxima 2,3·10⁻¹³ en las cuatro esquinas de seis poses distintas); el mapeo proyectivo lleva las esquinas del cuadrado a las del cuadrilátero y su inverso vuelve al punto de partida con error menor que 10⁻⁹; el compositor pinta el trapecio, deja ver el fondo donde el plano no llega y no deja costuras (se recorren todas las columnas del interior). E2E: los tres campos llegan al proyecto autoguardado, el gesto de girar con el ratón también y los valores sobreviven a recargar |
| Tomas de efectos de audio por pista y por bus (ronda 9) | ✅ | `tests/audio-effects.test.ts`: 12 pruebas que **miden la señal de salida** con señales conocidas (una constante, un impulso o un tono) y no la interfaz: la estantería de graves a ±6 dB multiplica por 1,995 y por 0,5; el compresor de −6 dB contra un umbral de −30 dB a 4:1 deja 0,0631 y la ganancia de salida lo dobla; el limitador no pasa del techo; la puerta silencia por debajo del umbral; la saturación crece con la cantidad y no toca nada a cero; el eco llega a los 250 ms con la mitad de nivel y el segundo vale la realimentación por el primero; la reverberación deja cola y se apaga; el teléfono baja los 8 kHz a menos de la mitad; y las tomas se aplican antes del nivel y en el orden pista → bus. E2E del rack completo (añadir, ajustar, ordenar, apagar, quitar, en pista y en bus, y que sobreviva a recargar) |
| Medidores de audio calibrados (ronda 9) | ✅ | `tests/meter.test.ts`: 6 pruebas. El pico y el RMS se comprueban con aritmética exacta y con el silencio y el recorte; la **sonoridad se ancla en el punto de calibración de la norma** (un tono de 1 kHz a −20 dBFS mide −23,0 LUFS) y su escala es lineal a 6 dB por 6 LU; la forma del filtro K se comprueba con un barrido (los 20 Hz bajan más de 6 LU y los 8 kHz suben más de 3); el pico real supera al de las muestras en un tono desfasado; el medidor acumulativo, el reinicio y el resumen funcionan; y las dos puertas descartan los silencios largos. E2E: la barra sube al reproducir y vuelve a cero al pausar. **La sonoridad no está contrastada con un medidor homologado**: se documenta como aproximación |
| Timecode SMPTE con y sin descarte (ronda 10) | ✅ | `tests/timecode.test.ts`: 7 pruebas con la aritmética de la norma. Sin descarte la numeración es corrida y el desfase a una hora se mide (3,6 s a 29,97 fps); **con descarte se comprueban los saltos**: el fotograma real 1800 es `00:01:00;02` (los números `;00` y `;01` no existen), al minuto 10 vuelve a haber `;00`, a 59,94 se saltan cuatro números y el fotograma 107892 es exactamente `01:00:00;00` (una hora de timecode es una hora real); el descarte se rechaza a 25, 30 y 23,976 fps; el analizador entiende `HH:MM:SS:FF`, `HH:MM:SS;FF`, `MM:SS:FF`, `SS.mmm` y segundos sueltos, y rechaza un fotograma que no existe; y la ida y vuelta es exacta en los tres formatos. E2E: la suite de navegador comprueba el formato en el monitor, en la barra de estado y en el tramo |
| Región de bucle independiente del tramo (ronda 11) | ✅ | `tests/loop-region.test.ts`: 11 pruebas. `normalizeRange` ordena y cuantiza cualquier par de tiempos con un fotograma de mínimo; el rango es semiabierto (`inRange` excluye el final); `shiftRange` solo mueve lo que empieza en el punto de corte y no baja de cero; la región de bucle y el tramo **no se pisan** al marcarse; `playbackSpan` da prioridad al bucle, después al tramo y, sin ninguno, deja que se repita el proyecto entero; el ida y vuelta por el `.corte15` conserva el bucle y rechaza uno invertido; y el rizo total (recortar, mover y borrar) arrastra el bucle mientras el rizo de una pista no lo toca. E2E: se marca con `Ctrl` y arrastrar sin crear tramo, se ajusta ±1 s con el tirador, se comprueba el autoguardado, se reproduce 4,2 s con un bucle de 2 s y el cursor sigue dentro de la zona, se copia el tramo con *Desde tramo* y se quita con `Ctrl+Mayús+L` |
| Lote de renderizado (ronda 12) | ✅ | `tests/batch.test.ts`: 10 pruebas de la lógica pura. Los nombres sanean lo que Windows no admite y llevan proyecto, trabajo y formato; la etiqueta dice formato, tamaño, velocidad y ámbito; dos trabajos iguales se numeran (`[2]`) en vez de pisarse; los fotogramas salen del proyecto y de su ámbito (90 en 3 s a 30 fps, 30 en un tramo de 1 s); añadir trabajos **no modifica** la lista ni los ajustes ya encolados; se rechaza con un motivo el trabajo sin salidas, sin tramo, con tramo vacío, con un formato que el motor no codifica y el proyecto vacío; las plantillas disponibles respetan las capacidades del motor y no cambian la velocidad ni el ámbito elegidos; el resumen cuenta estados, fotogramas (solo los de trabajos con vídeo) y bytes; y el siguiente trabajo es el primero en espera o el que falló, para poder reintentarlo. E2E: dos trabajos (vídeo 160×90 y WAV) se renderizan en serie, llegan **dos descargas** con sus nombres y ffprobe confirma que el primero tiene vídeo y dura 1 s y el segundo solo audio. Origen en VEGAS 15: el script `Script Menu/Batch Render.cs` |
| Ventana flotante de Panoramización y recorte (ronda 12) | ✅ | La ventana dejó de ser una columna estrecha dentro de un diálogo centrado: ahora es un lienzo a pantalla completa con una ventana flotante dentro, ancha de partida (1180×660 como máximo), que se mueve arrastrándola por la barra de título, por sus bordes o por cualquier hueco libre, y se redimensiona desde sus ocho tiradores (cuatro lados y cuatro esquinas). Mínimo 460×320; si cabe en pantalla se mantiene entera dentro y, si no, se ancla para que quede un trozo a la vista; doble clic en la barra o *Centrar* la devuelven a su sitio. E2E: tamaño inicial ancho y dentro de la pantalla, encogido por la esquina sin mover la ventana, movimiento exacto por la barra, cambio de ancho por el borde izquierdo con el borde derecho quieto, mínimo respetado, tope contra el borde de la pantalla, recentrado y comprobación de que el monitor sigue respondiendo al arrastre después. En el camino hubo que anular la animación de entrada del diálogo y la propiedad `translate` de Tailwind v4, que dejaban la ventana fuera de la pantalla |
| Ventana de Panoramización y recorte organizada como la de VEGAS (ronda 12) | ✅ | La ventana replica la disposición del *Efectos de evento de vídeo → Panoramización/Recorte* de VEGAS 15: barra de título con la chapa `ƒx`, el nombre del complemento y el `×` rojo; fila *Parámetro preestablecido* con seis preestablecidos; columna de parámetros a la izquierda con los grupos **Posición**, **Rotación**, **Recorte**, **Origen**, **Interpolación de fotogramas clave** y **Máscara libre**; monitor a la derecha sobre un tablero de cuadros; **tira de fotogramas clave** con una marca por clave, la aguja y la escala de segundos, que mueve el cursor al hacer clic; y barra inferior con *Añadir clave aquí*, *Quitar clave*, las dos de navegación, la posición dentro del evento y *Cerrar*, pegada abajo aunque la columna se desplace. Los campos de posición van en **píxeles del proyecto** como los de VEGAS (1920 / 1080 / 960 / 540 en un proyecto 1920×1080) y son la misma magnitud que la escala y el desplazamiento porcentual. Los preestablecidos de recorte calculan los márgenes con `cropToAspect` (`tests/pancrop.test.ts`: 4:3 deja 12,5 % por lado, 1:1 deja 21,875 %, un encuadre vertical recorta arriba y abajo y la relación resultante se comprueba con aritmética). E2E: parámetros a la izquierda del monitor, los cuatro valores en píxeles, el centro que mueve el encuadre, la anchura que cambia la escala, el preestablecido 1:1 que deja 21,88 % por lado, la tira de claves que coloca el cursor y la barra inferior a la vista |

| Un solo `Recortar` | ✅ | El *Recortar* del clic derecho (Ctrl/Cmd+T) recorta los eventos seleccionados a los bordes del tramo; si no hay tramo lo dice en la barra de estado en vez de no hacer nada |
| **Menú del clic derecho del evento replicado de VEGAS 15 (ronda 16)** | ✅ | E2E `browser.spec.ts` → «el clic derecho abre el menú del editor…»: sobre un evento, **los 27 rótulos** del recurso `POPUP_IDX_VIDEO_SURFACE` están presentes y cada uno una sola vez (Abrir en recortadora, Seleccionar en lista de medios del proyecto, Editar medios generados..., Efectos de medios..., Panoramización/recorte de evento de vídeo..., Efectos de evento de vídeo..., Cortar, Copiar, Pegar atributos de evento, Pegado selectivo de atributos de evento, Eliminar, Recortar, Recortar principio, Recortar final, Dividir, Crear subclip, Invertir, Seleccionar eventos hasta el final, Insertar/eliminar envolvente, Congelar fotograma en el cursor, Progreso de transición, Modificadores, Toma, Grupo, Sincronizar, Enlace sinc y Propiedades...). Los rótulos se copiaron de la tabla de cadenas en español del propio ejecutable (`ANALISIS-VEGAS-REA.md` §6) |
| **Submenús «▸» del menú del evento (ronda 16)** | ✅ | E2E `browser.spec.ts` → «el submenú Modificadores y la ventana Propiedades…»: al pasar el puntero por *Modificadores* se abre su panel y contiene las ocho entradas de VEGAS (Silencio, Bloqueo, Bucle, Mantener relación de aspecto, Reducir parpadeo de entrelazado, Utilice el modo Re-muestreo de proyecto, Forzar re-muestreo, Deshabilitar re-muestreo); el panel se mide para voltearse si no cabe |
| **Interruptores del evento de verdad (ronda 16)** | ✅ | La misma prueba activa *Modificadores ▸ Bloqueo* y comprueba **en el proyecto autoguardado** que el evento y su audio enlazado quedan bloqueados; después pulse Supr y el evento **sigue ahí**, con el aviso en la barra de estado; desbloqueado desde la ventana, Supr sí lo borra. `tests/event-switches.test.ts` añade 13 pruebas unitarias: el instante de origen con bucle, inversión, ajuste al fotograma y velocidad de inframuestreo; el silencio del evento y de su grupo medida en la mezcla; el reparto de canales (Ambos, Sólo izquierdo, Sólo derecho, Combinar, Intercambiar) medido muestra a muestra; la inversión de fase; el bloqueo; la sincronización por desplazamiento y por deslizamiento; la inversión del material; y que la validación rechaza un modo de re-muestreo y un canal que no existen |
| **Ventana «Propiedades» con las dos pestañas de VEGAS 15 (ronda 16)** | ✅ | E2E: el doble clic abre la ventana con las pestañas *Evento de vídeo* y *Medios*; en la primera están «Nombre de toma activa», los cinco interruptores de Modificadores, los tres botones de re-muestreo, el ajuste al fotograma del proyecto y los campos de velocidad e inframuestreo; en la segunda aparecen «Nombre de archivo:», «Relación de aspecto del píxel:» y «Espacio de color:». *Cancelar* revierte (se comprueba en el autoguardado que el bloqueo vuelve) y *Aceptar* aplica (el recuento de eventos bloqueados pasa a cero y Supr ya borra). Capturas `evidencias/propiedades-replica-vegas.png` y `propiedades-replica-medios.png` |
| **Ventana de Panoramización y recorte, completa (ronda 17)** | ✅ | E2E `parity.spec.ts` → «migas, números de VEGAS, estarcido, vista y preestablecidos propios»: las **migas** (`Panoramización/Recorte` entre el complemento anterior y el siguiente, con el siguiente apagado), los **números con el formato de VEGAS** (`1,920.0`, `1,080.0`, `960.0`, `540.0`, `0.0`) y las flechas del campo que suben el paso y vuelven a formatear, el **estarcido del recuadro** comprobado **leyendo los píxeles del monitor** (más de un tono en una franja del borde), `Vista de zoom (%)` que agranda el lienzo **sin tocar la escala del modelo**, `Densidad de cuadrícula (px)` que llega al campo y se dibuja, `Suavidad (%)` y los dos interruptores de `Origen` (en un evento generado, sin medio, los dos salen bloqueados porque no hay material que encajar: el primero marcado, con su motivo en la pista, y el segundo apagado), y el ciclo completo del preestablecido propio: **guardar** (llega a `panCropPresets` del autoguardado), **aplicar** (recupera la escala con la que se guardó) y **borrar** (vuelve a cero), con la confirmación de VEGAS. 3 pruebas unitarias nuevas: la suavidad mezcla la curva en S con la recta y el evento sin campo se comporta como el 100 %, los preestablecidos sobreviven a la validación y un preestablecido sin nombre se rechaza |
| **Encaje que cubre el fotograma (corrección de la ronda 17)** | ✅ | `tests/composition.test.ts` → «Extender para rellenar f. escala el material hasta cubrir el fotograma»: con un medio 240×180 en un proyecto 320×180, sin la casilla quedan bandas rojas a los lados y con ella el material cubre el fotograma entero sin deformarse (se comprueban los píxeles de las dos esquinas y del centro). Encontró y fijó un defecto de cálculo: `fillFrame` y `fitFrame` devolvían la escala absoluta del medio cuando el compositor ya dibuja encajado a escala 1 |
| **Atajos que anuncia el menú del clic derecho (ronda 17)** | ✅ | `Alt+[` y `Alt+]` no existían: el menú los anunciaba y no hacían nada. Ahora recortan por rizo el principio y el final hasta el cursor, y el E2E de edición de precisión los comprueba sobre un evento entero (el final se acorta y el principio adelanta el material, que es como se comporta el rizo de la izquierda) |
| Menú del clic derecho (ronda 16) | ✅ | Los 27 rótulos del recurso `POPUP_IDX_VIDEO_SURFACE` presentes y cada uno una vez, el submenú *Modificadores ▸* con sus ocho entradas, y los atajos que anuncia el menú comprobados: `Ctrl/Cmd+X`, `Ctrl/Cmd+C`, `Ctrl/Cmd+Mayús+V`, `Supr`, `Ctrl/Cmd+T`, `S`, `Z` y —desde la ronda 17— `Alt+[` y `Alt+]`, que antes se anunciaban sin existir |
| Ventana «Propiedades» (ronda 16) | ✅ | Las dos pestañas, sus rótulos, el bloqueo real del evento, *Cancelar* que revierte y *Aceptar* que aplica; 13 pruebas unitarias de los interruptores y del instante de origen |
| **Botón del editor de texto en la barra del evento (ronda 18)** | ✅ | E2E `browser.spec.ts` → «el evento de texto lleva el icono que abre el editor, y el editor cabe en la pantalla»: la chapa de la pantalla con la página está en el evento de texto y en cada subtítulo importado del `.srt` (dos eventos de texto, dos botones; ningún otro evento lo lleva, que es lo que comprueba el recuento), y al pulsarla se abre la ventana de títulos |
| **El editor de texto cabe en la pantalla (ronda 18)** | ✅ | La misma prueba **mide la disposición real** en una ventana de 1366×768: antes la ventana de títulos medía 1 280 px dentro de un diálogo de 707 (la mitad de los ajustes, por debajo del borde y a un desplazamiento de distancia); ahora mide 553 px, termina dentro del diálogo, el diálogo **no necesita desplazarse** (`scrollHeight` = `clientHeight`), la vista previa se ve entera y queda a la izquierda de los ajustes. La prueba además escribe en un ajuste del final de la columna (`Grosor`) para comprobar que sigue siendo accesible dentro de su columna |
| **Aguja movible como el cursor de VEGAS (ronda 18)** | ✅ | E2E `browser.spec.ts` → «la aguja se mueve arrastrando por la regla, sin crear tramo»: arrastrar por la franja de abajo de la regla mueve la aguja 260 px (4 s) **sin crear tramo** (`region` sigue en cero), la franja de arriba sigue creando el tramo (1 s → 3 s), la cabeza la mueve 130 px (2 s) y un arrastre que empieza justo sobre la aguja dentro de la regla la lleva 5 s sin tocar el tramo que ya había. Las tres pruebas que ya existían sobre la aguja y el tramo —arrastrar la aguja, crear el tramo en un hueco y marcar el bucle con `Ctrl`— siguen pasando, y de hecho la del bucle fue la que delató el primer intento: una franja con `pointer-events` alrededor de la aguja **interceptaba los clics de la regla** en ese punto, así que se cambió por una regla de proximidad que no tapa nada |
| **Catálogo de transiciones ampliado a 36 (ronda 18)** | ✅ | `tests/transitions.test.ts`: 10 pruebas nuevas que **renderizan** la transición y miran los píxeles —los dos fundidos nuevos por su curva y por el color a mitad de camino, los cuatro barridos de salida, el iris circular y el rombo abriéndose desde el centro, la espiral exterior, las tres persianas nuevas (las superpuestas con las dos capas conviviendo: se cuentan los píxeles que tiran a cada color), el zoom por dentro y por fuera, las compresiones verticales y el despegado de página— más una que **recorre las 36** y exige que todas terminen cubriendo el fotograma. Esa última encontró un defecto de la ronda anterior: el tablero cuadriculado no cubría del todo antes del último instante porque su última casilla tenía el umbral exactamente en 1. E2E: la pestaña muestra las ocho familias y las 36 entradas, y una de las nuevas («Círculos centrados») llega al modelo |
| **Panel de medidores redimensionable (ronda 18)** | ✅ | E2E `browser.spec.ts` → «los medidores se ensanchan arrastrando su divisor y el texto se lee mejor»: el panel pasa de 132 px a más de 232 al arrastrar el divisor 120 px, la nota de sonoridad ocupa menos líneas que antes (se cuentan), las dos barras siguen dentro del panel, el pie de la línea de tiempo mantiene su ancho y el panel se puede volver a estrechar sin bajar de 54 px |
| **Zoom de la vista previa con la rueda (ronda 19)** | ✅ | E2E `browser.spec.ts` → «la rueda acerca la vista previa sin tocar el encuadre y las asas siguen al vídeo»: la rueda hacia arriba agranda el fotograma más de 40 px y deja el monitor desplazable (`scrollWidth` > `clientWidth`), el porcentaje del panel deja de marcar 100 %, **la escala del evento sigue en 1** (se lee del autoguardado), la caja de las asas mide lo mismo que el lienzo a lo ancho y a lo alto (±1 px), la rueda hacia abajo aleja y el botón del porcentaje devuelve el fotograma a su tamaño de encaje. Y con un proyecto vertical (plantilla TikTok) la caja vuelve a coincidir con el vídeo: es justo el caso que la captura del usuario enseñaba mal |
| **«Mantener relación de aspecto»: puesta por defecto y, quitada, el material cubre el fotograma (ronda 20)** | ✅ | E2E `browser.spec.ts` → «Mantener relación de aspecto: quitarla estira el material hasta cubrir el fotograma»: con un cuadrado verde de 180×180 en un proyecto 1920×1080 se **leen los píxeles del monitor** en tres columnas (2 %, 50 % y 98 % del ancho) y, con la casilla puesta —que es como viene— el centro es verde y los dos bordes son negros, es decir hay bandas; el submenú *Modificadores* la enseña **marcada**; el evento **no lleva el campo** en el autoguardado, que es lo que significa «puesta por defecto»; al desmarcarla en la ventana *Propiedades* (activa y marcada) el autoguardado pasa a `maintainAspect:false` y las **tres** columnas son verdes, o sea que el material llega a los bordes; y al volver a marcarla desde el grupo *Origen* de *Panoramización/recorte* el modelo vuelve a `true` y **reaparecen** las bandas laterales. Captura `evidencias/relacion-aspecto.png`. `tests/composition.test.ts` añade la prueba de píxeles del estirado y `tests/event-switches.test.ts` la ida y vuelta del campo por el `.corte15` |
| **Selección de recorte con puntos de esquina y zoom de la vista con la rueda (ronda 21)** | ✅ | `tests/pancrop.test.ts` → «selección de recorte: las esquinas recortan y acercan, y los lados solo recortan»: sin recorte la escala no cambia (1) y la región recortada se lleva al fotograma con una sola escala uniforme (recortando 25 % por lado, 2×; 20 % por lado, 1/(1−0,4) = 1,667); el centro de la región recortada cae en el centro del fotograma **también con el encuadre girado** (se comprueba con `poseMatrix`); las esquinas acercan y los puntos de los lados recortan sin tocar la escala; el recorte se limita al 45 % por lado y el zoom al tope de la escala; y un material con bandas no da ningún salto (un cuadrado de 1080 en un fotograma 1920×1080: sin recorte escala 1). E2E `browser.spec.ts` → «la selección de recorte: las esquinas recortan y acercan, y la rueda acerca la vista»: se **busca en los píxeles del monitor** la esquina inferior derecha de la selección (el color azul claro del recuadro) en vez de repetir la geometría; sin la selección puesta no hay ni un píxel de ese color y al pulsar *Agregar recorte* aparecen el recuadro y sus ocho puntos (`data-crop-selection="on"`, más de 0 píxeles, y la ayuda de la ventana lo dice); al arrastrar esa esquina hacia dentro el autoguardado recibe los márgenes (`right` y `bottom` > 0) y **la escala sube por encima de 1,05** (acerca); al volver a agarrar la esquina ya dibujada —que se ha movido porque la imagen se ha acercado— y arrastrarla hacia fuera la escala **baja** y el recorte se reduce (aleja); la rueda sube `Vista de zoom (%)` por encima de 100 (y el campo muestra la misma cifra) y al girarla hacia abajo la baja, **con la escala del modelo intacta**; y **fuera del monitor** (con el puntero sobre la columna de parámetros) la rueda no cambia la vista, no desplaza la columna (`scrollTop` igual) y no cambia el ancho de la línea de tiempo de detrás, que es lo que pide el flujo de trabajo. Captura `evidencias/seleccion-recorte.png` |
| **Posiciones del texto con nombre, como «Texto centrado» (ronda 22)** | ✅ | `tests/text-positions.test.ts` (4 pruebas): las **trece** posiciones se reconocen después de aplicarlas (ida y vuelta por todas), la lista no repite identificadores ni se deja ninguna sin grupo, una posición que no existe no toca el evento, y el bloque cae donde dice el nombre **medido con el mismo `planText` que pinta** —centrado, el bloque con su centro en el centro del fotograma; *Arriba (centrado)* empieza al 8 % del alto y **sigue ahí con tres líneas** (el anclaje `top-*` lo hace crecer hacia abajo); *Abajo (centrado)* termina al 92 % y con tres líneas sigue terminando al 92 % sin salirse; *Centro a la izquierda* toca el 5 %, *Centro a la derecha* el 95 %; *Tercio inferior* termina en el 64 %; y las cuatro esquinas—, los desplazamientos no se salen del fotograma, el anclaje concuerda con el nombre (arriba `top-*`, abajo `bottom-*`, izquierda `-left`…) y *Subtítulo (centro abajo)* es exactamente `SUBTITLE_STYLE.offsetY`, la posición que usa el generador de subtítulos (para que no se separen). E2E `browser.spec.ts` → «las posiciones del texto: “Texto centrado”, arriba, abajo y el tercio inferior colocan el texto»: un título sobre un proyecto vacío (texto blanco sobre negro) y se **cuentan los píxeles casi blancos por tercios de la vista previa**; un título recién creado ya sale centrado (`middle-center|0.000|0.000` en el autoguardado) y con su botón marcado; *Arriba (centrado)* deja `top-center|0.000|-0.420` y el blanco solo en el tercio de arriba; *Abajo (centrado)* deja `bottom-center|0.000|0.420` y el blanco solo en el de abajo; desde la lista completa, *Tercio inferior (centrado)* deja `bottom-center|0.000|0.140` con el blanco en el tercio de en medio (no toca ni arriba ni abajo) y *Abajo a la derecha* deja `bottom-right|0.450|0.420` con el blanco abajo y el anclaje del grupo *Punto de anclaje* marcado en «Abajo derecha». Captura `evidencias/titles-posiciones.png` |
| **Forma de onda del audio legible, como la de VEGAS (ronda 23)** | ✅ | `tests/waveform.test.ts` (5 pruebas): con una señal que tiene **un pico aislado** en el milisegundo 250, las cuatro columnas de un segundo dan `[0, 0.9, 0, 0]` —el pico cae en su columna y no se pierde, que es justo lo que hacía la lectura del pico más cercano—; una columna estrecha sigue viendo el pico y una columna que abarca todo el archivo toma el mayor, así que al alejar no se aplana; el tramo se ordena si llega al revés, se recorta al material y lo que se sale queda en silencio; los picos guardados dan el mayor de los que cubre cada columna (y el más cercano si el tramo es más corto que un pico); la onda prefiere las **muestras decodificadas** (`source: 'pcm'`) sobre la copia guardada, se limita a 24–4 000 columnas y da la vuelta a las columnas con el material invertido; el trazado SVG es **simétrico alrededor del cero** (un pico de 0,5 sube 23 unidades y uno de 1 sube 46, con 8 unidades de margen, y los valores fuera de rango o no finitos se recortan) y la copia del medio tiene **1 024 valores de 0 a 1 con tres decimales**. E2E `browser.spec.ts` → «la forma de onda del audio: una columna por píxel, leída del sonido y con la línea del cero»: se importa `voz-prueba.wav` y se mide el SVG del evento —las columnas son **el ancho del evento en pantalla** (±1 px, y más de 240, que era la constante anterior), la onda viene del sonido (`data-waveform-source="pcm"`), están la línea del cero, la silueta y el contorno, la silueta se cierra y lleva un punto por columna en cada vuelta, los picos suben y bajan **más de 15 unidades** de forma simétrica— y al acercar el zoom con la rueda hay **más columnas**, muchas alturas distintas en la envolvente y **pausas visibles** (columnas casi en el cero); y la misma onda se comprueba en el **trimmer** del mismo material (640 columnas, del sonido y con su línea del cero). Capturas `evidencias/onda-audio.png` y `evidencias/onda-trimmer.png` |
| **La aguja se agarra desde los carriles, con el clic mantenido (ronda 24)** | ✅ | E2E `browser.spec.ts` → «la aguja se agarra desde los carriles y se arrastra sin tocar el evento de debajo»: con un vídeo en la pista, un clic en medio del evento coloca la aguja ahí (el timecode deja de ser cero) y se apunta el inicio del evento en el autoguardado; después se **agarra la línea justo encima del propio evento** y se arrastra 40 px con el clic mantenido —el timecode **cambia** (la aguja se movió), el inicio del evento **sigue igual** (no se movió) y `region` **sigue en nulo** (no se marcó tramo)—; lo mismo agarrando la línea **sobre un hueco del carril**, que tampoco marca tramo; y para cerrar, **lejos de la aguja** (a más de 30 px) el evento **sí** se mueve, que es lo que comprueba que la tolerancia de 7 px no se come el gesto normal. Las diez pruebas que ya existían sobre la aguja, la regla, el tramo, la región de bucle, la envolvente y el clic derecho se volvieron a ejecutar y siguen pasando (la de la envolvente añade puntos con un clic, y por eso el editor le pasa `onPlayheadPress` para que un clic sobre la aguja no añada nada) |
| **El editor deja de trabarse al reproducir (ronda 25)** | ✅ | `npm run test:perf` (sonda nueva, no forma parte de la suite): mide fotogramas reales del navegador con `requestAnimationFrame` en cuatro situaciones y publica el informe en `outputs/rendimiento-ui.json`. **Antes** (medido con el mismo montaje de quince eventos): reproducción p95 **83,4 ms**, peor **116,8 ms**, **21 fotogramas** por encima de 50 ms en 3 s; zoom p95 50,1 ms con 10 largos. **Después**: reproducción p95 **16,8 ms**, peor 83,2 ms, **2 fotogramas largos**; zoom p95 50 ms con **6 largos**; arrastre de la aguja p95 16,8 ms con 0; autoguardado sin largos. El cambio no toca lo que se ve ni lo que se guarda: la aguja y el timecode se mueven por referencia, el monitor se compone con la misma función `compose` (con el descarte por versión), los medidores muestran las mismas cifras por su almacén, y el estado de React se sincroniza con el cursor cuando hay un diálogo abierto y al pausar. La corrida funcional de los cuatro motores de esta ronda (arriba) es la que confirma que no se rompió nada: las 73 pruebas de siempre siguen pasando |

## 4. Informe de capacidades por motor (medido, no supuesto)

Salida de `tests/diagnostics.spec.ts`:

| Motor | `VideoDecoder` | `AudioDecoder` | `VideoEncoder` | `AudioContext` | `canEncode` MP4 | `canEncode` WebM | Importar MP4 | Importar WAV |
|---|---|---|---|---|---|---|---|---|
| Chrome | sí | sí | sí | sí | **sí** | sí | ✅ | ✅ |
| Edge | sí | sí | sí | sí | **sí** | sí | ✅ | ✅ |
| Firefox | sí | sí | sí | sí | no | **sí** | ✅ | ✅ |
| WebKit (Playwright) | no | no | no | **no** | no | no | ❌ mensaje claro | ❌ mensaje claro |

Consecuencias aplicadas al producto:

- El diálogo de exportación propone **MP4** donde H.264/AAC existe y **WebM** donde no, marcando el formato
  ausente como «(no disponible)», y ofrece **WAV** como salida de solo audio.
- Si no hay ningún códec disponible, el editor muestra el aviso y **deshabilita** el botón de renderizado en
  lugar de permitir una pulsación que fallaría.
- La exportación necesita además **Web Audio** (`AudioContext`/`AudioBuffer`) para construir los bloques de
  audio: en un motor sin esa API el aviso lo dice y sugiere desmarcar *Incluir audio*.
- Si faltan WebCodecs o Web Audio, aparece una banda de aviso al arrancar indicando exactamente qué API falta.

## 5. Lo que queda sin verificar (y por qué)

1. **Comparación con la captura de VEGAS Pro 15:** la ventana de Panoramización y recorte se reconstruyó a
   partir de la captura del *Efectos de evento de vídeo → Panoramización/Recorte* que enviaste y de los
   recursos de la instalación que hay en esta máquina (`C:\Program Files\VEGAS\VEGAS Pro 15.0`), y su
   disposición se comprueba con medidas reales en un flujo de navegador; aun así **no se declara paridad
   píxel a píxel**: no se pudo ejecutar VEGAS para poner las dos ventanas lado a lado. Las diferencias que se
   mantienen a propósito están listadas en `README.md` §5.5 y `FEATURES.md` §13.
   En la ronda 16 se hizo lo mismo con el **menú del clic derecho y la ventana «Propiedades»**: los rótulos y
   el orden salen de la tabla de cadenas en español del propio `vegas150.exe` (leída con herramientas
   corrientes, porque REA no pudo inventariar sus 5 518 recursos), y lo que se comprueba en el navegador es
   que el menú muestra esa lista exacta y que la ventana tiene esas dos pestañas y esos campos. Lo que **no**
   se puede comprobar sin ejecutar VEGAS es que su ventana se vea exactamente igual: no hay comparación de
   píxeles entre las dos, y por eso las dos capturas nuevas son evidencia de lo que hace Corte 15, no una
   prueba de igualdad con VEGAS.
2. **Lectura de `.veg`:** hay dos caminos y los dos se probaron hasta donde se pudo. El **análisis sin VEGAS**
   se verificó sobre tu archivo real (estructura, propiedades, medios y títulos). El **puente con VEGAS**
   (`README.md` §5.2) tiene su contrato cubierto por 9 pruebas unitarias —unidades ns↔ticks, velocidades,
   encuadre, referencias de medios y el TSV que VEGAS vuelve a leer—, pero **el lado de VEGAS no se ejecutó**:
   el programa está instalado en este equipo (de ahí salieron las cadenas, las identidades y los scripts de
   `ANALISIS-VEGAS-REA.md`), pero no se lanzó `vegas150.exe` con el script del puente, así que el recorrido
   real (arrancar VEGAS, recibir el montaje) queda pendiente de que lo pruebes en tu máquina.
3. **Contraste de los analizadores con archivos reales:** los fixtures de XML y EDL siguen las estructuras
   documentadas de xmeml v5 y CMX 3600, pero **no los generó una instalación real de VEGAS Pro 15**, porque no
   había ninguna disponible. Un XML o un EDL de tu versión podría usar variantes no cubiertas; el informe de
   importación dirá exactamente qué no se pudo leer.
4. **Manual PDF de VEGAS Pro 15:** `web_fetch` no procesa `application/pdf`, así que no se pudo extraer el
   manual indicado en el encargo. Los atajos marcados como verificados se contrastaron con la ayuda oficial
   de VEGAS ([Boris FX, atajos de teclado](https://cdn.borisfx.com/borisfx/Documentation/vegas/2026/en/content/topics/13-appendix/shortcutkeys.htm)),
   que confirma `Ctrl+O`, `Ctrl+S`, `Alt+Enter` (propiedades del proyecto), `Alt+←/→` (un fotograma) y
   `Tab` (foco entre lista de pistas y línea de tiempo). El resto de atajos siguen la convención clásica.
5. **Recuperación automática, revinculación, bucle, aviso de almacenamiento y salidas
   parciales:** ya **no** están en esta lista: se cubrieron con seis pruebas nuevas (recarga con autoguardado,
   revincular un `.wav` de un XML importado, bucle de un tramo de 1 s, región de bucle independiente del tramo
   con tiradores, ajuste y repetición real, cuota simulada casi llena y exportación
   solo audio / solo vídeo verificada con ffprobe en cada motor.
6. **Rendimiento y memoria:** el renderizado medido y verificado llega a 1280×720 (≈59 fps de render sin
   efectos no neutros). El mapeo 3D está medido por fotograma (12 ms a 640×360 y 103 ms a 1080p por evento
   girado, `outputs/probe-3d-rendimiento.ts`), pero **no** se midió una exportación completa a 1080p con muchas
   pistas, efectos no neutros y varios eventos en 3D a la vez, ni el consumo de memoria con proyectos largos;
   la salida se retiene en memoria con un límite declarado de 256 MB.
7. **Sonoridad:** el medidor sigue el método de ITU-R BS.1770 con las puertas de EBU R128 y está anclado en el
   punto de calibración de la norma, pero **no se ha contrastado con un medidor homologado ni con el banco de
   pruebas de EBU**, y los coeficientes del filtro K solo son exactos a 48 kHz. El pico, el pico real y el RMS
   sí son exactos. Se dice en la interfaz y en `README.md` §9.
8. **Tomas de audio:** las ocho tomas son propias; **no se cargan complementos VST ni OFX**, que son binarios
   de terceros que un navegador no puede ejecutar. Tampoco hay audio multicanal 5.1.
9. **Estabilidad en sesiones largas:** no se probaron proyectos de muchas pistas ni sesiones de horas.
10. **Sistemas operativos distintos de Windows:** sin probar. El único fallo observado en WebKit (el arrastre
    del encuadre de Pan/Crop no llegaba al modelo al correr la suite completa con la máquina cargada) resultó
    ser de temporización de los gestos sintéticos: los arrastres de esa prueba se espaciaron como los de un
    ratón real, con el mismo criterio que ya usaba `browser.spec.ts`, y se repitió tres veces seguidas sin
    fallo. No hay un defecto del editor reproducido en un navegador real.
11. **Nombre de los formatos de timecode:** la aritmética es la de SMPTE 12M y está probada, pero **no se ha
    contrastado con el manual de VEGAS 15** cómo llama a los tres formatos en su menú; la interfaz usa nombres
    descriptivos (sin descarte, con descarte, segundos) en lugar de afirmar que son los suyos.
12. **Réplica del clic derecho y de la ventana Propiedades (ronda 16):** los rótulos y el orden de las entradas
    **sí** están copiados de la tabla de cadenas del ejecutable instalado, y las funciones que se pueden
    comprobar en el navegador (bloqueo, silencio, bucle, inversión, re-muestreo, inframuestreo, canales,
    sincronización, congelar fotograma) tienen prueba. Lo que **no** está verificado: que la ventana de VEGAS
    se vea igual que la de aquí (no se ejecutó VEGAS para compararlas), que el algoritmo de las órdenes sin
    equivalente sea el suyo (Crear subclip, Toma, Enlace sinc, tiempo no real, editor de audio externo y
    Sensibilidad están desactivadas con el motivo a la vista), y que *Reducir parpadeo de entrelazado* sea el
    mismo proceso (aquí es una mezcla vertical de tres tomas). *Mantener relación de aspecto* ya no está en esta
    lista desde la ronda 20: el compositor la aplica y su efecto está medido en los píxeles del monitor, pero **sí
    está sin contrastar con VEGAS** que su casilla desmarcada deforme igual (aquí estira hasta el rectángulo del
    recorte). Todo esto se dice en la propia ventana, en `FEATURES.md` §13 y en `ANALISIS-VEGAS-REA.md` §6.1.

## 6. Cómo reproducir esta verificación

```sh
npm ci
npm test                                          # 281 pruebas del motor, del intercambio, del .veg, del puente, de las plantillas, de las posiciones del texto, de la forma de onda, de los interruptores del evento y de las APIs
npx tsc --noEmit                                  # tipos
npm run build                                     # build de producción
npx playwright install firefox webkit             # una sola vez, para los cuatro motores
npm run test:browser                              # 73 flujos × 4 motores; usa tus Chrome/Edge instalados
npm run test:live                                 # subtítulos contra Groq de verdad (necesita red y clave)
npm run test:capabilities                         # APIs y códecs por motor + medición de renderizado
npm run test:perf                                 # rendimiento de la interfaz (informe en outputs/rendimiento-ui.json)
npm run capture:ui                                # capturas en evidencias/
```

`npm run test:browser` arranca el servidor de desarrollo por sí mismo (puerto 5173).
