> Actualización 2026-10-13: el Pan/Crop de evento se sustituyó. Estado, pruebas y diferencias pendientes: [PANCROP-2026-10-13](outputs/PANCROP-2026-10-13.md). Las descripciones antiguas del recorte por márgenes corresponden al motor heredado.

# Corte 15 — matriz de funciones

Documento de estado real, no de intenciones. Referencia declarada: espacio de trabajo clásico de VEGAS Pro 15.
Leyenda:

- **✅ Verificada** — implementada y comprobada con una prueba ejecutada o una observación registrada.
- **🟡 Parcial** — funciona con límites explícitos, o está implementada sin prueba ejecutada.
- **⬜ Pendiente** — no implementada.
- **🌐 Limitada por el navegador** — depende de APIs que no todos los motores exponen.

Cada fila indica la evidencia. Las pruebas automatizadas están en `tests/`; su resultado está en
[VERIFICACION.md](VERIFICACION.md).

> **Nota sobre la referencia visual.** La captura de VEGAS Pro 15 mencionada en el encargo no estuvo
> disponible en esta sesión de trabajo (no hay ninguna imagen de referencia en el repositorio ni en el
> entorno). Por tanto **no se afirma haberla visto ni se declara paridad visual por comparación directa**.
> La interfaz se construyó a partir de la descripción del espacio de trabajo clásico y de la documentación
> pública de VEGAS; el manual PDF de la versión 15 indicado en el encargo no se pudo extraer con las
> herramientas de esta sesión (`web_fetch` no procesa `application/pdf`). La comparación visual queda como
> paso pendiente en §13.

---

## 1. Motor temporal, modelo y comandos

| Función | Estado | Evidencia |
|---|---|---|
| Base temporal entera (ticks de 705 600 000/s) sin deriva | ✅ | `model.test.ts`: 107 892 fotogramas a 30000/1001 exactos |
| FPS como fracción racional (24, 25, 30, 29.97, 23.976, 50, 60, 59.94) | ✅ | Validación Zod + prueba de cuantización a fotograma |
| Comandos: dividir, recortar, mover, borrar, pegar, duplicar, agrupar | ✅ | `model.test.ts` (dividir conserva origen, duración y grupos) |
| Ripple: desactivado / pistas afectadas / todas + marcadores | ✅ | Pruebas de ripple simple y múltiple |
| Ripple en mover y pegar | ✅ | `rippleMove` se aplica al pegar y al arrastrar un evento: lo que venía después se desplaza lo mismo (por pista o en todas, con marcadores y tramo incluidos); 5 pruebas unitarias y E2E |
| Historial deshacer/rehacer (100 pasos) | ✅ | `model.test.ts` restauración exacta + `browser.spec.ts` Ctrl+Z / Ctrl+Y |
| Fotogramas clave lineales de transformación y opacidad | ✅ | `model.test.ts`: dividir conserva la curva en ambos lados |
| Interpolación de claves: los seis modos de VEGAS 15 | ✅ | Lineal, Suave, Brusco, Mantener, Rápido y Lento (`KeyframeModeLinear/Smooth/Sharp/Hold/Fast/Slow` en los recursos de VEGAS 15); la curva de cada clave gobierna el tramo hasta la siguiente, tanto en la transformación como en el recorte; se eligen en la ventana de Panoramización y recorte; 5 pruebas unitarias y E2E |
| Curvas Bézier editables (manejadores) | ⬜ | Los seis modos interpolan por curva, pero no hay manejadores que se arrastren |

## 2. Interfaz

| Función | Estado | Evidencia |
|---|---|---|
| Tema gris oscuro, controles compactos, radio 0, tipografía pequeña | ✅ | `app/editor.css`, captura del editor en `test-results/.../editor.png` |
| Barra de título, menús (Archivo…Ayuda) y barra de herramientas | ✅ | Captura + pruebas E2E que operan esos botones |
| Paneles de Medios de proyecto, Explorador, Transiciones, Efectos de video, Generadores | ✅ | `editor.tsx` (pestañas) + E2E sobre *Generadores de medios* |
| Monitor de previsualización con selector de calidad, timecode y transporte | ✅ | `editor.tsx`; E2E usa *Reproducir*, *Pausa*, *Ir al inicio*. El timecode sale en el formato elegido en el proyecto (SMPTE con o sin descarte, o segundos) y hay un campo **Ir a timecode** que lo entiende al escribirlo: `lib/editor/timecode.ts`, 7 pruebas unitarias |
| Medidores de audio | ✅ | `lib/editor/meter.ts`: **pico** y **pico real** (dBFS, con interpolación entre muestras), **RMS** y **sonoridad** en LUFS con el filtro K y las dos puertas de ITU-R BS.1770 / EBU R128, más un testigo de recorte. La calibración se comprueba con el punto de la norma (1 kHz a −20 dBFS mide −23,0 LUFS) y la forma del filtro K con un barrido de frecuencias; 6 pruebas unitarias y E2E de que la barra sube al reproducir y vuelve a cero al pausar. **La sonoridad es una aproximación**: no se ha contrastado con un medidor homologado ni con el banco de pruebas de EBU, y así se dice en la interfaz |
| **El panel de medidores se ensancha y se estrecha arrastrando su borde (ronda 18)** | ✅ | Entre la vista previa y los medidores hay un divisor: mantener el clic y arrastrar cambia el ancho del panel entre 54 y 420 px (empieza en 132, el doble del ancho que tenía), así que su nota de sonoridad —que a 54 px se partía en nueve líneas— se lee de un vistazo. El texto pasa a ocupar menos líneas, las barras siguen dentro del panel y el resto del espacio de trabajo no se mueve. E2E que mide el ancho antes y después de arrastrar, cuenta las líneas de la nota, comprueba que se puede volver a estrechar y que el ancho no baja del mínimo |
| **Zoom de la vista previa con la rueda del ratón (ronda 19)** | ✅ | La rueda sobre el monitor acerca y aleja la **vista** entre el 25 % y el 800 %, anclada en el punto que hay bajo el puntero: el fotograma crece alrededor de lo que estás mirando y el monitor se desplaza para llegar a cualquier esquina. No toca el recurso —la escala del evento sigue igual, y el E2E lo comprueba en el proyecto autoguardado—. En la barra del panel están además los botones de alejar, acercar y el porcentaje, que vuelve al encaje con un clic. El zoom multiplica el tamaño del fotograma que ya cabe en el monitor (medido con un `ResizeObserver`), no una transformación: así las asas y los campos siguen trabajando en píxeles reales |
| **Marco del fotograma: asas y vídeo alineados (ronda 19)** | ✅ | La capa de asas cubría **todo el monitor** mientras sus porcentajes se calculaban sobre el fotograma, así que con un proyecto vertical o un panel ancho la caja se dibujaba donde no estaba la imagen (la captura que envió el usuario lo enseñaba). Ahora el lienzo y la capa van dentro de un marco del tamaño exacto del fotograma, y la prueba comprueba que la caja mide lo mismo que el vídeo, a lo ancho y a lo alto, con un proyecto horizontal **y** con uno vertical |
| Línea de tiempo multipista con regla, cursor, región, marcadores y desplazamiento | ✅ | E2E (cursor, región) y `model.test.ts` (marcadores con ripple) |
| Cabeceras de pista: nombre, silenciar, solo, nivel, altura | ✅ | `editor.tsx`; mezcla verificada en `model.test.ts` |
| Seleccionar una pista y eliminarla con clic derecho o `Supr` | ✅ | La cabecera se sombrea al seleccionarla; el clic derecho abre su menú (propiedades, silenciar, solo, subir, bajar, eliminar) y `Supr` la elimina con sus eventos; tres pruebas E2E cubren selección + `Supr` + deshacer, el menú contextual y que con eventos seleccionados `Supr` no toque la pista |
| Paneles redimensionables y distribución persistente | ✅ | Arrastre de divisores; `upper`/`left` se guardan en `localStorage` |
| Menús contextuales | 🟡 | Existen sobre eventos (propiedades, dividir, copiar, cortar, duplicar, agrupar, eliminar). No hay menú contextual en regla, pistas ni cabeceras |
| Ventanas de propiedades | 🟡 | Un diálogo por contexto (evento, pista, proyecto, exportación) en lugar de ventanas flotantes acoplables |
| Acoplar/desacoplar paneles y diseños guardados (Alt+D+0-9) | ⬜ | — |
| Adaptación a tamaños de escritorio | 🟡 | Diseño fluido en `vh`/`%`, mínimo 900×580 px; capturado y verificado a 1600×900 y 1280×720. Por debajo del mínimo aparece desplazamiento, no ocultación |

## 3. Importación y medios

| Función | Estado | Evidencia |
|---|---|---|
| Importación por selector y por arrastrar y soltar | ✅ | `input[type=file]` + `onDrop`; E2E importa 3 archivos |
| Biblioteca con miniatura, duración, resolución y metadatos | ✅ | `MediaLibrary.import`; E2E cuenta 3 elementos |
| Video, audio e imágenes | ✅ | MP4, WAV e imágenes (`createImageBitmap`) |
| Detección real de contenedor y códecs (no por extensión) | ✅ | `corrupto.mp4` (extensión válida) se rechaza con «Contenedor desconocido»; `media.test.ts` lee los códecs reales con MediaBunny |
| Comprobación de que el navegador puede decodificar el códec | ✅ | `video.canDecode()` / `audio.canDecode()`; informe por motor en `diagnostics.spec.ts` |
| Mensajes útiles ante archivo dañado o incompatible | ✅ | E2E: el estado muestra `corrupto.mp4: Contenedor desconocido…` |
| Miniaturas reales del primer fotograma | ✅ | `CanvasSink` + recorte a 160×90 |
| Formas de onda reales (240 picos) | ✅ | `AudioBufferSink`; dibujadas en el evento de audio |
| Vinculación de audio y video importados | ✅ | Eventos agrupados al insertar un video con audio |
| Revinculación de medios ausentes | 🟡 | Implementada con comprobación de tipo y duración; sin prueba automatizada |
| Límite de memoria de audio descomprimido (256 MB) con aviso | ✅ | `media.ts` |

## 4. Línea de tiempo

| Función | Estado | Evidencia |
|---|---|---|
| Varias pistas de video y audio, añadir y reordenar | ✅ | `newProject`, diálogo de pista (subir/bajar) |
| Arrastrar medios a pistas | ✅ | `onDrop` por pista |
| Mover eventos y cambiarlos de pista | ✅ | `dragEvent` con detección de pista destino |
| Recortar inicio y final (con límites de medio y fotograma mínimo) | ✅ | `model.test.ts` (dos pruebas de recorte) |
| Dividir en la posición del cursor | ✅ | `model.test.ts` + E2E con la tecla `S` |
| Selección individual y múltiple | ✅ | Clic y Ctrl/Cmd/Mayús + clic; **el clic también coloca la aguja en ese punto** (verificado en E2E) |
| Copiar, cortar, pegar, duplicar, eliminar | ✅ | `clipboard` + menú Editar + E2E |
| Agrupar y desagrupar | ✅ | `group()` usa el vínculo completo, así que `G` sobre un par de audio y video los agrupa a los dos; el menú contextual muestra la acción correcta |
| Sombreado del grupo seleccionado | ✅ | Al seleccionar un evento, todos los de su grupo se resaltan (borde discontinuo y tinte); verificado en E2E y en `evidencias/grupo-sombreado.png` |
| Ajuste magnético a bordes, cursor y marcadores | ✅ | `snapTime` con umbral en píxeles |
| Fundidos mediante tiradores en los extremos | ✅ | Rombos de entrada/salida; E2E ajusta entrada y salida |
| Transiciones por solapamiento con duración real de la intersección | ✅ | `autoCrossfade` + `model.test.ts` |
| Zoom horizontal y altura de pista | ✅ | Zoom 10–400 px/s y altura 60–220 px; **la rueda, los botones y el deslizador hacen zoom anclado en la aguja** (el fotograma del cursor no se mueve de su sitio en pantalla); al alejar del todo la aguja se queda en el principio del contenido, que es el límite físico; E2E |
| Desplazamiento horizontal y vertical | ✅ | **Ctrl/Cmd + rueda desplaza en vertical** (E2E: el `scrollTop` crece, el ancho no cambia y las cabeceras acompañan), Mayús + rueda en horizontal, Alt + rueda en vertical |
| Cambiar las pistas de sitio | ✅ | Arrastrando la cabecera (con indicador de destino y sin salir del grupo de vídeo o de audio), desde el menú de la pista, desde el diálogo de propiedades y con `Alt` + `↑`/`↓`; E2E de los tres caminos y del deshacer |
| Tramo de renderizado: crear, ajustar, quitar y reutilizar | ✅ | Arrastrar en la regla **o en cualquier hueco de la línea de tiempo**, tiradores en los extremos, botones `[` y `]`, *Desde selección*, doble clic para quitarlo; E2E del tramo (creación, ajuste por los tiradores ±1 s y borrado) y del renderizado limitado a él |
| Región de bucle: independiente del tramo | ✅ | Barra verde propia sobre la regla, con tiradores en los extremos y doble clic para quitarla; se marca con `Ctrl`/`Cmd` + arrastrar (en la regla o en un hueco), con `L` y `Mayús+L` en el cursor, o copiando el tramo con *Desde tramo* / *Insertar → Bucle desde el tramo*; se quita con `Ctrl+Mayús+L`; se guarda en el `.corte15` (`loopRegion`); 11 pruebas unitarias (`tests/loop-region.test.ts`) y E2E que comprueba que marcar el bucle **no** crea tramo, que los tiradores lo ajustan ±1 s y que el proyecto guardado lleva el rango |
| Reproducción en bucle dentro de la región | ✅ | `Alt+L` o el botón *Repetir* del pie: al llegar al final de la zona la reproducción vuelve a su principio. Manda la región de bucle; sin ella, el tramo; sin ninguno de los dos, el proyecto entero (`playbackSpan`); E2E que reproduce 4,2 s con un bucle de 2 s y comprueba que el cursor sigue dentro de la zona |
| La línea de tiempo cubre toda el área visible | ✅ | `min-width:100%` en el contenido: en ventanas anchas y con zoom mínimo ya no queda ningún hueco oscuro a la derecha (antes el contenido medía 900 px y dejaba 1435 px vacíos). E2E que mide el ancho del contenido, los carriles y la regla, y comprueba qué elemento hay bajo el puntero en el extremo derecho |
| Arrastrar la aguja manteniendo el clic | ✅ | La aguja se agarra por su tirador (la cabeza de flecha de la regla), **por la propia línea en la regla** y —desde la ronda 24— **por la línea en cualquier carril** (a 7 px o menos), y se desplaza a izquierda o derecha con el ajuste magnético; E2E: 195 px = 3 s y vuelta a 1 s, y el gesto sobre un evento no lo mueve a él |
| **Mover la aguja desde la regla, como el cursor de VEGAS (ronda 18)** | ✅ | La regla responde de tres formas: si el puntero cae **sobre la aguja** (a 7 px o menos) se la lleva; en la **franja de abajo** —donde se dibuja su cabeza— también se la mueve; y en el resto se marca el tramo de renderizado (o la región de bucle con `Ctrl`). El arrastre de la aguja la va moviendo con el puntero y con el ajuste magnético, y la línea sigue bajando por todas las pistas hasta el pie. E2E propio: la franja de abajo mueve la aguja 260 px (4 s) **sin crear tramo**, la de arriba sigue creando el tramo, la cabeza la mueve 130 px (2 s) y un arrastre que empieza sobre la aguja dentro de la regla la lleva sin tocar el tramo. La franja que se probó primero era un elemento con `pointer-events` sobre la regla, y el propio E2E del bucle la delató: **interceptaba los clics** de la regla en el sitio de la aguja, así que se cambió por la regla de proximidad, que no tapa nada |
| **La aguja se agarra también desde los carriles (ronda 24)** | ✅ | El gesto que pide el flujo de trabajo —mantener el clic sobre la línea y arrastrarla— funciona en **cualquier carril**, no solo en la regla: `playheadGrab` va en la **fase de captura** del carril (`onPointerDownCapture`), así que si el clic cae a 7 px o menos de la aguja (`playheadRect`, la misma tolerancia que la regla) el gesto se lo queda ella y no llega ni al arrastre del evento, ni al clic que selecciona, ni al que añade un punto de la envolvente. Agarrarla **no la hace saltar**: `scrubFromRuler` tiene ahora un tercer parámetro (`jump`) que distingue el clic —que coloca la aguja donde se pulsa— del agarre, que la mueve solo al arrastrar. Para la envolvente, que añade puntos por `onClick`, se pasa `onPlayheadPress`, que devuelve `true` y deja el clic sin efecto. E2E propio: con un evento en la pista, la aguja se coloca con un clic en medio, se agarra **encima del propio evento** y se arrastra (el timecode cambia y el inicio del evento **no** se mueve ni se marca tramo); lo mismo sobre un hueco del carril; y **lejos de la aguja** el evento se sigue moviendo como siempre, que es lo que comprueba que la tolerancia no se come el gesto normal. Las diez pruebas que ya existían sobre la aguja, la regla, el tramo, el bucle, la envolvente y el clic derecho siguen pasando |
| Sombreado de la pista seleccionada | ✅ | La cabecera se sombrea (tono propio en las de audio) y su carril queda marcado; E2E que comprueba el color calculado, no solo la clase |
| Marcadores y regiones | ✅ | Marcadores en la regla (clic para ir, clic derecho para eliminar) y dos regiones independientes: el tramo de renderizado y la región de bucle |
| Silenciar, solo y nivel por pista | ✅ | `model.test.ts` |
| Deshacer y rehacer en operaciones de edición | ✅ | `model.test.ts` + E2E |
| Separación entre datos temporales y representación en píxeles | ✅ | `zoom` es solo de presentación; el modelo usa ticks |
| **Menú contextual propio del editor en toda la línea de tiempo** | ✅ | El clic derecho abre un menú del editor, no el del navegador (`components/editor/workspace-menu.tsx`): sobre un evento ofrece Panoramización y recorte, títulos, efectos, dividir, copiar, cortar, duplicar, agrupar, seleccionar el grupo, **copiar y pegar los atributos** y eliminar; sobre la cabecera o el carril de una pista, sus propiedades, movimiento, silencio, solo, subir, bajar, eliminar, marcador y pegar; sobre la regla, tramo, bucle y marcadores; en un medio del panel, insertar, trimmer y revincular; en el monitor, reproducción y propiedades; y en cualquier otro punto, las acciones del proyecto. Se coloca en el puntero sin salirse de la pantalla, se cierra con `Escape`, la rueda, el clic fuera o al cambiar el tamaño de la ventana, y se maneja con el teclado. E2E que recorre las seis zonas, comprueba que el navegador **no** abre su menú (`defaultPrevented`) y que el menú cabe en la pantalla en la esquina inferior derecha |
| **Copiar y pegar los atributos de un evento (efectos, plantilla, encuadre…)** | ✅ | `lib/editor/attributes.ts` con nueve grupos —efectos de vídeo, panoramización y recorte (pose, claves, recorte y máscara libre), títulos y texto (la plantilla de estilo, sin el texto), generador, color y correcciones, fundidos, transición, velocidad y audio—: *Copiar los efectos y el estilo* (`Ctrl/Cmd+Mayús+C`), *Pegar los efectos y el estilo* (`Ctrl/Cmd+Mayús+V`) y *Elegir qué atributos pegar…*, que lista los grupos con su explicación, desactiva los que no encajan en el tipo del destino o que la fuente no tenía, y permite destildar. Nunca toca la identidad, el material, los tiempos ni el nombre, recorta los fundidos al destino y entra en el historial. 6 pruebas unitarias y E2E que copia un clip con efecto y encuadre, lo pega en otro y después pega solo los efectos en un tercero |
| **Redimensionar el recurso seleccionado desde la vista previa** | ✅ | Con un evento (o una pista) seleccionado, el monitor dibuja la caja del contenido con ocho asas: dentro mueve el encuadre, un asa escala dejando quieta el asa contraria y, con el botón *Recortar* de la caja (o con `Alt`), el asa recorta ese lado. La chapa informa de la escala y del tamaño en píxeles del proyecto, y con fotogramas clave el cambio se guarda en la clave del cursor. La geometría es la de la ventana de recorte (`contentBox`, `poseMatrix`, `dragScale` con el ancla despejada, `dragHandle`), así que se ve exactamente lo que compone el motor. 6 pruebas unitarias (`tests/preview-scale.test.ts`) y E2E que escala, mueve, recorta y comprueba que con una clave el cambio va a la clave y no a la pose fija |

## 5. Reproducción y composición

| Función | Estado | Evidencia |
|---|---|---|
| Composición multipista según orden de pistas | ✅ | `composition.test.ts` (orden, opacidad, silencio de pista) |
| Recortes, transformaciones, opacidad y transiciones | ✅ | `composition.test.ts` (imagen real transformada y recortada) |
| Fundido cruzado que mezcla colores al 50 % en el punto medio | ✅ | `composition.test.ts` (rojo+azul → ~127/128) |
| Mezcla de audio de pistas activas, panorama y limitador | ✅ | `model.test.ts` (muestra a muestra, silencio, solo, pan, picos) |
| Sincronía audio/video a nivel de muestra | ✅ | `model.test.ts` (inicio exacto en la muestra 24 000) |
| Reproducción, pausa, detener, avance por fotograma | ✅ | E2E; reloj de Web Audio como referencia |
| Actualización del monitor al mover el cursor | ✅ | `compose()` en cada cambio de cursor |
| Resolución de previsualización ajustable (total, 1/2, 1/4) | ✅ | Selector de calidad en el monitor |
| Gestión de carga, búfer y errores | 🟡 | Estado de ocupado, mensajes de error y liberación de recursos; sin búfer explícito ni precarga planificada |
| Motor de composición real, no un solo `<video>` | ✅ | `compositor.ts` dibuja cada pista y evento en Canvas |

## 6. Herramientas de edición

| Función | Estado | Evidencia |
|---|---|---|
| Pan/Crop: ventana con monitor, asas y claves | ✅ | `components/editor/pan-crop.tsx`; E2E `parity.spec.ts` arrastra el centro, recorta por los cuatro lados y fija una clave, y lo comprueba en el proyecto autoguardado |
| Pan/Crop: botón propio en la barra de cada evento | ✅ | Como en VEGAS 15, la barra del evento lleva el **icono de recorte** (marcas de esquina) a la izquierda de `ƒx`: un clic selecciona ese evento y abre su Panoramización y recorte. Los eventos de audio no lo muestran, porque el recorte es de imagen. E2E propio (aparece en los eventos de vídeo, abre la ventana, y no existe en los de audio) |
| Pan/Crop: ventana flotante, movible y redimensionable | ✅ | La ventana se abre ancha (hasta 1180×660) sobre un lienzo transparente a pantalla completa. Se mueve arrastrándola por la barra de título, por sus bordes o por cualquier hueco libre, y se cambia de tamaño desde **ocho tiradores** (cuatro lados y cuatro esquinas) con mínimo 460×320; nunca se pierde (si cabe se mantiene entera dentro de la pantalla y, si no, se ancla) y doble clic en la barra o *Centrar* la devuelven a su sitio. Sirve igual para la ventana de Movimiento de pista. E2E propio que mide tamaños y posiciones reales |
| Pan/Crop: disposición como la de VEGAS | ✅ | Barra de título con la chapa `ƒx`, el nombre del complemento y el `×` rojo; fila *Parámetro preestablecido* (seis preestablecidos, con los de recorte 4:3 y 1:1 calculados por `cropToAspect`); **parámetros a la izquierda** (Posición, Rotación, Recorte, Origen, Interpolación de fotogramas clave y Máscara libre) con la posición en **píxeles del proyecto** (1920/1080/960/540 en un proyecto 1920×1080); **monitor a la derecha** sobre un tablero de cuadros; **tira de fotogramas clave** con una marca por clave, la aguja y la escala de segundos, que mueve el cursor al hacer clic; y barra inferior con las claves, la posición y *Cerrar*, pegada abajo. E2E propio que mide la disposición, los valores en píxeles, el centro que mueve el encuadre, la anchura que cambia la escala, el preestablecido 1:1 y la tira de claves |
| **Pan/Crop: barra de herramientas, grupos plegables, candado y centro de giro** | ✅ | La ventana se completa como la de VEGAS 15: **seis herramientas** en una barra lateral (mover, acercar y alejar, girar, recortar, dibujar la máscara y girar en 3D) que deciden qué hace el arrastre dentro de la caja mientras las ocho asas siguen recortando; **grupos plegables** con los nombres de VEGAS (Posición, Rotación, Recorte, Interpolación de fotogramas clave, Origen, Área de trabajo y Máscara libre); barra de pestañas con el **candado** que bloquea los campos; menú `≡` de la ventana; **centro de giro** en píxeles del proyecto con su círculo y su cruz en el monitor (es el «Centro X/Y» de Rotación de VEGAS, se guarda en la pose y viaja con las claves, `poseMatrix` y `applyPose` giran alrededor de él); **área de trabajo** con el tramo y su relación, y el botón que recorta el evento a esa relación; y tira de claves con **selector de parámetro** (solo se ven las claves que cambian ese parámetro, `keysChanging`) y navegación por claves. E2E propio (herramientas, siete grupos, candado, centro de giro en el modelo, giro y zoom por arrastre y filtro de claves). Pruebas unitarias del centro de giro como punto fijo, de su interpolación con las claves y de píxeles en el compositor |
| **Pan/Crop: números, migas, estarcido, vista y preestablecidos propios (ronda 17)** | ✅ | Lo que faltaba para que la ventana sea la de VEGAS 15, con los rótulos sacados de su propio satélite de idioma (`es\ScriptPortal.MediaSoftware.VideoEffectsUI.resources.dll`): los **números del árbol de parámetros** se escriben con separador de millares y un decimal (`1,920.0`, `1,080.0`, `960.0`, `540.0`; ver `CropField`), se acepta lo tecleado con o sin separadores y al salir del campo vuelve el formato; la barra de pestañas lleva las **migas** de la ventana (complemento anterior · `Panoramización/Recorte` · siguiente, con el siguiente apagado porque la cadena tiene uno solo y el anterior volviendo a las propiedades); el monitor **estarcia** el recuadro del contenido con una trama de puntos y raya en diagonal lo que el recorte descarta; **Interpolación de fotogramas clave** gana **Suavidad (%)** (real: `keySmoothness` y `easeValue` mezclan la curva en S con la recta), **Origen** gana **Mantener rel. de aspecto** (real desde la ronda 20: es la misma casilla que la de las propiedades del evento, viene puesta y quitada estira el material hasta llenar el fotograma) y **Extender para rellenar f.** (real: `stretchFill`, el compositor cubre el fotograma), y **Área de trabajo** gana **Vista de zoom (%)** y **Densidad de cuadrícula (px)**, que son de la vista del monitor y no tocan el encuadre; y la fila del preestablecido gana los botones **Guardar** y **Eliminar parámetro preestablecido**, que guardan el encuadre en el proyecto (`panCropPresets`, validado y dentro del `.corte15`) y lo borran pidiendo la confirmación con el texto exacto de VEGAS. E2E propio (migas, formato, estarcido por píxeles, vista sin tocar la escala, suavidad en el modelo, guardar/aplicar/borrar el preestablecido y volver con las migas) y 3 pruebas unitarias más |
| **Pan/Crop: selección de recorte con puntos de esquina y zoom de la vista con la rueda (ronda 21)** | ✅ | El botón **Agregar recorte** del grupo *Recorte* (o la herramienta **Recortar** de la barra lateral) enciende la **selección de recorte** sobre el monitor: el recuadro de la región que se conserva, discontinuo en azul claro, con **un punto redondo en cada esquina y uno cuadrado en el centro de cada lado**. Las esquinas **recortan y acercan a la vez**: `dragCropSelection` + `cropZoomPose` en `lib/editor/pancrop.ts` calculan los márgenes con el arrastre y después la escala uniforme que hace que la región recortada ocupe el fotograma (`max(1/(1-izq-der), 1/(1-arr-aba))`, una sola escala: nunca deforma), con el centro de la región llevado al centro del fotograma y el giro que tuviera el encuadre; así **cuanto más pequeña la selección, más se acerca** y al agrandarla se aleja. El zoom se mide sobre los márgenes del recorte y no sobre el tamaño del fotograma: sin recorte la escala sigue en 1 (no hay salto al empezar) y el material con bandas las conserva. Los puntos de los lados recortan sin tocar el zoom. El arrastre se mide **desde el punto donde se agarró** (pose y recorte de partida), así que no se acelera a medida que la imagen se acerca. Y la **rueda del ratón acerca y aleja la vista** de la ventana (`Vista de zoom (%)`, de 25 % a 400 %), como el zoom de la vista del monitor, **sin tocar el encuadre** (antes la rueda cambiaba la escala del evento), y **solo dentro del monitor**: fuera de él la rueda no hace nada —ni desplaza la columna de parámetros ni la tira de claves, ni llega a la línea de tiempo de detrás—, que es el gesto que pidió el flujo de trabajo (el oyente va en la ventana y cancela el desplazamiento; la columna se desplaza con su barra). El painter del monitor ahora depende también del modo de selección y del modo máscara, que antes no se redibujaban al cambiarlos. 1 prueba unitaria nueva (14 en `pancrop.test.ts`) y E2E propio que busca en los píxeles del monitor la esquina dibujada, la arrastra y comprueba el recorte y la escala en el autoguardado, el alejado al agrandarla, el zoom de la vista con la rueda (campo incluido) y que la rueda no toca el encuadre |
| Recorte por los cuatro lados, independientes | ✅ | `lib/editor/pancrop.ts` (`mask`, hasta 45 % por lado, ningún par puede tapar el fotograma); 9 pruebas unitarias; el compositor recorta en el sitio y conserva la proporción del medio |
| Máscaras libres (trazados) con pluma e inversión | ✅ | Polígono de hasta 64 puntos en fracciones del fotograma (`lib/editor/mask.ts`), dibujado sobre el monitor desde la ventana de Panoramización y recorte: clic añade punto, arrastrar lo mueve y el clic derecho lo quita; el borde se suaviza con la **pluma** y se puede **invertir** (perforar lo de dentro); 6 pruebas unitarias que renderizan y comparan píxeles, y E2E |
| Transformaciones a nivel de pista | ✅ | `Track.transform` aplicada antes que la del evento; ventana de Movimiento de pista (sin recorte) verificada en E2E |
| Composición 3D: giros sobre X e Y y distancia | ✅ | `lib/editor/threed.ts`: el plano se gira en el espacio y se proyecta sobre el plano de imagen (foco 1,5 anchos de fotograma), y el resultado se escribe píxel a píxel invirtiendo el mapeo proyectivo, así que el trapecio es exacto y no hay costuras de rejilla. Se elige en la ventana de Panoramización y recorte (sección **Movimiento 3D**: rotación X, rotación Y, distancia y el gesto «Girar con el ratón») y también vale para la pista. 11 pruebas unitarias (proyección contra un modelo de cámara independiente, mapeo, píxeles, claves y validación) y E2E |
| Modos de fusión por pista (ocho) | ✅ | Normal, añadir, trama, multiplicar, superponer, oscurecer, aclarar y diferencia con las operaciones de Canvas; `composition.test.ts` comprueba añadir y multiplicar |
| Opacidad y composición básica | ✅ | `composition.test.ts` |
| Títulos y texto con los parámetros del plugin de VEGAS 15 | ✅ | Ventana `components/editor/titles.tsx`: texto multilínea, fuente, tamaño, negrita y cursiva, color, alineación, **9 puntos de anclaje**, interlineado, seguimiento, ancho máximo, contorno, sombra y fondo, con monitor de la composición real; E2E del estilo y de restablecer |
| **Posiciones del texto con nombre (ronda 22)** | ✅ | `lib/editor/text-positions.ts`: **trece posiciones** —*Texto centrado*, *Subtítulo (centro abajo)*, *Arriba (centrado)*, *Arriba a la izquierda*, *Arriba a la derecha*, *Centro a la izquierda*, *Centro a la derecha*, *Abajo (centrado)*, *Abajo a la izquierda*, *Abajo a la derecha*, *Tercio inferior (centrado)*, *Tercio inferior a la izquierda* y *Tercio inferior a la derecha*— que eligen **a la vez el punto de anclaje y el desplazamiento** del evento (`applyTextPosition`), en la sección *Posición* de la ventana de títulos: cuatro **botones de un clic** (marcados con `aria-pressed`) y la lista *Todas las posiciones*, agrupada. El anclaje de cada una se elige para que la posición aguante cuando el texto crece —arriba `top-*` (el bloque cuelga hacia abajo), abajo `bottom-*` (crece hacia arriba), en el centro `middle-*`—, los márgenes son los del pintado clásico (5 % a los lados, 8 % y 92 % de alto) y *Tercio inferior* deja el bloque terminando hacia el 64 % del alto. `detectTextPosition` reconoce la posición puesta y `describeTextPosition` la explica; cuando la colocación es propia (movida desde Panoramización y recorte) lo dice con sus números. *Subtítulo (centro abajo)* es la posición exacta del generador de subtítulos (`SUBTITLE_STYLE.offsetY`, comprobado en una prueba para que no se separen). 4 pruebas unitarias (`tests/text-positions.test.ts`: ida y vuelta por las trece, dónde cae el bloque medido con el mismo `planText` que pinta, coherencia entre nombre y anclaje, y la ayuda) y E2E que **cuenta los píxeles blancos por tercios de la vista previa** al elegir centrado, arriba, abajo, el tercio inferior y una esquina, además de leer el anclaje y el desplazamiento del autoguardado |
| **Botón del editor de texto en la barra del evento de texto y subtítulo (ronda 18)** | ✅ | Los eventos de texto —y los subtítulos, que también son texto— llevan en su barra la chapa del complemento de texto (una pantalla con la página delante, como la primera de la imagen de referencia), a la izquierda del botón de recorte. Su función es **abrir el editor de texto** de ese evento, sin pasar por las propiedades. Los eventos de vídeo y audio no la llevan. E2E propio: aparece en el título y en cada subtítulo importado, no en los de vídeo ni audio, y al pulsarla se abre la ventana de títulos |
| **El editor de texto cabe en la pantalla (ronda 18)** | ✅ | La ventana era una sola columna de **1 280 px** dentro de un diálogo de 707 px: la mitad de los ajustes quedaba por debajo del borde y había que desplazarse para llegar a ella. Ahora es una rejilla de dos columnas —vista previa a la izquierda y ajustes a la derecha— con las acciones siempre a la vista al pie, y su alto máximo está acotado (72 vh): la ventana mide 553 px en una pantalla de 768 y entra entera en el diálogo, así que **el diálogo ya no se desplaza**; solo se desplaza la columna de ajustes si la pantalla es muy baja. El selector se ancló en `.editor-dialog` porque `editor.css` fija la ventana en columna y ganaba por orden. E2E con medidas: la ventana termina dentro del diálogo, el diálogo no necesita desplazarse, la vista previa se ve entera y queda a la izquierda de los ajustes |
| Animaciones de texto: fundido, desplazamientos y máquina de escribir | ✅ | `animationState`/`revealText` en `lib/editor/titles.ts`; 6 pruebas unitarias y una de composición (al principio no pinta nada y al final sí) |
| **Animaciones de plantilla: pop, zoom, deslizamientos, rebote, sacudida y karaoke** | ✅ | Siete animaciones más, con las de VEGAS: **pop** (aparición con rebote, con paso de largo sobre el 1), **zoom de entrada**, **entrada desde abajo** y **desde arriba**, **rebote** y **sacudida** continuos, y **karaoke palabra a palabra**. La entrada dura un máximo de 0,6 s y el karaoke reparte el resaltado entre las palabras del texto. `animationState` devuelve además `scale`, `rotation` y `highlight`, y el compositor escala y gira el bloque entero y pinta palabra a palabra el color de resalte. Pruebas unitarias del progreso de cada animación, del reparto de palabras por línea (`layoutWords`) y de composición con píxeles: el karaoke va resaltando palabras y conviven relleno, contorno, sombra y caja de fondo |
| **Plantillas de texto y subtítulos estilo CapCut (16)** | ✅ | `lib/editor/text-presets.ts`: tres familias (Redes vertical, Subtítulos y Títulos) y dieciséis plantillas —TikTok clásico, Karaoke amarillo, Influencer (caja blanca), Rebote, Sacudida, Neón, Zoom de impacto, Subtítulo de cine, Subtítulo para redes, Subtítulo con caja, Máquina de escribir, Deslizar sobre azul, Título de YouTube, Noticias (barra roja), Cita (serif) y Créditos finales— que fijan contorno, sombra o resplandor, caja de fondo, color y color de resalte, anclaje, tamaño, interlineado, seguimiento, ancho y animación. Cambiar de plantilla reemplaza el estilo entero (sin restos) y cualquier retoque la deja como «Estilo propio». 4 pruebas unitarias y E2E que aplica Karaoke amarillo, comprueba el modelo y **los píxeles amarillos del monitor**, cambia a otra plantilla y verifica que no se mezclan (`evidencias/titles-plantillas.png`) |
| Generadores de medios: color sólido, degradado, tablero, patrón de pruebas y ruido | ✅ | `paintGenerator` en `compositor.ts`; el evento de color elige su generador, sus dos colores, el ángulo y el tamaño de celda; pruebas unitarias de los cuatro motivos y E2E del tipo y del ángulo |
| Transiciones de entrada (19 del catálogo de VEGAS 15) | ✅ | Fundidos lineal/lento/brusco, barridos desde los cuatro lados, barrido con degradado, persianas verticales/horizontales/venecianas, tablero, deslizar desde los cuatro lados, comprimir desde la izquierda y la derecha, y remolino; la transición es la entrada del evento y dura su fundido de entrada, con el clip de debajo opaco; `lib/editor/transitions.ts`, pestaña *Transiciones* y selector en las propiedades; 13 pruebas unitarias que comparan píxeles y E2E de aplicar, cambiar y quitar |
| **Catálogo de transiciones ampliado a 36, en ocho familias (ronda 18)** | ✅ | Diecisiete más, con los nombres del catálogo en español del propio complemento `sftrans1.dll` (leídos con el barrido de cadenas: «Fundido suave», «Fundido rápido», «Barrido de salida por la izquierda/derecha/arriba/abajo», «Círculos centrados», «Comprimir horizontal/verticalmente», «Persianas en pendiente», «Quince persianas superpuestas», «Muchas persianas torcidas», «Acercar zoom», «Alejar zoom», «Espiral exterior») y el despegado de página del complemento `VEGAS PagePeel` (`sfpagepeel.dll`). Familias nuevas en la pestaña: **Iris**, **Zoom** y **Página** (la lista de familias se calcula del catálogo, ya no está escrita a mano). Cada una es geometría real y comprobada por píxeles: el iris y el rombo se abren desde el centro con la regla par-impar, las persianas inclinadas y torcidas giran las lamas, las superpuestas cruzan dos capas de quince, el zoom escala la capa desde el centro dejando ver el clip de debajo, y el despegado recorta por la diagonal de la esquina superior derecha. 10 pruebas unitarias nuevas (una recorre **todo** el catálogo y exige que cada transición termine cubriendo el fotograma). Lo que no es idéntico al original se dice en la pista de cada botón (`TRANSITION_NOTE`): los barridos de salida equivalen a los de entrada por el lado contrario —porque aquí la transición es la entrada del evento—, el rombo es un añadido y ni el zoom ni el remolino llevan el desenfoque de movimiento del original |
| Fundido cruzado manual y automático | ✅ | Tiradores de entrada/salida y solapamiento con `autoCrossfade` |
| Brillo, contraste, saturación y tono | ✅ | Filtros de Canvas aplicados en vista previa y exportación |
| Pila de efectos de vídeo por evento (10 del catálogo de VEGAS 15) | ✅ | Desenfoque gaussiano, blanco y negro, sepia, invertir, clave cromática, pixelar, espejo, borde, viñeta y centelleo, en una pila ordenable con encendido y apagado; `lib/editor/effects.ts` y ventana `components/editor/effects.tsx`; 12 pruebas unitarias que comprueban los píxeles renderizados y E2E del catálogo, el orden y los ajustes |
| Trimmer y edición de tres puntos | ✅ | Ventana `components/editor/trimmer.tsx`: monitor del origen (o forma de onda), marcas de entrada y salida, exploración y **insertar** (lo de después se corre según el rizo) o **sobrescribir** (lo que hubiera en el tramo se recorta o se parte y queda el hueco limpio); el par de vídeo y audio entra vinculado; 8 pruebas unitarias y E2E |
| Volumen, panorámica, fundidos y medidores | ✅ | `model.test.ts` + medidor de pico |
| Mezclador: buses A–Z, maestro y enrutado de pistas | ✅ | El orden de la señal es evento → pista → bus → maestro → limitador, con la misma implementación en la vista previa y en la exportación (`lib/editor/audio.ts`); consola en `components/editor/mixer.tsx` con nivel, panorama, silencio y solo por tira, y buses que se añaden y se quitan; 9 pruebas unitarias del mezclador y E2E |
| Tomas de efectos de audio por pista y por bus | ✅ | Ocho tomas propias del catálogo de VEGAS 15 (`lib/editor/audio-effects.ts`): ecualizador de 3 bandas, compresor, limitador, puerta de ruido, distorsión, retardo, reverberación y teléfono/radio. Cada tira del mezclador tiene su rack: se añaden, se ordenan, se apagan y se quitan, y cada toma muestra solo sus parámetros. El orden de la señal es el de VEGAS (las tomas de la pista van sobre lo que suman sus eventos y antes del nivel; las del bus sobre lo que le llega antes de su nivel) y el mismo código procesa la vista previa y la exportación. El estado de los filtros, del compresor y del retardo se mantiene entre bloques, así que el sonido no depende del tamaño del bloque. 12 pruebas unitarias que **miden la señal resultante** (ganancia del ecualizador, reducción del compresor, techo del limitador, silencio de la puerta, tiempo del eco, cola de la reverberación, corte de agudos del teléfono y el orden pista→bus) y E2E del rack. **No hay tomas VST ni OFX**: son binarios de terceros y el editor lo dice en la interfaz |
| Envolventes de volumen y panorámica dibujables en la pista | ✅ | Se dibujan sobre el carril en las coordenadas de la línea de tiempo (`components/editor/envelope.tsx`): clic en la línea añade un punto, se arrastra para moverlo y el clic derecho lo quita; se suman al fader de la pista y el historial guarda un solo paso por arrastre |
| Velocidad de reproducción con audio documentado | 🟡 | 0,25×–4×; **el audio cambia de tono** (no hay time-stretch con tono preservado) |
| Efectos visibles en vista previa y exportación | ✅ | Ambos usan `compose()` y `mix()` |
| **Quitar bandas negras y encajar el contenido al fotograma** | ✅ | Lo que hace el script `Script Menu\Remove Letterboxing.cs` de VEGAS Pro 15 y lo que ese script no mira: además de encajar la caja del contenido a la relación del proyecto (`fillFrame`, cubrir sin deformar, y `fitFrame`, encajar entero), **detecta la banda negra incrustada en el propio archivo analizando los píxeles** del medio (`lib/editor/letterbox.ts`: `detectBars` con umbral, cobertura y mínimo de píxeles, recortado al tope de 45 % por lado del modelo). En *Herramientas* y en el menú del clic derecho de un evento de vídeo o imagen; sin selección se aplica a todos los eventos de vídeo, como el script. 7 pruebas unitarias con fotogramas sintéticos (bandas horizontales, laterales, las cuatro, fotograma entero oscuro, bandas diminutas, gris frente a negro, bandas no uniformes y el tope) y E2E con **imágenes reales con bandas incrustadas** (30 px de 180 → se recortan al 16,7 %; una imagen sin bandas no se toca) |
| Plugins nativos de VEGAS (OFX/VST) | ⬜ | No se cargan; el intercambio con VEGAS es por `.veg` (§7.1) o por XML/EDL |
| **Menú del clic derecho del evento: réplica del de VEGAS 15** | ✅ | `eventMenuItems` en `components/editor/editor.tsx` reproduce la lista, el orden y los separadores de los recursos `POPUP_IDX_VIDEO_SURFACE` (evento de vídeo) y `POPUP_IDX_AUDIO_EVENT` (evento de audio) del `vegas150.exe` en español: Abrir en recortadora · Seleccionar en lista de medios del proyecto · Editar medios generados... · Efectos de medios... · Panoramización/recorte de evento de vídeo... · Efectos de evento de vídeo... · Cortar · Copiar · Pegar atributos de evento · Pegado selectivo de atributos de evento · Eliminar · Recortar · Recortar principio · Recortar final · Dividir · Crear subclip · Invertir · Seleccionar eventos hasta el final · Insertar/eliminar envolvente ▸ · Congelar fotograma en el cursor · Progreso de transición ▸ · Modificadores ▸ · Toma ▸ · Grupo ▸ · Sincronizar ▸ · Enlace sinc ▸ · Propiedades... (el de audio añade editor de audio, efectos de audio, Corriente, Canales ▸ y Normalizar). Las entradas sin equivalente en este motor salen **desactivadas con su motivo** en la pista, como VEGAS apaga lo que no aplica: Crear subclip, Toma ▸, Enlace sinc ▸, tiempo no real, editor de audio externo, Sensibilidad. E2E que recorre la lista entera de rótulos |
| **Submenús «▸» en el menú del clic derecho** | ✅ | `components/editor/workspace-menu.tsx`: una entrada con `items` abre su panel a la derecha (al pasar el puntero o con la flecha derecha), lo **voltea a la izquierda** si no cabe y lo **sube** si se sale por abajo; se recorre con el teclado dentro del panel abierto. E2E que abre *Modificadores ▸*, comprueba sus ocho entradas y activa *Bloqueo* desde ahí |
| **Ventana «Propiedades» del evento (las dos pestañas de VEGAS 15)** | ✅ | `components/editor/event-properties.tsx`: pestaña **Evento de vídeo** con «Nombre de toma activa:», el grupo **Modificadores** (Silencio, Bloqueo, Bucle, Mantener relación de aspecto, Reducir parpadeo de entrelazado), los tres botones de re-muestreo («Utilice el modo Re-muestreo de proyecto», «Forzar re-muestreo», «Deshabilitar re-muestreo»), «Ajustarse a la velocidad de fotogramas del proyecto», «Velocidad de reproducción:» y «Veloc. de inframuestreo:» en fps; pestaña **Medios** con Nombre de archivo, Nombre de cinta, Código de tiempo y *Propiedades de reproducción* (Corriente, Formato, Atributos, Velocidad de fotogramas, Orden de campos, Relación de aspecto del píxel, Canal Alfa, Color de fondo, Espacio de color, Duración). Botones **Aceptar** y **Cancelar**: los cambios se aplican en vivo y *Cancelar* devuelve el evento —y sus enlazados— a como estaban al abrir la ventana. Los interruptores que el motor no aplica lo dicen en el propio diálogo. **Mantener relación de aspecto** sí lo aplica el compositor: viene **puesta** —el material conserva su proporción y deja bandas negras donde no cuadra con el fotograma— y **quitada se estira hasta llenar el fotograma**, aunque se deforme. La casilla está activa en el diálogo, marcada por defecto (en el modelo, ausente es «puesta»), la enseña marcada el submenú *Modificadores* y es la misma que la del grupo *Origen* de Panoramización/recorte: cambiar cualquiera de las dos cambia las dos. E2E que comprueba las dos pestañas, los rótulos, el bloqueo real del evento, que *Cancelar* revierte y que *Aceptar* no, y que mide los píxeles del monitor con la casilla puesta y quitada y el campo `maintainAspect` del autoguardado |
| Interruptores del evento: Silencio, Bloqueo, Bucle, Invertir, Mantener relación de aspecto | ✅ | `muted` (el mezclador salta el evento y, si el silencio está en un vídeo, también su audio enlazado), `locked` (no se arrastra, ni se recorta, ni se divide, ni se borra: el arrastre, el recorte, Supr y *Dividir* lo comprueban y lo dicen), `loop` (el material se repite cuando el evento dura más), `reversed` (material al revés, `sourceTime`) y `maintainAspect` (quitado, `drawMedia` estira el material sobre el rectángulo del recorte en vez de encajarlo; `stretchFill`, que cubre sin deformar, no se aplica entonces, porque estirar deformando y cubrir sin deformar son excluyentes). `tests/event-switches.test.ts` (15 pruebas) y la de píxeles del estirado en `tests/composition.test.ts` |
| **Reproducción fluida: el editor no se renderiza en cada fotograma (ronda 25)** | ✅ | El bucle de reproducción ya no usa `setState` por fotograma: `paintCursor` mueve la **aguja** y el **timecode grande** por referencia, `paintPreview(at)` compone el **monitor** directamente (con el descarte por versión de siempre) y los **medidores** van por su almacén (`lib/editor/meter-store.ts` + `components/editor/meters.tsx` con `useSyncExternalStore`, que solo repinta ese panel y no avisa si la lectura no cambió). El estado de React se sincroniza solo con un **diálogo abierto** (cuatro veces por segundo) y al pausar. Medido con `npm run test:perf` (sonda nueva, `playwright.perf.config.ts`, fotogramas reales con `requestAnimationFrame` y un montaje de quince eventos, tres corridas): la reproducción pasa de **p95 83,4 ms y 21 fotogramas por encima de 50 ms en 3 s** a **p95 16,8 ms y 2**, y el zoom de la línea de tiempo deja el p95 igual (50 ms, el coste del reflow al cambiar el ancho) pero **baja de 10 a 6 los fotogramas largos** del gesto. Para el zoom, el trazado de las ondas (`columnsFor`) baja por una **escalera de resoluciones** (se rehace 3 o 4 veces por gesto en vez de una por paso), las coordenadas van en enteros, la silueta se repasa con su propio trazado en vez de con un segundo camino, y la onda se dibuja con **el más fino de los dos**: los picos guardados si llegan a una columna por pico y, si no, las muestras decodificadas (tope de 20 s de tramo). `components/editor/audio-waveform.tsx` va con `memo`. Las funciones no cambian: los mismos fotogramas, los mismos avisos y los mismos datos en el proyecto |
| Interruptores anotados o aproximados | 🟡 | **Reducir parpadeo de entrelazado** se aplica como mezcla vertical de tres tomas (`reduceFlickerBlend`), que es una aproximación y así se documenta |
| Re-muestreo, inframuestreo y ajuste al fotograma del proyecto | ✅ | `sourceTime` en `lib/editor/project.ts` decide el instante del material que se pide: «Deshabilitar re-muestreo» y «Ajustarse a la velocidad de fotogramas del proyecto» piden el **fotograma exacto** del proyecto, y la **velocidad de inframuestreo** cuadricula el instante a esa frecuencia en fps. Lo usan el compositor y el mezclador, así que vale igual para la vista previa y para la exportación. 5 pruebas unitarias |
| Sincronizar por desplazamiento y por deslizamiento | ✅ | `syncEvents` en `lib/editor/project.ts`, sobre los eventos seleccionados que comparten el material del ancla: *por desplazamiento* los mueve en el tiempo sin tocar el material, *por deslizamiento* les desliza el material dejándolos donde están. El algoritmo es propio (la evidencia de VEGAS es el rótulo del menú) y se documenta como tal. 1 prueba unitaria con los dos modos |
| Canales del evento: Ambos, Sólo izquierdo, Sólo derecho, Combinar, Intercambiar | ✅ | `lib/editor/audio.ts`: cada canal del material se lee por separado y se reparte según el modo, así «Sólo izquierdo» suena por los dos altavoces. 1 prueba unitaria que mide las cuatro mezclas |
| Invertir fase y Normalizar de un evento de audio | ✅ | `invertPhase` cambia el signo de las muestras (prueba unitaria); *Normalizar* sube la ganancia del evento hasta que el pico del material llega a 0 dBFS, calculado con los picos ya medidos al importar |
| **Forma de onda legible en los eventos de audio (ronda 23)** | ✅ | `lib/editor/waveform.ts` (aritmética) y `components/editor/audio-waveform.tsx` (dibujo): silueta **rellena y simétrica** alrededor de la **línea del cero**, con el contorno repasado y el trazo en 1 px real (`vector-effect: non-scaling-stroke`) en el color claro del evento. El número de columnas sale del **ancho del evento en pantalla** (una por píxel, 24 a 4 000, `columnsFor`), y cada columna se queda con el **mayor valor absoluto** de su tramo (`peakColumns`), no con la muestra más cercana: al alejar no se pierden picos y al acercar no salen escalones. Los picos se leen de las **muestras decodificadas** (`data-waveform-source="pcm"`) o, si el proyecto se abre sin el archivo, de la copia guardada en el medio (`bucketColumns`, `"guardado"`), que ahora tiene **1 024 picos** redondeados a tres decimales en vez de 240 (`peakBuckets`, `STORED_PEAKS`). El tramo respeta `offset`, `speed` y `reversed` (`sourceRange`), y lo que se sale del material se dibuja en silencio. El cálculo va memoizado por tramo y ancho, que es lo que evita repetir el barrido en cada repintado al arrastrar. **La misma onda la usa el trimmer** (`components/editor/trimmer.tsx`), con su color azul y 640 columnas (su panel es de ancho fijo), donde antes también había 240 columnas. 5 pruebas unitarias (pico mayor por columna con un pulso aislado, recorte y orden del tramo, preferencia por las muestras, simetría del trazado y la copia de 1 024 picos) y E2E que mide las columnas contra el ancho del evento, la procedencia, la línea del cero, la simetría, el detalle al acercar y la onda del trimmer (`evidencias/onda-audio.png`, `evidencias/onda-trimmer.png`) |
| Congelar fotograma en el cursor (*Freeze Frame at Cursor*) | ✅ | Copia el fotograma del monitor compuesto a un PNG, lo añade a los medios del proyecto como imagen fija de 10 s (la duración predeterminada de VEGAS) y lo coloca en la línea de tiempo en el cursor, en la pista del evento. E2E: el menú lo ejecuta sobre un vídeo real |
| Crear subclip, Toma ▸, Enlace sinc ▸ | ⬜ | El modelo no tiene subclips ni varias tomas por evento ni enlaces sinc; el menú los muestra desactivados con el motivo en la pista, en vez de fingir que existen |
| Composición 3D, máscaras libres, curvas Bézier | 🟡 | Las máscaras libres y la **composición 3D** (giros X e Y y distancia, con su interfaz) ya están (§6); lo que falta son los manejadores Bézier que se arrastran |

## 7. Proyectos y almacenamiento

| Función | Estado | Evidencia |
|---|---|---|
| Proyecto nuevo y propiedades (tamaño, FPS, audio) | ✅ | Diálogo de propiedades del proyecto |
| **Plantillas de proyecto: TikTok, Reels, Shorts y diez formatos más** | ✅ | `lib/editor/templates.ts`: trece plantillas agrupadas en Vertical (9:16), Cuadrado (1:1), Horizontal (16:9), Cine y Solo audio, con las medidas publicadas por cada plataforma (TikTok y Reels 1080×1920 a 30 fps, Shorts 1080×1920 a 60, cuadrado 1080×1080, YouTube 1080p y 4K, cine 24p, NTSC 29,97, PAL 25p, audio 44,1 kHz). La lista de propiedades del proyecto reconoce sola el formato actual («Personalizada» si no coincide) y cada plantilla explica para qué sirve su medida. No mueve el montaje: eso se dice en la ventana y se reencuadra con Panoramización y recorte. 6 pruebas unitarias (`tests/templates.test.ts`) y E2E que cambia a TikTok, Reels, Shorts y Cuadrado, comprueba el monitor vertical y recarga para ver que el formato se conserva (`evidencias/plantilla-tiktok.png`) |
| Formato propio versionado (`.corte15`, `version: 1`) | ✅ | `validation.ts` (Zod) rechaza versiones y campos inválidos |
| Guardar, abrir y descargar | ✅ | E2E: descarga, reapertura y recuento de eventos idéntico |
| Persistencia de pistas, eventos, efectos, claves, marcadores, región y referencias | ✅ | `model.test.ts` (ida y vuelta idéntica) |
| Autoguardado local y recuperación | ✅ | Autoguardado en `localStorage` a los 450 ms; E2E: se crea un evento, se recarga la página y el proyecto vuelve con su evento |
| Gestión de medios faltantes y revinculación | ✅ | Filtro *Medios faltantes*, aviso al abrir y diálogo de revinculación; E2E: un proyecto XML sin archivos pasa de 3 a 2 medios faltantes al revincular `Audio.wav` |
| Aviso ante almacenamiento insuficiente | ✅ | Espacio libre/cuota visibles y comprobación antes de cachear cada archivo; E2E con una cuota simulada casi llena: avisa y el medio se importa igual |
| Distinción explícita entre guardar el proyecto y guardar los medios | ✅ | Texto en el diálogo de proyecto y en el estado al guardar |
| Procesamiento local, sin subida de medios | ✅ | No existe ninguna llamada de red en el editor |

## 7.1 Intercambio con VEGAS Pro

| Función | Estado | Evidencia |
|---|---|---|
| Leer proyectos `.veg` | ✅ **Con VEGAS (puente) o análisis sin VEGAS** | Con el puente en marcha se importa el montaje completo (pistas, eventos, recortes, fundidos, velocidad, movimiento con claves, opacidad, marcadores y tramo) porque lo entrega el propio VEGAS por su API de scripting; sin VEGAS, el editor analiza cabecera, bloques, propiedades, medios y títulos. Ver `README.md` §5.2 y `ANALISIS-VEG.md` |
| Puente con VEGAS Pro 15 (leer y escribir `.veg`) | ✅ Contrato verificado; lado VEGAS no ejecutado aquí | `scripts/veg-bridge-server.mjs` (solo `127.0.0.1:5174`, exige la cabecera `x-corte15-bridge`) y `bridge/VegBridge.cs`; 9 pruebas unitarias cubren unidades (ns↔ticks), velocidades, encuadre, referencias de medios y el TSV que VEGAS vuelve a leer. **No se pudo ejecutar VEGAS en este entorno**, así que el recorrido real dentro de VEGAS queda por probar en tu máquina |
| Lo que el puente no trae y dice en vez de inventar | ✅ | Efectos y transiciones, eventos sin archivo (títulos y generadores) y subtítulos se informan como omitidos, tanto al leer como al escribir (`skipped` en el informe) |
| Detección del formato al abrir | ✅ | Por contenido (firma `riff.`, `<xmeml`, cabecera EDL) y por extensión; E2E con `.veg`, `.xml`, `.edl` |
| Importar Final Cut Pro 7 / DaVinci Resolve (`.xml`, xmeml v5) | ✅ | Analizador propio + 8 pruebas unitarias con un fixture de la estructura documentada; E2E comprueba 2 pistas, 5 eventos, 3 medios y el informe |
| Importar los medios referenciados de un `.veg` | ✅ | El análisis lista las rutas y un botón las añade a Medios de proyecto como referencias revinculables; E2E con el archivo real |
| Importar EDL (CMX 3600) | ✅ | Analizador propio + pruebas unitarias y E2E; deduce la velocidad de `FCM` o asume 30 fps y lo avisa |
| Propiedades, pistas, eventos, punto de entrada y duración | ✅ | Verificado con valores exactos en ticks en `interchange.test.ts` |
| Vínculo de audio y video al importar | ✅ | El audio y el video del mismo medio y el mismo tramo quedan agrupados; comprobado con `linkedIds` y en E2E |
| Medios referenciados y revinculación posterior | ✅ | Los medios se crean como referencias con su ruta de origen y aparecen como faltantes hasta revincularlos |
| Informe de importación (leído, aproximado, descartado) | ✅ | Diálogo con formato, fps, pistas, eventos, medios, avisos y elementos no importados; dos pruebas E2E |
| Efectos, transiciones, claves, envolventes, niveles y marcadores | ⬜ | No viajan en XML ni EDL: no se pueden recuperar |
| `Premiere/After Effects (.pproj)` | ⬜ | Formato binario de Adobe; fuera de alcance |
| XML de Final Cut Pro X (`.fcpxml`) | ⬜ | Estructura distinta a xmeml v5; no implementado |
| Contraste con archivos reales exportados por VEGAS Pro 15 | ⬜ | No había ninguna instalación con VEGAS ni archivos exportados por él en esta sesión |

## 7.2 Subtítulos y recursos automáticos (servicios externos opcionales)

| Función | Estado | Evidencia |
|---|---|---|
| Botón «Generar subtítulos» en la barra de Medios de proyecto, junto al buscador | ✅ | E2E que comprueba su posición geométrica respecto al campo de búsqueda y captura en `evidencias/subtitulos.png` |
| Transcripción del audio del proyecto con Groq (`whisper-large-v3`) | ✅ | **Verificada en vivo**: la clave responde 200, un WAV de voz en español se transcribe con sus dos frases y sus tiempos, y los eventos aparecen en la línea de tiempo (`npm run test:live`). Además, la suite normal la prueba con la API simulada |
| Remuestreo del audio a 16 kHz mono | ✅ | Decimación con filtro de media; probado con una rampa y con un tono de 440 Hz (el tono no cambia) tras detectar y corregir un error de proporción que destrozaba el audio |
| Audio preparado en local: mezcla del proyecto a WAV PCM 16 kHz mono | ✅ | 3 pruebas unitarias (remuestreo, cabecera WAV y conversión de muestras) |
| El audio solo se envía al pulsar el botón | ✅ | No hay ninguna otra llamada saliente; el resto del editor sigue siendo local |
| Archivo `subtitulos.srt` en Medios de proyecto | ✅ | E2E: aparece en la carpeta **Subtítulos**, y también en **Videos** y **Todos los medios** |
| Descarga del `.srt` | ✅ | El botón *Descargar .srt* del panel de medios lo baja; el doble clic ahora **inserta los subtítulos en la línea de tiempo** |
| Subtítulos visibles en el monitor y editables | ✅ | Se crean como eventos de texto en la pista «Subtítulos» (la primera de vídeo, así que se dibujan encima) con **contorno negro** para que se lean sobre cualquier imagen; un `.srt` se puede importar desde el panel de medios y colocarlo con doble clic; `lib/editor/subtitles.ts`, 3 pruebas unitarias (una de ellas renderiza y comprueba los píxeles) y E2E |
| Fallo corregido: el desplazamiento del texto se aplicaba dos veces | ✅ | El `x`/`y` del evento entraba en la matriz del contexto **y** en el plan tipográfico, así que un subtítulo con `y = 0,34` —lo que usa la transcripción— se pintaba fuera del fotograma y no se veía; hay una prueba de composición que lo impide || Subtítulos añadidos a la línea de tiempo | ✅ | E2E: se crea la pista «Subtítulos» con un evento de texto por intervención, en su instante |
| Persistencia del `.srt` dentro del proyecto | ✅ | El texto se guarda en el propio `.corte15` (campo validado en el esquema) |
| Búsqueda de recursos en Pexels | ✅ | Clave verificada en vivo (HTTP 200) y contrato de vídeos contrastado con la API real |
| Recursos colocados **según la transcripción**, en el momento en que se dicen | ✅ | Cada frase busca su palabra significativa y el clip se coloca en su instante, recortado a la duración de la frase; las palabras repetidas reutilizan el clip. Prueba unitaria del plan de colocación y E2E que comprueba que «dinero» cae en 5,3 s y «hola» en 0,2 s |
| Reutilizar los recursos de un `.srt` ya guardado en el proyecto | ✅ | Si no hay transcripción en la sesión, se leen las frases del archivo de subtítulos del propio proyecto |
| Descarga e importación de los clips | ✅ | E2E con la API simulada: descarga, importa con miniatura y añade a Medios de proyecto |
| Colocación automática por texto desde el cursor | ✅ | E2E: pista «Pexels» con los clips uno tras otro desde el cursor |
| Claves fuera del proyecto y del código | ✅ | Se guardan en el navegador o en `.env.local` (ignorado por git); nunca se escriben en el `.corte15` |
| Subtítulos incrustados («quemados») en la exportación | ⬜ | Los subtítulos se añaden como eventos de texto, así que **sí** salen renderizados; no hay un modo «solo .srt» como pista de subtítulos del contenedor |
| Traducción de subtítulos a otro idioma | ⬜ | No implementada |

## 8. Exportación
| Función | Estado | Evidencia |
|---|---|---|
| Selección de resolución, FPS, calidad y formato | ✅ | Diálogo *Renderizar como…* con plantillas, cuatro niveles de calidad y bitrate explícito en Mbps |
| Plantillas de render | ✅ | Igual que el proyecto, MP4 1080p/720p/480p, WebM 720p y WAV; cualquier campo se puede ajustar a mano |
| Ámbito: proyecto completo o tramo | ✅ | Selector de ámbito con inicio y fin editables; E2E marca un tramo de 2 s, renderiza y comprueba que el archivo dura 2 s |
| Video compuesto y audio mezclado en el archivo | ✅ | ffprobe del archivo exportado: una pista de video y una de audio, duración > 4,9 s |
| Resolución de salida real (1280×720) | ✅ | ffprobe confirma 1280×720 exactos en Chrome, Edge y Firefox |
| Texto realmente dibujado en los píxeles exportados | ✅ | ffmpeg extrae el fotograma de 1,5 s y la prueba cuenta píxeles casi blancos del título |
| Salidas parciales: solo video o solo audio | ✅ | Casillas *Incluir video* / *Incluir audio* y formato WAV; E2E: el WAV exportado tiene una única pista de audio y el vídeo sin audio una única pista de vídeo, comprobado con ffprobe en cada motor con el formato que puede codificar |
| Progreso basado en trabajo real (fotogramas) | ✅ | `report(done,stage)` con fotogramas, fps de render, transcurrido, restante estimado y tamaño en curso |
| **Lote de renderizado (cola de trabajos)** | ✅ | `lib/editor/batch.ts` + sección *Lote de renderizado* del diálogo: varios trabajos preparados con los ajustes del diálogo (o las plantillas que el motor admita de una vez), renderizados **en serie** sobre una copia del proyecto, con estado por trabajo, nombres únicos (`proyecto--MP4 1280x720 30 fps[2].mp4`), reintento de lo fallido y cancelación que marca lo pendiente. Equivale al script *Batch Render* de VEGAS 15 (`Script Menu/Batch Render.cs`), con dos diferencias declaradas: el modo *Regiones* del script no se reproduce (Corte 15 guarda un tramo y los marcadores no tienen duración) y la cola no se guarda entre sesiones. 10 pruebas unitarias y E2E que renderiza dos trabajos y verifica los dos archivos con ffprobe |
| Cancelación y liberación de recursos | ✅ | E2E: cancelar muestra «cancelada» y permite volver a renderizar |
| **Una salida de audio por pista** | ✅ | `audioTrackJobs` + `jobProject` en `lib/editor/batch.ts` y el botón *Añadir una salida por pista de audio* del lote: un trabajo WAV por cada pista de audio, con el nombre de la pista en el archivo (`proyecto--Audio Voz.wav`, numerado si se repite) y, al renderizar, las demás pistas de audio en silencio. Es el script *Render Audio Tracks* de VEGAS 15 (`Script Menu/Render Audio Tracks.cs`). 2 pruebas unitarias (creación, nombres y aislamiento del proyecto) y E2E que comprueba que la cola recibe exactamente un trabajo por pista con su nombre |
| **Exportar los marcadores: capítulos y subtítulos** | ✅ | `lib/editor/chapters.ts` y *Archivo → Exportar los marcadores…* (también en el clic derecho de la regla): cinco formatos con vista previa —lista de capítulos TXT, **capítulos para YouTube** (`0:00 Nombre`, con la marca inicial añadida si hace falta), CSV con cabecera, XML como el del script con etiqueta, y **subtítulos `.srt`** desde los marcadores hasta el siguiente—. Equivale a `Script Menu/Export Chapters.cs` y `Export Regions as Subtitles.cs`, mejorados: el TXT y el CSV de VEGAS pierden el nombre del marcador y su XML no lleva etiqueta. 6 pruebas unitarias y E2E que **descarga los cinco formatos y lee su contenido** |
| Descarga del archivo resultante | ✅ | E2E guarda el archivo descargado |
| MP4 con H.264/AAC | 🌐 | Detectado y verificado en Chrome y Edge (ffprobe: `avc` + audio); no disponible en el Firefox probado |
| Alternativa real cuando no hay MP4 | ✅ | WebM VP9/Opus detectado y verificado en Firefox; WAV PCM como tercera opción |
| Codificación y multiplexado reales (no renombrar la extensión) | ✅ | La salida se demultiplexa y decodifica con ffmpeg/ffprobe en la prueba |
| Misma lógica en vista previa y renderizado | ✅ | `compose()` y `mix()` compartidos |
| Renderizado sin grabar la pantalla ni reproducir en tiempo real | ✅ | Bucle por fotogramas; 300 fotogramas a 1280×720 en 5,1 s (≈59 fps de render, el doble de tiempo real) |
| Rendimiento del bucle de renderizado | ✅ | Cesión al hilo de la interfaz cada 1/8 s de salida mediante `MessageChannel`, eventos agrupados por pista y omisión de filtros de color neutros; medido con `npm run test:capabilities` |
| Límite de memoria de salida (256 MB) | 🟡 | Aviso explícito; no hay escritura a disco por streaming |
| Exportación en segundo plano / trabajadores | ⬜ | El renderizado ocurre en el hilo principal cediendo el paso periódicamente |

## 9. Arquitectura y compatibilidad

| Función | Estado | Evidencia |
|---|---|---|
| TypeScript y arquitectura modular por capas | ✅ | `lib/editor/*` separado de la interfaz |
| Detección de capacidades en tiempo de ejecución | ✅ | `canEncodeVideo`/`canEncodeAudio` + sonda de APIs; aviso visible si faltan |
| Sin dependencia de `SharedArrayBuffer` ni de COOP/COEP | ✅ | El editor no usa aislamiento entre orígenes |
| Evaluación de WebCodecs / Web Audio / Canvas / Web Workers / almacenamiento | ✅ | WebCodecs y Web Audio usados; Canvas 2D en lugar de WebGL; IndexedDB para la caché; **Web Workers no se usan** (compromiso documentado) |
| FFmpeg/WASM como alternativa | ⬜ | No incluido; se prefirió WebCodecs por memoria y rendimiento. ffmpeg solo se usa en las pruebas |
| Chrome, Edge, Firefox de escritorio | ✅ | Suite E2E ejecutada en los cuatro proyectos (ver [VERIFICACION.md](VERIFICACION.md)) |
| Safari / WebKit | 🌐 | El binario de WebKit probado no expone WebCodecs ni Web Audio: allí solo se consulta la interfaz. **Safari en macOS no se ha probado** |
| macOS y Linux | ⬜ | Sin probar: no había equipos con esos sistemas en esta sesión |

## 10. Atajos de teclado

| Atajo | Acción | Estado |
|---|---|---|
| `S` | Dividir en el cursor | ✅ Verificado en E2E || `Espacio` | Reproducir / detener y volver al inicio de reproducción | ✅ |
| `Enter` / `Alt+Enter` | Reproducir-pausa / propiedades del proyecto | ✅ (Alt+Enter documentado en la ayuda oficial de VEGAS) |
| `←` / `→` | Un fotograma (cuantizado a fotogramas) | ✅ |
| `Alt` + `←`/`→` | Deslizar el contenido del evento (*slip*) | ✅ Verificado en E2E |
| `Ctrl/Cmd` + `Alt` + `←`/`→` | Desplazar el evento (*slide*) con los vecinos ajustando su borde | ✅ Verificado en E2E |
| `Alt` + `Mayús` + `←`/`→` | Recortar hasta el cursor con rizo (adelanta lo que venía después) | ✅ Verificado en E2E |
| Rueda del ratón | Zoom horizontal anclado en la aguja (el cursor no se mueve de su sitio) | ✅ Verificado en E2E (Chrome) |
| `Mayús` + rueda / `Alt` + rueda | Desplazamiento horizontal / vertical | ✅ |
| Clic en un evento | Selecciona el evento y mueve la aguja a ese punto | ✅ Verificado en E2E |
| Arrastrar en la regla | Por la franja de arriba define el tramo de renderizado; por la franja de abajo (donde se dibuja la cabeza de la aguja) y justo sobre la aguja, mueve el cursor. Desde la ronda 24, arrastrar la **línea de la aguja sobre cualquier carril** también la mueve, sin tocar el evento de debajo | ✅ Verificado en E2E (las dos zonas de la regla y los carriles) |
| `Inicio` / `W` / `Fin` / `Ctrl+Fin` | Principio / final de región / final de proyecto | ✅ |
| `M` | Marcador (clic derecho lo elimina) | ✅ |
| `G` / `U` | Agrupar / desagrupar | ✅ |
| `Supr` / `Retroceso` | Elimina los eventos seleccionados o, si no hay ninguno, la pista seleccionada | ✅ Verificado en E2E |
| `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y` | Deshacer / rehacer | ✅ Verificado en E2E |
| `Ctrl/Cmd+C`, `X`, `V`, `A` | Copiar, cortar, pegar, seleccionar todo | ✅ |
| `Ctrl/Cmd+S`, `O` | Guardar / abrir proyecto | ✅ |
| Atajos desactivados al escribir en campos de texto | ✅ | El manejador ignora eventos dentro de `input`, `textarea`, `[contenteditable]` y diálogos |
| `Ctrl/Cmd` según sistema | ✅ | Se aceptan ambos modificadores |
| Conflictos inevitables con el navegador | ✅ | `Ctrl+L`, `F12`, `Ctrl+T`, `Ctrl+W` están reservados: no se capturan y se documenta en la ayuda del editor |

## 11. Verificación y entrega

| Elemento | Estado | Evidencia |
|---|---|---|
| Pruebas unitarias y de integración del motor | ✅ | 281/281 en `npm test` (incluye las 9 del puente `.veg`, las 14 de panoramización con el centro de giro y la selección de recorte, las 5 de la forma de onda, las 8 de tipografía y animaciones de texto, las 4 de posiciones del texto, las 4 de plantillas de texto, las 6 de plantillas de proyecto, las 13 de composición —con la del estirado de *Mantener relación de aspecto*—, las 12 de efectos y generadores, las 23 de transiciones, las 5 de curvas de clave, las 7 de timecode SMPTE, las 11 de edición de precisión, las 9 del mezclador, las 12 de tomas de audio, las 6 de medidores, las 8 del trimmer, las 3 de subtítulos, las 6 de máscaras, las 11 de composición 3D, las 11 de la región de bucle, las 15 de interruptores del evento y las 10 del lote de renderizado) |
| Pruebas en navegador real con archivos reales | ✅ | 73 flujos por motor (48 de `browser.spec.ts` + 25 de `parity.spec.ts`) en Chrome, Edge, Firefox y WebKit: **268 superadas, 24 omitidas por capacidad, 0 fallos** (una corrida de los cuatro proyectos con `--trace=off`). Además del flujo completo, cubren Pan/Crop (organización como la de VEGAS, barra de herramientas, grupos plegables, candado y centro de giro, la selección de recorte y el zoom de la vista con la rueda, ventana flotante y botón en la barra del evento), movimiento de pista, títulos y su galería de plantillas, las posiciones del texto con nombre, la forma de onda del audio, la aguja agarrada desde los carriles, el menú del clic derecho, las plantillas de proyecto, efectos, generadores, transiciones, curvas de clave, edición de precisión, mezclador, tomas de audio, medidores, trimmer, zoom anclado, subtítulos, máscaras libres, 3D, la región de bucle, el lote de renderizado y el interruptor *Mantener relación de aspecto* medido en los píxeles del monitor |
| Comportamiento degradado en un motor sin códecs | ✅ | WebKit: 38 pruebas aplicables superadas (interfaz, `.veg`, pistas, aguja, tramo, región de bucle, rueda, hueco, Pan/Crop, su ventana flotante, su botón de recorte y su nueva barra de herramientas, títulos con la galería de plantillas, plantillas de proyecto, el menú del clic derecho, efectos, generadores, transiciones, claves, zoom anclado, subtítulos desde `.srt` y máscaras), 19 omitidas con el motivo explícito: los flujos que importan MP4 o WAV comprueban antes las APIs y dicen cuál falta, en vez de fallar |
| Exportación verificada demultiplexando el archivo | ✅ | ffprobe + ffmpeg en `browser.spec.ts` |
| Cancelación sin recursos activos | ✅ | E2E de cancelación |
| Formatos incompatibles con error comprensible | ✅ | E2E con `corrupto.mp4` |
| Comparación visual con la captura de referencia | ⬜ | **No realizada: la captura no estaba disponible** |
| Pruebas en navegadores y sistemas reales (manuales) | ⬜ | Solo pruebas automatizadas; ningún equipo macOS/Linux |
| Documentación de ejecución, dependencias y limitaciones | ✅ | `README.md`, este archivo y `VERIFICACION.md` |

## 12. Atajos de calidad del propio editor

| Elemento | Estado |
|---|---|
| Comprobación de tipos (`tsc --noEmit`) sin errores | ✅ |
| Build de producción de Vite | ✅ |
| Análisis estático (`npm run lint`) sin errores | ✅ 0 errores, 7 avisos |
| Servidor estático de producción (`npm run build && npm run serve`) | ✅ Respuestas 200 para la página y el paquete; 404 fuera de `dist/` |
| Botones que aparentan funcionar sin función detrás | ✅ Todos los controles visibles están conectados; los no disponibles se deshabilitan o explican |

## 13. Diferencias conocidas frente a VEGAS Pro 15

Lista de trabajo hacia la paridad, ordenada por impacto visual o funcional:

1. **Comparación con la captura**: pendiente por ausencia de la imagen de referencia.2. **Lectura de `.veg`**: se analiza de verdad (estructura, propiedades, medios y títulos) pero **no se
   reconstruye la línea de tiempo**, porque los registros internos de eventos no están documentados y no había
   forma de verificar una interpretación. Ver §7.1 y `ANALISIS-VEG.md`.
3. **Acoplamiento de ventanas**: VEGAS permite acoplar, desacoplar, apilar pestañas y guardar diseños
   (`Alt+D`, `0-9`). Aquí la distribución es fija con tres divisores persistentes.
4. **Formato de timecode**: resuelto. Se muestran los tres formatos de VEGAS 15 —SMPTE sin descarte
   (`HH:MM:SS:FF`), SMPTE con descarte (`HH:MM:SS;FF`, solo a 29,97 y 59,94 fps) y segundos con milisegundos—
   y se eligen en las propiedades del proyecto. El descarte sigue la regla de la norma (se saltan los números
   00 y 01 al empezar cada minuto, menos cada 10 minutos) y está comprobado con el cero exacto a la hora
   (`01:00:00;00`). Queda por confirmar contra el manual si VEGAS 15 llama igual a los tres formatos en su
   menú; la aritmética es la de SMPTE 12M y está probada. También hay un campo **Ir a timecode** que acepta
   `HH:MM:SS:FF`, `HH:MM:SS;FF`, `MM:SS:FF` o segundos sueltos.
5. **Pila de efectos**: ya hay diez efectos del catálogo de VEGAS 15, con su ventana y su orden (§6). Faltan
   los demás (curvas de color, corrección de color primaria y secundaria, coincidencia de color, kernel de
   circunvolución, luz de relleno, grano de película…), que piden algoritmos por canal y máscaras de
   selección.
6. **Medición de audio**: VEGAS incluye medidores calibrados y (en versiones posteriores) sonoridad EBU. Aquí
   el medidor es de pico.
7. **Edición de precisión**: *slip* (Alt + ←/→), *slide* (Ctrl/Cmd + Alt + ←/→), recorte por rizo hasta el
   cursor (Alt + Mayús + ←/→) y **trimmer con edición de tres puntos** (insertar y sobrescribir) ya están, con
   menú propio y 19 pruebas unitarias entre las dos tandas.
8. **Ripple**: ya se aplica también al mover y al pegar (§1).
9. **Composición**: los ocho modos de fusión por pista, el recorte de cuatro lados, las diecinueve
   transiciones de entrada, las **máscaras libres con pluma e inversión** y la **composición 3D**
   (giros sobre los ejes X e Y y distancia al plano, en el evento y en la pista) ya están (§6); las
   persianas y el remolino son aproximaciones 2D de los originales en 3D y así se dice en la
   interfaz. Los seis modos de interpolación de claves de VEGAS también están (§1); de este apartado
   solo faltan los manejadores Bézier que se arrastran.
   La ventana de Panoramización y recorte ya tiene la disposición completa de VEGAS (barra de herramientas,
   grupos plegables, candado, centro de giro, tira de claves con selector de parámetro), pero **el recorte se
   guarda como cuatro márgenes numéricos** en la pose del evento, no como los nodos de máscara de VEGAS: al
   leer un `.veg` esos nodos no se reconstruyen y, al escribirlo, el recorte de este editor no viaja. El centro
   de giro **no tiene su propia pista de claves** separada: se interpola junto con el resto de la pose.
10. **Audio**: hay buses, consola de mezcla, envolventes de volumen y panorámica dibujables en la pista (§6)
    y **tomas de efectos propias** por pista y por bus (ecualizador, compresor, limitador, puerta,
    distorsión, retardo, reverberación y teléfono). Faltan las tomas de complementos **VST/OFX** (binarios
    de terceros: no se pueden cargar en un navegador, y la interfaz lo dice) y el **audio multicanal (5.1)**.
    Los medidores ya informan pico, pico real, RMS y sonoridad en LUFS, pero la sonoridad es una
    **aproximación** de BS.1770 sin contrastar con un medidor homologado (§2).
11. **Medios**: sin soporte de proyectos multicanal, sin proxies, sin *device explorer* ni captura.
12. **Exportación**: sin escritura por streaming a disco (la salida se retiene en memoria), sin renderizado en
    segundo plano ni trabajadores: la cola de trabajos existe y se ejecuta en serie dentro del diálogo, así que
    mientras renderiza no se edita. Las plantillas de render no se guardan como preajustes reutilizables entre
    sesiones y la cola tampoco sobrevive a recargar la página.
13. **Selección temporal**: el tramo de renderizado y la región de bucle ya son independientes, como en VEGAS,
    pero hay uno de cada y no hay campos de selección con inicio, fin y duración editables fuera del diálogo de
    render ni de la propia regla. VEGAS permite además varias regiones y selecciones con nombre.
14. **Rendimiento con proyectos largos**: no se ha medido una exportación a 1080p con muchas pistas y efectos
    no neutros, que es donde el coste de composición crece.
14. **Intercambio**: falta importar `.pproj` y `.fcpxml`, y exportar a XML/EDL (solo se importa). El contraste
    con archivos reales exportados por VEGAS Pro 15 sigue pendiente.
15. **Compatibilidad**: plugins nativos y lectura de `.veg` quedan fuera de alcance por imposibilidad técnica,
    no por preferencia.
16. **Lo que este editor añade y VEGAS 15 no tiene**: las **plantillas de proyecto de redes** (TikTok, Reels,
   Shorts), la **galería de plantillas de texto estilo CapCut** con sus animaciones de redes y el **menú
   contextual propio** son añadidos, no paridad: VEGAS 15 no trae esa galería ni esas plantillas. Las
   plantillas de proyecto solo cambian el formato, **no reencuadran** lo ya montado, y así se dice en la
   ventana.
17. **Clic derecho**: dentro del editor se sustituye el menú del navegador por uno propio en la línea de
   tiempo, el panel de medios y el monitor. En el resto de la página (documentación, diálogos del sistema) el
   navegador sigue mostrando el suyo, que es lo que corresponde.
18. **Funciones de VEGAS que existen como script instalado y siguen pendientes** (inventario completo en
   `ANALISIS-VEGAS-REA.md` §4): promover los marcadores del material a la línea de tiempo (`Promote Media
   Markers.cs`, exige leer los marcadores del contenedor, que el navegador no expone de forma estándar);
   promover subtítulos incrustados CEA-608 (`Promote Media Closed Captioning.cs`, el navegador no los
   decodifica); exportar subtítulos a SCC/QuickTime (`Export Closed Captioning for *.cs`, aquí solo hay `.srt`);
   quemar el timecode de cada medio (`Add Timecode to all Media.cs`); y convertir estéreo a mono (`Stereo to
   Mono.cs`, el mezclador es estéreo). De esa lista se implementaron en la ronda 15 los tres que faltaban y se
   podían verificar en el navegador: quitar bandas negras, exportar los marcadores y una salida por pista de
   audio.
19. **Menú del clic derecho y ventana Propiedades (ronda 16)**: el menú del evento, sus submenús y el diálogo
   «Propiedades» son ya los de VEGAS 15 en rótulos y orden (§6), pero cinco familias de órdenes siguen
   desactivadas porque el modelo no las tiene: **Crear subclip** (no hay subclips en la lista de medios),
   **Toma ▸** (una toma por evento), **Enlace sinc ▸** (no hay enlaces de sincronización), **aplicar efectos de
   tiempo no real** (todo se procesa en tiempo real) y **abrir el medio en un editor de audio externo**. En
   Modificadores, **Reducir parpadeo de entrelazado** es una mezcla vertical de tres tomas, no el algoritmo de
   VEGAS. **Sensibilidad** de la envolvente y **Nivel compuesto** tampoco existen: la envolvente es de la pista
   de audio, no del evento. (Mantener relación de aspecto ya no está en esta lista: la ronda 20 la convirtió en
   un interruptor real, ver el punto 23.)
20. **Un solo `Recortar`**: el *Recortar* del clic derecho (Ctrl/Cmd+T) recorta los eventos seleccionados a los
   bordes del **tramo** de la línea de tiempo, que es el equivalente más cercano a la selección temporal de
   VEGAS; si no hay tramo marcado, lo dice en vez de no hacer nada.
21. **Ventana de Panoramización y recorte (ronda 17)**: lo que sigue sin ser igual que VEGAS. El grupo
   **Origen** tiene *Extender para rellenar f.* con el nombre de VEGAS pero **no deforma** (cubre recortando lo
   que sobra, porque la escala del motor es uniforme) y *Mantener rel. de aspecto* es un interruptor real desde
   la ronda 20, pero no el de VEGAS: la casilla desmarcada **estira** el material hasta el rectángulo del recorte
   (deforma), mientras que *Extender para rellenar f.* cubre sin deformar; **Vista de zoom** y **Densidad de
   cuadrícula** son de verdad, pero el zoom de la vista
   agranda el lienzo del monitor, no tiene los desplazamientos X/Y del área de trabajo de VEGAS; no hay
   **Seguimiento de función** (motion tracking), ni máscaras Bézier con tiradores (la máscara libre es un
   polígono de puntos), ni curvas dibujadas en la tira de claves. La lista de preestablecidos guarda el encuadre
   completo, no parámetros sueltos como los preestablecidos de VEGAS.
22. **Corrección de encaje (ronda 17)**: al implementar *Extender para rellenar f.* se encontró un defecto de
   cálculo en `lib/editor/letterbox.ts`: `fillFrame` y `fitFrame` devolvían la escala absoluta del medio cuando
   el compositor ya dibuja encajado a escala 1, así que con un medio mayor que el proyecto «cubrir» no cubría y
   «encajar» encogía de más (un 4K quedaba al 25 %). Las dos funciones se calcularon contra la base del
   compositor y hay una prueba de píxeles que lo comprueba; la matriz de estado de esta lista no cambia, pero el
   comportamiento de *Encajar el contenido al fotograma* y *Ajustar el contenido al fotograma* sí mejora.
23. **Mantener relación de aspecto (ronda 20)**: era la última casilla de los *Modificadores* que no hacía nada:
   se guardaba y el diálogo avisaba de que el motor solo usa píxeles cuadrados. Ahora es un interruptor real y
   **viene puesta**, que es lo que pedía el flujo de trabajo: con la casilla puesta el material conserva su
   proporción y deja bandas negras donde no cuadra con el fotograma (por ejemplo un cuadrado en un proyecto
   16:9), y al quitarla se estira hasta llenarlo, aunque se deforme. En el modelo el campo es `maintainAspect` y
   **ausente equivale a puesta**, así que los proyectos guardados antes de esta ronda se siguen abriendo con el
   comportamiento de siempre; en el diálogo de propiedades y en el grupo *Origen* de Panoramización/recorte la
   casilla sale marcada por defecto, y cambiarla en cualquiera de los dos sitios la cambia en los dos (también en
   los eventos enlazados, como el resto de interruptores). Quitada, *Extender para rellenar f.* no actúa: cubrir
   sin deformar y estirar deformando son excluyentes.
24. **Selección de recorte y zoom con la rueda (ronda 21)**: dos gestos pedidos por el usuario, **sin contrastar
   con VEGAS en ejecución** (no se pudo lanzar VEGAS para compararlos). La selección de recorte acopla dos cosas
   que hasta ahora iban sueltas: las esquinas recortan **y** acercan con una escala uniforme (la región que
   queda ocupa el fotograma), así que el recorte y el zoom dejan de ser independientes para ese gesto —los
   campos siguen siendo independientes y los puntos de los lados recortan sin tocar la escala—. La rueda ya no
   cambia la escala del evento: ahora acerca y aleja **la vista** del monitor (`Vista de zoom (%)`), y el zoom
   del contenido se hace con la herramienta *Acercar y alejar*, con el campo *Escala* o con las esquinas de la
   selección. Tampoco hay en VEGAS, que se sepa por esta vía, un «zoom a la selección» con las esquinas: es la
   lectura que se le dio a la petición.
25. **Posiciones del texto con nombre (ronda 22)**: la lista de posiciones es **de Corte 15**, no una copia de
   VEGAS: el plugin «Títulos & Texto» tiene el punto de anclaje de 9 posiciones y la posición del evento, pero
   no una lista de posiciones con nombre, y no se pudo ejecutar VEGAS para comprobar cómo las presenta. Lo que
   sí es del motor es lo de siempre: el anclaje de 9 puntos y «Posición X/Y (%)». Notas de lo que hace y no
   hace: la posición coloca el **borde del bloque** que dice el nombre (no la línea base del texto), así que
   con varias líneas el bloque crece hacia el lado que marca el anclaje y un texto largo puede acercarse al
   borde; los márgenes son fijos (5 % a los lados y 8 %/92 % de alto) y **no** hay zona segura por relación de
   aspecto, así que en un proyecto vertical las posiciones «a los lados» quedan igual de cerca del borde que en
   uno horizontal —se puede afinar desde Panoramización y recorte y entonces la ventana dirá «Posición
   propia»—; y no hay posiciones propias guardables (a diferencia de los preestablecidos de encuadre de
   Panoramización y recorte, que sí viven en el proyecto).

## 14. Limitaciones por navegador (medidas, no supuestas)

`tests/diagnostics.spec.ts` imprime por motor qué APIs existen, qué códecs se detectan y qué ocurre al
importar archivos reales. Resultado de la última ejecución:

| Motor | `VideoDecoder` | `AudioContext` | Códecs de salida | Importar MP4 | Importar WAV |
|---|---|---|---|---|---|
| Chrome (sistema) | sí | sí | MP4 + WebM + WAV | ✅ | ✅ |
| Edge (sistema) | sí | sí | MP4 + WebM + WAV | ✅ | ✅ |
| Firefox (Playwright) | sí | sí | WebM + WAV | ✅ | ✅ |
| WebKit (Playwright) | **no** | **no** | ninguno | ❌ con mensaje | ❌ con mensaje |

Medición de rendimiento en el mismo informe (Chrome, 1280×720, 30 fps): 300 fotogramas renderizados en
5,09 s, es decir unos **59 fps de render**, el doble de tiempo real.

La **interfaz** se mide aparte, con `npm run test:perf` (ronda 25): reproduce, arrastra la aguja, hace zoom y
espera al autoguardado, contando fotogramas reales del navegador con `requestAnimationFrame` y publicando el
informe en `outputs/rendimiento-ui.json`. Con un montaje de quince eventos, la reproducción pasó de p95 83,4 ms y
21 fotogramas por encima de 50 ms en tres segundos a **p95 16,8 ms y 2**, y el zoom deja el p95 igual (50 ms) pero
baja de **10 a 6** fotogramas largos por gesto.
Lo que **no** está medido: máquinas distintas de esta, proyectos mucho más grandes (cientos de eventos) y el
consumo de memoria, que no se instrumenta.

Cuando faltan APIs, el editor lo indica en una banda de aviso al arrancar y deshabilita la exportación con una
explicación, en lugar de ofrecer un botón que falla.

