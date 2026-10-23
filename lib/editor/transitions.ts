// Transiciones de VEGAS Pro 15, con los nombres de su catálogo (leídos de `sftrans1.dll` y
// `sfpagepeel.dll`: «Fundido lineal», «Fundido lento», «Fundido brusco», «Barrido de entrada desde…»,
// «Persianas verticales/horizontales/venecianas», «Tablero cuadriculado», «Deslizar», «Comprimir»,
// «Remolino»).
//
// Cómo se aplican: la transición de un evento es su entrada. Durante los primeros `fadeIn` ticks del evento,
// su capa se recorta (barridos, persianas, tablero), se desplaza (deslizar) o se comprime (comprimir); el
// evento que queda debajo se mantiene opaco, así que lo que se ve es la transición revelando el nuevo clip
// sobre el anterior, igual que en VEGAS.
//
// Todo el trabajo se hace sobre la capa del evento (un lienzo transparente del tamaño del fotograma), con
// operaciones de Canvas que también existen en el lienzo de las pruebas, de modo que el resultado se puede
// comprobar píxel a píxel.
import type { TransitionKind } from './project';

export const TRANSITION_KINDS: TransitionKind[] = [
  'dissolve-linear', 'dissolve-slow', 'dissolve-fast', 'dissolve-smooth', 'dissolve-quick',
  'wipe-from-left', 'wipe-from-right', 'wipe-from-top', 'wipe-from-bottom',
  'wipe-out-left', 'wipe-out-right', 'wipe-out-top', 'wipe-out-bottom', 'gradient-wipe',
  'iris-circle', 'iris-diamond',
  'blinds-vertical', 'blinds-horizontal', 'blinds-venetian', 'blinds-slanted', 'blinds-stacked', 'blinds-twisted', 'checkerboard',
  'slide-from-left', 'slide-from-right', 'slide-from-top', 'slide-from-bottom',
  'squeeze-from-left', 'squeeze-from-right', 'squeeze-from-top', 'squeeze-from-bottom',
  'zoom-in', 'zoom-out',
  'spiral', 'spiral-out', 'page-peel', 'punch-zoom', 'spin-pop', 'whip-right', 'flash-white',
];
export const TRANSITION_LABEL: Record<TransitionKind, string> = {
  'dissolve-linear': 'Fundido lineal', 'dissolve-slow': 'Fundido lento', 'dissolve-fast': 'Fundido brusco',
  'dissolve-smooth': 'Fundido suave', 'dissolve-quick': 'Fundido rápido',
  'wipe-from-left': 'Barrido de entrada desde la izquierda', 'wipe-from-right': 'Barrido de entrada desde la derecha',
  'wipe-from-top': 'Barrido de entrada desde arriba', 'wipe-from-bottom': 'Barrido de entrada desde abajo',
  'wipe-out-left': 'Barrido de salida por la izquierda', 'wipe-out-right': 'Barrido de salida por la derecha',
  'wipe-out-top': 'Barrido de salida por arriba', 'wipe-out-bottom': 'Barrido de salida por abajo',
  'gradient-wipe': 'Barrido con degradado',
  'iris-circle': 'Círculos centrados', 'iris-diamond': 'Rombo centrado',
  'blinds-vertical': 'Persianas verticales', 'blinds-horizontal': 'Persianas horizontales', 'blinds-venetian': 'Persianas venecianas',
  'blinds-slanted': 'Persianas en pendiente', 'blinds-stacked': 'Quince persianas superpuestas', 'blinds-twisted': 'Muchas persianas torcidas',
  'checkerboard': 'Tablero cuadriculado',
  'slide-from-left': 'Deslizar desde la izquierda', 'slide-from-right': 'Deslizar desde la derecha',
  'slide-from-top': 'Deslizar desde arriba', 'slide-from-bottom': 'Deslizar desde abajo',
  'squeeze-from-left': 'Comprimir desde la izquierda', 'squeeze-from-right': 'Comprimir desde la derecha',
  'squeeze-from-top': 'Comprimir desde arriba', 'squeeze-from-bottom': 'Comprimir desde abajo',
  'zoom-in': 'Acercar zoom', 'zoom-out': 'Alejar zoom',
  'spiral': 'Remolino', 'spiral-out': 'Espiral exterior',
  'punch-zoom':'Zoom con rebote', 'spin-pop':'Giro rápido', 'whip-right':'Barrido rápido lateral', 'flash-white':'Destello blanco',
  'page-peel': 'Despegado de página',
};
export const TRANSITION_GROUP: Record<TransitionKind, string> = {
  'dissolve-linear': 'Fundidos', 'dissolve-slow': 'Fundidos', 'dissolve-fast': 'Fundidos',
  'dissolve-smooth': 'Fundidos', 'dissolve-quick': 'Fundidos',
  'wipe-from-left': 'Barridos', 'wipe-from-right': 'Barridos', 'wipe-from-top': 'Barridos', 'wipe-from-bottom': 'Barridos', 'gradient-wipe': 'Barridos',
  'wipe-out-left': 'Barridos', 'wipe-out-right': 'Barridos', 'wipe-out-top': 'Barridos', 'wipe-out-bottom': 'Barridos',
  'iris-circle': 'Iris', 'iris-diamond': 'Iris',
  'blinds-vertical': 'Persianas', 'blinds-horizontal': 'Persianas', 'blinds-venetian': 'Persianas', 'checkerboard': 'Persianas',
  'blinds-slanted': 'Persianas', 'blinds-stacked': 'Persianas', 'blinds-twisted': 'Persianas',
  'slide-from-left': 'Deslizamientos', 'slide-from-right': 'Deslizamientos', 'slide-from-top': 'Deslizamientos', 'slide-from-bottom': 'Deslizamientos',
  'squeeze-from-left': 'Compresiones', 'squeeze-from-right': 'Compresiones', 'squeeze-from-top': 'Compresiones', 'squeeze-from-bottom': 'Compresiones',
  'zoom-in': 'Zoom', 'zoom-out': 'Zoom',
  'spiral': 'Barridos', 'spiral-out': 'Barridos',
  'punch-zoom':'Dinámicas', 'spin-pop':'Dinámicas', 'whip-right':'Dinámicas', 'flash-white':'Dinámicas',
  'page-peel': 'Página',
};
// Las familias en el orden en que se enseñan en la pestaña de transiciones.
export const TRANSITION_GROUPS: string[] = [...new Set(TRANSITION_KINDS.map(kind => TRANSITION_GROUP[kind]))];
// Lo que no es una copia exacta del original, dicho sin adornos.
export const TRANSITION_NOTE: Partial<Record<TransitionKind, string>> = {
  spiral: 'Aproximación 2D del remolino de VEGAS: un barrido angular con radio creciente, sin el giro en perspectiva.',
  'spiral-out': 'La vuelta del remolino: la espiral se cierra desde el borde hacia el centro, también en 2D.',
  'blinds-venetian': 'Veinticuatro lamas finas que se abren desde su centro, en lugar del giro en 3D del original.',
  'blinds-vertical': 'Siete lamas que se abren desde su centro; el original las gira en 3D.',
  'blinds-horizontal': 'Siete lamas que se abren desde su centro; el original las gira en 3D.',
  'blinds-slanted': 'Lamas inclinadas 30° que se abren desde su centro: es la persiana en pendiente del catálogo, sin el giro en 3D.',
  'blinds-stacked': 'Dos capas de persianas (horizontales y luego verticales) en lugar de las quince superpuestas del original.',
  'blinds-twisted': 'Treinta y dos lamas finas inclinadas: la versión tupida y torcida del catálogo, en 2D.',
  'iris-circle': 'El círculo se abre desde el centro; el original permite elegir el centro y la dirección.',
  'iris-diamond': 'Rombo que se abre desde el centro: añadido de Sinaloa Pro, no aparece con ese nombre en el catálogo de VEGAS 15.',
  'zoom-in': 'Acerca el clip entrante desde el centro; el original añade el desenfoque de movimiento del zoom.',
  'zoom-out': 'Aleja el clip entrante hasta su tamaño normal; el original añade el desenfoque de movimiento.',
  'page-peel': 'Despegado de página en 2D: la página se levanta en diagonal desde la esquina superior derecha, sin el doblez ni la sombra con volumen del complemento «VEGAS PagePeel».',
  'wipe-out-left': 'Como la transición es la entrada del evento, el barrido de salida equivale al de entrada por el lado contrario: el clip anterior se retira hacia la izquierda y el entrante aparece por la derecha.',
  'wipe-out-right': 'Como la transición es la entrada del evento, el barrido de salida equivale al de entrada por el lado contrario: el clip anterior se retira hacia la derecha y el entrante aparece por la izquierda.',
  'wipe-out-top': 'Como la transición es la entrada del evento, el barrido de salida equivale al de entrada por el lado contrario: el clip anterior se retira hacia arriba y el entrante aparece por abajo.',
  'wipe-out-bottom': 'Como la transición es la entrada del evento, el barrido de salida equivale al de entrada por el lado contrario: el clip anterior se retira hacia abajo y el entrante aparece por arriba.',
};
// «Fundido suave» entra y sale despacio (curva en S) y «Fundido rápido» deja casi todo el cambio para el
// final; «Fundido lento» y «Fundido brusco» son las dos curvas de VEGAS que ya estaban.
export function transitionAlpha(kind: TransitionKind, progress: number): number {
  const p = Math.max(0, Math.min(1, progress));
  if (['punch-zoom','spin-pop','whip-right','flash-white'].includes(kind)) return p*p*(3-2*p);
  if (kind === 'dissolve-slow') return Math.pow(p, 1.8);
  if (kind === 'dissolve-fast') return Math.pow(p, .45);
  if (kind === 'dissolve-quick') return Math.pow(p, .28);
  if (kind === 'dissolve-smooth') return p * p * (3 - 2 * p);
  if (kind === 'dissolve-linear') return p;
  return 1;
}
export const isDissolve = (kind: TransitionKind) => kind.startsWith('dissolve-');
export const isSlide = (kind: TransitionKind) => kind.startsWith('slide-');
export const isSqueeze = (kind: TransitionKind) => kind.startsWith('squeeze-');
// El zoom no recorta la capa: la dibuja más pequeña o más grande y deja ver el clip de debajo alrededor.
export const isZoom = (kind: TransitionKind) => kind === 'zoom-in' || kind === 'zoom-out';
export const isGeometric = (kind: TransitionKind) => !isDissolve(kind) && !isSlide(kind) && !isSqueeze(kind) && !isZoom(kind);

// ------------------------------------------------------------------ recorte de la capa

type Erase = (x: number, y: number, width: number, height: number) => void;
function eraser(ctx: CanvasRenderingContext2D): Erase {
  return (x, y, width, height) => {
    if (width <= 0 || height <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, width, height);
    ctx.restore();
  };
}
// Un barrido con el borde suave: se borra con un degradado horizontal en lugar de con un canto recto. A la
// izquierda del borde no se borra nada (ya se ve el clip entrante) y a la derecha se borra todo.
function gradientErase(ctx: CanvasRenderingContext2D, progress: number, width: number, height: number) {
  const soft = Math.max(4, Math.min(width, height) * .12);
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  const gradient = ctx.createLinearGradient(progress * width - soft, 0, progress * width + soft, 0);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}
// Borra todo lo que queda **fuera** de una figura: se rellena el fotograma entero y la figura en el mismo
// trazado con la regla par-impar, así que lo que se borra es el resto. Es la forma de hacer un iris o una
// esquina sin recorrer los píxeles uno a uno.
function eraseOutside(ctx: CanvasRenderingContext2D, width: number, height: number, shape: () => void) {
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.rect(0, 0, width, height);
  shape();
  ctx.fill('evenodd');
  ctx.restore();
}
// Lamas que se abren desde su centro, con el número y el ángulo que se pidan. A 0° son verticales y a 90°
// horizontales, alineadas con el fotograma (las de siempre); con otro ángulo se giran alrededor del centro y
// se dibujan de sobra para que cubran el fotograma entero.
function eraseBlinds(ctx: CanvasRenderingContext2D, erase: Erase, width: number, height: number, progress: number, slats: number, degrees: number) {
  const straight = degrees === 0 || degrees === 90;
  const span = straight ? (degrees === 0 ? width : height) : Math.hypot(width, height);
  const size = span / slats;
  ctx.save();
  if (!straight) { ctx.translate(width / 2, height / 2); ctx.rotate(degrees * Math.PI / 180); ctx.translate(-width / 2, -height / 2); }
  const first = straight ? 0 : -slats;
  const last = straight ? slats : slats * 2;
  for (let index = first; index < last; index++) {
    const half = size * progress / 2;
    const centre = index * size + size / 2;
    // Cada lama se abre desde su centro hacia los dos lados: se borran sus dos extremos, sin salirse de ella
    // (si no, el borde de una lama taparía la abertura de la vecina).
    const before = (centre - half) - index * size;
    const after = (index + 1) * size - (centre + half);
    if (degrees === 0) { if (after > 0) erase(centre + half, 0, after, height); if (before > 0) erase(index * size, 0, before, height); }
    else if (degrees === 90) { if (after > 0) erase(0, centre + half, width, after); if (before > 0) erase(0, index * size, width, before); }
    else { if (after > 0) erase(centre + half, -span * 2, after, span * 5); if (before > 0) erase(index * size, -span * 2, before, span * 5); }
  }
  ctx.restore();
}
export function maskTransition(layer: HTMLCanvasElement, kind: TransitionKind, progress: number, width: number, height: number): void {
  if(kind==='flash-white'){
    const ctx=layer.getContext('2d');if(!ctx)return;
    ctx.save();ctx.globalAlpha=Math.sin(Math.max(0,Math.min(1,progress))*Math.PI);ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.restore();return;
  }

  if (!isGeometric(kind)) return;
  const ctx = layer.getContext('2d');
  if (!ctx) return;
  const p = Math.max(0, Math.min(1, progress));
  const erase = eraser(ctx);
  if (kind === 'gradient-wipe') { gradientErase(ctx, p, width, height); return; }
  if (kind === 'wipe-from-left') { erase(p * width, 0, width - p * width, height); return; }
  if (kind === 'wipe-from-right') { erase(0, 0, width - p * width, height); return; }
  if (kind === 'wipe-from-top') { erase(0, p * height, width, height - p * height); return; }
  if (kind === 'wipe-from-bottom') { erase(0, 0, width, height - p * height); return; }
  // Los barridos de salida entran por el lado contrario al que dice su nombre: como aquí la transición es la
  // **entrada** del evento, el clip anterior se retira hacia ese lado y el entrante aparece por el otro. Así el
  // barrido termina cubriendo el fotograma (si se hiciera al revés, el clip se esfumaría al acabar la entrada).
  if (kind === 'wipe-out-left') { erase(0, 0, width - p * width, height); return; }
  if (kind === 'wipe-out-right') { erase(p * width, 0, width - p * width, height); return; }
  if (kind === 'wipe-out-top') { erase(0, 0, width, height - p * height); return; }
  if (kind === 'wipe-out-bottom') { erase(0, p * height, width, height - p * height); return; }
  if (kind === 'iris-circle' || kind === 'iris-diamond') {
    // El círculo tiene que llegar a la diagonal y el rombo, a la suma de las dos mitades (su «radio» se mide en
    // distancia Manhattan): así al final de la transición los dos cubren el fotograma entero.
    const reach = kind === 'iris-circle' ? Math.hypot(width, height) / 2 : (width + height) / 2;
    const radius = p * reach * 1.02;
    const centreX = width / 2, centreY = height / 2;
    eraseOutside(ctx, width, height, () => {
      if (kind === 'iris-circle') { ctx.moveTo(centreX + radius, centreY); ctx.arc(centreX, centreY, radius, 0, Math.PI * 2); return; }
      ctx.moveTo(centreX, centreY - radius);
      ctx.lineTo(centreX + radius, centreY);
      ctx.lineTo(centreX, centreY + radius);
      ctx.lineTo(centreX - radius, centreY);
      ctx.closePath();
    });
    return;
  }
  if (kind === 'blinds-vertical' || kind === 'blinds-horizontal' || kind === 'blinds-venetian') {
    // Las venecianas son lamas finas y las otras dos, siete lamas anchas que se abren desde su centro.
    eraseBlinds(ctx, erase, width, height, p, kind === 'blinds-venetian' ? 24 : 7, kind === 'blinds-horizontal' ? 90 : 0);
    return;
  }
  if (kind === 'blinds-slanted') { eraseBlinds(ctx, erase, width, height, p, 9, 30); return; }
  if (kind === 'blinds-twisted') { eraseBlinds(ctx, erase, width, height, p, 32, 20); return; }
  if (kind === 'blinds-stacked') {
    // Quince persianas superpuestas: dos capas de quince lamas, una horizontal y otra vertical, que se abren a
    // la vez. Al superponerse, el fotograma se descubre antes que con una sola capa (a mitad de camino ya se ve
    // una cuarta parte), y al final queda entero.
    eraseBlinds(ctx, erase, width, height, p, 15, 90);
    eraseBlinds(ctx, erase, width, height, p, 15, 0);
    return;
  }
  if (kind === 'checkerboard') {
    const cells = 8;
    const cellWidth = width / cells, cellHeight = height / cells;
    for (let row = 0; row < cells; row++) for (let column = 0; column < cells; column++) {
      // El último cuadro entra un poco antes del final (0,98 en lugar de 1) para que la transición termine con
      // el fotograma entero cubierto y no quede una casilla suelta en el último fotograma.
      const threshold = (column + row) / (2 * (cells - 1)) * .98;
      if (p < threshold) erase(column * cellWidth, row * cellHeight, cellWidth, cellHeight);
    }
    return;
  }
  if (kind === 'spiral' || kind === 'spiral-out') {
    // Barrido angular con radio creciente (o decreciente, en la espiral exterior): al final cubre el fotograma.
    const image = ctx.getImageData(0, 0, width, height);
    const data = image.data;
    const centreX = width / 2, centreY = height / 2;
    const maxRadius = Math.hypot(width, height) / 2;
    const turn = kind === 'spiral-out' ? 1 - p : p;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const dx = x - centreX, dy = y - centreY;
      const angle = Math.atan2(dy, dx);
      const radius = turn * maxRadius * (1 - .45 * (1 - turn) * (1 - Math.cos(angle - turn * Math.PI * 2)));
      const distance = Math.hypot(dx, dy);
      // Medio píxel de holgura: al empezar la espiral interior no queda un punto del entrante en el centro, y
      // al terminar la exterior no queda un agujero de un píxel justo en el centro.
      const outside = kind === 'spiral-out' ? distance < radius - .5 : distance > radius + .5;
      if (outside) data[(y * width + x) * 4 + 3] = 0;
    }
    ctx.putImageData(image, 0, 0);
    return;
  }
  if (kind === 'page-peel') {
    // La página se levanta en diagonal desde la esquina superior derecha: se conserva lo que queda por encima
    // de la recta x/w + y/h = umbral y se borra el resto. El umbral baja de 2 (nada conservado) por debajo de
    // cero (todo conservado) y cruza el cero al 95 % de la transición, así que el fotograma queda entero un
    // poco antes de terminar y no se ve una esquina sin cubrir en los últimos fotogramas.
    const threshold = 2 * (1 - p) - .1 * p;
    eraseOutside(ctx, width, height, () => {
      const points: [number, number][] = [];
      const corners: [number, number][] = [[0, 0], [width, 0], [width, height], [0, height]];
      for (const [x, y] of corners) if (x / width + y / height >= threshold) points.push([x, y]);
      const edges: [number, number][][] = [[[0, 0], [width, 0]], [[width, 0], [width, height]], [[width, height], [0, height]], [[0, height], [0, 0]]];
      for (const [[x1, y1], [x2, y2]] of edges) {
        const a = x1 / width + y1 / height, b = x2 / width + y2 / height;
        if ((a - threshold) * (b - threshold) < 0) {
          const t = (threshold - a) / (b - a);
          points.push([x1 + (x2 - x1) * t, y1 + (y2 - y1) * t]);
        }
      }
      if (!points.length) return;
      // Los puntos se ordenan por ángulo alrededor de su centro para que el polígono no se cruce.
      const centreX = points.reduce((total, point) => total + point[0], 0) / points.length;
      const centreY = points.reduce((total, point) => total + point[1], 0) / points.length;
      points.sort((one, other) => Math.atan2(one[1] - centreY, one[0] - centreX) - Math.atan2(other[1] - centreY, other[0] - centreX));
      points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
      ctx.closePath();
    });
  }
}

// ------------------------------------------------------------------ desplazamiento de la capa

// Deslizar, comprimir y el zoom no borran nada: mueven, estrujan o escalan la capa del evento al dibujarla.
export function applyTransitionTransform(ctx: CanvasRenderingContext2D, kind: TransitionKind, progress: number, width: number, height: number): void {
  const p = Math.max(0, Math.min(1, progress));
  if(kind==='punch-zoom'||kind==='spin-pop'){
    const scale=kind==='punch-zoom'?1+Math.sin(p*Math.PI*2)*(1-p)*.45:1+.8*(1-p);
    ctx.translate(width/2,height/2);
    if(kind==='spin-pop')ctx.rotate(-Math.PI*.5*(1-p)*(1-p));
    ctx.scale(scale,scale);ctx.translate(-width/2,-height/2);return;
  }
  if(kind==='whip-right'){ctx.translate(width*Math.pow(1-p,3),0);return;}

  if (kind === 'slide-from-left') { ctx.translate(-(1 - p) * width, 0); return; }
  if (kind === 'slide-from-right') { ctx.translate((1 - p) * width, 0); return; }
  if (kind === 'slide-from-top') { ctx.translate(0, -(1 - p) * height); return; }
  if (kind === 'slide-from-bottom') { ctx.translate(0, (1 - p) * height); return; }
  if (kind === 'squeeze-from-left' || kind === 'squeeze-from-right') {
    const anchor = kind === 'squeeze-from-left' ? 0 : width;
    ctx.translate(anchor, 0);
    ctx.scale(Math.max(.001, p), 1);
    ctx.translate(-anchor, 0);
    return;
  }
  if (kind === 'squeeze-from-top' || kind === 'squeeze-from-bottom') {
    const anchor = kind === 'squeeze-from-top' ? 0 : height;
    ctx.translate(0, anchor);
    ctx.scale(1, Math.max(.001, p));
    ctx.translate(0, -anchor);
    return;
  }
  if (kind === 'zoom-in' || kind === 'zoom-out') {
    // Acercar entra desde pequeño (0,2 → 1) y alejar llega desde grande (2,8 → 1), siempre desde el centro.
    const scale = kind === 'zoom-in' ? .2 + .8 * p : 2.8 - 1.8 * p;
    ctx.translate(width / 2, height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-width / 2, -height / 2);
  }
}

// Progreso de la transición dentro del evento: null cuando no hay transición en marcha.
export function transitionProgress(local: number, duration: number): number | null {
  if (!(duration > 0)) return null;
  const progress = local / duration;
  if (progress < 0 || progress > 1) return null;
  return progress;
}
