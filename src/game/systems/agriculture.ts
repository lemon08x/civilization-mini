import {draw,sectCosts} from './life.js';
import { activePerson, type GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import {FARM_DISCOVERIES,type FarmDiscovery} from '../model/economy.js';
import type { Crop, Worker, Field, FarmRules, FarmPlot } from '../model/economy.js';
import { CROPS, WORKER_NAMES } from './economy-catalog.js';
import { amount, changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import type { Ruleset } from '../ruleset.js';
import { level, recordEvidence, requirements, wage } from './knowledge.js';
import { branchHas } from './branches.js';
import { made } from './shop.js';

export function fieldYield(s: GameState,f:Field=s.economy!.field): number {
  if (!f.crop) return 0;
  const late = Math.max(0, f.growth - f.duration - (equipped(s, 'U04') ? 1 : 0));
  return Math.max(1, CROPS[f.crop].yield + f.bonus + (f===s.economy!.field?(s.economy!.modern?.cropBonus ?? 0):0) + Math.min(1, f.fertility) - f.stress - late);
}
export function farmBlocker(s: GameState, crop: Crop, worker?: Worker,f:Field=s.economy!.field): string[] {
  if (s.economy!.branches) {
    if (crop === 'wheat' && !branchHas(s, 'A0') && !worker) return ['需掌握基础栽培'];
    if ((crop === 'soy' || crop === 'flax') && !branchHas(s, 'A4')) return ['需掌握油料与纤维作物'];
  }
  if (!f.crop) {
    if (worker?.kind === 'laborer' && worker.experience < 8) return ['普通雇工只能照料和收获，播种需要本人或熟练农工'];
    return [...(worker ? [] : requirements(s, { agronomy: CROPS[crop].level })), ...missingGoods(s, { [CROPS[crop].seed]: 1 })];
  }
  if (f.growth >= f.duration) return [];
  if (f.tended === s.clock.absoluteTurn) return ['本季已管理田间'];
  if (s.location.rain + f.moisture >= 2) return ['本季水分充足，等待作物生长'];
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
    if (level(s, 'agronomy') >= 6 && f.lastCrop && f.lastCrop !== crop) bonus++;
    let duration = c.duration;
    if (equipped(s, 'U10')) { duration = Math.max(1, duration - 1); consumeEquipment(s, 'U10', events); }
    if(heritage){bonus+=e.farm!.rules.rareBonus;f.variety='heritage';}else delete f.variety;
    Object.assign(f, { crop, planted: s.clock.absoluteTurn, moisture: 0, growth: 0, stress: 0, tended: 0, composted: false, bonus, duration });
    events.push({ type: 'economy-farm', operation: 'sow', crop, actor, amount: 0 });
  } else if (f.growth >= f.duration) {
    const c = CROPS[f.crop], n = fieldYield(s,f), out: Record<string, number> = { [f.crop]: n, straw: c.straw, [c.seed]: 1 };
    if(f.variety==='heritage'){delete out[c.seed];e.farm!.rareSeeds++;}else if (level(s, 'agronomy') >= 5) out[c.seed]++;
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
export function farmCycleLabor(s: GameState) {
  const crop = s.economy?.ongoing?.farm;
  if (!crop || !s.life || s.economy!.workers.farmer?.active) return { time: 0, energy: 0 };
  const {time:t,energy}=sectCosts(s,'economy:farm:cycle',{time:s.life.renewal?.farmTime??3,energy:s.life.renewal?.farmEnergy??2}), f = s.economy!.field;
  if (f.crop && f.growth >= f.duration - 1) return { time: t * 2, energy: energy * 2 };
  if (!f.crop) return { time: t, energy };
  return { time: 0, energy: 0 };
}
export function settleOngoingFarm(s: GameState, rules: Ruleset, events: GameEvent[]): void {
  const crop = s.economy?.ongoing?.farm;
  if (!crop) return;
  const f = s.economy!.field, farmer = s.economy!.workers.farmer?.active ? s.economy!.workers.farmer : undefined;
  const {time:t,energy:en}=sectCosts(s,'economy:farm:cycle',{time:s.life?.renewal?.farmTime??3,energy:s.life?.renewal?.farmEnergy??2});
  const pay = (op: string) => {
    if (farmer) {
      const cost = wage(s, rules, farmer);
      if (s.household.money < cost) {
        events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: WORKER_NAMES.farmer, amount: 0 });
        return false;
      }
      s.household.money -= cost;
      events.push({ type: 'economy-worker', worker: 'farmer', operation: 'worked', money: cost, detail: '持续耕作' + op });
      return true;
    }
    if (!s.life || s.life.timeRemaining < t || activePerson(s).vitality!.energy < en) {
      events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: '本人', amount: 0 });
      return false;
    }
    s.life.timeRemaining = Math.round((s.life.timeRemaining-t)*100)/100;
    activePerson(s).vitality!.energy = Math.round((activePerson(s).vitality!.energy-en)*100)/100;
    return true;
  };
  if (f.crop && f.growth >= f.duration) { if (!pay('收获')) return; farmWork(s, f.crop, events, farmer); }
  if (!f.crop) {
    if (amount(s, CROPS[crop].seed) < 1) {
      events.push({ type: 'economy-farm', operation: 'waiting', crop, actor: farmer ? WORKER_NAMES.farmer : '本人', amount: 0 });
      return;
    }
    if (!pay('播种')) return;
    farmWork(s, crop, events, farmer);
  }
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
 plots[HOME_PLOT].kind='field';plots.p2q4.kind='home';
 s.economy!.farm={explorationVersion:2,rareSeeds:0,rules:structuredClone(rules),plots,discovered:['wheat'],explored:0,neighbor:{personId:s.sect!.current[1],goods:{seedSoy:rules.neighborStock,seedFlax:rules.neighborStock,wheat:0},field:{...blankField(),crop:'soy',duration:CROPS.soy.duration},talked:-1,traded:-1,helped:-1,busy:false}};
 for(const p of Object.values(plots))if(p.kind!=='unknown')extendFarm(s,p);
 s.economy!.goods.seedSoy=0;s.economy!.goods.seedFlax=0;
 const id=s.sect!.current[1];s.economy!.branches!.learned[id]=['A0','A4'];
}
export function farmView(s:GameState){
 const f=s.economy?.farm;if(!f)return undefined;
 const id=s.sect!.current[1],v=s.persons[id].vitality!,trust=activePerson(s).vitality?.experiences?.relationships[id]??0;
 return {homeId:HOME_PLOT,rareSeeds:f.rareSeeds,discovered:[...f.discovered],plots:Object.values(f.plots).map(p=>{const field=plotField(s,p.id);return {id:p.id,x:p.x,y:p.y,kind:p.kind,...(p.kind==='field'&&field?{field:{...field},harvest:fieldYield(s,field)}:{}),...(p.kind==='unknown'?{reachable:farmNeighbors(p).some(n=>f.plots[n.id]&&f.plots[n.id].kind!=='unknown')}:{}),...(p.discovery?{discovery:{...p.discovery,...FARM_EVENTS[p.discovery.id]}}:{}),...(p.fertility!==undefined?{fertility:p.fertility}:{})};}),neighbor:{id,name:s.persons[id].name,alive:v.alive,trust,busy:f.neighbor.busy,offers:{seedSoy:f.neighbor.goods.seedSoy??0,seedFlax:f.neighbor.goods.seedFlax??0},description:'独立邻居，不可切换控制；自己的田地与物资独立结算'},rules:{...f.rules}};
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
 if(f.crop){if(s.location.rain+f.moisture<2)f.stress++;f.growth++;f.moisture=0;}
}

/** Fictional vignettes inspired by traditional farming and rural literature. */
export const FARM_EVENTS:Record<FarmDiscovery,{title:string;text:string;inspiration:string}>={
 meadow:{title:'风过平畴',text:'拨开草丛，是一片土层平整的荒地。翻土之后就能种下作物。',inspiration:'传统垦荒生活'},
 oldtree:{title:'社树的浓荫',text:'一棵老树盘根错节。树下有歇脚留下的石凳，村人一直留着这片树荫。这里不能开垦，仍可绕树向外探索。',inspiration:'传统社树习俗；故事为虚构'},
 boulder:{title:'卧牛石',text:'土下连着整片岩床，不是挪开一块石头就能耕种。留下这处地标，沿旁边继续探路。',inspiration:'乡野地名与地景叙事；故事为虚构'},
 brambles:{title:'荆棘掩径',text:'荆棘覆盖了旧田埂。投入劳力清理后能露出可耕土层，也可以暂时绕行。',inspiration:'传统清荒农事'},
 seedbag:{title:'埂边的种囊',text:'旧田埂里落着一只种囊，籽粒与家里的麦种不同。先辨认，再决定如何栽种；未经辨认不能直接下地。',inspiration:'传统辨种、留种实践；事件为虚构'},
 heritage:{title:'一束异穗',text:'荒草间有几株深色长穗的麦子。仔细选留后可以培育“异穗麦”，仍受旱涝影响，并非仙种。',inspiration:'农书中的选种思想；品种与故事为虚构'},
 canal:{title:'水声旧事',text:'废渠旁留着一段石砌田埂。疏理淤土要花木料和劳力，可把淤泥归田；也可照普通荒地处理。',inspiration:'传统沟渠修治、淤泥肥田；故事为虚构'},
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
 if(choice==='leave'){p.kind='wild';outcome='告别这段见闻，将可耕地记为普通荒地；不获得事件奖励。';}
 d.resolved=true;d.outcome=outcome;
 events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:`${id} · ${FARM_EVENTS[d.id].title}：${outcome}`});
}
