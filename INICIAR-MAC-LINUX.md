# Iniciar Sinaloa Pro

Requiere Node.js 22.13 o posterior y npm. La primera ejecución instala dependencias con npm ci (Internet); las posteriores reutilizan las del mismo sistema y arquitectura. No copies node_modules de Windows: se reinstalan al detectar otra plataforma. Copia toda la carpeta de código, incluyendo package-lock.json.

## macOS
En Terminal, entra en la carpeta de Sinaloa Pro y ejecuta una vez:

```sh
chmod +x iniciar.command iniciar.sh
```

Después abre iniciar.command con doble clic. Alternativa: `sh iniciar.command` desde Terminal.

## Linux
Desde la carpeta del editor:

```sh
sh iniciar.sh
```

También puedes ejecutar `chmod +x iniciar.sh` y abrirlo como programa si tu gestor de archivos lo permite. Se utiliza xdg-open para abrir el navegador predeterminado; si no está disponible, abre la URL que muestra la terminal.

## Uso
El lanzador compila el código y sirve la aplicación únicamente en http://127.0.0.1:5173/. Mantén la terminal abierta; Ctrl+C detiene el servidor iniciado por ella. Un servidor existente se reutiliza. Para cargar cambios de código, detén el servidor anterior y vuelve a iniciar.
`sh iniciar.sh --sin-ventana` inicia sin abrir navegador. Para cambiar de puerto: `CORTE15_PUERTO=5180 sh iniciar.sh`.
Windows conserva iniciar.cmd.

## Proyectos y plantillas
Las descargas nuevas usan .sinaloapro. Se aceptan también .corte15 antiguos; el esquema interno sigue siendo corte15 versión 1 para conservar compatibilidad. Guardar sobre un archivo antiguo conserva su nombre; descargar crea la extensión nueva. El proyecto no incorpora los archivos multimedia.
En Títulos y texto aparecen Subtítulos dinámicos y Títulos dinámicos: Palabra lima, Etiqueta violeta, Pop rosa, Minimal deslizante, Cómic amarillo y Cian eléctrico. Selecciona una plantilla para un texto, o usa Aplicar plantilla a todos los textos de esta pista. Los eventos bloqueados no se modifican; contenido y tiempos se conservan.

Los lanzadores se verificaron sintácticamente y en modo de diagnóstico en Windows. No se ejecutaron en un equipo macOS/Linux. El puente nativo de VEGAS sigue requiriendo Windows; no es necesario para el editor web. La compatibilidad de códecs depende de las capacidades del navegador.
