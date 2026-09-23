import {IMPROVEMENT_NAMES} from '../../../src/game/systems/agriculture.js';
import {farmArt} from './scene.js';
import {farmEventArt,type FarmArt} from '../illustration.js';
import {type FarmGame,selectedFarmPlot,selectFarmPlot,selectFarmPanel,selectFarmStock,selectFarmProject,selectFarmProjectDuration,selectPlannedBatch,type FarmPanel} from '../farm-view.js';

type Pixi=typeof import('pixi.js-legacy');
type Sprite=import('pixi.js-legacy').Sprite;
type Graphics=import('pixi.js-legacy').Graphics;
type Container=import('pixi.js-legacy').Container;
type Application=import('pixi.js-legacy').Application;

type FarmMap=NonNullable<NonNullable<FarmGame['economy']>['farm']>;
type Tween={t:number;dur:number;ease:(k:number)=>number;update:(k:number)=>void;done?:()=>void};
type Particle={g:Graphics;vx:number;vy:number;life:number;max:number};

// Scene singletons: the Pixi app, textures and canvas survive re-renders so the
// map never flashes; only the world contents are rebuilt from the latest state.
let P:Pixi|null=null;
let app:Application|null=null;
let art:ReturnType<typeof farmArt>|null=null;
let canvas:HTMLCanvasElement|null=null;
let world:Container|null=null,floor:Container|null=null,mistLayer:Container|null=null,items:Container|null=null;
let background:Sprite|null=null,distantHouse:Sprite|null=null;
let observer:ResizeObserver|null=null;
let zoom=1.45,pan={x:0,y:0},viewW=1,viewH=360;
let lastSelection='';
let drag:null|{x:number;y:number;px:number;py:number;moved:boolean}=null;
let currentMap:FarmMap|null=null;
let quickEl:HTMLElement|null=null;
let elapsed=0;
const plotViews=new Map<string,{x:number;y:number;crop?:Sprite;cropScale?:number}>();
let mistDrift:{sp:Sprite;baseX:number;seed:number}[]=[];
let cropSway:Sprite[]=[];
let treeSway:Sprite[]=[];
let selectedRing:Graphics|null=null;
let tweens:Tween[]=[];
let particles:Particle[]=[];

const easeOut=(k:number)=>1-Math.pow(1-k,3);
const easeOutBack=(k:number)=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(k-1,3)+c*Math.pow(k-1,2);};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function tick(dt:number):void {
 elapsed+=dt;
 for(const m of mistDrift){m.sp.x=m.baseX+Math.sin(elapsed*.012+m.seed)*5;m.sp.alpha=.38+Math.sin(elapsed*.017+m.seed*1.7)*.08;}
 for(const c of cropSway)c.skew.x=Math.sin(elapsed*.025+c.position.x)*.012;
 for(const t of treeSway)t.skew.x=Math.sin(elapsed*.012+t.position.x)*.004;
 if(background)background.x=-12+Math.sin(elapsed*.002)*4+Math.max(-6,Math.min(6,pan.x*.012));
 if(distantHouse)distantHouse.x=viewW*.77+Math.max(-10,Math.min(10,pan.x*.025));
 if(selectedRing)selectedRing.alpha=.72+Math.sin(elapsed*.07)*.28;
 for(let i=tweens.length-1;i>=0;i--){const tw=tweens[i];tw.t+=dt/60;const k=Math.min(1,tw.t/tw.dur);tw.update(tw.ease(k));if(k>=1){tweens.splice(i,1);tw.done?.();}}
 for(let i=particles.length-1;i>=0;i--){const pt=particles[i];pt.life-=dt/60;pt.g.x+=pt.vx*dt;pt.g.y+=pt.vy*dt;pt.vy+=.06*dt;pt.g.alpha=Math.max(0,pt.life/pt.max);if(pt.life<=0){pt.g.destroy();particles.splice(i,1);}}
}

function placeQuick():void {
 if(!quickEl||!world)return;
 const view=plotViews.get(selectedFarmPlot());
 if(!view){quickEl.hidden=true;return;}
 quickEl.style.left=view.x*zoom+world.position.x+'px';
 quickEl.style.top=view.y*zoom+world.position.y+'px';
 quickEl.hidden=false;
}

function fit():void {
 if(!app||!world)return;
 world.scale.set(zoom);
 world.position.set(viewW/2+pan.x,85+pan.y);
 placeQuick();
 if(!app.ticker.started)app.render();
}

function buildWorld(map:FarmMap,g:FarmGame,select:(id:string)=>void):void {
 if(!P||!floor||!mistLayer||!items)return;
 floor.removeChildren().forEach(c=>c.destroy());
 mistLayer.removeChildren().forEach(c=>c.destroy());
 items.removeChildren().forEach(c=>c.destroy());
 tweens=[];particles=[];mistDrift=[];cropSway=[];treeSway=[];plotViews.clear();selectedRing=null;
 const xy=(x:number,y:number)=>({x:(x-y)*36,y:(x+y)*18});
 const selected=selectedFarmPlot();
 const targets=new P.Container();
 const hint=new P.Text('',{fontFamily:'SimSun',fontSize:11,fill:0x40543c,stroke:0xf7f3e8,strokeThickness:3});
 hint.anchor.set(.5,1);hint.visible=false;hint.eventMode='none';hint.zIndex=10000;hint.scale.set(.9/Math.max(.8,zoom));
 const hintFor=(p:FarmMap['plots'][number]):string=>{
  const id=p.kind==='unknown'?'economy:farmexplore:'+p.id:p.kind==='wild'?'economy:farmreclaim:'+p.id:'';
  if(p.improvement)return `${p.id} · ${IMPROVEMENT_NAMES[p.improvement]} · ${p.improvement==='canal'?(p.waterConnected?'已通水':'未通水'):p.improvement==='pit'?(p.pit?`转化中 · 剩 ${p.pit.remainingDays} 天`:'待投料 · 需3秸秆'):p.improvement==='shed'?'覆盖两格内的田':p.improvement==='retting'?'开放沤麻工序':p.improvement==='yard'?'相邻田正常收获期延长7天':p.improvement==='cellar'?'相邻田留种+1':'覆盖正交四格'}`;
  if(p.project&&p.project.done<p.project.total)return `${p.id} · ${p.project.name} ${p.project.done}/${p.project.total}天 · 点击续建`;
  if(!id)return `${p.id} · ${p.kind==='field'?(p.land?.paddy?'水田':'田地'):p.kind==='tree'?'古树 · 不可开垦':p.kind==='rock'?'岩石 · 不可开垦':p.kind==='water'?'水源 · 不可开垦':'查看地块'}`;
  const a=g.actions.find(a=>a.id===id);
  if(!a||!a.enabled)return `${p.id} · ${a?.reason??'先探索相邻地块'}`;
  const name=a.label.replace(/\s*p\d+q\d+$/,'');
  return `${name} · ${a.time??a.ap} 天${a.energy?` · 精力 ${a.energy}`:''}${a.money?` · 钱 ${a.money}`:''}`;
 };
 const tap=(id:string)=>{if(!drag?.moved)select(id);};
 for(const p of [...map.plots].sort((a,b)=>a.x+a.y-b.x-b.y)){
  const pos=xy(p.x,p.y),fog=p.kind==='unknown',field=p.kind==='field';
  plotViews.set(p.id,{x:pos.x,y:pos.y});
  floor.addChild(art!.sprite(fog?art!.unknownTexture():art!.groundTexture(field,p.land),pos.x,pos.y+26,.52));
  const tile=new P.Graphics();tile.position.set(pos.x,pos.y);tile.lineStyle(fog?1.1:.7,fog&&p.reachable?0x708668:0x91a080,fog&&!p.reachable?.28:.65).beginFill(0xd6e0cf,fog?.12:.01).drawPolygon([0,0,36,18,0,36,-36,18]).endFill();
  if(p.kind==='wild')for(let k=0;k<3;k++){const x=(p.x*13+k*19)%30-15,y=14+(p.y*7+k*9)%9;tile.lineStyle(.7,0x879b6f,.55).moveTo(x-2,y-3).lineTo(x,y).lineTo(x+2,y-4);}
  tile.eventMode='static';tile.cursor='pointer';tile.hitArea=new P.Polygon([0,0,36,18,0,36,-36,18]);tile.on('pointertap',()=>tap(p.id));targets.addChild(tile);
  if(p.id===selected){
   const ring=new P.Graphics().lineStyle(3,0xfff8dc,.95).drawPolygon([0,0,36,18,0,36,-36,18]).lineStyle(.7,0x5c7864,.9).drawPolygon([0,0,36,18,0,36,-36,18]);
   ring.position.set(pos.x,pos.y);ring.eventMode='none';targets.addChild(ring);selectedRing=ring;
  }
  const hover=new P.Graphics().lineStyle(1,0x728b76,.7).drawPolygon([0,0,36,18,0,36,-36,18]);hover.position.copyFrom(tile.position);hover.visible=false;hover.eventMode='none';targets.addChild(hover);
  const hintText=hintFor(p);
  tile.on('pointerover',()=>{hover.visible=true;if(hintText){hint.text=hintText;hint.position.set(pos.x,pos.y-8);hint.visible=true;}if(app&&!app.ticker.started)app.render();});
  tile.on('pointerout',()=>{hover.visible=false;hint.visible=false;if(app&&!app.ticker.started)app.render();});
  if(fog){const cloud=new P.Sprite(art!.mistTexture());cloud.anchor.set(.5);cloud.position.set(pos.x,pos.y+18);cloud.width=84;cloud.height=40;cloud.alpha=.42;cloud.eventMode='none';mistLayer.addChild(cloud);mistDrift.push({sp:cloud,baseX:pos.x,seed:p.x*3.1+p.y*1.7});
   if(p.id===selected||p.reachable){const label=new P.Text(p.reachable?'?':'·',{fontFamily:'SimSun',fontSize:p.reachable?18:14,fontWeight:'bold',fill:0x36594b,stroke:0xfffbeb,strokeThickness:2});label.anchor.set(.5);label.position.set(pos.x,pos.y+18);label.eventMode='none';items.addChild(label);}
  }
  let sp:Sprite|undefined;
  if(p.kind==='tree'||p.improvement==='shelter'||p.discovery?.id==='woodland'&&!p.discovery.resolved){sp=art!.sprite(art!.treeTexture(),pos.x,pos.y+25,p.kind==='tree'?.42:.34);treeSway.push(sp);}
  if(field&&p.field?.crop){sp=art!.sprite(art!.cropTexture(p.field.crop,p.field.growth>=p.field.duration?2:p.field.growth>=p.field.duration/3?1:0),pos.x,pos.y+30,.85);plotViews.get(p.id)!.crop=sp;plotViews.get(p.id)!.cropScale=.85/2;cropSway.push(sp);}
  if(sp){sp.zIndex=(p.x+p.y)*100+20;sp.eventMode='none';items.addChild(sp);}
  if((p.kind==='rock'||p.kind==='brush')&&!p.improvement){
   const obstacle=art!.sprite(p.kind==='rock'?art!.rockTexture():art!.brushTexture(),pos.x,pos.y+25,.85);
   obstacle.zIndex=(p.x+p.y)*100+20;obstacle.eventMode='none';items.addChild(obstacle);
  }
  if(p.improvement==='canal'||p.improvement==='drain'){
   // 通水渠用活水色，未通水的渠用干沟色；排水沟保持原色。
   const waterColor=p.improvement==='drain'?0x70694e:p.waterConnected?0x6ca2ad:0x9aa48c;
   const channel=new P.Graphics().lineStyle(9,0x9d9270).moveTo(-24,29).lineTo(24,6).lineStyle(5,waterColor).moveTo(-24,29).lineTo(24,6).lineStyle(1,0xcce6df).moveTo(-20,27).lineTo(20,8);
   channel.position.set(pos.x,pos.y);channel.zIndex=(p.x+p.y)*100+20;channel.eventMode='none';items.addChild(channel);
  }
  if(p.improvement==='yard'){
   // 晒场暂无独立绘件：复用水田浅水色块的绘制方式，改为压平晒场干土色。
   const floor=new P.Graphics().lineStyle(1,0xc9b47e,.9).beginFill(0xdcc790,.6).drawPolygon([0,10,22,21,0,32,-22,21]).endFill();
   floor.position.set(pos.x,pos.y);floor.zIndex=(p.x+p.y)*100+15;floor.eventMode='none';items.addChild(floor);
  }
  if(p.improvement==='cellar'){
   // 种子窖暂无独立绘件：复用水源格椭圆绘制，改为窖口土色（储粮类）。
   const cellar=new P.Graphics().lineStyle(2,0x9d9270).beginFill(0x5a452c).drawEllipse(0,18,15,8).endFill().beginFill(0x3e2f1e).drawEllipse(0,18,9,4.5).endFill().lineStyle(1,0xdcc790).moveTo(-9,14).lineTo(9,14);
   cellar.position.set(pos.x,pos.y);cellar.zIndex=(p.x+p.y)*100+20;cellar.eventMode='none';items.addChild(cellar);
  }
  if(p.improvement==='pit'){
   // 堆肥坑暂无独立绘件：复用水源格椭圆水面绘制，改为腐熟堆肥色。
   const pit=new P.Graphics().lineStyle(2,0x9d9270).beginFill(0x6d5636).drawEllipse(0,18,20,10).endFill().beginFill(0x8a744a).drawEllipse(-5,16,6,3).endFill().beginFill(0x8a744a).drawEllipse(6,20,4.5,2.5).endFill();
   pit.position.set(pos.x,pos.y);pit.zIndex=(p.x+p.y)*100+20;pit.eventMode='none';items.addChild(pit);
  }
  if(p.improvement==='retting'){
   // 沤麻塘暂无独立绘件：复用水源格水面绘制，水色系表示静水沤麻。
   const pond=new P.Graphics().lineStyle(2,0x9d9270).beginFill(0x7fa8a0).drawEllipse(0,18,22,10).endFill().beginFill(0xcce6df).drawEllipse(-5,16,7,3).endFill().beginFill(0xcce6df).drawEllipse(6,20,5,2.5).endFill();
   pond.position.set(pos.x,pos.y);pond.zIndex=(p.x+p.y)*100+20;pond.eventMode='none';items.addChild(pond);
  }
  if(p.improvement==='shed'){
   // 窝棚暂无独立绘件：复用农舍绘件（农舍类），缩小置于格上。
   const hut=art!.sprite(art!.houseTexture(),pos.x,pos.y+22,.22);
   hut.zIndex=(p.x+p.y)*100+20;hut.eventMode='none';items.addChild(hut);
  }
  if(p.kind==='water'){
   // 程序绘制水源格：复用渠水色系的椭圆水面与泉眼亮点，无独立美术素材。
   const spring=new P.Graphics().lineStyle(2,0x9d9270).beginFill(0x6ca2ad).drawEllipse(0,18,22,10).endFill().beginFill(0xcce6df).drawEllipse(-5,16,7,3).endFill().beginFill(0xcce6df).drawEllipse(6,20,5,2.5).endFill();
   spring.position.set(pos.x,pos.y);spring.zIndex=(p.x+p.y)*100+20;spring.eventMode='none';items.addChild(spring);
   const label=new P.Text('水源',{fontFamily:'Microsoft YaHei',fontSize:10,fill:0x31483d,stroke:0xf7f3e8,strokeThickness:3});label.anchor.set(.5);label.position.set(pos.x,pos.y+34);label.eventMode='none';label.zIndex=(p.x+p.y)*100+30;items.addChild(label);
  }
  if(field&&p.land?.paddy){
   // 程序绘制水田：在田面上叠一层浅水色块，表示每日保持蓄水。
   const paddyWater=new P.Graphics().lineStyle(1,0xcce6df,.8).beginFill(0x6ca2ad,.5).drawPolygon([0,10,22,21,0,32,-22,21]).endFill();
   paddyWater.position.set(pos.x,pos.y);paddyWater.zIndex=(p.x+p.y)*100+15;paddyWater.eventMode='none';items.addChild(paddyWater);
  }
  if(p.improvement){const label=new P.Text(IMPROVEMENT_NAMES[p.improvement],{fontFamily:'Microsoft YaHei',fontSize:10,fill:0x31483d,stroke:0xf7f3e8,strokeThickness:3});label.anchor.set(.5);label.position.set(pos.x,pos.y+34);label.eventMode='none';label.zIndex=(p.x+p.y)*100+30;items.addChild(label);}
  if(p.kind==='story'){
   const marker=new P.Text('◇',{fontFamily:'Microsoft YaHei',fontSize:24,fill:0x967245});marker.anchor.set(.5);marker.position.set(pos.x,pos.y+17);marker.zIndex=(p.x+p.y)*100+25;marker.eventMode='none';items.addChild(marker);
  }
 }
 items.addChild(targets);targets.zIndex=9998;
 items.addChild(hint);
}

export function bindFarmScene(root:Document,g:FarmGame,rerender:()=>void):void {
 observer?.disconnect();observer=null;
 app?.ticker.stop();
 const select=(id:string)=>{selectFarmPlot(id);rerender();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-panel]').forEach(b=>b.onclick=()=>{selectFarmPanel(b.dataset.farmPanel as FarmPanel);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-stock]').forEach(b=>b.onclick=()=>{selectFarmStock(b.dataset.farmStock!);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-jump]').forEach(b=>b.onclick=()=>select(b.dataset.farmJump!));
 root.querySelectorAll<HTMLButtonElement>('[data-farm-project]').forEach(b=>b.onclick=()=>{selectFarmProject(b.dataset.farmProject!);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-duration]').forEach(b=>b.onclick=()=>{selectFarmProjectDuration(b.dataset.farmDuration!);rerender();});
 const planPicker=root.getElementById('farm-plan-plot') as HTMLSelectElement|null;if(planPicker)planPicker.onchange=()=>{selectFarmPlot(planPicker.value);selectFarmPanel('calendar');rerender();};
 const batchPicker=root.getElementById('farm-plan-batch') as HTMLSelectElement|null;if(batchPicker)batchPicker.onchange=()=>{selectPlannedBatch(batchPicker.value);rerender();};
 const picker=root.getElementById('farm-plot-select') as HTMLSelectElement|null;if(picker)picker.onchange=()=>select(picker.value);
 quickEl=root.querySelector<HTMLElement>('.farm-map-quick');
 const host=root.getElementById('farm-map'),map=g.economy?.farm;
 if(!host||!map)return;
 P=P??(window as unknown as {PIXI:Pixi}).PIXI;
 if(!P){host.textContent='地图加载失败，请刷新。仍可使用右上角地块选择器进行操作。';return;}
 currentMap=map;
 const sizeMap=()=>{viewH=Math.max(1,host.clientHeight);};
 sizeMap();
 const W=Math.max(1,host.clientWidth);viewW=W;
 if(!app){
  app=new P.Application({width:W,height:viewH,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false});
  canvas=app.view as HTMLCanvasElement;canvas.setAttribute('aria-label','田地与探索地图；也可用右上角选择器操作');
  art=farmArt(P);
  background=new P.Sprite(art.landscapeTexture());background.height=viewH+12;
  distantHouse=art.sprite(art.houseTexture(),W*.77,105,.85);distantHouse.alpha=.82;distantHouse.eventMode='none';
  floor=new P.Container();mistLayer=new P.Container();items=new P.Container();items.sortableChildren=true;
  world=new P.Container();world.addChild(floor,mistLayer,items);
  app.stage.addChild(background,distantHouse,world);
  app.stage.eventMode='static';
  app.stage.on('pointerdown',e=>{drag={x:e.global.x,y:e.global.y,px:pan.x,py:pan.y,moved:false};});
  app.stage.on('globalpointermove',e=>{if(!drag)return;const dx=e.global.x-drag.x,dy=e.global.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(drag.moved){pan={x:drag.px+dx,y:drag.py+dy};fit();}});
  const release=()=>{setTimeout(()=>{drag=null;},0);};app.stage.on('pointerup',release);app.stage.on('pointerupoutside',release);
  app.ticker.add(tick);
 }
 host.replaceChildren(canvas!);
 app.renderer.resize(W,viewH);background!.texture=art!.landscapeTexture();background!.height=viewH+12;
 background!.width=W+24;distantHouse!.texture=art!.houseTexture();distantHouse!.x=W*.77;
 app.stage.hitArea=new P.Rectangle(0,0,W,viewH);
 buildWorld(map,g,select);
 const focus=()=>{const selected=map.plots.find(p=>p.id===selectedFarmPlot())!;pan={x:-(selected.x-selected.y)*36*zoom,y:viewH*.53-85-((selected.x+selected.y)*18+18)*zoom};};
 if(lastSelection!==selectedFarmPlot()){focus();lastSelection=selectedFarmPlot();}
 fit();
 root.querySelectorAll<HTMLButtonElement>('[data-farm-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.min(2.6,Math.max(.4,zoom+Number(b.dataset.farmZoom)*.15));fit();});
 const center=root.querySelector<HTMLButtonElement>('[data-farm-center]');
 if(center)center.onclick=()=>{focus();fit();};
 observer=new ResizeObserver(()=>{if(host.clientWidth){const oldHeight=viewH;sizeMap();viewW=host.clientWidth;app!.renderer.resize(viewW,viewH);background!.width=viewW+24;background!.height=viewH+12;distantHouse!.x=viewW*.77;app!.stage.hitArea=new P!.Rectangle(0,0,viewW,viewH);if(oldHeight!==viewH)focus();fit();}});
 observer.observe(host);
 if(!reduced())app.ticker.start();else app.render();
 // Complete the artwork swap only for the still-mounted, current observation.
 // Switching panels or acting while an image loads must never restore stale state.
 void Promise.all([art!.loadEnvironment(),art!.loadLand(),art!.loadCrops(['wheat','soy',...map.plots.flatMap(p=>p.field?.crop?[p.field.crop]:[])])]).then(changed=>{
  if(changed.some(Boolean)&&host.isConnected&&currentMap===map)rerender();
 });
}

// Tile-anchored feedback: effects are looked up by plot id in the freshly
// rebuilt scene, never held across re-renders.
function floatText(txt:string,x:number,y:number,color=0x42563a):void {
 if(!P||!items||!txt)return;
 const t=new P.Text(txt,{fontFamily:'"Microsoft YaHei",sans-serif',fontSize:13,fontWeight:'bold',fill:color,stroke:0xfffbee,strokeThickness:3});
 t.anchor.set(.5,1);t.position.set(x,y-14);t.zIndex=10001;t.eventMode='none';t.scale.set(.95/Math.max(.8,zoom));
 items.addChild(t);
 tweens.push({t:0,dur:1.05,ease:easeOut,update:k=>{t.position.y=y-14-k*22;t.alpha=k<.65?1:1-(k-.65)/.35;},done:()=>t.destroy()});
}
function burst(x:number,y:number,color:number,n:number):void {
 if(!P||!items)return;
 for(let i=0;i<n;i++){
  const g=new P.Graphics().beginFill(color).drawCircle(0,0,1.5+Math.random()*1.8).endFill();
  g.position.set(x+(Math.random()-.5)*22,y+(Math.random()-.5)*8);g.zIndex=10000;g.eventMode='none';items.addChild(g);
  particles.push({g,vx:(Math.random()-.5)*1.8,vy:-(Math.random()*1.6+.7),life:.7,max:.7});
 }
}
function ring(x:number,y:number,color:number):void {
 if(!P||!items)return;
 const g=new P.Graphics().lineStyle(2,color,.9).drawPolygon([0,0,36,18,0,36,-36,18]);
 g.position.set(x,y);g.zIndex=9999;g.eventMode='none';items.addChild(g);
 tweens.push({t:0,dur:.6,ease:easeOut,update:k=>{g.scale.set(.6+k*.6);g.alpha=1-k;},done:()=>g.destroy()});
}
function mistLift(x:number,y:number):void {
 if(!P||!items||!art)return;
 const cloud=new P.Sprite(art.mistTexture());cloud.anchor.set(.5);cloud.position.set(x,y+18);cloud.width=110;cloud.height=68;cloud.eventMode='none';cloud.zIndex=9990;
 items.addChild(cloud);
 tweens.push({t:0,dur:.7,ease:easeOut,update:k=>{cloud.alpha=1-k;const s=1+k*.7;cloud.width=110*s;cloud.height=68*s;cloud.y=y+18-k*14;},done:()=>cloud.destroy()});
}
function popCrop(view:{crop?:Sprite;cropScale?:number},from:number):void {
 if(!view.crop||!view.cropScale)return;
 const sp=view.crop,base=view.cropScale;
 tweens.push({t:0,dur:.45,ease:easeOutBack,update:k=>{const s=base*(from+(1-from)*k);sp.scale.set(s);},done:()=>sp.scale.set(base)});
}
function seedDrop(x:number,y:number):void {
 if(!P||!items)return;
 for(let i=0;i<3;i++){
  const g=new P.Graphics().beginFill(0x795330).drawCircle(0,0,1.8).endFill();
  g.position.set(x+(i-1)*8,y-26-Math.random()*8);g.zIndex=10000;g.eventMode='none';items.addChild(g);
  particles.push({g,vx:0,vy:1.1+Math.random()*.5,life:.45, max:.45});
 }
}
const shortLabel=(label:string):string=>{
 const s=label.replace(/^p\d+q\d+\s*[· ]?\s*/,'');
 const parts=s.split(/[：:，。；]/).filter(Boolean);
 return (parts.length>1?parts[0]:s).slice(0,12);
};

export type FarmFeedback=Readonly<{kind:FarmArt|'notice'|'grow';label:string;plotId?:string;crop?:string;float?:string}>;
export function playFarmFeedback(root:Document,events:readonly FarmFeedback[]):void {
 const layer=root.querySelector<HTMLElement>('.farm-effect-layer,.farm-room-feedback');
 if(layer&&events.length){
  const topic=events.find(e=>e.kind!=='notice'&&e.kind!=='grow')?.kind;
  layer.innerHTML=layer.classList.contains('farm-effect-layer')&&topic?farmEventArt(topic as FarmArt):'';
  const text=root.createElement('span');text.textContent=events.map(e=>e.label).join('；');layer.append(text);
  if(!reduced())layer.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,fill:'both'});
 }
 if(reduced())return;
 for(const e of events){
  if(e.kind==='grow'){
   for(const [pid,view] of plotViews){
    const plot=currentMap?.plots.find(pp=>pp.id===pid);
    if(plot?.field?.crop===e.crop&&view.crop){popCrop(view,.72);floatText(e.float??'',view.x,view.y-6);}
   }
   continue;
  }
  const pid=e.plotId??/^(p\d+q\d+)/.exec(e.label)?.[1];
  if(!pid)continue;
  const view=plotViews.get(pid);
  if(!view)continue;
  const float=e.float??shortLabel(e.label);
  if(e.kind==='explore'){mistLift(view.x,view.y);ring(view.x,view.y,0x8ba888);floatText(float,view.x,view.y-6);}
  else if(e.kind==='discovery'){ring(view.x,view.y,0x967245);floatText(float,view.x,view.y-6,0x7c5a30);}
  else if(e.kind==='reclaim'){burst(view.x,view.y+14,0x8a6d4a,8);ring(view.x,view.y,0xa08c5c);floatText(float,view.x,view.y-6);}
  else if(e.kind==='sow'){seedDrop(view.x,view.y);popCrop(view,.25);floatText(float,view.x,view.y-6);}
  else if(e.kind==='harvest'){burst(view.x,view.y+8,0xd9a83c,10);floatText(float,view.x,view.y-6,0x8a6a1e);}
  else if(e.kind==='tend'){burst(view.x,view.y+8,0x7fa8c9,6);floatText(float,view.x,view.y-6,0x46657c);}
 }
}
