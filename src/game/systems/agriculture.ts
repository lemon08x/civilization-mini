import {seasonIndex,lunarDateAt} from './calendar.js';
import {draw} from './life.js';
import { activePerson, type GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import {FARM_DISCOVERIES,type FarmDiscovery} from '../model/economy.js';
import type { Crop, Worker, Field, FarmRules, FarmPlot, PlotLand } from '../model/economy.js';
import { CROPS, WORKER_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import { level, recordEvidence, requirements } from './knowledge.js';
import { branchHas } from './branches.js';
import { made } from './shop.js';

export const WATER_NAMES=['干旱','偏干','适宜','过湿','积水'] as const;
export const SOIL_NAMES={sand:'沙质',loam:'壤质',clay:'黏质'};
export const IMPROVEMENT_NAMES={canal:'水渠',shelter:'护田林',pond:'蓄水塘',drain:'排水沟'};
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
function serviceLimit(s:GameState,p:FarmPlot){const r=s.economy!.farm!.rules;return p.improvement==='canal'?r.canalDoses:p.improvement==='drain'?r.drainDoses:r.pondDoses;}
export function landView(s:GameState,p:FarmPlot){
 if(!p.land)return undefined;
 const r=s.economy!.farm!.rules,l=p.land;
 const covered=farmNeighbors(p).some(n=>s.economy!.farm!.plots[n.id]?.improvement==='shelter');
 return {areaM2:400,soil:SOIL_NAMES[l.soil],elevation:['低','平','高'][l.elevation],water:l.water,waterName:WATER_NAMES[l.water],retention:{sand:'小',loam:'中',clay:'大'}[l.soil],drainage:{sand:'强',loam:'中',clay:'弱'}[l.soil],dryDays:l.dryDays,wetDays:l.wetDays,dryingDays:({sand:r.sandDryDays,loam:r.loamDryDays,clay:r.clayDryDays}[l.soil]+(covered?r.shelterDays:0)),...(p.service?{service:{...p.service,capacity:r.pondCapacity,limit:serviceLimit(s,p),range:p.improvement==='pond'?8:4,storageName:p.service.stored===0?'空':p.service.stored<=r.pondCapacity/3?'少':p.service.stored<r.pondCapacity?'中':'满',outlet:p.improvement==='drain'?drainOutlet(s,p):undefined,nextCycleIn:r.waterCycleDays-(Math.floor(s.life!.calendar!.absoluteDay)%r.waterCycleDays)}}:{})};
}
/** Daily ticks use absolute calendar boundaries, independent of action chunking. */
function advanceLandDay(s:GameState,day:number):void {
 const farm=s.economy?.farm;if(!farm)return;
 const r=farm.rules,plots=Object.values(farm.plots).sort((a,b)=>a.id.localeCompare(b.id));
 for(const p of plots){const l=p.land;if(!l)continue;
  const wet=s.location.weather==='wet';
  if(wet){l.dryDays=0;l.drainDays=0;l.wetDays++;
   if(l.wetDays>=r.rainRiseDays){l.water=Math.min(4,l.water+1) as PlotLand['water'];l.wetDays=0;
    if(p.improvement==='pond'&&p.service)p.service.stored=Math.min(r.pondCapacity,p.service.stored+r.pondRainGain);
   }
  }else{
   l.wetDays=0;
   if(l.water>2){l.dryDays=0;l.drainDays++;const duration=l.soil==='sand'?1:l.soil==='loam'?2:3;
    if(l.drainDays>=duration){l.water=(l.water-1) as PlotLand['water'];l.drainDays=0;}
   }else{l.drainDays=0;l.dryDays++;
    const shelter=farmNeighbors(p).some(n=>farm.plots[n.id]?.improvement==='shelter');
    const duration=({sand:r.sandDryDays,loam:r.loamDryDays,clay:r.clayDryDays}[l.soil]+(shelter?r.shelterDays:0))*(s.location.weather==='normal'?2:1);
    if(l.dryDays>=duration){l.water=Math.max(0,l.water-1) as PlotLand['water'];l.dryDays=0;}
   }
  }
 }
 // Drain before irrigation. Each successful service spends one shared quota.
 for(const p of plots.filter(p=>p.service).sort((a,b)=>Number(b.improvement==='drain')-Number(a.improvement==='drain')||a.id.localeCompare(b.id))){
  const service=p.service!,cycle=Math.floor(day/r.waterCycleDays);
  if(service.cycle!==cycle){service.cycle=cycle;service.remaining=serviceLimit(s,p);}
  if(p.improvement==='drain'&&!drainOutlet(s,p))continue;
  const targets=farmCoverage(p,p.improvement==='pond'?8:4).map(n=>farm.plots[n.id]).filter(t=>t?.kind==='field'&&t.land);
  targets.sort((a,b)=>p.improvement==='drain'?b.land!.water-a.land!.water||a.id.localeCompare(b.id):a.land!.water-b.land!.water||a.id.localeCompare(b.id));
  for(const t of targets){if(service.remaining<=0)break;const f=plotField(s,t.id)!;
   if(p.improvement==='drain'){if(t.land!.water<=2||t.land!.elevation<p.land!.elevation)continue;t.land!.water=(t.land!.water-1) as PlotLand['water'];t.land!.drainDays=0;}
   else {if(!fieldNeedsWater(s,f))continue;
    if(p.improvement==='canal'){if(s.location.water<1||t.land!.elevation>p.land!.elevation)continue;s.location.water--;}
    else {if(service.stored<1)continue;service.stored--;}
    irrigateField(s,f);
   }
   service.remaining--;
  }
 }
}

export function fieldYield(s: GameState,f:Field=s.economy!.field): number {
  if (!f.crop) return 0;
  const grace=s.life?.calendar?.rules.harvestGraceDays??1;
  const late = Math.floor(Math.max(0, f.growth - f.duration - (equipped(s, 'U04') ? grace : 0))/grace)*(CROPS[f.crop].lateRate??1);
  return Math.max(1, Math.floor(CROPS[f.crop].yield + f.bonus + (f===s.economy!.field?(s.economy!.modern?.cropBonus ?? 0):0) + Math.min(1, f.fertility) - f.stress - late));
}
export function farmBlocker(s: GameState, crop: Crop, worker?: Worker,f:Field=s.economy!.field): string[] {
  if (s.economy!.branches) {
    if (crop === 'wheat' && !branchHas(s, 'A0') && !worker) return ['需掌握基础栽培'];
    if ((crop === 'soy' || crop === 'flax') && !branchHas(s, 'A4')) return ['需掌握油料与纤维作物'];
    if (crop === 'rice') {
      if (!branchHas(s, 'A12')) return ['需掌握水田稻作'];
      if (!fieldCanalAccess(s, f)) return ['需在相邻渠格的田块播种水稻'];
    }
    if (crop === 'millet' && !branchHas(s, 'A13')) return ['需掌握旱地谷物'];
    if (crop === 'adzuki' && !branchHas(s, 'A14')) return ['需掌握杂粮接茬'];
    if ((crop === 'mallow' || crop === 'mustard') && !branchHas(s, 'A15')) return ['需掌握园圃菜蔬'];
  }
  if (!f.crop) {
    if(s.life?.calendar&&!sowingSeasons(crop).includes(seasonIndex(s)))return ['不在播种季：'+sowingSeasons(crop).map(n=>['春','夏','秋','冬'][n]).join('、')];
    if (worker?.kind === 'laborer' && worker.experience < 8) return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker ? [] : requirements(s, { agronomy: CROPS[crop].level })), ...missingGoods(s, { [CROPS[crop].seed]: 1 })];
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
    Object.assign(f, { crop, planted: s.clock.absoluteTurn, moisture: 0, growth: 0, stress: 0, tended: 0, composted: false, bonus, duration });
    events.push({ type: 'economy-farm', operation: 'sow', crop, actor, amount: 0 });
  } else if (f.growth >= f.duration) {
    const c = CROPS[f.crop], n = fieldYield(s,f), out: Record<string, number> = { [f.crop]: n, straw: c.straw, [c.seed]: 1 };
    if(f.variety==='heritage'){delete out[c.seed];e.farm!.rareSeeds++;}else if (e.branches?branchHas(s,'A6'):level(s, 'agronomy') >= 5) out[c.seed]++;
    changeGoods(s, out, 1, events, actor + '收获');
    made(s, f.crop);
    if (equipped(s, 'U04')) consumeEquipment(s, 'U04', events);
    events.push({ type: 'economy-farm', operation: 'harvest', crop: f.crop, actor, amount: n });
    f.fertility = Math.max(0, Math.min(3, f.fertility + (CROPS[f.crop].legume ? 1 : -1)));
    f.lastCrop = f.crop;
    f.crop = null;delete f.variety;
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
 if(s.life?.calendar){s.life.calendar.mealDays=recipe.food;events.push({type:'life',personId:s.household.activePersonId,operation:'cooking',detail:`享用${recipe.name}，未来${recipe.food}天每日额外恢复${s.life.calendar.rules.mealRecovery}精力；每天另按饮食安排现做现吃。`});return;}
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
 for(const p of Object.values(plots))if(p.kind!=='unknown')revealLand(s,p);
 plots[HOME_PLOT].land!.soil='loam';plots[HOME_PLOT].land!.elevation=1;plots.p1q2.land!.elevation=2;
 for(const [id,key] of [['p1q2','canal'],['p3q2','fallow'],['p2q3','woodland']] as const){plots[id].kind='story';plots[id].discovery={id:key,resolved:false,outcome:''};}

 s.economy!.farm={explorationVersion:3,landVersion:1,rareSeeds:0,rules:structuredClone(rules),plots,discovered:['wheat'],explored:0,neighbor:{personId:s.sect!.current[1],goods:{seedSoy:rules.neighborStock,seedFlax:rules.neighborStock,seedMallow:rules.neighborStock,seedRice:rules.neighborStock,wheat:0},field:{...blankField(),crop:'soy',duration:CROPS.soy.duration},talked:-1,traded:-1,helped:-1,busy:false}};
 for(const p of Object.values(plots))if(p.kind!=='unknown')extendFarm(s,p);
 s.economy!.goods.seedSoy=0;s.economy!.goods.seedFlax=0;
 const id=s.sect!.current[1];s.economy!.branches!.learned[id]=['A0','A4'];
}
export function farmView(s:GameState){
 const f=s.economy?.farm;if(!f)return undefined;
 const id=s.sect!.current[1],v=s.persons[id].vitality!,trust=activePerson(s).vitality?.experiences?.relationships[id]??0;
 return {techniques:{rotation:branchHas(s,'A5'),seedSelection:branchHas(s,'A6'),scouting:branchHas(s,'A11'),paddy:branchHas(s,'A12'),dryland:branchHas(s,'A13'),relay:branchHas(s,'A14'),garden:branchHas(s,'A15'),nursery:equipped(s,'U10'),drainage:equipped(s,'U08'),harvestTools:equipped(s,'U04')},homeId:HOME_PLOT,rareSeeds:f.rareSeeds,discovered:[...f.discovered],plots:Object.values(f.plots).map(p=>{const field=plotField(s,p.id);return {id:p.id,x:p.x,y:p.y,kind:p.kind,land:landView(s,p),...(p.kind==='field'&&field?{field:{...field},harvest:fieldYield(s,field),maturity:field.crop?maturityView(s,field):null}:{}),...(p.kind==='unknown'?{reachable:farmNeighbors(p).some(n=>f.plots[n.id]&&f.plots[n.id].kind!=='unknown')}:{}),...(p.project?{project:{...p.project,name:FARM_PROJECT_NAMES[p.project.kind],stage:p.project.done<p.project.total/2?'整备':'施工',remaining:p.project.total-p.project.done}}:{}),...(p.improvement?{improvement:p.improvement}:{}),canalAccess:farmCanalAccess(s,p),affected:farmCoverage(p,p.improvement==='pond'?8:4).filter(n=>f.plots[n.id]?.kind!=='unknown'&&f.plots[n.id]).map(n=>n.id),...(p.discovery?{discovery:{...p.discovery,...FARM_EVENTS[p.discovery.id]}}:{}),...(p.fertility!==undefined?{fertility:p.fertility}:{})};}),neighbor:{id,title:v.sex==='female'?'师姐':'师兄',name:s.persons[id].name,alive:v.alive,trust,busy:f.neighbor.busy,offers:{seedSoy:f.neighbor.goods.seedSoy??0,seedFlax:f.neighbor.goods.seedFlax??0,seedMallow:f.neighbor.goods.seedMallow??0,...(isCanalBuilt(s)?{seedRice:f.neighbor.goods.seedRice??0}:{})},description:'独立同门，不可切换控制；自己的田地与物资独立结算'},rules:{...f.rules}};
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
 if(m.time>=2&&v.energy>=2){
  m.time-=2;v.energy-=2;
  if(f.crop&&f.growth>=f.duration){const crop=f.crop;n.goods[crop]=(n.goods[crop]??0)+Math.max(1,CROPS[crop].yield-f.stress);n.goods[CROPS[crop].seed]=(n.goods[CROPS[crop].seed]??0)+2;f.crop=crop==='soy'?'flax':'soy';f.growth=0;f.stress=0;f.duration=CROPS[f.crop].duration;}
  else {f.moisture=2;}
 }
 if(f.crop&&!s.life?.calendar){if(s.location.rain+f.moisture<2)f.stress++;f.growth++;f.moisture=0;}
}

/** Fictional vignettes inspired by traditional farming and rural literature. */
export const FARM_EVENTS:Record<FarmDiscovery,{title:string;text:string;inspiration:string}>={
 fallow:{title:'荒草下的旧田',text:'旧田埂还在，土层却已贫瘠。可以尽快翻土，也可以分两段清荒、归肥，再建成良田。',inspiration:'传统复垦与培肥实践'},
 woodland:{title:'林间取舍',text:'杂木覆盖缓坡。可以取木后留下荒地，费时清根建田，或整理成护田林，减轻相邻田的旱害。',inspiration:'传统农林经营；地景为虚构'},
 meadow:{title:'风过平畴',text:'拨开草丛，是一片土层平整的荒地。翻土之后就能种下作物。',inspiration:'传统垦荒生活'},
 oldtree:{title:'社树的浓荫',text:'一棵老树盘根错节。树下有歇脚留下的石凳，村人一直留着这片树荫。这里不能开垦，仍可绕树向外探索。',inspiration:'传统社树习俗；故事为虚构'},
 boulder:{title:'卧牛石',text:'土下连着整片岩床，不是挪开一块石头就能耕种。留下这处地标，沿旁边继续探路。',inspiration:'乡野地名与地景叙事；故事为虚构'},
 brambles:{title:'荆棘掩径',text:'荆棘覆盖了旧田埂。投入劳力清理后能露出可耕土层，也可以暂时绕行。',inspiration:'传统清荒农事'},
 seedbag:{title:'埂边的种囊',text:'旧田埂里落着一只种囊，籽粒与家里的麦种不同。先辨认，再决定如何栽种；未经辨认不能直接下地。',inspiration:'传统辨种、留种实践；事件为虚构'},
 heritage:{title:'一束异穗',text:'荒草间有几株深色长穗的麦子。仔细选留后可以培育“异穗麦”，仍受旱涝影响，并非仙种。',inspiration:'农书中的选种思想；品种与故事为虚构'},
 canal:{title:'水声旧事',text:'旧渠淤塞，但上游仍有水。先清淤，再修渠引水，可为上下左右相邻田块分配有限公共水，每旬共享补水额度；渠格永久保留，也可放弃水利改作荒地。',inspiration:'传统沟渠修治、淤泥肥田；故事为虚构'},
 traveler:{title:'渡口借火',text:'一位赶路人蹲在田边，想借一份口粮暖胃。你可分粮听他讲一路采种的见闻，也可指路告别。',inspiration:'乡野行旅叙事；人物与故事为虚构'},
 shrine:{title:'桑下旧界',text:'石片上刻着两家旧田的界线。描下界线，保留一隅地标；或将可耕部分整理成荒地。',inspiration:'传统田界与乡土记忆；故事为虚构'},
};
export function exploreFarm(s:GameState,id:string,events:GameEvent[]):void{
 const farm=s.economy!.farm!,p=farm.plots[id];
 revealLand(s,p);
 const key=FARM_DISCOVERIES[Math.min(FARM_DISCOVERIES.length-1,Math.floor(draw(s)*FARM_DISCOVERIES.length))];
 p.kind=key==='oldtree'?'tree':key==='boulder'?'rock':key==='brambles'?'brush':key==='meadow'?'wild':'story';
 p.discovery={id:key,resolved:['meadow','oldtree','boulder'].includes(key),outcome:''};
 farm.explored++;extendFarm(s,p);
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
 if(choice==='repair'){changeGoods(s,{wood:1},-1,events,'修治废渠');p.kind='wild';p.fertility=3;outcome='整理淤泥归田；开垦后的初始肥力为3。这里不提供自动灌溉。';}
 if(choice==='share'){changeGoods(s,{seedWheat:f.rules.discoverySeeds},1,events,'行旅回赠');p.kind='wild';outcome=`分出${f.rules.storyFood}份口粮。旅人讲起沿河选种的见闻，回赠${f.rules.discoverySeeds}份麦种。`;}
 if(choice==='preserve'){p.kind='rock';outcome='记下旧界，保留为地标。此格不再开垦，可继续探索周边。';}
 if(choice==='leave'){p.kind='wild';if(d.id==='fallow')p.fertility=0;outcome='告别这段见闻，将可耕地记为普通荒地；不获得事件奖励。';}
 d.resolved=true;d.outcome=outcome;
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${id} · ${FARM_EVENTS[d.id].title}：${outcome}`});
}

export function sowingSeasons(crop:Crop):number[]{return crop==='wheat'?[0,2]:['soy','rice','millet','adzuki'].includes(crop)?[0,1]:['mallow','mustard'].includes(crop)?[2,3]:[0];}
export function maturityView(s:GameState,f:Field){
 const c=s.life!.calendar!,days=Math.max(0,f.duration-f.growth);
 const crop=f.crop?CROPS[f.crop]:null;
 return {days,date:lunarDateAt(c.rules.referenceYear,c.absoluteDay+days).date,...(crop?{waterNeed:crop.waterNeed??2,...(crop.floodTolerant?{floodTolerant:true}:{}),...(crop.lateRate&&crop.lateRate>1?{lateRisk:`迟收每${c.rules.harvestGraceDays}天减产${crop.lateRate}份`}:{})}:{})};
}
export function advanceFields(s:GameState,days:number):string[]{
 const ripe:string[]=[],start=s.life!.calendar!.absoluteDay;
 for(const p of Object.values(s.economy?.farm?.plots??{})){
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
 }
 for(let day=Math.floor(start)+1;day<=Math.floor(start+days);day++)advanceLandDay(s,day);
 const neighbor=s.economy?.farm?.neighbor.field;if(neighbor?.crop)neighbor.growth=Math.round((neighbor.growth+days)*100)/100;
 return ripe;
}

export const FARM_PROJECT_NAMES={canal:'水渠修建',restore:'荒田整治',timber:'采木整地',clearwood:'清林建田',shelter:'护田林营造',pond:'蓄水塘开挖',drain:'排水沟开挖'};
export function farmCanalAccess(s:GameState,p:FarmPlot):boolean {
 const plots=s.economy!.farm!.plots;
 return !!p.land&&farmNeighbors(p).some(n=>plots[n.id]?.improvement==='canal'&&plots[n.id].land!.elevation>=p.land!.elevation);
}
export function workFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,days:number,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 startFarmProject(s,id,kind,total,events);
 if(!p.project)return;
 p.project.done=Math.min(p.project.total,p.project.done+days);
 const complete=p.project.done>=p.project.total;
 let detail=`${FARM_PROJECT_NAMES[kind]} ${p.project.done}/${p.project.total}天`;
 if(complete){
  if(kind==='canal'||kind==='shelter'||kind==='pond'||kind==='drain'){
   p.kind='rock';p.improvement=kind;
   if(kind!=='shelter')p.service={cycle:Math.floor(s.life!.calendar!.absoluteDay/farm.rules.waterCycleDays),remaining:serviceLimit(s,p),stored:0};
   detail+='；'+(kind==='canal'?'正交四格共享补水额度，每次扣公共水。':kind==='pond'?'周围八格共享储水和补水额度，雨天蓄水。':kind==='drain'?'有低位出口时，正交四格共享排水额度。':'正交四格失水变慢。');
  }
  else if(kind==='timber'){changeGoods(s,{wood:farm.rules.timberYield},1,events,'林地采木');p.kind='wild';delete p.project;detail+='；木材入库，留下可开垦荒地。';}
  else {p.kind='field';p.field={...blankField(),fertility:kind==='restore'?3:2};detail+='；田块可播种。';}
  if(p.discovery){p.discovery.resolved=true;p.discovery.outcome=detail;}
 }
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:id+' · '+detail});
}

export function fieldCanalAccess(s:GameState,f:Field):boolean {const p=fieldPlot(s,f);return !!p&&farmCanalAccess(s,p);}

export function isCanalBuilt(s:GameState):boolean{return Object.values(s.economy?.farm?.plots??{}).some(p=>p.improvement==='canal');}

export function startFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 if(p.project)return;
 if(kind==='canal'||kind==='pond'||kind==='drain')changeGoods(s,{wood:farm.rules.projectWood},-1,events,'水土工程备料');
 p.project={kind,done:0,total};
}
