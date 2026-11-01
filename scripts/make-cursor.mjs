import {createCanvas} from '@napi-rs/canvas';
import {writeFile} from 'node:fs/promises';
const canvas = createCanvas(24, 32);
const ctx = canvas.getContext('2d');
ctx.beginPath();
ctx.moveTo(2, 1);
ctx.lineTo(22, 1);
ctx.lineTo(22, 21);
ctx.lineTo(12, 31);
ctx.lineTo(2, 21);
ctx.closePath();
ctx.fillStyle = '#f4f4f4';
ctx.fill();
ctx.lineWidth = 1.2;
ctx.strokeStyle = '#0b0e10';
ctx.lineJoin = 'round';
ctx.stroke();
ctx.fillStyle = '#1f2529';
for (const x of [6.5, 13.5]) {
  ctx.beginPath();
  ctx.roundRect(x, 6, 4, 4, 0.6);
  ctx.fill();
}
await writeFile(process.argv[2], canvas.toBuffer('image/png'));
console.log('escrito', process.argv[2]);
