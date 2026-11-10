// Pruebas de los acabados premium del texto: mayúsculas, relleno degradado, solo contorno, cajas por línea y
// la caja que crece detrás de la palabra activa. Se renderiza con el compositor real sobre el lienzo de
// @napi-rs/canvas y se cuentan píxeles, no se describe la teoría.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createCanvas} from '@napi-rs/canvas';
import {compose} from '../lib/editor/compositor';
import {MediaLibrary} from '../lib/editor/media';
import {newEvent,newProject,ticks,type Event} from '../lib/editor/project';
import {styleOf,textCase} from '../lib/editor/titles';
import {DEFAULT_GRADIENT} from '../lib/editor/titles';
import {validateProject} from '../lib/editor/validation';

const factory=(width:number,height:number)=>createCanvas(width,height) as unknown as HTMLCanvasElement;
const W=320,H=180;

function projectWith(patch:Partial<Event>, text='UNO DOS TRES'){
 const project=newProject();project.width=W;project.height=H;
 const event=newEvent(project.tracks[0].id,'text',0,ticks(4));
 event.text=text;event.font='Arial';event.fontSize=40;event.color='#ffffff';
 Object.assign(event,patch);
 project.events.push(event);
 return project;
}
async function render(project:ReturnType<typeof projectWith>, seconds=2){
 const canvas=createCanvas(W,H);
 await compose(canvas as unknown as HTMLCanvasElement,project,new MediaLibrary(),ticks(seconds),{createCanvas:factory});
 return canvas.getContext('2d') as unknown as CanvasRenderingContext2D;
}
function count(ctx:CanvasRenderingContext2D, predicate:(r:number,g:number,b:number,a:number)=>boolean){
 const data=ctx.getImageData(0,0,W,H).data;let total=0;
 for(let index=0;index<data.length;index+=4)if(predicate(data[index],data[index+1],data[index+2],data[index+3]))total++;
 return total;
}

test('estilo: los campos premium tienen valores neutros y mayúsculas respeta el idioma',()=>{
 const style=styleOf({});
 assert.equal(style.uppercase,false);
 assert.equal(style.hollow,false);
 assert.equal(style.gradient.enabled,DEFAULT_GRADIENT.enabled);
 assert.equal(style.background.radius,0);
 assert.equal(style.background.fit,'block');
 assert.equal(style.highlightBox,false);
 assert.equal(textCase('canción',true),'CANCIÓN');
 assert.equal(textCase('canción',false),'canción');
});

test('mayúsculas: el texto en caja alta ocupa más tinta que el mismo texto en minúsculas',async()=>{
 const lower=await render(projectWith({animation:'none'},'hola mundo'));
 const upper=await render(projectWith({animation:'none',uppercase:true},'hola mundo'));
 const ink=(ctx:CanvasRenderingContext2D)=>count(ctx,(r,g,b)=>r>200&&g>200&&b>200);
 assert.ok(ink(upper)>ink(lower),`la caja alta debería ocupar más (${ink(upper)} vs ${ink(lower)})`);
});

test('degradado: el relleno pasa de un color a otro y no queda blanco plano',async()=>{
 const ctx=await render(projectWith({animation:'none',text:'MMMM',fontSize:64,gradient:{enabled:true,from:'#ff0000',to:'#0000ff',angle:0}}));
 const reds=count(ctx,(r,g,b)=>r>150&&b<100);
 const blues=count(ctx,(r,g,b)=>b>150&&r<100);
 const whites=count(ctx,(r,g,b)=>r>230&&g>230&&b>230);
 assert.ok(reds>20,`debería haber rojo a la izquierda (${reds})`);
 assert.ok(blues>20,`debería haber azul a la derecha (${blues})`);
 assert.ok(whites<reds+blues,`el relleno no debería ser blanco plano (${whites})`);
});

test('solo contorno: el hueco deja ver el fondo y el contorno sigue pintado',async()=>{
 const filled=await render(projectWith({animation:'none',text:'HHHH',fontSize:64,outlineWidth:8,outlineColor:'#00ff00'}));
 const hollow=await render(projectWith({animation:'none',text:'HHHH',fontSize:64,outlineWidth:8,outlineColor:'#00ff00',hollow:true}));
 const white=(ctx:CanvasRenderingContext2D)=>count(ctx,(r,g,b)=>r>220&&g>220&&b>220);
 const green=(ctx:CanvasRenderingContext2D)=>count(ctx,(r,g,b)=>g>150&&r<100&&b<100);
 assert.ok(white(filled)>white(hollow),`el relleno debe desaparecer (${white(filled)} vs ${white(hollow)})`);
 assert.ok(green(hollow)>50,`el contorno debe quedar (${green(hollow)})`);
});

test('caja por línea: con dos líneas separadas, el hueco entre ellas no se pinta',async()=>{
 const block=await render(projectWith({animation:'none',text:'UNO\nDOS',fontSize:30,lineSpacing:1.6,background:{color:'#0000ff',opacity:1,padding:10,fit:'block'}}));
 const line=await render(projectWith({animation:'none',text:'UNO\nDOS',fontSize:30,lineSpacing:1.6,background:{color:'#0000ff',opacity:1,padding:10,fit:'line'}}));
 const blue=(ctx:CanvasRenderingContext2D,x:number,y:number)=>{const d=ctx.getImageData(x,y,1,1).data;return d[2]>180&&d[0]<60&&d[1]<60;};
 assert.equal(blue(block,160,90),true,'la caja del bloque cubre el espacio entre líneas');
 assert.equal(blue(line,160,90),false,'la caja por línea respeta el hueco');
});

test('caja de palabra: la palabra activa crece con un fondo oscuro y acento lima',async()=>{
 const ctx=await render(projectWith({animation:'karaoke',text:'UNO DOS TRES CUATRO',fontSize:30,highlightBox:true,highlightBoxColor:'#0a0a0a',highlightTextColor:'#3dff8a'}),2);
 const lime=count(ctx,(r,g,b)=>g>200&&r<130&&b<190&&b>60);
 const dark=count(ctx,(r,g,b)=>r<25&&g<25&&b<25);
 assert.ok(lime>15,`la palabra activa debería estar en lima (${lime})`);
 assert.ok(dark>200,`la caja oscura debería verse (${dark})`);
});

test('la caja de palabra no aparece sin karaoke',async()=>{
 const ctx=await render(projectWith({animation:'none',text:'UNO DOS',fontSize:30,highlightBox:true,highlightTextColor:'#3dff8a'}),2);
 const lime=count(ctx,(r,g,b)=>g>200&&r<130&&b<190&&b>60);
 assert.equal(lime,0);
});

test('validación: un proyecto con acabados premium se guarda y se reabre con sus campos',()=>{
 const project=projectWith({
  uppercase:true,hollow:true,
  gradient:{enabled:true,from:'#ff7a18',to:'#ff2e9a',angle:90},
  highlightBox:true,highlightBoxColor:'#0a0a0a',highlightTextColor:'#3dff8a',
  background:{color:'#0b1220',opacity:.62,padding:22,radius:28,fit:'line'},
 });
 const clip=newEvent(project.tracks[1].id,'color',0,ticks(2));
 clip.transition='zoom-blur';clip.fadeIn=ticks(1);
 clip.effects=[{id:'fx',kind:'halation',enabled:true,amount:.4,size:14,color:'#ff5a36',softness:.2,horizontal:true,vertical:false}];
 project.events.push(clip);
 const loaded=validateProject(JSON.parse(JSON.stringify(project)));
 const event=loaded.events[0], loadedClip=loaded.events[1];
 assert.equal(event.uppercase,true);
 assert.equal(event.gradient?.to,'#ff2e9a');
 assert.equal(event.background?.fit,'line');
 assert.equal(event.highlightBox,true);
 assert.equal(loadedClip.effects?.[0].kind,'halation');
 assert.equal(loadedClip.transition,'zoom-blur');
});
