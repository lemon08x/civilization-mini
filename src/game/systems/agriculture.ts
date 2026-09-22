import {seasonIndex,lunarDateAt} from './calendar.js';
import {draw} from './life.js';
import { activePerson, type GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import {FARM_DISCOVERIES,type FarmDiscovery} from '../model/economy.js';
import type { Crop, Worker, Field, FarmRules, FarmPlot } from '../model/economy.js';
import { CROPS, WORKER_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import { level, recordEvidence, requirements } from './knowledge.js';
import { branchHas } from './branches.js';
import { made } from './shop.js';

export function fieldYield(s: GameState,f:Field=s.economy!.field): number {
  if (!f.crop) return 0;
  const grace=s.life?.calendar?.rules.harvestGraceDays??1;
  const late = Math.floor(Math.max(0, f.growth - f.duration - (equipped(s, 'U04') ? grace : 0))/grace);
  return Math.max(1, Math.floor(CROPS[f.crop].yield + f.bonus + (f===s.economy!.field?(s.economy!.modern?.cropBonus ?? 0):0) + Math.min(1, f.fertility) - f.stress - late));
}
export function farmBlocker(s: GameState, crop: Crop, worker?: Worker,f:Field=s.economy!.field): string[] {
  if (s.economy!.branches) {
    if (crop === 'wheat' && !branchHas(s, 'A0') && !worker) return ['需掌握基础栽培'];
    if ((crop === 'soy' || crop === 'flax') && !branchHas(s, 'A4')) return ['需掌握油料与纤维作物'];
  }
  if (!f.crop) {
    if(s.life?.calendar&&!sowingSeasons(crop).includes(seasonIndex(s)))return ['不在播种季：'+sowingSeasons(crop).map(n=>['春','夏','秋','冬'][n]).join('、')];
    if (worker?.kind === 'laborer' && worker.experience < 8) return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker ? [] : requirements(s, { agronomy: CROPS[crop].level })), ...missingGoods(s, { [CROPS[crop].seed]: 1 })];
  }
  if (f.growth >= f.duration) return [];
  if (f.tended === s.clock.absoluteTurn) return ['本季已管理田间'];
  if (s.location.rain + f.moisture + fieldWaterSupport(s,f) >= 2) return ['本季水分充足，等待作物生长'];
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
    f.fertility = Math.max(0, Math.min(3, f.fertility + (f.crop === 'soy' ? 1 : -1)));
    f.lastCrop = f.crop;
    f.crop = null;delete f.variety;
  } else {
    s.location.water--;
    f.moisture += equipped(s, 'W01') ? 2 : 1;
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
 for(const [id,key] of [['p1q2','canal'],['p3q2','fallow'],['p2q3','woodland']] as const){plots[id].kind='story';plots[id].discovery={id:key,resolved:false,outcome:''};}

 s.economy!.farm={explorationVersion:3,rareSeeds:0,rules:structuredClone(rules),plots,discovered:['wheat'],explored:0,neighbor:{personId:s.sect!.current[1],goods:{seedSoy:rules.neighborStock,seedFlax:rules.neighborStock,wheat:0},field:{...blankField(),crop:'soy',duration:CROPS.soy.duration},talked:-1,traded:-1,helped:-1,busy:false}};
 for(const p of Object.values(plots))if(p.kind!=='unknown')extendFarm(s,p);
 s.economy!.goods.seedSoy=0;s.economy!.goods.seedFlax=0;
 const id=s.sect!.current[1];s.economy!.branches!.learned[id]=['A0','A4'];
}
export function farmView(s:GameState){
 const f=s.economy?.farm;if(!f)return undefined;
 const id=s.sect!.current[1],v=s.persons[id].vitality!,trust=activePerson(s).vitality?.experiences?.relationships[id]??0;
 return {techniques:{rotation:branchHas(s,'A5'),seedSelection:branchHas(s,'A6'),scouting:branchHas(s,'A11'),nursery:equipped(s,'U10'),drainage:equipped(s,'U08'),harvestTools:equipped(s,'U04')},homeId:HOME_PLOT,rareSeeds:f.rareSeeds,discovered:[...f.discovered],plots:Object.values(f.plots).map(p=>{const field=plotField(s,p.id);return {id:p.id,x:p.x,y:p.y,kind:p.kind,...(p.kind==='field'&&field?{field:{...field},harvest:fieldYield(s,field),maturity:field.crop?maturityView(s,field):null}:{}),...(p.kind==='unknown'?{reachable:farmNeighbors(p).some(n=>f.plots[n.id]&&f.plots[n.id].kind!=='unknown')}:{}),...(p.project?{project:{...p.project,name:FARM_PROJECT_NAMES[p.project.kind],stage:p.project.done<p.project.total/2?'整备':'施工',remaining:p.project.total-p.project.done}}:{}),...(p.improvement?{improvement:p.improvement}:{}),waterSupport:farmWaterSupport(s,p),affected:farmNeighbors(p).filter(n=>f.plots[n.id]?.kind!=='unknown'&&f.plots[n.id]).map(n=>n.id),...(p.discovery?{discovery:{...p.discovery,...FARM_EVENTS[p.discovery.id]}}:{}),...(p.fertility!==undefined?{fertility:p.fertility}:{})};}),neighbor:{id,title:v.sex==='female'?'师姐':'师兄',name:s.persons[id].name,alive:v.alive,trust,busy:f.neighbor.busy,offers:{seedSoy:f.neighbor.goods.seedSoy??0,seedFlax:f.neighbor.goods.seedFlax??0},description:'独立同门，不可切换控制；自己的田地与物资独立结算'},rules:{...f.rules}};
}
export function growField(s:GameState,f:Field,events:GameEvent[],id:string):void{
 if(!f.crop)return;
 if(f.growth<f.duration){
  if(s.location.rain+f.moisture<2)f.stress++;
  if(s.location.rain>=3){if(equipped(s,'U08'))consumeEquipment(s,'U08',events);else f.stress++;}
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
 if(f.crop){if(s.location.rain+f.moisture<2)f.stress++;if(!s.life?.calendar)f.growth++;f.moisture=0;}
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
 canal:{title:'水声旧事',text:'旧渠淤塞，但上游仍有水。先清淤，再修渠引水，可为上下左右相邻田块持续补足生长用水；渠格永久保留，也可放弃水利改作荒地。',inspiration:'传统沟渠修治、淤泥肥田；故事为虚构'},
 traveler:{title:'渡口借火',text:'一位赶路人蹲在田边，想借一份口粮暖胃。你可分粮听他讲一路采种的见闻，也可指路告别。',inspiration:'乡野行旅叙事；人物与故事为虚构'},
 shrine:{title:'桑下旧界',text:'石片上刻着两家旧田的界线。描下界线，保留一隅地标；或将可耕部分整理成荒地。',inspiration:'传统田界与乡土记忆；故事为虚构'},
};
export function exploreFarm(s:GameState,id:string,events:GameEvent[]):void{
 const farm=s.economy!.farm!,p=farm.plots[id];
 const key=FARM_DISCOVERIES[Math.min(FARM_DISCOVERIES.length-1,Math.floor(draw(s)*FARM_DISCOVERIES.length))];
 p.kind=key==='oldtree'?'tree':key==='boulder'?'rock':key==='brambles'?'brush':key==='meadow'?'wild':'story';
 p.discovery={id:key,resolved:['meadow','oldtree','boulder'].includes(key),outcome:''};
 farm.explored++;extendFarm(s,p);
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${id} · ${FARM_EVENTS[key].title}：${FARM_EVENTS[key].text}`});
}
export function discoverFarmSeed(s:GameState,events:GameEvent[]):string{
 const f=s.economy!.farm!,crop=(['soy','flax'] as const).find(c=>!f.discovered.includes(c));
 if(crop){f.discovered.push(crop);changeGoods(s,{[CROPS[crop].seed]:f.rules.discoverySeeds},1,events,'辨认乡野种子');return `辨认出${CROPS[crop].name}，获得${f.rules.discoverySeeds}份种子；需学会A4才能种植，集市开放补购。`;}
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

export function sowingSeasons(crop:Crop):number[]{return crop==='wheat'?[0,2]:crop==='soy'?[0,1]:[0];}
export function maturityView(s:GameState,f:Field){
 const c=s.life!.calendar!,days=Math.max(0,f.duration-f.growth);
 return {days,date:lunarDateAt(c.rules.referenceYear,c.absoluteDay+days).date};
}
export function advanceFields(s:GameState,days:number):string[]{
 const ripe:string[]=[];
 for(const p of Object.values(s.economy?.farm?.plots??{})){
  const f=plotField(s,p.id);if(!f?.crop)continue;
  const before=f.growth;f.growth=Math.round((f.growth+days)*100)/100;
  if(before<f.duration){
   const exposure=Math.min(days,f.duration-before)/(s.life!.calendar!.seasonLength);
   if(s.location.rain+f.moisture+farmWaterSupport(s,p)<2)f.stress+=exposure;
   if(s.location.rain>=3&&!equipped(s,'U08'))f.stress+=exposure;
   if(f.growth>=f.duration)ripe.push(p.id+' '+CROPS[f.crop].name);
  }
 }
 const neighbor=s.economy?.farm?.neighbor.field;if(neighbor?.crop)neighbor.growth=Math.round((neighbor.growth+days)*100)/100;
 return ripe;
}

export const FARM_PROJECT_NAMES={canal:'旧渠修复',restore:'荒田整治',timber:'采木整地',clearwood:'清林建田',shelter:'护田林营造'};
export function farmWaterSupport(s:GameState,p:FarmPlot):number {
 const plots=s.economy!.farm!.plots;
 return Math.max(0,...farmNeighbors(p).map(n=>plots[n.id]?.improvement==='canal'?2:plots[n.id]?.improvement==='shelter'?1:0));
}
export function workFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,days:number,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 startFarmProject(s,id,kind,total,events);
 if(!p.project)return;
 p.project.done=Math.min(p.project.total,p.project.done+days);
 const complete=p.project.done>=p.project.total;
 let detail=`${FARM_PROJECT_NAMES[kind]} ${p.project.done}/${p.project.total}天`;
 if(complete){
  if(kind==='canal'||kind==='shelter'){p.kind='rock';p.improvement=kind;detail+=kind==='canal'?'；相邻四格田持续获得2点供水，不叠加。':'；相邻四格田获得1点保水，不叠加。';}
  else if(kind==='timber'){changeGoods(s,{wood:farm.rules.timberYield},1,events,'林地采木');p.kind='wild';detail+='；木材入库，留下可开垦荒地。';}
  else {p.kind='field';p.field={...blankField(),fertility:kind==='restore'?3:2};detail+='；田块可播种。';}
  p.discovery!.resolved=true;p.discovery!.outcome=detail;
 }
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:id+' · '+detail});
}

export function fieldWaterSupport(s:GameState,f:Field):number {const p=Object.values(s.economy?.farm?.plots??{}).find(p=>plotField(s,p.id)===f);return p?farmWaterSupport(s,p):0;}

export function startFarmProject(s:GameState,id:string,kind:import('../model/economy.js').FarmProjectKind,total:number,events:GameEvent[]):void {
 const farm=s.economy!.farm!,p=farm.plots[id];
 if(p.project)return;
 if(kind==='canal')changeGoods(s,{wood:farm.rules.projectWood},-1,events,'旧渠备料');
 p.project={kind,done:0,total};
}
