/** Own DSP approximation of the user's Audition settings, not Adobe's proprietary filter. */
export const VOICE_PRESET_ID='andres-audition-v1' as const;
export const VOICE_PRESET_NAME='Voz Andrés — Audition';
export const VOICE_DRAG='application/sinaloa-audio-preset';
export const GRAPHIC_BANDS=[31,44,63,88,125,180,250,355,500,710,1000,1400,2000,2800,4000,5600,8000,11300,16000,22000];
export const GRAPHIC_GAINS=[0,5.7,9.2,8.9,9.1,5,0,0,0,0,0,1.1,1.8,3.3,6.5,8.9,10.8,8.1,7.2,-1.4];
export const NORMALIZE_DB=-3.04;
function fft(re:Float64Array,im:Float64Array,inverse=false){const n=re.length;for(let i=1,j=0;i<n;i++){let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const a=(inverse?2:-2)*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a);for(let i=0;i<n;i+=len){let ur=1,ui=0;for(let j=0;j<len/2;j++){const k=i+j,l=k+len/2,tr=re[l]*ur-im[l]*ui,ti=re[l]*ui+im[l]*ur;re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;const next=ur*wr-ui*wi;ui=ur*wi+ui*wr;ur=next;}}}if(inverse)for(let i=0;i<n;i++){re[i]/=n;im[i]/=n;}}
function response(f:number){if(f<=31)return 1;let i=1;while(i<20&&GRAPHIC_BANDS[i]<f)i++;if(i===20)return 10**(GRAPHIC_GAINS[19]/20);const t=Math.log(f/GRAPHIC_BANDS[i-1])/Math.log(GRAPHIC_BANDS[i]/GRAPHIC_BANDS[i-1]);return 10**((GRAPHIC_GAINS[i-1]+t*(GRAPHIC_GAINS[i]-GRAPHIC_GAINS[i-1]))/20);}
function graphic(channels:Float32Array[],rate:number,progress:(p:number)=>void){const n=4096,taps=1001,delay=500,step=n-taps+1;const kr=new Float64Array(n),ki=new Float64Array(n);
 for(let i=0;i<n;i++)kr[i]=response(Math.min(i,n-i)*rate/n);fft(kr,ki,true);const kernel=new Float64Array(n);for(let j=0;j<taps;j++)kernel[j]=kr[(j-delay+n)%n]*(.42-.5*Math.cos(2*Math.PI*j/(taps-1))+.08*Math.cos(4*Math.PI*j/(taps-1)));ki.fill(0);fft(kernel,ki);
 return channels.map((input,ch)=>{const out=new Float32Array(input.length),re=new Float64Array(n),im=new Float64Array(n);for(let pos=0;pos<input.length;pos+=step){re.fill(0);im.fill(0);re.set(input.subarray(pos,pos+step));fft(re,im);for(let i=0;i<n;i++){const r=re[i]*kernel[i]-im[i]*ki[i];im[i]=re[i]*ki[i]+im[i]*kernel[i];re[i]=r;}fft(re,im,true);for(let i=0;i<n;i++){const at=pos+i-delay;if(at>=0&&at<out.length)out[at]+=re[i];}if(pos%(step*16)===0)progress(.65*(ch+pos/input.length)/channels.length);}return out;});}
function biquad(data:Float32Array,b:number[],a:number[]){let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<data.length;i++){const x=data[i],y=(b[0]*x+b[1]*x1+b[2]*x2-a[1]*y1-a[2]*y2)/a[0];data[i]=y;x2=x1;x1=x;y2=y1;y1=y;}}
function eq(data:Float32Array,rate:number,f:number,db:number,kind:'low'|'high'|'peak',q=2){f=Math.min(f,rate*.49);const A=10**(db/40),w=2*Math.PI*f/rate,c=Math.cos(w),s=Math.sin(w);if(kind==='peak'){const a=s/(2*q);biquad(data,[1+a*A,-2*c,1-a*A],[1+a/A,-2*c,1-a/A]);return;}const k=2*Math.sqrt(A)*s/2*Math.SQRT2;
 if(kind==='low')biquad(data,[A*((A+1)-(A-1)*c+k),2*A*((A-1)-(A+1)*c),A*((A+1)-(A-1)*c-k)],[(A+1)+(A-1)*c+k,-2*((A-1)+(A+1)*c),(A+1)+(A-1)*c-k]);
 else biquad(data,[A*((A+1)+(A-1)*c+k),-2*A*((A-1)+(A+1)*c),A*((A+1)+(A-1)*c-k)],[(A+1)-(A-1)*c+k,2*((A-1)-(A+1)*c),(A+1)-(A-1)*c-k]);}
export function processVoice(input:Float32Array[],rate:number,progress:(p:number)=>void=()=>{}){
 if(!input.length||input.length>2||!input[0].length||!Number.isFinite(rate)||rate<8000||input.some(c=>c.length!==input[0].length))throw new Error('Audio no válido para el preset (mono o estéreo).');
 const channels=graphic(input,rate,progress);progress(.65);
 for(const c of channels){eq(c,rate,40,1.1,'low');eq(c,rate,800,-3,'peak',2);eq(c,rate,18000,1.6,'high');}progress(.75);
 const release=Math.exp(-1/(.1*rate));let envelope=0,peak=0;
 for(let i=0;i<channels[0].length;i++){let level=0;for(const c of channels)level=Math.max(level,Math.abs(c[i]));envelope=level>=envelope?level:release*envelope+(1-release)*level;const db=20*Math.log10(Math.max(1e-12,envelope));const gain=db>-20?10**(((-20+(db+20)/12)-db)/20):1;for(const c of channels){c[i]*=gain;if(!Number.isFinite(c[i]))throw new Error('El procesado produjo una muestra no válida.');peak=Math.max(peak,Math.abs(c[i]));}if(i%131072===0)progress(.75+.15*i/channels[0].length);}
 const gain=peak>1e-12?10**(NORMALIZE_DB/20)/peak:1;for(const c of channels)for(let i=0;i<c.length;i++)c[i]*=gain;progress(.95);return {channels,gain,peak};
}
export function voiceWav(channels:Float32Array[],rate:number){const size=channels[0].length*channels.length*4,buffer=new ArrayBuffer(44+size),v=new DataView(buffer);const text=(at:number,s:string)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};text(0,'RIFF');v.setUint32(4,36+size,true);text(8,'WAVE');text(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,3,true);v.setUint16(22,channels.length,true);v.setUint32(24,rate,true);v.setUint32(28,rate*channels.length*4,true);v.setUint16(32,channels.length*4,true);v.setUint16(34,32,true);text(36,'data');v.setUint32(40,size,true);let at=44;for(let i=0;i<channels[0].length;i++)for(const c of channels){v.setFloat32(at,c[i],true);at+=4;}return buffer;}
