# Voz Andrés — Audition

En la pestaña **Presets de audio**, arrastra la tarjeta al recurso de audio, o selecciona uno o varios audios y pulsa la tarjeta. Se crea una copia WAV de 32 bits flotantes a 48 kHz, con el audio completo del medio. La línea de tiempo conserva sus recortes, velocidad, fades y volumen. El original permanece en Medios de proyecto; puedes deshacer o usar **Quitar preset de los audios seleccionados**.

## Cadena
1. Gráfico de 20 bandas (Hz → dB): 31→0, 44→5.7, 63→9.2, 88→8.9, 125→9.1, 180→5, 250→0, 355→0, 500→0, 710→0, 1000→0, 1400→1.1, 2000→1.8, 2800→3.3, 4000→6.5, 5600→8.9, 8000→10.8, 11300→8.1, 16000→7.2, 22000→−1.4. Ganancia maestra 0 dB.
2. Paramétrico: estante grave 40 Hz +1.1 dB; campana 800 Hz −3 dB Q2; estante agudo 18 kHz +1.6 dB. Resto desactivado. Ganancia maestra 0 dB.
3. Compresor enlazado entre canales: umbral −20 dB, ratio 12:1, ataque 0 ms, release 100 ms, salida 0 dB.
4. Normalización del pico de muestra a −3.04 dBFS, misma ganancia para todos los canales, sin ajuste DC. Se analiza todo el medio después de los efectos; no es un limitador ni normalización LUFS.

## Implementación y fidelidad
Procesado propio en Web Worker, local y cancelable. El gráfico usa una curva interpolada en frecuencia logarítmica y FIR de 1001 coeficientes con convolución FFT y compensación de retardo. El paramétrico utiliza biquads; el compresor, detector de pico enlazado. Son aproximaciones a la cadena de Adobe, no una réplica bit a bit de sus algoritmos o de su opción «Accuracy 1000 points». Se conservan los valores de las capturas.
El WAV nuevo se guarda en IndexedDB antes de modificar los eventos y se mantiene a frecuencia completa también al reabrir. El mezclador y la exportación leen ese mismo medio. El pico de la mezcla final puede cambiar si se ajusta volumen, hay solapamientos u otros efectos de pista/master.
Reaplicar el preset usa el medio original registrado, evitando duplicar el procesado. No borrar ese original si se quiere quitar o recalcular el preset. Para los audios ya procesados externamente, usar la grabación sin efectos para no duplicar la cadena.

## Límites
Mono/estéreo; 512 MB de archivo y 384 MB decodificados por proceso; necesita memoria para decodificación, convolución y WAV, además del audio del proyecto. La cancelación termina el Worker; si la decodificación del navegador ya empezó, se espera a que termine antes de descartarla. El proyecto mantiene su límite general de audio en memoria de 1 GB. Para más duración, dividir el medio en archivos. La normalización se aplica al medio completo, no solo a un recorte seleccionado en la línea del tiempo.

## Archivos
Nuevos: lib/editor/voice-preset.ts, voice-preset.worker.ts, voice-preset-client.ts; tests/voice-preset.test.ts, voice-preset.spec.ts; playwright.voice-preset.config.ts.
Modificados: components/editor/editor.tsx, lib/editor/project.ts, validation.ts, media.ts, app/editor.css.

## Pruebas
Pruebas DSP: pico −3.04 dBFS, proporción entre canales, longitud de señal, original intacto, WAV y silencio finito. Edge con Worker real: arrastrar, aplicar por clic, quitar, persistencia del WAV y reapertura. Compilación web y Tauri Windows. No se ha comparado por anulación con un render de Adobe ni probado macOS/Linux.
