# Corte 15 — Fase 1: reconstrucción de arquitectura

Documento de arquitectura para desarrollo. **No hay código en este documento**: son contratos, responsabilidades,
diagramas y prioridades. La implementación de cada pieza vive en el repositorio y se referencia por módulo.

Fuentes de este documento:

1. El análisis de los artefactos de VEGAS Pro 15 (`ANALISIS-REA-VEG.md`, ronda 26: contenedor `.veg`, tabla de
   clases del serializador en el ejecutable, arquitectura de módulos del binario, automatización) y los informes
   anteriores (`ANALISIS-VEG.md`, `ANALISIS-VEGAS-REA.md`: cadenas y recursos de la instalación).
2. El estado real del código de Corte 15 (modelo, compositor, mezclador, exportación, intercambio, interfaz) y su
   matriz de funciones (`FEATURES.md`, `VERIFICACION.md`).
3. La documentación de VEGAS Pro 15 como *nombres* de la interfaz (no como especificación técnica).

Convención de cada afirmación, obligatoria en todo el documento:

| Marca | Significado |
|---|---|
| **[O]** | **Observado** en los artefactos proporcionados (bytes, cabeceras, cadenas, recursos). |
| **[I]** | **Inferencia** a partir de lo observado, con su motivo. |
| **[D]** | **Decisión de diseño** de Corte 15 (o del autor de este documento), con su justificación. |
| **[?]** | **No determinado**: falta el artefacto o la evidencia. Se dice en lugar de rellenarlo. |

---

## Índice

1. [Arquitectura del sistema](#1-arquitectura-del-sistema)
2. [Modelo de dominio](#2-modelo-de-dominio)
3. [Diagramas](#3-diagramas)
4. [Contratos de datos](#4-contratos-de-datos)
5. [Especificación funcional por componente](#5-especificación-funcional-por-componente)
6. [Prioridades, fases y trazabilidad](#6-prioridades-fases-y-trazabilidad)
7. [Riesgos, deudas y lo que queda por verificar](#7-riesgos-deudas-y-lo-que-queda-por-verificar)
8. [Anexos](#8-anexos)

---

## 1. Arquitectura del sistema

### 1.1 Contexto: tres planos y un solo proceso

VEGAS Pro 15 se reparte en **tres planos** que el análisis de los artefactos permite separar con evidencia:

| Plano | Qué es | Evidencia |
|---|---|---|
| **Anfitrión** | `vegas150.exe`: interfaz, comandos (`File.Open`, `File.RenderAs`…), diálogos, scripting (`ScriptPortal.Vegas`), 5 518 recursos | **[O]** PE32+ x64, 24 DLL importadas, 2 240 funciones, `VS_VERSIONINFO` «VEGAS Pro 15.0 (Build 177)» |
| **Motor** | `vegas150k.dll` (981 funciones): modelo del proyecto, línea de tiempo, composición, mezcla, render, preferencias XML | **[O]** importaciones del ejecutable; **[?]** su interior (no se proporcionó la DLL ni hay desensamblador) |
| **Formatos** | `.veg` (proyecto binario con contenedor tipo RIFF y clases GUID), XML/EDL (intercambio), WAV/MP4/WebM (medios), RTF y XML embebidos (títulos y parámetros) | **[O]** cabecera, bloques, clases, cadenas y XMP del `.veg`; **[O]** filtros `*.veg;*.vf` y el volcado CSV de propiedades de evento en el ejecutable |

**Decisión de arquitectura D1 — el proceso es el navegador.** Corte 15 no reproduce la separación
anfitrión/motor en dos procesos ni en DLL: el «motor» son módulos TypeScript puros más Canvas 2D y Web Audio, en
la misma pestaña. Motivo: es la única forma de que el producto funcione sin instalación y de que **lo que se ve y
lo que se exporta salgan del mismo código** (ver D2). Consecuencia aceptada: la interfaz y el motor comparten hilo
y hay que cuidar el reparto (capítulo 5.18 y la ronda 25 de `VERIFICACION.md`, que bajó el p95 de la reproducción
de 83,4 ms a 16,8 ms con quince eventos).

**Decisión D2 — un solo camino de composición y de mezcla.** La vista previa y la exportación llaman a las mismas
funciones (`compose` y `mix`); sólo cambian la resolución, la calidad y el reloj. Motivo: evitar la clase de
defectos más caro de un editor (lo que ves no es lo que se graba) y poder verificar la exportación con las mismas
pruebas de píxeles y de muestra. Es un invariante del sistema, no una optimización.

### 1.2 Capas y reglas de dependencia

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ 8. Anfitrión / presentación      components/editor/*, app/*                   │
│    React + DOM. Sólo habla con 7. No contiene matemáticas del medio.           │
├───────────────────────────────────────────────────────────────────────────────┤
│ 7. Aplicación / comandos         editor.tsx (despacho de comandos), batch.ts   │
│    Orquesta casos de uso; es el único que conoce historial y diálogos.        │
├───────────────────────────────────────────────────────────────────────────────┤
│ 6. Servicios de plataforma       media.ts, storage.ts, veg-bridge.ts,         │
│    (adaptadores del navegador)   pexels.ts, speech.ts                         │
│    Detrás de estos contratos: File, IndexedDB, fetch, WebCodecs, Web Audio.    │
├───────────────────────────────────────────────────────────────────────────────┤
│ 5. Intercambio y persistencia    validation.ts, interchange.ts, veg.ts        │
│    Bordes del sistema: validan, convierten y **declaran lo que no entienden**. │
├───────────────────────────────────────────────────────────────────────────────┤
│ 4. Motores de salida             compositor.ts, export.ts, audio.ts,          │
│                                  audio-effects.ts, meter*.ts                 │
│    Lado a lado: vista previa y exportación usan los mismos motores (D2).       │
├───────────────────────────────────────────────────────────────────────────────┤
│ 3. Dominio (lógica pura)         project.ts, pancrop.ts, crop-frame.ts,        │
│                                  transitions.ts, effects.ts, titles.ts,       │
│                                  subtitles.ts, threed.ts, mask.ts,            │
│                                  letterbox.ts, keyframe-actions.ts,           │
│                                  timecode.ts, waveform*.ts, templates.ts,     │
│                                  text-presets.ts, text-positions.ts,          │
│                                  attributes.ts, chapters.ts, event-opacity.ts │
│    Sin DOM salvo Canvas por parámetro. Determinista. Con pruebas unitarias.    │
├───────────────────────────────────────────────────────────────────────────────┤
│ 2. Modelo de datos               project.ts (tipos Project/Track/Event/…)     │
│    Tipos y constructores. Nada más sabe de nadie.                             │
├───────────────────────────────────────────────────────────────────────────────┤
│ 1. Primitivas                    tiempo (ticks), color, números, FPS          │
└───────────────────────────────────────────────────────────────────────────────┘
```

Reglas que un revisor debe poder comprobar:

- **R1 — dirección única.** Una capa nunca importa de una capa superior. `lib/editor/*` no importa de
  `components/*`. (Comprobable con una regla de lint de importaciones.)
- **R2 — el dominio no toca el navegador.** La capa 3 no usa `document`, `window`, `File`, `AudioContext` ni
  `fetch`; recibe Canvas u otros recursos por parámetro. Así se prueba con `node:test` sin navegador, que es como
  están escritas las 335 pruebas actuales.
- **R3 — lo que se guarda es de la capa 2.** El `.corte15` serializa el modelo (`Project`) y **nada** de la capa 6
  (un `File`, un decodificador o un `AudioContext` nunca se persisten).
- **R4 — todo borde valida y declara.** Lo que entra por un borde (archivo, red, `localStorage`) pasa por
  `validation.ts` o por el análisis de `interchange.ts`, y el resultado incluye **lo que se ignoró**.
- **R5 — el tiempo es entero.** En el modelo no hay segundos en coma flotante: hay ticks (capítulo 2.5). Los
  flotantes existen en la presentación y en la composición, nunca en la identidad de un instante.
- **R6 — efectos y transiciones son datos.** Un efecto es un registro con `kind` de un catálogo cerrado; añadir
  uno nuevo es añadir una entrada al catálogo y su función de aplicación, no un tipo nuevo en el modelo.
- **R7 — el historial no es parte del modelo.** `History` envuelve al modelo; ninguna función de la capa 2 ó 3
  conoce que existe deshacer.

### 1.3 Inventario de subsistemas

| # | Subsistema | Frontera (contrato) | Estado |
|---|---|---|---|
| S1 | **Modelo y persistencia** | `Project` ↔ `.corte15` (validado, versionado) | ✅ |
| S2 | **Decodificación de medios** | `Media` (registro) + `MediaLibrary` (runtime) | ✅ |
| S3 | **Composición de vídeo** | `compose(canvas, project, library, tick)` | ✅ |
| S4 | **Audio y mezcla** | `mix(project, library, desde, muestras)` + `PlaybackAudio` | ✅ |
| S5 | **Intercambio y puentes** | `.veg` (lectura/análisis + puente), FCPXML/EDL, `.veg` real por scripting | 🟡 (`.veg` binario: sólo lectura y declarada; puente ✅) |
| S6 | **Interfaz y espacio de trabajo** | ventanas, atajos, menús, arrastres | ✅ |
| S7 | **Exportación y lote** | `renderProject` + cola de trabajos | ✅ |
| S8 | **Automatización** | ScriptPortal (VEGAS real) / herramientas locales / WebMCP | 🟡 |

### 1.4 Flujo de datos (resumen)

```
                       ┌──────────────┐   importa    ┌────────────────────────┐
   archivo del usuario →│ S2 medios    │─────────────→│ Media (registro)       │
   (MP4/WAV/PNG/SRT)    │ decodifica   │              │ RuntimeMedia (caché)   │
                       └──────────────┘              └───────────┬────────────┘
                                                                 │ referencia
   ┌───────────────────────────────────────────────────────────  ▼  ───────────┐
   │  Project (S1)                                                             │
   │  tracks[] · events[] · media[] · buses[] · master · markers · region      │
   │  loopRegion · panCropPresets · fps · sampleRate · width · height          │
   └───────┬─────────────────────────┬──────────────────────────────┬──────────┘
           │ (historial: instantáneas)│                              │
           ▼                         ▼                              ▼
     ┌───────────┐            ┌─────────────┐                ┌──────────────┐
     │ S1 guarda │            │ S3 compone  │◄── tick ───────│ S7 exporta   │
     │ .corte15  │            │ (Canvas)    │                │ fotograma a  │
     │ valida    │            │             │                │ fotograma    │
     └───────────┘            └──────┬──────┘                └──────┬───────┘
                                     │ monitor                      │ VideoEncoder
                                     │                              ▼
                              ┌──────▼──────┐                ┌──────────────┐
                              │ S6 interfaz │                │ Blob MP4/WebM│
                              └─────────────┘                │ Blob WAV     │
                                                             └──────────────┘
                                     ▲
   ┌─────────────┐   tick   ┌───────┴───────┐   muestras   ┌──────────────┐
   │ S4 mezcla   │◄─────────│ PlaybackAudio │─────────────→│ AnalyserNode │
   │ evento→pista│          │ (Web Audio)   │              │ + medidores  │
   │ →bus→maestro│          └───────────────┘              └──────────────┘
   └─────────────┘
```

El detalle por flujo está en el capítulo 3.

### 1.5 Decisiones de arquitectura (registro)

| Id | Decisión | Motivo | Consecuencia |
|---|---|---|---|
| **D1** | Un solo proceso (navegador), sin DLL ni hilos propios | producto instalable en cero | cuidar el reparto del hilo (§5.18) |
| **D2** | Vista previa y exportación comparten `compose` y `mix` | «lo que ves es lo que se graba» | el render de exportación es más lento que uno especializado; se compensa con calidad seleccionable |
| **D3** | Tiempo en ticks enteros (705 600 000/s) | 24, 25, 29,97, 30, 50, 59,94, 60 y 48 000 dividen exacto; sin error acumulado | conversión sólo en bordes (`ticks`/`seconds`) |
| **D4** | La **línea de tiempo no se persiste**: es una proyección ordenada de `Project` | una sola fuente de verdad; sin estados duplicados | los índices por pista/tiempo son cachés con invariantes (§5.3) |
| **D5** | Efectos y transiciones como **datos** de catálogo cerrado | serializables, validables, probables con píxeles | el catálogo crece por tabla, no por tipo |
| **D6** | El `.veg` binario es **de sólo lectura honesta** (analiza y declara lo que no entiende); la escritura va por el **puente de scripting de VEGAS** | el motor que interpreta los campos no está disponible y no hay desensamblador (**[?]**, §7) | un `.veg` no se genera a mano en Fase 1 |
| **D7** | Historial por **instantáneas** del proyecto, una entrada por gesto | simple y correcto con un modelo inmutable | memoria O(gestos × tamaño); se acota con un tope |
| **D8** | Un borde, un informe: toda importación devuelve *lo leído* y *lo ignorado* | no prometer montajes a medias | el informe es parte del contrato de intercambio (§4.8) |
| **D9** | El motor aplica **lo que puede comprobar**; lo que no, se anota y se dice en la interfaz | coherencia con la regla del proyecto | algunos interruptores del modelo son «anotados» y así se documentan |

---

## 2. Modelo de dominio

### 2.1 Entidades, objetos de valor y derivados

| Elemento | Tipo | Identidad | Persistido | Se construye en |
|---|---|---|---|---|
| **Project** | entidad raíz | `name` (no es identidad, es rótulo) | sí | `newProject()` |
| **Track** | entidad | `id` (uuid) | sí | `newTrack(kind, name)` |
| **Event** | entidad | `id` (uuid) | sí | `newEvent(trackId, kind, start, duration)` |
| **Media** | entidad | `id` (uuid) | sí | `MediaLibrary.import(file)` |
| **Keyframe** | entidad dependiente | (instante dentro del evento) | sí, dentro del evento | `upsertKey()` |
| **VideoEffect** | entidad dependiente | `id` | sí, dentro del evento | `defaultEffect()` |
| **AudioEffect** | entidad dependiente | `id` | sí, dentro de pista o bus | `defaultAudioEffect()` |
| **AudioBus** | entidad | `id` | sí | `newBus(name)` |
| **Marker** | entidad dependiente | `id` | sí | comando «Añadir marcador» |
| **PanCropPreset** | entidad dependiente | `name` (único) | sí | ventana de recorte |
| **Transform** | objeto de valor | — | sí (dentro de evento/pista/clave) | `transform()` |
| **CropMask** | objeto de valor | — | sí | `noCrop()` |
| **CropFrame** | objeto de valor | — | sí (**en curso**) | `defaultCropFrame()` |
| **MaskPath** | objeto de valor | — | sí | `newMaskPath()` |
| **Generator** | objeto de valor | — | sí (evento de color) | `generator(kind)` |
| **TransitionKind** | enumeración | — | sí (transición de entrada) | catálogo |
| **FPS** | objeto de valor | — | sí | `{num, den}` |
| **TimeRange** | objeto de valor | — | sí (tramo y bucle) | `normalizeRange()` |
| **ExportSettings** | objeto de valor de sesión | — | no | diálogo de exportación |
| **Interchange** | resultado | — | no | `parseInterchange()` |
| **Timeline** | **proyección derivada** | — | **no** (D4) | índices en memoria |
| **RenderPipeline** | proceso | — | no | `renderProject()` |

### 2.2 Project

Unidad de persistencia: todo lo demás cuelga de aquí.

| Campo | Tipo | Unidad / rango | Obligatorio | Notas |
|---|---|---|---|---|
| `format` | literal `"corte15"` | — | sí | discriminante del archivo |
| `version` | entero `1` | — | sí | versión del esquema; una migración por versión |
| `name` | texto | — | sí | rótulo del proyecto y del `.corte15` |
| `width`, `height` | entero | px, 16–7680 / 16–4320 | sí | fotograma del proyecto |
| `fps` | `FPS` | de la lista soportada | sí | 24, 25, 30, 50, 60, 24000/1001, 30000/1001, 60000/1001 |
| `sampleRate` | entero | 44 100 ó 48 000 | sí | **[O]** VEGAS guarda 48 000 en la cabecera del `.veg` |
| `tracks` | lista de `Track` | ≥ 0 | sí | orden = orden visual (el primero es el de arriba) |
| `events` | lista de `Event` | ≥ 0 | sí | orden libre; el orden visible lo da el índice |
| `media` | lista de `Media` | ≥ 0 | sí | referencias a archivos, sin contenido |
| `markers` | lista | ≥ 0 | sí | nombre + tick |
| `region` | `TimeRange` ó nulo | inicio < fin | sí | tramo de renderizado |
| `loopRegion` | `TimeRange` ó nulo | inicio < fin | sí (opcional en el archivo) | independiente del tramo |
| `buses` | lista de `AudioBus` | ≤ 26 | opcional | A–Z |
| `master` | `{gain, pan}` | ganancia 0–2, pan −1…1 | opcional | neutro: 1 y 0 |
| `timecodeFormat` | `non-drop` / `drop-frame` / `seconds` | — | opcional | sólo presentación |
| `panCropPresets` | lista de `PanCropPreset` | ≤ 32 | opcional | viaja en el archivo |

Responsabilidad: **ser la verdad única** del montaje. Nada derivado se guarda (D4).

Invariantes: **I1** identificadores únicos en su colección; **I2** todo `event.trackId` existe; **I3** `fps` en la
lista; **I4** `sampleRate` soportado; **I5** rangos bien formados (`start < end`); **I6** todo `track.busId`
referencia un bus existente; **I7** los nombres de `panCropPresets` son únicos.

### 2.3 Track

| Campo | Tipo | Unidad / rango | Notas |
|---|---|---|---|
| `id` | uuid | — | |
| `name` | texto | — | «Video», «Audio», «Títulos», «Subtítulos»… |
| `kind` | `video` \| `audio` | — | un evento de vídeo no puede vivir en una pista de audio (I8) |
| `mute`, `solo` | booleano | — | el solo de una pista silencia a las demás (S4) |
| `gain` | número | 0–2 (lineal) | nivel de la pista; el de audio admite envolvente |
| `pan` | número | −1…1 | panorámica; idem |
| `height` | entero | 60–220 px | sólo presentación, se guarda para conservar la vista |
| `transform` | `Transform` | — | transformación de toda la pista (§2.8) |
| `composite` | `CompositeMode` | 8 modos | modo de fusión de la pista |
| `busId` | uuid opcional | — | enrutado al bus |
| `volumeCurve`, `panCurve` | lista de `AudioPoint` | ordenada por tiempo | envolventes dibujables |
| `inserts` | lista de `AudioEffect` | ≤ 16 | tomas de audio de la pista |

Invariantes: **I9** envolventes ordenadas y sin puntos duplicados; **I10** `inserts` con `kind` del catálogo.

### 2.4 Event

La entidad con más superficie del sistema. Se agrupa en cuatro bloques para poder hablarse de ella:

**(a) Identidad y tiempo**

| Campo | Tipo | Unidad | Notas |
|---|---|---|---|
| `id` | uuid | — | |
| `trackId` | uuid | — | I2 |
| `kind` | `video` \| `audio` \| `image` \| `text` \| `color` | — | determina qué se dibuja y qué controles aparecen |
| `mediaId` | uuid opcional | — | ausente en `text` y `color` |
| `name` | texto | — | rótulo del evento |
| `start` | tick | ≥ 0 | posición en la línea de tiempo |
| `duration` | tick | ≥ 1 fotograma | duración en la línea de tiempo |
| `offset` | tick | ≥ 0 | instante del material que se ve al principio |
| `speed` | número | 0,25–4 | velocidad; alarga o acorta el material consumido |
| `fadeIn`, `fadeOut` | tick | 0…`duration` | fundidos; la transición ocupa `fadeIn` |
| `gain` | número | 0–2 | ganancia del evento de audio |
| `gainCurve` | lista de puntos | ordenada | envolvente de ganancia del evento |

**[O]** Este bloque corresponde al volcado CSV del propio VEGAS (`"StartTime";"Length";"PlayRate";"FadeTimeIn";
"FadeTimeOut";"SustainGain";"CurveIn";"CurveOut"…`), que sirve de referencia semántica: el nombre cambia, el
significado no. **[?]** Cómo se codifican esos números en el `.veg` binario.

**(b) Modificadores (interruptores del evento)**

| Campo | Tipo | Default | Qué hace el motor | Equivalencia |
|---|---|---|---|---|
| `muted` | bool | falso | el mezclador salta el evento (y su audio enlazado) | **[O]** «Silencio» |
| `locked` | bool | falso | no se mueve, recorta, divide ni borra | **[O]** «Bloqueo» |
| `loop` | bool | falso | repite el material si el evento es más largo | **[O]** «Looped» |
| `reversed` | bool | falso | material al revés (`sourceTime`) | **[O]** «Invertir» |
| `maintainAspect` | bool (ausente = **true**) | puesto | puesta: encaja y deja bandas; quitada: estira (D9) | **[O]** «Mantener relación de aspecto» |
| `reduceFlicker` | bool | falso | mezcla vertical de tres tomas (aproximación, D9) | **[O]** «Reducir parpadeo…» |
| `stretchFill` | bool | falso | el material cubre el fotograma sin deformar | **[O]** «Extender para rellenar f.» |
| `resample` | `project`\|`force`\|`off` | `project` | qué fotograma de origen se pide | **[O]** los tres botones de re-muestreo |
| `conform` | bool | falso | pide el fotograma exacto del proyecto | **[O]** «Ajustarse a la velocidad de fotogramas» |
| `undersample` | entero | 0 | cuadricula el instante de origen a N fps | **[O]** «Veloc. de inframuestreo» |
| `invertPhase` | bool | falso | invierte el signo de las muestras | **[O]** «Invertir fase» |
| `channel` | `both`\|`left`\|`right`\|`combine`\|`swap` | `both` | reparto de canales | **[O]** «Canales ▸» |
| `keySmoothness` | 0–100 | 100 | suavidad de las claves «Suave» | **[O]** «Suavidad (%)» |

**(c) Encuadre y estilo**

| Campo | Tipo | Notas |
|---|---|---|
| `transform` | `Transform` | posición, escala, giro, opacidad, recorte uniforme, 3D, centro de giro, `cropFrame` |
| `mask` | `CropMask` opcional | recorte de cuatro márgenes (independientes) |
| `maskPath` | `MaskPath` opcional | máscara libre (polígono + pluma + invertir) |
| `effects` | lista de `VideoEffect` | cadena de efectos de vídeo |
| `generator` | `Generator` opcional | en eventos `color` |
| `transition` | `TransitionKind` opcional | transición de entrada (usa `fadeIn`) |
| `brightness`, `contrast`, `saturation`, `hue` | números | correcciones de color |
| `text`, `font`, `fontSize`, `color`, `align`, `bold`, `italic`, `lineSpacing`, `tracking`, `wrap`, `outlineWidth`, `outlineColor`, `shadow`, `background`, `anchor`, `animation`, `highlightColor` | varios | estilo del título (plugin «Títulos & Texto» **[O]** su lista de parámetros: `TextColor`, `AnimationName`, `Scale`, `Location`, `OutlineWidth`, `ShadowOffsetX/Y`…) |
| `videoOpacity` | número | opacidad de vídeo añadida en la ronda paralela (contrato en curso) |
| `group` | texto opcional | vínculo (audio ↔ vídeo) |

**(d) Fotogramas clave**

| Campo | Tipo | Notas |
|---|---|---|
| `keys` | lista de `Keyframe` | ordenada por `time`; instantes relativos al inicio del evento |

Invariantes: **I11** `duration > 0`; **I12** `start ≥ 0` y ambos cuantizados al fotograma del proyecto;
**I13** `fadeIn + fadeOut ≤ duration`; **I14** `keys` ordenadas, sin dos claves a menos de 1 tick, con
`0 ≤ time ≤ duration`; **I15** `mask` con cada margen ≤ 0,45 y cada par ≤ 0,9; **I16** `kind` compatible con la
pista; **I17** si `kind` es `video`/`image`/`audio`, `mediaId` existe en `media` (o el evento queda marcado como
«medio faltante», que es un estado válido y se dibuja como tal).

### 2.5 Timeline (proyección, no entidad)

**[D4]** La línea de tiempo **no se guarda**: se deriva de `Project`. La contrapartida —recalcular— se resuelve
con memorización por referencia, no con estado. Hoy existen estos derivados:

| Derivado existente | Contenido | Invariante |
|---|---|---|
| `endTime(project)` | último instante con contenido | determinista |
| `lockedIds`, `silencedIds`, `linkedIds` | conjuntos de comportamiento (bloqueo, silencio, vínculo de audio y vídeo) | coherentes con el grupo |
| `selectionRange(project, ids)` | rango de la selección | `start < end` |
| `keyAt`, `keysChanging` | clave en el cursor y claves relevantes por parámetro | I14 |
| `playbackSpan`, `inRange`, `rangeDuration` | bucle y tramo | I5 |

Y éstos son los que el contrato **pide crear** (estado 🟡, prioridad P1, §5.3):

| Derivado propuesto | Contenido | Se invalida cuando | Para qué |
|---|---|---|---|
| `eventsByTrack` | por `trackId`, ordenados por `start` | cambia `events` o `tracks` | dibujar una pista sin filtrar la lista completa |
| `eventsByTime` | eventos que cubren un tick | ídem | `compose(T)` y `mix(T)` sin recorrer todo (hoy se filtra la lista entera en cada fotograma) |
| `timelineLength` | `max(start+duration)` + margen | ídem | anchura de la regla |
| `mediaUsage` | qué eventos usan cada medio | ídem | borrar medios con seguridad y revincular |

Por qué no se persiste nada de esto: un solo lugar donde vive el montaje evita los estados duplicados (el defecto
clásico de este tipo de editores es tener «eventos en el modelo» y «eventos en la vista»). Todo derivado es
desechable: se puede tirar y recalcular sin pérdida.

### 2.6 Media

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `name`, `size`, `modified`, `mime` | varios | del archivo original |
| `kind` | `video`\|`audio`\|`image`\|`subtitle` | |
| `duration` | tick | del contenedor |
| `width`, `height` | px | del flujo de vídeo (0 si no hay) |
| `hasAudio` | bool | |
| `thumbnail` | data URL | miniatura de 160×90 |
| `peaks` | lista de 0…1 (1 024) | picos para la onda (**[D]** 1 024 desde la ronda 23) |
| `channelPeaks` | lista por canal | onda estéreo (contrato **en curso**) |
| `sourcePath` | texto opcional | ruta de origen, para revincular (**[O]** el `.veg` guarda rutas absolutas UTF-16) |
| `text` | texto opcional | contenido `.srt`/`.vtt` |

**RuntimeMedia** (no persistido): `file`, `input` (demuxer), `canvas` (decodificador de vídeo), `image`,
`pcm` (canales Float32 + frecuencia), `firstVideo`. La biblioteca es una caché con presupuesto explícito
(**256 MB** de PCM) y un error legible cuando se pasa.

### 2.7 Effects, Keyframes y Render Pipeline

**VideoEffect**: `id`, `kind` (10 del catálogo), `enabled`, y parámetros (`amount`, `size`, `color`, `softness`,
`horizontal`, `vertical`) con `EFFECT_PARAMS` declarando qué usa cada tipo. Invariantes: `kind` del catálogo;
parámetros normalizados al rango del tipo (**I18**).

**AudioEffect**: `id`, `kind` (8 del catálogo: `eq`, `compressor`, `limiter`, `gate`, `distortion`, `delay`,
`reverb`, `phone`), `enabled`, `amount`, `threshold`, `ratio`, `attack`, `release`, `makeup`, `time`, `feedback`,
`damping`, `low`, `mid`, `high`. Vive en **pista o bus**, nunca en el evento (**D**: la cadena de la señal es
evento → pista → bus → maestro).

**Keyframe**: `Transform` (todos sus números) + `time` (relativo al evento) + `mask` opcional + `curve`
(`linear`/`smooth`/`sharp`/`hold`/`fast`/`slow`). Reglas: la curva de una clave **gobierna el tramo hasta la
siguiente**; `hold` no interpola; la primera clave vale desde el principio del evento y la última hasta el final.

**RenderPipeline**: no es una entidad, es un proceso con contrato (§4.9): configuración (`ExportSettings`),
reloj de fotogramas, progreso, cancelación y resultado (`ExportResult`). Requirements: **determinismo** (el mismo
tick produce el mismo fotograma), **reanudable por tramo** (lote), **cancelable en menos de un fotograma** y
**medible** (fps de render y bytes).

### 2.8 Objetos de valor geométricos

**Transform** (pose de evento o de pista):

| Campo | Unidad | Neutro | Notas |
|---|---|---|---|
| `x`, `y` | fracción del fotograma | 0 | desplazamiento del centro |
| `scale` | factor | 1 | escala uniforme (el motor no admite escala libre sin `maintainAspect` quitado) |
| `rotation` | grados | 0 | giro sobre el centro de giro |
| `opacity` | 0–1 | 1 | |
| `crop` | fracción | 0 | recorte uniforme heredado (compatibilidad) |
| `rotationX`, `rotationY` | grados (−360…360) | 0 | 3D **[O]** «Movimiento 3D» |
| `depth` | 0,1–4 | 1 | distancia al plano |
| `pivot` | fracción | centro | centro de giro **[O]** «Rotación → Centro X/Y» |
| `cropFrame` | `CropFrame` opcional | — | **en curso**: rectángulo de origen con su giro y volteo (§4.6) |

**CropMask**: cuatro márgenes independentientes en fracción (0–0,45 cada uno).

**MaskPath**: puntos en fracción + `feather` (px) + `invert`.

**TimeRange**: `{start, end}` en ticks, semiabierto (`start ≤ t < end`).

### 2.9 Relaciones

```
Project 1───N Track 1───N Event 1───N Keyframe
   │            │  │        │  │
   │            │  │        │  └──N VideoEffect
   │            │  │        │
   │            │  │        ├──0..1 Media ──1──N (referencias desde eventos)
   │            │  │        ├──0..1 TransitionKind
   │            │  │        ├──0..1 CropMask
   │            │  │        ├──0..1 MaskPath
   │            │  │        └──0..1 Generator
   │            │  ├──0..1 AudioBus ──1──N AudioEffect
   │            │  ├──N AudioEffect (inserts)
   │            │  └──0..1 volumeCurve / panCurve (envolventes)
   │            ├──N Marker
   │            ├──0..1 region (tramo)
   │            ├──0..1 loopRegion (bucle)
   │            └──N PanCropPreset
   └──master (ganancia y panorama)
```

Cardinalidades que el diseño debe poder violar **sin corromper** nada: un evento sin medio (medio faltante), un
bus referenciado que se borra (I6 lo prohíbe: el borrado reasigna al maestro), una clave fuera del evento (I14).

---

## 3. Diagramas

### 3.1 Arquitectura general

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║ ANFITRIÓN (navegador)                                                         ║
║                                                                               ║
║  ┌─────────────────────────── S6 INTERFAZ ─────────────────────────────────┐  ║
║  │ barra de título · menús · barra de herramientas · paneles con pestañas  │  ║
║  │ monitor de vista previa · línea de tiempo (regla, pistas, eventos)       │  ║
║  │ ventanas flotantes: Propiedades · Panoramización/recorte · Títulos       │  ║
║  │ Trimmer · Mezclador · Efectos · Lote · Exportar                          │  ║
║  └───────┬─────────────────────────────────────────────────────┬───────────┘  ║
║          │ comandos (teclado, menús, arrastres)                 │ lectura      ║
║  ┌───────▼────────────── S7 APLICACIÓN ─────────────────────────▼───────────┐  ║
║  │ despacho de comandos · selección · historial (instantáneas) · diálogos   │  ║
║  └───┬───────────┬──────────────┬───────────────┬───────────────┬──────────┘  ║
║      │           │              │               │               │             ║
║  ┌───▼────┐ ┌────▼─────┐ ┌──────▼──────┐ ┌──────▼─────┐ ┌───────▼──────────┐  ║
║  │ S3     │ │ S4       │ │ S7          │ │ S5         │ │ S1               │  ║
║  │ compo- │ │ mezcla   │ │ exportación │ │ intercam-  │ │ modelo +         │  ║
║  │ sición │ │ + medidor│ │ + lote      │ │ bio        │ │ persistencia     │  ║
║  └───┬────┘ └────┬─────┘ └──────┬──────┘ └──────┬─────┘ └───────┬──────────┘  ║
║      │           │              │               │               │             ║
║  ┌───▼───────────▼──────────────▼───────────────▼───────────────▼──────────┐  ║
║  │ S2 MEDIOS (MediaLibrary: decodificadores, PCM, miniaturas, picos)      │  ║
║  └───┬───────────────────────────────┬──────────────────────┬─────────────┘  ║
║      │ WebCodecs (VideoDecoder,      │ Web Audio            │ Canvas 2D       ║
║      │ AudioDecoder) vía demuxer     │ (AudioContext)       │                 ║
╚══════╪═══════════════════════════════╪══════════════════════╪═════════════════╝
       ▼                               ▼                      ▼
   archivos del usuario          altavoces / medidores     píxeles del monitor
   (MP4/WAV/PNG/SRT)                                     y del archivo exportado
```

Puntos de control de esta arquitectura:

- **Un solo almacén de verdad** (`Project`) y un solo historial.
- **El monitor y el archivo beben de `compose`**; los altavoces y el WAV beben de `mix` (D2).
- **Todo lo que entra o sale del sistema pasa por S1/S5** con validación y informe.

### 3.2 Flujo de carga

```
A. Abrir proyecto propio (.corte15)
   archivo ─► leer texto ─► validar esquema (verso) ─► migrar por versión ─► Project
                                     │
                                     └─► error legible (campo, motivo) y no se abre nada a medias

B. Abrir proyecto de VEGAS (.veg binario)
   archivo ─► firma "riff" + clase 12 B ─► recorrer bloques (marca "list", clase, tamaño)
            ─► leer lo que se entiende: versión, muestreo, rutas de medios, nombres, XMP (si lo hay)
            ─► INFORME: lo leído / lo ignorado / lo que no se reconstruye
            ─► ofrecer importar los medios referenciados para revincularlos
   (la escritura de .veg NO se hace aquí: se delega en VEGAS por el puente, D6)

C. Abrir montaje por intercambio (FCPXML / EDL)
   archivo ─► detectar formato ─► analizar ─► mapas de pistas y eventos ─► Project
            ─► INFORME con avisos (fps, campos ignorados, medios que faltan)

D. Revincular un medio que falta
   evento con medio faltante ─► archivo nuevo ─► decodificar ─► comprobar duración/geometría
            ─► sí cuadra: sustituir; no cuadra: avisar y no tocar
```

Estados del proyecto en carga: `vacío → cargando → listo | error`. Ningún estado intermedio se guarda.

### 3.3 Flujo de render (vista previa y exportación)

```
ENTRADA: Project + tick T (vista)  |  Project + ExportSettings (archivo)
   │
   ├─ 1. Ventana temporal: eventos con start ≤ T < start+duration, agrupados por pista
   │     (índice por tiempo; sin recorrer la lista entera)
   ├─ 2. Por pista de vídeo, de abajo arriba:
   │     ├─ pose = pose(track.transform) · pose(event.transform o clave en T)
   │     ├─ contenido = dibujar el evento en una capa:
   │     │     · medio: recorte de origen (mask / cropFrame) → encaje o estirado → dibujo
   │     │     · texto: plan de líneas + animación → dibujo con contorno/sombra/fondo
   │     │     · generador: patrón (liso/degradado/tablero/barras/ruido)
   │     ├─ efectos (cadena) sobre la capa
   │     ├─ transición de entrada: mezcla contra lo de abajo según p = (T-start)/fadeIn
   │     ├─ máscara libre, parpadeo reducido, opacidad, corrección de color
   │     └─ fusión al fotograma con el modo de la pista
   ├─ 3. Audio (en paralelo conceptual): mix(T, muestras) → limitador → medidor
   └─ 4. Salida:
         · vista: canvas (con divisor de calidad) + medidores
         · archivo: VideoEncoder(fotograma) + AudioEncoder(PCM) + muxer → Blob
```

Detalles contractuales del pipeline: **bucle de fotogramas** con reloj por fps del proyecto y ámbito (completo o
tramo); **progreso** con fotogramas hechos/total, fps, transcurrido, restante y bytes; **cancelación** por señal
`AbortSignal` comprobada en cada fotograma; **determinismo**: el fotograma N de un render con los mismos ajustes
es idéntico entre ejecuciones (misma versión de código), condición necesaria para comparar píxeles en pruebas.

### 3.4 Flujo de reproducción y mezcla

```
PlaybackAudio.start(tick) ─► AudioContext.resume + origen de tiempo
bucle de animación:
   ahora = clock()
   schedule(project, library, fin): prepara 250 ms de audio por delante (hasta 0,65 s)
       por bloque: mix() → createBuffer(2, N) → BufferSource → AnalyserNode → destino
   lectura del medidor = pico/RMS/LUFS del bloque
   cursor = ahora  ─► aguja (por referencia) + monitor (compose) — sin re-render del editor (ronda 25)
fin de rango: si hay bucle, se rearma; si no, pausa
```

---

## 4. Contratos de datos

Convenciones de este capítulo (aplican a todo contrato):

- **Identificadores**: uuid v4 como texto. **Colecciones**: listas ordenadas, sin duplicados de `id`.
- **Tiempo**: entero en ticks, 705 600 000 por segundo. **Fracciones**: número 0…1. **dB**: número ≤ 0 o «−∞».
- **Opcional**: el campo puede faltar en el archivo; el consumidor aplica el valor neutro documentado. Un campo
  opcional **nunca** cambia de significado por estar ausente: se documenta el neutro.
- **Cambio incompatible**: sube `version` y hay migración explícita. Un archivo de versión mayor se rechaza con
  mensaje.
- **Prohibido en el modelo**: funciones, clases, referencias circulares, fechas como objeto, `NaN`/`Infinity`.

### 4.1 `.corte15` (persistencia)

Archivo JSON con la forma del §4.2 a §4.7. Contrato del borde:

| Aspecto | Regla |
|---|---|
| Detección | `format === "corte15"` |
| Validación | esquema completo (tipos, rangos, enums) antes de construir el dominio |
| Errores | mensaje con la ruta del campo y el motivo; no se abre parcialmente |
| Compatibilidad | `version` 1; migración declarada por versión |
| Tamaño | el archivo contiene **referencias** a medios, no medios; la copia de medios es opcional y aparte |

### 4.2 Project

Ver §2.2 (tabla de campos) + invariantes I1–I7. Añadidos de contrato:

- `tracks` ordenado de arriba abajo: el índice 0 es la pista superior del monitor.
- `events` **no** está ordenado por contrato: el orden es libre y no significa nada.
- Todo campo desconocido al leer **se ignora y se informa** (para no destruirlo al reescribir, el editor conserva
  el archivo original hasta el primer guardado).

### 4.3 Track

Ver §2.3. Añadidos: `composite` ∈ {`normal`,`add`,`screen`,`multiply`,`overlay`,`darken`,`lighten`,`difference`};
`height` es vista pero se persiste; `inserts` ≤ 16.

### 4.4 Event

Ver §2.4. Reglas adicionales de contrato:

| Regla | Detalle |
|---|---|
| `kind` ↔ `mediaId` | `video`/`image`/`audio` lo exigen; `text`/`color` lo ignoran |
| `text` define el evento | `kind: text` sin `text` es válido (título vacío) pero no visible |
| fundidos | `fadeIn`/`fadeOut` en ticks; si hay `transition`, ésta ocupa `fadeIn` |
| `group` | texto libre; los eventos con el mismo `group` se tratan como enlazados para los interruptores |
| `keys` vacío | el evento usa `transform` fijo |

### 4.5 Media y MediaLibrary

- `Media` (§2.6): metadatos puros, serializables, sin decodificadores.
- `MediaLibrary` (servicio): `import(file, id?) → Media` (decode + thumbnail + peaks), `replace(id, runtime)`,
  `dispose()`, y lectura de `RuntimeMedia` por id. Presupuesto de PCM: 256 MB; al superarlo, error explicado.
- Contrato de pico de onda: 1 024 valores 0…1 de 3 decimales (por canal si hay `channelPeaks`); el dibujo usa
  «el más fino de los dos» (picos guardados o muestras) según el ancho de columna.

### 4.6 Transform, CropMask, CropFrame, MaskPath

| Contrato | Campos | Invariantes |
|---|---|---|
| `Transform` | `x`, `y`, `scale`, `rotation`, `opacity`, `crop`, `rotationX`, `rotationY`, `depth`, `pivot`, `cropFrame` | `scale` ∈ 0,05…10; `rotation` libre; `depth` ∈ 0,1…4 |
| `CropMask` | `left`, `right`, `top`, `bottom` | cada uno 0…0,45; `left+right ≤ 0,9`, `top+bottom ≤ 0,9` |
| `CropFrame` (**en curso**) | `x`, `y`, `width`, `height`, `angle`, `pivotX`, `pivotY`, `fill`, `aspect`, `flipX`, `flipY` | se interpreta sobre el fotograma; sin `cropFrame` rige `CropMask` |
| `MaskPath` | `points[]` (≤ 64, fracciones), `feather` (px, 0…200), `invert` | ≥ 3 puntos para rellenar |

### 4.7 Keyframe y curvas

`Keyframe` = `Transform` + `{time, mask?, curve?}`. Contrato de interpolación: `easeValue(curve, fracción,
suavidad)`; `hold` devuelve 0 hasta la clave siguiente; `smooth` mezcla la curva en S con la recta según
`keySmoothness` (0 % = recta, 100 % = S completa). Los valores ausentes en una clave se completan con el neutro.

### 4.8 Intercambio (importación)

| Campo del resultado | Tipo | Contrato |
|---|---|---|
| `project` | `Project` | montaje reconstruido, ya validado |
| `report.format` | texto | formato detectado |
| `report.source` | texto | nombre del archivo |
| `report.fps`, `translated`/`tracks`, `events`, `media` | números | qué se ha leído |
| `report.warnings[]` | textos | lo que se ha interpretado con suposición (se dice) |
| `report.ignored[]` | textos | lo que **no** se ha podido reconstruir (se dice) |

Regla de oro (D8): una importación **nunca** inventa un montaje; si no entiende algo, lo declara.

### 4.9 Render Pipeline (exportación)

| Contrato | Campos / reglas |
|---|---|
| `ExportSettings` | `width`, `height`, `fps`, `format` (`mp4`/`webm`/`wav`), `quality` (`draft`/`medium`/`high`/`master`), `scope` (`full`/`range`), `start`, `end`, `includeVideo`, `includeAudio`, `bitrateMbps` |
| Resolución del ámbito | `resolveRange()` recorta al contenido y al tramo válido |
| Fotogramas planificados | `plannedFrames(fps, rango)` = techo de segundos × fps |
| Progreso | `done`, `total`, `rate` (fps), `elapsedMs`, `etaMs`, `stage` (`preparando`/`video`/`audio`/`finalizando`), `bytes` |
| Resultado | `blob`, `elapsedMs`, `frames`, `format` |
| Cancelación | `AbortSignal`: se comprueba por fotograma; al cancelar, se liberan codificadores y se informa `cancelada` |
| Capacidades | `capabilities()` decide MP4/WebM/WAV disponibles; si falta un codificador, se **deshabilita con motivo** |

### 4.10 Automatización (contrato externo)

| Vía | Contrato | Estado |
|---|---|---|
| Puente con VEGAS (scripting) | `ScriptPortal.Vegas` (**[O]** presente en el ejecutable y en el portal gestionado de rondas anteriores): leer y escribir `.veg` con VEGAS real | ✅ puente; **[?]** nunca se ejecutó VEGAS desde aquí |
| Herramientas locales | `registerProjectTool` (WebMCP): exponer comandos del editor a un agente | 🟡 |
| `.veg` binario | análisis de sólo lectura (D6) | 🟡 |

### 4.11 Reglas de validación y errores (catálogo)

| Código | Cuándo | Mensaje (contrato) |
|---|---|---|
| `E_FIRMA` | el archivo no empieza por la firma esperada | «no parece un proyecto de …» + lo que sí es |
| `E_ESQUEMA` | falta un campo obligatorio o el tipo no cuadra | ruta del campo y motivo |
| `E_VERSION` | versión desconocida | versión leída y soportada |
| `E_RANGO` | valor fuera de rango | valor, mínimo y máximo |
| `E_MEDIO` | medio ausente al reproducir/exportar | qué archivo y cómo revincularlo |
| `E_DECODIFICADOR` | el navegador no puede decodificar | códec y motores que sí pueden |
| `E_ESPACIO` | no hay cuota para guardar la copia | cifras de uso y libre |
| `E_CANCELADO` | el usuario cancela | estado final `cancelada` |

---

## 5. Especificación funcional por componente

Prioridades: **P0** imprescindible (sin esto no hay producto), **P1** es lo que hace que se parezca a VEGAS 15,
**P2** acabado, **P3** fuera de alcance de esta fase. Estado según la matriz del proyecto: ✅ / 🟡 / ⬜.

Esfuerzo: **S** (< 1 día), **M** (1–3 días), **L** (> 3 días).

### 5.1 S1 — Modelo y operaciones (`lib/editor/project.ts`, `validation.ts`)

- **Responsabilidad**: tipos, constructores, invariantes y **operaciones puras** sobre el modelo (dividir,
  recortar, mover con rizo, deslizar, slip, tres puntos, sincronizar, enlazar, borrar, fundido automático, claves).
- **Entradas**: `Project` + parámetros del comando (ids, ticks, fps).
- **Salidas**: `Project` nuevo (nunca mutado) o un valor derivado; ninguna escritura a disco.
- **Dependencias**: ninguna del navegador.
- **Prioridad**: **P0**, estado ✅. Esfuerzo: **M** para mantener las invariantes con cada operación nueva.
- **Aceptación**: cada operación con prueba unitaria que comprueba el modelo resultante **e** invariantes I1–I17;
  ida y vuelta por `.corte15`.
- **Errores**: operación sobre un evento bloqueado → no toca el modelo y devuelve el motivo.

### 5.2 S1 — Historial

- **Responsabilidad**: deshacer/rehacer por instantáneas, una entrada por gesto.
- **Entradas**: `Project` anterior y nuevo; `undo()`/`redo()`.
- **Salidas**: `Project` restaurado; tope de memoria declarado.
- **Dependencias**: modelo.
- **Prioridad**: **P0**, ✅. Esfuerzo: **S**.
- **Aceptación**: tras cualquier gesto, `deshacer` deja un proyecto **idéntico** al anterior (comparación profunda);
  el arrastre de un evento ocupa **una** entrada, no una por fotograma.

### 5.3 S1 — Índices de la línea de tiempo

- **Responsabilidad**: proyecciones derivadas (por pista, por tiempo, longitud, conjuntos de comportamiento).
- **Entradas**: `Project`.
- **Salidas**: índices memorizados por referencia de proyecto.
- **Dependencias**: modelo.
- **Prioridad**: **P1** (P0 en cuanto haya > 100 eventos), estado 🟡. Esfuerzo: **M**.
- **Aceptación**: `compose(T)` no recorre eventos ajenos a `T`; los índices se invalidan en el mismo render en que
  cambia el proyecto; con 500 eventos, un fotograma de vista previa no supera el presupuesto (§5.18).

### 5.4 S2 — Importación y decodificación de medios (`media.ts`)

- **Responsabilidad**: detectar el contenedor y los códecs de verdad, generar miniatura y picos, guardar PCM.
- **Entradas**: `File` del usuario.
- **Salidas**: `Media` + `RuntimeMedia`; errores legibles por archivo.
- **Dependencias**: WebCodecs/demuxer, Canvas, `waveform.ts`.
- **Prioridad**: **P0**, ✅. Esfuerzo: **M**.
- **Aceptación**: un MP4 y un WAV reales se decodifican; un archivo corrupto produce `E_DECODIFICADOR` con
  motivo; el presupuesto de 256 MB se respeta.

### 5.5 S2 — Revincular y cachear medios

- **Responsabilidad**: sustituir el archivo de un medio existente sin cambiar ids; cachear copias locales.
- **Entradas**: `Media.id` + `File`; cuota estimada.
- **Salidas**: medio actualizado; aviso si no hay espacio.
- **Dependencias**: `storage.ts`, `media.ts`.
- **Prioridad**: **P1**, ✅. Esfuerzo: **S**.
- **Aceptación**: un evento con medio faltante vuelve a verse tras revincular; el aviso de cuota aparece con la
  cifra real.

### 5.6 S3 — Composición de vídeo (`compositor.ts`)

- **Responsabilidad**: producir el fotograma compuesto en un canvas para un instante: contenido, efectos,
  transiciones, máscaras, 3D, texto, color, fusión por pista.
- **Entradas**: canvas destino, `Project`, biblioteca, tick, opciones (crear canvas, notas).
- **Salidas**: canvas escrito; notas de lo que no se pudo aplicar (p. ej. sin soporte de filtros).
- **Dependencias**: `pancrop`, `crop-frame`, `letterbox`, `effects`, `transitions`, `threed`, `mask`, `titles`.
- **Prioridad**: **P0**, ✅. Esfuerzo: **L** (es el corazón).
- **Aceptación**: pruebas de **píxeles** por cada familia (fusión, encaje/estirado, recorte, efectos, transición,
  3D, texto, máscara); determinismo: mismo tick ⇒ mismos píxeles.
- **Errores**: medio ausente → se dibuja el cartel «Medio faltante: nombre» (estado, no excepción).

### 5.7 S3 — Pan/Crop (geometría)

- **Responsabilidad**: pose (posición, escala, giro, pivote, 3D), recorte de márgenes, encaje/estirado/cubrir,
  selección de recorte con zoom, arrastres de asas (con sus funciones puras).
- **Entradas**: `Transform`, `CropMask`/`CropFrame`, medidas del fotograma y del medio, deltas del puntero.
- **Salidas**: nueva pose/máscara (puras) o fotograma recortado (composición).
- **Dependencias**: `project`, `letterbox`, `threed`.
- **Prioridad**: **P0** (núcleo de encuadre), ✅; `CropFrame` 🟡 (en curso). Esfuerzo: **M**.
- **Aceptación**: `poseMatrix` como punto fijo del centro de giro; recorte que no tapa el fotograma; el zoom de
  la selección es uniforme (nunca deforma).

### 5.8 S3 — Efectos de vídeo (`effects.ts`)

- **Responsabilidad**: catálogo cerrado de 10 efectos y su aplicación por capa con Canvas.
- **Entradas**: lista de `VideoEffect` + capa + escala + fábrica de canvas.
- **Salidas**: capa modificada; nota si el motor no soporta filtros.
- **Dependencias**: Canvas 2D.
- **Prioridad**: **P1**, ✅. Esfuerzo: **M**.
- **Aceptación**: prueba de píxeles por efecto (entra/sale); un efecto desconocido se ignora con nota, no rompe.

### 5.9 S3 — Transiciones (`transitions.ts`)

- **Responsabilidad**: catálogo de 36 transiciones en 8 familias, como **entrada** del evento.
- **Entradas**: `TransitionKind`, progreso 0…1, canvas de las dos capas.
- **Salidas**: mezcla dibujada; todas terminan cubriendo el fotograma en p=1.
- **Prioridad**: **P1**, ✅. Esfuerzo: **M**.
- **Aceptación**: prueba por familia midiendo píxeles; una prueba que recorre las 36 y exige cobertura final.

### 5.10 S3 — Títulos y texto (`titles.ts`, `text-presets.ts`, `text-positions.ts`)

- **Responsabilidad**: plan de líneas (fuente, tamaño, interlineado, seguimiento, ancho), animaciones, estilos
  (contorno, sombra, fondo), plantillas, posiciones con nombre y **karaoke**.
- **Entradas**: campos del evento + medidas del fotograma + instante local.
- **Salidas**: plan de dibujo y píxeles.
- **Prioridad**: **P1**, ✅. Esfuerzo: **M**.
- **Aceptación**: la posición con nombre deja el bloque donde dice (medido con el mismo plan que pinta); el
  karaoke resalta palabra a palabra; la plantilla no toca el texto ni los tiempos.

### 5.11 S3 — Composición 3D (`threed.ts`)

- **Responsabilidad**: giros X/Y y distancia; proyección perspectiva y mapeo proyectivo por celdas.
- **Entradas**: pose 3D + fotograma + capa de origen.
- **Salidas**: cuadrilátero proyectado y píxeles.
- **Prioridad**: **P2**, ✅. Esfuerzo: **L** (ya hecho).
- **Aceptación**: proyección contra un modelo de cámara escrito aparte; sin costuras de rejilla.

### 5.12 S4 — Mezcla de audio (`audio.ts`, `audio-effects.ts`)

- **Responsabilidad**: mezclar (evento → pista → bus → maestro → limitador) con ganancias, panorámica, canales,
  velocidad, inversión, bucle, fades y envolventes; aplicar la cadena de efectos de audio.
- **Entradas**: `Project`, biblioteca, tick de inicio, número de muestras, frecuencia.
- **Salidas**: par de canales `Float32Array` (estéreo) listos para Web Audio o para el codificador.
- **Prioridad**: **P0**, ✅. Esfuerzo: **L**.
- **Aceptación**: pruebas **muestra a muestra** (retardo, nivel, paneo, canales, inversión, efectos); el WAV
  exportado coincide con `mix`.

### 5.13 S4 — Reproducción y medidores (`audio.ts`, `meter*.ts`)

- **Responsabilidad**: reloj de reproducción, programación por delante, bucle, medidores calibrados (pico, pico
  real, RMS, LUFS aproximada) y su publicación sin repintar el editor.
- **Entradas**: proyecto, biblioteca, rango de reproducción.
- **Salidas**: sonido, cursor de reproducción, lecturas de medidor.
- **Prioridad**: **P0** (reproducir) / **P1** (medidores), ✅. Esfuerzo: **M**.
- **Aceptación**: el cursor sigue al reloj real; el bucle rearma sin hueco; los medidores se publican por almacén
  propio (p95 de fotograma < 20 ms con 15 eventos, medido con `npm run test:perf`).

### 5.14 S5 — Intercambio (`interchange.ts`)

- **Responsabilidad**: detectar y analizar XML (FCPXML/FCP7) y EDL; reconstruir pistas, eventos, puntos y el
  vínculo de audio/vídeo; emitir informe.
- **Entradas**: nombre y contenido de texto.
- **Salidas**: `Interchange` (proyecto + informe).
- **Prioridad**: **P1**, ✅. Esfuerzo: **M**.
- **Aceptación**: los fixtures `vegas-montaje.xml` y `.edl` se reconstruyen con recuento de pistas/eventos; lo que
  no se entiende aparece en `ignored`.

### 5.15 S5 — `.veg` (lectura y puente)

- **Responsabilidad**: (a) leer un `.veg` real y **declarar** qué se entiende (firma, tamaño, bloques, rutas de
  medios, XMP, títulos); (b) con el puente, delegar la lectura/escritura completa en VEGAS por scripting.
- **Entradas**: bytes del `.veg` o petición al puente local.
- **Salidas**: informe + medios para revincular; o el montaje real del puente.
- **Prioridad**: **P1**, 🟡. Esfuerzo: **M** (lectura) / **L** (escritura, fuera de esta fase: D6).
- **Aceptación**: el `.veg` real del usuario produce un informe con sus 4 medios y sus 2 títulos; un archivo que
  sólo imita la firma se rechaza explicando por qué.
- **Deuda conocida**: el texto de `VEG_EXPLANATION` y algún comentario dicen «firma `riff.`»; el análisis de la
  ronda 26 muestra que son `riff` + clase de 12 B (**[O]**). Corregir el texto sin cambiar el comportamiento.

### 5.16 S6 — Espacio de trabajo (interfaz)

- **Responsabilidad**: barra de título y menús, paneles con pestañas, monitor con zoom de vista, línea de tiempo
  (regla, aguja, tramo, bucle, pistas, eventos, envolventes), ventanas flotantes, atajos y menús contextuales.
- **Entradas**: `Project`, selección, vista, comandos del usuario.
- **Salidas**: comandos despachados al modelo; nada de lógica del medio.
- **Prioridad**: **P0**, ✅. Esfuerzo: **L**.
- **Aceptación**: (ya cubierto por 73 flujos E2E por motor) teclado completo, aguja arrastrable desde regla y
  carriles, ventanas que caben en pantalla, medidas de disposición verificadas.
- **Regla de rendimiento**: una interacción de 60 fps no puede repintar la línea de tiempo entera si no ha
  cambiado (ronda 25: aguja y timecode por referencia, medidores por almacén).

### 5.17 S6 — Ventanas de edición

- **Responsabilidad**: Propiedades del evento (pestañas de VEGAS 15), Panoramización y recorte (árbol, monitor,
  claves, selección de recorte, rueda de vista), Títulos y texto (con posiciones y plantillas), Trimmer, Mezclador,
  Efectos, Envolventes, Lote.
- **Entradas**: evento/pista/medio seleccionado, cursor, medidas.
- **Salidas**: parches al modelo (por comando, con historial).
- **Prioridad**: **P0/P1** según ventana, ✅ (Pan/Crop y Títulos en reorganización por la ronda paralela: los
  archivos `event-pan-crop.tsx` y `pan-crop-icons.tsx` están en curso).
- **Aceptación**: cada ventana tiene E2E de rótulos (los de VEGAS) y de efecto en el modelo.

### 5.18 S7 — Presupuesto de rendimiento (transversal)

- **Responsabilidad**: garantizar que la interfaz responde con proyectos reales.
- **Contratos**: fotograma de vista previa ≤ 16,7 ms con 15 eventos visibles (p95 medido con
  `npm run test:perf`); la reproducción no re-renderiza el editor; el zoom no reconstruye trazados en cada paso;
  el autoguardado no deja fotogramas largos.
- **Prioridad**: **P0** (es parte del producto), ✅ con medición. Esfuerzo: **M** continuo.
- **Aceptación**: la sonda de rendimiento no supera 2 fotogramas largos por 3 s de reproducción y 6 por gesto de
  zoom (cifras de la ronda 25).

### 5.19 S7 — Exportación y lote

- **Responsabilidad**: renderizar a MP4/WebM/WAV con la calidad elegida, informar del progreso, cancelar y
  encadenar trabajos en lote.
- **Entradas**: `ExportSettings` + `Project` + biblioteca.
- **Salidas**: `Blob` descargable; `ExportProgress`; trabajos del lote con estado.
- **Prioridad**: **P0**, ✅. Esfuerzo: **M**.
- **Aceptación**: ffprobe sobre el archivo (pistas, resolución, duración, pico de audio); cancelación inmediata;
  lote de dos trabajos en serie; plantillas disponibles según capacidades del motor.

### 5.20 S8 — Automatización

- **Responsabilidad**: permitir que un agente o un script conduzcan el editor o VEGAS.
- **Entradas**: peticiones locales (WebMCP) o scripts de VEGAS.
- **Salidas**: comandos ejecutados; en VEGAS, `.veg` escrito por su propio motor.
- **Prioridad**: **P2**, 🟡. Esfuerzo: **M**.
- **Aceptación**: un comando expuesto por herramientas locales produce el mismo efecto que la interfaz; el puente
  informa de su estado (disponible/no, versión de VEGAS, carpeta de salida).

### 5.21 S1 — Almacenamiento

- **Responsabilidad**: autoguardado con retardo, recuperación al abrir, cuota informada, copia de medios opcional.
- **Entradas**: `Project` en cada cambio; archivos a cachear.
- **Salidas**: `localStorage` con el proyecto; IndexedDB con copias; estado de cuota.
- **Prioridad**: **P0**, ✅. Esfuerzo: **S**.
- **Aceptación**: recargar recupera el proyecto; sin cuota, aviso con cifras y sin pérdida del trabajo en curso;
  **[?]** el autoguardado de un proyecto muy grande (varios MB de miniaturas y picos) no está medido.

### 5.22 S1 — Catálogos de la interfaz (plantillas y plantillas de proyecto)

- **Responsabilidad**: plantillas de texto (16) y plantillas de proyecto (vertical 9:16, cuadrado…), con sus
  metadatos y "notas" que se muestran al usuario.
- **Entradas**: elección del usuario.
- **Salidas**: parches al proyecto/evento.
- **Prioridad**: **P2**, ✅. Esfuerzo: **S**.

---

## 6. Prioridades, fases y trazabilidad

### 6.1 Mapa de prioridades

| Prioridad | Componentes | Criterio de salida |
|---|---|---|
| **P0 — producto mínimo** | 5.1 modelo, 5.2 historial, 5.4 medios, 5.6 composición, 5.7 encaje/recorte, 5.12 mezcla, 5.16 espacio de trabajo, 5.19 exportación, 5.21 almacenamiento, 5.18 rendimiento | editar, reproducir y exportar un montaje real con pruebas de píxeles, muestras y archivo |
| **P1 — fidelidad a VEGAS 15** | 5.3 índices, 5.5 revincular, 5.8 efectos, 5.9 transiciones, 5.10 títulos, 5.14 intercambio, 5.15 `.veg`, 5.17 ventanas, 5.13 medidores | rótulos y flujos de VEGAS con E2E; informes de importación honestos |
| **P2 — acabado** | 5.11 3D, 5.20 automatización, 5.22 catálogos | funciones completas pero no bloqueantes |
| **P3 — fuera de esta fase** | escritura de `.veg` binario; render en segundo plano; subclips/tomas/enlaces de sincronización; seguimiento de movimiento | se declaran como no soportados con motivo |

### 6.2 Fases de desarrollo

1. **Fase 1 (este documento)**: arquitectura, dominio, contratos, prioridades. Criterio: revisado y aceptado.
2. **Fase 2 — consolidación del núcleo**: cerrar los huecos de los contratos `🟡` (CropFrame, índices, `.veg` de
   lectura) y las deudas de texto; sin funciones nuevas.
3. **Fase 3 — fidelidad**: completar lo que falte de P1 (comparación con VEGAS por ventana) y ampliar catálogos.
4. **Fase 4 — automatización**: puente y herramientas locales con contrato estable.
5. **Fase 5 — rendimiento y escala**: proyectos de cientos de eventos, memoria y arranque.

### 6.3 Trazabilidad requisito → módulo → prueba

| Requisito del encargo (REA) | Módulo | Prueba |
|---|---|---|
| «Un `.veg` se abre y dice qué hay» | `veg.ts`, `interchange.ts` (§5.15) | `tests/ai.test.ts`, E2E del `.veg` |
| «Lo que se ve es lo que se graba» | `compositor.ts` + `export.ts` (§5.6, §5.19) | píxeles en `composition.test.ts`, ffprobe en E2E |
| «El audio cuadra al milisegundo» | `audio.ts` (§5.12) | `mixer.test.ts`, `event-switches.test.ts` |
| «El editor responde» | transversal (§5.18) | `npm run test:perf` |
| «El formato del proyecto es estable» | `validation.ts` (§4.1) | `model.test.ts` (ida y vuelta) |
| «No se promete lo que no se hace» | bordes (§4.8, §4.11) y D9 | informes y avisos en E2E |

---

## 7. Riesgos, deudas y lo que queda por verificar

### 7.1 Riesgos técnicos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| El motor de VEGAS que interpreta el `.veg` no está disponible (**[?]**, sin desensamblador y sin la DLL) | no se pueden cerrar los campos de pista/evento ni escribir `.veg` | D6: lectura honesta + puente; el día que se consiga la DLL, desensamblar y cerrar §2.4 |
| Diferencias de *escritor* entre `.veg` (dos convenciones de tamaño, relleno de ceros, XMP opcional) | un lector rígido falla con archivos válidos | el lector tolera ambas y declara lo que ignora (§5.15) |
| El motor de composición es el mismo que el de la vista previa (D2) | un render de exportación más lento | calidad seleccionable y presupuesto de fotograma (§5.18) |
| Un solo hilo (D1) | tirones en proyectos grandes | índices por referencia, reparto imperativo en reproducción, sonda de rendimiento |
| Memoria de PCM y miniaturas | pestaña pesada | presupuesto de 256 MB declarado y error explicado |
| Historial por instantáneas (D7) | memoria O(gestos) | tope y aviso; a futuro, deltas |
| Medidores LUFS aproximados | cifra que parece certificada | se documenta como aproximación (§5.13) |

### 7.2 Deudas técnicas conocidas (prioridad de cierre)

1. **Textos que dicen «firma `riff.`»** en `lib/editor/veg.ts` y en el mensaje de rechazo: el análisis de la ronda
   26 prueba que son `riff` + clase de 12 B. Cambiar los textos sin cambiar el comportamiento (§5.15). **S**.
2. **`CropFrame` a medio contrato**: hay que decidir si sustituye a `CropMask` o conviven (propuesta: conviven; sin
   `cropFrame`, manda `CropMask`) y fijarlo en §4.6. **S**.
3. **Índices de la línea de tiempo** (§5.3): con proyectos grandes, la búsqueda por fotograma debe dejar de ser un
   recorrido completo. **M**.
4. **Autoguardado de proyectos grandes**: medir el coste de serializar miniaturas y picos y, si molesta, sacar la
   copia pesada a IndexedDB. **S/M**.
5. **`channelPeaks`** (onda estéreo) y `waveform-index.ts` están entrando en paralelo: fijar su contrato en §4.5
   cuando se estabilicen. **S**.

### 7.3 Lo que queda por verificar (no se afirma)

| Incógnita | Estado | Qué haría falta |
|---|---|---|
| Significado de las 40 clases del serializador y de sus campos | **[?]** | la DLL del motor (`vegas150k.dll`) y un desensamblador; o muestras con diferencias controladas |
| Codificación de claves, transiciones y ajustes de render en el `.veg` | **[?]** | ídem |
| Formato del `.veg_archive` (posible ZIP con proyecto y medios) | **[?]** | un archivo `.veg_archive` real |
| Ejecución real de VEGAS desde este entorno (abrir/guardar un `.veg`) | **[?]** | lanzar VEGAS con el puente y un script; no se hizo |
| Comportamiento de VEGAS en las ventanas «igual que la de aquí» | **[?]** | ejecutar VEGAS y comparar captura a captura |

---

## 8. Anexos

### 8.1 Glosario

| Término | Significado en este documento |
|---|---|
| **tick** | unidad de tiempo entera del modelo (705 600 000 por segundo) |
| **fotograma** | unidad de la rejilla de fps; todo instante visible está cuantizado a ella |
| **pose** | conjunto posición + escala + giro + opacidad + 3D + centro de giro de un evento o pista |
| **recorte** | dos mecanismos: márgenes (`CropMask`) y rectángulo de origen (`CropFrame`, en curso) |
| **toma de efectos** | cadena de efectos de audio en pista o bus («inserts» en el modelo) |
| **envolvente** | curva dibujable de volumen/panorámica sobre la pista |
| **tramo** | rango que decide qué se renderiza |
| **bucle** | rango que decide qué se repite al reproducir (independiente del tramo) |
| **medio faltante** | estado válido de un evento cuyo archivo no está disponible |
| **informe** | resultado de un borde: lo leído y lo ignorado |
| **puente** | servicio local que hace que VEGAS real lea/escriba un `.veg` por scripting |

### 8.2 Referencias cruzadas

- Análisis que fundamenta este documento: `ANALISIS-REA-VEG.md` (evidencia REA del ejecutable y del `.veg`),
  `ANALISIS-VEG.md` (contenido del `.veg` real), `ANALISIS-VEGAS-REA.md` (cadenas y recursos de VEGAS 15).
- Estado funcional y pruebas: `FEATURES.md`, `VERIFICACION.md`, `README.md`.
- Sondas reproducibles: `npm run test:perf` (rendimiento de la interfaz), `npm run test:capabilities` (APIs y
  códecs por motor), `outputs/rea/*` (evidencias del análisis).
