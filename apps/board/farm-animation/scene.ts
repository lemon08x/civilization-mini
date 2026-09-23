/** Shared sprite textures; no game state. */
export function farmArt(P:typeof import('pixi.js-legacy')){
const textureCache=new Map<string,import('pixi.js-legacy').Texture>();
const cropSheets=new Map<string,{image:HTMLImageElement;frames:{x:number;y:number;w:number;h:number}[]}>();
const cropLoads=new Map<string,Promise<boolean>>();
const environmentImages=new Map<string,HTMLImageElement>();
const tileImages=new Map<string,HTMLImageElement>();
let environmentLoad:Promise<boolean>|null=null;
let environmentReady=false;
let tileLoad:Promise<boolean>|null=null;
let tileReady=false;
const modeledCrops=new Set(['wheat','soy','flax','rice','millet','adzuki','mallow','mustard']);
let destroyed=false;
let landImage:HTMLImageElement|null=null,landLoad:Promise<boolean>|null=null;
const landFrames:{x:number;y:number;w:number;h:number}[]=[];
function loadLand():Promise<boolean>{
 if(landImage)return Promise.resolve(false);
 if(landLoad)return landLoad;
 landLoad=new Promise<boolean>(resolve=>{
  const image=new Image();
  image.onerror=()=>resolve(false);
  image.onload=()=>{
   if(destroyed){resolve(false);return;}
   const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
   const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
   const pixels=ctx.getImageData(0,0,c.width,c.height).data;
   // Trim transparent padding within each atlas cell, retaining the soil edge.
   for(let i=0;i<8;i++){
    const x0=Math.floor(i%4*c.width/4),x1=Math.floor((i%4+1)*c.width/4),y0=Math.floor(Math.floor(i/4)*c.height/2),y1=Math.floor((Math.floor(i/4)+1)*c.height/2);
    let left=x1,top=y1,right=x0,bottom=y0;
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(pixels[(y*c.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    landFrames.push(right>=left&&bottom>=top?{x:left,y:top,w:right-left+1,h:bottom-top+1}:{x:x0,y:y0,w:x1-x0,h:y1-y0});
   }
   landImage=image;resolve(true);
  };
  image.src='/illustrations/farm/animation/painted/terrain/farm-land-qinglu-v1.png';
 });
 return landLoad;
}
// Read-only artwork cache. Missing assets retain the procedural fallback.
async function loadCrops(crops:readonly string[]):Promise<boolean>{
 const results=await Promise.all([...new Set(crops)].map(crop=>{
  if(!modeledCrops.has(crop)||cropSheets.has(crop))return Promise.resolve(false);
  let pending=cropLoads.get(crop);
  if(!pending){
   pending=new Promise<boolean>(resolve=>{
    const image=new Image();image.onerror=()=>resolve(false);
    image.onload=()=>{
     if(destroyed){resolve(false);return;}
     const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
     const ctx=c.getContext('2d')!;ctx.drawImage(image,0,0);
     const pixels=ctx.getImageData(0,0,c.width,c.height).data;
     const columnInk=new Uint16Array(c.width);
     for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(pixels[(y*c.width+x)*4+3]>32)columnInk[x]++;
     const split=(stage:number)=>{
      const target=Math.floor(stage*c.width/3),radius=Math.floor(c.width/8);
      let best=target,score=Infinity;
      for(let x=target-radius;x<target+radius;x++){
       const next=columnInk[x]*c.height+Math.abs(x-target);
       if(next<score){best=x;score=next;}
      }
      return best;
     };
     const cuts=[0,split(1),split(2),c.width];
     const frames=Array.from({length:3},(_,stage)=>{
      const x0=cuts[stage],x1=cuts[stage+1];
      let left=x1,top=c.height,right=x0,bottom=0;
      for(let y=0;y<c.height;y++)for(let x=x0;x<x1;x++)if(pixels[(y*c.width+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
      return right>=left&&bottom>=top?{x:left,y:top,w:right-left+1,h:bottom-top+1}:{x:x0,y:0,w:x1-x0,h:c.height};
     });
     cropSheets.set(crop,{image,frames});resolve(true);
    };
    image.src=`/illustrations/farm/animation/painted/crops/farm-plant-${crop}-stages-qinglu-v1.png`;
   });
   cropLoads.set(crop,pending);
  }
  return pending;
 }));
 return results.some(Boolean);
}
function loadEnvironment():Promise<boolean>{
 if(environmentReady)return Promise.resolve(false);
 if(environmentLoad)return environmentLoad;
 environmentLoad=Promise.all(['landscape','tree','rock','house','brush'].map(name=>new Promise<boolean>(resolve=>{
  const image=new Image();
  image.onload=()=>{if(destroyed){resolve(false);return;}environmentImages.set(name,image);resolve(true);};
  image.onerror=()=>resolve(false);
  image.src=`/illustrations/farm/animation/painted/environment/farm-${name}-qinglu-v1.png`;
 }))).then(results=>{environmentReady=true;return results.some(Boolean);});
 return environmentLoad;
}
const tileNames=['unknown','paddy','water','canal-connected','canal-dry','drain','yard','cellar','pit','pit-active','shed','retting','shelter'] as const;
function loadTiles():Promise<boolean>{
 if(tileReady)return Promise.resolve(false);
 if(tileLoad)return tileLoad;
 tileLoad=Promise.all(tileNames.map(name=>new Promise<boolean>(resolve=>{
  const image=new Image();image.onload=()=>{if(destroyed){resolve(false);return;}tileImages.set(name,image);resolve(true);};image.onerror=()=>resolve(false);
  image.src=`/illustrations/farm/animation/painted/terrain/farm-tile-${name}-qinglu-v1.png`;
 }))).then(results=>{tileReady=true;return results.some(Boolean);});
 return tileLoad;
}

function texture(key:string,painter:(g:CanvasRenderingContext2D,w:number,h:number)=>void,w=180,h=190){if(textureCache.has(key))return textureCache.get(key)!;const c=document.createElement('canvas');c.width=w*2;c.height=h*2;const g=c.getContext('2d')!;g.scale(2,2);painter(g,w,h);const t=P.Texture.from(c);textureCache.set(key,t);return t;}
function ellipse(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string|CanvasGradient){g.fillStyle=fill;g.beginPath();g.ellipse(x,y,Math.max(.01,rx),Math.max(.01,ry),0,0,Math.PI*2);g.fill();}
const noise=(n:number)=>{const v=Math.sin(n*127.1+311.7)*43758.5453;return v-Math.floor(v);};
function polygon(g:CanvasRenderingContext2D,points:number[][],color:string){g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill();}
function landscapeTexture(){const image=environmentImages.get('landscape');if(image)return texture('painted:landscape',(g,w,h)=>g.drawImage(image,0,0,w,h),1000,560);return texture('landscape',(g,w,h)=>{
 g.fillStyle='#e8ecdf';g.fillRect(0,0,w,h);
 for(let layer=0;layer<3;layer++){
  const points=[[0,h]];for(let x=0;x<=w;x+=20)points.push([x,95+layer*34-Math.sin(x/130+layer)*30-Math.sin(x/67+layer)*13]);points.push([w,h]);
  polygon(g,points,['#b5c9bd48','#bccdb873','#cfdbc38a'][layer]);
 }
 const wash=g.createLinearGradient(0,90,0,h);wash.addColorStop(0,'#e8ecdf00');wash.addColorStop(.7,'#e8ecdfdd');wash.addColorStop(1,'#e8ecdf');g.fillStyle=wash;g.fillRect(0,90,w,h-90);
 for(let i=0;i<4200;i++){g.fillStyle=i%2?'#59684409':'#fffdf240';g.fillRect(noise(i)*w,noise(i+4000)*h,1+noise(i+30),1);}
 },1000,560);}
function mistTexture(){return texture('mist',(g,w,h)=>{g.translate(w/2,h/2);g.scale(1,.55);const fog=g.createRadialGradient(0,0,3,0,0,w*.48);fog.addColorStop(0,'#faf9ecba');fog.addColorStop(.45,'#eff3e5a0');fog.addColorStop(1,'#edf1e000');ellipse(g,0,0,w*.49,w*.49,fog);},160,100);}
function groundTexture(field:boolean,land?:{soil:string;water:number}|null){
 const soil=land?.soil==='沙质'?1:land?.soil==='黏质'?3:2;
 const frame=land?.water===0?4:land?.water===3?6:land?.water===4?7:field?(soil===2&&land?.water===2?5:soil):0;
 if(landImage){const f=landFrames[frame];return texture('land-qinglu:'+frame,g=>{g.drawImage(landImage!,f.x,f.y,f.w,f.h,21,110,138,77);});}
 return texture(field?'soil':'grass',(g)=>{
 const points=[[90,110],[159,145],[90,180],[21,145]];polygon(g,points,field?'#b6aa80':'#b6c59c');
 g.save();g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip();
 for(let i=0;i<200;i++){g.fillStyle=i%2?'#eef0bd36':'#65744718';ellipse(g,20+noise(i)*140,115+noise(i+2)*65,.6+noise(i+8)*2,.5,g.fillStyle as string);}
 if(field)for(let r=0;r<6;r++){const d=(r-2.5)*12;stroke(g,[[46+d*.5,137+d*.43],[104+d*.5,162+d*.43]],'#897e575c',2);stroke(g,[[46+d*.5,135+d*.43],[104+d*.5,160+d*.43]],'#ddd0a36b',1);}
 g.restore();stroke(g,[...points,points[0]],'#7a907c65',1);
 });}
function tileTexture(name:string){const image=tileImages.get(name);if(!image)return null;return texture('qinglu:tile:'+name,g=>g.drawImage(image,21,110,138,77));}
function unknownTexture(){return tileTexture('unknown')??texture('unknown',g=>{polygon(g,[[90,110],[159,145],[90,180],[21,145]],'#bfcbb7');polygon(g,[[90,110],[159,145],[90,165],[21,145]],'#e7eddf');});}
function paintedProp(name:string,width:number,height:number){const image=environmentImages.get(name);if(!image)return null;return texture('painted:'+name,g=>{const scale=Math.min(width/image.naturalWidth,height/image.naturalHeight),w=image.naturalWidth*scale,h=image.naturalHeight*scale;g.drawImage(image,(180-w)/2,166-h,w,h);});}
function houseTexture(){return paintedProp('house',152,128)??texture('home',g=>{
 ellipse(g,91,157,36,10,'#59645020');
 polygon(g,[[61,115],[99,104],[124,120],[124,152],[94,165],[61,148]],'#d4c9aa');
 polygon(g,[[61,115],[94,130],[94,165],[61,148]],'#f2e9cd');
 polygon(g,[[52,114],[84,79],[133,117],[96,136]],'#637c75');
 for(let i=0;i<6;i++)stroke(g,[[59+i*5,113-i*5],[97+i*5,131-i*4]],'#a8b6a075',1);
 polygon(g,[[74,133],[84,138],[84,160],[74,155]],'#83795e');polygon(g,[[107,129],[116,125],[116,136],[107,140]],'#74887c');
 stroke(g,[[61,149],[94,166],[124,153]],'#979778',2);
 });}
function stroke(g:CanvasRenderingContext2D,pts:number[][],color:string,width=1){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=color;g.lineWidth=width;g.lineCap='round';g.stroke();}
function treeTexture(){return paintedProp('tree',106,112)??texture('tree',(g)=>{ellipse(g,86,159,32,11,'#46643b24');stroke(g,[[86,153],[88,68]],'#7a7652',7);stroke(g,[[87,122],[67,87]],'#7a7652',4);const blobs:[number,number,number,number,string][]=[[64,96,29,28,'#58776bb5'],[106,100,27,29,'#6c8c77b8'],[82,73,34,35,'#779984c4'],[71,68,22,24,'#9db395bd'],[102,80,20,25,'#819e89bf']];for(const b of blobs)ellipse(g,...b);for(let i=0;i<26;i++){let x=57+(i*17%58),y=55+(i*13%56);ellipse(g,x,y,2+(i%3),1.5,'#b9c78c50');}});}
function rockTexture(){return paintedProp('rock',105,58)??texture('rock',g=>{polygon(g,[[40,158],[51,136],[86,124],[112,137],[128,158]],'#8a9184');polygon(g,[[51,136],[86,124],[95,146],[66,150]],'#b1b29b');});}
function brushTexture(){return paintedProp('brush',106,65)??texture('brush',g=>{for(let k=0;k<7;k++){const x=48+k*14;stroke(g,[[x,164],[x-8,118+k%3*5]],'#71854c',3);stroke(g,[[x,164],[x+10,126+k%2*8]],'#8da05c',3);}});}
// 新作物复用相近形态的程序绘制，不重绘素材：小豆按豆科结荚（同大豆），水稻/粟按禾谷收穗，
// 葵菜/芥菜为叶菜，成熟仍保持叶丛。
const podCrops=new Set(['soy','adzuki']),grainCrops=new Set(['wheat','rice','millet']),leafCrops=new Set(['mallow','mustard']);
function cropTexture(crop:string,growth:number){
 const stage=Math.max(0,Math.min(2,Math.floor(growth))),sheet=cropSheets.get(crop);
 if(sheet)return texture('qinglu:crop:'+crop+stage,g=>{
  const leaf=crop==='mallow'||crop==='mustard';
  const spots=leaf?[[76,143],[105,156]]:[[80,137],[104,147],[79,157]];
  const height=(leaf?[18,40,48]:[22,57,66])[stage],frame=sheet.frames[stage];
  for(let i=0;i<spots.length;i++){
   const [x,y]=spots[i],scale=Math.min(height/frame.h,(leaf?49:46)/frame.w)*(1+(i-1)*.035);
   const w=frame.w*scale,h=frame.h*scale;
   g.drawImage(sheet.image,frame.x,frame.y,frame.w,frame.h,x-w/2,y-h,w,h);
  }
 });
 return texture(crop+growth,(g)=>{for(let row=0;row<4;row++)for(let col=0;col<4;col++){let x=88+(col-row)*11,y=125+(col+row)*5,h=growth===2?28:growth===1?18:7;stroke(g,[[x,y],[x+1,y-h]],growth===2&&grainCrops.has(crop)?'#a98c3e':'#668844',1.8);if(crop==='flax'){ellipse(g,x,y-h,3,3,growth===2?'#879bc9':'#8ea971');}else if(podCrops.has(crop)){ellipse(g,x-4,y-h+5,5,2.8,'#779653');ellipse(g,x+5,y-h+1,5,2.8,'#95ad60');if(growth===2){ellipse(g,x+2,y-9,2.4,5,crop==='adzuki'?'#b3604a':'#c6b461');}}else if(growth===2&&!leafCrops.has(crop)){for(let k=0;k<4;k++){ellipse(g,x-2,y-h+k*4,3,2,'#c4a35c');ellipse(g,x+3,y-h+2+k*4,3,2,'#dfc781');}}else{stroke(g,[[x,y-3],[x-5,y-h+1]],'#88a157',1.7);stroke(g,[[x,y-3],[x+6,y-h+3]],'#9fb66b',1.7);}}});}
function sprite(tex:import('pixi.js-legacy').Texture,x:number,y:number,scale=1){const sp=new P.Sprite(tex);sp.anchor.set(.5,160/190);sp.position.set(x,y);sp.scale.set(scale/2);return sp;}

return {landscapeTexture,mistTexture,groundTexture,tileTexture,unknownTexture,houseTexture,treeTexture,rockTexture,brushTexture,cropTexture,loadCrops,loadLand,loadEnvironment,loadTiles,sprite,destroy:()=>{destroyed=true;landImage=null;landFrames.length=0;cropSheets.clear();cropLoads.clear();environmentImages.clear();tileImages.clear();for(const t of textureCache.values())t.destroy(true);textureCache.clear();}};
}
