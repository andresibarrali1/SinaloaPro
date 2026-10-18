// Pruebas de la forma de onda: aritmética pura sobre muestras y picos, sin lienzo ni navegador.
//
// Lo que se comprueba: que cada columna se queda con el pico **mayor** de su tramo (y no con la muestra más
// cercana, que es lo que aplanaba la onda), que el tramo se recorta al material y se ordena si llega al revés,
// que se prefiere el sonido decodificado a la copia guardada, que la copia guardada tiene detalle suficiente y
// que el trazado SVG sale simétrico alrededor de la línea central.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_WAVEFORM_COLUMNS,MIN_WAVEFORM_COLUMNS,PCM_WAVEFORM_SECONDS,STORED_PEAKS,bucketColumns,columnsFor,peakBuckets,peakColumns,sourceRange,waveformFor,waveformPath} from '../lib/editor/waveform';

const RATE=1000;   // 1 000 muestras por segundo: cada milisegundo es una muestra, fácil de leer en las pruebas
const ramp=(seconds:number)=>Float32Array.from({length:Math.round(seconds*RATE)},(_,i)=>i/1000);
const close=(actual:number,expected:number,tolerance=1e-6)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} no está cerca de ${expected}`);

test('columnas: cada una se queda con el pico mayor de su tramo, no con la muestra más cercana',()=>{
 // Una señal con un pico aislado en el milisegundo 250 (0,25 s) y silencio en el resto.
 const samples=new Float32Array(1000);
 samples[250]=.9; samples[251]=-.4;
 // En 4 columnas de 0,25 s cada una, el pico cae en la segunda: si se tomara la muestra más cercana al centro de
 // la columna (125, 375, 625, 875) el pico se perdería por completo.
 const columns=peakColumns(samples,RATE,0,1,4);
 assert.equal(columns.length,4);
 assert.equal(columns[0],0);
 close(columns[1],.9);
 assert.equal(columns[2],0);
 assert.equal(columns[3],0);
 // Una columna muy corta sigue viendo el pico: al acercar el zoom no aparecen huecos.
 const fine=peakColumns(samples,RATE,.2,.3,10);
 assert.ok(fine.some(value=>value>.89),'el pico sigue estando al acercar');
 assert.equal(fine.reduce((total,value)=>total+value,0)>0,true);
 // Y al alejar no se pierden los picos: todo el archivo en una columna da el mayor de todos.
 close(peakColumns(samples,RATE,0,1,1)[0],.9);
 // El tramo se ordena si llega al revés, se recorta a lo que hay y una petición sin sentido no rompe nada.
 assert.deepEqual(peakColumns(samples,RATE,1,0,4),columns);
 assert.deepEqual(peakColumns(samples,RATE,0,99,2).length,2);
 assert.deepEqual(peakColumns(samples,RATE,-5,-1,2),[0,0]);
 assert.equal(peakColumns(samples,RATE,0,1,0).length,1);
 assert.deepEqual(peakColumns(new Float32Array(0),RATE,0,1,3),[0,0,0]);
 assert.deepEqual(peakColumns(samples,0,0,1,3),[0,0,0]);
});

test('picos guardados: cada columna toma el mayor de los picos que cubre y el más cercano si el tramo es menor',()=>{
 const peaks=[0,.2,.8,.4,1,.1];
 // Dos columnas sobre 3 s (picos de 0,5 s): la primera cubre .0/.2/.8 y se queda con .8; la segunda, con 1.
 assert.deepEqual(bucketColumns(peaks,3,0,3,2),[.8,1]);
 // Una columna sobre medio segundo (un solo pico): el más cercano, sin huecos.
 assert.deepEqual(bucketColumns(peaks,3,1,1.5,1),[.8]);
 // Un tramo que se sale del medio: la parte que existe enseña sus picos y la que no, silencio (que es lo que
 // suena cuando el evento es más largo que el material).
 assert.deepEqual(bucketColumns(peaks,3,0,30,2),[1,0]);
 assert.deepEqual(bucketColumns(peaks,3,6,9,1),[0]);
 assert.equal(bucketColumns(undefined,3,0,1,4),null);
 assert.equal(bucketColumns([],3,0,1,4),null);
 assert.equal(bucketColumns(peaks,0,0,1,4),null);
});

test('onda de un evento: prefiere las muestras decodificadas y, si no están, usa los picos guardados',()=>{
 const samples=ramp(1);
 const withPcm=waveformFor({samples,sampleRate:RATE,peaks:[0,0,0],duration:1,from:0,to:1,columns:100});
 assert.equal(withPcm?.source,'pcm');
 assert.equal(withPcm?.values.length,100);
 const stored=waveformFor({peaks:[.1,.9,.3],duration:3,from:0,to:3,columns:MIN_WAVEFORM_COLUMNS});
 assert.equal(stored?.source,'guardado');
 assert.equal(stored?.values.length,MIN_WAVEFORM_COLUMNS);
 assert.equal(stored?.values[0],.1);
 assert.equal(stored?.values[Math.floor(MIN_WAVEFORM_COLUMNS/2)],.9);
 assert.equal(stored?.values[MIN_WAVEFORM_COLUMNS-1],.3);
 // Sin muestras ni picos no se inventa nada.
 assert.equal(waveformFor({duration:3,from:0,to:3,columns:10}),null);
 // El material al revés da la vuelta a las columnas (el pico es el mismo, cambia de sitio).
 const reversed=waveformFor({peaks:[.1,.9,.3],duration:3,from:0,to:3,columns:MIN_WAVEFORM_COLUMNS,reversed:true});
 assert.equal(reversed?.values[0],.3);
 assert.equal(reversed?.values[Math.floor(MIN_WAVEFORM_COLUMNS/2)],.9);
 assert.equal(reversed?.values[MIN_WAVEFORM_COLUMNS-1],.1);
 // El número de columnas se limita por arriba y por abajo.
 assert.equal(waveformFor({peaks:[.5],duration:1,from:0,to:1,columns:99999})?.values.length,MAX_WAVEFORM_COLUMNS);
 assert.equal(waveformFor({peaks:[.5],duration:1,from:0,to:1,columns:1})?.values.length,MIN_WAVEFORM_COLUMNS);
 // Un tramo largo se dibuja con los picos guardados en vez de barrer las muestras: es lo que mantiene ligero el
 // zoom de la línea de tiempo (el detalle de las muestras a esa escala no se ve) y el material sigue sonando.
 const long=waveformFor({samples:ramp(30),sampleRate:RATE,peaks:[.2,.7],duration:30,from:0,to:30,columns:100});
 assert.equal(long?.source,'guardado');
 assert.equal(long?.values.length,100);
 assert.equal(waveformFor({samples:ramp(30),sampleRate:RATE,peaks:[.2,.7],duration:30,from:0,to:PCM_WAVEFORM_SECONDS,columns:100})?.source,'pcm');
 // El número de columnas se limita por arriba y por abajo, y baja al escalón de la escalera: así el zoom de la
 // línea de tiempo no reconstruye el trazado en cada paso, pero el detalle sigue siendo de una columna por píxel
 // como mucho y de media columna por píxel como poco.
 assert.equal(columnsFor(900),768);
 assert.equal(columnsFor(1100),1024);
 assert.ok(columnsFor(900)>=900/2&&columnsFor(900)<=900,'la escalera no se queda corta de detalle');
 assert.equal(columnsFor(2),MIN_WAVEFORM_COLUMNS);
 assert.equal(columnsFor(100000),MAX_WAVEFORM_COLUMNS);
 // El tramo que consume un evento tiene en cuenta la velocidad (y una velocidad absurda no da un tramo al revés).
 assert.deepEqual(sourceRange(2,4,1),{from:2,to:6});
 assert.deepEqual(sourceRange(2,4,.5),{from:2,to:4});
 assert.deepEqual(sourceRange(2,4,-1),{from:2,to:2});
});

test('trazado: la silueta es simétrica alrededor de la línea central y el contorno pasa por los picos',()=>{
 const values=[0,.5,1];
 const path=waveformPath(values);
 // Empieza y termina en la línea central (y=50): sube por la envolvente, baja por la misma vuelta y cierra. Las
 // coordenadas van en enteros (el trazado es la mitad de largo que con decimales).
 assert.equal(path,'M0,50 L0,50 L1,27 L2,4 L2,50 L2,96 L1,73 L0,50 Z');
 // Las columnas están de una en una: sube por las tres, baja por las tres y cierra por la línea central.
 assert.equal(path.match(/L/g)?.length,values.length*2+1);
 assert.ok(!/L\d+,-/.test(path),'el trazado no se sale por arriba');
 // Los valores fuera de rango y los no finitos se recortan en vez de deformar el dibujo.
 assert.match(waveformPath([2]),/,4 /);
 assert.match(waveformPath([Number.NaN]),/,50 /);
 assert.equal(waveformPath([]),'');
 // La silueta es simétrica: lo que sube por arriba baja lo mismo por abajo.
 const ys=(path.match(/,(-?\d+)/g)??[]).map(text=>Number(text.slice(1)));
 assert.equal(50-Math.min(...ys),Math.max(...ys)-50);
});

test('copia de picos del medio: 1 024 valores de 0 a 1 con tres decimales',()=>{
 assert.equal(STORED_PEAKS,1024);
 const samples=new Float32Array(4096);
 samples[10]=1; samples[2048]=-.75;
 const peaks=peakBuckets(samples,8);
 assert.equal(peaks.length,8);
 assert.equal(peaks[0],1);                       // el pico de la primera octava parte
 assert.equal(peaks[4],.75);
 assert.equal(peaks[1],0);
 assert.ok(peaks.every(value=>value>=0&&value<=1),'los picos van de 0 a 1');
 // Tres decimales como mucho: el archivo no engorda con ruido de coma flotante.
 assert.ok(peakBuckets(Float32Array.from([.123456789]),1).every(value=>String(value).replace(/^\d*\.?/,'').length<=3));
 // Un material con más picos que muestras y un array vacío no rompen nada.
 assert.equal(peakBuckets(samples,0).length,1);
 assert.equal(peakBuckets(new Float32Array(0),4).length,4);
 assert.deepEqual(peakBuckets(new Float32Array(0),4),[0,0,0,0]);
});
