/** Mapa de teclas de Sinaloa Pro: reproduce los métodos abreviados **predeterminados de Vegas Pro 15** (manual en
 * español, «Métodos abreviados de teclado», páginas 636-651). Cada entrada lleva el nombre del comando en el manual
 * para que la ayuda de la aplicación y las pruebas puedan contrastarse con él. Los modificadores se comparan
 * exactos: así una combinación del navegador o del sistema no se cuela como una orden de edición. */
export const SHORTCUTS = [
  // Archivo y edición general (manual: «Métodos abreviados de archivo de proyecto» y «Edición general»).
  {id:"save",key:"s",mod:true,shift:false,label:"Guardar el proyecto"},
  {id:"open",key:"o",mod:true,shift:false,label:"Abrir un proyecto"},
  {id:"undo",key:"z",mod:true,shift:false,label:"Deshacer"},
  {id:"redo",key:"z",mod:true,shift:true,label:"Rehacer"},
  {id:"selectAll",key:"a",mod:true,shift:false,label:"Seleccionar todo"},
  {id:"deselect",key:"a",mod:true,shift:true,label:"Anular la selección"},
  {id:"copy",key:"c",mod:true,shift:false,label:"Copiar la selección"},
  {id:"cut",key:"x",mod:true,shift:false,label:"Cortar la selección"},
  {id:"paste",key:"v",mod:true,shift:false,label:"Pegar desde el portapapeles"},
  {id:"trim",key:"t",mod:true,shift:false,label:"Recortar el evento a la selección"},
  {id:"delete",key:"Delete",mod:false,shift:false,label:"Eliminar la selección"},
  // Reproducción y colocación del cursor (manual: «Reproducción, grabación y vista previa» y «Colocación del cursor»).
  {id:"transport",key:" ",mod:false,shift:false,label:"Reproducir / detener"},
  {id:"playPause",key:"Enter",mod:false,shift:false,label:"Reproducir / pausa"},
  {id:"playAll",key:" ",mod:false,shift:true,label:"Reproducir desde el inicio"},
  {id:"loop",key:"q",mod:false,shift:false,label:"Reproducción en bucle"},
  {id:"stop",key:"Escape",mod:false,shift:false,label:"Detener la reproducción"},
  {id:"start",key:"Home",mod:false,shift:false,label:"Ir al inicio de la selección o de lo visible"},
  {id:"end",key:"End",mod:false,shift:false,label:"Ir al final de la selección o de lo visible"},
  {id:"projectStart",key:"Home",mod:true,shift:false,label:"Ir al principio del proyecto"},
  {id:"projectEnd",key:"End",mod:true,shift:false,label:"Ir al final del proyecto"},
  // El manual pone «un píxel» en las flechas (cuando la cuantización está apagada) y «un fotograma» en Alt+flecha.
  // En un navegador Alt+flecha se lo queda el historial, así que las flechas solas hacen el paso fino: un píxel, o un
  // fotograma cuando la cuantización a fotogramas está encendida.
  {id:"pxLeft",key:"ArrowLeft",mod:false,shift:false,label:"Mover a la izquierda un píxel (un fotograma con cuantización)"},
  {id:"pxRight",key:"ArrowRight",mod:false,shift:false,label:"Mover a la derecha un píxel (un fotograma con cuantización)"},
  {id:"frameLeft",key:"ArrowLeft",mod:false,shift:false,alt:true,label:"Fotograma anterior"},
  {id:"frameRight",key:"ArrowRight",mod:false,shift:false,alt:true,label:"Fotograma siguiente"},
  {id:"markerPrev",key:"ArrowLeft",mod:true,shift:false,label:"Marcador anterior"},
  {id:"markerNext",key:"ArrowRight",mod:true,shift:false,label:"Marcador siguiente"},
  // Edición de eventos (manual: «Edición y selección de eventos»).
  {id:"split",key:"s",mod:false,shift:false,label:"Dividir los eventos en el cursor"},
  {id:"marker",key:"m",mod:false,shift:false,label:"Insertar marcador"},
  {id:"region",key:"r",mod:false,shift:false,label:"Insertar región"},
  {id:"group",key:"g",mod:false,shift:false,label:"Agrupar los eventos seleccionados"},
  {id:"ungroup",key:"u",mod:false,shift:false,label:"Desagrupar los eventos seleccionados"},
  // Escala de tiempo (manual: «Escala de tiempo y lista de pistas»).
  {id:"snap",key:"F8",mod:false,shift:false,label:"Habilitar/deshabilitar el ajuste"},
  {id:"crossfades",key:"x",mod:true,shift:true,label:"Fundidos automáticos"},
  {id:"ignoreGrouping",key:"u",mod:true,shift:true,label:"Ignorar la agrupación de eventos"},
  {id:"quantize",key:"F8",mod:false,shift:false,alt:true,label:"Cuantizar a fotogramas"},
  // Zoom (manual: «Aumento y visualización»).
  {id:"zoomIn",key:"ArrowUp",mod:false,shift:false,label:"Acercar el zoom horizontal"},
  {id:"zoomOut",key:"ArrowDown",mod:false,shift:false,label:"Alejar el zoom horizontal"},
  {id:"zoomInBig",key:"ArrowUp",mod:true,shift:false,label:"Acercar el zoom (grande) o a la selección"},
  {id:"zoomOutBig",key:"ArrowDown",mod:true,shift:false,label:"Alejar el zoom (grande)"},
  // Herramientas de edición (manual: «Pasar a la herramienta de edición…»).
  {id:"toolNormal",key:"d",mod:true,shift:false,label:"Herramienta de edición normal"},
  {id:"toolNext",key:"d",mod:false,shift:false,label:"Siguiente herramienta de edición"},
  {id:"toolPrev",key:"d",mod:false,shift:true,label:"Herramienta de edición anterior"},
  // Propiedades y comandos propios de Sinaloa Pro que Vegas no documenta con una tecla: se mantienen aquí y se dicen
  // como tales en la ayuda (no se presentan como atajos de Vegas).
  {id:"properties",key:"Enter",mod:false,shift:false,alt:true,label:"Propiedades del proyecto"},
  {id:"copyAttributes",key:"c",mod:false,shift:true,label:"Copiar atributos (propio de Sinaloa Pro)"},
  {id:"pasteAttributes",key:"v",mod:false,shift:true,label:"Pegar atributos (propio de Sinaloa Pro)"},
  {id:"slipLeft",key:"j",mod:false,shift:true,label:"Deslizar el contenido hacia atrás (propio de Sinaloa Pro)"},
  {id:"slipRight",key:"k",mod:false,shift:true,label:"Deslizar el contenido hacia delante (propio de Sinaloa Pro)"},
  {id:"slideLeft",key:"j",mod:false,shift:false,alt:true,label:"Desplazar el evento hacia atrás (propio de Sinaloa Pro)"},
  {id:"slideRight",key:"k",mod:false,shift:false,alt:true,label:"Desplazar el evento hacia delante (propio de Sinaloa Pro)"},
  {id:"rippleLeft",key:"r",mod:false,shift:true,label:"Recortar el principio hasta el cursor (propio de Sinaloa Pro)"},
  {id:"rippleRight",key:"e",mod:false,shift:true,label:"Recortar el final hasta el cursor (propio de Sinaloa Pro)"},
  {id:"loopStart",key:"i",mod:false,shift:false,label:"Punto de entrada del bucle"},
  {id:"loopClear",key:"u",mod:false,shift:true,label:"Quitar la región de bucle (propio de Sinaloa Pro)"},
  {id:"loopEnd",key:"o",mod:false,shift:false,label:"Punto de salida del bucle"},
  {id:"rangeStart",key:"[",mod:false,shift:false,alt:true,label:"Inicio del tramo de renderizado (propio de Sinaloa Pro)"},
  {id:"rangeEnd",key:"]",mod:false,shift:false,alt:true,label:"Fin del tramo de renderizado (propio de Sinaloa Pro)"},
  {id:"selectEnd",key:"e",mod:false,shift:false,label:"Seleccionar desde aquí hasta el final (propio de Sinaloa Pro)"},
  {id:"trackUp",key:"ArrowUp",mod:false,shift:true,label:"Subir la pista (propio de Sinaloa Pro)"},
  {id:"trackDown",key:"ArrowDown",mod:false,shift:true,label:"Bajar la pista (propio de Sinaloa Pro)"},
] as const;
export type ShortcutAction = typeof SHORTCUTS[number]['id'];
export function isMacPlatform(platform = typeof navigator === 'undefined' ? '' : navigator.platform): boolean {
  return /Mac|iPhone|iPad|iPod/i.test(platform);
}
export type ShortcutEvent = {key:string;ctrlKey:boolean;metaKey:boolean;altKey:boolean;shiftKey:boolean;isComposing?:boolean;getModifierState?:(key:string)=>boolean};
// Alta/Mayús (AltGr) y Mayús+Alt no son atajos del editor; el modificador «de sistema» no puede ser el de edición.
export function resolveShortcut(e:ShortcutEvent, mac=isMacPlatform()):ShortcutAction|null {
  // Alta/Mayús (AltGr) es Ctrl+Alt: solo se descarta esa combinación, no cualquier Alt (Alt+flecha mueve
  // fotogramas en Vegas y en Windows se anuncia como AltGraph aunque no lo sea).
  const altGraph = Boolean(e.getModifierState?.('AltGraph')) && e.ctrlKey && e.altKey;
  if(e.isComposing || altGraph || (mac ? e.ctrlKey : e.metaKey)) return null;
  const mod=mac?e.metaKey:e.ctrlKey;
  const key=e.key;
  // Alias que el manual documenta con dos teclas: Suprimir o Retroceso (borrar) y Ctrl+Mayús+Z o Ctrl+Y (rehacer).
  if(!mod&&!e.altKey&&!e.shiftKey&&(key==='Backspace'))return 'delete';
  if(!mac&&mod&&!e.shiftKey&&!e.altKey&&key.toLowerCase()==='y')return 'redo';
  return (SHORTCUTS.find(s=>s.key.toLowerCase()===key.toLowerCase() && s.mod===mod && s.shift===e.shiftKey && Boolean('alt' in s ? s.alt : false)===e.altKey)?.id ?? null) as ShortcutAction|null;
}
export function shortcutLabel(id:ShortcutAction|string,mac=isMacPlatform()):string {
  const s=SHORTCUTS.find(item=>item.id===id);
  if(!s)return '';
  const nombres:Record<string,string>={' ':'Espacio',ArrowLeft:'←',ArrowRight:'→',ArrowUp:'↑',ArrowDown:'↓',Delete:mac?'⌫':'Supr',End:'Fin',Home:'Inicio',Enter:mac?'Return':'Entrar',Escape:'Esc'};
  const partes=[s.mod?(mac?'⌘ Comando':'Ctrl'):'',s.shift?'Mayús':'','alt' in s && s.alt?'Alt':'',nombres[s.key]??(s.key.length===1?s.key.toUpperCase():s.key)];
  return partes.filter(Boolean).join('+');
}
