import {farmArt} from './scene.js';
import {farmEventArt,type FarmArt} from '../illustration.js';
import {type FarmGame,selectedFarmPlot,selectFarmPlot,selectFarmPanel,selectFarmStock,type FarmPanel} from '../farm-view.js';
let cleanup=()=>{};
let zoom=1.9,pan={x:0,y:0};
export function bindFarmScene(root:Document,g:FarmGame,rerender:()=>void):void {
 cleanup();cleanup=()=>{};
 const host=root.getElementById('farm-map'),map=g.economy?.farm;if(!map)return;
 const select=(id:string)=>{selectFarmPlot(id);if(map.plots.find(p=>p.id===id)?.kind==='home')selectFarmPanel('home');rerender();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-panel]').forEach(b=>b.onclick=()=>{selectFarmPanel(b.dataset.farmPanel as FarmPanel);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-stock]').forEach(b=>b.onclick=()=>{selectFarmStock(b.dataset.farmStock!);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-jump]').forEach(b=>b.onclick=()=>select(b.dataset.farmJump!));
 const picker=root.getElementById('farm-plot-select') as HTMLSelectElement;if(picker)picker.onchange=()=>select(picker.value);
 if(!host)return;
 const P=(window as unknown as {PIXI:typeof import('pixi.js-legacy')}).PIXI;
 if(!P){host.textContent='地图加载失败，请刷新。仍可使用右侧地块选择器进行操作。';return;}
 const app=new P.Application({width:Math.max(1,host.clientWidth),height:560,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false});
 const canvas=app.view as HTMLCanvasElement;canvas.setAttribute('aria-label','田地与探索地图；也可用右侧选择器操作');host.replaceChildren(canvas);
 const art=farmArt(P),background=new P.Sprite(art.landscapeTexture()),world=new P.Container(),floor=new P.Container(),mist=new P.Container(),items=new P.Container();items.sortableChildren=true;world.addChild(floor,mist,items);app.stage.addChild(background,world);background.width=host.clientWidth;background.height=560;
 const xy=(x:number,y:number)=>({x:(x-y)*36,y:(x+y)*18});
 const selected=selectedFarmPlot();let drag:null|{x:number;y:number;px:number;py:number;moved:boolean}=null;
 const tap=(id:string)=>{if(!drag?.moved)select(id);};
 for(const p of [...map.plots].sort((a,b)=>a.x+a.y-b.x-b.y)){
  const pos=xy(p.x,p.y),fog=p.kind==='unknown',field=p.kind==='field';
  if(!fog)floor.addChild(art.sprite(art.groundTexture(field),pos.x,pos.y+26,.52));
  const tile=new P.Graphics();tile.position.set(pos.x,pos.y);tile.beginFill(0xd6e0cf,fog?.09:0).drawPolygon([0,0,36,18,0,36,-36,18]).endFill();
  if(p.id===selected)tile.lineStyle(3,0xfff8dc,.95).drawPolygon([0,0,36,18,0,36,-36,18]).lineStyle(.7,0x5c7864,.9).drawPolygon([0,0,36,18,0,36,-36,18]);
  if(p.kind==='wild')for(let k=0;k<3;k++){const x=(p.x*13+k*19)%30-15,y=14+(p.y*7+k*9)%9;tile.lineStyle(.7,0x879b6f,.55).moveTo(x-2,y-3).lineTo(x,y).lineTo(x+2,y-4);}
  tile.eventMode='static';tile.cursor='pointer';tile.hitArea=new P.Polygon([0,0,36,18,0,36,-36,18]);tile.on('pointertap',()=>tap(p.id));floor.addChild(tile);
  const hover=new P.Graphics().lineStyle(1,0x728b76,.7).drawPolygon([0,0,36,18,0,36,-36,18]);hover.position.copyFrom(tile.position);hover.visible=false;hover.eventMode='none';floor.addChild(hover);
  tile.on('pointerover',()=>{hover.visible=true;app.render();});tile.on('pointerout',()=>{hover.visible=false;app.render();});
  if(fog){const cloud=new P.Sprite(art.mistTexture());cloud.anchor.set(.5);cloud.position.set(pos.x,pos.y+18);cloud.width=110;cloud.height=68;cloud.eventMode='none';mist.addChild(cloud);
   if(p.id===selected||p.reachable&&(p.x+p.y)%3===0){const label=new P.Text(p.id===selected?'待探':'·',{fontFamily:'SimSun',fontSize:p.id===selected?10:16,fill:0x73836e});label.anchor.set(.5);label.position.set(pos.x,pos.y+18);label.eventMode='none';items.addChild(label);}
  }
  let sp:import('pixi.js-legacy').Sprite|undefined;
  if(p.kind==='tree')sp=art.sprite(art.treeTexture(),pos.x,pos.y+25,.65);
  if(p.kind==='home')sp=art.sprite(art.houseTexture(),pos.x,pos.y+27,.65);
  if(field&&p.field?.crop)sp=art.sprite(art.cropTexture(p.field.crop,p.field.growth>=p.field.duration?2:p.field.growth>0?1:0),pos.x,pos.y+30,.85);
  if(sp){sp.zIndex=(p.x+p.y)*100+20;sp.eventMode='static';sp.cursor='pointer';sp.on('pointertap',()=>tap(p.id));items.addChild(sp);}
  if(p.kind==='rock'||p.kind==='brush'){
   const obstacle=new P.Graphics();
   if(p.kind==='rock')obstacle.beginFill(0x8a9184).drawPolygon([-22,5,-15,-10,4,-17,22,-3,17,10,-4,16]).endFill().beginFill(0xa7aa96).drawPolygon([-15,-10,4,-17,8,-2,-8,2]).endFill();
   else for(let k=0;k<5;k++)obstacle.lineStyle(2,0x707c4c).moveTo(-15+k*7,10).lineTo(-20+k*7,-9).moveTo(-15+k*7,10).lineTo(-10+k*7,-14);
   obstacle.position.set(pos.x,pos.y+17);obstacle.zIndex=(p.x+p.y)*100+20;obstacle.eventMode='static';obstacle.cursor='pointer';obstacle.on('pointertap',()=>tap(p.id));items.addChild(obstacle);
  }
  if(p.kind==='story'){
   const marker=new P.Text('◇',{fontFamily:'Microsoft YaHei',fontSize:24,fill:0x967245});marker.anchor.set(.5);marker.position.set(pos.x,pos.y+17);marker.zIndex=(p.x+p.y)*100+25;marker.eventMode='static';marker.cursor='pointer';marker.on('pointertap',()=>tap(p.id));items.addChild(marker);
  }

 }
 const fit=()=>{world.scale.set(zoom);world.position.set(host.clientWidth/2+pan.x,85+pan.y);app.render();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.min(2.6,Math.max(.4,zoom+Number(b.dataset.farmZoom)*.15));fit();});
 root.querySelector<HTMLButtonElement>('[data-farm-center]')!.onclick=()=>{const p=map.plots.find(p=>p.id===selected)!;const pos=xy(p.x,p.y);pan={x:-pos.x*zoom,y:170-pos.y*zoom};fit();};
 app.stage.eventMode='static';app.stage.hitArea=new P.Rectangle(0,0,host.clientWidth,560);
 app.stage.on('pointerdown',e=>{drag={x:e.global.x,y:e.global.y,px:pan.x,py:pan.y,moved:false};});
 app.stage.on('globalpointermove',e=>{if(!drag)return;const dx=e.global.x-drag.x,dy=e.global.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(drag.moved){pan={x:drag.px+dx,y:drag.py+dy};fit();}});
 const release=()=>{setTimeout(()=>{drag=null;},0);};app.stage.on('pointerup',release);app.stage.on('pointerupoutside',release);
 const observer=new ResizeObserver(()=>{if(host.clientWidth){app.renderer.resize(host.clientWidth,560);background.width=host.clientWidth;app.stage.hitArea=new P.Rectangle(0,0,host.clientWidth,560);fit();}});observer.observe(host);fit();
 cleanup=()=>{observer.disconnect();app.destroy(true,{children:true,texture:false,baseTexture:false});art.destroy();};
}
export type FarmFeedback=Readonly<{kind:FarmArt|'notice';label:string}>;
export function playFarmFeedback(root:Document,events:readonly FarmFeedback[]):void {
 const layer=root.querySelector<HTMLElement>('.farm-effect-layer,.farm-room-feedback');if(!layer||!events.length)return;
 const topic=events.find(e=>e.kind!=='notice')?.kind;
 layer.innerHTML=layer.classList.contains('farm-effect-layer')&&topic&&topic!=='notice'?farmEventArt(topic):'';
 const text=root.createElement('span');text.textContent=events.map(e=>e.label).join('；');layer.append(text);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)layer.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,fill:'both'});
}
