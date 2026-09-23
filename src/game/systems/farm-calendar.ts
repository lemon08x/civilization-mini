import {activePerson,type GameState} from '../model/state.js';
import {dietView} from './social-food.js';
import type {Crop,Field,FarmPlot,FarmPlan} from '../model/economy.js';
import type {GameEvent} from '../model/events.js';
import {CROPS} from './economy-catalog.js';
import {solarTermDay,solarYearAt,lunarDateAt} from './calendar.js';
import {equipped,amount} from './inventory.js';
import {branchHas} from './branches.js';
import {plotField,fieldNeedsWater,shedCovers} from './agriculture.js';
import {lifeCost,sectCosts,calendarCost} from './life.js';

export function farmYearLabel(s:GameState,year:number){return '第'+(year-s.life!.calendar!.rules.referenceYear+1)+'年';}
export function farmYear(s:GameState){const c=s.life!.calendar!;return solarYearAt(c.rules.referenceYear,c.absoluteDay);}
export function cropBatches(s:GameState,year:number){
 const c=s.life!.calendar!,r=s.economy!.farm!.rules;
 return (Object.keys(CROPS) as Crop[]).flatMap(crop=>(CROPS[crop].seasons??[]).map((v,i)=>({
  id:crop+String(i),crop,year,name:CROPS[crop].name+' · '+v.sowTerm+'播',sowTerm:v.sowTerm,harvestTerm:v.harvestTerm,
  start:solarTermDay(c.rules.referenceYear,year,v.sowTerm),
  bestEnd:solarTermDay(c.rules.referenceYear,year,v.sowTerm)+r.sowBestDays,
  end:solarTermDay(c.rules.referenceYear,year,v.sowTerm)+r.sowBestDays+r.sowLateDays,
  mature:solarTermDay(c.rules.referenceYear,year+v.yearOffset,v.harvestTerm),
 })));
}
export function sowBatch(s:GameState,crop:Crop,day=s.life!.calendar!.absoluteDay){
 const c=s.life!.calendar!;return cropBatches(s,solarYearAt(c.rules.referenceYear,day)).find(b=>b.crop===crop&&day>=b.start&&day<b.end);
}
export function harvestDates(s:GameState,p:FarmPlot|undefined,f:Field){
 const r=s.economy!.farm!.rules,now=s.life!.calendar!.absoluteDay;
 const mature=f.batch?.matureDay??now+f.duration-f.growth;
 const yard=p&&Object.values(s.economy!.farm!.plots).some(q=>q.improvement==='yard'&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1);
 const bestEnd=mature+r.harvestBestDays+(equipped(s,'U04')?r.harvestToolDays:0)+(yard?r.yardGraceDays:0);
 return {mature,bestEnd,deadline:bestEnd+r.harvestLateDays};
}
export function planForField(p:FarmPlot|undefined,f:Field){return p?.plans?.find(v=>v.batchId===f.batch?.id&&v.year===f.batch?.year&&v.sown&&!v.harvested&&!v.failed);}
export function plannedField(s:GameState,p:FarmPlot,plan:FarmPlan):Field|undefined {
 const b=cropBatches(s,plan.year).find(b=>b.id===plan.batchId);if(!b)return;
 const mature=b.mature-(equipped(s,'U10')?s.economy!.farm!.rules.nurseryDays:0);
 return {crop:b.crop,planted:0,moisture:0,growth:0,stress:0,fertility:plotField(s,p.id)?.fertility??2,lastCrop:null,tended:0,composted:false,bonus:0,duration:mature-plan.sowDay,batch:{id:b.id,year:b.year,sownDay:plan.sowDay,matureDay:mature,lateFactor:Math.max(0,1-Math.max(0,Math.floor(plan.sowDay)-b.bestEnd+1)*s.economy!.farm!.rules.lateSowPercent/100)}};
}
export function farmLabor(s:GameState,p:FarmPlot,op:'farmplot'|'farmfertilize',crop:Crop,kind:'sow'|'fertilize'|'harvest'|'water'='water'){
 if(kind==='sow'||kind==='harvest'){s=structuredClone(s);const future=plotField(s,p.id)!;future.crop=kind==='sow'?null:crop;if(kind==='harvest')future.growth=future.duration;}
 const id=`economy:${op}:${op==='farmfertilize'?p.id:p.id+'-'+crop}`,field=plotField(s,p.id);
 const ap=op==='farmplot'&&!field?.crop&&equipped(s,'U02')&&s.economy!.shop?.seededTurn!==s.clock.absoluteTurn?0:1;
 const cost=calendarCost(s,id,sectCosts(s,id,lifeCost(s,id,ap)));
 if(op==='farmplot'&&shedCovers(s,p))cost.time=Math.max(0.5,Math.ceil(cost.time)/2);
 return cost;
}
export interface FarmTask {id:string;plotId:string;planId?:string;kind:'sow'|'fertilize'|'harvest'|'water';name:string;day:number;release:number;deadline:number;time:number;energy:number;actionId:string;gaps:string[];}
export function farmTasks(s:GameState):FarmTask[]{
 const tasks:FarmTask[]=[],now=s.life!.calendar!.absoluteDay;
 for(const p of Object.values(s.economy!.farm!.plots)){
  const f=plotField(s,p.id);if(p.kind!=='field'||!f)continue;
  for(const plan of p.plans??[]){
   if(plan.harvested||plan.failed)continue;
   const b=cropBatches(s,plan.year).find(b=>b.id===plan.batchId);if(!b)continue;
   const simulated=plan.sown&&f.batch?.id===b.id&&f.batch.year===b.year?f:plannedField(s,p,plan)!;
   const dates=harvestDates(s,p,simulated),gaps:string[]=[];
   const gate={wheat:'A0',soy:'A4',flax:'A4',rice:'A12',millet:'A13',adzuki:'A14',mallow:'A15',mustard:'A15'}[b.crop];
   if((p.plans??[]).some(other=>other.id!==plan.id&&!other.failed&&!other.harvested&&other.sowDay<plan.harvestDay&&plan.sowDay<other.harvestDay))gaps.push('同一田块的计划占地时段重叠');
   if(!branchHas(s,gate))gaps.push('未掌握 '+gate);
   if(!s.economy!.farm!.discovered.includes(b.crop))gaps.push('尚未发现种子');
   if(!plan.sown&&amount(s,CROPS[b.crop].seed)<1)gaps.push('缺1份种子');
   if(!plan.sown&&f.crop)gaps.push('田间已有作物');
   if(p.project&&p.project.done<p.project.total)gaps.push('工程占用田块');
   if(b.crop==='rice'&&!p.land?.paddy||p.land?.paddy&&!CROPS[b.crop].floodTolerant)gaps.push('田型不符');
   const add=(kind:FarmTask['kind'],day:number,release:number,deadline:number,op:'farmplot'|'farmfertilize')=>tasks.push({id:plan.id+'-'+kind,plotId:p.id,planId:plan.id,kind,name:p.id+' '+b.name+' '+({sow:'播种',fertilize:'施肥',harvest:'收获',water:'灌溉'}[kind]),day,release,deadline,...farmLabor(s,p,op,b.crop,kind),actionId:`economy:${op}:${op==='farmfertilize'?p.id:p.id+'-'+b.crop}`,gaps:[...gaps,...(kind!=='sow'&&!plan.sown?['尚未播种本批作物']:[]),...(kind==='fertilize'&&!branchHas(s,'A3')?['未掌握土壤肥力']:[]),...(kind==='fertilize'&&amount(s,'compost')<1?['缺1份堆肥']:[]),...(kind==='sow'&&now>=b.end?['已错过播种窗口']:[]),...(plan.sown&&(f.batch?.id!==b.id||f.batch?.year!==b.year)?['实际作物与计划冲突']:[])]});
   if(!plan.sown)add('sow',plan.sowDay,b.start,b.end,'farmplot');
   if(plan.fertilizeDay!==undefined&&!plan.fertilized)add('fertilize',plan.fertilizeDay,plan.sowDay,dates.mature,'farmfertilize');
   add('harvest',plan.harvestDay,dates.mature,dates.deadline,'farmplot');
  }
  if(f.crop){
   const dates=harvestDates(s,p,f);
   if(!planForField(p,f))tasks.push({id:p.id+'-harvest',plotId:p.id,kind:'harvest',name:p.id+' '+CROPS[f.crop].name+' 收获',day:dates.mature,release:dates.mature,deadline:dates.deadline,...farmLabor(s,p,'farmplot',f.crop,'harvest'),actionId:`economy:farmplot:${p.id}-${f.crop}`,gaps:[]});
   if(fieldNeedsWater(s,f))tasks.push({id:p.id+'-water',plotId:p.id,kind:'water',name:p.id+' 缺水',day:now,release:now,deadline:dates.mature,...farmLabor(s,p,'farmplot',f.crop),actionId:`economy:farmplot:${p.id}-${f.crop}`,gaps:[]});
  }
 }
 for(const t of tasks){if(activePerson(s).vitality!.energy<t.energy)t.gaps.push('当前精力不足');if((dietView(s)?.days??0)<t.time)t.gaps.push('当前口粮不足以支持劳动');}
 return tasks.sort((a,b)=>a.day-b.day||a.id.localeCompare(b.id));
}
export function farmScheduleView(s:GameState){
 const now=s.life!.calendar!.absoluteDay,c=s.life!.calendar!,tasks=farmTasks(s),pending=tasks.filter(t=>t.kind!=='water'&&t.deadline>now).map(t=>({...t}));
 let cursor=now,demand=0,overflow=0;const conflicts:string[]=tasks.filter(t=>t.gaps.some(g=>g.includes('重叠'))).map(t=>t.plotId);
 const jobs=pending.map(t=>({...t,left:t.time,finishDeadline:t.deadline+t.time-0.5}));
 demand=jobs.reduce((n,t)=>n+t.time,0);
 // Half-day preemptible EDF is an optimistic labor bound, not an automatic work schedule.
 // Actions are admitted by start time; their final half-day may lie beyond the window.
 while(jobs.length){
  const ready=jobs.filter(t=>Math.max(t.release,t.day)<=cursor);
  if(!ready.length){cursor=Math.min(...jobs.map(t=>Math.max(t.release,t.day)));continue;}
  ready.sort((a,b)=>a.finishDeadline-b.finishDeadline||a.id.localeCompare(b.id));
  const task=ready[0],step=Math.min(0.5,task.left);task.left-=step;cursor+=step;
  if(task.left<=0){jobs.splice(jobs.indexOf(task),1);if(cursor>task.finishDeadline){overflow=Math.max(overflow,cursor-task.finishDeadline);conflicts.push(task.plotId);}}
 }

 const date=(day:number)=>lunarDateAt(c.rules.referenceYear,day).date;
 const wildCalendar=Object.values(s.economy!.farm!.plots).filter(p=>p.wild?.kind==='yam').map(p=>({plotId:p.id,name:'山药采挖期',startDate:date(solarTermDay(c.rules.referenceYear,farmYear(s),'霜降')),endDate:date(solarTermDay(c.rules.referenceYear,farmYear(s)+1,'立春'))}));
 return {wildCalendar,year:farmYear(s),referenceYear:c.rules.referenceYear,tasks:tasks.map(t=>({...t,date:date(t.day),deadlineDate:date(t.deadline),due:t.day<=now&&t.release<=now&&now<t.deadline})),labor:{demand,overflow,conflicts:[...new Set(conflicts)],description:'时间下限：按期望日期和截止日期，以半天分配劳动；未计整段行动限制、未来天气、休息与临时事务。'},batches:[...new Set([farmYear(s),farmYear(s)+1,...Object.values(s.economy!.farm!.plots).flatMap(p=>(p.plans??[]).map(v=>v.year))])].sort().flatMap(y=>cropBatches(s,y)).map(b=>({...b,startDate:date(b.start),endDate:date(b.end),matureDate:date(b.mature),bestEndDate:date(b.bestEnd)}))};
}

export function advanceWildDay(s:GameState,day:number,events:GameEvent[]){
 const c=s.life!.calendar!,year=solarYearAt(c.rules.referenceYear,day),r=s.economy!.farm!.rules;
 const spring=solarTermDay(c.rules.referenceYear,year,'立春'),winter=solarTermDay(c.rules.referenceYear,year,'立冬'),frost=solarTermDay(c.rules.referenceYear,year,'霜降');
 for(const p of Object.values(s.economy!.farm!.plots)){
  const w=p.wild;if(!w)continue;
  if(day>=w.expires)w.stock=0;
  if(w.kind==='yam'){
   if(day===frost&&w.year!==year){w.year=year;w.stock=r.yamYield;w.expires=solarTermDay(c.rules.referenceYear,year+1,'立春');events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:p.id+' 山药已到采挖期，可留地至立春。'});}
  }else{
   if(w.year!==year){w.year=year;w.bursts=0;}
   w.wetDays=day>=spring&&day<winter&&s.location.weather==='wet'?w.wetDays+1:0;
   if(w.wetDays>=r.mushroomRainDays&&w.bursts<r.mushroomMaxBursts&&day-w.lastSpawn>=r.mushroomIntervalDays&&w.stock===0){w.stock=r.mushroomYield;w.bursts++;w.lastSpawn=day;w.expires=day+r.mushroomLifeDays;w.wetDays=0;events.push({type:'life',personId:s.household.activePersonId,operation:'farm-map',detail:p.id+' 雨后长出野蘑菇，'+r.mushroomLifeDays+'天内可采。'});}
  }
 }
}
