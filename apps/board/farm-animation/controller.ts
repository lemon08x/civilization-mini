import {farmArt} from './scene.js';
import {type FarmGame,selectedFarmPlot,selectFarmPlot,selectFarmPanel,type FarmPanel} from '../farm-view.js';
let cleanup=()=>{};
let zoom=1.55,pan={x:0,y:0};
export function bindFarmScene(root:Document,g:FarmGame,rerender:()=>void):void {
 cleanup();cleanup=()=>{};
 const host=root.getElementById('farm-map'),map=g.economy?.farm;if(!host||!map)return;
 const select=(id:string)=>{selectFarmPlot(id);if(map.plots.find(p=>p.id===id)?.kind==='home')selectFarmPanel('home');rerender();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-panel]').forEach(b=>b.onclick=()=>{selectFarmPanel(b.dataset.farmPanel as FarmPanel);rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-jump]').forEach(b=>b.onclick=()=>select(b.dataset.farmJump!));
 const picker=root.getElementById('farm-plot-select') as HTMLSelectElement;if(picker)picker.onchange=()=>select(picker.value);
 const P=(window as unknown as {PIXI:typeof import('pixi.js-legacy')}).PIXI;
 if(!P){host.textContent='地图加载失败，请刷新。仍可使用右侧地块选择器进行操作。';return;}
 const app=new P.Application({width:Math.max(1,host.clientWidth),height:560,backgroundAlpha:0,antialias:true,resolution:Math.min(devicePixelRatio,2),autoDensity:true,autoStart:false});
 const canvas=app.view as HTMLCanvasElement;canvas.setAttribute('aria-label','田地与探索地图；也可用右侧选择器操作');host.replaceChildren(canvas);
 const art=farmArt(P),world=new P.Container(),floor=new P.Container(),items=new P.Container();items.sortableChildren=true;world.addChild(floor,items);app.stage.addChild(world);
 const xy=(x:number,y:number)=>({x:(x-y)*36,y:(x+y)*18});
 const selected=selectedFarmPlot();let drag:null|{x:number;y:number;px:number;py:number;moved:boolean}=null;
 const tap=(id:string)=>{if(!drag?.moved)select(id);};
 for(const p of [...map.plots].sort((a,b)=>a.x+a.y-b.x-b.y)){
  const pos=xy(p.x,p.y),fog=p.kind==='unknown',field=p.kind==='field';
  const tile=new P.Graphics();tile.position.set(pos.x,pos.y);tile.beginFill(fog?0xc3cebd:field?0xa58c5d:[0xb5ca95,0xbbcf9e,0xb9cd99][(p.x+p.y)%3]).drawPolygon([0,0,36,18,0,36,-36,18]).endFill();
  tile.lineStyle(p.id===selected?2.5:1,p.id===selected?0xfff1b7:0x7b916e,p.id===selected?1:.28).drawPolygon([0,0,36,18,0,36,-36,18]);
  if(field)for(let r=0;r<4;r++)tile.lineStyle(2,0x806d46,.6).moveTo(-22+r*5,13+r*5).lineTo(3+r*5,25+r*5);
  if(p.kind==='wild')for(let k=0;k<5;k++){const x=(p.x*13+k*19)%35-17,y=14+(p.y*7+k*9)%9;tile.lineStyle(1,0x879e66,.65).moveTo(x-2,y-3).lineTo(x,y).lineTo(x+2,y-4);}
  tile.eventMode='static';tile.cursor='pointer';tile.hitArea=new P.Polygon([0,0,36,18,0,36,-36,18]);tile.on('pointertap',()=>tap(p.id));floor.addChild(tile);
  if(fog){const label=new P.Text('?',{fontFamily:'Microsoft YaHei',fontSize:11,fill:0x71856d});label.anchor.set(.5);label.position.set(pos.x,pos.y+18);floor.addChild(label);}
  let sp:import('pixi.js-legacy').Sprite|undefined;
  if(p.kind==='tree')sp=art.sprite(art.treeTexture(),pos.x,pos.y+25,.5);
  if(field&&p.field?.crop)sp=art.sprite(art.cropTexture(p.field.crop,p.field.growth>=p.field.duration?2:p.field.growth>0?1:0),pos.x,pos.y+30,.85);
  if(sp){sp.zIndex=(p.x+p.y)*100+20;sp.eventMode='static';sp.cursor='pointer';sp.on('pointertap',()=>tap(p.id));items.addChild(sp);}
  if(p.kind==='home'){
   const house=new P.Graphics().beginFill(0xe3d9b9).drawRect(-15,-15,30,24).endFill().beginFill(0x6d7f6c).drawPolygon([-20,-15,0,-34,20,-15]).endFill().beginFill(0x807557).drawRect(-4,-3,8,12).endFill();
   house.position.set(pos.x,pos.y+15);house.zIndex=(p.x+p.y)*100+20;house.eventMode='static';house.cursor='pointer';house.on('pointertap',()=>tap(p.id));items.addChild(house);
  }
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
 const fit=()=>{world.scale.set(zoom);world.position.set(host.clientWidth/2+pan.x,105+pan.y);app.render();};
 root.querySelectorAll<HTMLButtonElement>('[data-farm-zoom]').forEach(b=>b.onclick=()=>{zoom=Math.min(2,Math.max(.4,zoom+Number(b.dataset.farmZoom)*.15));fit();});
 root.querySelector<HTMLButtonElement>('[data-farm-center]')!.onclick=()=>{const p=map.plots.find(p=>p.id===selected)!;const pos=xy(p.x,p.y);pan={x:-pos.x*zoom,y:170-pos.y*zoom};fit();};
 app.stage.eventMode='static';app.stage.hitArea=new P.Rectangle(0,0,host.clientWidth,560);
 app.stage.on('pointerdown',e=>{drag={x:e.global.x,y:e.global.y,px:pan.x,py:pan.y,moved:false};});
 app.stage.on('globalpointermove',e=>{if(!drag)return;const dx=e.global.x-drag.x,dy=e.global.y-drag.y;if(Math.abs(dx)+Math.abs(dy)>7)drag.moved=true;if(drag.moved){pan={x:drag.px+dx,y:drag.py+dy};fit();}});
 const release=()=>{setTimeout(()=>{drag=null;},0);};app.stage.on('pointerup',release);app.stage.on('pointerupoutside',release);
 const observer=new ResizeObserver(()=>{if(host.clientWidth){app.renderer.resize(host.clientWidth,560);app.stage.hitArea=new P.Rectangle(0,0,host.clientWidth,560);fit();}});observer.observe(host);fit();
 cleanup=()=>{observer.disconnect();app.destroy(true,{children:true,texture:false,baseTexture:false});art.destroy();};
}
export type FarmFeedback=Readonly<{kind:'sow'|'harvest'|'tend'|'notice';label:string}>;
export function playFarmFeedback(root:Document,events:readonly FarmFeedback[]):void {
 const layer=root.querySelector<HTMLElement>('.farm-effect-layer');if(!layer||!events.length)return;
 layer.textContent=events.map(e=>e.label).join('；');
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches)layer.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,fill:'both'});
}
