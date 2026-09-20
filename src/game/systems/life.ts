import {eraCard} from './eras.js';
import { ancestorKnows } from './ancestry.js';
import { nodeInEra } from '../model/branches.js';
import { activePerson, blankPerson, heir, project, seedValue, type GameState, type Person } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { LifeRules, Talent, Vitality } from '../model/life.js';

export const TALENTS: Record<Talent, {name:string;effect:string}> = {
  strong:{name:'健壮',effect:'亲自体力劳动少消耗1精力'},
  scholar:{name:'善学',effect:'学习、实验与付费授课少用1时间'},
  mentor:{name:'善教',effect:'教导后辈少用1时间、1精力'},
  organizer:{name:'善组织',effect:'招聘、采购与建立经营安排少用1时间'},
  resilient:{name:'善恢复',effect:'主动休息与季末基本恢复额外恢复1精力'},
};
function draw(s:GameState):number {
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
  return {sex,portrait,portraitEra:s.era?.index??0,ageSeasons:age*4,lifespanSeasons,constitution,energy:constitution,health:100,talent,alive:true,childId:null};
}
function namePerson(s:GameState,p:Person):void {
  const names=p.vitality!.sex==='male'?['林禾','林川','林松','林远','林安','林青']:['林穗','林溪','林棠','林宁','林岚','林秋'];
  const unused=names.filter(name=>!Object.values(s.persons).some(other=>other.name===name));
  const pool=unused.length?unused:names;
  p.name=pool[Math.floor(draw(s)*pool.length)];
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
  const id=`person:${Object.keys(s.persons).length+1}`,person=blankPerson(id,'新时代经营者');
  person.vitality=makeVitality(s,s.life.rules,s.life.rules.adultYears);
  if(s.life.renewal)person.vitality.minimumEnergy=s.life.renewal.minimumEnergy;
  s.persons[id]=person;namePerson(s,person);
  s.household.activePersonId=id;s.household.heirId=id;s.household.memberIds=[id];
  if(s.economy?.branches)s.economy.branches.learned[id]=['A0'];
  delete s.life.pendingRetirement;delete s.life.consultPending;
  delete s.life.seasonCompany;delete s.life.seasonTaught;s.life.consulted=[];
  s.clock.generation++;s.clock.turn=0;s.status='active';
  // Equipment remains, but a new person must choose what to operate personally.
  if(s.economy?.industry)for(const machine of Object.values(s.economy.industry.instances))if(machine?.operator==='self')machine.enabled=false;
  lifeEvent(events,id,'era-start',`新时代从${person.name}开始：${person.vitality.sex==='male'?'男':'女'}，${s.life.rules.adultYears}岁，天赋「${TALENTS[person.vitality.talent].name}」。与上一时代没有亲属关系，个人知识从基础开始。`);
}
export function healthCeiling(v:Vitality,r:LifeRules):number {return Math.max(30,100-Math.max(0,Math.floor(v.ageSeasons/4)-r.agingYears)*2);}
export function energyCeiling(v:Vitality):number {return Math.max(v.minimumEnergy??2,Math.floor(v.constitution*(0.4+v.health*0.006)));}
export function lifeView(p:Person,r?:LifeRules) {
  const v=p.vitality;
  return v?{sex:v.sex,portrait:v.portrait,portraitEra:v.portraitEra,ageYears:Math.floor(v.ageSeasons/4),ageQuarter:v.ageSeasons%4,health:v.health,...(r?{maxHealth:healthCeiling(v,r)}:{}),energy:v.energy,maxEnergy:energyCeiling(v),alive:v.alive,talent:TALENTS[v.talent],upbringing:v.upbringing?{...v.upbringing}:null}:undefined;
}
// Living direct ancestors of the active person; retired elders stay consultable while alive.
export function livingElders(s:GameState):Person[] {
  const out:Person[]=[];const seen=new Set<string>();let current=s.household.activePersonId;
  while(!seen.has(current)){
    seen.add(current);
    const parent=Object.values(s.persons).find(p=>p.vitality?.childId===current);
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
const physical=new Set(['farm','gather','work','build','process','finish','fertilize','nutrient','reclaim','expeditionship']);
const learning=new Set(['study','research','tuition','branchlearn']);
const management=new Set(['channel','hire','checkout','assign','resumeplans','charter','foodplan','farmplan','farmcycle','productionplan','supplyplan','salesplan','careplan','mineplan','steamplan']);
// Cost categories describe personal involvement, not the number of UI clicks.
export function lifeCost(s:GameState,id:string,oldAp:number):{time:number;energy:number} {
  const [,op,target]=id.split(':');
  if(id==='handover'||op==='end'||op==='erasettle'||op==='retire')return {time:0,energy:0};
  if(op==='rest')return {time:4,energy:0};
  if(op==='care')return {time:s.life?.renewal?.careTime??4,energy:s.life?.renewal?.careEnergy??1};
  if(op==='company')return {time:s.life?.renewal?.companyTime??2,energy:s.life?.renewal?.companyEnergy??1};
  if(op==='pause'||op==='assign'||target==='off'||oldAp===0&&op!=='farm'&&op!=='process')return {time:0,energy:0};
  // Powered tools still require a brief personal instruction, but remove bodily labour.
  if(oldAp===0)return {time:1,energy:0};
  let time=physical.has(op)||learning.has(op)||op==='teach'||op==='branchteach'?4:2;
  let energy=physical.has(op)?4:learning.has(op)||op==='teach'||op==='branchteach'?2:1;
  if(s.life?.renewal&&op==='farm'){time=s.life.renewal.farmTime;energy=s.life.renewal.farmEnergy;}
  const talent=activePerson(s).vitality!.talent;
  if(s.era&&learning.has(op))time=Math.max(1,time-(eraCard(s)?.learning??0));
  if(s.era&&op==='process'&&s.economy!.branches!.learned[s.household.activePersonId]?.includes('Q1'))energy=Math.max(0,energy-1);
  if(talent==='strong'&&physical.has(op))energy--;
  if(s.economy?.industry&&op==='branchlearn'&&s.economy.branches!.archives.includes(target))time=Math.max(1,time-s.economy.industry.rules.archiveDiscount);
  if(talent==='scholar'&&learning.has(op))time=Math.max(1,time-1);
  if(talent==='mentor'&&(op==='teach'||op==='branchteach')){time--;energy--;}
  if(talent==='organizer'&&management.has(op))time=Math.max(1,time-1);
  if(s.life?.renewal&&op==='branchlearn'&&ancestorKnows(s,target)){time=Math.min(time,s.life.renewal.inheritedTime);energy=Math.min(energy,s.life.renewal.inheritedEnergy);}
  if(s.life?.renewal&&op==='branchlearn'&&s.life.consultPending===target)time=Math.max(1,time-s.life.renewal.consultDiscount);
  return {time,energy};
}
export function canSucceed(s:GameState):boolean {const v=heir(s).vitality;return s.household.heirId!==s.household.activePersonId&&!!v?.alive&&v.ageSeasons>=s.life!.rules.adultYears*4;}
export function recordLifeGeneration(s:GameState,events:GameEvent[]):void {
  const trial=project(s);
  events.push({type:'generation-ended',final:s.status==='ended',facts:{
    generation:s.clock.generation,food:s.household.food,money:s.household.money,
    mastered:[...(s.economy?.branches?.learned[s.household.activePersonId]??activePerson(s).mastered)],heir:[...(s.economy?.branches?.learned[s.household.heirId]??heir(s).mastered)],archives:[...s.knowledge.archives],
    project:trial?{started:trial.started,control:seedValue(trial.control),candidate:seedValue(trial.candidate),samples:structuredClone(trial.samples)}:null,
    ...(s.production?{production:structuredClone(s.production)}:{}),
  }});
}
export function settleLife(s:GameState,missing:number,events:GameEvent[],foodRequired=2):void {
  const r=s.life!.rules;
  for(const person of s.household.memberIds.map(id=>s.persons[id])) {
    const v=person.vitality;if(!v?.alive)continue;
    v.ageSeasons++;
    const renewal=s.life!.renewal;
    const deficit=Math.min(1,missing/Math.max(1,foodRequired));
    const damage=renewal?Math.ceil(r.hungerDamage*deficit*Math.min(1,Math.max(0,s.household.hardship-renewal.graceSeasons)/2)):r.hungerDamage;
    v.health=Math.max(0,Math.min(healthCeiling(v,r),v.health+(missing?-damage:(renewal?.fedHealth??1))));
    const recovery=renewal?Math.max(1,Math.ceil(r.recovery*(1-deficit*0.75)))+(v.talent==='resilient'?1:0):missing?0:Math.max(1,Math.floor(r.recovery*v.health/100))+(v.talent==='resilient'?1:0);
    v.energy=Math.min(energyCeiling(v),v.energy+recovery);
    if(v.health===0||v.ageSeasons>=v.lifespanSeasons){v.alive=false;v.energy=0;lifeEvent(events,person.id,'death',`${person.name}因${v.health===0?'健康耗尽':'自然衰老'}离世`);}
    else lifeEvent(events,person.id,'season',`${person.name}：${Math.floor(v.ageSeasons/4)}岁，健康${v.health}，精力${v.energy}/${energyCeiling(v)}`);
  }
  // Childhood upbringing: each season fed / accompanied / taught is recorded and
  // settled once into constitution at adulthood; birth talent remains unchanged.
  for(const person of s.household.memberIds.map(id=>s.persons[id])) {
    const v=person.vitality;if(!v?.alive||!v.upbringing)continue;
    if(v.ageSeasons<r.adultYears*4){
      if(!missing)v.upbringing.fedSeasons++;
      if(person.id===s.household.heirId){
        if(s.life!.seasonCompany)v.upbringing.companySeasons++;
        if(s.life!.seasonTaught)v.upbringing.taughtSeasons++;
      }
    }else if(v.ageSeasons===r.adultYears*4){
      const up=v.upbringing,span=r.adultYears*4;
      const bonus=Math.round(r.growthConstitutionBonus*Math.min(1,(up.fedSeasons+up.companySeasons)/span));
      v.constitution+=bonus;v.energy=Math.min(energyCeiling(v),v.energy+bonus);
      lifeEvent(events,person.id,'adulthood',`${person.name}成年：饱食${up.fedSeasons}季、陪伴${up.companySeasons}季、受教${up.taughtSeasons}季；体质+${bonus}，保留出生天赋「${TALENTS[v.talent].name}」`);
    }
  }
  delete s.life!.seasonCompany;delete s.life!.seasonTaught;
  // One descendant per person; born during life, never created as an adult on handover.
  // Retired ancestors do not start additional branches.
  for(const person of new Set([activePerson(s),heir(s)])) {
    const v=person.vitality!;
    if(!v.alive||v.childId||v.ageSeasons<r.birthYears*4)continue;
    const id=`person:${Object.keys(s.persons).length+1}`,child=blankPerson(id,'成长中的后辈');
    child.vitality=makeVitality(s,r,0);if(s.life!.renewal)child.vitality.minimumEnergy=s.life!.renewal.minimumEnergy;child.vitality.upbringing={fedSeasons:0,companySeasons:0,taughtSeasons:0};s.persons[id]=child;s.household.memberIds.push(id);v.childId=id;
    if(person.id===s.household.activePersonId&&s.household.heirId===person.id)s.household.heirId=id;
    namePerson(s,child);
    lifeEvent(events,id,'birth',`家族迎来${child.vitality.sex==='male'?'男孩':'女孩'}${child.name}，出生天赋「${TALENTS[child.vitality.talent].name}」，从零岁成长，不自动获得知识`);
  }
  if(!activePerson(s).vitality!.alive){
    s.status=canSucceed(s)?'handover':'ended';
    lifeEvent(events,s.household.activePersonId,'succession',s.status==='handover'?'成年后辈可接手':'没有可接手的成年后辈，本次家族经营结束');
  }
}
