# Seguimiento CSRT — Recuadro y Autoencuadre

## Uso
1. Instala Entrega/Instalar-Sinaloa-Pro.exe con la aplicación cerrada.
2. Importa un vídeo y colócalo en una pista. Sitúa el cursor en el fotograma donde se vea el objeto.
3. Selecciona el evento y añade **Seguimiento** desde Efectos de vídeo (también admite arrastrarlo al vídeo).
4. Se pausa la reproducción y se abre **¿A quién quieres seguir?**. Espera a que se prepare el vídeo; dibuja un rectángulo verde y pulsa **Seguir**.
5. Espera el progreso o pulsa Cancelar. El cálculo se realiza localmente, desde el fotograma elegido hasta el final del archivo.
6. En los ajustes del efecto cambia color, grosor o suavizado. **Volver a seleccionar** permite recalcular; cancelar conserva el resultado anterior.
7. Guarda como .SNLPRO, reabre y reproduce: se usan los puntos guardados, sin repetir CSRT. Exporta MP4/WebM normalmente; el compositor aplica el recuadro y conserva la mezcla de audio.

## Implementación
Tauri 2; React/TypeScript compartido. Rust usa opencv 0.98.2 con OpenCV contrib 4.12.0/CSRT, en spawn_blocking. Progreso identificado por trabajo, cancelación atómica, temporales RAII. No se envían medios a servidores.
El parámetro path del comando identifica el temporal autorizado mediante un token; los File del navegador se transfieren por bloques de 256 KiB. No se interpreta una URL de atribución como ruta de disco.
Se guardan FPS, dimensiones y TrackPoint (incluye timestamp) dentro del efecto. El backend suaviza y marca pérdidas con ok=false; el ajuste adicional de suavizado usa caché. El recuadro pasa por el mismo recorte y transformación del contenido.
El selector utiliza vídeo HTML pausado y requestVideoFrameCallback cuando está disponible. El monitor principal conserva su reloj de audio/Canvas existente. Preview y exportación consultan la misma trayectoria.

## Archivos creados
- lib/editor/tracking.ts: coordenadas, interpolación, suavizado y dibujo.
- lib/editor/tracking-native.ts: transferencia, comandos, eventos y cancelación.
- components/editor/tracking-modal.tsx: selección y progreso.
- sinaloa-tauri/src-tauri/src/tracking.rs: comandos, CSRT y pruebas nativas.
- sinaloa-tauri/src-tauri/tauri.windows.conf.json: DLL y licencias del instalador Windows.
- sinaloa-tauri/scripts/prepare-opencv-windows.py, build-opencv-windows.ps1, opencv-env.ps1, installer-windows.ps1, start-desktop.mjs: preparación y compilación.
- tests/tracking.test.ts, tracking-harness.tsx, tracking-ui.spec.ts y playwright.tracking.config.ts.

## Archivos modificados
- lib/editor/project.ts y validation.ts: tipo y validación persistente del efecto.
- lib/editor/effects.ts: catálogo, parámetros y valores iniciales.
- lib/editor/compositor.ts: recuadro sobre imagen original y reutilización del lienzo auxiliar.
- components/editor/effects.tsx y editor.tsx: alta, pausa, ajustes, selección y arrastre.
- app/editor.css: modal.
- sinaloa-tauri/src-tauri/Cargo.toml, Cargo.lock y src/main.rs: dependencia y comandos registrados.
- sinaloa-tauri/package.json: arranque e instalador con entorno OpenCV.
- tsconfig.json y .gitignore: excluir herramientas y artefactos nativos.
- tests/effects.test.ts y premium-effects.test.ts: catálogo de 19 efectos.

## Verificación
- Build web TypeScript/Vite: correcto (aviso previo de tamaño de chunks, sin errores).
- Rust: seguimiento real de vídeo sintético a 25 fps, inicio en frame 5, 35 posiciones; rectángulo inválido y cancelación: 2 pruebas correctas.
- Esas mismas pruebas pasan con PATH limitado a Windows y solo DLL empaquetadas al lado del ejecutable.
- 25 pruebas unitarias de efectos y tracking: correctas, incluyendo persistencia y píxeles del compositor.
- Edge: selector, conversión de coordenadas, progreso, persistencia y cancelación de reselección con IPC simulado; prueba separada de MP4 real decodificado con recuadro verde y audio.
- Instalador Windows NSIS compilado con OpenCV, FFmpeg y runtime C++.
- No se ha realizado una sesión manual completa dentro de la app instalada ni pruebas en macOS/Linux. Las pruebas de UI simulan IPC; las de Rust usan CSRT real.

## Compilar
Windows x64: Python y Visual Studio C++ Build Tools. Desde sinaloa-tauri:

    python scripts/prepare-opencv-windows.py
    powershell -ExecutionPolicy Bypass -File scripts/build-opencv-windows.ps1
    npm run installer

Las herramientas quedan en vendor/ (ignorado en Git), sin instalación global. La configuración Windows enumera el runtime VC145 usado en este equipo; comprobar esa lista si cambia la versión de Visual Studio.
macOS/Linux: requieren OpenCV contrib y libclang de desarrollo. La distribución autocontenida de dylib/so y la compilación universal de macOS siguen pendientes; no copiar DLL de Windows a esos sistemas.

## Pendiente y límites concretos
- Recuadro y Autoencuadre disponibles. Spotlight y Blur siguen pendientes.
- El cálculo nuevo requiere Tauri; la web puede reproducir/exportar trayectorias ya guardadas.
- Analiza desde la selección hasta el final del archivo, no hacia atrás. Antes del inicio no se dibuja recuadro.
- CSRT puede perder el objeto; no garantiza recuperarlo después de una oclusión. Los frames perdidos no dibujan un recuadro inventado.
- VFR usa timestamps del decodificador donde están disponibles; selección inicial por FPS nominal y fallback de tiempo. No se ha verificado precisión en todos los vídeos VFR ni medios con rotación especial.
- Se necesita espacio temporal para el vídeo. Trayectorias largas aumentan el JSON y pueden exceder la cuota del autoguardado localStorage existente; límite de un millón de puntos, no garantía de recuperación ilimitada. Guardar el archivo .SNLPRO explícitamente para clips largos.
- El seguimiento se dibuja en coordenadas del medio antes de la pila visual, por lo que filtros posteriores también afectan el recuadro.

## Corrección de permisos de eventos
Se añadió src-tauri/capabilities/tracking-events.json: la ventana local main puede usar core:event:allow-listen y core:event:allow-unlisten. Antes no había ninguna capability y Tauri bloqueaba el progreso con «Command plugin:event|listen not allowed by ACL».
El puente libera ahora el temporal si falla la suscripción. Dos pruebas de regresión pasan; TypeScript compila y el manifiesto generado por Tauri contiene los permisos. Esta corrección exige instalar el ejecutable nuevo, no basta con recargar el frontend.


## Autoencuadre en Panoramización y recorte
Abre Panoramización/Recorte del vídeo y despliega **Seguimiento de cámara**, junto al nombre del plugin. Si existe una trayectoria, activa **Autoencuadre**; si no, pulsa **Seleccionar persona** y confirma el rectángulo. Ajusta zoom máximo y suavizado; el panel incluye una vista previa del resultado. El panel se desplaza verticalmente para acceder a todos los controles.
También puede cambiarse el modo desde los ajustes del efecto Seguimiento. La trayectoria se reutiliza; solo Volver a seleccionar recalcula CSRT. Autoencuadre no dibuja el recuadro verde. Mantiene el último encuadre válido cuando se pierde el objeto. Al desmarcar Autoencuadre se vuelve al modo Recuadro.
El encuadre conserva la proporción del proyecto y limita la cámara a los bordes del medio; cerca de esos bordes la persona puede quedar fuera del centro. El zoom máximo se reduce para incluir la selección con margen cuando es posible. Una selección más ancha/alta que el encuadre posible para esa proporción puede recortarse: no se inventa imagen fuera del vídeo. Los ajustes manuales de Pan/Crop se aplican después, por lo que pueden desplazar/recortar el resultado automático.
Nuevos controles: components/editor/camera-tracking.tsx. Integración: pan-crop.tsx, event-pan-crop.tsx, editor.tsx, effects.tsx. Motor y persistencia: tracking.ts, compositor.ts, project.ts y validation.ts; estilos: app/editor.css.
Verificación: pruebas unitarias de centrado, proporción, límites, pérdida y persistencia; píxeles del compositor; controles reales de Pan/Crop en Edge con IPC simulado; compilación web y NSIS Windows.
