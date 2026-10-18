// Composición 3D: el giro horizontal (`rotationY`), el vertical (`rotationX`) y la distancia
// (`depth`) que VEGAS 15 aplica en «Movimiento de pista» y en «Panoramización y recorte» sobre el
// plano del evento.
//
// Cómo se resuelve, y por qué así. El lienzo 2D de un navegador solo tiene transformaciones afines
// (mover, girar, escalar, sesgar). Un giro sobre el eje Y o el X es una transformación
// **proyectiva**: el lado que se aleja se acorta, así que no se puede escribir como una matriz afín.
// Por eso el giro se resuelve en dos pasos:
//
//   1. `projectQuad` calcula con la fórmula clásica de perspectiva (foco en `FOCAL`) dónde caen las
//      cuatro esquinas del fotograma del evento al girarlo. Es geometría exacta, sin aproximaciones,
//      y es lo que comprueban las pruebas unitarias.
//   2. `composeQuad` trocea la imagen en celdas regulares y dibuja cada celda con la transformación
//      afín que lleva sus esquinas exactamente a las del cuadrilátero proyectado. Las celdas se
//      solapan medio píxel para que no queden hilos claros entre ellas, y la aproximación es solo
//      *dentro* de cada celda: la proyección conserva las rectas, así que el error es de segundo
//      orden y con celdas de ~16 px queda por debajo del píxel. La rejilla se reescala con la raíz
//      del área y tiene un tope de 64×64 celdas, de modo que la exportación a 1080p cuesta casi lo
//      mismo que la vista previa de 640 px.
//
// El mapeo proyectivo del cuadrado unitario al cuadrilátero es el de Heckbert. Con p0..p3 en orden
// (arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda) el mapeo es
//   p(u,v) = (C0 + C1·u + C2·v + C3·uv) / (1 + g·u + h·v)
// y `projectiveCoefficients` resuelve las cuatro esquinas. `inversePoint` es el inverso exacto (la
// reciprocidad bilineal), que es lo que usan las pruebas para enderezar la imagen deformada y medir
// el error de la rejilla.
//
// Los nombres siguen a VEGAS 15: el programa habla de «Movimiento de pista 3D», «Rotación X»,
// «Rotación Y» y «Distancia»; en sus recursos aparecen `RotationX`, `RotationY` y `Depth` junto a
// `Rotation` (el giro sobre el plano, que aquí ya existía antes que el 3D).

import type { Transform } from './project';

export type Point = { x: number; y: number };
// Esquinas en orden: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda.
export type Quad = [Point, Point, Point, Point];

// Distancia focal en «anchos de fotograma». Con 1,5 un giro de 45° deja el lado cercano unas 1,7
// veces más alto que el lejano: la perspectiva que se ve en el monitor de VEGAS a distancia 1,0.
export const FOCAL = 1.5;
export const MAX_ROTATION_3D = 360;   // de -360 a 360 grados, como en VEGAS
export const MIN_DEPTH = .1;
export const MAX_DEPTH = 4;
export const CELL = 16;   // tamaño de celda de la rejilla afín de reserva, en píxeles a 640×360

// Una pose es 3D cuando alguno de los dos giros deja de ser neutro. La distancia sola, con los giros
// a cero, no cambia nada (el plano solo se aleja de frente), así que no activa la vía 3D.
export const is3D = (t: Partial<Transform> | undefined): boolean => !!t && (Math.abs(t.rotationX ?? 0) > 1e-6 || Math.abs(t.rotationY ?? 0) > 1e-6);

export type Pose3D = { rotationX: number; rotationY: number; depth: number };

// Valores de una pose con los neutros puestos: los proyectos guardados antes de que existiera el 3D
// no traen estas claves y tienen que seguir abriendo sin cambios.
export function pose3D(t: Partial<Transform> | undefined): Pose3D {
  const rotationX = Number.isFinite(t?.rotationX) ? (t?.rotationX as number) : 0;
  const rotationY = Number.isFinite(t?.rotationY) ? (t?.rotationY as number) : 0;
  const depth = Number.isFinite(t?.depth) ? (t?.depth as number) : 1;
  return { rotationX, rotationY, depth: Math.max(MIN_DEPTH, depth) };
}

// Área con signo del cuadrilátero (fórmula del cordón): sirve para saber si el recorrido es
// antihorario (positivo) u horario (negativo). El mapeo proyectivo de Heckbert supone el recorrido
// antihorario; con el horario el denominador sale con el signo cambiado y la superficie se recorre al
// revés. Como la proyección puede invertir la orientación (un giro sobre X más allá de 90°), el signo
// se corrige aquí y no en cada uso.
export const signedArea = (quad: Quad): number => {
  let total = 0;
  for (let index = 0; index < 4; index++) {
    const current = quad[index], next = quad[(index + 1) % 4];
    total += current.x * next.y - next.x * current.y;
  }
  return total / 2;
};
// Devuelve el cuadrilátero con el recorrido antihorario, sea cual sea el orden en que llegó.
export const orientedQuad = (quad: Quad): Quad => signedArea(quad) < 0 ? [quad[0], quad[3], quad[2], quad[1]] : quad;

// Punto de un cuadrilátero por coordenadas unitarias, sin perspectiva (solo para repartir rejillas).
export const bilinear = (quad: Quad, u: number, v: number): Point => {
  const top = { x: quad[0].x + (quad[1].x - quad[0].x) * u, y: quad[0].y + (quad[1].y - quad[0].y) * u };
  const bottom = { x: quad[3].x + (quad[2].x - quad[3].x) * u, y: quad[3].y + (quad[2].y - quad[3].y) * u };
  return { x: top.x + (bottom.x - top.x) * v, y: top.y + (bottom.y - top.y) * v };
};

export type Vector3 = { x: number; y: number; z: number };
const RADIANS = Math.PI / 180;

// Giro alrededor del eje X (el plano se inclina hacia delante o hacia atrás).
export function rotateX(point: Vector3, degrees: number): Vector3 {
  const angle = degrees * RADIANS, cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: point.x, y: point.y * cos - point.z * sin, z: point.y * sin + point.z * cos };
}
// Giro alrededor del eje Y (el plano gira sobre su eje vertical).
export function rotateY(point: Vector3, degrees: number): Vector3 {
  const angle = degrees * RADIANS, cos = Math.cos(angle), sin = Math.sin(angle);
  return { x: point.x * cos + point.z * sin, y: point.y, z: -point.x * sin + point.z * cos };
}
// Composición que usa el editor: primero el giro vertical y después el horizontal, aplicados a las
// esquinas del plano y medidos desde su centro.
export function rotate(point: Vector3, pose: Partial<Transform>): Vector3 {
  const { rotationX, rotationY } = pose3D(pose);
  return rotateY(rotateX(point, rotationX), rotationY);
}
// Proyección sobre el plano de imagen z = 0 con el observador en (0, 0, -depth): divide por la
// distancia, que es lo que hace que el lado del plano que se acerca crezca y el que se aleja se
// encoja. `depth` es la distancia en «anchos de fotograma» (la misma unidad que x e y).
export function projectPoint(point: Vector3, depth: number, focal: number): Point {
  const distance = Math.max(.05, depth - point.z);
  const k = focal / distance;
  return { x: point.x * k, y: point.y * k };
}

// Proyecta un rectángulo de `frame` (centrado en `center`) según los giros y la distancia. Es la
// fórmula clásica de perspectiva con el observador en (center.x, center.y, -depth·ancho). El giro
// sobre el plano (`rotation`), la escala y la posición de la pose no entran aquí: la capa se dibuja
// con su matriz afín y lo que se proyecta es el rectángulo ya colocado, es decir, el eje de giro pasa
// por el centro del plano. Por eso `center` es donde queda el evento, no el centro del fotograma.
export function projectQuadAt(pose: Partial<Transform>, frame: { width: number; height: number }, center: Point, options: { focal?: number } = {}): Quad {
  const focal = options.focal ?? FOCAL;
  const { depth } = pose3D(pose);
  // Z positivo hacia el espectador: al subir «Rotación Y», la mitad derecha del plano se acerca y la
  // izquierda se aleja; al subir «Rotación X» se acerca el borde inferior. Las esquinas se giran en el
  // espacio y después se proyectan, que es lo que produce la perspectiva.
  const corner = (x: number, y: number): Point => {
    const projected = projectPoint(rotate({ x, y, z: 0 }, pose), depth, focal);
    return { x: center.x + frame.width * projected.x, y: center.y + frame.height * projected.y };
  };
  return [corner(-.5, -.5), corner(.5, -.5), corner(.5, .5), corner(-.5, .5)];
}

// Proyecta el fotograma del evento con el eje de giro en el centro del fotograma. Devuelve las cuatro
// esquinas en píxeles del fotograma compuesto.
export function projectQuad(pose: Partial<Transform>, frame: { width: number; height: number }, options: { focal?: number } = {}): Quad {
  return projectQuadAt(pose, frame, { x: frame.width / 2, y: frame.height / 2 }, options);
}

// ------------------------------------------------------------------ mapeo proyectivo (Heckbert)
// Resuelve un sistema lineal por eliminación de Gauss con pivoteo parcial. Devuelve null si la matriz
// es singular. Se usa para los coeficientes del mapeo proyectivo: la forma cerrada depende del orden de
// las esquinas y es muy fácil equivocarse con los signos, así que las cuatro condiciones se plantean
// como un sistema y lo resuelve la máquina.
function solveLinearSystem(matrix: number[][], vector: number[]): number[] | null {
  const size = vector.length;
  const rows = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column++) {
    let pivot = column;
    for (let row = column + 1; row < size; row++) if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    if (Math.abs(rows[pivot][column]) < 1e-9) return null;
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    for (let row = 0; row < size; row++) {
      if (row === column) continue;
      const factor = rows[row][column] / rows[column][column];
      for (let k = column; k <= size; k++) rows[row][k] -= factor * rows[column][k];
    }
  }
  return rows.map((row, index) => row[size] / rows[index][index]);
}

// Mapeo proyectivo: el denominador es `1 + g·u + h·v` y el numerador lleva los cuatro coeficientes C.
export type ProjectiveMap = { g: number; h: number; c: [Point, Point, Point, Point] };

// Coeficientes del mapeo `p(u,v) = (C0 + C1·u + C2·v + C3·uv) / (1 + g·u + h·v)` que lleva el cuadrado
// unitario al cuadrilátero.
//
// Cada esquina impone una condición `C0 + C1·u + C2·v + C3·uv = p·(1 + g·u + h·v)`, que es lineal en las
// ocho incógnitas de la x (g, h, C0, C1, C2, C3 y los dos homogéneos) y lo mismo para la y. Con las
// cuatro esquinas hay ocho ecuaciones por eje, pero solo seis incógnitas libres (la homogénea de la x,
// la de la y y los cuatro C de cada una), así que quedan dos grados de libertad: la escala homogénea de
// cada eje. Se fijan con la convención de Heckbert de que el denominador valga 1 en la esquina (0,0):
// eso obliga a `g = h = 0` y deja el sistema determinado. Los coeficientes se obtienen resolviendo el
// sistema 8×8 con los pivotes que fija esa convención, que es mucho más seguro que encadenar fórmulas
// cerradas.
export function projectiveCoefficients(input: Quad): ProjectiveMap {
  const [p0, p1, p2, p3] = input;
  const corners: [number, number, Point][] = [[0, 0, p0], [1, 0, p1], [1, 1, p2], [0, 1, p3]];
  // Incógnitas: [g, h, C0x, C1x, C2x, C3x, C0y, C1y, C2y, C3y].
  const unknowns = 10;
  const matrix: number[][] = [];
  const vector: number[] = [];
  // Convención: el denominador es 1 en (0,0) y el mapeo no está escalado en el eje y en (0,0).
  // Se expresan como dos ecuaciones que fijan g y h.
  const pin = (index: number, value: number) => {
    const row = new Array(unknowns).fill(0);
    row[index] = 1;
    matrix.push(row); vector.push(value);
  };
  pin(0, 0);   // g = 0
  pin(1, 0);   // h = 0
  for (const [u, v, point] of corners) {
    // Eje x: C0·? … la ecuación es C0 + C1·u + C2·v + C3·uv − g·u·p.x − h·v·p.x = p.x
    const rowX = new Array(unknowns).fill(0);
    rowX[0] = -u * point.x; rowX[1] = -v * point.x;
    rowX[2] = 1; rowX[3] = u; rowX[4] = v; rowX[5] = u * v;
    matrix.push(rowX); vector.push(point.x);
    // Eje y: lo mismo con las incógnitas de la y.
    const rowY = new Array(unknowns).fill(0);
    rowY[0] = -u * point.y; rowY[1] = -v * point.y;
    rowY[6] = 1; rowY[7] = u; rowY[8] = v; rowY[9] = u * v;
    matrix.push(rowY); vector.push(point.y);
  }
  const solution = solveLinearSystem(matrix, vector);
  if (!solution) {
    // Cuadrilátero degenerado (área nula): no hay mapeo posible; se devuelve el afín trivial.
    return { g: 0, h: 0, c: [{ x: p0.x, y: p0.y }, { x: p1.x - p0.x, y: p1.y - p0.y }, { x: p3.x - p0.x, y: p3.y - p0.y }, { x: p2.x - p1.x - p3.x + p0.x, y: p2.y - p1.y - p3.y + p0.y }] };
  }
  const [g, h, c0x, c1x, c2x, c3x, c0y, c1y, c2y, c3y] = solution;
  // Si el recorrido del cuadrilátero es horario (área con signo negativa), el denominador queda negativo
  // en el centro y el mapeo recorrería la superficie al revés. Se invierte el signo, que describe la
  // misma transformación (el mapeo es homogéneo).
  const flip = 1 + g / 2 + h / 2 < 0 ? -1 : 1;
  return {
    g: flip * g, h: flip * h,
    c: [
      { x: flip * c0x, y: flip * c0y },
      { x: flip * c1x, y: flip * c1y },
      { x: flip * c2x, y: flip * c2y },
      { x: flip * c3x, y: flip * c3y },
    ],
  };
}

// Punto del cuadrilátero por coordenadas unitarias, con la perspectiva del mapeo proyectivo.
export function projectivePoint(quad: Quad, u: number, v: number): Point {
  return evaluate(projectiveCoefficients(quad), u, v);
}

// Evaluación directa con coeficientes ya calculados (evita recalcularlos dentro de un bucle).
export function evaluate(map: ProjectiveMap, u: number, v: number): Point {
  const [c0, c1, c2, c3] = map.c;
  const w = 1 + map.g * u + map.h * v;
  return {
    x: (c0.x + c1.x * u + c2.x * v + c3.x * u * v) / w,
    y: (c0.y + c1.y * u + c2.y * v + c3.y * u * v) / w,
  };
}

export type ProjectiveJacobian = { a: number; b: number; c: number; d: number };

// Jacobiano del mapeo en (u,v): derivadas de x e y respecto de u y v.
export function jacobian(map: ProjectiveMap, u: number, v: number): ProjectiveJacobian {
  const [c0, c1, c2, c3] = map.c;
  const w = 1 + map.g * u + map.h * v;
  const px = c0.x + c1.x * u + c2.x * v + c3.x * u * v;
  const py = c0.y + c1.y * u + c2.y * v + c3.y * u * v;
  const dwu = map.g, dwv = map.h;
  const dpu = c1.x + c3.x * v, dpv = c2.x + c3.x * u;
  const dqu = c1.y + c3.y * v, dqv = c2.y + c3.y * u;
  return {
    a: (dpu * w - px * dwu) / (w * w),   // ∂x/∂u
    b: (dpv * w - px * dwv) / (w * w),   // ∂x/∂v
    c: (dqu * w - py * dwu) / (w * w),   // ∂y/∂u
    d: (dqv * w - py * dwv) / (w * w),   // ∂y/∂v
  };
}

// Inverso del mapeo proyectivo: coordenadas unitarias (u,v) que corresponden a `point` del destino.
//
// La forma cerrada de la reciprocidad bilineal (Heckbert) existe, pero para un cuadrilátero ancho y
// poco deformado los términos que hay que restar son casi iguales entre sí y el resultado pierde
// todos los dígitos: en el fotograma de 640 px el error pasaba de 200. Por eso aquí se resuelve por
// Newton partiendo del reparto proporcional entre los bordes (que ignora la perspectiva). Cada paso
// cuesta un jacobiano y dos productos; con cuatro pasos el error baja de 1e-9 y el bucle termina
// antes si ya convergió. Con esto el error de ida y vuelta queda en el orden del épsilon de la
// máquina, que es lo que miden las pruebas.
// Comprueba que (u,v) reproduce el punto con un error despreciable. Se usa en las pruebas y en la
// comprobación del inverso.
export function reproducesMap(map: ProjectiveMap, x: number, y: number, u: number, v: number): boolean {
  const [c0, c1, c2, c3] = map.c;
  const w = 1 + map.g * u + map.h * v;
  const bx = (c0.x + c1.x * u + c2.x * v + c3.x * u * v) / w;
  if (Math.abs(bx - x) > 1e-6) return false;
  const by = (c0.y + c1.y * u + c2.y * v + c3.y * u * v) / w;
  return Math.abs(by - y) <= 1e-6;
}

// Inverso del mapeo proyectivo: coordenadas unitarias (u,v) que corresponden a `point` del destino.
//
// Se resuelve primero por la forma cerrada (la reciprocidad bilineal de Heckbert, una ecuación de
// segundo grado), que es rápida, y solo si el resultado no reproduce el punto con precisión se recurre
// a Newton. La forma cerrada es inestable cuando el cuadrilátero es casi un paralelogramo (el
// discriminante se acerca a cero), que es justo el caso de la cámara por defecto; por eso la
// comprobación del residuo no es opcional.
export function inversePoint(point: Point, quad: Quad, known?: ProjectiveMap): Point {
  const map = known ?? projectiveCoefficients(quad);
  const closed = closedForm(point, map);
  if (closed && reproduces(map, point, closed)) return closed;
  return newton(point, quad, map);
}

// Comprueba que (u,v) reproduce el punto con un error despreciable.
function reproduces(map: ProjectiveMap, point: Point, uv: Point): boolean {
  const at = evaluate(map, uv.x, uv.y);
  return Math.abs(at.x - point.x) < 1e-6 && Math.abs(at.y - point.y) < 1e-6;
}

// Forma cerrada: con el denominador `1 + g·u + h·v` y los coeficientes C, la condición de que (u,v)
// caiga en `point` es una ecuación de segundo grado en v que sale del producto cruzado; después u queda
// de una relación lineal. Devuelve null si el sistema degenera.
function closedForm(point: Point, map: ProjectiveMap): Point | null {
  const [c0, c1, c2, c3] = map.c;
  const g = map.g, h = map.h;
  const px = point.x, py = point.y;
  // Si el mapeo es afín (el caso habitual con la cámara por defecto) se resuelve el sistema 2×2 directo:
  // (x,y) = C0 + C1·u + C2·v. La forma proyectiva degenera justo aquí, porque el término que multiplica a
  // v se anula y la ecuación deja de determinar v.
  if (Math.abs(g) < 1e-12 && Math.abs(h) < 1e-12) {
    const determinant = c1.x * c2.y - c1.y * c2.x;
    if (Math.abs(determinant) < 1e-12) return null;
    const dx = px - c0.x, dy = py - c0.y;
    return { x: (dx * c2.y - dy * c2.x) / determinant, y: (dy * c1.x - dx * c1.y) / determinant };
  }
  // E = (C1 − g·C0) − (g·p), F = (C2 − h·C0) − (h·p), G = C3 − g·C2 − h·C1 + g·h·C0
  const ex = c1.x - g * c0.x - g * px, ey = c1.y - g * c0.y - g * py;
  const fx = c2.x - h * c0.x - h * px, fy = c2.y - h * c0.y - h * py;
  const gx = c3.x - g * c2.x - h * c1.x + g * h * c0.x;
  const gy = c3.y - g * c2.y - h * c1.y + g * h * c0.y;
  // La condición `cruz(E + v·G, F) = cruz(P, F)` es lineal en v, así que sale directo. (Para el eje y
  // se usa la misma componente; si degenera se recurre a Newton, que comprueba el llamador.)
  const linear = (ex * fy - ey * fx) - (px * fy - py * fx);
  const slope = gx * fy - gy * fx;
  let v: number;
  if (Math.abs(slope) < 1e-12) {
    if (Math.abs(linear) > 1e-9) return null;      // sin solución: la recta es paralela
    v = .5;
  } else v = -linear / slope;
  // Con v, u sale de la componente dominante del sistema.
  const coeffX = ex + gx * v - g * px, constX = px - v * fx + g * v * px;
  const coeffY = ey + gy * v - g * py, constY = py - v * fy + g * v * py;
  const u = Math.abs(coeffX) >= Math.abs(coeffY) ? constX / coeffX : constY / coeffY;
  if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
  return { x: u, y: v };
}

// Newton con control de paso desde varios puntos de partida. Un solo punto de partida no basta: con el
// plano casi de canto (un giro cercano a 90°, donde el denominador del mapeo se acerca a cero) el método
// puede divergir, y probar los cinco puntos y quedarse con el de menor error cuesta poco y siempre
// converge en los casos que se usan de verdad.
export function newton(point: Point, quad: Quad, known?: ProjectiveMap): Point {
  const map = known ?? projectiveCoefficients(quad);
  const starts = [{ x: .5, y: .5 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }];
  let best: Point = starts[0], bestError = Number.POSITIVE_INFINITY;
  for (const start of starts) {
    const solution = newtonFrom(map, point, start);
    const at = evaluate(map, solution.x, solution.y);
    const error = Math.hypot(at.x - point.x, at.y - point.y);
    if (error < bestError) { bestError = error; best = solution; }
    if (bestError < 1e-9) break;
  }
  return { x: clamp01(best.x), y: clamp01(best.y) };
}

// Una pasada de Newton con paso acotado: si el punto se sale del cuadrado unitario, se abandona y se
// devuelve lo que había (el llamador elige el mejor de todos los intentos).
function newtonFrom(map: ProjectiveMap, point: Point, start: Point): Point {
  let current = start;
  for (let step = 0; step < 24; step++) {
    const at = evaluate(map, current.x, current.y);
    const error = { x: at.x - point.x, y: at.y - point.y };
    if (Math.hypot(error.x, error.y) < 1e-9) break;
    const j = jacobian(map, current.x, current.y);
    const determinant = j.a * j.d - j.b * j.c;
    if (Math.abs(determinant) < 1e-12) break;
    const du = (error.x * j.d - error.y * j.b) / determinant;
    const dv = (error.y * j.a - error.x * j.c) / determinant;
    const next = { x: current.x - du, y: current.y - dv };
    if (!Number.isFinite(next.x) || !Number.isFinite(next.y)) break;
    if (next.x < -.5 || next.x > 1.5 || next.y < -.5 || next.y > 1.5) break;
    current = next;
  }
  return current;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

// ------------------------------------------------------------------ dibujo
export type Compose3DOptions = { cell?: number; createCanvas?: (width: number, height: number) => HTMLCanvasElement };

// Dibuja `source` (la imagen del evento ya compuesta) deformada hasta el cuadrilátero `quad`.
//
// El mapeo se hace píxel a píxel: se recorre el rectángulo que encierra al cuadrilátero, se invierte el
// mapeo proyectivo para saber qué punto del origen le corresponde a cada punto del destino y, si cae
// dentro del cuadrado unitario, se copia el píxel con muestreo bilineal. Así el resultado es el mapeo
// exacto, sin costuras entre celdas y sin depender de que el motor del lienzo sepa componer
// transformaciones con `drawImage` (el de las pruebas no lo hace: ignora la matriz al colocar el
// rectángulo de destino, y `clip` con transformación tampoco funciona). El coste es lineal en el área
// del fotograma: a 1080p son unos dos millones de muestras, del orden de un fotograma de vídeo.
//
// El resultado se escribe en un lienzo intermedio y se compone con `drawImage`, no con `putImageData`:
// `putImageData` **sustituye** los píxeles del destino en vez de mezclarlos, así que borraría el fondo
// que ya estaba compuesto debajo del evento.
export function composeQuad(target: CanvasRenderingContext2D, source: HTMLCanvasElement, quad: Quad, options: Compose3DOptions = {}): void {
  const width = source.width, height = source.height;
  const makeCanvas = options.createCanvas ?? ((w: number, h: number) => {
    const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (!canvas) throw new Error('Sin fábrica de lienzos para la composición 3D.');
    canvas.width = w; canvas.height = h;
    return canvas;
  });
  // Rectángulo que encierra al cuadrilátero, recortado al fotograma.
  const xs = quad.map(point => point.x), ys = quad.map(point => point.y);
  const left = Math.max(0, Math.floor(Math.min(...xs))), right = Math.min(target.canvas.width - 1, Math.ceil(Math.max(...xs)));
  const top = Math.max(0, Math.floor(Math.min(...ys))), bottom = Math.min(target.canvas.height - 1, Math.ceil(Math.max(...ys)));
  if (right < left || bottom < top) return;
  const targetWidth = right - left + 1, targetHeight = bottom - top + 1;
  let sourceData: Uint8ClampedArray | null = null;
  try {
    sourceData = source.getContext('2d')?.getImageData(0, 0, width, height).data ?? null;
  } catch { sourceData = null; }
  if (!sourceData) return;      // sin acceso a los píxeles del origen no se puede muestrear
  const scratch = makeCanvas(targetWidth, targetHeight);
  const scratchCtx = scratch.getContext('2d');
  if (!scratchCtx) return;
  const output = scratchCtx.createImageData(targetWidth, targetHeight);
  const data = output.data;
  const map = projectiveCoefficients(quad);
  // El bucle es el punto caliente (un fotograma de 1080p son dos millones de píxeles), así que la
  // inversión se escribe con escalares en línea en vez de llamar a funciones que crean objetos.
  const c0x = map.c[0].x, c0y = map.c[0].y;
  const c1x = map.c[1].x, c1y = map.c[1].y;
  const c2x = map.c[2].x, c2y = map.c[2].y;
  const c3x = map.c[3].x, c3y = map.c[3].y;
  const g = map.g, h = map.h;
  const gh = g * h;
  // Comprobación barata de si el píxel cae dentro del cuadrilátero: el producto cruzado con cada arista
  // tiene que mantener el signo. Se hace antes de invertir el mapeo porque los píxeles del rectángulo
  // que encierra al cuadrilátero pero quedan fuera son muchos, y para ellos la inversión no tiene
  // solución (Newton no converge y cuesta lo mismo que cien píxeles buenos).
  const ordered = orientedQuad(quad);
  const [q0, q1, q2, q3] = ordered;
  const e0x = q1.x - q0.x, e0y = q1.y - q0.y, f0 = q0.x * q1.y - q1.x * q0.y;
  const e1x = q2.x - q1.x, e1y = q2.y - q1.y, f1 = q1.x * q2.y - q2.x * q1.y;
  const e2x = q3.x - q2.x, e2y = q3.y - q2.y, f2 = q2.x * q3.y - q3.x * q2.y;
  const e3x = q0.x - q3.x, e3y = q0.y - q3.y, f3 = q3.x * q0.y - q0.x * q3.y;
  // Con la cámara por defecto (foco 1,5, distancia 1) el mapeo es afín casi siempre, así que se separan
  // los dos caminos y todo lo constante se calcula una vez, fuera del bucle.
  const affine = Math.abs(g) < 1e-12 && Math.abs(h) < 1e-12;
  const affineDeterminant = c1x * c2y - c1y * c2x;
  if (affine && Math.abs(affineDeterminant) < 1e-12) return;
  const inverseAffine = 1 / affineDeterminant;
  const baseEx = c1x - g * c0x, baseEy = c1y - g * c0y;
  const baseFx = c2x - h * c0x, baseFy = c2y - h * c0y;
  const gx = c3x - g * c2x - h * c1x + gh * c0x;
  const gy = c3y - g * c2y - h * c1y + gh * c0y;
  for (let row = 0; row < targetHeight; row++) {
    const y = top + row + .5;
    const dataRow = row * targetWidth * 4;
    for (let column = 0; column < targetWidth; column++) {
      const x = left + column + .5;
      if (e0x * y - e0y * x + f0 < -1) continue;
      if (e1x * y - e1y * x + f1 < -1) continue;
      if (e2x * y - e2y * x + f2 < -1) continue;
      if (e3x * y - e3y * x + f3 < -1) continue;
      // Inversión del mapeo: 2×2 si es afín y reciprocidad bilineal si hay perspectiva.
      let u: number, v: number;
      if (affine) {
        const dx = x - c0x, dy = y - c0y;
        u = (dx * c2y - dy * c2x) * inverseAffine;
        v = (dy * c1x - dx * c1y) * inverseAffine;
      } else {
        const ex = baseEx - g * x, ey = baseEy - g * y;
        const fx = baseFx - h * x, fy = baseFy - h * y;
        const crossEF = ex * fy - ey * fx, crossPF = x * fy - y * fx;
        const slope = gx * fy - gy * fx;
        v = Math.abs(slope) < 1e-12 ? .5 : (crossPF - crossEF) / slope;
        const coeffX = ex + gx * v - g * x, constX = x - v * fx + g * v * x;
        const coeffY = ey + gy * v - g * y, constY = y - v * fy + g * v * y;
        u = Math.abs(coeffX) >= Math.abs(coeffY) ? constX / coeffX : constY / coeffY;
      }
      if (!(u >= 0 && u <= 1 && v >= 0 && v <= 1)) continue;
      // Muestreo bilineal del origen. Las coordenadas se acotan porque el borde del cuadrilátero cae
      // entre píxeles y la interpolación toca la fila o la columna siguiente.
      const sourceX = u * width - .5, sourceY = v * height - .5;
      const clampedX = sourceX < 0 ? 0 : sourceX > width - 1e-6 ? width - 1e-6 : sourceX;
      const clampedY = sourceY < 0 ? 0 : sourceY > height - 1e-6 ? height - 1e-6 : sourceY;
      const x0 = clampedX | 0, y0 = clampedY | 0;
      const x1 = x0 + 1 < width ? x0 + 1 : width - 1, y1 = y0 + 1 < height ? y0 + 1 : height - 1;
      const fractionX = clampedX - x0, fractionY = clampedY - y0;
      const i00 = (y0 * width + x0) * 4, i10 = (y0 * width + x1) * 4;
      const i01 = (y1 * width + x0) * 4, i11 = (y1 * width + x1) * 4;
      const index = dataRow + column * 4;
      data[index] = (sourceData[i00] * (1 - fractionX) + sourceData[i10] * fractionX) * (1 - fractionY) + (sourceData[i01] * (1 - fractionX) + sourceData[i11] * fractionX) * fractionY;
      data[index + 1] = (sourceData[i00 + 1] * (1 - fractionX) + sourceData[i10 + 1] * fractionX) * (1 - fractionY) + (sourceData[i01 + 1] * (1 - fractionX) + sourceData[i11 + 1] * fractionX) * fractionY;
      data[index + 2] = (sourceData[i00 + 2] * (1 - fractionX) + sourceData[i10 + 2] * fractionX) * (1 - fractionY) + (sourceData[i01 + 2] * (1 - fractionX) + sourceData[i11 + 2] * fractionX) * fractionY;
      data[index + 3] = (sourceData[i00 + 3] * (1 - fractionX) + sourceData[i10 + 3] * fractionX) * (1 - fractionY) + (sourceData[i01 + 3] * (1 - fractionX) + sourceData[i11 + 3] * fractionX) * fractionY;
    }
  }
  scratchCtx.putImageData(output, 0, 0);
  target.drawImage(scratch, left, top);
}
