/** Shared sprite textures; no game state. */
export function farmArt(P:typeof import('pixi.js-legacy')){
const textureCache=new Map<string,import('pixi.js-legacy').Texture>();
function texture(key:string,painter:(g:CanvasRenderingContext2D,w:number,h:number)=>void,w=180,h=190){if(textureCache.has(key))return textureCache.get(key)!;const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const g=c.getContext('2d')!;g.scale(2,2);painter(g,w,h);const t=P.Texture.from(c);textureCache.set(key,t);return t;}
function ellipse(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient){g.fillStyle=fill;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);g.fill();}
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function polygon(g:CanvasRenderingContext2D,points:number[][],color:string){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill();}
function landscapeTexture(){return texture('landscape',(g,w,h)=>{
 g.fillStyle='#e8ecdf';g.fillRect(0,0,w,h);
 for(let layer=0;layer<3;layer++){
  const points=[[0,h]];for(let x=0;x<=w;x+=20)points.push([x,95+layer*34-Math.sin(x/130+layer)*30-Math.sin(x/67+layer)*13]);points.push([w,h]);
  polygon(g,points,['#b5c9bd48','#bccdb873','#cfdbc38a'][layer]);
 }
 const wash=g.createLinearGradient(0,90,0,h);wash.addColorStop(0,'#e8ecdf00');wash.addColorStop(.7,'#e8ecdfdd');wash.addColorStop(1,'#e8ecdf');g.fillStyle=wash;g.fillRect(0,90,w,h-90);
 for(let i=0;i<4200;i++){g.fillStyle=i%2?'#59684409':'#fffdf240';g.fillRect(noise(i)*w,noise(i+4000)*h,1+noise(i+30),1);}
 },1000,560);}
function mistTexture(){return texture('mist',(g,w,h)=>{g.translate(w/2,h/2);g.scale(1,.55);const fog=g.createRadialGradient(0,0,3,0,0,w*.48);fog.addColorStop(0,'#faf9ecba');fog.addColorStop(.45,'#eff3e5a0');fog.addColorStop(1,'#edf1e000');ellipse(g,0,0,w*.49,w*.49,fog);},160,100);}
function groundTexture(field:boolean){return texture(field?'soil':'grass',(g)=>{
 const points=[[90,110],[159,145],[90,180],[21,145]];polygon(g,points,field?'#b6aa80':'#b6c59c');
 g.save();g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
 for(let i=0;i<200;i++){g.fillStyle=i%2?'#eef0bd36':'#65744718';ellipse(g,20+noise(i)*140,115+noise(i+2)*65,.6+noise(i+8)*2,.5,g.fillStyle as string);}
 if(field)for(let r=0;r<6;r++){const d=(r-2.5)*12;stroke(g,[[46+d*.5,137+d*.43],[104+d*.5,162+d*.43]],'#897e575c',2);stroke(g,[[46+d*.5,135+d*.43],[104+d*.5,160+d*.43]],'#ddd0a36b',1);}
 g.restore();stroke(g,[...points,points[0]],'#7a907c65',1);
 });}
function houseTexture(){return texture('home',g=>{
 ellipse(g,91,157,36,10,'#59645020');
 polygon(g,[[61,115],[99,104],[124,120],[124,152],[94,165],[61,148]],'#d4c9aa');
 polygon(g,[[61,115],[94,130],[94,165],[61,148]],'#f2e9cd');
 polygon(g,[[52,114],[84,79],[133,117],[96,136]],'#637c75');
 for(let i=0;i<6;i++)stroke(g,[[59+i*5,113-i*5],[97+i*5,131-i*4]],'#a8b6a075',1);
 polygon(g,[[74,133],[84,138],[84,160],[74,155]],'#83795e');polygon(g,[[107,129],[116,125],[116,136],[107,140]],'#74887c');
 stroke(g,[[61,149],[94,166],[124,153]],'#979778',2);
 });}
function stroke(g:CanvasRenderingContext2D,pts:number[][],color:string,width=1){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.stroke();}
function treeTexture(){return texture('tree',(g)=>{ellipse(g,86,159,32,11,'#46643b24');stroke(g,[[86,153],[88,68]],'#7a7652',7);stroke(g,[[87,122],[67,87]],'#7a7652',4);const blobs:[number,number,number,number,string][]=[[64,96,29,28,'#58776bb5'],[106,100,27,29,'#6c8c77b8'],[82,73,34,35,'#779984c4'],[71,68,22,24,'#9db395bd'],[102,80,20,25,'#819e89bf']];for(const b of blobs)ellipse(g,...b);for(let i=0;i<26;i++){let x=57+(i*17%58),y=55+(i*13%56);ellipse(g,x,y,2+(i%3),1.5,'#b9c78c50');}});}
function cropTexture(crop:string,growth:number){return texture(crop+growth,(g)=>{for(let row=0;row<4;row++)for(let col=0;col<4;col++){let x=88+(col-row)*11,y=125+(col+row)*5,h=growth===2?28:growth===1?18:7;stroke(g,[[x,y],[x+1,y-h]],growth===2&&crop==='wheat'?'#a98c3e':'#668844',1.8);if(crop==='flax'){ellipse(g,x,y-h,3,3,growth===2?'#879bc9':'#8ea971');}else if(crop==='soy'){ellipse(g,x-4,y-h+5,5,2.8,'#779653');ellipse(g,x+5,y-h+1,5,2.8,'#95ad60');if(growth===2){ellipse(g,x+2,y-9,2.4,5,'#c6b461');}}else if(growth===2){for(let k=0;k<4;k++){ellipse(g,x-2,y-h+k*4,3,2,'#c4a35c');ellipse(g,x+3,y-h+2+k*4,3,2,'#dfc781');}}else{stroke(g,[[x,y-3],[x-5,y-h+1]],'#88a157',1.7);stroke(g,[[x,y-3],[x+6,y-h+3]],'#9fb66b',1.7);}}});}
function sprite(tex:import('pixi.js-legacy').Texture,x:number,y:number,scale=1){const sp=new P.Sprite(tex);sp.anchor.set(.5,160/190);sp.position.set(x,y);sp.scale.set(scale/2);return sp;}

return {landscapeTexture,mistTexture,groundTexture,houseTexture,treeTexture,cropTexture,sprite,destroy:()=>{for(const t of textureCache.values())t.destroy(true);textureCache.clear();}};
}
