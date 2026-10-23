# Sinaloa Pro — editor de video multipista en el navegador

**Sinaloa Pro: editor gratuito y de código abierto, inspirado en el espacio de trabajo clásico de VEGAS Pro 15. Hecho con cariño de parte de @andresibarrali. El formato de archivo conserva el nombre antiguo (`.corte15`) y el proyecto sigue siendo independiente y experimental. No es un producto oficial, no está afiliado a MAGIX ni a Sony, y no lee proyectos `.veg` ni
carga plugins nativos.**

El objetivo es reproducir la experiencia de escritorio de un editor no lineal (NLE) y **editar video de
verdad** desde un navegador de escritorio: motor de composición multipista, mezcla de audio, persistencia de
proyectos y exportación codificada. Todo el procesamiento ocurre en la máquina del usuario; ningún medio se
sube a un servidor.

- Matriz de funciones y estado real de cada una: [FEATURES.md](FEATURES.md)
- Informe de verificación, evidencias y limitaciones: [VERIFICACION.md](VERIFICACION.md)
- **Licencia: GNU GPL v3 o posterior** ([LICENSE](LICENSE)): sigue siendo libre, también en las versiones
  modificadas. Ver §11.

---

## 1. Requisitos

| Elemento | Requisito |
|---|---|
| Node.js | 22.13 o posterior (probado con 24.15) |
| Sistema | Windows, macOS o Linux (probado en Windows) |
| Navegador | Chrome o Edge (recomendado), Firefox. WebKit/Safari: limitado, ver §7 |
| Red | Solo para instalar dependencias. El editor funciona sin conexión |

El editor depende de WebCodecs (`VideoDecoder`, `AudioDecoder`, `VideoEncoder`, `AudioEncoder`), Canvas 2D,
Web Audio, IndexedDB y Web Workers. No requiere `SharedArrayBuffer`, por lo que **no necesita aislamiento
entre orígenes (COOP/COEP)** ni cabeceras especiales.

## 2. Ejecutar

**Windows (lo más simple):** doble clic en `Iniciar.cmd`. Instala dependencias si faltan y abre el servidor.

**macOS y Linux:** `sh iniciar.sh` desde Terminal, dentro de la carpeta del proyecto (en macOS también
`iniciar.command` con doble clic). Guía, y qué hacer si macOS avisa de que el archivo «puede ser malicioso»:
`INICIAR-MAC-LINUX.md`.

**Manual, en cualquier sistema:**

```sh
npm ci            # instala dependencias exactas del package-lock
npm run dev       # servidor de desarrollo en http://127.0.0.1:5173/
```

Abre `http://127.0.0.1:5173/` en el navegador. La ventana de consola debe permanecer abierta.

**Build y servidor local de producción:**

```sh
npm run build     # comprobación de tipos + build de Vite en dist/
npm run serve     # sirve dist/ en http://127.0.0.1:5173/
```

> `npm run dev` sirve una SPA de Vite (`index.html` + `client.tsx`). El andamiaje de Next/vinext que queda en
> `app/` solo se usa para publicar el sitio; el editor no depende de él.

## 3. Flujo mínimo (verificado de extremo a extremo)

1. **Importar** dos videos y un audio (botón *Importar medios*, o arrastrar y soltar sobre la ventana).
2. **Colocarlos en pistas**: doble clic en el medio, o arrastrarlo desde la biblioteca a una pista. Un archivo
   `.srt` que esté en Medios de proyecto se coloca igual: un evento de texto por frase, en su instante.
3. **Recortar**: arrastra los bordes izquierdo/derecho del evento.
4. **Dividir**: coloca el cursor y pulsa `S`.
5. **Texto**: pestaña *Generadores de medios* → *Títulos y texto*.
6. **Fundido**: arrastra los tiradores superiores del evento (o aplica 1 s desde *Transiciones*).
7. **Tramo**: arrastra sobre la regla para marcar solo la parte que quieres renderizar.
8. **Reproducir**: barra espaciadora o el botón de reproducción.
9. **Guardar**: *Guardar proyecto* descarga un `.corte15`.
10. **Reabrir**: *Abrir proyecto* y selecciona ese archivo; los medios se recuperan de la caché local o se
    revinculan a mano.
11. **Renderizar**: *Renderizar como…* → plantilla, ámbito (proyecto o tramo), resolución, FPS, calidad y
    bitrate → *Renderizar y descargar*. Si necesitas varios archivos, añádelos a la **cola del lote** y se
    renderizan en serie (§5.1.1).

Ese recorrido completo, incluida la exportación, es exactamente lo que ejecuta la prueba
`tests/browser.spec.ts`.

### 3.1 Interacciones de la línea de tiempo

| Acción | Resultado |
|---|---|
| Rueda del ratón sobre la línea de tiempo | Zoom horizontal **anclado en la aguja**: el fotograma del cursor no se mueve de su sitio en pantalla (igual con los botones de acercar/alejar y el deslizador) |
| **Rueda del ratón sobre la vista previa** | **Acerca y aleja la vista previa** (del 25 % al 800 %), anclada en el punto que hay bajo el puntero: al ampliar, el monitor se desplaza para llegar a cualquier esquina. Es un zoom **de la vista**, no del recurso: el encuadre del evento no se toca. En la barra del panel están también los botones de alejar, acercar y el porcentaje, que vuelve al encaje con un clic |
| **Arrastrar el borde del panel de medidores** | Lo ensancha o lo estrecha (54–420 px) para poder leer su nota de sonoridad; el panel empieza en 132 px |
| `Mayús` + rueda | Desplazamiento horizontal |
| `Ctrl`/`Cmd` + rueda | Desplazamiento vertical de la línea de tiempo (arriba y abajo), sin que el navegador aplique su zoom |
| `Alt` + rueda | También desplaza en vertical |
| Clic en un evento | Selecciona el evento **y** coloca la aguja en ese punto |
| Botón de recorte de la barra del evento (las marcas de esquina) | Abre **Panoramización y recorte** de ese evento, ya seleccionado, sin pasar por el menú. Solo lo llevan los eventos de vídeo: los de audio no se recortan |
| Botón `ƒx` de la barra del evento | Abre las propiedades y efectos de ese evento |
| **Botón del editor de texto de la barra del evento** | Solo en los eventos de texto y en los subtítulos: es la chapa de la pantalla con la página (la primera de la imagen de referencia) y abre **directamente el editor de texto** de ese evento, sin pasar por las propiedades |
| Clic y arrastre sobre la regla (franja de arriba) | Crea el tramo de renderizado (se ve su duración sobre la barra) |
| Clic y arrastre sobre la regla (franja de abajo, donde está la cabeza de la aguja) | **Mueve la aguja**: el cursor sigue al puntero, con el ajuste magnético activo, y no crea tramo |
| Arrastrar empezando justo sobre la aguja, en cualquier altura de la regla | También la mueve: la regla la agarra a 7 px o menos de distancia, como el cursor de VEGAS |
| **Mantener el clic sobre la línea de la aguja, en cualquier carril** (ronda 24) | La aguja se agarra también **desde los carriles**, no solo desde la regla: si el clic cae a 7 px o menos de la línea, el gesto es para moverla y **no** mueve ni selecciona el evento que hay debajo, ni marca el tramo sobre un hueco. Agarrarla no la hace saltar: se mueve al arrastrar, con el ajuste magnético. Lejos de la línea, el clic sobre un evento sigue seleccionándolo y moviéndolo como siempre |
| Clic y arrastre sobre un hueco de la línea de tiempo | También crea el tramo: no hace falta acertar en la regla |
| Mantener el clic en la aguja y arrastrar | Desplaza la aguja a izquierda o derecha, con el ajuste magnético activo. La aguja se ve como la de VEGAS: una línea que baja por todas las pistas con una cabeza de flecha en la regla |
| Tirar de los extremos del tramo | Ajusta inicio o fin con precisión de fotograma |
| Doble clic o clic derecho sobre el tramo | Lo elimina |
| Botones `[` y `]` del pie | Marcan inicio y fin del tramo en el cursor |
| *Desde selección* | Ajusta el tramo al conjunto de eventos seleccionados |
| `Ctrl`/`Cmd` + clic y arrastre | Marca la **región de bucle** (la barra verde, encima de la del tramo) en lugar del tramo |
| `L` / `Mayús` + `L` | Marcan el inicio y el fin de la región de bucle en el cursor |
| `Alt` + `L`, o el botón *Repetir* del pie | Activan o desactivan la repetición: al llegar al final de la zona, la reproducción vuelve a su principio |
| *Desde tramo*, o *Insertar → Bucle desde el tramo* | Copian el tramo de renderizado a la región de bucle (`Ctrl+L` no se captura: el navegador lo reserva para la barra de direcciones) |
| `Ctrl` + `Mayús` + `L` | Quita la región de bucle |
| Tirar de los tiradores de la barra verde | Ajusta el inicio o el fin del bucle con precisión de fotograma |
| Doble clic o clic derecho sobre la barra verde | Quitan la región de bucle |
| Clic en una pista vacía | Mueve la aguja y deselecciona |
| Arrastrar las asas de la caja del monitor | Redimensiona (o recorta, con `Alt` o con el botón *Recortar*) el evento o la pista seleccionada, sin abrir ninguna ventana |
| **Clic derecho en cualquier punto del editor** | Abre el menú del editor, no el del navegador: sobre un evento, sus acciones (Panoramización y recorte, títulos, efectos, dividir, copiar, agrupar, **copiar y pegar los efectos y el estilo**, eliminar); sobre la cabecera o el carril de una pista, las de la pista; sobre la regla, el tramo, el bucle y los marcadores; en un medio del panel, insertar, trimmer y revincular; en el monitor, reproducción y propiedades. Se cierra con `Escape`, con la rueda, al hacer clic fuera o al cambiar el tamaño de la ventana, y nunca se sale de la pantalla |
| **Copiar los efectos y el estilo de un clip y pegarlos en otro** | Clic derecho en el evento de origen → *Copiar los efectos y el estilo* (`Ctrl/Cmd+Mayús+C`), clic derecho en el destino → *Pegar los efectos y el estilo* (`Ctrl/Cmd+Mayús+V`), o *Elegir qué atributos pegar…* para llevar solo algunos grupos. Sirve igual para los subtítulos: la plantilla de texto viaja con el estilo. Detalle en §5.5.1 |
| Clic en la cabecera de una pista | Selecciona la pista: se sombrea (con su propio tono si es de audio) y su carril queda marcado |
| Arrastrar la cabecera de una pista | La cambia de sitio: cae donde la sueltes, siempre dentro de su grupo (vídeo con vídeo, audio con audio) |
| `Alt` + `↑` / `Alt` + `↓` | Sube o baja la pista seleccionada |
| Clic derecho en la cabecera → *Subir* / *Bajar pista* | Lo mismo desde el menú de la pista |
| Clic derecho en la cabecera de una pista | Menú de la pista: propiedades, silenciar, solo, subir, bajar y **eliminar la pista con sus eventos** |
| `Supr` con una pista seleccionada | Elimina esa pista y todo lo que contiene (si hay eventos seleccionados, borra solo esos eventos) |

Eliminar una pista pasa por el historial: `Ctrl/Cmd+Z` la devuelve tal cual estaba.

El tramo se guarda en el proyecto (`.corte15`) y el diálogo de renderizado lo propone automáticamente como
ámbito cuando existe.

### 3.2 Tramo y región de bucle

Son **dos regiones independientes**, como en VEGAS: el **tramo** decide qué se graba al renderizar y la
**región de bucle** qué se repite al reproducir. Pueden solaparse, estar en sitios distintos o existir solo una
de las dos. En la regla se ven las dos: el tramo es la barra clara de abajo y el bucle, la barra verde de
arriba (encendida cuando la repetición está activa).

Al reproducir con la repetición activa manda la región de bucle; si no hay ninguna marcada se usa el tramo y,
si tampoco hay, se repite el proyecto entero. El bucle se guarda en el `.corte15` (campo `loopRegion`); que la
repetición esté encendida o apagada es un ajuste del transporte y no se guarda. Las ediciones con **rizo
total** (*Ripple: todas + marcadores*: recortar, mover o borrar corriendo el material) arrastran la región de
bucle igual que arrastran el tramo y los marcadores; el rizo de una sola pista no la toca.

Lo verifica `tests/loop-region.test.ts` (once pruebas del modelo, de la validación y del rizo) y el flujo de
navegador «la región de bucle se marca con Ctrl, se ajusta con sus tiradores y repite la reproducción».

## 4. Arquitectura

Separación estricta por capas; la interfaz no contiene lógica de edición ni de codificación.

| Capa | Archivo | Responsabilidad |
|---|---|---|
| Modelo temporal y comandos | `lib/editor/project.ts` | Ticks racionales (705 600 000/s), `FPS` como fracción, eventos, pistas, recorte, división, ripple, agrupación, fundidos, clave/transformaciones, historial deshacer/rehacer |
| Validación | `lib/editor/validation.ts` | Esquema Zod del formato `.corte15`: rangos, referencias y coherencia de pistas |
| Decodificación de medios | `lib/editor/media.ts` | Detección real de contenedor y códecs, miniaturas, formas de onda, PCM en memoria |
| Composición | `lib/editor/compositor.ts` | Orden de pistas, transformaciones, recorte, opacidad, texto, color, fundidos |
| Mezcla de audio | `lib/editor/audio.ts` | Mezcla estéreo a nivel de muestra, panorama, envolventes, limitador, reloj de reproducción |
| Codificación y multiplexado | `lib/editor/export.ts` | Renderizado por fotogramas, MP4 H.264/AAC o WebM VP9/Opus según capacidades, progreso y cancelación |
| Persistencia | `lib/editor/storage.ts` | Autoguardado, descarga, caché de medios en IndexedDB, espacio disponible |
| Interfaz | `components/editor/editor.tsx`, `components/editor/controls.tsx`, `app/editor.css` | Espacio de trabajo, paneles, línea de tiempo, diálogos y atajos |

**Base temporal:** no se usan segundos en coma flotante como unidad de edición. Todo evento se posiciona en
ticks enteros y las velocidades de fotogramas son fracciones exactas (`30000/1001`), de modo que 107 892
fotogramas no acumulan deriva (hay una prueba dedicada).

**Previsualización y exportación comparten motor:** ambas llaman a `compose()` y `mix()` con el mismo modelo
temporal, así que lo que se ve es lo que se exporta. La exportación renderiza fotograma a fotograma; no graba
la pantalla ni reproduce la secuencia en tiempo real.

## 5. Formato de proyecto `.corte15`

JSON versionado (`format: "corte15"`, `version: 1`) con pistas, eventos, efectos, fotogramas clave, marcadores,
región, propiedades de proyecto y **referencias** a los medios (id, nombre, tamaño, fecha, duración,
resolución, miniatura y picos de onda).

**El archivo de proyecto no contiene los videos.** Es la diferencia clave frente a "exportar": guardar el
proyecto conserva la edición, pero los archivos originales siguen siendo tuyos y necesarios. Por eso:

- Al importar, el editor puede guardar una **copia en la caché del navegador** (IndexedDB) para reabrir sin
  los originales. Esa caché puede ser borrada por el navegador.
- Si al abrir un proyecto faltan medios, se avisa y el panel ofrece el filtro *Medios faltantes* y el botón
  *Revincular* para señalar el archivo correspondiente.
- La revinculación comprueba tipo y duración suficiente antes de aceptar el reemplazo.

**Plantillas de proyecto** (*Propiedades del proyecto → Plantilla*). Trece formatos listos para empezar, con
las medidas que usan las plataformas: **TikTok 1080×1920**, **Instagram Reels 1080×1920**, **YouTube Shorts
1080×1920 a 60 fps**, **Vertical 720×1280** (borrador), **Cuadrado 1080×1080** (feed), **YouTube 1080p**,
**Horizontal 720p**, **YouTube 4K**, **Cine 24p**, **Cine 4K 24p**, **NTSC 29,97**, **PAL 25p** y **Audio
44,1 kHz**, agrupadas en Vertical (9:16), Cuadrado (1:1), Horizontal (16:9), Cine y Solo audio. Elegir una fija
el ancho, el alto, la velocidad de fotogramas y la frecuencia de audio, y explica en una línea para qué sirve
esa medida; la lista reconoce sola el formato actual y, si no coincide con ninguna, muestra «Personalizada»
con el resumen del proyecto (`1080×1920 (9:16), 30 fps, 48000 Hz`).

Lo que una plantilla **no** hace: no mueve ni reencuadra lo que ya esté montado. Cambiar de horizontal a
vertical deja los eventos donde estaban, así que hay que reencuadrarlos a mano con la ventana de
Panoramización y recorte (o empezar el montaje después de elegir la plantilla, que es lo razonable). Está dicho
en la propia ventana en vez de simular un reencuadre automático. Se comprueba con 6 pruebas unitarias
(`tests/templates.test.ts`: coherencia de medidas y relaciones, velocidad admitida por el editor, atajos de
redes, aplicación que no toca el montaje y detección del formato) y un flujo de navegador que cambia a TikTok,
Reels, Shorts y Cuadrado, mira el monitor vertical y recarga la página para ver que el formato se conserva.

## 5.1 Renderizado y exportación

- **Ámbito**: proyecto completo o **tramo** seleccionado en la línea de tiempo (con inicio y fin editables
  en el propio diálogo). Si hay un tramo definido, el diálogo lo propone automáticamente.
- **Plantillas**: *Igual que el proyecto*, *MP4 1080p 30 alta*, *MP4 720p 30 media*, *MP4 480p 30 borrador*,
  *WebM 720p 30 media* y *Solo audio WAV 48 kHz*. Cualquier campo se puede ajustar a mano.
- **Formatos**: MP4 con H.264/AAC, WebM con VP9/Opus y WAV con PCM de 16 bits. Se pueden desactivar
  *Incluir video* o *Incluir audio* (por ejemplo, audio solo dentro de un MP4).
- **Calidad**: cuatro niveles (Borrador, Media, Alta, Máxima) o un **bitrate explícito** en Mbps; el diálogo
  muestra el bitrate automático sugerido para la resolución y los FPS elegidos.
- **Progreso real**: fotogramas hechos, fotogramas por segundo de render, tiempo transcurrido, tiempo
  restante estimado y tamaño acumulado; cancelación inmediata con liberación de recursos.
- **Motor compartido**: la exportación usa la misma composición (`compose`) y mezcla (`mix`) que la vista
  previa, fotograma a fotograma, sin grabar la pantalla ni reproducir en tiempo real.
- **Rendimiento medido** en este equipo (Chrome, 1280×720, 30 fps): 300 fotogramas en 5,1 s, unos
  **59 fps de render** (el doble de tiempo real). La medición es reproducible con
  `npm run test:capabilities`.
- **Rendimiento de la interfaz** (ronda 25): durante la reproducción el editor **no se vuelve a renderizar en
  cada fotograma**. Antes, el bucle de reproducción actualizaba el cursor y los medidores con `setState` sesenta
  veces por segundo, y eso volvía a renderizar la línea de tiempo entera —eventos, ondas, cabeceras— en cada
  fotograma: con quince eventos en pantalla se perdían fotogramas de hasta 117 ms. Ahora:
  - la **aguja** y el **timecode grande** se actualizan por referencia (`paintCursor`), y el **monitor** se
    compone llamando a `paintPreview(at)` directamente, sin pasar por el render;
  - los **medidores** tienen su propio almacén (`lib/editor/meter-store.ts` + `components/editor/meters.tsx` con
    `useSyncExternalStore`), así que su lectura por fotograma solo repinta ese panel;
  - el estado de React se sincroniza solo si hay un **diálogo abierto** (cuatro veces por segundo), porque son
    los únicos que leen el cursor; al pausar se sincroniza del todo.
  Medido con `npm run test:perf` (fotogramas reales del navegador, montaje de quince eventos, tres corridas):
  la reproducción pasa de **p95 83,4 ms con 21 fotogramas por encima de 50 ms en tres segundos a p95 16,8 ms con
  2**, y el zoom de la línea de tiempo deja la mediana y el p95 como estaban (50 ms, que es el coste del
  reflow de la línea de tiempo al cambiar el ancho) pero **baja de 10 a 6 los fotogramas largos** del gesto: el
  trazado de las ondas baja por una **escalera de resoluciones** y solo se rehace cuando cruza un escalón, las
  coordenadas van en enteros y la silueta se repasa con su propio trazado en vez de con un segundo camino. El
  arrastre de la aguja ya iba fino y sigue igual (p95 16,8 ms) y el autoguardado no deja fotogramas largos.
- **Límites**: la salida se retiene en memoria (aviso al superar 256 MB) y no hay renderizado en segundo
  plano: la **cola se ejecuta en serie dentro del diálogo**, así que mientras renderiza no se edita (el bucle
  de renderizado cede el hilo periódicamente para que la interfaz siga respondiendo y se pueda cancelar).

### 5.1.1 Lote de renderizado (cola de trabajos)

VEGAS Pro 15 trae un script, *Batch Render* (`Script Menu/Batch Render.cs`), que permite elegir **varias
plantillas de render a la vez** y renderizar el proyecto (o cada región) una vez por plantilla, en serie, con
el nombre `<nombre base><tipo de archivo>_<plantilla>` y sustituyendo por guiones los caracteres que Windows
no admite. Corte 15 tiene el equivalente en **Renderizar como… → Lote de renderizado** (y en
*Archivo → Lote de renderizado…*, que abre el mismo diálogo):

| Acción | Qué hace |
|---|---|
| *Añadir a la cola* | Prepara un trabajo con los ajustes que hay en el diálogo (formato, resolución, FPS, calidad, ámbito y salidas) |
| *Añadir las plantillas disponibles* | Prepara de una vez las plantillas que este navegador puede codificar: MP4 1080p alta, MP4 720p media, WebM 720p media y WAV solo audio, con la velocidad y el ámbito que ya tenías elegidos |
| Lista de trabajos | Cada trabajo muestra su etiqueta, el **nombre del archivo** que se descargará, su estado (En espera, Renderizando con los fotogramas hechos, Hecho con el tamaño y el tiempo, Error con el motivo y Cancelado) y un botón para quitarlo |
| *Renderizar la cola* | Los renderiza **uno tras otro**, sobre una copia del proyecto tomada al empezar, y descarga cada archivo al terminarlo |
| *Cancelar renderización* | Detiene la cola: lo que estaba en espera pasa a Cancelado y se conserva lo ya descargado |

Un trabajo que falla **no detiene los demás**: queda marcado con su error y la cola sigue (el script de VEGAS,
en cambio, aborta al primer fallo). Volver a pulsar *Renderizar la cola* reintenta lo que quedó en espera y lo
que falló. Los nombres se numeran (`...[2].mp4`) cuando dos trabajos coinciden, como el `[índice]` que VEGAS
usa al renderizar varias regiones.

**Diferencias con el script de VEGAS, dichas claras:** el modo *Regiones* del script renderiza cada región
con nombre por separado, y Corte 15 no puede reproducirlo porque guarda **un** tramo de renderizado y los
marcadores no tienen duración (son instantes, no regiones); la cola trabaja sobre el proyecto completo o
sobre el tramo. Tampoco hay carpeta de destino ni diálogo de sobrescritura: cada archivo va a la carpeta de
descargas del navegador, que puede pedir permiso la primera vez que se descargan varios seguidos. La cola no
se guarda entre sesiones.

Lo verifican `tests/batch.test.ts` (10 pruebas de la lógica: nombres, etiquetas, duplicados, ámbitos,
problemas y resumen) y el flujo de navegador «lote: dos trabajos en la cola se renderizan en serie y se
descargan», que además comprueba los dos archivos con ffprobe (el de vídeo con su pista de imagen y su
duración, el WAV solo con audio).

## 5.2 Timecode

Todo lo que muestra un tiempo (el monitor, la regla, la aguja, los eventos, la barra de estado, el tramo, la
región de bucle y los diálogos) usa **el formato que elijas en las propiedades del proyecto**, con los tres de
VEGAS 15:

| Formato | Cómo se ve | Cuándo usarlo |
|---|---|---|
| SMPTE sin descarte | `01:23:45:12` | Con 24, 25, 30, 50 o 60 fps exactos |
| SMPTE con descarte | `01:23:45;12` | Solo con 29,97 y 59,94 fps |
| Segundos y milisegundos | `01:23:45.678` | Trabajo con audio |

El **descarte** es lo que hace que el timecode siga al reloj: la numeración se salta los fotogramas `00` y
`01` al empezar cada minuto (cuatro números a 59,94), salvo cuando el minuto es múltiplo de 10. Sin descarte,
una hora de timecode a 29,97 fps se queda unos **3,6 s por detrás** del reloj real; con descarte, el error es
de menos de un fotograma cada diez minutos. Las propiedades del proyecto te dicen cuánto se desvía el formato
elegido y avisan si pides descarte a una velocidad que no lo admite (a 23,976, por ejemplo, la norma no lo
contempla y se cae a sin descarte).

Debajo del timecode grande hay un campo **Ir a timecode**: escribe `HH:MM:SS:FF`, `HH:MM:SS;FF`, `MM:SS:FF`,
`SS.mmm` o segundos sueltos y la aguja se va a ese instante. Si no se entiende lo que escribiste, lo dice en
vez de saltar a un sitio cualquiera.

## 5.3 Abrir proyectos hechos en VEGAS Pro

**Los archivos `.veg`** se analizan de verdad: se leen su estructura de bloques, sus propiedades (duración,
velocidad de fotogramas, resolución, fechas), la **lista de medios referenciados** y los **títulos** con su
texto. Lo que no se reconstruye es el montaje: la posición de cada evento vive en registros binarios internos
sin documentar y no hay forma de verificarlos, así que no se inventan. El análisis completo del `.veg` que
enviaste está en [ANALISIS-VEG.md](ANALISIS-VEG.md). Si abres un `.veg`, el editor muestra ese análisis y
ofrece añadir los medios referenciados para revincularlos.

Ese análisis es el modo **sin VEGAS**. Con el puente de §5.2 en marcha, el mismo archivo se puede importar
entero (pistas, eventos, recortes, fundidos, movimiento y marcadores) y volver a guardar como `.veg`.

Lo que sí funciona, porque son los formatos que VEGAS exporta oficialmente ([ayuda de VEGAS: importación y
exportación de proyectos](https://help.magix-hub.com/video/vegas/23/es/content/topics/3-projects/importing_and_exporting_projects.htm)):

1. En VEGAS Pro: **Archivo → Exportar → «Final Cut Pro 7/DaVinci Resolve (\*.xml)»** o **«Archivo de texto EDL
   (\*.txt)»**.
2. En Corte 15: **Archivo → Abrir o importar proyecto (corte15, XML, EDL)…** y elige ese archivo.

| Se importa | Detalle |
|---|---|
| Propiedades | Velocidad de fotogramas y, en XML, tamaño de secuencia |
| Pistas | Una pista de video o audio por cada `track` (XML) o por cada canal usado (EDL) |
| Eventos | Posición, duración y punto de entrada en el origen, con precisión de fotograma |
| Vínculo A/V | El audio y el video del mismo clip y el mismo tramo quedan agrupados, como en VEGAS |
| Medios | Se reconstruyen como **referencias**: aparecen como faltantes y se revinculan con *Revincular* |
| Informe | Un diálogo resume qué se leyó, qué se aproximó y qué se descartó |

Lo que **no** viaja en esos formatos y por tanto no se recupera: efectos, transiciones, curvas de fotogramas
clave, envolventes de audio, niveles de pista y marcadores. Los generadores se importan como color sólido.
En EDL, la velocidad de fotogramas se deduce de `FCM` o se asume 30 fps, y el EDL con *drop frame* se
interpreta a 29.97 sin aritmética de drop frame (se avisa en el informe).

> Los analizadores se han probado contra archivos escritos según las estructuras documentadas de xmeml v5 y
> CMX 3600. **No se pudo contrastar con un XML o un EDL exportados por una instalación real de VEGAS Pro 15**
> en esta sesión, así que considéralo un subconjunto útil y verificado de la especificación, no una garantía
> sobre cualquier variante que produzca tu versión.

## 5.2 Leer y guardar `.veg` con VEGAS Pro 15 (puente)

El montaje **sí** se puede leer y escribir en `.veg`, pero solo con VEGAS: el formato no tiene especificación
pública y la única implementación completa es la suya, la API de scripting `ScriptPortal.Vegas.dll`. Corte 15
la usa a través de un puente local:

```
Iniciar-con-VEGAS.cmd          (o: npm run bridge)
   ├── scripts/veg-bridge-server.mjs   servidor en 127.0.0.1:5174
   └── bridge/VegBridge.cs             script que VEGAS ejecuta dentro de sí mismo
```

1. Arranca **`Iniciar-con-VEGAS.cmd`**: abre el editor en <http://127.0.0.1:5173/> y el puente en otra ventana.
2. **Abrir**: *Archivo → Abrir o importar proyecto* y elige un `.veg`. El diálogo dice si el puente está en
   marcha; si lo está, **Importar el montaje completo con VEGAS** trae pistas, eventos con su posición,
   duración y punto de entrada, fundidos, velocidad, movimiento (desplazamiento, escala y giro con sus
   fotogramas clave), curvas de opacidad, marcadores y el tramo.
3. **Guardar**: *Propiedades del proyecto → Guardar como .veg (VEGAS 15)*. Los `.veg` se escriben en
   `Documentos\Corte15` (o en la carpeta que indique `CORTE15_VEG_OUT`).

Cómo funciona por debajo: el navegador envía al puente los bytes del `.veg` (al leer) o el montaje ya
convertido a TSV (al guardar); el puente escribe un archivo de trabajo y lanza
`vegas150.exe /NOLOGO /SCRIPTARGS "job=…" /SCRIPT "…\bridge\VegBridge.cs"`. El script usa `Vegas.ReadProject`
para leer y `Project.SaveProject` para escribir, y deja un informe con lo que hizo y lo que omitió. El puente
no espera al código de salida de VEGAS, sino a que aparezca el archivo de salida, porque VEGAS es de instancia
única y puede entregar la orden a una ventana ya abierta.

| Se trae del `.veg` | Detalle |
|---|---|
| Propiedades | Tamaño, velocidad de fotogramas (con aviso si no es una de las que admite el editor) y frecuencia de audio |
| Pistas | Nombre, silencio y solo; en las de audio, volumen y panorama |
| Eventos | Posición, duración, punto de entrada, velocidad y fundidos de entrada y salida |
| Movimiento | Desplazamiento, escala y giro con sus fotogramas clave; opacidad como curva |
| Marcadores y tramo | Etiquetas y el primer tramo (el editor solo guarda uno) |
| Medios | Se añaden como referencias: revincúlcalos con *Revincular* para reproducir y recortar |

Lo que **no** viaja, y el diálogo lo dice en lugar de simularlo: efectos y transiciones (el modelo del editor
no los representa), eventos sin archivo (títulos y generadores, que VEGAS guarda aparte) y subtítulos. Al
guardar como `.veg` se omiten los eventos de texto y color y los medios sin ruta en disco, y se informa de
cuántos.

Requisitos y avisos: VEGAS Pro 15 instalado en la misma máquina; el puente solo escucha en `127.0.0.1` y exige
la cabecera `x-corte15-bridge`, así que una web cualquiera no puede usarlo. Si VEGAS ya estaba abierto, el
script corre en esa ventana: cierra cualquier diálogo modal o el puente se rendirá a los cuatro minutos con un
mensaje que lo explica. Variables: `CORTE15_VEGAS` (ruta del ejecutable), `CORTE15_VEG_OUT` (carpeta de
salida), `CORTE15_BRIDGE_PORT`, `CORTE15_VEG_TIMEOUT` y `CORTE15_VEGAS_NOWINDOW=1`.

## 5.3 Subtítulos automáticos (transcripción con Groq)

El botón **Generar subtítulos** está en la barra del panel de medios, justo a la derecha del buscador. Al
pulsarlo se abre un diálogo que **pregunta cuántas palabras quieres en cada subtítulo** (1, 2, 3, 4, 5, 6 u 8, o
*Una línea por frase* para que cada línea sea la intervención completa que devuelve el servicio). La elección se
recuerda la próxima vez. Después:

1. Mezcla el audio del proyecto **en tu equipo** y lo convierte a WAV PCM de 16 kHz mono.
2. Lo envía a la API de Groq (`whisper-large-v3`, compatible con la de OpenAI). **El audio solo sale de tu
   equipo en ese momento y solo si tú pulsas el botón.**
3. Crea el archivo **`subtitulos.srt`** en Medios de proyecto: aparece en la carpeta **Subtítulos**, y también
   en **Videos** y en **Todos los medios**, como pediste. Doble clic sobre él lo **inserta otra vez en la
   línea de tiempo** (así se recuperan los subtítulos si borraste los eventos); para bajarlo al disco, usa el
   botón *Descargar .srt* de la ficha del medio.
4. Añade los textos a la **línea de tiempo**: crea una pista **«Subtítulos»** con un evento de texto **por cada
   línea**, colocado en su instante exacto con la tipografía y la posición de subtítulo.

Los tiempos de cada línea salen de los tiempos de sus palabras (los que devuelve la API o, si no los trae, los
que se reparten dentro de la frase), así que una línea de *k* palabras **empieza cuando se dice la primera y acaba
cuando termina la última**; lo que sobra al final va en una línea más corta. El `.srt` guarda exactamente esas
líneas, así que lo que se ve en la línea de tiempo y lo que se lee en el archivo coinciden. Los recursos de Pexels
siguen colocándose palabra a palabra con los tiempos finos de la transcripción, aunque el `.srt` vaya agrupado.

**Verificado de extremo a extremo con voz real**: con la clave nueva, un WAV de voz en español genera

```
1
00:00:00,000 --> 00:00:04,340
Hola, esto es una prueba de subtítulos automáticos para Corte 15.

2
00:00:05,300 --> 00:00:06,660
Segunda frase de la prueba.
```

y los dos eventos aparecen en la línea de tiempo. Puedes repetir esa comprobación con `npm run test:live`
(requiere red y claves; por eso no forma parte de la suite normal). La clave se guarda en tu navegador o en
`.env.local`, y nunca se escribe en el proyecto.

## 5.4 Recursos automáticos desde Pexels

El botón **Recursos Pexels** (junto al de subtítulos) abre un diálogo con **dos modos**:

**a) Según la transcripción** (el que aparece por defecto). Es el modo que responde a lo que se dice, y trabaja
**palabra a palabra**:

1. Parte la transcripción en **palabras**, cada una con su instante (`wordCuesOf`). Si el `.srt` ya viene palabra
   a palabra (es lo que genera el editor al transcribir) se respetan sus tiempos exactos; si es un `.srt` de
   otra fuente, con frases enteras, los tiempos se reparten dentro de la frase.
2. **Cada palabra recibe su propio clip** en la pista **«Pexels»**, colocado **exactamente en el instante en que
   se dice** y con la duración **hasta la palabra siguiente**, así que la pista queda continua y sin solapes. Si
   se dice «dinero» en el segundo 6,4, el recurso de dinero empieza en 6,4 s y dura hasta la palabra siguiente.
3. Las palabras con búsqueda propia (sustantivos, verbos, adjetivos, nombres) se buscan tal cual. Las que no la
   tienen —muletillas, números, artículos— usan el **recurso principal de su frase**, para que ninguna palabra se
   quede sin imagen y el recurso siga pegado a lo que se cuenta. El nombre del evento dice qué palabra lo pidió:
   `dinero · dinero-9-9-1080p.mp4` o `del · dinero-9-9-1080p.mp4`.
4. Si una palabra se repite, **reutiliza el mismo clip** en cada momento en lugar de volver a descargarlo.
5. Los clips también se añaden a Medios de proyecto (carpetas **Videos** y **Todos los medios**) con su
   atribución. El límite por tanda son hasta 24 clips distintos (4 por cada clip pedido en *Cantidad*), y el
   mensaje final dice cuántas palabras tienen recurso y cuántas no: «Recursos por palabra: 9 de 9 palabra(s) con
   su clip en la pista «Pexels» (100 %)… 4 clip(s) distinto(s) para 4 término(s)». Cuando un silencio es más
   largo que el clip descargado, la pista deja ese hueco en blanco en lugar de estirar la imagen.

Como la transcripción se guarda en el proyecto, este modo funciona también al reabrir un proyecto que ya tenga
su `.srt`, sin necesidad de volver a transcribir.

**b) Buscar por texto**: escribe un término, elige cantidad y orientación, y los clips se colocan uno tras otro
desde el cursor en la misma pista «Pexels».

La clave de Pexels que facilitaste **sí funciona**: la comprobé contra el servicio (HTTP 200) y contra el
endpoint de vídeos, y su respuesta coincide con lo que interpreta el editor.

Las dos claves se guardan solo en tu navegador (`localStorage`) y **nunca** se escriben en el archivo de
proyecto. Si prefieres fijarlas por entorno, usa `.env.local` (ignorado por git) con `VITE_GROQ_API_KEY` y
`VITE_PEXELS_API_KEY`.

## 5.5 Panoramización, recorte, títulos y modos de fusión

Tres herramientas de VEGAS Pro 15 que faltaban, cada una con su ventana:

**Panoramización y recorte** (*Herramientas → Panoramización y recorte…*, o desde las propiedades del
evento, o con el **botón de recorte de la barra del evento** —el icono de marcas de esquina, a la izquierda de
`ƒx`, presente en los eventos de vídeo—). Se abre un monitor con el fotograma compuesto en el instante del cursor y la caja del contenido con
ocho asas: arrastrar dentro mueve, arrastrar un borde o una esquina recorta ese lado y **la rueda acerca y
aleja la vista** de la ventana (`Vista de zoom (%)`), sin tocar el encuadre. La rueda **solo responde dentro del
monitor**: en el resto de la ventana no hace nada (ni desplaza la columna de parámetros ni la tira de claves, ni
llega a la línea de tiempo de detrás); los parámetros se desplazan con su barra. Los cuatro márgenes del recorte son
independientes (hasta el 45 % por lado) y todo se puede fijar como fotograma clave: con la envolvente activa,
cualquier cambio se guarda en la clave del cursor y se crea si no existe, como en VEGAS. Las claves viajan con
el evento al dividirlo, recortarlo o moverlo.

**La selección de recorte** (botón *Agregar recorte* del grupo Recorte, o la herramienta *Recortar* de la barra
lateral) dibuja sobre el monitor la región que se conserva: un recuadro discontinuo azul claro con **un punto en
cada esquina** y otro en el centro de cada lado. Las esquinas **recortan y acercan a la vez**: al llevar la
selección hacia dentro se recorta y la imagen se acerca (la escala sube), y al agrandarla se aleja; la ventana lo
dice en su ayuda y la cifra aparece en *Escala*. El zoom es **uniforme** —una sola escala, la mayor de las dos
que llenarían el fotograma por cada eje, así que nunca deforma— y se mide sobre los márgenes del recorte, no
sobre el tamaño del fotograma: sin recorte la escala sigue siendo 1 (no hay salto al empezar) y el material que
venía con bandas las conserva. Los puntos de los lados recortan sin tocar el zoom. Con la selección puesta, el
arrastre se mide desde el punto donde se agarró, así que el gesto no se acelera a medida que la imagen se
acerca.

**La ventana está organizada como la de VEGAS 15** (su *Efectos de evento de vídeo → Panoramización/Recorte*):

| Zona | Qué tiene |
|---|---|
| Barra de título | La chapa `ƒx`, el nombre del complemento con el evento, el tamaño de la ventana en píxeles, el menú `≡` (centrar, restablecer, quitar recorte, bloquear y cerrar), *Centrar* y el `×` rojo de cerrar |
| Barra de pestañas | Las **migas** de la ventana —el complemento anterior a la izquierda, `Panoramización/Recorte` en medio y el siguiente a la derecha—, el **candado** que bloquea los parámetros para no cambiarlos sin querer y la ayuda de la herramienta activa. La cadena de efectos tiene un solo complemento, así que el anterior vuelve a las propiedades del evento y el siguiente sale apagado diciéndolo |
| Fila del preestablecido | *Parámetro preestablecido* con **(Predeterminado)**, *Centrar el encuadre*, *Zoom 2× al centro*, *Girar 90°*, *Recortar a 4:3* y *Recortar a 1:1* (estos dos últimos calculan el recorte que sobra de los lados largos) y los preestablecidos propios, más los botones **Guardar parámetro preestablecido** y **Eliminar parámetro preestablecido** (los dos rótulos son los de VEGAS) y *Restablecer encuadre* y *Quitar recorte* |
| Barra de herramientas (izquierda) | Seis herramientas como las de VEGAS: **mover** el encuadre, **acercar y alejar**, **girar**, **recortar**, **dibujar la máscara** y **girar en 3D**. La herramienta decide qué hace el arrastre dentro de la caja; las ocho asas recortan siempre, y la herramienta **recortar** enciende la selección de recorte |
| Columna de parámetros | Grupos **plegables**, con los nombres de VEGAS: **Posición**, **Rotación**, **Recorte** (con **Agregar recorte**, *Sin recorte* y *Cuadrado (1:1)*), **Interpolación de fotogramas clave** (con **Suavidad (%)**), **Origen** (con **Mantener rel. de aspecto** y **Extender para rellenar f.**), **Área de trabajo** (con **Vista de zoom (%)** y **Densidad de cuadrícula**) y **Máscara libre (trazado)** |
| Monitor (derecha) | El fotograma **con un margen alrededor** sobre el tablero de cuadros (como el monitor de VEGAS), el borde del área de trabajo, el recuadro del contenido **estarcido** con una trama de puntos, la caja con sus ocho asas —y, con la **selección de recorte** puesta, el recuadro discontinuo azul claro con los cuatro puntos redondos de las esquinas y los cuatro de los lados—, el **círculo del centro de giro** y una cruz en el punto de giro. Cuando hay recorte, lo que se descarta se marca con rayas diagonales |
| Barra de fotogramas clave | El selector de **Parámetro** (Todos, Posición, Rotación, Recorte, Opacidad), el casillero **Máscara**, la navegación entre claves con los rótulos de VEGAS (primer fotograma clave, anterior, añadir, siguiente, último, eliminar), la tira con la escala de tiempos y la aguja, el tiempo del cursor, el recuento de claves y el zoom de la vista |
| Barra inferior | *Añadir clave aquí*, *Quitar clave*, *← Clave anterior*, *Clave siguiente →*, la posición dentro del evento y *Cerrar* (se queda pegada abajo aunque la columna se desplace) |

Los **números se escriben como en VEGAS**, con separador de millares y un decimal —`1,920.0`, `1,080.0`,
`960.0`, `540.0`—, y se acepta lo que se teclee con o sin separadores. Mientras el campo tiene el foco se
respeta el texto tal cual y al salir vuelve al formato de VEGAS; las flechas suben y bajan por el paso.

**Suavidad (%)** del grupo de interpolación decide cuánto se suaviza la curva *Suave* de las claves (0 % la deja
lineal y 100 % le da la curva en S completa) y se guarda en el evento (`keySmoothness`), así que también la
aplica el compositor. Las dos casillas de **Origen** son las de VEGAS: *Extender para rellenar f.* es un
interruptor de verdad (el material se escala hasta cubrir el fotograma sin deformarse, `stretchFill`, lo mismo
que la acción *Encajar el contenido al fotograma*) y *Mantener rel. de aspecto* también lo es, y es **la misma
casilla que la de las propiedades del evento**: viene puesta —el material conserva su proporción y deja bandas
negras donde no cuadra con el fotograma— y al quitarla el material se **estira hasta llenarlo**, aunque se
deforme. Sin medio (un generador de texto o de color) las dos salen bloqueadas, porque no hay nada que encajar.
En **Área de trabajo**, *Vista de zoom (%)*
agranda el fotograma **en el monitor** y *Densidad de cuadrícula (px)* dibuja una cuadrícula de referencia cada
tantos píxeles: son de la vista, no del encuadre (la escala del evento no se toca).

**Los preestablecidos propios se guardan en el proyecto** (`panCropPresets`, con su encuadre y su recorte), así
que viajan dentro del archivo `.corte15` y se validan al abrirlo; el botón de borrar pide la confirmación con el
texto exacto de VEGAS.

El grupo **Rotación** lleva el **centro de giro**: se escribe en píxeles del proyecto (`960` y `540` por defecto
en un proyecto 1920×1080), el monitor lo señala con un círculo que pasa por las esquinas de la caja, y hay dos
atajos para centrarlo o ponerlo en el centro del encuadre. Es el «Centro X/Y» del grupo Rotación de VEGAS; aquí
se llama *Centro de giro* para no confundirlo con el centro de la posición, y **viaja con las claves** (se
interpola entre ellas). **Área de trabajo** muestra el tramo de renderizado y su relación de aspecto, y ofrece el
botón *Recortar al área de trabajo*, que recorta el evento a esa relación.

Los campos de **Posición** van en píxeles del proyecto, como los de VEGAS: con el encuadre neutro la ventana
muestra `Anchura 1,920.0`, `Altura 1,080.0`, `Centro X 960.0` y `Centro Y 540.0` en un proyecto 1920×1080, y
siguen a la escala y al desplazamiento. Son la misma magnitud que *Escala* y *Posición X/Y (%)* expresada en
píxeles, así que cambiar una actualiza las otras. **Origen** informa del tamaño del medio, del fotograma del
proyecto y del monitor.

Diferencias que se mantienen a propósito respecto de VEGAS, y por qué: el recorte es de **cuatro márgenes
independientes** y se puede escribir por campos (VEGAS solo lo hace con las asas); el encuadre se guarda como
**una pose numérica** en el proyecto `.corte15`, así que no hay nodos de máscara que VEGAS pueda releer (eso va
por el puente, ver §5.2); la tira de claves no dibuja la curva de cada clave, se elige en *Interpolación de
fotogramas clave*; y el centro de giro no tiene su propio juego de claves separado del resto de la pose.

También conviene decirlo al revés, para no prometer de más: *Extender para rellenar f.* se llama como en VEGAS
pero aquí **nunca deforma** (cubre el fotograma recortando lo que sobra, en lugar de estirar la imagen), porque
la escala del motor es uniforme, y por eso no actúa con *Mantener rel. de aspecto* quitada —estirar deformando y
cubrir sin deformar son excluyentes, como en VEGAS—; la **selección de recorte** (que las esquinas recorten y
acompañen con un zoom uniforme, y que la rueda acerque la vista del monitor) es el gesto **pedido por el
usuario** y no se pudo contrastar con VEGAS en ejecución, así que no se afirma que VEGAS lo haga igual; y las
pistas de «Seguimiento de función» y «Suavidad» de la ventana de VEGAS 15 solo se replican en lo que se puede
comprobar (la suavidad de la curva), no hay seguimiento de movimiento.

**Movimiento de pista** (*Herramientas → Movimiento de pista…*) usa la misma ventana sobre la pista entera:
la mueve, la escala y la gira; no recorta, porque el recorte es de cada evento.

**La ventana es flotante**, como las de VEGAS: se abre ancha (1180×660 como mucho) y se puede colocar donde
quieras.

| Gesto | Qué hace |
|---|---|
| Arrastrar la barra de título, un borde o cualquier hueco libre de la ventana | La mueve; se agarra «casi por cualquier sitio», salvo los campos, los botones y el propio monitor |
| Arrastrar uno de los ocho tiradores de los extremos (cuatro lados y cuatro esquinas) | Cambia el tamaño: por la izquierda o por arriba el borde opuesto se queda quieto, y el mínimo es 460×320 |
| Doble clic en la barra de título, o el botón *Centrar* | La devuelve a su tamaño y posición de partida |
| `×` de la barra de título | Cierra la ventana (lo mismo que *Cerrar*) |

La ventana nunca se pierde: si cabe en pantalla se mantiene entera dentro de ella, y si es más grande que la
pantalla se ancla para que siempre quede un trozo a la vista. Al cambiar el tamaño de la ventana del navegador
se vuelve a meter en pantalla. Lo verifican tres flujos de navegador: «la ventana se organiza como la de
VEGAS» (parámetros a la izquierda y monitor a la derecha, los valores en píxeles del proyecto, el centro que
mueve el encuadre, la anchura que cambia la escala, el preestablecido de 1:1 que deja 21,875 % por lado, la
tira de claves que coloca el cursor y la barra inferior), «barra de herramientas, grupos plegables, candado y
centro de giro» (las seis herramientas, los siete grupos con los nombres de VEGAS, el candado que bloquea los
campos, el centro de giro que llega al modelo, el arrastre que gira y el que acerca, y el filtro de claves por
parámetro) y «la ventana flotante se mueve y se redimensiona» (mover por la barra, cambiar el tamaño por la
esquina y por el borde, mínimo respetado, topes de pantalla, recentrado y que el monitor siga respondiendo
después). La captura `evidencias/pancrop-vegas.png` la enseña tal como se abre.

**Aceleración de los fotogramas clave** (en la misma ventana de Panoramización y recorte). Cada clave lleva su
curva, que gobierna el tramo hasta la siguiente, tanto en la posición, la escala y el giro como en el recorte.
Son los seis modos de VEGAS 15 —**Lineal, Suave, Brusco, Mantener, Rápido y Lento**— y se eligen para la clave
en la que está el cursor, o de golpe con *Suavizar todas* y *Linealizar todas*. «Mantener» no interpola: deja
el valor quieto hasta la clave siguiente. No hay manejadores Bézier que se arrastren.

**Máscaras libres (trazados)** (en la misma ventana, sección *Máscara libre*). Pulsa **Dibujar máscara** y haz
clic sobre el monitor para ir poniendo puntos (hasta 64); arrástralos para moverlos y usa el **clic derecho**
para quitar uno. Con tres puntos ya recorta el evento. La **pluma** suaviza el borde (en píxeles del proyecto)
y **Invertir** perfora lo de dentro en lugar de quedarse con ello, así que la máscara sirve tanto para aislar
una figura como para dejarla fuera. El trazado se guarda en fracciones del fotograma, de modo que vale igual
en la vista previa y en la exportación, y se dibuja sobre el monitor mientras lo editas.

**Movimiento 3D** (en la misma ventana, sección *Movimiento 3D*). Los tres parámetros del 3D de VEGAS 15:
**Rotación X**, **Rotación Y** y **Distancia** al plano. El plano gira en el espacio y se proyecta con una
cámara de perspectiva (foco 1,5 anchos de fotograma), así que al girarlo sale un trapecio de verdad: el lado
que se acerca crece y el que se aleja se encoge. Con **Girar con el ratón** el arrastre horizontal gira sobre
Y y el vertical sobre X, con `Mayús` para ajustar fino. Vale igual para el evento y para la pista, y los
valores se interpolan con las claves como cualquier otro parámetro de la pose. La distancia, sola, no deforma:
solo acerca o aleja el plano mientras los giros estén a cero.

Cómo está hecho, porque no es obvio: el lienzo 2D solo sabe de transformaciones afines, y un giro sobre X o Y
no lo es. El editor calcula la proyección exacta de las cuatro esquinas y después escribe el resultado píxel a
píxel invirtiendo el mapeo proyectivo (con muestreo bilineal del origen), así que no hay costuras de rejilla
ni aproximaciones por celdas. El coste es lineal en el área del fotograma: unos 12 ms a 640×360 y unos 103 ms
a 1080p por evento girado, medidos en `outputs/probe-3d-rendimiento.ts`.

**Edición de precisión** (menú *Editar* y teclado). Con la selección hecha:

| Atajo | Qué hace |
|---|---|
| `Alt` + `←`/`→` | **Deslizar el contenido** (*slip*, lo que VEGAS llama «Deslizar todas las tomas»): mueve el material dentro del clip sin moverlo de sitio ni cambiar su duración, y respeta los límites del archivo |
| `Ctrl/Cmd` + `Alt` + `←`/`→` | **Desplazar el evento** (*slide*): lo mueve y los vecinos que lo tocan estiran o encogen su borde, de modo que no queda hueco ni se pisa nada |
| `Alt` + `Mayús` + `←`/`→` | **Recortar hasta el cursor con rizo**: se come la cabecera (o la cola) hasta el cursor y adelanta lo que venía después; si la animación queda cortada, el valor del punto de corte se guarda como primera clave para que no dé un salto |

El **rizo** (el *Auto Ripple* de VEGAS, en la barra inferior) se aplica ahora también al **mover** un evento
arrastrándolo y al **pegar**, no solo al insertar, recortar y borrar.

## 5.6 Mezclador, buses y envolventes de audio

**La forma de onda de los eventos de audio** (ronda 23). Cada evento de audio dibuja su onda como una **silueta
rellena y simétrica** alrededor de la **línea del cero**, con el contorno repasado y el trazo en 1 px real
(`vector-effect: non-scaling-stroke`), en el color claro del evento sobre su color de fondo: es lo que la hace
legible de un vistazo, como la de VEGAS. El detalle se calcula **para lo que se ve**:

- el número de columnas sale del **ancho que ocupa el evento en pantalla** (una por píxel, entre 24 y 4 000), no
  de una constante;
- cada columna se queda con el **mayor valor absoluto** de las muestras que caen dentro de su tramo, no con la
  muestra más cercana, así que al alejar no se pierden los picos y al acercar no aparecen escalones;
- los picos se leen de las **muestras decodificadas** del material (detalle real a cualquier zoom) y, si el
  proyecto se abre sin el archivo, de la **copia de picos** que viaja dentro del `.corte15`; el componente dice de
  dónde salió en `data-waveform-source`;
- el tramo que se mira respeta el **recorte** (`offset`), la **velocidad** y la **inversión** del evento, y si el
  evento dura más que el material la parte que no existe se dibuja en silencio (que es lo que suena).

Antes eran **240 columnas fijas** leyendo el pico más cercano de una copia de 240 picos por archivo: un evento
ancho salía en bloques y un trozo de un archivo largo salía como una raya plana. Ahora la copia guardada tiene
**1 024 picos** (redondeados a tres decimales, unos 7 kB por medio) y el detalle del zoom lo pone el sonido.
**La misma onda la usa el trimmer** (con su color azul y su resolución de panel), así que el material de origen y
el evento se ven igual. `lib/editor/waveform.ts` tiene la aritmética (con 5 pruebas unitarias) y
`components/editor/audio-waveform.tsx` el dibujo (lo comparten la línea de tiempo y el trimmer); el E2E comprueba
las columnas, la procedencia, la línea del cero, la simetría de la silueta y que al acercar aparecen más alturas
distintas y se ven las pausas. Las capturas `evidencias/onda-audio.png` y `evidencias/onda-trimmer.png` las
enseñan.

**Mezclador** (*Ver → Mezclador…*, o el botón *Mezclador* de la barra inferior). Una tira por bus y por pista
de audio, más el maestro, con nivel, panorama, silencio y solo. El orden de la señal es el de VEGAS:
**evento → pista → bus → maestro → limitador**, y el solo de una pista o de un bus deja fuera a lo demás. Los
buses se añaden y se quitan desde la propia consola (se llaman Bus A, Bus B…), y cada pista elige a cuál va; si
no elige ninguno, va directo al maestro. La vista previa y la exportación usan **la misma** función de mezcla,
así que lo que suena es lo que se graba.

**Envolventes dibujables** (barra inferior: *Envolvente: Ninguna / Volumen / Panorámica*). Se dibujan sobre el
carril de la pista de audio, en las coordenadas de la línea de tiempo: **clic en la línea** añade un punto,
**arrastrarlo** lo mueve y el **clic derecho** lo quita. La envolvente se suma al fader de la pista (si la
bajás a −1 con el fader a la derecha, queda en el centro) y, fuera del primer y el último punto, se mantiene
el valor del extremo. Cada arrastre ocupa un solo paso del historial.

**Tomas de efectos** (en cada tira del mezclador, sección *Tomas*). Ocho efectos propios, con los nombres del
catálogo de VEGAS 15: **ecualizador de 3 bandas** (graves y agudos en estantería, medios en filtro de pico),
**compresor** (umbral, relación, ataque, relajación y ganancia de salida), **limitador** (relación infinita y
techo), **puerta de ruido**, **distorsión**, **retardo** (con realimentación y mezcla), **reverberación** y
**teléfono / radio**. Se añaden desde el desplegable, se ordenan con las flechas (el orden importa: se procesan
en cadena), se apagan con el botón de encendido y se quitan con la cruz. Las de la pista se aplican a lo que
suman sus eventos y **antes** del nivel y la panorámica; las del bus, a lo que le llega **antes** de su nivel.
El mismo código procesa la vista previa y la exportación, y el estado de los filtros, del compresor y del
retardo se conserva entre bloques, así que el sonido no cambia según cómo se trocee el audio.

**Medidores** (el panel *Master* a la derecha del monitor). Barras en escala de dBFS con **pico** y **pico
real** (interpolado entre muestras), **RMS**, **sonoridad en LUFS** según ITU-R BS.1770 con las puertas de
EBU R128, y un testigo de **recorte** que se enciende si algo llega al fondo de escala. Se reinician al
empezar la reproducción y vuelven al silencio al pausar.

> **La sonoridad es una aproximación.** Los coeficientes del filtro K son los de 48 kHz (en otras frecuencias
> de muestreo se reescalan) y el medidor no se ha contrastado con un medidor homologado ni con el banco de
> pruebas de EBU. El pico, el pico real y el RMS sí son exactos. La interfaz lo dice y la limitación está en
> §9.

> Las envolventes, los buses y las tomas de efectos también viajan en el proyecto `.corte15` y se validan al
> abrirlo: una pista no puede quedar enrutada a un bus que no exista, ni una toma tener parámetros imposibles.

## 5.7 Trimmer y edición de tres puntos

Con un medio seleccionado en *Medios de proyecto*, el botón de tijeras de la barra del panel (o *Ver →
Trimmer…*) abre el **trimmer**: el monitor del material de origen (o su forma de onda, si es audio), la barra
del origen para explorar, y las marcas de **entrada** y **salida** —con los campos en segundos, los botones
*Marcar entrada aquí* y *Marcar salida aquí*, o *Marcar todo*—.

Con el tramo marcado, dos formas de llevarlo a la línea de tiempo, en la posición del cursor:

| Botón | Qué hace |
|---|---|
| **Insertar en el cursor** | coloca el tramo y **corre** lo que venía después según el modo de rizo de la barra inferior (desactivado, pistas afectadas o todas) |
| **Sobrescribir en el cursor** | deja el hueco limpio: lo que hubiera en ese tramo se recorta por delante o por detrás, y si un clip lo cruza entero **se parte en dos** conservando su material |

Si el material tiene audio, el vídeo y su audio entran **vinculados** (agrupados, como al insertarlos con
doble clic). Las operaciones están en `threePointEdit` y `overwriteRange`, con 8 pruebas unitarias.

**Títulos y texto** (*Herramientas → Títulos y texto…*, para eventos de texto). Trae los parámetros del
plugin «Títulos & Texto de VEGAS» que tienen equivalente aquí: texto multilínea, fuente, tamaño, negrita y
cursiva, color, alineación, **punto de anclaje de 9 posiciones**, interlineado, seguimiento, ancho máximo
(ajuste de línea), **contorno** (grosor y color), **sombra** (color, desplazamiento y difuminado), **fondo**
(color, opacidad y margen) y **animación**. El monitor se repinta con la composición real: el mismo motor que
la exportación.

**Posiciones del texto** (la sección *Posición* de la misma ventana, añadida en la ronda 22). Trece posiciones
con nombre que eligen **a la vez** el punto de anclaje y el desplazamiento del evento, que es lo que deja el
texto donde dice el nombre: *Texto centrado*, *Subtítulo (centro abajo)*, *Arriba (centrado)*, *Arriba a la
izquierda*, *Arriba a la derecha*, *Centro a la izquierda*, *Centro a la derecha*, *Abajo (centrado)*, *Abajo a
la izquierda*, *Abajo a la derecha*, *Tercio inferior (centrado)*, *Tercio inferior a la izquierda* y *Tercio
inferior a la derecha*. Las cuatro más usadas son **botones de un clic** (marcados con `aria-pressed`, así que
la posición puesta se ve de un vistazo) y la lista *Todas las posiciones* las trae completas, agrupadas. El
**anclaje de cada posición se elige para que aguante cuando el texto crece**: arriba el bloque cuelga hacia
abajo (anclaje `top-*`), abajo crece hacia arriba (`bottom-*`) y en el centro se centra (`middle-*`), de modo
que *Arriba (centrado)* sigue empezando al 8 % del alto con una línea o con tres. Los márgenes son los del
pintado clásico (5 % a los lados, 8 % y 92 % de alto) y *Tercio inferior* deja el bloque terminando alrededor
del 64 %, el sitio del rótulo bajo. Los desplazamientos son fracciones del fotograma —la misma magnitud que
*Posición X/Y (%)* de Panoramización y recorte—, así que después se pueden afinar desde allí; cuando la
colocación no es ninguna de las trece, la ventana lo dice («Posición propia: 12 % a la derecha…») en vez de
fingir que es una de ellas. *Subtítulo (centro abajo)* es exactamente la posición que usa el generador de
subtítulos (`SUBTITLE_STYLE.offsetY`), y hay una prueba unitaria que lo comprueba para que no se separen. La
captura `evidencias/titles-posiciones.png` enseña la sección y el texto colocado abajo a la derecha.

Las animaciones son las cinco del plugin de VEGAS (**ninguna**, **fundido de entrada**, **desplazamiento hacia
arriba**, **desplazamiento hacia la izquierda** y **máquina de escribir**) más las de plantilla de redes:
**aparición con rebote (pop)**, **zoom de entrada**, **entrada desde abajo**, **entrada desde arriba**,
**rebote continuo**, **sacudida** y **karaoke palabra a palabra**. El rebote, el zoom y los deslizamientos
duran lo que tarde la entrada (con un tope de 0,6 s, para que un subtítulo no aparezca a lo largo de tres
segundos); el rebote y la sacudida no paran mientras el evento siga en pantalla.

**Plantillas de texto y subtítulos al estilo de CapCut** (la galería de la misma ventana). Dieciséis
plantillas en tres familias —**Redes (vertical)**, **Subtítulos** y **Títulos**— que cambian el aspecto y la
animación del evento de una vez: *TikTok clásico*, *Karaoke amarillo*, *Influencer (caja blanca)*, *Rebote*,
*Sacudida*, *Neón*, *Zoom de impacto*, *Subtítulo de cine*, *Subtítulo para redes*, *Subtítulo con caja*,
*Máquina de escribir*, *Deslizar sobre azul*, *Título de YouTube*, *Noticias (barra roja)*, *Cita (serif)* y
*Créditos finales*. Cada una fija **contorno** (grosor y color), **sombra** o **resplandor**, **caja de
fondo**, **color y color de resalte** (el del karaoke), **anclaje**, tamaños de letra pensados para un proyecto
de 1080 de alto (se escalan solos a la resolución del proyecto), interlineado, seguimiento, ancho máximo y
**animación**. Una plantilla no toca el texto, la duración ni el encuadre: eso es tuyo. Al elegir otra, el
estilo se reemplaza entero (no quedan restos de contornos ni de resaltes de la anterior), y en cuanto se
retoque un campo a mano la ventana dice «Estilo propio». El botón activo se marca con `aria-pressed`, así que
la plantilla puesta se ve de un vistazo. La captura `evidencias/titles-plantillas.png` enseña la galería.

### 5.5.1 Copiar y pegar los atributos de un evento

Es el *Copiar atributos de evento* / *Pegar atributos de evento* de VEGAS Pro 15: se lleva el **aspecto** de un
clip a otro sin tocar el material, los tiempos ni el nombre del destino. En el menú del clic derecho de
cualquier evento (también en un subtítulo) están **Copiar los efectos y el estilo**, **Pegar los efectos y el
estilo** y **Elegir qué atributos pegar…**; con el teclado, `Ctrl/Cmd+Mayús+C` y `Ctrl/Cmd+Mayús+V` sobre lo
seleccionado.

Lo que viaja, en nueve grupos (`lib/editor/attributes.ts`):

| Grupo | Qué lleva |
|---|---|
| Efectos de vídeo | La pila entera, con su orden, sus ajustes y su estado |
| Panoramización y recorte | Posición, escala, giro, opacidad y 3D, los fotogramas clave, el recorte de cuatro márgenes y la máscara libre |
| Títulos y texto (plantilla) | Fuente, tamaño, color, contorno, sombra, fondo, anclaje, animación y color de resalte: **el estilo y la plantilla, sin cambiar el texto** |
| Generador de medios | Tipo de generador, sus dos colores, ángulo y tamaño de celda |
| Color y correcciones | Brillo, contraste, saturación y tono |
| Fundidos de entrada y salida | Su duración, recortada si no cabe en el evento destino |
| Transición de entrada | La transición del evento |
| Velocidad | La velocidad de reproducción |
| Audio del evento | La ganancia y su envolvente |

Cada grupo se pega solo si el tipo de evento lo admite: los de texto no van a un vídeo, los de audio no van a
una imagen, y el encuadre y la velocidad no tienen sentido en un evento de audio (igual que VEGAS, que tampoco
ofrece Pan/Crop ahí). El diálogo *Elegir qué atributos pegar…* lista los grupos con su explicación, marca los
que no se pueden pegar y dice por qué («no se puede pegar en este tipo de evento» o «el evento copiado no tenía
esto»), y deja destildar lo que no quieras llevar. Pegar entra en el historial: `Ctrl/Cmd+Z` lo deshace.

Se comprueba con 6 pruebas unitarias (`tests/attributes.test.ts`: qué se copia, qué no —la identidad, el
material, los tiempos y el nombre—, el recorte de los fundidos al tamaño del destino, los grupos que no encajan
y el resumen) y un flujo de navegador que copia un clip con efecto y encuadre, lo pega en otro, comprueba que
el material y los tiempos del destino no se tocan y después pega **solo los efectos** en un tercer clip, que
conserva su encuadre neutro.

**Redimensionar desde la vista previa** (el monitor de *Vista previa de video*). Al seleccionar un evento en la
línea de tiempo —o una pista, si no hay evento— el monitor dibuja la caja de lo que se está viendo con sus
**ocho asas**, sin abrir ninguna ventana: arrastrar dentro mueve el encuadre, arrastrar un asa lo escala
dejando quieta el asa contraria y, con el botón *Recortar* de la caja (o manteniendo `Alt`), el asa recorta ese
lado. Los dos botones de la esquina del monitor cambian entre redimensionar y recortar, y la chapa de abajo
informa de la escala y del tamaño en píxeles del proyecto. Con fotogramas clave el cambio se guarda en la clave
del cursor, como en la ventana de Panoramización y recorte; sin ellos, en la pose del evento (o de la pista).

La geometría es **la misma** que la de la ventana de recorte: la caja es `contentBox` con la matriz de
`poseMatrix`, el escalado usa `dragScale`, que despeja el desplazamiento para que el ancla quede exactamente
donde estaba (con giro, con centro de giro y con recorte incluidos), y el recorte usa el mismo `dragHandle` que
las asas de la ventana. Se comprueba con 6 pruebas unitarias (`tests/preview-scale.test.ts`: el ancla quieta en
las ocho asas, los topes de escala, el arrastre nulo o degenerado, el giro y el centro de giro, y que el
recorte no se toca) y un flujo de navegador que escala, mueve, recorta y comprueba que con una clave el cambio
va a la clave.

**Modos de fusión por pista** (en las propiedades de la pista): normal, añadir, trama, multiplicar,superponer, oscurecer, aclarar y diferencia, aplicados con las operaciones de Canvas 2D.

**Transiciones de entrada** (pestaña *Transiciones*, o en las propiedades del evento). Diecinueve, con los
nombres del catálogo de VEGAS 15: **fundido lineal**, **lento** y **brusco**; **barridos** desde los cuatro
lados y **barrido con degradado**; **persianas** verticales, horizontales y venecianas; **tablero
cuadriculado**; **deslizar** desde los cuatro lados; **comprimir** desde la izquierda y la derecha; y
**remolino**. La transición de un evento *es su entrada*: dura lo que su fundido de entrada (al aplicarla se
le pone uno de un segundo si no tenía) y el clip que queda debajo se mantiene opaco mientras tanto, que es lo
que hace VEGAS. Se cambia o se quita desde las propiedades del evento. Las persianas y el remolino son
aproximaciones 2D de los originales en 3D, y el propio editor lo advierte al elegirlas.

**Pila de efectos de vídeo** (*Herramientas → Efectos de vídeo…*, o arrastrando desde la pestaña *Efectos de
video*). Cada evento tiene su propia pila, ordenable, con cada efecto encendido o apagado por separado. Los
diez efectos son los del catálogo de VEGAS 15 que se pueden resolver con fidelidad aquí: **desenfoque
gaussiano** (radio), **blanco y negro**, **sepia** e **invertir** (cantidad de fusión), **clave cromática**
(color, umbral y suavidad del borde), **pixelar** (tamaño de bloque), **espejo** (horizontal, vertical o
ambos), **borde** (grosor y color), **viñeta** (intensidad y color) y **centelleo** (radio y cantidad). El
desenfoque y el centelleo se apoyan en los filtros del lienzo; el resto se calcula píxel a píxel, que es más
lento pero exacto. Los efectos se aplican sobre los píxeles del propio evento, en su capa transparente, así
que la clave cromática deja ver lo que hay debajo en vez de ennegrecerlo.

**Generadores de medios** (pestaña *Generadores de medios*): además de *Títulos y texto*, hay **color
sólido**, **degradado de color** (con ángulo), **tablero cuadriculado** (con tamaño de celda), **patrón de
pruebas** (barras) y **textura de ruido**. Cada uno se crea como un evento de color y sus ajustes se cambian
en sus propiedades.

> **Un cambio de comportamiento, a propósito.** Antes, recortar un medio lo estiraba después para llenar el
> fotograma (recortar un 25 % hacía además un zoom de 2×). Ahora el recorte se aplica en el sitio y conserva
> la proporción del medio, que es lo que hacen las asas de recorte de VEGAS; para recuperar el encuadre
> anterior basta con poner la escala en `1/(1-2·recorte)`. Está comprobado en `tests/pancrop.test.ts`.

Comprobado con 20 pruebas unitarias nuevas (geometría, tipografía y composición) y 5 flujos de navegador en
`tests/parity.spec.ts`, además de la suite completa.

## 5.8 Subtítulos

Los subtítulos son **eventos de texto** en una pista «Subtítulos» (la primera de vídeo, así que se dibujan por
encima de todo) con **texto blanco y contorno negro**, para que se lean tanto sobre una escena oscura como
sobre una clara. Se crean de dos maneras:

1. **Desde la transcripción**: *Generar subtítulos* (Groq) los reparte en sus tiempos.
2. **Desde un archivo `.srt`**: se importa desde *Medios de proyecto* como un medio de subtítulos y, con doble
   clic, se coloca en la línea de tiempo en sus tiempos. (El botón *Descargar .srt* sigue bajando el archivo.)

Una vez en la línea de tiempo se mueven, se recortan y se les cambia el estilo como a cualquier texto: doble
clic abre sus propiedades y el editor de títulos.

> **Fallo corregido.** El desplazamiento `x`/`y` de un evento se aplicaba **dos veces** al texto (una en la
> matriz de composición y otra dentro del plan tipográfico), así que un subtítulo con `y = 0,34` —el que usa la
> transcripción— se pintaba *fuera* del fotograma y no se veía. Ahora el texto se coloca en coordenadas
> locales y la matriz hace el resto, igual que con los medios; hay una prueba de composición que lo comprueba
> (`tests/subtitles.test.ts`) y otra de navegador que lee los píxeles del monitor.

## 5.9 Quitar bandas negras, exportar marcadores y una salida por pista

Tres funciones que VEGAS Pro 15 no trae en su interfaz sino **como scripts instalados** en `Script Menu\`, y que
ahora están en Corte15. El análisis de la instalación y la evidencia están en `ANALISIS-VEGAS-REA.md`.

### Quitar bandas negras (`Remove Letterboxing.cs`)

El script de VEGAS mira **solo geometría**: la relación de aspecto del medio contra la del proyecto, y encaja la
caja del contenido (deformando la imagen). Aquí hay dos acciones basadas en él, en *Herramientas* y en el menú
del clic derecho de un evento de vídeo o imagen:

| Acción | Qué hace |
|---|---|
| **Quitar bandas negras** | Analiza los **píxeles** del medio (no la geometría) y recorta la banda negra de verdad: la que viene **incrustada en el archivo** (una película 2.35:1 dentro de un MP4 16:9, un clip con barras grabadas). Informa en la barra de estado de cuánto recorta por cada lado |
| **Encajar el contenido al fotograma** | Escala el contenido hasta que **cubra** el fotograma sin deformarlo; lo que sobra se sale del encuadre. Es la intención del script, sin la deformación |
| **Ajustar el contenido al fotograma** | La vuelta: encaja el contenido entero dentro del fotograma (escala 1:1 con el medio) |

Sin selección se aplican a **todos** los eventos de vídeo, como el script. La detección es determinista y se
prueba con fotogramas sintéticos (`tests/letterbox.test.ts`: bandas horizontales, laterales, las cuatro,
fotograma entero oscuro, bandas de un par de píxeles, gris frente a negro, bandas no uniformes y el tope del
45 % por lado del modelo de recorte), y el flujo de navegador la comprueba con **imágenes reales con bandas
incrustadas** (`tests/fixtures/bandas-horizontales.png` y `bandas-laterales.png`, generadas por
`outputs/generar-fixtures-bandas.mjs`): la banda de 30 px de 180 se recorta al 16,7 %, la lateral al 16,7 % y
una imagen sin bandas **no se toca**.

### Exportar los marcadores (`Export Chapters.cs` y `Export Regions as Subtitles.cs`)

*Archivo → Exportar los marcadores (capítulos y subtítulos)…* (también en el menú del clic derecho de la regla)
abre un diálogo con cinco formatos, la explicación de cada uno y una **vista previa** de las primeras líneas:

| Formato | Contenido |
|---|---|
| Lista de capítulos (TXT) | `HH:MM:SS:FF` y nombre, una línea por marcador |
| Capítulos para YouTube (TXT) | `0:00 Nombre`, el formato que YouTube reconoce en la descripción; si el primer marcador no está en cero se añade la marca `0:00` |
| Hoja de cálculo (CSV) | Cabecera `timecode,segundos,nombre` y una fila por marcador |
| Lista XML | `<Chapters><chapter ID Time-code Label/></Chapters>`, como el XML del script más el nombre |
| Subtítulos (SRT) | Cada marcador es un subtítulo desde su instante hasta el siguiente (el último, cinco segundos) |

Mejora respecto al script de VEGAS: su TXT y su CSV **pierden el nombre** del marcador (solo escriben la
posición) y su XML no lleva etiqueta; aquí los tres lo llevan. El timecode respeta el formato del proyecto
(sin descarte, con descarte o segundos). 6 pruebas unitarias (`tests/chapters.test.ts`) y un flujo de navegador
que crea tres marcadores, **descarga** los cinco formatos y comprueba el contenido de cada archivo.

### Una salida por pista de audio (`Render Audio Tracks.cs`)

En *Renderizar como… → Lote de renderizado* hay un botón **Añadir una salida por pista de audio**: añade un
trabajo WAV por cada pista de audio del proyecto, con el nombre de la pista en el archivo
(`proyecto--Audio Voz.wav`, y `[2]` si dos pistas se llaman igual). Al renderizar, cada trabajo silencia las
demás pistas de audio y deja audible solo la suya, así que sale un archivo por pista, como el script de VEGAS.
Las pruebas unitarias cubren la creación de los trabajos, los nombres y el proyecto aislado de cada trabajo
(`tests/batch.test.ts`), y hay un flujo de navegador que comprueba que la cola recibe exactamente un trabajo por
pista con su nombre.

## 5.10 El clic derecho del evento y la ventana «Propiedades», como los de VEGAS Pro 15

El menú del clic derecho sobre un evento y el diálogo «Propiedades» que abre su última entrada son ahora los de
VEGAS 15: se copiaron **los rótulos y el orden** de la tabla de cadenas en español del propio `vegas150.exe`
(idioma 1034; el método y los archivos están en `ANALISIS-VEGAS-REA.md` §6).

### El menú

En un **evento de vídeo** (recurso `POPUP_IDX_VIDEO_SURFACE`):

```
Abrir en recortadora
Seleccionar en lista de medios del proyecto
Editar medios generados...            (títulos y colores; en otros eventos sale apagado)
Efectos de medios...
Panoramización/recorte de evento de vídeo...
Efectos de evento de vídeo...
────────────
Cortar                 Ctrl/Cmd+X
Copiar                 Ctrl/Cmd+C
Pegar atributos de evento          Ctrl/Cmd+Mayús+V
Pegado selectivo de atributos de evento
────────────
Eliminar               Supr
Recortar               Ctrl/Cmd+T
Recortar principio     Alt+[
Recortar final         Alt+]
Dividir                S
────────────
Crear subclip          (apagado: esta versión no tiene subclips)
Invertir
────────────
Seleccionar eventos hasta el final    Z
────────────
Insertar/eliminar envolvente ▸
Congelar fotograma en el cursor
Progreso de transición ▸
Modificadores ▸
Toma ▸
Grupo ▸
Sincronizar ▸
Enlace sinc ▸
────────────
Propiedades...
```

En un **evento de audio** (`POPUP_IDX_AUDIO_EVENT`) el esqueleto es el mismo con lo propio del audio: *Abrir
medios principales en recortadora*, *Abrir en editor de audio*, *Efectos de evento de audio…*, y los submenús
**Modificadores** (Silencio, Bloqueo, Bucle, Invertir fase), **Corriente**, **Canales** (Ambos, Sólo izquierdo,
Sólo derecho, Combinar, Intercambiar) y **Normalizar**.

Un dato que cambió el diseño: **VEGAS no tiene una orden «Copiar atributos de evento»**. Su tabla de comandos
solo trae `Edit.PasteEventAttributes` (comprobado con el barrido de cadenas), así que en VEGAS se copia el
**evento** con «Copiar» y se pega su aspecto con «Pegar atributos de evento». Corte15 hace lo mismo: «Copiar»
deja también los atributos del evento copiado en el portapapeles de atributos, y `Ctrl/Cmd+Mayús+C` sigue
existiendo como atajo directo.

Las entradas que este motor no puede cumplir **no se esconden**: salen desactivadas y con el motivo en su pista
al pasar el puntero (Crear subclip, Toma, Enlace sinc, tiempo no real, editor de audio externo, Sensibilidad…),
que es lo que VEGAS hace con lo que no aplica al evento.

### Los submenús

`components/editor/workspace-menu.tsx` admite entradas con hijas. El panel se abre al pasar el puntero o con la
flecha derecha, se coloca a la derecha de su entrada y **se voltea a la izquierda** si no cabe en la pantalla, y
se sube si se sale por abajo. El teclado se mueve dentro del panel abierto.

### La ventana «Propiedades»

Su última entrada abre el diálogo con las **dos pestañas** de VEGAS 15:

| Pestaña | Contenido |
|---|---|
| Evento de vídeo | Nombre de toma activa · grupo **Modificadores** (Silencio, Bloqueo, Bucle, Mantener relación de aspecto, Reducir parpadeo de entrelazado) · **Re-muestreo** (Utilice el modo Re-muestreo de proyecto / Forzar re-muestreo / Deshabilitar re-muestreo) · Ajustarse a la velocidad de fotogramas del proyecto · Velocidad de reproducción · Veloc. de inframuestreo (fps) · Invertir el material |
| Medios | Nombre de archivo · Nombre de cinta · Código de tiempo · grupo **Propiedades de reproducción** (Corriente, Formato, Atributos, Velocidad de fotogramas, Orden de campos, Relación de aspecto del píxel, Canal Alfa, Color de fondo, Espacio de color y Duración) |

Cada interruptor dice **qué hace aquí** en el botón *¿Qué aplica el motor de cada interruptor?*. Solo uno no se
puede cumplir entero: *Reducir parpadeo de entrelazado* es una mezcla vertical de tres tomas, no el algoritmo de
VEGAS. *Mantener relación de aspecto* sí lo aplica el compositor desde la ronda 20: viene **puesta** —el material
conserva su proporción y deja bandas donde no cuadra con el fotograma— y **quitada se estira hasta llenarlo**,
aunque se deforme. Los demás también se aplican de verdad:

| Interruptor | Qué hace en el motor |
|---|---|
| Silencio | El mezclador salta el evento; si el silencio está en un evento de vídeo, calla también el audio enlazado de su grupo |
| Bloqueo | El evento no se arrastra, ni se recorta, ni se divide, ni se borra; cada intento lo explica en la barra de estado |
| Bucle | Si el evento dura más que el material, el material se repite hasta el final del evento |
| Invertir | El material se reproduce al revés dentro del evento (vídeo y audio) |
| Mantener relación de aspecto | Puesta (por defecto), el material se encaja dentro del fotograma conservando su proporción y deja bandas negras donde no cuadra; quitada, se estira hasta el rectángulo del recorte y cubre el fotograma entero, aunque se deforme |
| Re-muestreo / ajuste al fotograma | *Deshabilitar re-muestreo* y *Ajustarse a la velocidad de fotogramas del proyecto* piden el fotograma exacto del material, sin instantes intermedios |
| Veloc. de inframuestreo | Cuadricula el instante de origen a esa frecuencia (en fps) |
| Velocidad de reproducción | 0,25×–4×, ajustando la duración del evento y de su audio enlazado (el tono cambia: no hay time-stretch con tono preservado) |

**Aceptar** y **Cancelar** son los de VEGAS: los cambios se ven al momento en la vista previa y *Cancelar*
devuelve el evento —y los eventos enlazados con él, porque los interruptores se aplican al grupo— a como estaban
al abrir la ventana. Debajo queda una sección rotulada **Extras de Corte 15** con los campos que VEGAS no tiene
en esa ventana (inicio, duración, fundidos, ganancia, Pan/Crop numérico, color), para que la parte replicada y la
propia se distingan a simple vista.

## 6. Pruebas

```sh
npm test                      # 281 pruebas unitarias y de integración (motor, composición, audio, forma de onda, efectos, bucle, lote, plantillas, posiciones del texto, interruptores del evento y APIs)
npm run test:browser          # 73 flujos reales por motor (Playwright; arranca el servidor solo)
npm run test:browser -- --project=chrome
npm run test:capabilities     # informe de APIs y códecs por motor + medición de renderizado
npm run test:perf             # rendimiento de la interfaz: reproduce, arrastra la aguja, hace zoom y espera al autoguardado (outputs/rendimiento-ui.json)
npm run capture:ui            # capturas del espacio de trabajo en evidencias/ + comprobación de que el pie no recorta controles
npm run fixtures              # regenera los medios de prueba con ffmpeg si faltan
npm run lint
```

Los medios de prueba (`tests/fixtures/`) se generan con ffmpeg: dos MP4 H.264 (uno con AAC), un WAV PCM y un
archivo corrupto con extensión `.mp4`. `@ffmpeg-installer/ffmpeg`, `@ffprobe-installer/ffprobe` y
`@napi-rs/canvas` son dependencias **de desarrollo**: solo se usan para generar medios, comparar píxeles en
las pruebas de composición y verificar la salida exportada. El editor en el navegador no las usa.

Resultados de la última ejecución y su interpretación: [VERIFICACION.md](VERIFICACION.md).

## 7. Compatibilidad real por motor

La detección es por capacidades, no por nombre de navegador: el editor comprueba si existen los códecs antes
de ofrecer un formato. Estado observado en las pruebas de este repositorio:

| Motor | Edición y composición | Exportación | Notas |
|---|---|---|---|
| Chrome (Windows) | Sí, verificado | MP4 H.264/AAC verificada con ffprobe | Motor de referencia |
| Edge (Windows) | Sí, verificado | MP4 H.264/AAC verificada con ffprobe | Mismo motor Chromium |
| Firefox (Windows) | Sí, verificado | WebM VP9/Opus verificada con ffprobe | No detecta AAC, así que ofrece WebM automáticamente |
| WebKit (Playwright) | Limitado: no importa MP4 | No disponible | Sin WebCodecs ni Web Audio en este binario; Safari real no se ha probado |

El informe `tests/diagnostics.spec.ts` imprime, por motor, las APIs presentes, los códecs detectados y el
resultado real de importar cada archivo de prueba.

## 8. Privacidad

- Los archivos se leen con la API de archivos del navegador y se procesan en la pestaña.
- La caché opcional vive en IndexedDB del propio navegador.
- No hay servidor de procesamiento, ni subida de medios, ni telemetría.
- El proyecto descargado es un archivo local.

## 9. Limitaciones conocidas

Enumera lo que **no** está resuelto, sin adornos; el detalle está en [FEATURES.md](FEATURES.md) y
[VERIFICACION.md](VERIFICACION.md). En resumen: **no hay lectura de `.veg` sin VEGAS** (contenedor propietario
sin especificación; con el puente lo entrega el propio VEGAS, y sin él la vía es exportar XML o EDL desde
VEGAS, ver §5.1) ni plugins nativos; la velocidad cambia el tono del audio; la exportación se retiene en
memoria (hay límite de 256 MB) y no hay renderizado en segundo plano; de la composición 3D ya están los giros
sobre X e Y y la distancia, pero faltan los manejadores Bézier que se arrastran. La composición 3D es la
proyección de un plano: no hay objetos, luces ni sombras. En el audio hay ocho tomas de efectos propias, pero
**no se cargan complementos VST ni OFX** (son binarios de terceros y el navegador no los ejecuta) y **no hay
audio multicanal 5.1**. La sonoridad del medidor sigue el método de BS.1770 con las puertas de EBU R128, pero
**es una aproximación**: no se ha contrastado con un medidor homologado ni con el banco de pruebas de EBU. El
timecode implementa los tres formatos de SMPTE con la aritmética de descarte de la norma, pero **no está
contrastado con el manual de VEGAS 15**: la interfaz no declara paridad con los nombres de su menú.

Además, y de forma explícita: **la comparación visual con la captura de VEGAS Pro 15 sigue pendiente** porque
esa imagen no estaba disponible en la sesión de trabajo; no se declara paridad visual. Tampoco se ha probado
en macOS, Linux ni Safari reales: las conclusiones sobre WebKit corresponden al binario de Playwright.

## 10. Aviso

"Corte 15" es un nombre provisional para un ejercicio de ingeniería. VEGAS es una marca de sus titulares;
este proyecto no usa su código, sus recursos gráficos ni sus formatos propietarios.

## 11. Licencia

Sinaloa Pro se distribuye bajo la **GNU General Public License, versión 3 o posterior**
(`GPL-3.0-or-later`). El texto completo y vinculante está en [LICENSE](LICENSE).

Copyright © 2026 @andresibarrali.

En resumen:

- **Puedes** usar el editor para lo que quieras —también comercialmente—, estudiarlo, modificarlo y
  redistribuirlo, sin pedir permiso ni pagar nada.
- **Debes** conservar el aviso de copyright y la licencia, indicar los cambios que hagas y, si distribuyes
  una versión modificada, publicar su código fuente con esta misma licencia.
- **No puedes** convertirlo en software propietario ni entregar binarios sin el código fuente.

La licencia es copyleft: protege la libertad de quien recibe el programa, no la de quien quiera cerrarlo.
Las dependencias de terceros conservan sus propias licencias (MIT en su mayoría); sus avisos están en sus
respectivos paquetes y en `vendor/`.

