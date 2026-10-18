# Corte 15 → clon funcional de VEGAS Pro 15: evaluación CTO y plan de compatibilidad

Documento de dirección técnica. Responde a: similitud estimada, componentes que faltan y que fallan,
refactorizaciones, hoja de ruta A–E con archivos/clases/código sugerido/riesgo/prioridad, y un plan de ejecución
paso a paso.

Base de la evaluación (todo verificable en el repositorio):

| Fuente | Qué aporta | Estado |
|---|---|---|
| Código actual | 37 módulos de dominio (`lib/editor`) + 17 de interfaz (`components/editor`), 335 pruebas unitarias en verde, 73 flujos E2E × 4 motores (268 correctas, 24 omitidas, 0 fallos) | medido en esta sesión |
| `ARQUITECTURA-FASE1.md` | arquitectura reconstruida, modelo de dominio, contratos, 22 componentes con prioridad | entregado |
| Informe REA (`ANALISIS-REA-VEG.md`) | contenedor `.veg`, tabla de 40 clases en el ejecutable, módulos del binario, automatización | entregado |
| Matriz funcional (`FEATURES.md`) | **197 filas**: 174 ✅ (88,3 %) · 9 🟡 · 13 ⬜ · 2 🌐 | contado sobre el archivo con `outputs/rea/contar-matriz.ts` |
| Sondas | `npm run test:perf` (fotogramas reales), `npm run test:capabilities` | medido |

Estado del árbol **en el momento de escribir esto** (remedido, no recordado): `npm test` **335/335**,
`npx tsc --noEmit` **0 errores**, `npm run lint` **4 errores y 16 avisos, todos en la ventana de recorte de evento
que otra línea de trabajo tiene en curso** (`event-pan-crop.tsx`). La última pasada completa de navegador fue
**268 correctas / 24 omitidas / 0 fallos** en 4 motores. Es decir: el producto está sano y **lo que está rojo es
trabajo a medias de otra rama**, no una regresión de este diagnóstico.

---

## 1. Similitud estimada

### 1.1 Método (para que el número sea auditable, no una opinión)

No hay una métrica objetiva de «parecido» entre dos programas. Lo que sí se puede hacer es **declarar la rúbrica,
ponderar por área y publicar la cuenta**. Dos rúbricas independientes:

- **Funcional**: 15 áreas de producto de un NLE. Peso = importancia para el uso diario y visibilidad en VEGAS 15.
  Valor = porcentaje del área cubierto por Corte 15, con su evidencia (matriz, huecos §13 de `FEATURES.md`, REA).
- **Arquitectónica**: 13 preocupaciones de arquitectura. Peso = centralidad en la arquitectura reconstruida
  (capítulo 1 de `ARQUITECTURA-FASE1.md`). Valor = cuánto de esa preocupación está resuelto con una pieza propia.

### 1.2 Rúbrica funcional

| # | Área | Peso | Valor | Motivo del valor |
|---|---|---|---|---|
| F1 | Edición de línea de tiempo (mover, recortar, ripple, slip/slide, tres puntos, imán) | 15 | **92** | todo implementado y con E2E; faltan varias regiones/selecciones con nombre y campos de selección editables (§13.13) |
| F2 | Modelo de proyecto y persistencia nativa | 8 | **88** | `.corte15` versionado y validado; falta la paridad con `.veg` (Fase B) |
| F3 | Composición (transformaciones, recorte, fusión, 3D, máscaras libres) | 15 | **78** | 8 modos de fusión, Pan/Crop completo, 3D, máscaras con pluma; faltan manejadores Bézier y seguimiento de función |
| F4 | Efectos de vídeo | 8 | **45** | 10 del catálogo propio frente a la familia extensa de VEGAS (color, curvas, convolución, grano…) (§13.5) |
| F5 | Transiciones | 6 | **95** | 36 en 8 familias, sacadas del catálogo real de `sftrans1.dll`/`sfpagepeel.dll` |
| F6 | Títulos y texto | 8 | **85** | plugin «Títulos & Texto» casi completo (anclaje, animaciones, karaoke, plantillas, posiciones) |
| F7 | Audio: mezcla, buses, tomas, envolventes | 12 | **70** | cadena evento→pista→bus→maestro con pruebas muestra a muestra; sin VST/OFX, sin 5.1, LUFS aproximada (§13.10) |
| F8 | Medios: importación, proxies, captura | 8 | **40** | decodifica y mide de verdad; sin proxies, *device explorer* ni captura (§13.11) |
| F9 | Render y exportación | 10 | **62** | MP4/WebM/WAV reales verificados con ffprobe; sin GPU, sin streaming a disco, sin segundo plano, sin plantillas persistentes (§13.12) |
| F10 | Intercambio y formatos externos | 6 | **55** | importa XML/EDL y analiza `.veg`; no exporta XML/EDL ni importa `.pproj` (§13.14) |
| F11 | Automatización / scripting | 4 | **35** | sin host de scripts propio; puente con VEGAS y WebMCP |
| F12 | Interfaz y experiencia (menús, ventanas, atajos) | 10 | **80** | ventanas flotantes, menús de VEGAS, atajos, ruedas, diálogos; sin acoplar/apilar ventanas ni espacios de trabajo guardados (§13.3) |
| F13 | Color profesional y formatos de cámara (OCIO, ACES, RAW, XDCAM) | 6 | **15** | el ejecutable importa OpenColorIO; aquí no hay gestión de color |
| F14 | Complementos de terceros (VST/OFX) | 6 | **0** | imposible en navegador; declarado en la interfaz |
| F15 | Grabación de discos y E/S de hardware | 4 | **0** | fuera de alcance |

**Funcional = Σ(peso × valor) / Σ(peso) = 8 004 / 126 = 63,5 %**

### 1.3 Rúbrica arquitectónica

| # | Preocupación | Peso | Valor | Motivo del valor |
|---|---|---|---|---|
| A1 | Modelo de dominio (grafo, tipos, invariantes) | 15 | **85** | `Project/Track/Event/Media/…` completos con 17 invariantes; falta el modelo de tomas/subclips/enlaces |
| A2 | Serialización y formatos | 10 | **55** | esquema propio versionado y validado; `.veg` sólo lectura |
| A3 | Motor de línea de tiempo | 15 | **80** | operaciones puras probadas; **sin índices por tiempo** (se recorre la lista completa de eventos por fotograma) |
| A4 | Composición de vídeo | 15 | **70** | Canvas 2D por CPU, determinista, mismo código para vista y archivo; sin GPU ni hilos |
| A5 | Motor de audio | 12 | **72** | mezcla por muestras con buses y envolventes; sin VST/OFX, sin hilos |
| A6 | Pipeline de render/exportación | 10 | **60** | un hilo, en memoria, cancelable y medible; sin trabajadores ni streaming |
| A7 | Host de complementos | 8 | **0** | ausente |
| A8 | Scripting / automatización | 5 | **30** | puente externo, no host |
| A9 | Persistencia y almacenamiento local | 5 | **75** | autoguardado, recuperación, cuota, caché de medios |
| A10 | Arquitectura de presentación | 5 | **60** | React con ventanas flotantes; dos monolitos (`editor.tsx` 1 232 líneas, `event-pan-crop.tsx` 1 335) |
| A11 | Pruebas y observabilidad | 5 | **85** | 335 unitarias, 73 E2E × 4 motores, sondas de rendimiento y capacidades |
| A12 | Gestión de color | 3 | **10** | sólo correcciones por canal |
| A13 | Multi-hilo y GPU | 2 | **0** | todo en el hilo principal |

**Arquitectónica = Σ(peso × valor) / Σ(peso) = 6 819 / 110 = 62,0 %**

### 1.4 Resultado y lectura

| Métrica | Estimación | Rango razonable |
|---|---|---|
| **Similitud arquitectónica** | **62 %** | 55–70 % |
| **Similitud funcional** | **63 %** | 55–70 % |

Cómo leer el número, sin trampa:

- **No es un 90 %.** El 88,3 % ✅ de la matriz de `FEATURES.md` es la cobertura de **su propio alcance declarado**
  (197 filas que el proyecto decidió afrontar), no del producto VEGAS 15 completo. Comparar con VEGAS entero baja
  el número a ~63 %.
- **El núcleo está.** Si se pondera por «lo que un editor usa todos los días» (F1, F3, F7, F12, F2 y A1, A3, A4,
  A5), la media ponderada sube a **~79 %** (9 283 / 117): la edición, la composición y la mezcla son de verdad, con
  pruebas de píxeles y de muestras.
- **La periferia no está**, y dos de sus piezas son **imposibles** en un navegador (complementos nativos y
  grabación/hardware), no «pendientes». Eso pone un techo duro de ~92 % funcional y ~93 % arquitectónico: no se
  puede llegar al 100 % sin salir del navegador.
- La distancia entre ambos números y el techo es, en gran medida, **un problema de formato** (`.veg`), no de motor.

---

## 2. Componentes faltantes

Ordenados por impacto en la compatibilidad. La columna «evidencia» remite al hueco documentado.

| # | Componente | Área | Impacto | Evidencia | Fase |
|---|---|---|---|---|---|
| M1 | **Escritura de `.veg`** (serializador del grafo con sus 40 clases) | formato | **crítico** | `ANALISIS-REA-VEG.md` §5; §13.15 | **B** |
| M2 | **Semántica de los campos del `.veg`** (pista, evento, claves, efectos, render) | formato | **crítico** | §2.2-§2.3 del informe REA; **no determinado** | **B** |
| M3 | **Índices de línea de tiempo** (`eventsByTrack`, `eventsByTime`, `mediaUsage`) | motor | alto | §5.3 de la arquitectura; hoy `compose` recorre todos los eventos por fotograma y `mix` filtra la lista por pista | **C** |
| M4 | **Varias regiones y selecciones con nombre**; campos editables de inicio/fin/duración | edición | medio | §13.13 | C |
| M5 | **Subclips, tomas múltiples y enlaces de sincronización** (modelo + interfaz; hoy el menú los apaga) | modelo | alto | §13.19 | C |
| M6 | **Host de complementos VST/OFX** | plugins | **imposible** | §13.10, §13.15 | — (declarado) |
| M7 | **Manijas Bézier de máscaras y de curvas de clave** | composición | medio | §13.9 | D |
| M8 | **Seguimiento de función (motion tracking)** | composición | bajo | §13.9 | D |
| M9 | **Catálogo de efectos ampliado** (color, curvas, convolución, grano, luz de relleno…) | efectos | alto | §13.5 | D |
| M10 | **Render en segundo plano con trabajadores** y cola que sobrevive a recargar | render | alto | §13.12 | **D** |
| M11 | **Escritura por streaming a disco** (File System Access) | render | medio | §13.12 | D |
| M12 | **Plantillas de render persistentes** (preajustes reutilizables) | render | bajo | §13.12 | D |
| M13 | **Gestión de color (OCIO/ACES) y scopes** | color | medio | F13; el ejecutable importa `OpenColorIO.dll` | D |
| M14 | **Exportación a XML/EDL** e importación `.pproj` | intercambio | medio | §13.14 | C |
| M15 | **Proxies y *device explorer*** | medios | medio | §13.11 | — (P3) |
| M16 | **Acoplar/apilar ventanas y espacios de trabajo guardados** | interfaz | medio | §13.3 | C |
| M17 | **Host de scripting propio** (equivalente a `ScriptPortal`) | automatización | bajo | §1.1 del informe REA; hoy hay puente + WebMCP | E |
| M18 | **Audio multicanal (5.1/7.1)** y salida AC-3 | audio | bajo | §13.10 | — (P3) |
| M19 | **Grabación de discos (DVD/BD)** y E/S de hardware | periferia | **imposible** | módulos `discdrv.dll` del ejecutable | — (declarado) |
| M20 | **Promover marcadores del material y subtítulos CEA-608**; exportar SCC | periferia | bajo | §13.18 | — (bloqueado por APIs del navegador) |

**Los dos únicos ausentes que impiden decir «clon»** son **M1 y M2** (formatos) y **M6/M19** (imposibles por
plataforma). Todo lo demás es trabajo incremental sobre piezas que ya existen.

---

## 3. Componentes defectuosos

Defectos **con evidencia medida**, no impresiones. Severidad: **S1** rompe una función prometida · **S2** degrada
calidad o rendimiento · **S3** deuda de mantenimiento.

| # | Defecto | Evidencia (medida en esta sesión) | Causa | Sev. |
|---|---|---|---|---|
| **D1** | **Con relleno final de ceros el árbol de bloques queda vacío** aunque el proyecto esté íntegro | **reproducido en esta sesión**: al fixture de 95 248 B se le añaden 18 800 ceros → `chunks.total 187` pero **`top 0`** y el aviso «No se pudo recorrer el árbol de bloques»; el mismo archivo sin relleno da `top 9`, 4 medios, 2 títulos y 29,97 fps (`outputs/rea/veg-fallo.ts`, variantes en `outputs/rea/veg-variantes/`). El `.veg` real del usuario (114 056 B, 98,7 % ceros) es el caso de campo | `vegChunkChain` sólo acepta una cadena cuyo final caiga **en ±1 byte del límite**, y `analyzeVeg` pasa como límite `sizeMatches ? declaredSize : bytes.length` (`veg.ts:141`): con relleno el último bloque real acaba antes del final del archivo y ningún candidato encadena. El valor declarado **no** es la causa por sí solo: con `declarado = 24` y sin relleno el lector sigue devolviendo `top 9` | **S1** |
| **D2** | **La firma se describe como «`riff.`» de 5 bytes**, y esa lectura se propaga a comentarios, mensajes y `VEG_EXPLANATION` | Hexdump del fixture (`outputs/rea/veg-estructura.ts`): `72 69 66 66 │ 2e 91 cf 11 a5 d6 28 db 04 c1 00 00` → son `riff` + **12 bytes de clase** (`11cf912e-d6a5-db28-04c1-0000` en orden GUID); el `.` es el **primer byte de la clase**, igual que el `/` que el lector ve en cada bloque es el primer byte de la clase `11cf912f` | descripción heredada de la primera lectura; el lector funciona porque `tagAt` casa 5 caracteres con `/^[A-Za-z]{4}\/$/` | S2 |
| **D3** | **`isVeg` ata la clase exacta `11cf912e` y lanza excepción** para cualquier variante de la familia o de otro escritor | `veg.ts:29` compara `bytes[4] === 0x2e`; `analyzeVeg` lanza error en `:137`. El contenedor admite la familia `11cf912e/2f/30/31` (medido en el ejecutable) | validación por byte fijo en vez de por estructura | S2 |
| **D4** | **`declaredSize` se lee como `u32`** aunque el informe REA documenta un `u64` que incluye la cabecera | `veg.ts:138` → `u32(bytes,0x10)`; el fixture declara 95 248 (cabe en 32 bits) pero un `.veg` > 4 GiB se truncaría en silencio | lectura de 32 bits sobre un campo de 64 | S3 |
| **D5** | **Sin índice temporal**: cada fotograma recorre **todos** los eventos del proyecto (`compositor.ts:234`, ya agrupados por pista en una sola pasada) y busca el medio con `p.media.find` **por evento** (`:243`); el mezclador, peor: `p.events.filter` y `silencedIds(p)` **dentro del bucle de pistas** (`audio.ts:42-43`), más `p.media.find` por evento (`:47`) → O(pistas × eventos) por bloque de 20 ms | con 15 eventos el zoom deja p95 50 ms y 6 fotogramas largos; no hay medición con 500 eventos (D10) | falta un índice por tiempo (M3); el filtrado por pista del compositor ya se corrigió | **S2** |
| **D6** | **El autoguardado serializa el proyecto entero** (miniaturas en base64 + 1 024 picos por medio) | no medido a escala; el autoguardado actual no deja fotogramas largos con 2 medios | sin presupuesto de tamaño ni separación de la copia pesada | S2 |
| **D7** | **Dos implementaciones de la ventana de recorte en paralelo** (`pan-crop.tsx` 976 líneas importado; `event-pan-crop.tsx` 1 335 líneas sin conectar; `pan-crop-icons.tsx`) | `editor.tsx` importa `./pan-crop`; `event-pan-crop.tsx` exporta `EventPanCrop` sin uso | refactor en curso de otra línea de trabajo | **S1** (riesgo de divergencia) |
| **D8** | **`editor.tsx` monolítico** (1 232 líneas: comandos, diálogos, paneles, línea de tiempo, teclado y ratón) | tamaño del archivo; el despacho de comandos es un `if/else` de ~40 ramas | sin extracción por dominio | S3 |
| **D9** | **`validation.ts` en una sola expresión** (esquema Zod de 26 líneas, toda la validación en una línea) | el archivo mide 26 líneas | compacidad heredada | S3 |
| **D10** | **Rendimiento de proyectos grandes sin medir** (1080p, muchas pistas, efectos no neutros) | §13.14 | no hay sonda de exportación a escala | S2 |
| **D11** | **Fragilidad de pruebas E2E** ya corregida dos veces (desplegable de transición, divisor de medidores) | historial de las rondas 20, 21 y 25 en `VERIFICACION.md` | esperas implícitas en gestos con ratón | S3 |
| **D12** | **LUFS aproximada** presentada junto a medidas exactas | §13.10 del propio documento | falta el banco EBU | S3 |

Lo importante de esta tabla: **los cuatro primeros son el `.veg`** y **D1 es el único que rompe una función
prometida hoy** (leer un proyecto guardado por VEGAS); D7 es un riesgo vivo de la línea de trabajo paralela; el
resto es deuda conocida y **documentada en su sitio**, que es la mitad del trabajo.

Y un hallazgo que cambia la Fase A: **el archivo que falla no está en el repositorio**. El fixture versionado
(`tests/fixtures/vegas-real.veg`) es el que funciona, así que **ninguna prueba puede detectar D1 hoy**. Por eso
A6 —convertir el caso de campo en fixture— es requisito, no adorno: sin él, arreglar el lector es un acto de fe.

---

## 4. Refactorizaciones recomendadas

| Id | Refactorización | Archivos | Motivo | Riesgo | Esf. |
|---|---|---|---|---|---|
| **R1** | **Documento `.veg` de ida y vuelta**: separar «leer el contenedor» de «interpretar campos», conservando los bytes desconocidos | `lib/editor/veg.ts` → nuevo `lib/editor/veg-document.ts` | habilita Fase A/B sin inventar campos: se puede reescribir un `.veg` byte a byte | bajo si se conserva la API actual (`analyzeVeg`) | M |
| **R2** | **Índice de línea de tiempo** como módulo propio con memoización por referencia | nuevo `lib/editor/timeline-index.ts`; consumidores `compositor.ts`, `audio.ts`, `editor.tsx` | quita el recorrido completo por fotograma y el filtrado por pista del mezclador (D5, M3) | medio: hay que invalidar bien | M |
| **R3** | **Partir `editor.tsx`** en `use-project-commands`, `use-timeline-input`, `use-dialogs` y vistas | `components/editor/editor.tsx` | D8; hoy un cambio de teclado toca un archivo de 1 200 líneas | medio (E2E lo cubre) | L |
| **R4** | **Unificar la ventana de recorte** en una sola implementación (evento y pista por composición, no copia) | `pan-crop.tsx` + `event-pan-crop.tsx` + `pan-crop-icons.tsx` | D7 | **alto** (coordinación con la línea paralela) | L |
| **R5** | **Capa de «documento» común** para formato propio y `.veg`: un `Project` sale y entra por un `DocumentCodec` | nuevo `lib/editor/codec.ts`; `validation.ts`, `interchange.ts`, `veg*.ts` | hoy cada formato reimplementa la conversión; el códec da el punto único de validación e informe | medio | M |
| **R6** | **Presupuesto de autoguardado**: separar la copia pesada (miniaturas/picos) a IndexedDB y guardar sólo el modelo en `localStorage` | `lib/editor/storage.ts`, `editor.tsx` | D6 | bajo | S |
| **R7** | **Motor de render trasladable a trabajador**: `compose`/`mix` ya son funciones puras respecto del DOM si se les pasa `createCanvas` | `compositor.ts`, `export.ts`, nuevo `render-worker.ts` | M10 | medio (WebCodecs en trabajador; `OffscreenCanvas`) | L |
| **R8** | **Catálogo de efectos por tabla** (`kind → {params, apply}`) | `lib/editor/effects.ts` | M9 sin tocar el modelo ni la interfaz | bajo | S |
| **R9** | **Reglas de arquitectura automatizadas**: lint de importaciones por capas (R1 de la arquitectura) | `.eslintrc`/`eslint.config` | evita que la capa de dominio use el DOM | bajo | S |
| **R10** | **Sonda de exportación a escala** (1080p, N pistas, efectos) dentro de `test:perf` | `tests/perf.spec.ts` | D10; sin número no hay decisión | bajo | S |

---

## 5. Hoja de ruta

Prioridad: **P0** imprescindible · **P1** necesaria para «clon» · **P2** calidad · **P3** opcional.
Riesgo: **B** bajo · **M** medio · **A** alto.

### Fase A — Mínimos cambios para aumentar compatibilidad

Objetivo: que **cualquier** `.veg` real se lea bien y el proyecto sepa decir qué es. No pretende escribir `.veg`.

| Id | Tarea | Archivos afectados | Clases/tipos | Código sugerido (esquema) | Riesgo | Prio |
|---|---|---|---|---|---|---|
| **A1** | **Encadenado anclado en el primer bloque de primer nivel, no por final exacto**: recorrer candidatos `list` en orden ascendente y aceptar la primera cadena que encadene ≥ 3 bloques y no se pase del final útil. Deja de exigir que la cadena acabe en el límite, que es lo que hoy rompe D1. **Ojo**: «quedarse con la cadena más larga» es la solución equivocada (devuelve 48 sub-bloques anidados) | `lib/editor/veg.ts` | `vegChunkChain`, `VegChunk` | §5.1 | B | **P0** |
| **A2** | **Límite efectivo = último byte distinto de cero**: no recorrer 100 KB de ceros y documentar por qué (búfer fijo del escritor de VEGAS) | `lib/editor/veg.ts` | `effectiveEnd` | §5.1 | B | **P0** |
| **A3** | **`declaredSize` como `u64` y sólo como dato**: se informa y se avisa de la discrepancia, nunca se usa como tope del encadenado | `lib/editor/veg.ts` | `analyzeVeg` | §5.1 | B | **P0** |
| **A4** | `isVeg` por estructura, no por byte fijo: `riff` + clase de 12 B + al menos un bloque `list` válido | `lib/editor/veg.ts` | `isVeg` | §5.1 | B | **P0** |
| **A5** | Corregir la descripción del formato (comentarios, `VEG_EXPLANATION`, mensaje de rechazo): `riff` + **clase GUID de 12 B**, no «firma de 5 bytes» | `veg.ts`, `interchange.ts` | `VEG_LIMITS` | prosa | B | P1 |
| **A6** | **Fixtures de regresión**, porque el archivo que falla no está en el repositorio: el caso ya está **reproducido de forma determinista** en `outputs/rea/veg-variantes/c-declarado-24-mas-ceros.veg` (fixture + 18 800 ceros + `declarado = 24`) → copiarlo a `tests/fixtures/` y afirmar `chunks.top.length > 0`, 4 medios, 2 títulos, 29,97 fps; añadir el `.veg` real del usuario como fixture **local no versionado** si se quiere cobertura de campo | `tests/veg.test.ts` (nuevo), `tests/fixtures/` | — | `assert.equal(a.chunks.top.length, 9)` en el caso con relleno | B | **P0** |
| **A7** | Metadatos del `.veg` al modelo: al abrir, ofrecer «crear proyecto con este formato y estos medios» (fps, muestreo, duración si hay XMP) | `editor.tsx`, `interchange.ts` | `Interchange`, `ImportReport` | `{project, report}` con `warnings` por campo dudoso | M | P1 |
| **A8** | Detectar `.pproj`/`.veg_archive` y **rechazarlos con motivo** (sin inventar) | `interchange.ts` | `detectInterchange` | nueva rama con mensaje | B | P2 |

**Criterio de salida de A**: `analyzeVeg` sobre los cinco archivos (el del usuario si está, el fixture original, el
de relleno sintético, uno con `declarado = 24` sin relleno y el falso) devuelve: cadena de bloques no vacía en los
cuatro válidos **con el mismo número de bloques que sin relleno**, informe de medios idéntico, y rechazo explicado
en el falso. Sin cambios en el resto del producto.

#### 5.1 Código sugerido de la Fase A

`lib/editor/veg.ts` — reemplazo de la detección y del encadenado (esquema; conserva la API pública):

```ts
// Un .veg guardado por VEGAS se escribe en un búfer fijo y deja ceros al final (98,7 % en el archivo de campo).
// El tamaño útil es el último byte distinto de cero, no el tamaño del archivo.
const effectiveEnd = (bytes: Uint8Array) => {
  for (let at = bytes.length - 1; at >= 0; at--) if (bytes[at] !== 0) return at + 1;
  return 0;
};
// Cabecera de bloque (24 B): «list» (4) + clase GUID (12) + tamaño u64 (8) que incluye la cabecera.
const blockSize = (bytes: Uint8Array, at: number) => {
  if (at + 24 > bytes.length) return 0;
  if (bytes[at] !== 0x6c || bytes[at + 1] !== 0x69 || bytes[at + 2] !== 0x73 || bytes[at + 3] !== 0x74) return 0;
  const size = u64(bytes, at + 16);
  return size >= 24 ? size : 0;
};
// Cadena de hermanos de primer nivel: la primera que empieza más arriba y encadena ≥ 3 bloques sin
// pasarse del final útil. No se exige que acabe en el tamaño declarado (eso es lo que rompe D1).
export function vegChunkChain(bytes: Uint8Array, _declaredSize?: number) {
  const end = effectiveEnd(bytes);
  let fallback: VegChunk[] = [];
  for (let start = 0x18; start + 24 <= end; start++) {
    if (!blockSize(bytes, start)) continue;
    const chain: VegChunk[] = [];
    let at = start;
    while (at + 24 <= end && chain.length < 8192) {
      const size = blockSize(bytes, at);
      if (!size) break;
      chain.push({ offset: at, tag: 'list/', size, children: 0 });
      at += size;
    }
    if (chain.length >= 3 && at <= end + 64) return chain;
    if (chain.length > fallback.length) fallback = chain;
  }
  return fallback.length >= 3 ? fallback : [];
}
// La cabecera es «riff» + clase GUID (12 B) + tamaño u64; el `.` que se leía como firma es el primer
// byte de la clase 11cf912e, igual que el `/` de cada bloque es el primero de 11cf912f.
export function isVeg(bytes: Uint8Array) {
  if (bytes.length < 0x30) return false;
  if (bytes[0] !== 0x72 || bytes[1] !== 0x69 || bytes[2] !== 0x66 || bytes[3] !== 0x66) return false;
  return vegChunkChain(bytes).length > 0;
}
```

Y en `analyzeVeg`, el tamaño declarado pasa a ser **dato informativo**, leído completo:

```ts
const declaredSize = u64(bytes, 0x10);          // era u32: techo de 4 GiB y truncamiento silencioso (D4)
const sizeMatches = declaredSize === bytes.length;
const chain = vegChunkChain(bytes);             // ya no depende del declarado (D1)
```

**Verificado antes de proponerlo** (`outputs/rea/veg-encadenado.ts`): los cinco archivos devuelven **9 bloques
con exactamente los mismos offsets** (`0xba0 0xc08 0x3d90 0x45d0 0x4610 0x16328 0x163a8 0x171d0 0x171f8`), incluidos
los tres con relleno de ceros que hoy dan **0**. Y una advertencia de diseño que salió de medirlo: la variante
ingenua «quedarse con la cadena más larga» es **incorrecta** — devuelve 48 bloques empezando en `0x4b48`, porque
un tramo de sub-bloques anidados de 1 312 B también encadena aritméticamente hasta el final. El anclaje en el
primer bloque de primer nivel no es un detalle: es lo que distingue la raíz del árbol de sus ramas.

### Fase B — Compatibilidad total del formato `.veg`

> **Advertencia de dirección, antes de nada.** «Compatibilidad total» **no es alcanzable con los artefactos
> disponibles**: el intérprete del formato es `vegas150k.dll` (no proporcionada, sin desensamblador en este
> equipo) y la semántica de las 40 clases no se puede inferir de dos archivos. Lo que sí es alcanzable, y es lo
> que propongo como «B», son **cuatro entregables** que llevan la compatibilidad de 0 a «ida y vuelta verificada
> contra VEGAS», con la boca de la escritura donde debe estar: en VEGAS.

Requisito material: **una máquina con VEGAS Pro 15 instalado** (ésta lo está, según las rondas anteriores) para
el banco diferencial y el puente.

| Id | Tarea | Archivos | Clases/tipos | Código sugerido | Riesgo | Prio |
|---|---|---|---|---|---|---|
| **B1** | **Documento `.veg` byte a byte**: leer cabecera, bloques con su payload **crudo**, cadenas y posiciones; sin interpretar campos | nuevo `lib/editor/veg-document.ts` | `VegDocument`, `VegBlock{offset,classId,payload,raw}` | `parseVegDocument(bytes)` + `serializeVegDocument(doc)` que **recalcula tamaños** y reproduce el archivo idéntico | M | **P0** |
| **B2** | **Banco diferencial** con el puente: script que crea/abre un proyecto en VEGAS, cambia **una** variable (mover un evento 1 s, cambiar un nivel, añadir una clave, un efecto, una transición) y guarda; se difuminan los dos `.veg` y se anota **qué offset cambia con qué variable** | nuevo `scripts/veg-banco-diferencial.mjs` + `outputs/rea/veg-banco/*.json` | — | por cada variante: `{ variable, offset, bytes antes/después }`; con N variantes se aísla el campo | M | **P0** |
| **B3** | **Mapa de campos** derivado de B2: por cada clase, sus campos con tipo, unidad y significado **observado**; se documenta en `ANALISIS-REA-VEG.md` §2 como tabla nueva (lo **[?]** pasa a **[O]** sólo cuando B2 lo demuestre) | `ANALISIS-REA-VEG.md`, `lib/editor/veg-fields.ts` | `VegFieldMap` | tabla `classId → [{offset, type, unit, meaning, evidence}]` | M | **P1** |
| **B4** | **Escritor**: `Project → VegDocument` para lo que B3 tenga mapeado; lo no mapeado se **conserva** del archivo original (edición conservadora). Validación: el `.veg` escrito se abre en VEGAS por el puente y su lectura reconstruye el mismo montaje | `lib/editor/veg-writer.ts`, `veg-bridge.ts` | `writeVeg(project, base?)` | `const doc = base ?? seedProject(); applyFields(doc, project); return serialize(doc)` | **A** | **P1** |
| **B5** | **Convenciones de escritor**: relleno de ceros configurable, `declared@0x10`, bloque de proyecto, XMP opcional | `veg-writer.ts` | — | opciones `{ padTo?: number, xmp?: boolean }` | B | P2 |
| **B6** | **Puerta de calidad**: suite que escribe un proyecto, lo lee, lo abre en VEGAS y compara (duración, nº de eventos, nombres, niveles, claves) de forma automática | `tests/veg-roundtrip.spec.ts` (E2E, requiere VEGAS) | — | `expect(vegasReadReport.events).toBe(project.events.length)` | A | **P1** |

**Criterio de salida de B**: los cuatro entregables con B6 en verde **en la máquina con VEGAS**; en cualquier
otra máquina, el producto sigue diciendo la verdad (lectura + puente) y B queda documentado como dependiente del
entorno. **Plan de contingencia** si no hay VEGAS disponible: cerrar B1 y dejar B2–B6 como «bloqueado», sin
falsos positivos en la matriz.

### Fase C — Motor de timeline equivalente

| Id | Tarea | Archivos | Clases/tipos | Código sugerido | Riesgo | Prio |
|---|---|---|---|---|---|---|
| **C1** | **Índice de línea de tiempo** con memoización por referencia y consulta por tick | nuevo `lib/editor/timeline-index.ts`; `compositor.ts` y `audio.ts` lo consumen | `TimelineIndex`, `eventsAt(tick)`, `eventsOf(trackId)` | `const index = timelineIndex(project); for (const e of index.eventsAt(tick)) …` | M | **P0** |
| **C2** | **Regiones y selecciones con nombre** (varias), con campos editables y persistencia | `project.ts`, `validation.ts`, `editor.tsx` (panel de regiones) | `NamedRegion` | `regions?: {id,name,start,end}[]` + migración desde `region` | M | P1 |
| **C3** | **Subclips** (medio + rango con nombre) y **tomas múltiples** por evento | `project.ts` (`Media.subclipOf`), `validation.ts`, `media.ts`, interfaz de medios | `Subclip`, `Take[]`, `Event.takeIndex` | `type Take = { mediaId: string; name: string }` | A | P1 |
| **C4** | **Enlaces de sincronización** (`Enlace sinc ▸`), distintos del vínculo de grupo | `project.ts` (`syncGroups`), `editor.tsx` (menú activo) | `SyncGroup` | `syncEvents(project, ids, anchorId, mode)` ya existe: falta el contenedor persistido | M | P2 |
| **C5** | **Mover/pegar con ripple completo** y modos por pista (hoy hay tres modos globales) | `project.ts`, `editor.tsx` | `Ripple` por pista | ampliar `Ripple` a `{mode, tracks}` | M | P2 |
| **C6** | **Acoplar/apilar ventanas + espacios de trabajo** guardados | `editor.tsx`, `globals.css` | `Layout`, `Dock` | `{panels: {id, dock: 'left'|'float', size}[], order}` en `localStorage` | M | P2 |
| **C7** | **Exportar XML/EDL** (cerrar el intercambio en los dos sentidos) | `interchange.ts` | `buildFcpXml(project)`, `buildEdl(project)` | reutiliza el mapa del importador a la inversa | M | P1 |
| **C8** | **Historial por deltas** cuando el proyecto sea grande | `project.ts` (History) | `History` | instantánea cada N gestos + deltas entre medias | M | P2 |

**Criterio de salida de C**: con 500 eventos y 20 pistas, un fotograma de vista previa se compone en ≤ 16,7 ms
(medido con `test:perf`) y el índice se invalida correctamente en 100 % de los casos (prueba que compara índice
y recorrido completo tras 1 000 ediciones aleatorias).

### Fase D — Motor de render equivalente

| Id | Tarea | Archivos | Clases/tipos | Código sugerido | Riesgo | Prio |
|---|---|---|---|---|---|---|
| **D.1** | **Render en trabajador** (`OffscreenCanvas` + WebCodecs) con su propia biblioteca de medios (los `File` sí son clonables) | nuevo `lib/render/render-worker.ts`, `export.ts`, `compositor.ts` (`ComposeOptions.createCanvas`) | `RenderRequest`, `RenderProgress` | `const worker = new Worker(new URL('./render-worker.ts', import.meta.url), {type:'module'}); worker.postMessage({files, settings})` | **A** | **P0** |
| **D.2** | **Cola persistente** (sobrevive a recargar) y en segundo plano | `batch.ts`, `editor.tsx`, IndexedDB | `BatchJob` con `status` persistido | `queue.save()` / `queue.restore()` | M | P1 |
| **D.3** | **Streaming a disco** con `showSaveFilePicker` cuando exista; si no, memoria + aviso | `export.ts` | `WritableSink` | `const sink = await picker(); await sink.write(chunk)` | M | P2 |
| **D.4** | **Plantillas de render persistentes** (preajustes) | `export.ts`, `storage.ts` | `RenderPreset` | `{name, settings}` en `localStorage` | B | P2 |
| **D.5** | **Catálogo de efectos ampliado** por tabla (color, curvas, grano, convolución) | `effects.ts` (+ pruebas de píxeles) | `EFFECTS` | `{kind, params, apply(ctx, layer, p, scale)}` | M | P1 |
| **D.6** | **Manijas Bézier** de máscaras y de curvas | `mask.ts`, `pancrop.ts`, `pan-crop*.tsx` | `MaskPath`, `Keyframe` | segmentos `{c1, c2}` por punto/clave | M | P2 |
| **D.7** | **Gestión de color (OCIO-like) y scopes** | nuevo `lib/editor/color.ts` | `ColorConfig`, `Lut` | `applyLut(frame, lut)` antes de la fusión | M | P3 |
| **D.8** | **Sonda de exportación a escala** (1080p, 10 pistas, efectos no neutros) con umbral | `tests/perf.spec.ts` | — | `expect(report.export1080.p95).toBeLessThan(50)` | B | P1 |

(Los identificadores de tarea de esta fase llevan punto — `D.1`…`D.8` — para no confundirlos con los **defectos**
`D1`…`D12` del capítulo 3.)

**Criterio de salida de D**: una exportación 1080p de 1 minuto no bloquea la interfaz (los fotogramas del editor
siguen por debajo de 50 ms) y se cancela en menos de un fotograma; la sonda `D.8` publica los números.

### Fase E — Optimización

| Id | Tarea | Archivos | Riesgo | Prio |
|---|---|---|---|---|
| **E1** | Presupuestos en CI: fotograma de vista previa, zoom, reproducción, exportación, arranque, memoria | `tests/perf.spec.ts`, `package.json` | B | **P0** |
| **E2** | Memoización de `compose` por (tick, versión del proyecto) para la vista previa inmóvil | `compositor.ts`, `editor.tsx` | M | P1 |
| **E3** | Repintado parcial de la línea de tiempo (sólo eventos afectados por la edición) | `editor.tsx` + índice | M | P1 |
| **E4** | Presupuesto de memoria de medios y expulsión de miniaturas | `media.ts`, `storage.ts` | M | P2 |
| **E5** | Arranque: carga diferida de catálogos grandes (transiciones, plantillas, efectos) | `editor.tsx` | B | P2 |
| **E6** | Índices y caché de onda a escala (ya hay escalera de resoluciones) | `waveform*.ts` | B | P2 |

**Criterio de salida de E**: la sonda publica un informe por fase y la CI falla si empeora más de un 20 %.

---

## 6. Plan de ejecución paso a paso

### 6.0 Reglas del programa

1. **Una fase, una rama, una puerta.** No se abre la fase siguiente hasta que la anterior esté en verde
   (`tsc`, `lint`, `test`, `test:browser`, `test:perf`, sonda de codificación).
2. **Nada sale de la matriz sin evidencia**: un componente pasa a ✅ sólo con prueba ejecutada.
3. **Coordinación con la línea de trabajo paralela** (que ahora mismo toca `pan-crop*`, `waveform*`,
   `editor.tsx`, `crop-frame.ts` y añade pruebas): **A, B y C1-C2 evitan `editor.tsx` y `pan-crop*.tsx`** hasta
   que esa línea cierre. R4 se hace al final, con ventana acordada, y con E2E de por medio.

### 6.1 Secuencia

**Sprint 0 — preparación (1–2 días)**
1. Congelar la matriz: exportar las 197 filas con su estado a un `ESTADO-CLON.md` generado, para que las
   siguientes fases midan contra un número fijo.
2. Añadir la sonda de exportación a escala (`D.8`) **antes** de tocar el motor: sin número de partida no se puede
   afirmar mejora.
3. Regla de lint R9 (capas) y presupuestos E1 en modo «publicar sin fallar».

**Sprint 1 — Fase A (3–5 días)**
4. A1–A4 en `veg.ts` con las pruebas nuevas de A6 contra los cinco archivos (original, `declarado = 24`, relleno,
   relleno + declarado real, y el falso). La referencia ya está medida: **9 bloques con los mismos offsets**.
5. A5 textos; A7 metadatos al modelo; A8 rechazos.
6. Puerta de A: `npm test`, `npm run test:browser` e informe del `.veg` con sus 4 medios, 2 títulos y 29,97 fps
   **idéntico con y sin relleno de ceros**.

**Sprint 2 — Fase B, parte 1 (bloqueante por entorno)**
7. B1 `veg-document.ts` con prueba de **ida y vuelta byte a byte** sobre los tres fixtures (sin VEGAS).
8. B2 banco diferencial: requiere la máquina con VEGAS. Si no está, se deja preparado y **se declara bloqueado**.

**Sprint 3 — Fase B, parte 2 (si hay VEGAS)**
9. B2 → B3 (mapa de campos) → B4 (escritor conservador) → B6 (ida y vuelta contra VEGAS).
10. Actualizar `ANALISIS-REA-VEG.md`: cada **[?]** que B2 demuestre pasa a **[O]** con su evidencia; lo que no,
    se queda como **[?]**.

**Sprint 4 — Fase C (2 semanas)**
11. C1 índice + pruebas de equivalencia (índice ≡ recorrido completo) y medición con 500 eventos.
12. C2 regiones con nombre, C7 exportar XML/EDL.
13. C3 subclips/tomas con su interfaz mínima (activando las entradas del menú que hoy están apagadas).

**Sprint 5 — Fase D (2–3 semanas)**
14. `D.1` render en trabajador detrás de detección de capacidades; la ruta actual se queda como respaldo.
15. `D.2` cola persistente, `D.4` plantillas, `D.5` catálogo de efectos, `D.8` umbral en CI.

**Sprint 6 — Fase E (1–2 semanas)**
16. E1–E3 con informe de rendimiento y umbrales; E4–E6 según los números.

**Sprint 7 — cierre**
17. Regenerar `ESTADO-CLON.md`, actualizar las tres rúbricas y publicar el veredicto final (con los números
    medidos, no estimados).

### 6.2 Puertas de calidad (idénticas en todas las fases)

| Puerta | Comando | Umbral |
|---|---|---|
| Tipos | `npx tsc --noEmit` | 0 errores |
| Estilo | `npm run lint` | 0 errores; avisos ≤ 16 (los de hoy; la referencia histórica era 13) |
| Unidad | `npm test` | 100 % en verde, sin pruebas omitidas nuevas |
| Navegador | `npx playwright test --trace=off` | 4 motores, 0 fallos |
| Rendimiento | `npm run test:perf` | reproducción p95 ≤ 16,8 ms y ≤ 2 fotogramas largos; zoom ≤ 6 largos |
| Codificación | `node outputs/probe-encoding.mjs` | 0 archivos con daño |
| Documentación | `FEATURES.md`, `VERIFICACION.md`, `ARQUITECTURA-FASE1.md` | toda fila nueva con su evidencia |

### 6.3 Presupuesto y resultado esperado

| Fase | Duración estimada | Sube funcional | Sube arquitectónica |
|---|---|---|---|
| A | 3–5 días | +3 (63 → 66) | +2 (62 → 64) |
| B (completa, con VEGAS) | 2–3 semanas | +7 (→ 73) | +6 (→ 70) |
| C | 2 semanas | +4 (→ 77) | +7 (→ 77) |
| D | 2–3 semanas | +6 (→ 83) | +8 (→ 85) |
| E | 1–2 semanas | +1 | +2 (→ 87) |

Techo teórico con las imposibilidades declaradas: **92 % funcional** (F14 y F15, 10 puntos de peso, valen 0 para
siempre) y **93 % arquitectónico** (A7, host de complementos, 8 puntos). Lo que estas cinco fases alcanzan es
**~84 % / ~87 %**; la diferencia hasta el techo son decisiones de alcance (más efectos, color, proxies), no
imposibilidades. El 100 % exige complementos nativos, E/S de hardware y grabación de discos, que **no existen en un
navegador**: el clon honesto termina diciendo qué no hace, y eso ya es parte del diseño (decisión D9 de
`ARQUITECTURA-FASE1.md`).

---

## 7. Decisiones que necesitan al usuario

1. **¿Se dispone de una máquina con VEGAS Pro 15 para la Fase B?** Sin ella, B se queda en lectura byte a byte
   (B1) y el resto se declara bloqueado. Es la única decisión que puede mover el techo de compatibilidad de
   formato.
2. **¿Se acepta que VST/OFX, hardware y discos queden fuera?** Si la respuesta es no, hay que replantear el
   producto (proceso nativo, no navegador) y este documento cambia de raíz.
3. **¿Se prioriza el formato (B) sobre el motor (C/D)?** Mi recomendación como CTO: **A → C → D → B**, con B en
   paralelo **sólo** si hay VEGAS. Motivo: el motor aporta valor verificable aquí y ahora; el formato sin el
   intérprete es riesgo puro, y el valor de B se mide contra VEGAS, no contra nuestras pruebas.
4. **¿Quién posee `editor.tsx` y `pan-crop*`** durante las próximas dos semanas? R3/R4 son los únicos trabajos
   que chocan con la línea paralela; sin acuerdo de propiedad, se posponen a la Fase E.
