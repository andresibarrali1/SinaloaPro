# Menú de pistas — 24 de octubre de 2026

Acceso: botón ☰ de cada pista de vídeo o clic derecho en su cabecera.

Implementado:
- Movimiento de pista con claves temporales, interpolación y nivel.
- Efectos sobre una capa aislada de pista/grupo, antes de mezclar con el fondo.
- Ocho modos de composición del motor actual.
- Primario/secundario: agrupar bajo la pista anterior y promover un nivel.
- Silencio y solo de grupos, transparencia, transformaciones y efectos heredados.
- Desenfoque temporal de cinco muestras, intensidad 0–1 fotogramas; interruptor para ignorarlo.
- Mostrar controles de automatización, añadir/quitar claves en cursor, leer/desactivar.
- Minimizar a 60 px, maximizar a 220 px, elegir botones visibles.
- Guardado versionado existente, recuperación y deshacer/rehacer de estas propiedades.

Diferencias respecto de VEGAS:
- Touch/Latch continuo pendiente, deshabilitado y explicado en el menú.
- No se implementan plugins nativos ni todos los modos avanzados de composición de VEGAS.
- El desenfoque es temporal por pista; no reproduce el bus de vídeo de VEGAS.
- El movimiento de la primaria transforma el grupo; no hay un segundo controlador independiente de movimiento de grupo.
- Al mover una pista por encima de su primaria o eliminarla, se desvinculan las referencias que queden inválidas.
- El audio conserva sus pistas y su mezcla independientes.

Verificación: 459 pruebas automatizadas aprobadas, TypeScript y compilación Vite correctos.
En navegador: menú, mostrar automatización, añadir clave, crear secundaria, abrir/aplicar efectos y personalización de botones.
Respaldo previo: respaldo-menu-pistas-20261024.zip en la carpeta de trabajo de Codex.
