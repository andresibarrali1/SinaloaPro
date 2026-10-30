# Iniciar Sinaloa Pro

Requiere Node.js 22.13 o posterior y npm. La primera ejecución instala dependencias con npm ci (Internet); las posteriores reutilizan las del mismo sistema y arquitectura. No copies node_modules de Windows: se reinstalan al detectar otra plataforma. Copia toda la carpeta de código, incluyendo package-lock.json.

## macOS
En Terminal, entra en la carpeta de Sinaloa Pro y ejecuta una vez:

```sh
chmod +x iniciar.command iniciar.sh
```

Después abre iniciar.command con doble clic. Alternativa: `sh iniciar.command` desde Terminal.

### Si macOS avisa de que el archivo «puede ser malicioso»

Ese aviso lo pone Gatekeeper, no el proyecto: macOS marca con cuarentena todo lo que se descarga del navegador (por ejemplo el ZIP del repositorio) y, además, el ZIP no conserva el permiso de ejecución. No hace falta desactivar Gatekeeper ni instalar nada.

La vía más corta, en Terminal y dentro de la carpeta de Sinaloa Pro:

```sh
sh iniciar.sh
```

Al intérprete no le afecta la cuarentena: el script arranca y abre el navegador igual.

Si prefieres el doble clic en `iniciar.command`, quita la cuarentena y concede el permiso una sola vez:

```sh
xattr -dr com.apple.quarantine .
chmod +x iniciar.command iniciar.sh
```

Y si el aviso ya salió, se acepta una vez desde **Ajustes del Sistema → Privacidad y seguridad**, con el botón _Abrir de todos modos_ que aparece tras el intento (en macOS 14 y anteriores también sirve clic derecho → _Abrir_).

Un `git clone` no lleva cuarentena ni pierde los permisos: en ese caso `./iniciar.command` y `./iniciar.sh` funcionan directamente.

### Si sigue sin arrancar

Antes de nada, pide el diagnóstico. No arranca nada, solo cuenta lo que ve:

```sh
sh iniciar.sh --diagnostico
```

Imprime el sistema, la carpeta, la ruta y la versión de Node, si npm está a mano, el navegador, las dependencias y si hay compilación previa. Ese texto es lo que hay que mirar (o enviar) cuando algo falla.

Las tres causas que ya están cubiertas por el lanzador:

- **Node instalado pero «no encontrado».** Un `.command` abierto con doble clic no hereda el `PATH` de tu terminal, así que Homebrew (`/opt/homebrew/bin`), nvm, Volta, pnpm y asdf quedan fuera. El lanzador añade esas rutas —y la última versión de nvm— antes de buscar `node`.
- **Página en blanco al abrirse el navegador.** El editor necesita WebCodecs y Safari no lo tiene. En macOS se abre Google Chrome, Microsoft Edge o Brave si están instalados; si prefieres tu navegador predeterminado, ejecuta `CORTE15_NAVEGADOR=predeterminado sh iniciar.sh` (y si es Safari, la app no funcionará: usa Chrome o Edge).
- **`npm ci` que no termina** (red, registro o una instalación a medias). El lanzador reintenta con `npm install` antes de rendirse.

Si el mensaje final es un error de compilación, pégalo tal cual: la ventana ya no se cierra sola, espera a que pulses Enter.

## Linux
Desde la carpeta del editor:

```sh
sh iniciar.sh
```

También puedes ejecutar `chmod +x iniciar.sh` y abrirlo como programa si tu gestor de archivos lo permite. Se utiliza xdg-open para abrir el navegador predeterminado; si no está disponible, abre la URL que muestra la terminal.

## Uso
El lanzador compila el código y sirve la aplicación únicamente en http://127.0.0.1:5173/. Mantén la terminal abierta; Ctrl+C detiene el servidor iniciado por ella. Un servidor existente se reutiliza. Para cargar cambios de código, detén el servidor anterior y vuelve a iniciar.
`sh iniciar.sh --sin-ventana` inicia sin abrir navegador. Para cambiar de puerto: `CORTE15_PUERTO=5180 sh iniciar.sh`. Para saber qué ve el lanzador sin arrancar nada: `sh iniciar.sh --diagnostico`.
Windows conserva iniciar.cmd.

## Proyectos y plantillas
Las descargas nuevas usan .sinaloapro. Se aceptan también .corte15 antiguos; el esquema interno sigue siendo corte15 versión 1 para conservar compatibilidad. Guardar sobre un archivo antiguo conserva su nombre; descargar crea la extensión nueva. El proyecto no incorpora los archivos multimedia.
En Títulos y texto aparecen Subtítulos dinámicos y Títulos dinámicos: Palabra lima, Etiqueta violeta, Pop rosa, Minimal deslizante, Cómic amarillo y Cian eléctrico. Selecciona una plantilla para un texto, o usa Aplicar plantilla a todos los textos de esta pista. Los eventos bloqueados no se modifican; contenido y tiempos se conservan.

Los lanzadores se verificaron sintácticamente y en modo de diagnóstico en Windows. No se ejecutaron en un equipo macOS/Linux. El puente nativo de VEGAS sigue requiriendo Windows; no es necesario para el editor web. La compatibilidad de códecs depende de las capacidades del navegador.
