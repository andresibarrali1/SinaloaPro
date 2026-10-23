// Iconos de la aplicación instalable y del acceso directo del escritorio: misma identidad que el favicon (fondo
// oscuro, marco azul claro, barra azul y la «C») en los tamaños que pide Chrome para instalar (192 y 512), una versión
// «maskable» con margen de seguridad, el icono de iOS y un .ico para el acceso directo de Windows.
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';

const salida = 'public/icons';
mkdirSync(salida, { recursive: true });

/** Dibuja el icono al tamaño pedido; `margen` es la parte del lado que se deja libre alrededor del marco. */
function dibujar(tamano, margen) {
  const lienzo = createCanvas(tamano, tamano);
  const pincel = lienzo.getContext('2d');
  pincel.fillStyle = '#252b30';
  pincel.fillRect(0, 0, tamano, tamano);
  const lado = tamano * (1 - 2 * margen);
  const x = (tamano - lado) / 2;
  pincel.fillStyle = '#76caff';
  pincel.font = `900 ${Math.round(lado * .85)}px Arial, sans-serif`;
  pincel.textAlign = 'center';pincel.textBaseline = 'alphabetic';
  pincel.fillText('S', tamano / 2, x + lado * .73);
  pincel.fillStyle = '#ffffff';
  pincel.font = `bold ${Math.round(lado * .25)}px Arial, sans-serif`;
  pincel.fillText('Pro', x + lado * .70, x + lado * .99);
  return lienzo;
}

for (const [nombre, tamano, margen] of [
  ['favicon-s-pro-v3.png', 32, 0.02],
  ['icon-192.png', 192, 0.14],
  ['icon-512.png', 512, 0.14],
  ['icon-maskable-512.png', 512, 0.245],
  ['apple-touch-icon.png', 180, 0.14],
]) {
  writeFileSync(`${salida}/${nombre}`, dibujar(tamano, margen).toBuffer('image/png'));
  console.log(`${salida}/${nombre} · ${tamano}×${tamano}`);
}

// .ico para el acceso directo de Windows: cabecera ICO + una única imagen de 256×256 en PNG (lo que acepta Windows
// desde Vista). Guardar el PNG dentro del .ico evita tener que montar los mapas de bits a mano.
const png = dibujar(256, 0.14).toBuffer('image/png');
const cabecera = Buffer.alloc(6);
cabecera.writeUInt16LE(0, 0);
cabecera.writeUInt16LE(1, 2); // 1 = icono
cabecera.writeUInt16LE(1, 4); // una imagen
const entrada = Buffer.alloc(16);
entrada.writeUInt8(0, 0); // 256 px se escribe como 0
entrada.writeUInt8(0, 1);
entrada.writeUInt8(0, 2);
entrada.writeUInt8(0, 3);
entrada.writeUInt16LE(1, 4); // planos
entrada.writeUInt16LE(32, 6); // bits por píxel
entrada.writeUInt32LE(png.length, 8);
entrada.writeUInt32LE(6 + 16, 12);
writeFileSync(`${salida}/sinaloa-pro.ico`, Buffer.concat([cabecera, entrada, png]));
console.log(`${salida}/sinaloa-pro.ico · 256×256 (para el acceso directo)`);
