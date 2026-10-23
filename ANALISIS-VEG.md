# Análisis de `adobe.veg` (VEGAS Pro 15)

Informe del proyecto que enviaste, hecho leyendo el archivo byte a byte. Todo lo que aparece aquí está
comprobado sobre tu archivo; lo que no se pudo determinar se dice explícitamente. El lector está en
`lib/editor/veg.ts` y las comprobaciones automáticas en `tests/ai.test.ts`.

> **Ampliación (2026-10, ronda 26)**: el análisis completo de `REA.veg` y del ejecutable `vegas150.exe` —con el
> contenedor de bloques, la tabla de clases del proyecto en el binario, la arquitectura de módulos y los límites de
> la automatización— está en [`ANALISIS-REA-VEG.md`](ANALISIS-REA-VEG.md). De allí sale una corrección a la firma
> de esta tabla: son `riff` más un identificador de clase de 12 bytes, no `riff.` de 5 bytes.

## 1. Qué es el archivo

| Comprobación | Resultado |
|---|---|
| Firma | `riff.` en los primeros 5 bytes |
| Identificador de clase | GUID tras la firma (`46C429EF-904A-11D2-8722-00C04F8EDB8A` y compañía) |
| Tamaño declarado en `0x10` | `0x00017410` = **95 248 bytes** |
| Tamaño real | 95 248 bytes → **coincide** |
| Bloques `list/` | **187** |
| Bloques de primer nivel | **9**, encadenados por tamaño y cubriendo el archivo exactamente |

La estructura es un árbol de bloques con cabecera de 24 bytes (`list/` + 11 bytes de identificador + tamaño
de 64 bits que incluye la cabecera). Al recorrerla, la suma de los 9 bloques de primer nivel acaba exactamente
en el tamaño del archivo, que es lo que permite validar el recorrido en lugar de adivinarlo:

| Desplazamiento | Tamaño | Bloques hijos |
|---|---|---|
| `0x0BA0` | 104 | 0 |
| `0x0C08` | 12 680 | 0 |
| `0x3D90` | 2 112 | 0 |
| `0x45D0` | 64 | 0 |
| `0x4610` | 72 984 | 178 |
| `0x16328` | 128 | 0 |
| `0x163A8` | 3 624 | 0 |
| `0x171D0` | 40 | 0 |
| `0x171F8` | 536 | 0 |

## 2. Lo que se pudo leer

### Propiedades del proyecto

| Dato | Valor leído | De dónde sale |
|---|---|---|
| Duración | **292,767 s** (4 min 52,8 s) | Paquete XMP incrustado (`xmpDM:duration` 292767 con escala 1/1000) |
| Velocidad de fotogramas | **29,97 fps** (30000/1001) | Doble IEEE-754 `29.97002997003` en la cabecera; confianza alta |
| Resolución | **1920×1080** | Tres pares `1920×1080` consecutivos en la cabecera; los tres coinciden |
| Frecuencia de audio | 48 000 Hz | Entero de 32 bits en `0x4C` |
| Creado | 1904-01-01T00:00Z | XMP `xmp:CreateDate` (fecha nula de VEGAS) |
| Modificado | **2026-10-08T09:48:10-07:00** | XMP `xmp:ModifyDate` |
| Último programa que lo guardó | **Adobe Audition CC 2015.0 (Windows)** | XMP `stEvt:softwareAgent` |

### Medios referenciados (4)

| Archivo | Ruta en tu equipo |
|---|---|
| `Apps.mp4` | `C:\Users\<usuario>\OneDrive\Escritorio\Apps.mp4` |
| `faaah.mp3` | `G:\YouTube\andresibarrali\Efectos de Sonido\faaah.mp3` |
| `Sunlight_on_Still_Water.mp3` | `G:\YouTube\andresibarrali\Musica\Sunlight_on_Still_Water.mp3` |
| `Apps.mp4_audio.wav` | `G:\YouTube\Audios\andresibarrali\IA\Apps.mp4_audio.wav` |

Las rutas se guardan como cadenas UTF-16, así que se leen tal cual. El editor puede añadirlas a Medios de
proyecto como referencias para que las revincules una a una.

### Títulos (2)

| Nombre | Texto |
|---|---|
| Títulos & Texto de VEGAS | `Texto de ejemplo` |
| **Terremoto** | `ADOBE GRATIS` / `Y OPEN SOURCE` (Impact, alineado al centro) |

Los títulos se guardan en RTF dentro del proyecto, con su tabla de fuentes y sus parámetros
(`TextColor`, `AnimationName`, `Scale`, `Location`, `OutlineWidth`, `ShadowOffsetX/Y`…). El lector extrae el
texto limpio y el nombre; el resto de parámetros queda identificado pero **no se aplica**.

## 3. Lo que NO se pudo leer, y por qué

- **La línea de tiempo**: la posición, duración y pista de cada evento viven en los registros numéricos
  internos del bloque grande (72 984 bytes, 178 sub-bloques). El formato no está documentado en ninguna
  parte y no había forma de verificar una interpretación: acertar con las posiciones "a ojo" habría producido
  una importación que parece funcionar y coloca los clips mal. **No se implementa.**
- **Efectos, transiciones y curvas de fotogramas clave**: mismo motivo. En el archivo aparecen los
  identificadores de los plugins (`{Svfx:com.sonycreativesoftware:titlesandtext}`) y sus parámetros con
  nombre, pero sin la estructura que los asocia a un evento y a un instante.
- **Marcadores**: el XMP declara las pistas de marcadores (`CuePoint Markers`, `CD Track Markers`,
  `Subclip Markers`) pero no contiene sus posiciones en este archivo.
- **Niveles de pista y envolventes de audio**: no identificados.

## 4. Consecuencia práctica

Abrir un `.veg` en Corte 15 muestra este mismo análisis dentro del editor y ofrece **importar los medios
referenciados** para revincularlos. No se reconstruye el montaje. Para eso, la vía verificada es exportar
desde VEGAS Pro 15 a **Final Cut Pro 7/DaVinci Resolve (\*.xml)** o **EDL (\*.txt)** e importar ese archivo,
que sí reconstruye pistas, eventos, puntos de entrada y el vínculo de audio y video (ver `README.md` §5.1).

## 5. Cómo reproducir este análisis

```sh
npm test                       # incluye las comprobaciones sobre tests/fixtures/vegas-real.veg
```

`tests/fixtures/vegas-real.veg` es tu archivo, copiado tal cual para que las pruebas sean reproducibles.
Contiene tus rutas locales; si prefieres no conservarlo en el repositorio, bórralo y la prueba del `.veg`
real se saltará (las demás siguen pasando), pero perderás esa comprobación.
