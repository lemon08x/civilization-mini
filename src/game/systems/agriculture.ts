import {landscapeDescription,LANDSCAPE_NAMES} from './landscapes.js';
import {discoveryText as FARM_EVENTS} from './narrative-adapter.js';
import {solarTermDay,solarYearAt,lunarDateAt} from './calendar.js';
import {cropBatches,sowBatch,harvestDates,planForField,farmScheduleView,advanceWildDay,farmLabor} from './farm-calendar.js';
import {draw} from './life.js';
import { activePerson, type GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import {FARM_DISCOVERIES,FARM_PROJECT_TECH,type FarmDiscovery} from '../model/economy.js';
import type { Crop, Worker, Field, FarmRules, FarmPlot, PlotLand } from '../model/economy.js';
import { CROPS, WORKER_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import { level, recordEvidence, requirements } from './knowledge.js';
import { branchHas, branchNeeds } from './branches.js';
import { made } from './shop.js';

export const WATER_NAMES=['干旱','偏干','适宜','过湿','积水'] as const;
export const SOIL_NAMES={sand:'沙质',loam:'壤质',clay:'黏质'};
export const IMPROVEMENT_NAMES={canal:'水渠',shelter:'护田林',drain:'排水沟',yard:'晒场',cellar:'种子窖',pit:'堆肥坑',shed:'窝棚',retting:'沤麻塘'};
export function revealLand(s:GameState,p:FarmPlot):void {
 if(p.land)return;
 p.land={soil:(['sand','loam','clay'] as const)[Math.floor(draw(s)*3)],elevation:Math.floor(draw(s)*3) as 0|1|2,water:2,dryDays:0,wetDays:0,drainDays:0};
}
/** Coverage excludes the origin; unknown cells never expose land properties. */
export function farmCoverage(p:FarmPlot,range:4|8|12|24=4){
 const radius=range>=12?2:1,out:{id:string;x:number;y:number}[]=[];
 for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
  if(!dx&&!dy||p.x+dx<0||p.y+dy<0)continue;
  if(range===4&&Math.abs(dx)+Math.abs(dy)!==1||range===12&&Math.abs(dx)+Math.abs(dy)>2)continue;
  out.push({id:plotId(p.x+dx,p.y+dy),x:p.x+dx,y:p.y+dy});
 }
 return out;
}
export function fieldPlot(s:GameState,f:Field){return Object.values(s.economy?.farm?.plots??{}).find(p=>plotField(s,p.id)===f);}
export function fieldWaterLevel(s:GameState,f:Field):number {
 const land=fieldPlot(s,f)?.land;
 return land?Math.min(4,land.water+Math.floor(f.moisture)):s.location.rain+f.moisture;
}
export function fieldNeedsWater(s:GameState,f:Field):boolean{return !!f.crop&&f.growth<f.duration&&fieldWaterLevel(s,f)<(CROPS[f.crop].waterNeed??2);}
export function irrigateField(s:GameState,f:Field):void {
 const land=fieldPlot(s,f)?.land;
 if(land){land.water=Math.max(land.water,f.crop?(CROPS[f.crop].waterNeed??2):2) as PlotLand['water'];land.dryDays=0;}
 else f.moisture+=equipped(s,'W01')?2:1;
}
export function drainOutlet(s:GameState,p:FarmPlot):boolean {
 if(!p.land)return false;
 const plots=s.economy!.farm!.plots,seen=new Set<string>(),queue=[p];
 while(queue.length){const at=queue.shift()!;if(seen.has(at.id))continue;seen.add(at.id);
  // The west/north map edge is the explicit downstream boundary.
  if(at.x===0||at.y===0)return true;
  for(const n of farmNeighbors(at)){const next=plots[n.id];if(!next?.land||next.kind==='unknown')continue;
   if(next.land.elevation<at.land!.elevation)return true;
   if(next.improvement==='drain'&&next.land.elevation===at.land!.elevation)queue.push(next);
  }
 }
 return false;
}
/** Connected canal set: springs are sources; a canal carries water when an orthogonally
 *  adjacent connected plot is at equal or higher elevation (the chain never ascends). */
function connectedCanalIds(s:GameState):Set<string>{
 const plots=s.economy?.farm?.plots??{},connected=new Set<string>(),queue:FarmPlot[]=[];
 for(const p of Object.values(plots))if(p.kind==='water'){connected.add(p.id);queue.push(p);}
 while(queue.length){const at=queue.shift()!;
  for(const n of farmNeighbors(at)){const next=plots[n.id];
   if(!next||connected.has(next.id)||next.improvement!=='canal'||!next.land||!at.land)continue;
   if(next.land.elevation<=at.land.elevation){connected.add(next.id);queue.push(next);}
  }
 }
 return connected;
}
export function waterConnected(s:GameState,p:FarmPlot):boolean{
 if(p.kind==='water')return true;
 if(p.improvement!=='canal')return false;
 return connectedCanalIds(s).has(p.id);
}
/** Water reaches this plot: it is a spring itself or sits next to a connected one. */
export function waterAccess(s:GameState,p:FarmPlot):boolean{
 if(p.kind==='water')return true;
 const plots=s.economy?.farm?.plots??{};
 return farmNeighbors(p).some(n=>{const q=plots[n.id];return !!q&&waterConnected(s,q)&&!!q.land&&!!p.land&&q.land.elevation>=p.land.elevation;});
}
export function landView(s:GameState,p:FarmPlot){
 if(!p.land)return undefined;
 const r=s.economy!.farm!.rules,l=p.land;
 const covered=farmNeighbors(p).some(n=>s.economy!.farm!.plots[n.id]?.improvement==='shelter');
 return {areaM2:400,soil:SOIL_NAMES[l.soil],elevation:['低','平','高'][l.elevation],water:l.water,waterName:WATER_NAMES[l.water],retention:{sand:'小',loam:'中',clay:'大'}[l.soil],drainage:{sand:'强',loam:'中',clay:'弱'}[l.soil],dryDays:l.dryDays,wetDays:l.wetDays,dryingDays:({sand:r.sandDryDays,loam:r.loamDryDays,clay:r.clayDryDays}[l.soil]+(covered?r.shelterDays:0)),...(l.paddy?{paddy:true}:{})};
}
/** Daily ticks use absolute calendar boundaries, independent of action chunking. */
function advanceLandDay(s:GameState):void {
 const farm=s.economy?.farm;if(!farm)return;
 const r=farm.rules,plots=Object.values(farm.plots).sort((a,b)=>a.id.localeCompare(b.id));
 for(const p of plots){const l=p.land;if(!l)continue;
  // Paddy fields stay flooded; weather neither dries nor waterlogs them.
  if(l.paddy){l.water=3;l.dryDays=0;l.wetDays=0;l.drainDays=0;continue;}
  const wet=s.location.weather==='wet';
  if(wet){l.dryDays=0;l.drainDays=0;l.wetDays++;
   if(l.wetDays>=r.rainRiseDays){l.water=Math.min(4,l.water+1) as PlotLand['water'];l.wetDays=0;}
  }else{
   l.wetDays=0;
   if(l.water>2){l.dryDays=0;l.drainDays++;
    // A neighboring drain with a downhill outlet passively speeds up drying by one day.
    const drained=farmNeighbors(p).some(n=>{const q=farm.plots[n.id];return q?.improvement==='drain'&&drainOutlet(s,q);});
    const duration=Math.max(1,(l.soil==='sand'?1:l.soil==='loam'?2:3)-(drained?1:0));
    if(l.drainDays>=duration){l.water=(l.water-1) as PlotLand['water'];l.drainDays=0;}
   }else{l.drainDays=0;l.dryDays++;
    const shelter=farmNeighbors(p).some(n=>farm.plots[n.id]?.improvement==='shelter');
    const duration=({sand:r.sandDryDays,loam:r.loamDryDays,clay:r.clayDryDays}[l.soil]+(shelter?r.shelterDays:0))*(s.location.weather==='normal'?2:1);
    if(l.dryDays>=duration){l.water=Math.max(0,l.water-1) as PlotLand['water'];l.dryDays=0;}
   }
  }
 }
}

/** Orthogonal neighbors hold this improvement (yard/cellar adjacency checks). */
function neighborImprovement(s:GameState,p:FarmPlot,kind:FarmPlot['improvement']):boolean{
 const plots=s.economy?.farm?.plots??{};
 return farmNeighbors(p).some(n=>plots[n.id]?.improvement===kind);
}
/** Chebyshev range ≤2 from any shed plot; used to halve base farm-work time. */
export function shedCovers(s:GameState,plot:FarmPlot):boolean{
 return Object.values(s.economy?.farm?.plots??{}).some(q=>q.improvement==='shed'&&Math.max(Math.abs(q.x-plot.x),Math.abs(q.y-plot.y))<=2);
}
/** Compost pits whose conversion finished by the given absolute day rot into compost. */
export function pitReadyCheck(s:GameState,events:GameEvent[],day?:number):void{
 const farm=s.economy?.farm;if(!farm)return;
 const now=day??s.life?.calendar?.absoluteDay??0;
 for(const p of Object.values(farm.plots)){
  if(!p.pit||p.pit.readyDay>now)continue;
  delete p.pit;
  changeGoods(s,{compost:2},1,events,'堆肥坑腐熟');
  events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${p.id} · 堆肥坑腐熟：秸秆经${farm.rules.pitConvertDays}天转化，得2份堆肥，可继续投料。`});
 }
}
export function fieldYield(s: GameState,f:Field=s.economy!.field): number {
  if (!f.crop) return 0;
  if(s.life?.calendar&&s.economy?.farm&&f.batch){
    const now=s.life.calendar.absoluteDay,d=harvestDates(s,fieldPlot(s,f),f);
    const late=now<d.bestEnd?1:Math.max(0,1-(Math.floor(now)-d.bestEnd+1)/s.economy.farm.rules.harvestLateDays);
    const potential=CROPS[f.crop].yield+f.bonus+(f===s.economy.field?(s.economy.modern?.cropBonus??0):0)+Math.min(1,f.fertility);
    return Math.max(0,Math.floor((potential*f.batch.lateFactor-f.stress)*late));
  }
  const grace=s.life?.calendar?.rules.harvestGraceDays??1;
  const plot=fieldPlot(s,f);
  const late = plot&&neighborImprovement(s,plot,'yard')?0:Math.floor(Math.max(0, f.growth - f.duration - (equipped(s, 'U04') ? grace : 0))/grace)*(CROPS[f.crop].lateRate??1);
  return Math.max(1, Math.floor(CROPS[f.crop].yield + f.bonus + (f===s.economy!.field?(s.economy!.modern?.cropBonus ?? 0):0) + Math.min(1, f.fertility) - f.stress - late));
}
export function farmBlocker(s: GameState, crop: Crop, worker?: Worker,f:Field=s.economy!.field,heritage=false): string[] {
  const land=fieldPlot(s,f);
  if(land?.kind==='field'&&land.purpose!=='sowing')return ['此地为其他用途，请先改为播种用途'];
  if (s.economy!.branches) {
    if (crop === 'wheat' && !branchHas(s, 'A0') && !worker) return branchNeeds(s,['A0']);
    if ((crop === 'soy' || crop === 'flax') && !branchHas(s, 'A4')) return branchNeeds(s,['A4']);
    if (crop === 'rice') {
      if (!branchHas(s, 'A12')) return branchNeeds(s,['A12']);
      if (!fieldPlot(s, f)?.land?.paddy) return ['需把邻水的田改造为水田'];
    }
    if (crop === 'millet' && !branchHas(s, 'A13')) return branchNeeds(s,['A13']);
    if (crop === 'adzuki' && !branchHas(s, 'A14')) return branchNeeds(s,['A14']);
    if ((crop === 'mallow' || crop === 'mustard') && !branchHas(s, 'A15')) return branchNeeds(s,['A15']);
  }
  if (!f.crop) {
    const plot=fieldPlot(s,f);if(plot?.project&&plot.project.done<plot.project.total)return ['工程进行中，不能播种'];
    if(fieldPlot(s, f)?.land?.paddy && !CROPS[crop].floodTolerant) return ['水田只能种水稻等耐涝作物'];
    if(s.life?.calendar&&!sowBatch(s,crop))return ['不在节气播种窗口，请查看年度农时'];
    if (worker?.kind === 'laborer' && worker.experience < 8) return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker ? [] : requirements(s, { agronomy: CROPS[crop].level })), ...(heritage?(s.economy!.farm!.rareSeeds<1?['没有异穗麦种']:[]):missingGoods(s, { [CROPS[crop].seed]: 1 }))];
  }
  if (f.growth >= f.duration) return [];
  if (!s.life?.calendar&&f.tended === s.clock.absoluteTurn) return ['本季已管理田间'];
  if (!fieldNeedsWater(s,f)) return ['当前水分充足，等待作物生长'];
  if (s.location.water < 1) return ['公共水不足'];
  return [];
}
export function farmWork(s: GameState, crop: Crop, events: GameEvent[], worker?: Worker,f:Field=s.economy!.field,heritage=false): void {
  const e = s.economy!, actor = worker ? WORKER_NAMES[worker.kind] : '本人';
  if (!f.crop) {
    if (worker?.kind === 'farmer' && e.operations?.farm && f.fertility < 2 && amount(s, 'compost') > 0) {
      changeGoods(s, { compost: 1 }, -1, events, '农工托管施肥');
      f.fertility = Math.min(3, f.fertility + 1);
    }
    if (e.modern&&f===e.field) e.modern.cropBonus = 0;
    const c = CROPS[crop];
    const batch=s.life?.calendar&&e.farm?sowBatch(s,crop):undefined;
    if(s.life?.calendar&&e.farm&&!batch)throw new Error('已错过播种窗口');
    const nursery=equipped(s,'U10');
    if(heritage)e.farm!.rareSeeds--;else changeGoods(s, { [c.seed]: 1 }, -1, events, actor + '播种');
    let bonus = worker && worker.experience >= 8 ? 1 : 0;
    for (const id of (e.shop ? ['U01'] : ['U01', 'U02'])) if (equipped(s, id)) { bonus++; consumeEquipment(s, id, events); }
    if (e.shop && equipped(s, 'U02') && e.shop.seededTurn !== s.clock.absoluteTurn) {
      e.shop.seededTurn = s.clock.absoluteTurn;
      consumeEquipment(s, 'U02', events);
    }
    if ((e.branches?branchHas(s,'A5'):level(s, 'agronomy') >= 6) && f.lastCrop && f.lastCrop !== crop) bonus++;
    let duration = c.duration;
    if (equipped(s, 'U10')) { duration = Math.max(1, duration - (s.life?.calendar?.rules.daysPerWeek??1)); consumeEquipment(s, 'U10', events); }
    if(heritage){bonus+=e.farm!.rules.rareBonus;f.variety='heritage';}else delete f.variety;
    if(batch){
      const now=s.life!.calendar!.absoluteDay,mature=batch.mature-(nursery?e.farm!.rules.nurseryDays:0);
      duration=mature-now;
      f.batch={id:batch.id,year:batch.year,sownDay:now,matureDay:mature,lateFactor:Math.max(0,1-Math.max(0,Math.floor(now)-batch.bestEnd+1)*e.farm!.rules.lateSowPercent/100)};
      const plan=fieldPlot(s,f)?.plans?.find(p=>p.batchId===batch.id&&p.year===batch.year&&!p.sown);if(plan)plan.sown=true;
    }
    Object.assign(f, { crop, planted: s.clock.absoluteTurn, moisture: 0, growth: 0, stress: 0, tended: 0, composted: false, bonus, duration });
    events.push({ type: 'economy-farm', operation: 'sow', crop, actor, amount: 0 });
  } else if (f.growth >= f.duration) {
    const c = CROPS[f.crop], n = fieldYield(s,f), out: Record<string, number> = { [f.crop]: n, straw: c.straw, [c.seed]: 1 };
    if(f.variety==='heritage'){delete out[c.seed];e.farm!.rareSeeds++;}else if (e.branches?branchHas(s,'A6'):level(s, 'agronomy') >= 5) out[c.seed]++;
    const harvestPlot=fieldPlot(s,f);
    if(harvestPlot&&neighborImprovement(s,harvestPlot,'cellar')){
      if(f.variety==='heritage')e.farm!.rareSeeds++;else out[c.seed]++;
    }
    const plan=planForField(harvestPlot,f);if(plan)plan.harvested=true;
    changeGoods(s, out, 1, events, actor + '收获');
    made(s, f.crop);
    if (equipped(s, 'U04')) consumeEquipment(s, 'U04', events);
    events.push({ type: 'economy-farm', operation: 'harvest', crop: f.crop, actor, amount: n });
    f.fertility = Math.max(0, Math.min(3, f.fertility + (CROPS[f.crop].legume ? 1 : -1)));
    f.lastCrop = f.crop;
    f.crop = null;delete f.variety;delete f.batch;
  } else {
    s.location.water--;
    irrigateField(s,f);
    if (equipped(s, 'W01')) consumeEquipment(s, 'W01', events);
    f.tended = s.clock.absoluteTurn;
    events.push({ type: 'economy-farm', operation: 'tend', crop: f.crop, actor, amount: 1 });
  }
  if (!worker) recordEvidence(s, 'agronomy', events, '田间实践');
}
export function cookMeal(s:GameState,recipe:import('../model/economy.js').CookingRecipe,events:GameEvent[]):void{
 changeGoods(s,recipe.inputs,-1,events,'烹饪'+recipe.name);
 if(s.life?.calendar){s.life.calendar.mealDays=recipe.food;events.push({type:'life',personId:s.household.activePersonId,operation:'cooking',detail:`享用${recipe.name}，未来${recipe.food}天主动放松时每日额外降低${s.life.calendar.rules.mealRecovery}压力；每天另按饮食安排现做现吃。`});return;}
 s.household.food+=recipe.food;
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`做成${recipe.name}，备下${recipe.food}份即食口粮。`});
}
export const HOME_PLOT='p2q2';
export const plotId=(x:number,y:number)=>`p${x}q${y}`;
export function blankField():Field{return {crop:null,planted:0,moisture:0,growth:0,stress:0,fertility:2,lastCrop:null,tended:0,composted:false,bonus:0,duration:2};}
export function plotField(s:GameState,id:string):Field|undefined{return id===HOME_PLOT?s.economy!.field:s.economy?.farm?.plots[id]?.field;}
export function farmNeighbors(p:FarmPlot){return [[p.x-1,p.y],[p.x+1,p.y],[p.x,p.y-1],[p.x,p.y+1]].filter(([x,y])=>x>=0&&y>=0).map(([x,y])=>({id:plotId(x,y),x,y}));}
export function extendFarm(s:GameState,p:FarmPlot):void{const plots=s.economy!.farm!.plots;for(const n of farmNeighbors(p))plots[n.id]??={...n,kind:'unknown'};}
export function initializeFarm(s:GameState,rules:FarmRules):void{
 const plots:Record<string,FarmPlot>={};
 for(let y=1;y<=4;y++)for(let x=1;x<=5;x++){const id=plotId(x,y);plots[id]={id,x,y,kind:x<=3?'wild':'unknown'};}
 plots[HOME_PLOT].kind='field';
 plots[HOME_PLOT].purpose='sowing';
 for(const p of Object.values(plots))if(p.kind!=='unknown')revealLand(s,p);
 plots[HOME_PLOT].land!.soil='loam';plots[HOME_PLOT].land!.elevation=1;plots.p1q2.land!.elevation=2;
 for(const [id,key] of [['p1q2','spring'],['p3q2','fallow'],['p2q3','woodland']] as const){plots[id].kind='story';plots[id].discovery={id:key,resolved:false,outcome:''};}

 s.economy!.farm={calendarVersion:1,explorationVersion:3,landVersion:2,rareSeeds:0,rules:structuredClone(rules),plots,discovered:['wheat'],explored:0,neighbor:{personId:s.sect!.current[1],goods:{seedSoy:rules.neighborStock,seedFlax:rules.neighborStock,seedMallow:rules.neighborStock,seedRice:rules.neighborStock,wheat:0},field:{...blankField(),crop:'soy',duration:CROPS.soy.duration},talked:-1,traded:-1,helped:-1,busy:false}};
 for(const p of Object.values(plots))if(p.kind!=='unknown')extendFarm(s,p);
 s.economy!.goods.seedSoy=0;s.economy!.goods.seedFlax=0;
 const id=s.sect!.current[1];s.economy!.branches!.learned[id]=['A0','A4'];s.persons[id].practices.push('technology:A0','technology:A4');
}
export function farmView(s:GameState){
 const f=s.economy?.farm;if(!f)return undefined;
 const id=s.sect!.current[1],v=s.persons[id].vitality!,trust=activePerson(s).vitality?.experiences?.relationships[id]??0;
 return {otherUseUnlocked:otherFarmUseUnlocked(s),construction:Object.entries(FARM_PROJECT_TECH).map(([kind,technology])=>({kind,technology,unlocked:branchHas(s,technology)})),schedule:farmScheduleView(s),techniques:{rotation:branchHas(s,'A5'),seedSelection:branchHas(s,'A6'),scouting:branchHas(s,'A11'),paddy:branchHas(s,'A12'),dryland:branchHas(s,'A13'),relay:branchHas(s,'A14'),garden:branchHas(s,'A15'),nursery:equipped(s,'U10'),drainage:equipped(s,'U08'),harvestTools:equipped(s,'U04')},homeId:HOME_PLOT,rareSeeds:f.rareSeeds,discovered:[...f.discovered],plots:Object.values(f.plots).map(p=>{const field=plotField(s,p.id);return {...(p.landscape?{landscape:{...p.landscape,name:LANDSCAPE_NAMES[p.landscape.kind],description:landscapeDescription(s,p)}}:{}),id:p.id,x:p.x,y:p.y,kind:p.kind,purpose:p.purpose,...(p.kind==='field'&&p.purpose==='sowing'?{labor:{sow:farmLabor(s,p,'farmplot','wheat','sow'),harvest:farmLabor(s,p,'farmplot','wheat','harvest')}}:{}),category:p.kind==='field'?'production' as const:'wilderness' as const,land:landView(s,p),plans:structuredClone(p.plans??[]),...(p.wild?{wild:{kind:p.wild.kind,stock:p.wild.stock,expires:p.wild.expires,expiresDate:p.wild.stock?lunarDateAt(s.life!.calendar!.rules.referenceYear,p.wild.expires).date:null,nextSeason:p.wild.kind==='yam'?'霜降至次年立春':null}}:{}),...(p.kind==='field'&&field?{field:{...field},harvest:fieldYield(s,field),maturity:field.crop?maturityView(s,field):null}:{}),...(p.kind==='unknown'?{reachable:farmNeighbors(p).some(n=>f.plots[n.id]&&f.plots[n.id].kind!=='unknown')}:{}),...(p.project?{project:{...p.project,name:FARM_PROJECT_NAMES[p.project.kind],stage:p.project.done<p.project.total/2?'整备':'施工',remaining:p.project.total-p.project.done}}:{}),...(p.improvement?{improvement:p.improvement}:{}),...(p.pit?{pit:{readyDay:p.pit.readyDay,remainingDays:Math.max(0,Math.ceil(p.pit.readyDay-(s.life?.calendar?.absoluteDay??0)))}}:{}),...(p.kind==='water'||p.improvement==='canal'?{waterConnected:waterConnected(s,p)}:{}),waterAccess:waterAccess(s,p),...(p.discovery?{discovery:{...p.discovery,...FARM_EVENTS[p.discovery.id]}}:{}),...(p.fertility!==undefined?{fertility:p.fertility}:{})};}),neighbor:{id,title:v.sex==='female'?'师姐':'师兄',name:s.persons[id].name,alive:v.alive,trust,busy:f.neighbor.busy,offers:{seedSoy:f.neighbor.goods.seedSoy??0,seedFlax:f.neighbor.goods.seedFlax??0,seedMallow:f.neighbor.goods.seedMallow??0,...(isCanalBuilt(s)?{seedRice:f.neighbor.goods.seedRice??0}:{})},description:'独立同门，不可切换控制；自己的田地与物资独立结算'},rules:{...f.rules}};
}
export function growField(s:GameState,f:Field,events:GameEvent[],id:string):void{
 if(!f.crop)return;
 const c=CROPS[f.crop],need=c.waterNeed??2;
 if(f.growth<f.duration){
  if(s.location.rain+f.moisture<need)f.stress++;
  if(s.location.rain>=3&&!c.floodTolerant){if(equipped(s,'U08'))consumeEquipment(s,'U08',events);else f.stress++;}
  f.moisture=0;
 }
 f.growth++;
 events.push({type:'life',personId:s.household.activePersonId,operation:'field-growth',detail:`${id} ${CROPS[f.crop].name}生长${f.growth}/${f.duration}，缺水/涝害累计${f.stress}`});
}

/** Neighbor spends private labor and keeps produce in a separate store. */
export function settleNeighbor(s:GameState):void{
 const n=s.economy?.farm?.neighbor;if(!n)return;
 const v=s.persons[n.personId].vitality!,m=s.sect!.members[n.personId],f=n.field;
 if(!v.alive)return;
 n.busy=f.growth>=f.duration;
 if(m.time>=2){
  m.time-=2;v.pressure+=2;
  if(f.crop&&f.growth>=f.duration){const crop=f.crop;n.goods[crop]=(n.goods[crop]??0)+Math.max(1,CROPS[crop].yield-f.stress);n.goods[CROPS[crop].seed]=(n.goods[CROPS[crop].seed]??0)+2;f.crop=crop==='soy'?'flax':'soy';f.growth=0;f.stress=0;f.duration=CROPS[f.crop].duration;}
  else {f.moisture=2;}
 }
 if(f.crop&&!s.life?.calendar){if(s.location.rain+f.moisture<2)f.stress++;f.growth++;f.moisture=0;}
}

/** Fictional vignettes inspired by traditional farming and rural literature. */

export function exploreFarm(s:GameState,id:string,events:GameEvent[]):void{
 const farm=s.economy!.farm!,p=farm.plots[id];
 revealLand(s,p);
 const key:FarmDiscovery=id==='p4q1'?'mushroom':id==='p4q2'?'yam':FARM_DISCOVERIES[Math.min(FARM_DISCOVERIES.length-1,Math.floor(draw(s)*FARM_DISCOVERIES.length))];
 p.kind=key==='oldtree'?'tree':key==='boulder'?'rock':key==='brambles'?'brush':['meadow','mushroom','yam'].includes(key)?'wild':'story';
 p.discovery={id:key,resolved:['meadow','oldtree','boulder','mushroom','yam'].includes(key),outcome:''};
 if(key==='mushroom'||key==='yam'){
  const c=s.life!.calendar!,year=solarYearAt(c.rules.referenceYear,c.absoluteDay),frost=solarTermDay(c.rules.referenceYear,year,'霜降');
  const harvestYear=c.absoluteDay<frost?year-1:year;
  const expiry=solarTermDay(c.rules.referenceYear,harvestYear+1,'立春');
  p.wild={kind:key,stock:key==='yam'&&c.absoluteDay<expiry?farm.rules.yamYield:0,year:key==='yam'?harvestYear:year,bursts:0,wetDays:0,lastSpawn:-farm.rules.mushroomIntervalDays,expires:key==='yam'?expiry:0};
 }
 farm.explored++;extendFarm(s,p);
 events.push({type:'story-fact',topic:'place.discovered',subjectId:id,actorId:s.household.activePersonId,values:{discovery:key}});
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${id} · ${FARM_EVENTS[key].title}：${FARM_EVENTS[key].text}`});
}
export function discoverFarmSeed(s:GameState,events:GameEvent[]):string{
 const f=s.economy!.farm!,crop=(['soy','flax','millet','adzuki','mustard'] as const).find(c=>!f.discovered.includes(c));
 const gate:Record<string,string>={soy:'A4',flax:'A4',millet:'A13',adzuki:'A14',mustard:'A15'};
 if(crop){f.discovered.push(crop);changeGoods(s,{[CROPS[crop].seed]:f.rules.discoverySeeds},1,events,'辨认乡野种子');return `辨认出${CROPS[crop].name}，获得${f.rules.discoverySeeds}份种子；需学会${gate[crop]}才能种植，集市开放补购。`;}
 f.rareSeeds++;return '选得1份异穗麦种，独立留种，收成比普通麦增加'+f.rules.rareBonus+'份；市场不出售。';
}
export function resolveFarmDiscovery(s:GameState,id:string,choice:string,events:GameEvent[]):void{
 const f=s.economy!.farm!,p=f.plots[id],d=p.discovery!;let outcome='';
 if(choice==='clear'){p.kind='wild';outcome='清除了荆棘，露出可开垦的土层。';}
 if(choice==='identify'){p.kind='wild';if(d.id==='heritage'){f.rareSeeds++;outcome=`选留1份异穗麦种，收成增加${f.rules.rareBonus}份；可反复种植并留种。`;}else outcome=discoverFarmSeed(s,events);}
 if(choice==='dredge'&&d.id==='spring'){p.kind='water';outcome='疏浚泉眼，活水长流。此格成为永久水源，不可开垦；可从同高或更低的相邻格修渠引水。';}
 if(choice==='fill'&&d.id==='spring'){p.kind='wild';outcome='填平溪涧，整成普通荒地；不获得水源。';}
 if(choice==='share'){changeGoods(s,{seedWheat:f.rules.discoverySeeds},1,events,'行旅回赠');p.kind='wild';outcome=`分出${f.rules.storyFood}份口粮。旅人讲起沿河选种的见闻，回赠${f.rules.discoverySeeds}份麦种。`;}
 if(choice==='preserve'){p.kind='rock';p.landscape={kind:'landmark',level:1,builtBy:s.household.activePersonId,uses:0};outcome='记下旧界，保留为地标。此格不再开垦，可继续探索周边。';}
 if(choice==='leave'){p.kind='wild';if(d.id==='fallow')p.fertility=0;outcome='告别这段见闻，将可耕地记为普通荒地；不获得事件奖励。';}
 if(d.id==='shrine')events.push({type:'story-fact',topic:choice==='preserve'?'landmark.preserved':'landmark.reclaimed',subjectId:id,actorId:s.household.activePersonId,values:{}});
 d.resolved=true;d.outcome=outcome;
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${id} · ${FARM_EVENTS[d.id].title}：${outcome}`});
}

export function sowingSeasons(crop:Crop):number[]{return crop==='wheat'?[0,2]:['soy','rice','millet','adzuki'].includes(crop)?[0,1]:['mallow','mustard'].includes(crop)?[2,3]:[0];}
export function maturityView(s:GameState,f:Field){
 const c=s.life!.calendar!,days=Math.max(0,f.duration-f.growth);
 const crop=f.crop?CROPS[f.crop]:null;
 const dates=harvestDates(s,fieldPlot(s,f),f);
 return {...dates,bestEndDate:lunarDateAt(c.rules.referenceYear,dates.bestEnd).date,deadlineDate:lunarDateAt(c.rules.referenceYear,dates.deadline).date,days,date:lunarDateAt(c.rules.referenceYear,c.absoluteDay+days).date,...(crop?{waterNeed:crop.waterNeed??2,...(crop.floodTolerant?{floodTolerant:true}:{}),lateRisk:'正常期结束后逐日减产，宽限后绝收'}:{})};
}
export function advanceFields(s:GameState,days:number,events?:GameEvent[]):string[]{
 const ripe:string[]=[],start=s.life!.calendar!.absoluteDay;
 for(const p of Object.values(s.economy?.farm?.plots??{})){
  for(const plan of p.plans??[]){if(!plan.sown&&!plan.failed&&start+days>=cropBatches(s,plan.year).find(b=>b.id===plan.batchId)!.end){plan.failed=true;plan.failureReason="错过播种窗口";events?.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:p.id+' 年度计划错过播种窗口。'});}}
  const f=plotField(s,p.id);if(!f)continue;
  // Legacy equipment may still deliver discrete doses through moisture; consume once.
  if(p.land&&f.moisture>0){p.land.water=Math.min(4,p.land.water+Math.floor(f.moisture)) as PlotLand['water'];p.land.dryDays=0;f.moisture=0;}
  if(!f.crop)continue;
  const before=f.growth;f.growth=Math.round((f.growth+days)*100)/100;
  if(before<f.duration){
   const exposure=Math.min(days,f.duration-before)/s.life!.calendar!.rules.businessCycleDays;
   const c=CROPS[f.crop],need=c.waterNeed??2,water=p.land!.water;
   if(water<need)f.stress+=exposure*(need-water)/need;
   if(water>2&&!c.floodTolerant&&!equipped(s,'U08'))f.stress+=exposure*(water-2)/2;
   if(f.growth>=f.duration)ripe.push(p.id+' '+CROPS[f.crop].name);
  }
  if(f.batch&&start+days>=harvestDates(s,p,f).deadline){
    const plan=planForField(p,f);if(plan){plan.failed=true;plan.failureReason="错过收获宽限期";}f.failureReason="错过收获宽限期";
    const name=CROPS[f.crop].name;f.lastCrop=f.crop;f.fertility=Math.max(0,f.fertility-1);f.crop=null;delete f.batch;delete f.variety;
    events?.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:p.id+' '+name+'错过收获宽限期，绝收；无产品或留种。'});
  }
 }
 for(let day=Math.floor(start)+1;day<=Math.floor(start+days);day++){advanceLandDay(s);advanceWildDay(s,day,events??[]);}
 // Pits rot on the post-advance date, matching the calendar boundary crossed above.
 if(events)pitReadyCheck(s,events,start+days);
 const neighbor=s.economy?.farm?.neighbor.field;if(neighbor?.crop)neighbor.growth=Math.round((neighbor.growth+days)*100)/100;
 return ripe;
}

export const FARM_PROJECT_NAMES={canal:'水渠修建',restore:'荒田整治',timber:'采木整地',clearwood:'清林建田',shelter:'护田林营造',paddy:'水田改造',drain:'排水沟开挖',yard:'晒场铺设',cellar:'种子窖砌建',pit:'堆肥坑开挖',shed:'窝棚搭建',retting:'沤麻塘开挖'};
export function workFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,days:number,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 startFarmProject(s,id,kind,total,events);
 if(!p.project)return;
 p.project.done=Math.min(p.project.total,p.project.done+days);
 const complete=p.project.done>=p.project.total;
 let detail=`${FARM_PROJECT_NAMES[kind]} ${p.project.done}/${p.project.total}天`;
 if(complete){
  if(kind==='canal'||kind==='shelter'||kind==='drain'){
   if(kind==='shelter')p.kind='rock';
   p.improvement=kind;
   detail+='；'+(kind==='canal'?'沿高程不升的渠链通水，相邻田可开闸灌溉。':kind==='drain'?'有低位出口时，相邻田过湿退档快一天。':'正交四格失水变慢。');
  }
  else if(kind==='yard'||kind==='cellar'||kind==='pit'||kind==='shed'||kind==='retting'){
   p.improvement=kind;
   detail+='；'+({yard:'正交相邻田正常收获期延长7天，仍会绝收。',cellar:'正交相邻田收获额外留种1份，异穗麦额外留1份异穗麦种。',pit:'投料3份秸秆，腐熟转化后得2份堆肥。',shed:'两格内的田播种、浇水、收获的基础时间减半。',retting:'开放沤麻工序：2份亚麻茎跨季沤为1份亚麻纤维。'} as const)[kind];
  }
  else if(kind==='paddy'){if(p.land){p.land.paddy=true;p.land.water=3;p.land.dryDays=0;p.land.wetDays=0;p.land.drainDays=0;}detail+='；田块改为水田，每日保持蓄水，可播种水稻等耐涝作物。';}
  else if(kind==='timber'){changeGoods(s,{wood:farm.rules.timberYield},1,events,'林地采木');p.kind='wild';delete p.project;detail+='；木材入库，留下可开垦荒地。';}
  else {p.kind='field';p.purpose='sowing';p.field={...blankField(),fertility:kind==='restore'?3:2};detail+='；已整理为播种用途，可到农时安排页分配作物。';}
  if(p.discovery){p.discovery.resolved=true;p.discovery.outcome=detail;}
 }
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:id+' · '+detail});
}

export function isCanalBuilt(s:GameState):boolean{return Object.values(s.economy?.farm?.plots??{}).some(p=>p.improvement==='canal'&&waterConnected(s,p));}

export function otherFarmUseUnlocked(s:GameState):boolean {
 return Object.entries(FARM_PROJECT_TECH).some(([kind,technology])=>kind!=='paddy'&&branchHas(s,technology!));
}

export function startFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 if(p.project&&p.project.done<p.project.total)return;
 // Canals must extend from a spring or a connected canal; paddy needs the same reach.
 if((kind==='canal'||kind==='paddy')&&!waterAccess(s,p))return;
 delete p.wild;
 if(kind==='canal'||kind==='paddy'||kind==='drain')changeGoods(s,{wood:farm.rules.projectWood},-1,events,'水土工程备料');
 // Processing facilities: shed needs a single beam, the compost pit is dug bare-handed.
 if(kind==='yard'||kind==='cellar'||kind==='retting')changeGoods(s,{wood:farm.rules.projectWood},-1,events,'设施工程备料');
 if(kind==='shed')changeGoods(s,{wood:1},-1,events,'设施工程备料');
 p.project={kind,done:0,total};
}
