import {openFarmPlanner} from '../farm-planner.js';
import {IMPROVEMENT_NAMES} from '../../../src/game/systems/agriculture.js';
import {farmArt} from './scene.js';
import {farmEventArt,type FarmArt} from '../illustration.js';
import {type FarmGame,selectedFarmPlot,selectFarmPlot,selectFarmPanel,selectFarmStock,selectFarmProject,selectFarmProjectDuration,selectFarmDock,type FarmPanel} from '../farm-view.js';

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
let background:Sprite|null=null;
let observer:ResizeObserver|null=null;
let zoom=1.85,pan={x:0,y:0},viewW=1,viewH=360;
let lastSelection='';
let drag:null|{x:number;y:number;px:number;py:number;moved:boolean}=null;
let currentMap:FarmMap|null=null;
let quickEl:HTMLElement|null=null;
let elapsed=0;
const plotViews=new Map<string,{x:number;y:number;crop?:Sprite;cropScale?:number}>();
let cropSway:Sprite[]=[];
let treeSway:Sprite[]=[];
let selectedRing:Graphics|null=null;
let tweens:Tween[]=[];
let particles:Particle[]=[];
const effectTextures=new Map<string,import('pixi.js-legacy').Texture>();
let effectsLoading=false;
const effectSource=(kind:string)=>`/illustrations/farm/animation/painted/environment/farm-effect-${kind}-qinglu-v1.webp`;

const easeOut=(k:number)=>1-Math.pow(1-k,3);
const easeOutBack=(k:number)=>{const c=1.70158,c3=c+1;return 1+c3*Math.pow(k-1,3)+c*Math.pow(k-1,2);};
const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;

function tick(dt:number):void {
 elapsed+=dt;
 for(const c of cropSway)c.skew.x=Math.sin(elapsed*.025+c.position.x)*.012;
 for(const t of treeSway)t.skew.x=Math.sin(elapsed*.012+t.position.x)*.004;
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
 if(background){
  // Camera limits are the painted world's edges, not a separate screen backdrop.
  zoom=Math.max(zoom,viewW/background.width,viewH/background.height);
  const minX=viewW-(background.x+background.width)*zoom,maxX=-background.x*zoom;
  const minY=viewH-(background.y+background.height)*zoom,maxY=-background.y*zoom;
  pan.x=Math.max(minX,Math.min(maxX,viewW/2+pan.x))-viewW/2;
  pan.y=Math.max(minY,Math.min(maxY,85+pan.y))-85;
 }
 world.scale.set(zoom);
 world.position.set(viewW/2+pan.x,85+pan.y);
 placeQuick();
 if(!app.ticker.started)app.render();
}

function buildWorld(map:FarmMap,g:FarmGame,select:(id:string)=>void,openHome:()=>void):void {
 if(!P||!floor||!mistLayer||!items)return;
 floor.removeChildren().forEach(c=>c.destroy());
 mistLayer.removeChildren().forEach(c=>c.destroy());
 items.removeChildren().forEach(c=>c.destroy());
 tweens=[];particles=[];cropSway=[];treeSway=[];plotViews.clear();selectedRing=null;
 const xy=(x:number,y:number)=>({x:(x-y)*36,y:(x+y)*18});
 const selected=selectedFarmPlot();
 const targets=new P.Container();
 const hint=new P.Text('',{fontFamily:'SimSun',fontSize:11,fill:0x40543c,stroke:0xf7f3e8,strokeThickness:3});
 hint.anchor.set(.5,1);hint.visible=false;hint.eventMode='none';hint.zIndex=10000;hint.scale.set(.9/Math.max(.8,zoom));
 const hintFor=(p:FarmMap['plots'][number]):string=>{
  const id=p.kind==='unknown'?'economy:farmexplore:'+p.id:p.kind==='wild'?'economy:farmreclaim:'+p.id:'';
  if(p.improvement)return `${p.id} · ${IMPROVEMENT_NAMES[p.improvement]} · ${p.improvement==='canal'?(p.waterConnected?'已通水':'未通水'):p.improvement==='pit'?(p.pit?`转化中 · 剩 ${p.pit.remainingDays} 天`:'待投料 · 需3秸秆'):p.improvement==='shed'?'覆盖两格内的田':p.improvement==='retting'?'开放沤麻工序':p.improvement==='yard'?'相邻田正常收获期延长7天':p.improvement==='cellar'?'相邻田留种+1':'覆盖正交四格'}`;
  if(p.project&&p.project.done<p.project.total)return `${p.id} · ${p.project.name} ${p.project.done}/${p.project.total}天 · 点击续建`;
  if(!id)return `${p.id} · ${p.kind==='field'?(p.purpose==='other'?'其他用途':p.land?.paddy?'播种用途 · 水田':'播种用途'):p.kind==='tree'?'古树 · 不可开垦':p.kind==='rock'?'岩石 · 不可开垦':p.kind==='water'?'水源 · 不可开垦':'查看地块'}`;
  const a=g.actions.find(a=>a.id===id);
  if(!a||!a.enabled)return `${p.id} · ${a?.reason??'先探索相邻地块'}`;
  const name=a.label.replace(/\s*p\d+q\d+$/,'');
  return `${name} · ${a.time??a.ap} 天${a.energy?` · 压力 ${a.energy}`:''}${a.money?` · 钱 ${a.money}`:''}`;
 };
 const tap=(id:string)=>{if(!drag?.moved)select(id);};
 for(const p of [...map.plots].sort((a,b)=>a.x+a.y-b.x-b.y)){
  const pos=xy(p.x,p.y),fog=p.kind==='unknown',field=p.kind==='field';
  plotViews.set(p.id,{x:pos.x,y:pos.y});
  const tileKey=fog?'':p.kind==='water'?'water':p.improvement==='canal'?(p.waterConnected?'canal-connected':'canal-dry'):p.improvement==='pit'&&p.pit?'pit-active':p.improvement??(field&&p.land?.paddy?'paddy':'');
  const ground=field?(p.land?.paddy?art!.tileTexture('paddy'):null):tileKey?art!.tileTexture(tileKey):null;
  const surface=art!.sprite(ground??art!.groundTexture(field,p.land),pos.x,pos.y+26,.52);surface.alpha=fog?.12:field||p.improvement||p.kind==='water'?.9:.5;floor.addChild(surface);
  const tile=new P.Graphics();tile.position.set(pos.x,pos.y);tile.lineStyle(.6,0x738b6c,fog&&p.reachable?.28:.12).beginFill(0xd6e0cf,fog?.12:.01).drawPolygon([0,0,36,18,0,36,-36,18]).endFill();
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
  if(fog){const cloud=new P.Sprite(art!.mistTexture());cloud.anchor.set(.5);cloud.position.set(pos.x,pos.y+18);cloud.width=84;cloud.height=40;cloud.alpha=.18;cloud.eventMode='none';mistLayer.addChild(cloud);const question=new P.Text('?',{fontFamily:'SimSun',fontSize:11,fill:0x6f8065});question.anchor.set(.5);question.position.set(pos.x,pos.y+18);question.alpha=p.reachable?.75:.35;question.eventMode='none';mistLayer.addChild(question);
  }
  let sp:Sprite|undefined;
  const woodland=p.kind==='story'&&p.discovery?.id==='woodland'&&!p.discovery.resolved;
  if(p.kind==='tree'||woodland){
   const shade=new P.Graphics().beginFill(0x516447,.12).drawEllipse(pos.x,pos.y+22,15,5).endFill();shade.eventMode='none';floor.addChild(shade);
   sp=art!.sprite(art!.treeTexture(woodland),pos.x,pos.y+27,p.kind==='tree'?.55:.4);
   if(p.kind==='tree')treeSway.push(sp);
  }
  if(field&&p.field?.crop){sp=art!.sprite(art!.cropTexture(p.field.crop,p.field.growth>=p.field.duration?2:p.field.growth>=p.field.duration/3?1:0),pos.x,pos.y+30,.85);plotViews.get(p.id)!.crop=sp;plotViews.get(p.id)!.cropScale=.85/2;cropSway.push(sp);}
  if(sp){sp.zIndex=(p.x+p.y)*100+20;sp.eventMode='none';items.addChild(sp);}
  if((p.kind==='rock'||p.kind==='brush')&&!p.improvement){
   const obstacle=art!.sprite(p.kind==='rock'?art!.rockTexture():art!.brushTexture(),pos.x,pos.y+25,.62);
   obstacle.zIndex=(p.x+p.y)*100+20;obstacle.eventMode='none';items.addChild(obstacle);
  }
  if(field&&p.improvement){const addon=art!.sprite(art!.tileTexture(tileKey)!,pos.x+20,pos.y+24,.16);addon.eventMode='none';addon.zIndex=(p.x+p.y)*100+24;items.addChild(addon);}
  const tileLabel=p.improvement&&!field?IMPROVEMENT_NAMES[p.improvement]:p.kind==='water'?'水源':'';
  if(tileLabel){const label=new P.Text(tileLabel,{fontFamily:'Microsoft YaHei',fontSize:10,fill:0x31483d,stroke:0xf7f3e8,strokeThickness:3});label.anchor.set(.5);label.position.set(pos.x,pos.y+34);label.eventMode='none';label.zIndex=(p.x+p.y)*100+30;items.addChild(label);}
  const task=field?map.schedule.tasks.find(t=>t.plotId===p.id&&t.deadline>g.life!.calendar.absoluteDay):undefined;
  if(task){const days=Math.max(0,Math.ceil(task.day-g.life!.calendar.absoluteDay));const label=new P.Text(`${p.id} · ${days?days+'天后':'待办'}${{sow:'播种',fertilize:'施肥',harvest:'收获',water:'灌溉'}[task.kind]}`,{fontFamily:'Microsoft YaHei',fontSize:9,fill:0x43604c,stroke:0xfffbee,strokeThickness:3});label.anchor.set(.5);label.position.set(pos.x,pos.y+42);label.eventMode='none';label.zIndex=(p.x+p.y)*100+31;items.addChild(label);}
  if(p.kind==='story'){
   const marker=new P.Text('◇',{fontFamily:'Microsoft YaHei',fontSize:p.discovery?.id==='woodland'?12:24,fill:0x967245});marker.anchor.set(.5);marker.position.set(pos.x+(p.discovery?.id==='woodland'?26:0),pos.y+22);marker.zIndex=(p.x+p.y)*100+25;marker.eventMode='none';items.addChild(marker);
  }
 }
 // The homestead illustration spans a decorative three-by-three footprint outside playable land.
 const housePos=xy(-2,2);
 const house=art!.sprite(art!.houseTexture(),housePos.x-27,housePos.y+86,.85);house.zIndex=10;house.eventMode='static';house.cursor='pointer';house.on('pointertap',()=>{if(!drag?.moved)openHome();});items.addChild(house);
 const houseLabel=new P.Text('农舍',{fontFamily:'SimSun',fontSize:9,fill:0x40583d,stroke:0xf7f3e8,strokeThickness:2});houseLabel.anchor.set(.5);houseLabel.position.set(housePos.x-27,housePos.y+96);houseLabel.eventMode='none';items.addChild(houseLabel);
 items.addChild(targets);targets.zIndex=9998;
 items.addChild(hint);
}

// The document root survives action renders; fullscreen must never target a replaced panel.
let farmFullscreen=false;
function syncFarmFullscreen():void {
 document.body.classList.toggle('farm-fullscreen',farmFullscreen);
 document.querySelectorAll<HTMLButtonElement>('[data-farm-fullscreen]').forEach(b=>{
  b.textContent=farmFullscreen?'↙':'⛶';
  b.setAttribute('aria-label',farmFullscreen?'退出全屏':'进入全屏');
  b.title=farmFullscreen?'退出全屏（Esc）':'进入全屏';
  b.setAttribute('aria-pressed',String(farmFullscreen));
 });
}
document.addEventListener('fullscreenchange',()=>{
 if(!document.fullscreenElement){farmFullscreen=false;syncFarmFullscreen();}
});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&farmFullscreen&&!document.fullscreenElement){farmFullscreen=false;syncFarmFullscreen();}
});
export function bindFarmScene(root:Document,g:FarmGame,rerender:()=>void):void {
 observer?.disconnect();observer=null;
 app?.ticker.stop();
 if(!root.querySelector('.farm-field-scene')&&farmFullscreen){
  farmFullscreen=false;
  if(root.fullscreenElement)void root.exitFullscreen().catch(()=>{});
 }
 syncFarmFullscreen();
 const scene=root.querySelector<HTMLElement>('.farm-field-scene');
 if(scene){
  const tooltip=root.createElement('div');tooltip.className='farm-action-tooltip';tooltip.id='farm-action-tooltip';tooltip.role='tooltip';tooltip.hidden=true;scene.append(tooltip);
  scene.querySelectorAll<HTMLElement>('.farm-scene-dock-content .game-action .action-name').forEach(name=>{
   if(name.querySelector('img,.farm-land-art'))return;
   const picture=root.createElement('img');picture.src='/illustrations/farm/field-empty-ui.webp';picture.alt='';picture.className='farm-choice-art';picture.width=78;picture.height=64;name.prepend(picture);
  });
  let active:HTMLElement|null=null;
  const hide=()=>{active?.removeAttribute('aria-describedby');active=null;tooltip.hidden=true;};
  scene.querySelectorAll<HTMLElement>('.action-option,[data-farm-explain],.farm-sow-entry').forEach(el=>{
   const button=el.matches('button')?el:el.querySelector<HTMLElement>('[data-action]');
   const action=g.actions.find(a=>a.id===button?.dataset.action);
   const description=el.dataset.farmExplain??(action?[action.description,!action.enabled?action.reason:''].filter(Boolean).join('\n'):el.classList.contains('farm-sow-entry')?'选择已有种子，查看此地块可安排的作物与农时。':'');
   if(!description)return;
   if(button?.matches(':disabled'))el.tabIndex=0;
   const show=()=>{
    hide();active=el;el.setAttribute('aria-describedby',tooltip.id);tooltip.textContent=description;tooltip.hidden=false;
    const rect=el.getBoundingClientRect(),box=tooltip.getBoundingClientRect();
    tooltip.style.left=Math.max(12,Math.min(innerWidth-box.width-12,rect.left+(rect.width-box.width)/2))+'px';
    tooltip.style.top=Math.max(12,rect.top-box.height-10>=12?rect.top-box.height-10:Math.min(innerHeight-box.height-12,rect.bottom+10))+'px';
   };
   el.addEventListener('pointerenter',show);el.addEventListener('focusin',show);
   el.addEventListener('pointerleave',e=>{if(!(e.relatedTarget instanceof Node&&tooltip.contains(e.relatedTarget)))hide();});
   el.addEventListener('focusout',hide);
  });
  tooltip.addEventListener('pointerleave',hide);
  scene.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
  scene.querySelector('.farm-scene-dock-content')?.addEventListener('scroll',hide);
 }
 root.querySelector<HTMLButtonElement>('[data-farm-fullscreen]')?.addEventListener('click',async()=>{
  if(farmFullscreen){farmFullscreen=false;syncFarmFullscreen();if(root.fullscreenElement)await root.exitFullscreen().catch(()=>{});}
  else {farmFullscreen=true;syncFarmFullscreen();if(root.fullscreenEnabled)await root.documentElement.requestFullscreen().catch(()=>{/* Keep the in-window immersive layout when native fullscreen is unavailable. */});}
 });
 root.querySelectorAll<HTMLButtonElement>('[data-farm-dock]').forEach(b=>b.onclick=()=>{selectFarmDock(b.dataset.farmDock as Parameters<typeof selectFarmDock>[0]);rerender();});
 const select=(id:string)=>{selectFarmPlot(id);rerender();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-panel]').forEach(b=>b.onclick=()=>{selectFarmPanel(b.dataset.farmPanel as FarmPanel);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-stock]').forEach(b=>b.onclick=()=>{selectFarmStock(b.dataset.farmStock!);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-jump]').forEach(b=>b.onclick=()=>select(b.dataset.farmJump!));
 root.querySelectorAll<HTMLButtonElement>('[data-farm-plan]').forEach(b=>b.onclick=()=>{openFarmPlanner(g,b.dataset.farmPlan);selectFarmPanel('calendar');rerender();root.getElementById('farm-planner')?.scrollIntoView({behavior:reduced()?'instant':'smooth',block:'start'});});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-project]').forEach(b=>b.onclick=()=>{selectFarmProject(b.dataset.farmProject!);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-duration]').forEach(b=>b.onclick=()=>{selectFarmProjectDuration(b.dataset.farmDuration!);rerender();});
 const picker=root.getElementById('farm-plot-select') as HTMLSelectElement|null;if(picker)picker.onchange=()=>select(picker.value);
 quickEl=root.querySelector<HTMLElement>('.farm-map-quick');
 const host=root.getElementById('farm-map'),map=g.economy?.farm;
 if(!host||!map)return;
 P=P??(window as unknown as {PIXI:Pixi}).PIXI;
 if(!P){host.textContent='地图加载失败，请刷新。仍可使用右上角地块选择器进行操作。';return;}
 if(!effectsLoading){effectsLoading=true;for(const kind of ['sow','water','harvest'])void P.Assets.load<import('pixi.js-legacy').Texture>(effectSource(kind)).then(t=>effectTextures.set(kind,t)).catch(()=>{});}
 currentMap=map;
 const sizeMap=()=>{viewH=Math.max(1,host.clientHeight);};
 sizeMap();
 const W=Math.max(1,host.clientWidth);viewW=W;
 if(!app){
  app=new P.Application({width:W,height:viewH,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false});
  canvas=app.view as HTMLCanvasElement;canvas.setAttribute('aria-label','田地与探索地图；也可用右上角选择器操作');
  art=farmArt(P);
  background=new P.Sprite(art.landscapeTexture());background.height=viewH+12;
  floor=new P.Container();mistLayer=new P.Container();items=new P.Container();items.sortableChildren=true;
  world=new P.Container();world.addChild(background,floor,mistLayer,items);
  app.stage.addChild(world);
  app.stage.eventMode='static';
  app.stage.on('pointerdown',e=>{drag={x:e.global.x,y:e.global.y,px:pan.x,py:pan.y,moved:false};});
  app.stage.on('globalpointermove',e=>{if(!drag)return;const dx=e.global.x-drag.x,dy=e.global.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(drag.moved){pan={x:drag.px+dx,y:drag.py+dy};fit();}});
  const release=()=>{setTimeout(()=>{drag=null;},0);};app.stage.on('pointerup',release);app.stage.on('pointerupoutside',release);
  app.ticker.add(tick);
 }
 host.replaceChildren(canvas!);
 const placeLandscape=()=>{
  const texture=art!.landscapeTexture();background!.texture=texture;
  const xs=[-144,...map.plots.map(p=>(p.x-p.y)*36)],ys=[0,...map.plots.map(p=>(p.x+p.y)*18+18)];
  const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
  const scale=Math.max((right-left+viewW/1.2)/texture.width,(bottom-top+viewH/1.2)/texture.height);
  background!.scale.set(scale);
  background!.position.set((left+right-background!.width)/2,(top+bottom-background!.height)/2);
  background!.eventMode='none';
 };
 app.renderer.resize(W,viewH);placeLandscape();
 app.stage.hitArea=new P.Rectangle(0,0,W,viewH);
 buildWorld(map,g,select,()=>{selectFarmPanel('home');rerender();});
 const focus=()=>{const selected=map.plots.find(p=>p.id===selectedFarmPlot())!;pan={x:-(selected.x-selected.y)*36*zoom,y:viewH*.42-85-((selected.x+selected.y)*18+18)*zoom};};
 if(lastSelection!==selectedFarmPlot()){focus();lastSelection=selectedFarmPlot();}
 fit();
 root.querySelectorAll<HTMLButtonElement>('[data-farm-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.min(2.6,Math.max(.4,zoom+Number(b.dataset.farmZoom)*.15));fit();});
 const center=root.querySelector<HTMLButtonElement>('[data-farm-center]');
 if(center)center.onclick=()=>{focus();fit();};
 observer=new ResizeObserver(()=>{if(host.clientWidth){const oldHeight=viewH;sizeMap();viewW=host.clientWidth;app!.renderer.resize(viewW,viewH);placeLandscape();app!.stage.hitArea=new P!.Rectangle(0,0,viewW,viewH);if(oldHeight!==viewH)focus();fit();}});
 observer.observe(host);
 if(!reduced())app.ticker.start();else app.render();
 // Complete the artwork swap only for the still-mounted, current observation.
 // Switching panels or acting while an image loads must never restore stale state.
 void Promise.all([art!.loadEnvironment(),art!.loadLand(),art!.loadTiles(),art!.loadCrops(['wheat','soy',...map.plots.flatMap(p=>p.field?.crop?[p.field.crop]:[])])]).then(changed=>{
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
function watercolorEffect(kind:'sow'|'water'|'harvest',x:number,y:number):void {
 const texture=effectTextures.get(kind);if(!P||!items||!texture)return;
 const sp=new P.Sprite(texture);sp.anchor.set(.5);sp.position.set(x,y+12);sp.eventMode='none';sp.zIndex=10000;
 const scale=(kind==='water'?78:48)/texture.width;sp.scale.set(scale);items.addChild(sp);
 tweens.push({t:0,dur:1.2,ease:k=>k,update:k=>{sp.alpha=Math.min(1,k*7)*(1-k);sp.scale.set(scale*(kind==='water'?.7+k*.6:1+k*.12));sp.y=y+12+(kind==='sow'?-12*(1-k):kind==='harvest'?-k*22:0);},done:()=>sp.destroy()});
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
  const planned=events.some(e=>e.label==='田块时间安排已更新，已同步到农事日历。');
  const ink=planned?'plan':topic==='tend'?'water':topic==='sow'||topic==='harvest'?topic:undefined;
  layer.innerHTML=ink?`<img class="farm-feedback-ink" src="${effectSource(ink)}" alt="">`:layer.classList.contains('farm-effect-layer')&&topic?farmEventArt(topic as FarmArt):'';
  if(planned)root.querySelector('.farm-date.is-selected')?.classList.add('farm-date-stamped');
  const text=root.createElement('span');text.textContent=events.map(e=>e.label).join('；');layer.append(text);
  if(!reduced())layer.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,fill:'both'});
 }
 if(reduced()||!root.getElementById('farm-map'))return;
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
  else if(e.kind==='sow'){watercolorEffect('sow',view.x,view.y);seedDrop(view.x,view.y);popCrop(view,.25);floatText(float,view.x,view.y-6);}
  else if(e.kind==='harvest'){watercolorEffect('harvest',view.x,view.y);burst(view.x,view.y+8,0xc7a55d,7);floatText(float,view.x,view.y-6,0x8a6a1e);}
  else if(e.kind==='tend'){watercolorEffect('water',view.x,view.y);burst(view.x,view.y+8,0x79a995,5);floatText(float,view.x,view.y-6,0x46657c);}
 }
}
