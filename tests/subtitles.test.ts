// Pruebas de los subtítulos: de las frases a eventos de texto, su estilo legible y —lo que estaba fallando—
// que el texto se pinte dentro del fotograma cuando el evento lleva desplazamiento vertical.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newEvent,newProject,ticks} from '../lib/editor/project';
import {SUBTITLE_STYLE,addSubtitles,looksLikeSrt,srtDuration,subtitleEvents} from '../lib/editor/subtitles';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const cues=[{start:0,end:1.2,text:'Hola, esto es un subtítulo de prueba'},{start:1.4,end:2.8,text:'Y esta es la segunda línea'}];

test('frases a eventos: se crea la pista «Subtítulos» delante, con los tiempos y el estilo legible',()=>{
  const project=newProject();
  const ids=addSubtitles(project,cues);
  assert.equal(ids.length,2);
  const track=project.tracks[0];
  assert.equal(track.name,'Subtítulos');
  assert.equal(track.kind,'video');
  const events=project.events.filter(event=>event.kind==='text');
  assert.equal(events.length,2);
  assert.equal(events[0].trackId,track.id);
  assert.equal(events[0].text,'Hola, esto es un subtítulo de prueba');
  assert.equal(events[0].start,0);
  assert.equal(events[0].duration,ticks(1.2));
  assert.equal(events[1].start,ticks(1.4));
  assert.equal(events[0].fontSize,SUBTITLE_STYLE.fontSize);
  assert.equal(events[0].color,SUBTITLE_STYLE.color);
  assert.ok((events[0].outlineWidth??0)>0,'el contorno es lo que hace legible el subtítulo sobre imagen clara');
  assert.equal(events[0].outlineColor,'#000000');
  assert.equal(events[0].transform.y,SUBTITLE_STYLE.offsetY);
  // Las frases vacías se descartan y una frase sin duración dura al menos 0,2 s (nunca menos de un fotograma).
  const only=subtitleEvents(newProject(),[{start:0,end:0,text:'Corta'},{start:1,end:2,text:'   '}]);
  assert.equal(only.length,1);
  assert.equal(only[0].duration,ticks(.2));
});

test('reconocer un archivo de subtítulos y sacar su duración',()=>{
  const text='1\n00:00:01,000 --> 00:00:02,500\nHola\n\n2\n00:01:03,250 --> 00:01:04,000\nAdiós\n';
  assert.equal(looksLikeSrt('subtitulos.srt',text),true);
  assert.equal(looksLikeSrt('notas.txt',text),true,'también se reconoce por el contenido');
  assert.equal(looksLikeSrt('video.mp4','binario'),false);
  assert.equal(srtDuration(text),64);
  assert.equal(srtDuration('sin marcas'),0);
});

test('el texto se pinta dentro del fotograma aunque el evento lleve desplazamiento',async()=>{
  // Este era el fallo: con y = 0,34 (lo que usa la transcripción) el texto se dibujaba fuera del fotograma,
  // porque el desplazamiento se aplicaba dos veces: una en la matriz del contexto y otra en el plan de texto.
  const renderPixels=async(x:number,y:number)=>{
    const project=newProject();
    project.width=1920;project.height=1080;
    const floor=newEvent(project.tracks[1].id,'color',0,ticks(2));
    floor.color='#000000';
    project.events.push(floor);
    const event=newEvent(project.tracks[0].id,'text',0,ticks(2));
    event.text='Hola';event.fontSize=90;event.color='#ffffff';
    event.transform={...event.transform,x,y};
    project.events.push(event);
    const canvas=createCanvas(320,180);
    await compose(canvas as unknown as HTMLCanvasElement,project,new MediaLibrary(),ticks(1),{createCanvas:factory});
    const data=canvas.getContext('2d').getImageData(0,0,320,180).data;
    const points:{x:number;y:number}[]=[];
    for(let row=0;row<180;row++)for(let column=0;column<320;column++){
      const index=(row*320+column)*4;
      if(data[index]>230&&data[index+1]>230&&data[index+2]>230)points.push({x:column,y:row});
    }
    return points;
  };
  const centred=await renderPixels(0,0);
  assert.ok(centred.length>20,'el texto centrado se pinta');
  const low=await renderPixels(0,.34);
  assert.ok(low.length>20,`con el desplazamiento de los subtítulos también (${low.length} píxeles)`);
  const averageY=(points:{y:number}[])=>points.reduce((sum,point)=>sum+point.y,0)/points.length;
  assert.ok(averageY(low)>averageY(centred)+20,'y queda por debajo del centro del fotograma');
  const right=await renderPixels(.25,0);
  assert.ok(right.length>20,'el desplazamiento horizontal tampoco lo saca del fotograma');
  const averageX=(points:{x:number}[])=>points.reduce((sum,point)=>sum+point.x,0)/points.length;
  assert.ok(averageX(right)>averageX(centred)+40,'y mueve el texto a la derecha una sola vez');
});
