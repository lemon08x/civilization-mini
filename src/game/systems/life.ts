import {landscapeSource} from './landscapes.js';
import {equipped} from './inventory.js';
import {plotField} from './agriculture.js';
import {availableDays,calendarYearDays} from './calendar.js';
import {dietView} from './social-food.js';
import {electricOnline} from '../model/electric.js';
import {eraCard} from './eras.js';
import { ancestorKnows } from './ancestry.js';
import { nodeInEra } from '../model/branches.js';
import { activePerson, blankPerson, heir, project, seedValue, type GameState, type Person } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { CULTIVATION_COURSES, CULTIVATION_TRACKS, type CultivationCourse, type CultivationState, type LifeRules, type SectRules, type Talent, type Vitality } from '../model/life.js';

export const TALENTS: Record<Talent, {name:string;effect:string}> = {
  strong:{name:'健壮',effect:'亲自体力劳动少消耗1压力'},
  scholar:{name:'善学',effect:'学习、实验与付费授课少用1时间'},
  mentor:{name:'善教',effect:'教导后辈少用1时间、1压力'},
  organizer:{name:'善组织',effect:'招聘、采购与建立经营安排少用1时间'},
  resilient:{name:'善恢复',effect:'每半日主动放松额外降低1压力'},
};
export function draw(s:GameState):number {
  let x=s.randomState;x^=x<<13;x^=x>>>17;x^=x<<5;s.randomState=x>>>0;return s.randomState/4294967296;
}
export function makeVitality(s:GameState,r:LifeRules,age:number):Vitality {
  const constitution=r.baseEnergy+Math.floor(draw(s)*5)-2;
  const lifespanSeasons=(r.lifespanMin+Math.floor(draw(s)*(r.lifespanMax-r.lifespanMin+1)))*4;
  const talent=(Object.keys(TALENTS) as Talent[])[Math.floor(draw(s)*5)];
  const sex=draw(s)<0.5?'male':'female';
  const portraits=[`${sex}-01`,`${sex}-02`];
  const unused=portraits.filter(id=>!Object.values(s.persons).some(p=>p.vitality?.portrait===id));
  const pool=unused.length?unused:portraits;
  const portrait=pool[Math.floor(draw(s)*pool.length)];
  return {experiences:{learning:0,talents:[],outlook:0,actions:[],contacts:[],relationships:{},lastEvent:"尚未经历季末事件"},sex,portrait,portraitEra:s.era?.index??0,ageSeasons:age*4,lifespanSeasons,constitution,pressure:0,health:100,talent,alive:true,childId:null};
}
export function namePerson(s:GameState,p:Person):void {
  const surnames=['沈','陆','温','顾','许','程','叶','宋','苏','江','林','周'];
  const given=['知微','清和','望舒','怀瑾','照野','听澜','行舟','予安','见山','疏桐','明川','初宁','守拙','云岫','时雨','怀远'];
  const names=surnames.flatMap(surname=>given.map(name=>surname+name));
  const used=new Set(Object.values(s.persons).filter(other=>other.id!==p.id).map(other=>other.name));
  const pool=names.filter(name=>!used.has(name));
  p.name=pool.length?pool[Math.floor(draw(s)*pool.length)]:names[Math.floor(draw(s)*names.length)]+'·'+p.id.split(':').at(-1);

}

const CHARACTER_JOBS=[
  ['种植人','木作匠','药草采集人','渡口记账人','乡塾教习','行商'],
  ['园圃经营者','器具匠','药铺伙计','货栈账房','私塾教习','商队联络人'],
  ['农事技术员','机修工','卫生员','仓储调度员','夜校教师','报馆采访员'],
  ['生态调查员','设备维护员','社区健康协助员','物流协调员','社区教师','资料整理员'],
];
export function initializeCharacter(s:GameState,p:Person):void {
  const choose=<T>(items:readonly T[]):T=>items[Math.floor(draw(s)*items.length)];
  const era=s.era?.index??0,v=p.vitality!;
  const origins=[
    ['在河谷村落长大，曾随邻人连夜修补被水冲坏的堤口。','幼时常在山村之间搬运粮种，习惯把沿途水源记在纸上。','在乡塾窗外听课，靠替人整理旧册换来识字的机会。'],
    ['在集镇货栈旁长大，见过一纸失信如何让几户人家断了生计。','曾随长辈往来各地市集，对不同地方的做事方法格外好奇。','在作坊街住了多年，记得每次停工时街坊相互借粮的情景。'],
    ['在工厂聚集的街区长大，曾帮夜校抄写给晚班工人的讲义。','亲历过一次供水中断，此后总想弄清日常设施为何会失灵。','从乡间来到工业城镇，仍保存着家乡寄来的种子和书信。'],
    ['在城市社区长大，参与过一次物资互助，见过系统遗漏的普通人。','曾帮助整理一批无人问津的旧档案，从中发现技术进步的代价。','少年时经历过极端天气停课，自此习惯为邻里检查应急物资。'],
  ];
  const vocation=Math.floor(draw(s)*CHARACTER_JOBS[era].length);
  v.character={
    style:choose(['素衣简行，随身只留一本小册','衣着整洁，物件总按次序收好','偏爱旧物，袖口常有亲手补过的针脚','装束利落，说话时目光明亮','喜用温和颜色，举止从容','不拘小节，出门总带一只装满杂物的布袋']),
    temperament:choose(['内敛细察','坦率热忱','沉静坚韧','谨慎认真','洒脱好奇','温厚耐心']),
    background:choose(origins[era]),
    attachment:choose(['挂念故乡的一位旧友，却不知该如何开口写信。','一直珍藏启蒙者赠送的小物，遇到难题时会拿出来看看。','盼着远行的亲人归来，因此格外珍惜每次相聚。','对曾经辜负过的一次信任心怀歉意，想用往后的行动弥补。','习惯先照顾旁人的感受，却不善于说出自己的疲惫。','向往独处，也希望有人愿意耐心听完自己的见闻。']),
    aspiration:choose(['愿把复杂的学问讲给普通人听。','想让依赖他人的人也能拥有选择。','希望亲手做成一件经得住岁月的东西。','想弄清事情的根由，再决定该如何出手。','盼望下一代不必重复自己走过的弯路。','希望在保全自身与照顾旁人之间找到长久之道。']),
    occupation:CHARACTER_JOBS[era][vocation],vocation,originEra:era,
    mood:choose(['对陌生的门中生活既期待又拘谨。','想证明自己，也担心让人失望。','暂时把疑问藏在心里，先认真观察。','愿意尝试新的生活，但仍挂念来处。']),memories:[],
  };
}

export function characterMemory(s:GameState,id:string,key:string,text:string,mood:string,events:GameEvent[]):void {
  const p=s.persons[id],v=p?.vitality,c=v?.character;if(!c||c.memories.some(m=>m.key===key))return;
  c.memories.push({key,age:Math.floor(v!.ageSeasons/4),text});
  const responses:Record<string,string>={'内敛细察':'把这些感受写进札记，暂不急着说出口。','坦率热忱':'想找信任的人谈谈此刻的感受。','沉静坚韧':'打算先把眼前的事做好，让行动说明心意。','谨慎认真':'反复斟酌自己的选择，才慢慢放下顾虑。','洒脱好奇':'又生出新的疑问，想看看下一段路。','温厚耐心':'想到同行者的处境，愿意听听他们的心声。'};
  c.mood=key==='death'?mood:mood+(responses[c.temperament]??'');
  lifeEvent(events,id,'character',`${p.name}：${text}`);
}

// Only actual milestones change the character's story; observing or switching never rerolls it.
export function recordCharacterGrowth(s:GameState,events:GameEvent[]):void {
  if(!s.sect)return;
  for(const [id,m] of Object.entries(s.sect.members)){
    if(!m.admitted)continue;
    const p=s.persons[id],v=p.vitality!,c=v.character;if(!c)continue;
    if(!v.alive){characterMemory(s,id,'death','人生止于此处，门中留下了这份生平。','生平已定。',events);continue;}
    const age=Math.floor(v.ageSeasons/4),known=s.economy?.branches?.learned[id]??[];
    if(age>=s.life!.rules.adultYears)characterMemory(s,id,'adult',`开始独立承担门中事务，也重新思量自己的志向：${c.aspiration}`,'比初来时笃定，仍愿意承认自己有所不知。',events);
    if(known.some(k=>k!=='A0'))characterMemory(s,id,'study','把第一份新学问写进随身札记，第一次觉得疑问有了着落。','因为学有所获而欣喜，想把理解付诸实践。',events);
    if(cultivationKnown(s,'C0',id))characterMemory(s,id,'cultivation','修行渐有根基，开始分辨一时冲动与长久心愿。','能够稍稍安顿心绪，也更在意自己的取舍。',events);
    if(m.discipleId)characterMemory(s,id,'teacher',`收下${s.persons[m.discipleId].name}，发现教人之前也要重新审视自己。`,'期待弟子走出自己的路，也担心教得不够好。',events);
    if(s.persons[id].practices.includes('dao:teach'))characterMemory(s,id,'teaching','第一次把所学真正教给弟子，才察觉自己也在受教。','因彼此理解而温暖，愿意多一点耐心。',events);
    if(s.sect.improvements.some(i=>i.personId===id))characterMemory(s,id,'doctrine','把多年研证写成本门心法，留给尚未相识的后来者。','感到欣慰，也提醒自己不要把经验当成唯一答案。',events);
    if(age>=35)characterMemory(s,id,'mature',`走过一段岁月，再看当年的心愿：${c.aspiration}`,'少了一些急切，更珍惜能够同行的人。',events);
    if(!s.sect.current.includes(id)&&m.generation<s.clock.generation)characterMemory(s,id,'retired','把门中事务交给弟子，仍愿在被问及时细说旧日经验。','有卸下重担的轻松，也有不愿惊动后辈的牵挂。',events);
    if(age>=s.life!.rules.agingYears)characterMemory(s,id,'elder',`开始整理散落的书信与札记。${c.attachment}`,'对未竟之事仍有牵挂，愿把时间留给重要的人。',events);
    const era=s.era?.index??0;
    if(era!==c.originEra&&!c.memories.some(n=>n.key==='era:'+era)){
      c.occupation=CHARACTER_JOBS[era][c.vocation];
      characterMemory(s,id,'era:'+era,`时代变迁，开始以${c.occupation}的身份接触新的社会事务。`,'面对新的生活有些陌生，仍愿从头学起。',events);
    }
  }
}
export function initializeLife(s:GameState,r:LifeRules):void {
  s.life={rules:structuredClone(r),timeRemaining:r.timePerSeason};
  activePerson(s).vitality=makeVitality(s,r,40);heir(s).vitality=makeVitality(s,r,16);
  activePerson(s).vitality!.childId=s.household.heirId;
  namePerson(s,activePerson(s));namePerson(s,heir(s));
  heir(s).vitality!.upbringing={fedSeasons:0,companySeasons:0,taughtSeasons:0};
}
export function beginEraLife(s:GameState,events:GameEvent[]):void {
  if(!s.life)return;
  if(s.sect){lifeEvent(events,s.household.activePersonId,'era-start','时代变化，师徒谱系、修为和个人所学延续');return;}
  const id=`person:${Object.keys(s.persons).length+1}`,person=blankPerson(id,'新时代经营者');
  person.vitality=makeVitality(s,s.life.rules,s.life.rules.adultYears);
  s.persons[id]=person;namePerson(s,person);
  s.household.activePersonId=id;s.household.heirId=id;s.household.memberIds=[id];
  if(s.economy?.branches){s.economy.branches.learned[id]=['A0'];person.practices.push('technology:A0');}
  delete s.life.pendingRetirement;delete s.life.consultPending;
  delete s.life.seasonCompany;delete s.life.seasonTaught;s.life.consulted=[];
  s.clock.generation++;s.clock.turn=0;s.status='active';
  // Equipment remains, but a new person must choose what to operate personally.
  if(s.economy?.industry)for(const machine of Object.values(s.economy.industry.instances))if(machine?.operator==='self')machine.enabled=false;
  lifeEvent(events,id,'era-start',`新时代从${person.name}开始：${person.vitality.sex==='male'?'男':'女'}，${s.life.rules.adultYears}岁，天赋「${TALENTS[person.vitality.talent].name}」。与上一时代没有亲属关系，个人知识从基础开始。`);
}
export function healthCeiling(v:Vitality,r:LifeRules):number {return Math.max(30,100-Math.max(0,Math.floor(v.ageSeasons/4)-r.agingYears)*2);}
export function pressureMultiplier(pressure:number,r?:LifeRules):number {return 1+Math.max(0,pressure-(r?.pressureThreshold??20))*(r?.pressureTimePercent??1)/100;}
export function pressureTime(s:GameState,time:number):number {return time>0?Math.ceil(time*pressureMultiplier(activePerson(s).vitality?.pressure??0,s.life?.rules)*2-1e-9)/2:0;}
export function relaxationRate(s:GameState,method='self'):number {
 const v=activePerson(s).vitality!,c=s.life?.calendar;
 const tea=method==='tea'?landscapeSource(s,'tea'):undefined,r=s.economy?.farm?.rules;
 const base=tea&&r?(tea.landscape!.level===3?r.landscapeTeaReliefUpgraded:r.landscapeTeaRelief):s.life!.rules.restRecovery;
 return (base+(hasTalent(v,'resilient')?1:0))*2+(c?.diet==='hearty'?c.rules.heartyRecovery:0)+((c?.mealDays??0)>0?c!.rules.mealRecovery:0);
}
export function lifeView(p:Person,r?:LifeRules) {
  const v=p.vitality;
  return v?{sex:v.sex,portrait:v.portrait,portraitEra:v.portraitEra,ageYears:Math.floor(v.ageSeasons/4),ageQuarter:Math.floor(v.ageSeasons%4),health:Math.round(v.health*100)/100,...(r?{maxHealth:healthCeiling(v,r)}:{}),pressure:Math.round(v.pressure*100)/100,timeMultiplier:pressureMultiplier(v.pressure,r),alive:v.alive,character:v.character?structuredClone(v.character):null,talent:TALENTS[v.talent],experiences:v.experiences?structuredClone(v.experiences):null,earnedTalents:(v.experiences?.talents??[]).map(t=>TALENTS[t]),upbringing:v.upbringing?{...v.upbringing}:null}:undefined;
}
// Living direct ancestors of the active person; retired elders stay consultable while alive.
export function livingElders(s:GameState):Person[] {
  const out:Person[]=[];const seen=new Set<string>();let current=s.household.activePersonId;
  while(!seen.has(current)){
    seen.add(current);
    const parent=s.sect?(s.sect.members[current]?.masterId?s.persons[s.sect.members[current].masterId!]:undefined):Object.values(s.persons).find(p=>p.vitality?.childId===current);
    if(!parent)break;
    if(parent.vitality?.alive&&parent.id!==s.household.heirId)out.push(parent);
    current=parent.id;
  }
  return out;
}
// Branch nodes a living elder has mastered, the active person has not, and this generation has not yet consulted on.
export function consultableNodes(s:GameState,elder:Person):string[] {
  const b=s.economy?.branches;if(!b)return [];
  const mine=b.learned[s.household.activePersonId]??[];
  return (b.learned[elder.id]??[]).filter(id=>nodeInEra(s,id)&&!mine.includes(id)&&!(s.life?.consulted??[]).includes(id));
}
export function lifeEvent(events:GameEvent[],personId:string,operation:string,detail:string):void {events.push({type:'life',personId,operation,detail});}
const physical=new Set(['cook','farmrare','farmstory','farmplot','farmexplore','farmreclaim','farmfertilize','farm','gather','work','build','process','finish','fertilize','nutrient','reclaim','expeditionship']);
const learning=new Set(['study','research','tuition','branchlearn']);
const management=new Set(['channel','hire','checkout','assign','resumeplans','charter','foodplan','farmplan','productionplan','supplyplan','salesplan','careplan','mineplan','steamplan']);
// Cost categories describe personal involvement, not the number of UI clicks.
export function lifeCost(s:GameState,id:string,oldAp:number,useLearningPoint=true):{time:number;energy:number} {
  const [,op,target]=id.split(':');
  if(id==='handover'||op==='end'||op==='erasettle'||op==='retire')return {time:0,energy:0};
  if(op==='rest')return {time:4,energy:0};
  if(op==='care')return {time:s.life?.renewal?.careTime??4,energy:s.life?.renewal?.careEnergy??1};
  if(op==='company')return {time:s.life?.renewal?.companyTime??2,energy:s.life?.renewal?.companyEnergy??1};
  if(op==='pause'||op==='assign'||target==='off'||oldAp===0&&op!=='farm'&&op!=='farmplot'&&op!=='farmrare'&&op!=='process')return {time:0,energy:0};
  // Powered tools still require a brief personal instruction, but remove bodily labour.
  if(oldAp===0)return {time:1,energy:0};
  let time=physical.has(op)||learning.has(op)||op==='teach'||op==='branchteach'?4:2;
  let energy=physical.has(op)?4:learning.has(op)||op==='teach'||op==='branchteach'?2:1;
  if(s.life?.renewal&&['farm','farmplot','farmrare'].includes(op)){time=s.life.renewal.farmTime;energy=s.life.renewal.farmEnergy;}
  if(s.economy?.farm&&['farm','farmplot'].includes(op)&&equipped(s,'W01')){const f=op==='farm'?s.economy.field:plotField(s,target.split('-')[0]);if(f?.crop&&f.growth<f.duration)energy/=2;}
  const v=activePerson(s).vitality!;
  if(s.era&&learning.has(op))time=Math.max(1,time-(eraCard(s)?.learning??0));
  if(s.era&&op==='process'&&s.economy!.branches!.learned[s.household.activePersonId]?.includes('Q1'))energy=Math.max(0,energy-1);
  if(hasTalent(v,'strong')&&physical.has(op))energy--;
  if(s.economy?.industry&&op==='branchlearn'&&s.economy.branches!.archives.includes(target))time=Math.max(1,time-s.economy.industry.rules.archiveDiscount);
  if(hasTalent(v,'scholar')&&learning.has(op))time=Math.max(1,time-1);
  if(hasTalent(v,'mentor')&&(op==='teach'||op==='branchteach')){time--;energy--;}
  if(hasTalent(v,'organizer')&&management.has(op))time=Math.max(1,time-1);
  if(s.life?.renewal&&op==='branchlearn'&&ancestorKnows(s,target)){time=Math.min(time,s.life.renewal.inheritedTime);energy=Math.min(energy,s.life.renewal.inheritedEnergy);}
  if(s.life?.renewal&&op==='branchlearn'&&s.life.consultPending===target)time=Math.max(1,time-s.life.renewal.consultDiscount);
  if(useLearningPoint&&learning.has(op)&&v.experiences?.learning)time=Math.max(1,time-1);
  energy=Math.max(0,Math.round(energy* s.life!.rules.baseEnergy/Math.max(1,v.constitution)*100)/100);
  return {time,energy};
}
export function canSucceed(s:GameState):boolean {if(s.sect)return sectSuccessors(s).length>=1;const v=heir(s).vitality;return s.household.heirId!==s.household.activePersonId&&!!v?.alive&&v.ageSeasons>=s.life!.rules.adultYears*4;}
export function recordLifeGeneration(s:GameState,events:GameEvent[]):void {
  const trial=project(s);
  events.push({type:'generation-ended',final:s.status==='ended',facts:{
    generation:s.clock.generation,food:s.household.food,money:s.household.money,
    mastered:[...(s.economy?.branches?.learned[s.household.activePersonId]??activePerson(s).mastered)],heir:[...(s.economy?.branches?.learned[s.household.heirId]??heir(s).mastered)],archives:[...s.knowledge.archives],
    project:trial?{started:trial.started,control:seedValue(trial.control),candidate:seedValue(trial.candidate),samples:structuredClone(trial.samples)}:null,
    ...(s.production?{production:structuredClone(s.production)}:{}),
  }});
}
export function settleLife(s:GameState,missing:number,events:GameEvent[],foodRequired=2,days?:number):void {
  const r=s.life!.rules;
  const delta=days===undefined?1:days*4/calendarYearDays(s.life!.calendar!.rules.referenceYear,s.life!.calendar!.absoluteDay);
  const previousAge=new Map(s.household.memberIds.map(id=>[id,s.persons[id].vitality?.ageSeasons??0]));
  for(const person of s.household.memberIds.map(id=>s.persons[id])) {
    const v=person.vitality;if(!v?.alive)continue;
    v.ageSeasons+=delta;
    const renewal=s.life!.renewal;
    const independent=person.id===s.economy?.farm?.neighbor.personId;
    const personMissing=independent?0:missing;
    const deficit=Math.min(1,personMissing/Math.max(1,foodRequired));
    const damage=renewal?Math.ceil(r.hungerDamage*deficit*Math.min(1,Math.max(0,s.household.hardship-renewal.graceSeasons)/2)):r.hungerDamage;
    v.health=Math.max(0,Math.min(healthCeiling(v,r),v.health+(s.life?.calendar?(personMissing?0:delta):(personMissing?-damage:(renewal?.fedHealth??1)))));
    if(v.health===0||v.ageSeasons>=v.lifespanSeasons){v.alive=false;v.pressure=0;lifeEvent(events,person.id,'death',`${person.name}因${v.health===0?'健康耗尽':'自然衰老'}离世`);}
    else if(days===undefined||Math.floor(previousAge.get(person.id)!/4)!==Math.floor(v.ageSeasons/4))lifeEvent(events,person.id,'season',`${person.name}：${Math.floor(v.ageSeasons/4)}岁，健康${v.health}，压力${v.pressure}`);
  }
  // Childhood upbringing: each season fed / accompanied / taught is recorded and
  // settled once into constitution at adulthood; birth talent remains unchanged.
  for(const person of s.household.memberIds.map(id=>s.persons[id])) {
    const v=person.vitality;if(!v?.alive||!v.upbringing)continue;
    if(v.ageSeasons<r.adultYears*4){
      if(!missing)v.upbringing.fedSeasons+=delta;
      if(person.id===s.household.heirId){
        if(s.life!.seasonCompany)v.upbringing.companySeasons+=delta;
        if(s.life!.seasonTaught)v.upbringing.taughtSeasons+=delta;
      }
    }else if(previousAge.get(person.id)!<r.adultYears*4){
      const up=v.upbringing,span=r.adultYears*4;
      const bonus=Math.round(r.growthConstitutionBonus*Math.min(1,(up.fedSeasons+up.companySeasons)/span));
      v.constitution+=bonus;
      lifeEvent(events,person.id,'adulthood',`${person.name}成年：饱食${up.fedSeasons}季、陪伴${up.companySeasons}季、受教${up.taughtSeasons}季；体质+${bonus}，保留出生天赋「${TALENTS[v.talent].name}」`);
    }
  }
  if(days===undefined){delete s.life!.seasonCompany;delete s.life!.seasonTaught;}
  // One descendant per person; born during life, never created as an adult on handover.
  // Retired ancestors do not start additional branches.
  for(const person of s.sect?[]:new Set([activePerson(s),heir(s)])) {
    const v=person.vitality!;
    if(!v.alive||v.childId||v.ageSeasons<r.birthYears*4)continue;
    const id=`person:${Object.keys(s.persons).length+1}`,child=blankPerson(id,'成长中的后辈');
    child.vitality=makeVitality(s,r,0);child.vitality.upbringing={fedSeasons:0,companySeasons:0,taughtSeasons:0};s.persons[id]=child;s.household.memberIds.push(id);v.childId=id;
    if(person.id===s.household.activePersonId&&s.household.heirId===person.id)s.household.heirId=id;
    namePerson(s,child);
    lifeEvent(events,id,'birth',`家族迎来${child.vitality.sex==='male'?'男孩':'女孩'}${child.name}，出生天赋「${TALENTS[child.vitality.talent].name}」，从零岁成长，不自动获得知识`);
  }
  if(s.sect){
    if(!activePerson(s).vitality!.alive){
      s.status=canSucceed(s)?'handover':'ended';
    }
    return;
  }
  if(!activePerson(s).vitality!.alive){
    s.status=canSucceed(s)?'handover':'ended';
    lifeEvent(events,s.household.activePersonId,'succession',s.status==='handover'?'成年后辈可接手':'没有可接手的成年后辈，本次家族经营结束');
  }
}


export function initialCultivation():CultivationState{return {progress:{},upkeep:0};}
export function initializeSect(s:GameState,r:SectRules):void {
  const ids=[s.household.activePersonId,s.household.heirId] as [string,string];
  s.sect={curriculumVersion:1,rules:structuredClone(r),current:ids,members:{},doctrine:0,research:0,improvements:[],fortune:0,cards:{study:0,craft:0,teach:0,prepare:0},draws:0,lastDraw:'旧机缘已停用',seasonChance:0,seasonBonus:null,nextBonus:null,lastEvent:'从修身入门，逐课修习。'};
  for(const id of ids){
    const p=s.persons[id];p.vitality=makeVitality(s,s.life!.rules,s.life!.rules.adultYears+2);namePerson(s,p);
    initializeCharacter(s,p);
    s.sect.members[id]={generation:1,masterId:null,discipleId:null,candidateId:null,admitted:true,practice:0,rewardedStage:0,time:s.life!.rules.timePerSeason,consulted:[],cultivation:initialCultivation()};
  }
  s.household.heirId=s.household.activePersonId;
}
export function cultivationRequired(s:GameState,course:CultivationCourse):number{return s.sect!.rules.stageProgress*course.tier;}
export function cultivationKnown(s:GameState,courseId:string,personId=s.household.activePersonId):boolean {
  const course=CULTIVATION_COURSES.find(c=>c.id===courseId);
  return !!course&&(s.sect?.members[personId]?.cultivation.progress[courseId]??0)>=cultivationRequired(s,course);
}
export function cultivationMissing(s:GameState,course:CultivationCourse,personId=s.household.activePersonId):string[]{
  return course.parents.filter(id=>!cultivationKnown(s,id,personId)).map(id=>'需先修成'+CULTIVATION_COURSES.find(c=>c.id===id)!.name);
}
export function cultivationQuote(s:GameState,course:CultivationCourse,personId=s.household.activePersonId){
  const r=s.sect!.rules,done=s.sect!.members[personId]?.cultivation.progress[course.id]??0,total=cultivationRequired(s,course);
  const fullTime=pressureTime(s,r.practiceTime*(s.life?.calendar?.rules.actionDaysPerUnit??1));
  const remaining=Math.max(0,total-done),wanted=Math.ceil(Math.min(1,remaining/r.practiceGain)*fullTime*2)/2;
  const time=Math.max(0,Math.min(wanted,Math.floor(Math.min(availableDays(s),dietView(s)?.days??Infinity)*2)/2));
  const progress=Math.min(remaining,r.practiceGain*time/fullTime);
  return {done,total,time,progress,energy:Math.round(r.practiceEnergy*time/fullTime*100)/100};
}
export function completeCultivationStudy(s:GameState,personId:string,course:CultivationCourse,progress:number,events:GameEvent[]):void {
  const m=s.sect!.members[personId],total=cultivationRequired(s,course),before=m.cultivation.progress[course.id]??0;
  m.cultivation.progress[course.id]=Math.min(total,Math.round((before+progress)*1000000)/1000000);
  m.cultivation.upkeep=s.sect!.rules.upkeepMax;
  const complete=before<total&&m.cultivation.progress[course.id]>=total;
  lifeEvent(events,personId,'cultivation',`${s.persons[personId].name}${complete?'修成':'修习'}「${course.name}」：${m.cultivation.progress[course.id]}/${total}；功课已温习。课程效果待定，未增加行动加成。`);
  if(complete)characterMemory(s,personId,'cultivation:'+course.id,`修成「${course.name}」，将这一段习练记入札记。`,'所学又多了一点，想在日常里慢慢体会。',events);
}
export function maintainCultivation(s:GameState,personId:string,events:GameEvent[]):void {
  const c=s.sect!.members[personId].cultivation,r=s.sect!.rules,before=c.upkeep;
  c.upkeep=Math.min(r.upkeepMax,c.upkeep+r.upkeepGain);
  lifeEvent(events,personId,'cultivation-daily',`温习日课，功课可维持${c.upkeep}天（增加${c.upkeep-before}天）；已学课程不会因疏于温习而遗失。效果待定。`);
}
export function advanceCultivation(s:GameState,days:number):void {
  if(!s.sect)return;
  for(const [id,m]of Object.entries(s.sect.members))if(m.admitted&&s.persons[id]?.vitality?.alive)m.cultivation.upkeep=Math.max(0,Math.round((m.cultivation.upkeep-days)*1000000)/1000000);
}
// Course effects are deliberately unspecified. Old stage/card discounts must not leak into this tree.
export function sectCosts(_s:GameState,_id:string,cost:{time:number;energy:number}){return cost;}
export function sectSuccessors(s:GameState):string[] {
  if(!s.sect)return [];return [s.sect.current[0]].map(id=>s.sect!.members[id].discipleId).filter((id):id is string=>!!id&&!!s.persons[id]?.vitality?.alive&&s.persons[id].vitality!.ageSeasons>=s.life!.rules.adultYears*4);
}
export function selectSectPerson(s:GameState,id:string):void {
  const x=s.sect!,old=x.members[s.household.activePersonId];
  if(old){old.time=s.life!.timeRemaining;old.consulted=[...(s.life!.consulted??[])];old.consultPending=s.life!.consultPending;}
  s.household.activePersonId=id;s.household.heirId=x.members[id].discipleId??id;
  s.life!.timeRemaining=x.members[id].time;s.life!.consulted=[...x.members[id].consulted];s.life!.consultPending=x.members[id].consultPending;
}
export function renewSect(s:GameState):void {
  const x=s.sect;if(!x)return;
  for(const [id,m] of Object.entries(x.members))if(m.admitted){m.time=s.life!.rules.timePerSeason;if(id===s.household.activePersonId)m.time=s.life!.timeRemaining;}
}
export function settleSect(s:GameState,_events:GameEvent[]):void {
  if(s.sect)s.sect.members[s.household.activePersonId].time=s.life!.timeRemaining;
}
export function sectView(s:GameState){
  const x=s.sect;if(!x)return null;
  const discipleId=x.members[s.household.activePersonId].discipleId;
  const courses=CULTIVATION_COURSES.map(c=>({...structuredClone(c),...cultivationQuote(s,c),known:cultivationKnown(s,c.id),missing:cultivationMissing(s,c),learnActionId:'economy:sectlearn:'+c.id,teachActionId:'economy:sectteach:'+c.id,disciple:discipleId?{id:discipleId,known:cultivationKnown(s,c.id,discipleId),progress:x.members[discipleId].cultivation.progress[c.id]??0,missing:cultivationMissing(s,c,discipleId)}:null}));
  return {curriculumVersion:x.curriculumVersion,rules:{...x.rules},tracks:structuredClone(CULTIVATION_TRACKS),courses,effect:null,dailyActionId:'economy:sectdaily:practice',
    current:[...x.current],activeId:s.household.activePersonId,ready:canSucceed(s),
    members:Object.entries(x.members).map(([id,m])=>({id,name:s.persons[id].name,...structuredClone(m),completedCourses:CULTIVATION_COURSES.filter(c=>cultivationKnown(s,c.id,id)).map(c=>c.id),time:id===s.household.activePersonId?s.life!.timeRemaining:m.time,relationships:Object.entries(s.persons[id].vitality?.experiences?.relationships??{}).map(([otherId,value])=>({name:s.persons[otherId]?.name??otherId,value})),life:lifeView(s.persons[id],s.life!.rules)})),
    lastEvent:x.lastEvent};
}
export function hasTalent(v:Vitality,talent:Talent):boolean {
  return v.talent===talent||!!v.experiences?.talents.includes(talent);
}

// Record the paying actor before execution: switching people cannot transfer choices.
export function recordSeasonChoice(s:GameState,id:string,events:GameEvent[]):void {
  const v=activePerson(s).vitality,e=v?.experiences;if(!e)return;
  const op=id.split(':')[1];
  if(['end','erasettle','retire','sectswitch'].includes(op)||id==='handover')return;
  if(learning.has(op)&&!s.life?.calendar?.study[s.household.activePersonId+':'+id.split(':')[2]]&&e.learning>0&&lifeCost(s,id,1,false).time>1){
    e.learning--;
    lifeEvent(events,s.household.activePersonId,'learning-point','消耗1学习点，基础学习时间减少1；剩余'+e.learning+'点');
  }
  if(!e.actions.includes(op))e.actions.push(op);
}

export function settleSeasonEncounter(s:GameState,missing:number,events:GameEvent[]):void {
  if(!s.life)return;
  const people=(s.sect?[s.sect.current[0]]:s.household.memberIds).map(id=>s.persons[id]).filter(p=>p.vitality?.alive&&p.vitality.experiences);
  if(!people.length)return;
  const p=people[Math.floor(draw(s)*people.length)],v=p.vitality!,e=v.experiences!,r=s.life.rules;
  const has=(ops:string[])=>e.actions.some(a=>ops.includes(a));
  const studying=has(['study','research','tuition','branchlearn','sectlearn']);
  const working=has(['cook','farmrare','farmstory','farmplot','farmreclaim','farmexplore','farmfertilize','farm','gather','work','process','build','sysrun','finish']);
  const caring=has(['company','consult','teach','branchteach','sectteach','bond']);
  const rested=has(['rest','care']);
  const others=Object.values(s.persons).filter(q=>q.id!==p.id&&q.vitality?.alive&&q.vitality.experiences&&(!s.sect||s.sect.members[q.id]?.admitted));
  const contacted=others.filter(q=>e.contacts.includes(q.id));
  const pool=contacted.length?contacted:others;
  const other=pool.length?pool[Math.floor(draw(s)*pool.length)]:undefined;
  const trust=other?(e.relationships[other.id]??0):0;
  const strained=missing>0||v.health<50;
  // Choices change both which encounter is drawn and its outcome, without guaranteeing success.
  const candidates=[{kind:'daily',weight:2},{kind:'study',weight:studying?6:1},{kind:'work',weight:working?6:1},{kind:'body',weight:strained?6:1},...(other?[{kind:'bond',weight:caring?6:2}]:[])];
  let roll=draw(s)*candidates.reduce((n,c)=>n+c.weight,0);
  const kind=candidates.find(c=>(roll-=c.weight)<0)!.kind;
  // Content stays in the life system; all variants use the same bounded settlement.
  // Eligibility describes a real circumstance, while preparation changes the outcome odds.
  const scenes:{kind:string;eligible:boolean;prepared:boolean;positive:[string,string];negative:[string,string]}[]=[
    {kind:'study',eligible:true,prepared:studying,positive:['札记中的顿悟','重读旧日札记时，几个零散的问题终于接在了一起。'],negative:['思路陷入瓶颈','试着梳理旧问题，却发现原先的解释彼此矛盾，只能暂缓推演。']},
    {kind:'study',eligible:has(['teach','branchteach','sectteach','consult']),prepared:caring,positive:['问答相长','一次授业问答迫使自己重新解释熟悉的道理，反而看清了遗漏之处。'],negative:['解答留下疑窦','授业问答中的追问触到了理解的空白，原有思路需要重新整理。']},
    {kind:'study',eligible:has(['sectpractice']),prepared:true,positive:['静坐闻新意','静修之后重新看待困扰已久的问题，浮躁退去，思路渐明。'],negative:['静修杂念生','静修中反复想起未竟之事，越想求一个答案，越难集中精神。']},
    {kind:'study',eligible:(s.economy?.branches?.learned[p.id]?.length??0)>1,prepared:studying,positive:['旧学互相印证','不同课程中的知识在一件小事上互相印证，终于能举一反三。'],negative:['旧说彼此冲突','把两门学问放在一起思考，却发现适用条件并不相同，先前的理解需要修正。']},
    {kind:'study',eligible:(s.era?.index??0)>=2,prepared:studying,positive:['新刊打开眼界','读到关于新技术的公开资料，认出了其中与自己所学相通的线索。'],negative:['新术名词迷阵','新资料中的名词与旧日用法相差太远，一番比对后仍难理清脉络。']},
    {kind:'work',eligible:true,prepared:working,positive:['辛劳得到酬谢','一份零散活计顺利交付，对方按约送来了酬劳。'],negative:['临工结算折损','零散活计在结算时出了差错，为了补齐交付只能承担一笔开支。']},
    {kind:'work',eligible:has(['farmplot','farmfertilize','farm','fertilize']),prepared:true,positive:['田间经验获谢','邻人借鉴了本季的田间经验，特意送来一份谢钱。'],negative:['田间补修支出','田间劳作暴露出一些需要补修的小问题，只好另付费用处理。']},
    {kind:'work',eligible:has(['build','process','finish','sysbuild']),prepared:true,positive:['手艺赢得口碑','本季做活的细致之处被人看见，额外的酬谢随之而来。'],negative:['返工赔付','交付时发现一处疏漏，需要花钱补救，手艺上的教训也记在了心里。']},
    {kind:'work',eligible:has(['gather']),prepared:true,positive:['识材受到赏识','采集时辨识材料的经验帮上了旁人的忙，换来一笔报酬。'],negative:['采集行装损耗','采集途中随身行装受损，回程后不得不支付修补费用。']},
    {kind:'work',eligible:has(['sysrun','syscommission']),prepared:true,positive:['设备经验获酬','亲自操作设备积累的经验解决了旁人的疑问，对方付钱致谢。'],negative:['操作疏漏赔补','设备操作中的疏漏带来了额外赔补，必须从公用钱财中支付。']},
    {kind:'daily',eligible:true,prepared:caring,positive:['意外的谢礼','曾经顺手帮过的人送来谢礼，一件早已淡忘的小事得到了回应。'],negative:['临时开支','日常用物突然需要替换，一笔计划之外的开支打乱了安排。']},
    {kind:'daily',eligible:s.household.money<=r.eventMoney,prepared:has(['work','sell','checkout']),positive:['周转得到援手','手头紧张时，有人送来一笔不必偿还的资助，暂时缓解了周转压力。'],negative:['拮据又逢支出','钱财本已紧张，又遇上不得不处理的小额开支，心中更添焦虑。']},
    {kind:'daily',eligible:s.location.weather!=='normal',prepared:has(['care','rest','checkout']),positive:['邻里应候相助','天气扰乱了日常生活，邻里互相照应，也送来了一份应急资助。'],negative:['天气添了花销','异常天气带来了日常修缮与出行开支，原有预算不再宽裕。']},
    {kind:'daily',eligible:v.ageSeasons>=35*4,prepared:caring,positive:['故人托来薄礼','多年未见的故人托人送来一份薄礼，也让人想起过去相助的日子。'],negative:['旧物修缮','一件用了多年的旧物终于需要修缮，舍不得丢弃，便花钱留住这段旧日记忆。']},
    {kind:'daily',eligible:has(['buy','sell','checkout','sellfood']),prepared:true,positive:['集市退回余款','集市对账时查出此前多收的款项，对方主动将余款送回。'],negative:['集市账目差错','集市对账发现自己先前漏算了一笔费用，只能补上差额。']},
    {kind:'body',eligible:true,prepared:rested,positive:['身心渐复','这段日子的作息渐渐安稳，身体也慢慢缓过劲来。'],negative:['偶感不适','换季时有些不适，平日习以为常的小事也显得费力。']},
    {kind:'body',eligible:rested,prepared:true,positive:['休养见效','本季专门留出的休养时间有了回应，醒来时比往日轻松。'],negative:['休养仍有反复','虽然花了时间休养，身体仍有反复，还需要继续照料自己。']},
    {kind:'body',eligible:working,prepared:rested,positive:['劳后调息得法','劳作后的调息渐渐找到了节奏，紧绷的身体得到舒展。'],negative:['积劳不适','连续劳作留下的疲乏显现出来，身体提醒自己不能一直硬撑。']},
    {kind:'body',eligible:missing>0,prepared:rested||caring,positive:['饥困中得到照护','缺粮的日子里得到了一些照护，身体稍感宽慰；本季欠下的口粮仍须结算。'],negative:['饥困难安眠','口粮不足让人难以安眠，疲惫也更难消退；之后仍照常承受缺粮影响。']},
    {kind:'body',eligible:v.ageSeasons>=r.agingYears*4,prepared:rested,positive:['暮年调养有方','学着接受身体的变化，日常调养终于有些成效，但岁月并没有倒流。'],negative:['旧疾随岁月反复','年岁渐长，一些旧日的不适又出现了，需要更耐心地照护自己。']},
    {kind:'bond',eligible:!!other,prepared:caring,positive:['谈话解开心结','与{对方}说起近日的挂念，原来彼此都有尚未说出口的体谅。'],negative:['一场未解的争执','与{对方}谈起一件小事，却越说越急，许多真正的想法反而没能表达。']},
    {kind:'bond',eligible:!!other&&e.contacts.includes(other.id),prepared:true,positive:['坦诚之后更亲近','本季的谈心有了回响，{对方}愿意再多说一点自己的难处。'],negative:['好意被误解','本季谈心中的一句建议被{对方}听成了责备，好意暂时没能抵达。']},
    {kind:'bond',eligible:!!other&&(s.sect?.members[p.id]?.masterId===other.id||s.sect?.members[p.id]?.discipleId===other.id),prepared:has(['teach','branchteach','sectteach','consult','bond']),positive:['师徒互相体谅','与{对方}聊起求学的不易，师徒都看见了对方努力之外的顾虑。'],negative:['师徒期许错位','与{对方}对成长的快慢有了不同期待，关切不经意间变成了压力。']},
    {kind:'bond',eligible:!!other&&trust<0,prepared:caring,positive:['旧怨渐渐松动','与{对方}重新说起旧日的不快，虽然尚未完全释怀，至少愿意再听一句。'],negative:['旧怨又被提起','与{对方}的旧事被重新提起，话里的防备让隔阂又深了一层。']},
    {kind:'bond',eligible:!!other&&trust>0,prepared:caring,positive:['托付得到回应','一件小小的托付得到了{对方}认真回应，彼此的信任因此更稳。'],negative:['熟稔生出疏忽','因为与{对方}太过熟悉，反而忽略了应有的解释，对方难免失落。']},
  ];
  const eligible=scenes.filter(scene=>scene.kind===kind&&scene.eligible);
  const fresh=eligible.filter(scene=>!e.lastEvent.includes(scene.positive[0])&&!e.lastEvent.includes(scene.negative[0]));
  const available=fresh.length?fresh:eligible;
  const scene=available[Math.floor(draw(s)*available.length)];
  const relevant=scene.prepared;
  const optimistic=v.character?.temperament==='坦率热忱'||v.character?.temperament==='温厚耐心';
  const chance=Math.max(0.15,Math.min(0.9,0.5+(relevant?0.2:0)-(strained?0.2:0)+(optimistic?0.05:0)+(kind==='bond'?trust*0.03:0)));
  const good=draw(s)<chance,large=draw(s)<0.15,factor=large?2:1;
  const reasons=[relevant?'本季相关投入提高了顺利的机会':'本季缺少相关投入',strained?'缺粮、疲惫或健康不佳增加了波折':'身体与生活尚能支撑',...(kind==='bond'?[`与${other!.name}的原有关系${trust}`]:[]),...(optimistic?['开朗或温厚的性格帮助应对变故']:[])];
  const [title,narrative]=good?scene.positive:scene.negative;
  const story=narrative.replaceAll('{对方}',other?.name??'同行者');
  let effect='',talent:Talent='resilient';
  if(kind==='study'){
    talent='scholar';
    const before=e.learning;e.learning=Math.max(0,Math.min(12,e.learning+(good?1:-1)*r.eventLearning*factor));
    effect=`学习点${e.learning-before>=0?'+':''}${e.learning-before}（现有${e.learning}）`;
  }else if(kind==='work'||kind==='daily'){
    talent=kind==='work'?'strong':'organizer';
    const before=s.household.money;s.household.money=Math.max(0,before+(good?1:-1)*r.eventMoney*factor);
    effect=`钱财${s.household.money-before>=0?'+':''}${s.household.money-before}`;
  }else if(kind==='body'){

    const before=v.health;v.health=Math.max(1,Math.min(healthCeiling(v,r),v.health+(good?1:-1)*r.eventHealth*factor));
    effect=`健康${v.health-before>=0?'+':''}${v.health-before}`;
  }else{
    talent='mentor';
    const q=other!,qe=q.vitality!.experiences!,before=trust;
    const after=Math.max(-5,Math.min(5,before+(good?1:-1)*factor));
    e.relationships[q.id]=after;qe.relationships[p.id]=after;
    effect=`与${q.name}的关系${after-before>=0?'+':''}${after-before}（${after}，范围-5至5）`;
    if(q.vitality!.character)characterMemory(s,q.id,`encounter:${s.clock.absoluteTurn}`,`${title}：${narrative.replaceAll('{对方}',p.name)}`,good?'感到被理解。':'还有一些委屈需要说开。',events);
  }
  if(good&&relevant&&draw(s)*100<r.eventTalentPercent&&!hasTalent(v,talent)){
    e.talents.push(talent);effect+=`；获得终身天赋「${TALENTS[talent].name}」：${TALENTS[talent].effect}`;
  }
  e.outlook=Math.max(-r.eventPersonalityThreshold,Math.min(r.eventPersonalityThreshold,e.outlook+(good?1:-1)));
  if(v.character&&Math.abs(e.outlook)>=r.eventPersonalityThreshold){
    const temperament=good?(kind==='bond'?'温厚耐心':'坦率热忱'):'谨慎认真';
    if(v.character.temperament!==temperament){v.character.temperament=temperament;effect+=`；经历积累，性格转为${temperament}`;}
    e.outlook=0;
  }
  e.lastEvent=`第${s.clock.absoluteTurn}季 · ${title}${large?'（重大）':''}：${story} ${reasons.join('；')}。结果：${effect}。`;
  lifeEvent(events,p.id,'season-encounter',`${p.name}：${e.lastEvent}`);
  characterMemory(s,p.id,`encounter:${s.clock.absoluteTurn}`,`${title}：${story} ${effect}。`,good?'这份经历让人欣慰。':'心中仍有失落，想重新整理生活。',events);
  for(const person of Object.values(s.persons)){const x=person.vitality?.experiences;if(x){x.actions=[];x.contacts=[];}}
}

/** Calendar quotes use half-days; bodily effort remains a separate resource. */
export function calendarCost(s:GameState,id:string,cost:{time:number;energy:number}) {
  const c=s.life?.calendar;if(!c)return cost;
  const op=id.split(':')[1];
  if(['sectlearn','sectteach','sectdaily','farmproject','farmexplore','farmreclaim','wait','diet','branchlearn','cook','wildharvest','landscape'].includes(op))return cost;
  let days=cost.time*c.rules.actionDaysPerUnit;
  if(['farm','farmplot','farmrare'].includes(op))days=cost.time>0?Math.min(1,days):0;
  if(['farmfertilize','fertilize','rest'].includes(op))days=cost.time>0?0.5:0;
  if(learning.has(op))days=cost.time*c.rules.studyDaysPerUnit;
  return {...cost,energy:electricOnline(s,'LAMP')?Math.round(cost.energy*c.rules.lampEnergyPercent)/100:cost.energy,time:days>0?Math.max(0.5,Math.ceil(days*2)/2):0};
}
export {calendarView} from './calendar.js';
export function studyQuote(s:GameState,node:string) {
  const c=s.life?.calendar,key=s.household.activePersonId+':'+node;
  const raw=sectCosts(s,'economy:branchlearn:'+node,lifeCost(s,'economy:branchlearn:'+node,1));
  const total=c?.study[key]?.total??Math.max(0.5,Math.ceil(raw.time*(c?.rules.studyDaysPerUnit??1)*2)/2);
  const done=c?.study[key]?.done??0;
  const fields=s.economy?[s.economy.field,...Object.values(s.economy.farm?.plots??{}).flatMap(p=>p.field?[p.field]:[])]:[];
  const harvest=Math.min(Infinity,...fields.filter(f=>f.crop&&f.growth<f.duration).map(f=>f.duration-f.growth));
  const multiplier=pressureMultiplier(activePerson(s).vitality!.pressure,s.life?.rules);
  const time=c?Math.max(0,Math.min(Math.ceil((total-done)*multiplier*2-1e-9)/2,Math.floor(Math.min(c.rules.workChunkDays,availableDays(s),harvest,dietView(s)?.days??0)*2)/2)):raw.time;
  const progress=c?Math.min(total-done,time/multiplier):time;
  return {key,total,done,time:progress,energy:raw.energy,progress};
}
