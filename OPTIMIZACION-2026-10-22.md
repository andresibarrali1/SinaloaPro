# Optimización conservadora — 22 de octubre de 2026

## Respaldo previo
C:\Users\<usuario>\Documents\Codex\2026-10-08\co\SinaloaPro-respaldo-20261022-225630.zip

705 archivos, 22.421.448 bytes. Cada archivo del ZIP verificado por SHA-256; manifiesto incluido. Contiene fuentes, configuración, lockfile y dist anterior. Excluye dependencias reinstalables, metadatos Git y cachés de herramientas. No es una copia del almacenamiento del navegador ni de medios externos.

Para deshacer solamente esta mejora: cerrar el editor, restaurar components/editor/audio-waveform.tsx y dist desde el ZIP en esta misma carpeta. Los nuevos archivos visible-range.ts y su test pueden permanecer sin uso. Para restaurar todo: conservar primero los cambios posteriores, extraer el respaldo en la carpeta del proyecto e iniciar con iniciar.cmd; npm ci restaura dependencias desde package-lock.json cuando haga falta. No borrar datos del navegador.

## Cambio y arquitectura
AudioWaveform conserva la presentación y cálculo de picos. lib/editor/visible-range.ts concentra observación, planificación y geometría visible. Un WeakMap mantiene un grupo por línea de tiempo. Cada grupo comparte un listener scroll, un ResizeObserver y una solicitud requestAnimationFrame. Primero mide todos los elementos y luego notifica React, evitando alternar lecturas de geometría con actualizaciones. Cancela el trabajo y desconecta al desmontar el último suscriptor. El trimmer conserva la vista de ancho completo.

No cambian los archivos de proyecto, los motores de audio/vídeo ni la exportación.

## Evidencia
- Suite previa: 420 pruebas aprobadas, cero errores.
- Tras el cambio: 14 pruebas específicas aprobadas (dos nuevas y doce de ondas).
- Prueba determinista con 100 suscriptores y 20 señales scroll: una sola solicitud de fotograma y una lectura del viewport por lote, en lugar de una por onda. Se comprueban extremos, elementos fuera de pantalla, desmontaje y remontaje.
- TypeScript sin errores y compilación Vite correcta.
- Navegador integrado cargó index-CslsfyOU.js y el proyecto recuperado de 329 eventos. El intento automatizado de pulsar zoom agotó el plazo; no se presenta como prueba de interacción aprobada ni como medida de FPS.

## Alcance pendiente
Esta mejora reduce trabajo redundante de la visualización de ondas; no supone una auditoría exhaustiva de toda la aplicación. La compilación sigue avisando de un paquete JS grande (1,44 MB sin comprimir). Separar diálogos mediante carga diferida y virtualizar eventos requiere pruebas de interacción adicionales; no se modificaron en esta intervención. No se midió una mejora porcentual de FPS ni se probaron macOS/Linux.
