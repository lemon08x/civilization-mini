import {farmArt} from './farm-animation/scene.js';
const P=(window as unknown as {PIXI:typeof import('pixi.js-legacy')}).PIXI;
const host=document.getElementById('scene')!;
const app=new P.Application({width:1160,height:650,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true});
host.appendChild(app.view as HTMLCanvasElement);
const art=farmArt(P),world=new P.Container();app.stage.addChild(world);
const names=['小麦','大豆','白萝卜','冬瓜'],ids=['wheat','soy','radish','waxgourd'],phases=['幼苗','成株','适收'];
let windy=true,dense=true,old=false,phase='all',time=0;
let plants: {sprite:import('pixi.js-legacy').Sprite;base:number;phase:number;strength:number}[]=[];
const textures:import('pixi.js-legacy').Texture[][]=[];
let ring:import('pixi.js-legacy').Graphics|null=null;
function text(value:string,x:number,y:number,size=16,color=0x55694e){const t=new P.Text(value,{fontFamily:'Microsoft YaHei, sans-serif',fontSize:size,fill:color});t.anchor.set(.5);t.position.set(x,y);world.addChild(t);return t;}
function render(){
 world.removeChildren().forEach(c=>c.destroy({children:true}));plants=[];ring=null;
 const shown=phase==='all'?[0,1,2]:[Number(phase)];app.renderer.resize(1160,shown.length===3?650:360);
 for(let col=0;col<4;col++)text(names[col],165+col*265,35,19);
 for(let row=0;row<shown.length;row++){
 const growth=shown[row],y=shown.length===3?156+row*188:225;
 text(phases[growth],35,y-5,13,0x8d937b);
 for(let col=0;col<4;col++){
 const x=165+col*265,tile=new P.Container();tile.position.set(x,y);world.addChild(tile);
 const floor=new P.Graphics();floor.beginFill(0x65774f,.12).drawPolygon([-98,10,0,61,98,10,0,-40]).endFill();floor.beginFill(0xb5a27a).lineStyle(1,0x8e9c70,.6).drawPolygon([-98,0,0,49,98,0,0,-49]).endFill();
 for(let r=1;r<=4;r++){const t=r/5;floor.lineStyle(1,0x84764e,.18).moveTo(-98*(1-t),-49*t).lineTo(98*t,49*(1-t));}tile.addChild(floor);
 const hit=new P.Graphics();hit.beginFill(0xffffff,.001).drawPolygon([-104,0,0,55,104,0,0,-55]).endFill();hit.eventMode='static';hit.cursor='pointer';hit.on('pointertap',()=>{ring?.destroy();ring=new P.Graphics();ring.lineStyle(3,0x45654b,.85).drawPolygon([x-99,y,x,y+50,x+99,y,x,y-50]);world.addChild(ring);document.getElementById('status')!.textContent=`${names[col]} · ${phases[growth]}｜${['穗与叶簇轻摆，根部固定。','分枝植株略有错位，豆荚保持在枝上。','根部藏在土下；收获状态以叶丛和根肩表达。','藤蔓以贴地形态展开，果实仅轻微随整体变化。'][col]}`;});tile.addChild(hit);
 if(old){if(col<2){const s=art.sprite(art.cropTexture(ids[col],growth),0,-8,1.25);tile.addChild(s);}else text('当前尚无田间模型',x,y-18,12,0x81836d);continue;}
 const spots=dense?(col===3?[[-20,-3],[30,16]]:[[-24,-14],[24,8],[-21,22]]):[[0,8]];
 for(let n=0;n<spots.length;n++){
 const [px,py]=spots[n];const sp=new P.Sprite(textures[col][growth]);sp.anchor.set(.5,1);sp.position.set(px,py);
 const maxH=col===3?[29,64,76][growth]:col===2?[28,65,78][growth]:[33,92,112][growth];
 const scale=Math.min(maxH/sp.texture.height,(dense?100:155)/sp.texture.width)*(1+(n-1)*.04);sp.scale.set(scale);tile.addChild(sp);plants.push({sprite:sp,base:scale,phase:col*3+n+row,strength:col===3?.004:col===2?.009:.02});
 }
 }
 }
 document.getElementById('status')!.textContent=old?'左侧为当前程序绘制作物。萝卜和冬瓜目前尚未实现，因此不使用错误的通用麦苗替代。':'12 张独立植物精灵 · 同类错位排列 · 点击地块查看说明';
}
app.ticker.add(delta=>{time+=delta;for(const p of plants){const wave=windy?Math.sin(time*.025+p.phase)*p.strength:0;p.sprite.skew.x=wave;p.sprite.scale.y=p.base*(1+Math.abs(wave)*.14);}});
async function init(){
 for(let c=0;c<4;c++){textures[c]=[];for(let s=0;s<3;s++)textures[c][s]=await P.Assets.load(`/illustrations/farm/animation/watercolor/crops/farm-plant-${ids[c]}-${s}-v1.png`);}
 document.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('nav button,nav select').forEach(el=>el.disabled=false);
 render();
 (document.getElementById('phase') as HTMLSelectElement).onchange=e=>{phase=(e.target as HTMLSelectElement).value;render();};
 document.getElementById('wind')!.onclick=()=>{windy=!windy;document.getElementById('wind')!.setAttribute('aria-pressed',String(windy));document.getElementById('wind')!.textContent='微风 · '+(windy?'开':'关');};
 document.getElementById('density')!.onclick=()=>{dense=!dense;document.getElementById('density')!.setAttribute('aria-pressed',String(dense));document.getElementById('density')!.textContent=dense?'成片种植':'单株观察';render();};
 document.getElementById('old')!.onclick=()=>{old=!old;document.getElementById('old')!.setAttribute('aria-pressed',String(old));render();};
}
void init().catch(e=>{document.getElementById('error')!.textContent='素材加载失败：'+String(e);});
window.addEventListener('pagehide',()=>{app.destroy(true,{children:true});art.destroy();});
