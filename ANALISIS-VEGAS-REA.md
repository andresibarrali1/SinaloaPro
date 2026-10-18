# Análisis de VEGAS Pro 15 con REA (skill `reverse-engineer-anything`)

Objetivo: usar la skill `reverse-engineer-anything` (REA) para analizar la instalación real de VEGAS Pro 15 en
`C:\Program Files\VEGAS\VEGAS Pro 15.0` y, con la evidencia obtenida, **incluir o mejorar en Corte15** lo que
falta. Todo lo que sigue distingue la **evidencia REA** (salida real del servidor/CLI de REA, con su
`evidence_id` y sus digests) de las **observaciones con herramientas corrientes** (leer archivos de texto del
programa), tal como exige la propia skill: solo la salida de REA es evidencia REA.

> **Ampliación (ronda 26)**: el análisis del **formato del proyecto `.veg`** y del **ejecutable completo** —con el
> contenedor de bloques, la tabla de clases del serializador en `.rdata`, la arquitectura de módulos y los límites
> de la automatización— está en [`ANALISIS-REA-VEG.md`](ANALISIS-REA-VEG.md).

## 1. Cómo se ejecutó REA

- Skill instalada desde `https://github.com/morluto/rea.git` (commit `8fc2043`), versión de la skill 40.
- El registro MCP de REA **no está hecho** en este harness, así que se usó la vía que la skill autoriza como
  sustituta: el **CLI del paquete**, `npx -y rea-agents@latest`, versión **6.4.0** (Node v24.15.0, soportado).
- No hay motores nativos instalados (Ghidra/IDA/Hopper) y en Windows el soporte nativo de Ghidra es
  experimental, así que se usaron los comandos **sin motor**, que es donde está el valor en este objetivo:
  `inspect-managed-artifact`, `inspect-managed-members`, `inspect-managed-native-boundaries` e
  `inspect-pe-resources`.
- Las salidas crudas quedaron en `outputs/rea/*.json` (una por comando) y el resumen compacto lo hace
  `outputs/rea/summarize.mjs` (lee UTF-8 o UTF-16, con o sin BOM).

| Comando | Archivo |
|---|---|
| `inspect-managed-artifact ScriptPortal.Vegas.dll` | `outputs/rea/vegas-api-identity.json` |
| `inspect-managed-members ScriptPortal.Vegas.dll` | `outputs/rea/vegas-api-members.json` |
| `inspect-managed-native-boundaries ScriptPortal.Vegas.dll` | `outputs/rea/vegas-api-boundaries.json` |
| `inspect-managed-artifact vegas150.exe` | `outputs/rea/vegas150-identity.json` |
| `inspect-managed-artifact vegas150k.dll` | `outputs/rea/vegas150k-identity.json` |
| `inspect-pe-resources vegas150.exe` | `outputs/rea/vegas150-resources.json` |
| `inspect-pe-resources ScriptPortal.Vegas.dll` | `outputs/rea/vegas-api-resources.json` |
| `inspect-managed-members ScriptPortal.Capture.dll` | `outputs/rea/capture-members.json` |

## 2. Evidencia REA

### 2.1 El portal de scripting es una assembly gestionada propia (identidad exacta)

`inspect_managed_artifact` sobre `ScriptPortal.Vegas.dll` — `evidence_id`
`ev_48cf3bf04541aa651c3c4ee06f4cfb1a4ef788b86378110b20286595bfb4dc52`, autoridad `shipped-artifact`,
confianza `observed`:

| Dato | Valor |
|---|---|
| SHA-256 | `9fc39a68fb6b85a2ca1307f27f5245e97e54a3319b8828f41d0cf03c962773d4` |
| Tamaño | 405 312 bytes |
| Assembly | `ScriptPortal.Vegas`, versión **15.0.0.177**, sin cultura |
| Clave pública (token) | `3cda94b1926e6fbc` |
| Implementación | `cil`, arquitectura gestionada `anycpu`, contenedor `pe` |

Y sus **referencias declaradas** (mismo `evidence_id`), que dibujan la arquitectura real del programa:

`mscorlib`, `System`, `System.Windows.Forms`, `System.Xml`, `System.Drawing`, `Microsoft.JScript`,
`ScriptPortal.MediaSoftware.ExternalVideoDevice`, `ScriptPortal.Capture`,
`ScriptPortal.MediaSoftware.clrshared` y `ScriptPortal.MediaSoftware.Skins`.

Lectura útil para el puente de Corte15: el portal de scripting depende de **captura**
(`ScriptPortal.Capture`), de **dispositivos de vídeo externos**, de **pieles** y de `clrshared`; los títulos y
los efectos viven en assemblies aparte (`ScriptPortal.MediaSoftware.TextGen.*`,
`ScriptPortal.MediaSoftware.VideoEffectsUI`), no en el portal.

### 2.2 El ejecutable y la DLL de recursos son nativos x86-64

| Artefacto | Clasificación REA | SHA-256 |
|---|---|---|
| `vegas150.exe` | `not-managed`, `pe32-plus`, x86_64, 7 secciones, sin directorio CLI | `a5ab9a558b32c5f90a6471010f2b348146d6c7e3d51166c20d638d785a4aa0e9` |
| `vegas150k.dll` | `not-managed`, `pe32-plus`, x86_64, 13 secciones, sin directorio CLI | (en `vegas150k-identity.json`) |

Es decir: el motor es nativo; lo que se puede leer y escribir con la API documentada es el **modelo de
proyecto** expuesto por las assemblies gestionadas, que es exactamente lo que usa el puente de Corte15.

### 2.3 El inventario de miembros de la API no cabe en el presupuesto de REA 6.4.0

`inspect_managed_members` sobre `ScriptPortal.Vegas.dll` (`evidence_id`
`ev_0068a504e7801910459fdca10a158db6ac0b4cc811f9b8b27d94b032106e21d3`) devuelve **cobertura no disponible**:

> `coverage.state: "unavailable"` · `issues[0].code: "resource-limit"` ·
> «Managed metadata exceeds the 67108864 byte representation budget»
> `limitations[0]`: «The CLI metadata could not be admitted; managed member inspection is unavailable.»

El mismo comando sobre otra assembly de la instalación, `ScriptPortal.Capture.dll`, **sí funciona**: 80 tipos,
1 078 métodos y 689 campos admitidos. Conclusión honesta: **no** es que el análisis de assemblies falle en
general, es que la metadata de la API grande no cabe en el presupuesto de 64 MiB de esta release (constante
`MAX_METADATA_REPRESENTATION_BYTES` en `ManagedDecodeBudget.js` del paquete), y REA **no devuelve inventario
parcial**: prefiere no responder antes que inventar. No se deduce de aquí ningún dato sobre los tipos de la API.

### 2.4 Los recursos del ejecutable tampoco caben

`inspect-pe-resources vegas150.exe` devuelve `code: "resource_constraint"`:

> «PE resource directory entry budget exceeded; no partial inventory was returned.» · `retryable: false` ·
> remediación: «Review the reported worker memory limits and available host memory. Retry with sufficient
> memory or a smaller artifact».

El mismo comando sobre `ScriptPortal.Vegas.dll` sí devuelve inventario (formato `pe32`, directorio de recursos
en RVA 401 408). Es decir: el ejecutable principal tiene un directorio de recursos enorme (iconos, diálogos,
cadenas) y REA 6.4.0 no lo inventaría con los límites de trabajador de este equipo.

### 2.5 Lo que REA no puede responder aquí, y por qué

- **Pseudocódigo nativo** (qué hace por dentro `vegas150.exe`): requiere un motor (Ghidra/IDA/Hopper) que no
  está instalado; en Windows el soporte de Ghidra de REA es P0 experimental.
- **Miembros de `ScriptPortal.Vegas.dll`**: limitado por el presupuesto (§2.3).
- **Ejecución del lado VEGAS**: este equipo tiene VEGAS instalado, pero **no se ha ejecutado** el puente en
  esta ronda; nada de lo que sigue afirma haber hablado con VEGAS en marcha.

## 3. Inventario de funciones (observación con herramientas corrientes, **no** evidencia REA)

Estos datos salen de **leer archivos del programa** (scripts `.cs` que VEGAS instala en su menú, catálogos de
complementos y el paquete de idioma). Se etiquetan aparte porque no son salida de REA.

### 3.1 Scripts que VEGAS Pro 15 instala en `Script Menu\`

`Add Timecode to all Media.cs`, `Batch Render.cs`, `Export Chapters.cs`, `Export Closed Captioning for
DVD Architect.cs`, `… for QuickTime.cs`, `… for Windows Media Player.cs`, `… for YouTube.cs`, `Export Regions
as Subtitles.cs`, `Group Video and Audio Events.cs`, `Promote Media Closed Captioning.cs`, `Promote Media
Markers.cs`, `Remove Letterboxing.cs`, `Remove Timecode from all Media.cs`, `Render Audio Tracks.cs`,
`Resize Generated Media.cs`, `Stereo to Mono.cs`.

Son funciones **soportadas por el propio VEGAS** (por eso las trae instaladas), y varias se pueden reproducir en
un editor de navegador; son la fuente principal de la lista de carencias de §4.

### 3.2 Complementos instalados

- OFX: `Filters`, `HitFilmVegasBasic`, `spica_cutout`, `spica_resizer`, `Stabilize`, `TitlesAndText`, `Vfx1`.
- Nativos: `colorcorrector.dll`, `sfpagepeel.dll`, `sftrans1.dll`, `vfx1.dll`, `vidpcore.dll`, `PluginWrapper.dll`.

## 4. Qué le falta a Corte15, con la evidencia delante

| Función de VEGAS | Evidencia | Estado en Corte15 antes de esta ronda |
|---|---|---|
| Quitar bandas negras (letterboxing y pillarboxing) | `Remove Letterboxing.cs` | ⬜ No existía |
| Exportar capítulos desde los marcadores (TXT/CSV/XML) | `Export Chapters.cs` | ⬜ No existía |
| Exportar regiones/marcadores como subtítulos | `Export Regions as Subtitles.cs` | 🟡 Solo `.srt` de la transcripción |
| Una salida de audio por pista | `Render Audio Tracks.cs` | ⬜ No existía |
| Promover los marcadores del material a la línea de tiempo | `Promote Media Markers.cs` | ⬜ No existe (pide leer marcadores del contenedor) |
| Promover subtítulos incrustados (closed captioning) | `Promote Media Closed Captioning.cs` | ⬜ No existe (el navegador no decodifica CEA-608) |
| Exportar subtítulos a SCC / QuickTime / YouTube | `Export Closed Captioning for *.cs` | ⬜ Solo `.srt` |
| Quemar el timecode de cada medio | `Add Timecode to all Media.cs` | ⬜ No existe |
| Convertir estéreo a mono | `Stereo to Mono.cs` | ⬜ No existe (el mezclador es estéreo) |
| Ajustar el tamaño de los medios generados al proyecto | `Resize Generated Media.cs` | ✅ Ya se escala solo (`planText` y generadores) |
| Agrupar vídeo y audio | `Group Video and Audio Events.cs` | ✅ Ya está (`G`) |
| Lote de renderizado | `Batch Render.cs` | ✅ Ya está |

## 5. Lo que se implementó en esta ronda

De la lista anterior se implementaron las tres que más valoran el trabajo de montaje, se pueden verificar en el
navegador y tienen detrás un script real de VEGAS:

1. **Quitar bandas negras** — con las dos variantes: la del script de VEGAS (*encajar el contenido a la
   relación de aspecto del proyecto*, `Remove Letterboxing.cs`, que trabaja solo con geometría) y una
   **mejorada**: detectar las bandas por **píxeles** del fotograma compuesto (la banda negra *incrustada*, que
   el script de VEGAS no mira) y recortarlas solas.
2. **Exportar los marcadores** — capítulos en TXT/CSV/XML como `Export Chapters.cs` (mejorado: incluye el
   nombre del marcador, que el script de VEGAS pierde en TXT y CSV), lista de capítulos para YouTube y
   **subitítulos `.srt` a partir de los marcadores**, que es el caso de uso de `Export Regions as Subtitles.cs`.
3. **Una salida de audio por pista** — `Render Audio Tracks.cs`: la cola de renderizado puede añadir un trabajo
   por cada pista de audio del proyecto.

El detalle de cada una, sus pruebas y lo que queda pendiente está en `README.md` (§5.9), `FEATURES.md` (§6 y
§13) y `VERIFICACION.md` (ronda 15).

## 6. Ronda 16: las cadenas en español del ejecutable

Para replicar el clic derecho y el diálogo «Propiedades» hacía falta el **texto exacto** que VEGAS 15 muestra en
español. REA no pudo inventariar los recursos de `vegas150.exe` (§2.4), así que se leyó el directorio de recursos
del PE con herramientas corrientes (`outputs/rea/pe-resources.mjs`, que sigue el árbol de recursos y decodifica
`RT_MENU`/`RT_DIALOG`/`RT_STRING`). Ese decodificador **no reconstruye bien** las tablas `MENUEX` de este
ejecutable (los menús salen desincronizados y mezclan idiomas), así que los rótulos se obtuvieron con un barrido
directo de cadenas UTF-16LE (`outputs/rea/scan-utf16.mjs` y `outputs/rea/dump-utf16-range.mjs`). Todo esto es
**observación con herramientas corrientes, no evidencia REA**; la identidad del artefacto sí es de REA.

Lo que se obtuvo (idioma 1034 = español de España; el bloque español de la tabla vive hacia `0x140f000` y los
diálogos hacia `0x14b6000`–`0x14be800`):

- **Menú del evento de vídeo** (`POPUP_IDX_VIDEO_SURFACE`, `outputs/rea/vegas150-es-evento.txt` líneas 265-317):
  Abrir en recortadora · Seleccionar en lista de medios del proyecto · Editar medios generados... · Efectos de
  medios... · Panoramización/recorte de evento de vídeo... · Efectos de evento de vídeo... · Cortar · Copiar ·
  Pegar atributos de evento · Pegado selectivo de atributos de evento · Eliminar · Recortar · Recortar principio ·
  Recortar final · Dividir · Crear subclip (0) · Invertir · Seleccionar eventos hasta el final (Z) ·
  Insertar/eliminar envolvente ▸ · Freeze Frame at Cursor · Progreso de transición ▸ · Modificadores ▸ · Toma ▸ ·
  Grupo ▸ · Sincronizar ▸ · Enlace sinc ▸ · Propiedades...
- **Menú del evento de audio** (`POPUP_IDX_AUDIO_EVENT`, líneas 83-141): el mismo esqueleto con Abrir en editor de
  audio, Efectos de evento de audio..., Modificadores ▸ (Silencio, Bloqueo, Bucle, Invertir fase, Normalizar),
  Corriente, Canales ▸ (Ambos, Sólo izquierdo, Sólo derecho, Combinar, Intercambiar).
- **Modificadores ▸** (líneas 170-178): Silencio · Bloqueo · Bucle · Mantener relación de aspecto · Reducir
  parpadeo de entrelazado · Utilizar el modo Re-muestreo inteligente · Forzar re-muestreo · Deshabilitar
  re-muestreo.
- **Diálogo «Propiedades»** (`outputs/rea/vegas150-es-propiedades.txt` líneas 60-77 y 3-23): pestañas «Evento de
  vídeo» y «Medios», grupo «Modificadores», «Nombre de toma activa:», «Velocidad de reproducción:», «Ajustarse a
  la velocidad de fotogramas del proyecto», «Veloc. de inframuestreo:», y en Medios «Nombre de archivo:»,
  «Nombre de cinta:», «Código de tiempo», «Propiedades de reproducción» (Corriente, Formato, Atributos, Velocidad
  de fotogramas, Orden de campos, Relación de aspecto del píxel, Canal Alfa, Color de fondo, Espacio de color).

Tres lecturas que cambiaron decisiones del diseño:

1. **No existe un comando «Copiar atributos de evento»** en español ni en inglés: el barrido solo encuentra
   `Edición.PegarAtributosDeEvento` / `Edit.PasteEventAttributes` (`outputs/rea/vegas150-es-cmd-atributos.txt`).
   Es decir, en VEGAS se copia el **evento** con «Copiar» y se pega su aspecto con «Pegar atributos de evento».
   Corte15 hace ahora lo mismo: «Copiar» deja también los atributos en el portapapeles de atributos.
2. **«Freeze Frame at Cursor» está sin traducir** en la tabla española (línea 168 de
   `vegas150-es-evento.txt`): es el único rótulo en inglés del menú. En Corte15 se rotula en español con esa
   traducción como pista.
3. **La velocidad de inframuestreo es una velocidad, no una fracción**: «Veloc. de inframuestreo:» va con su
   unidad en fps, y por eso el campo es un número en fotogramas por segundo.

Un segundo bloque de diálogo del mismo rango (líneas 153-208 de `vegas150-es-propiedades.txt`) trae los rótulos
**Posición · Tamaño: · Centro: · Ángulo (grados): · Suavidad (%): · Vista de zoom (%): · Densidad de cuadrícula:
· Origen · Mantener rel. de aspecto · Extender para rellenar f. · Seguimiento de función** (en alemán, inglés y
francés los mismos campos con las mismas palabras: `&Größe:`, `&Mitte:`, `Position`, `Size:`, `Center:`…). Eso
encaja con la ayuda oficial del propio producto para la ventana de Panoramización y recorte, que la organiza en
**Position** (Width/Height, X Center/Y Center), **Rotation** (Angle, X Center/Y Center), **Keyframe
Interpolation** (Smoothness), **Source** (Maintain aspect ratio, Stretch to fill frame) y **Workspace** (Zoom, X
Offset/Y Offset, Grid spacing) — ver
[Pan/Crop Dialog Controls](https://cdn.borisfx.com/borisfx/Documentation/vegas/2026/en/content/topics/7-edit/pan-crop-dialog.htm)
(ayuda oficial, versión 2026; la de 15 no está publicada en línea, así que se usa como contraste, no como
evidencia de la 15). Con esas dos fuentes se completaron en la ronda 17 los grupos de la ventana: «Suavidad (%)»
en *Interpolación de fotogramas clave*, las dos casillas de *Origen* y «Vista de zoom (%)» con «Densidad de
cuadrícula (px)» en *Área de trabajo*.

### 6.2 Las cadenas de la ventana de efectos, en su satélite de idioma

Además del ejecutable, la instalación trae las satélites gestionadas de cada assembly. La de la interfaz de
efectos de vídeo —`es\ScriptPortal.MediaSoftware.VideoEffectsUI.resources.dll`— es donde están los rótulos de la
ventana de complementos, y sus cadenas van en **UTF-8** (formato `.resources` de .NET, con la longitud delante),
no en UTF-16 como las del ejecutable nativo: por eso hizo falta un barrido aparte (`outputs/rea/scan-utf8.mjs` y
`outputs/rea/dump-utf8-range.mjs`). La identidad del artefacto **sí es evidencia REA** (`inspect_managed_artifact`,
salida en `outputs/rea/vfxui-es-identity.json`):

| Dato | Valor |
|---|---|
| `evidence_id` | `ev_fd8684c0e529c731a7b35a77b10d9b804b52eef0fd0f0a4d688165ed91c26490` |
| SHA-256 | `90ce5c52937e39443b52e32194ede43aa99c43753eb31eb9263cbe406206a6e6` · 183 616 bytes |
| Formato | `pe` · pe32 · x86 · `managed`, `anycpu`, metadata **completa** (runtime v4.0.30319) |
| Assembly | `ScriptPortal.MediaSoftware.VideoEffectsUI.resources`, versión **15.0.0.177**, cultura **es** |
| Clave pública (token) | `3cda94b1926e6fbc` — la misma que `ScriptPortal.Vegas.dll`, así que es de la misma casa |
| Recursos | 26 `ManifestResource`, uno por control de la interfaz, cada uno con su SHA-256 |

Lo leído en sus cadenas (`outputs/rea/vfxui-es-pancrop.txt`) —observación con herramientas corrientes, no
evidencia REA—:

| Cadena | Dónde se usa en Corte 15 |
|---|---|
| `Panoramización/Recorte` | Las migas de la barra de pestañas, ya con ese texto exacto |
| `Parámetro preestablecido:` | La fila de preestablecidos, ya con ese texto exacto |
| `Guardar parámetro preestablecido` / `Eliminar parámetro preestablecido` | Los dos botones de icono de esa fila, que ahora **guardan y borran** preestablecidos propios (viven en el `.corte15`) |
| `¿Está seguro que desea eliminar el parámetro? (Todos los fotogramas clave para ese parámetro se perderán.)` | La confirmación al borrar un preestablecido, palabra por palabra |
| `Añadir fotograma clave`, `Eliminar fotograma clave`, `Primer fotograma clave`, `Fotograma clave anterior`, `Siguiente fotograma clave`, `Último fotograma clave` | Los rótulos y las pistas de la botonera de la tira de claves |
| `Ángulo`, `Magnitud`, `Predeterminados`, `Vista previa`, `Pantalla`, `Recortadora`, `Animar`, `Efectos de vídeo` | Nombres de otras vistas del producto; se dejan documentados porque no hay ventana equivalente aquí |

Un dato que cambió el diseño: **VEGAS sí tiene botones para guardar y borrar el parámetro preestablecido**, así
que los dos iconos de esa fila dejaron de ser decorativos. Los preestablecidos se guardan en el proyecto
(`panCropPresets`, con su pose y su recorte), viajan dentro del `.corte15` y se validan al abrir.

### 6.3 Un error de encaje que salió al replicar «Extender para rellenar f.»Al implementar la casilla del grupo «Origen» apareció un defecto previo en `lib/editor/letterbox.ts`: `fillFrame`
y `fitFrame` devolvían la escala **absoluta** del medio (relación entre el medio y el fotograma), pero el
compositor dibuja el medio a escala 1 ya **encajado** (`contentBox` usa la menor de las dos relaciones). Con un
medio más grande que el proyecto las dos cuentas no coinciden y el resultado quedaba mal: «cubrir» no cubría y
«encajar» encogía un 4K al 25 %. Ahora las dos poses se calculan contra esa base (`coverScale / containScale` y
la escala neutra), y hay una prueba de píxeles que lo comprueba en el fotograma compuesto
(`tests/composition.test.ts`).

### 6.1 Lo que se replicó en el código (ronda 16)

| Pieza de VEGAS | Dónde está en Corte15 | Estado |
|---|---|---|
| Menú del clic derecho del evento (vídeo y audio) | `components/editor/editor.tsx` → `eventMenuItems` | ✅ Réplica de la lista y el orden |
| Submenús «▸» | `components/editor/workspace-menu.tsx` (`items`, con volteo si no caben) | ✅ Nuevo |
| Ventana «Propiedades» con sus dos pestañas | `components/editor/event-properties.tsx` | ✅ Nueva |
| Modificadores: Silencio, Bloqueo, Bucle, Invertir | `Event` + `lib/editor/audio.ts` + `silencedIds`/`lockedIds` | ✅ Aplicados |
| Mantener relación de aspecto | `event.maintainAspect` en `lib/editor/project.ts`, `drawMedia` en `lib/editor/compositor.ts` | ✅ Aplicado desde la ronda 20: puesta por defecto (encaja y deja bandas), quitada estira hasta llenar el fotograma. Que su casilla desmarcada deforme **igual que en VEGAS** es una inferencia del nombre y del uso, no una lectura del binario |
| Reducir parpadeo de entrelazado | `reduceFlickerBlend` en `lib/editor/compositor.ts` | 🟡 Aproximación de tres tomas verticales |
| Velocidad de reproducción / inframuestreo / ajuste al fotograma | `sourceTime` en `lib/editor/project.ts` | ✅ Aplicados al pedir el material |
| Canales (Ambos/Sólo izquierdo/Sólo derecho/Combinar/Intercambiar) | `lib/editor/audio.ts` | ✅ Aplicados |
| Sincronizar por desplazamiento / deslizamiento | `syncEvents` en `lib/editor/project.ts` | ✅ Implementado (el algoritmo es propio) |
| Crear subclip, Toma ▸, Enlace sinc ▸, tiempo no real, editor de audio externo | Menú, desactivado con su motivo | ⬜ No existen en el modelo |
| Sensibilidad de la envolvente, Nivel compuesto | Menú, desactivado con su motivo | ⬜ No existen |

Nada de esto afirma haber ejecutado VEGAS: la evidencia es la tabla de cadenas y los recursos del ejecutable
instalado, y la comprobación funcional es la suite de pruebas de Corte15. La fila de *Mantener relación de
aspecto* se actualizó en la ronda 20: en la ronda 16 solo se anotaba en el modelo y ahora la aplica el
compositor, con el rótulo tomado de esa misma tabla de cadenas.

## 7. Ronda 18: el catálogo de transiciones, en los complementos nativos

Para ampliar el catálogo de transiciones se leyeron las cadenas de los dos complementos nativos que las traen
instalados, `sftrans1.dll` (9 510 720 bytes) y `sfpagepeel.dll` (4 360 000 bytes), con el barrido UTF-16
(`outputs/rea/scan-utf16.mjs`). Es **observación con herramientas corrientes, no evidencia REA**; la identidad
de esos artefactos no se consultó con REA en esta ronda.

Nombres encontrados en español (`outputs/rea/sftrans1-es.txt` y `outputs/rea/sftrans1-catalogo.txt`):

- **Fundidos**: lineal, rápido, lento, suave, brusco.
- **Barridos**: de entrada desde la izquierda/derecha/arriba/abajo y **de salida por la izquierda/derecha/arriba/abajo**.
- **Persianas**: venecianas, «Una persiana vertical», «Cinco persianas verticales», «Siete persianas horizontales»,
  «Persianas en pendiente», «Quince persianas superpuestas», «Muchas persianas torcidas».
- **Remolino / espirales**: «Remolino», «Espiral interior/exterior» con sus cuatro direcciones.
- **Comprimir**: «Comprimir horizontalmente», «Comprimir verticalmente».
- **Círculos centrados**, «Acercar zoom», «Alejar zoom», «VEGAS Spherize», «VEGAS Remolino».
- En `sfpagepeel.dll`, el complemento se llama **«VEGAS PagePeel Video Transitions»**: de ahí el «Despegado de
  página». Sus nombres de preajuste en español no se localizaron en el barrido, así que el rótulo de Corte 15 es
  el del catálogo traducido, no una cadena copiada del binario.

De esa lista se implementaron **diecisiete transiciones más** (el catálogo pasa de 19 a 36) con geometría real:
fundido suave y rápido, los cuatro barridos de salida, iris circular y rombo, comprimir desde arriba y desde
abajo, las tres persianas nuevas, acercar y alejar zoom, la espiral exterior y el despegado de página. Lo que no
es idéntico al original se avisa en la pista del botón: los barridos de salida se reproducen como la entrada por
el lado contrario —porque en este modelo la transición es la **entrada** del evento—, el rombo es un añadido de
Corte 15 (no aparece con ese nombre en el catálogo), y el zoom, el remolino y el despegado no llevan el desenfoque
de movimiento ni el doblez con volumen de los originales.

Un detalle que salió al probarlas: el **tablero cuadriculado** (que ya existía desde la ronda de composición) no
llegaba a cubrir el fotograma antes del último instante, porque su última casilla tenía el umbral exactamente en
1; la prueba nueva que recorre todo el catálogo lo detectó y quedó corregido (el último cuadro entra al 98 % de
la transición).

