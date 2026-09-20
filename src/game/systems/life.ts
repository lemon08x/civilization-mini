import {eraCard} from './eras.js';
import { ancestorKnows } from './ancestry.js';
import { nodeInEra } from '../model/branches.js';
import { activePerson, blankPerson, heir, project, seedValue, type GameState, type Person } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { LifeRules, SectRules, SectCard, Talent, Vitality } from '../model/life.js';

export const TALENTS: Record<Talent, {name:string;effect:string}> = {
  strong:{name:'健壮',effect:'亲自体力劳动少消耗1精力'},
  scholar:{name:'善学',effect:'学习、实验与付费授课少用1时间'},
  mentor:{name:'善教',effect:'教导后辈少用1时间、1精力'},
  organizer:{name:'善组织',effect:'招聘、采购与建立经营安排少用1时间'},
  resilient:{name:'善恢复',effect:'主动休息与季末基本恢复额外恢复1精力'},
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
  return {sex,portrait,portraitEra:s.era?.index??0,ageSeasons:age*4,lifespanSeasons,constitution,energy:constitution,health:100,talent,alive:true,childId:null};
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
    if(m.practice>=s.sect.rules.stageProgress)characterMemory(s,id,'cultivation','修行渐有根基，开始分辨一时冲动与长久心愿。','能够稍稍安顿心绪，也更在意自己的取舍。',events);
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
  return v?{sex:v.sex,portrait:v.portrait,portraitEra:v.portraitEra,ageYears:Math.floor(v.ageSeasons/4),ageQuarter:v.ageSeasons%4,health:v.health,...(r?{maxHealth:healthCeiling(v,r)}:{}),energy:v.energy,maxEnergy:energyCeiling(v),alive:v.alive,character:v.character?structuredClone(v.character):null,talent:TALENTS[v.talent],upbringing:v.upbringing?{...v.upbringing}:null}:undefined;
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
export function canSucceed(s:GameState):boolean {if(s.sect)return sectSuccessors(s).length===2;const v=heir(s).vitality;return s.household.heirId!==s.household.activePersonId&&!!v?.alive&&v.ageSeasons>=s.life!.rules.adultYears*4;}
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
  for(const person of s.sect?[]:new Set([activePerson(s),heir(s)])) {
    const v=person.vitality!;
    if(!v.alive||v.childId||v.ageSeasons<r.birthYears*4)continue;
    const id=`person:${Object.keys(s.persons).length+1}`,child=blankPerson(id,'成长中的后辈');
    child.vitality=makeVitality(s,r,0);if(s.life!.renewal)child.vitality.minimumEnergy=s.life!.renewal.minimumEnergy;child.vitality.upbringing={fedSeasons:0,companySeasons:0,taughtSeasons:0};s.persons[id]=child;s.household.memberIds.push(id);v.childId=id;
    if(person.id===s.household.activePersonId&&s.household.heirId===person.id)s.household.heirId=id;
    namePerson(s,child);
    lifeEvent(events,id,'birth',`家族迎来${child.vitality.sex==='male'?'男孩':'女孩'}${child.name}，出生天赋「${TALENTS[child.vitality.talent].name}」，从零岁成长，不自动获得知识`);
  }
  if(s.sect){
    if(!activePerson(s).vitality!.alive){
      const live=s.sect.current.find(id=>s.persons[id].vitality?.alive);
      if(live)selectSectPerson(s,live);
      else s.status=canSucceed(s)?'handover':'ended';
    }
    return;
  }
  if(!activePerson(s).vitality!.alive){
    s.status=canSucceed(s)?'handover':'ended';
    lifeEvent(events,s.household.activePersonId,'succession',s.status==='handover'?'成年后辈可接手':'没有可接手的成年后辈，本次家族经营结束');
  }
}


export const SECT_CARDS:Record<SectCard,string>={study:'明理札记',craft:'百工心得',teach:'授业笔录',prepare:'筹备手札'};
export function initializeSect(s:GameState,r:SectRules):void {
  const ids=[s.household.activePersonId,s.household.heirId] as [string,string];
  s.sect={rules:structuredClone(r),current:ids,members:{},doctrine:0,research:0,improvements:[],fortune:0,cards:{study:0,craft:0,teach:0,prepare:0},draws:0,lastDraw:'尚未求取机缘',seasonChance:0,seasonBonus:null,nextBonus:null,lastEvent:'静心修行'};
  for(const id of ids){
    const p=s.persons[id];p.vitality=makeVitality(s,s.life!.rules,s.life!.rules.adultYears+2);namePerson(s,p);
    if(s.life!.renewal)p.vitality.minimumEnergy=s.life!.renewal.minimumEnergy;
    initializeCharacter(s,p);
    s.sect.members[id]={generation:1,masterId:null,discipleId:null,candidateId:null,admitted:true,practice:0,rewardedStage:0,time:s.life!.rules.timePerSeason,consulted:[]};
  }
  s.household.heirId=s.household.activePersonId;
}
export function sectStage(s:GameState,id=s.household.activePersonId):number {
  const x=s.sect;if(!x)return 0;return Math.min(x.rules.maxStage,Math.floor((x.members[id]?.practice??0)/x.rules.stageProgress));
}
export function sectStrength(s:GameState,id=s.household.activePersonId):number {
  const x=s.sect;if(!x)return 0;return Math.min(0.35,sectStage(s,id)*(x.rules.daoPercent+x.doctrine*x.rules.doctrinePercent)/100);
}
export function sectCategory(id:string):SectCard {
  const op=id.split(':')[1];
  if(['branchlearn','study','research','tuition','inspect'].includes(op))return 'study';
  if(['branchteach','teach','sectteach','consult','company'].includes(op))return 'teach';
  if(['farm','gather','work','build','process','finish','sysbuild','syscommission','sysrun','fertilize'].includes(op))return 'craft';
  return 'prepare';
}
export function sectCosts(s:GameState,id:string,cost:{time:number;energy:number}) {
  if(!s.sect||id==='handover'||['sectswitch','sectpractice','sectimprove','sectdraw','end','erasettle','retire'].includes(id.split(':')[1]))return cost;
  const category=sectCategory(id),bonus=s.sect.cards[category]*s.sect.rules.cardPercent/100+(s.sect.seasonBonus===category?0.02:0);
  const factor=1-Math.min(0.4,sectStrength(s)+bonus);
  const reduce=(n:number)=>n>0?Math.max(0.25,Math.round(n*factor*100)/100):0;
  return {time:reduce(cost.time),energy:reduce(cost.energy)};
}
export function sectSuccessors(s:GameState):string[] {
  if(!s.sect)return [];return s.sect.current.map(id=>s.sect!.members[id].discipleId).filter((id):id is string=>!!id&&!!s.persons[id]?.vitality?.alive&&s.persons[id].vitality!.ageSeasons>=s.life!.rules.adultYears*4);
}
export function selectSectPerson(s:GameState,id:string):void {
  const x=s.sect!,old=x.members[s.household.activePersonId];
  if(old){old.time=s.life!.timeRemaining;old.consulted=[...(s.life!.consulted??[])];old.consultPending=s.life!.consultPending;}
  s.household.activePersonId=id;s.household.heirId=x.members[id].discipleId??id;
  s.life!.timeRemaining=x.members[id].time;s.life!.consulted=[...x.members[id].consulted];s.life!.consultPending=x.members[id].consultPending;
}
export function gainPractice(s:GameState,id:string,amount:number,events:GameEvent[]):void {
  const x=s.sect!,m=x.members[id],r=x.rules;
  m.practice=Math.min(r.stageProgress*r.maxStage,m.practice+amount);
  const stage=sectStage(s,id),earned=Math.max(0,stage-m.rewardedStage)*r.fortunePerStage;
  m.rewardedStage=Math.max(stage,m.rewardedStage);const before=x.fortune;x.fortune=Math.min(r.fortuneCap,x.fortune+earned);
  lifeEvent(events,id,'dao',`${s.persons[id].name}修为 ${m.practice}/${r.stageProgress*r.maxStage}，第${stage}境${earned?`；衍生气运+${x.fortune-before}（溢出${earned-(x.fortune-before)}）`:''}`);
}
export function sectDrawOdds(s:GameState):[number,number,number] {
  const x=s.sect!,q=Math.min(x.fortune/x.rules.fortuneCap,sectStrength(s));
  return [0.8-q*0.1,0.18+q*0.08,0.02+q*0.02];
}
export function renewSect(s:GameState):void {
  const x=s.sect;if(!x)return;
  for(const [id,m] of Object.entries(x.members))if(m.admitted){m.time=s.life!.rules.timePerSeason;if(id===s.household.activePersonId)m.time=s.life!.timeRemaining;}
  x.seasonChance=x.rules.eventPercent/100+x.current.reduce((sum,id)=>sum+sectStrength(s,id),0)/2*0.1;
  x.seasonBonus=x.nextBonus;x.nextBonus=null;
}
export function settleSect(s:GameState,events:GameEvent[]):void {
  const x=s.sect;if(!x)return;
  x.members[s.household.activePersonId].time=s.life!.timeRemaining;
  if(draw(s)<x.seasonChance){
    const keys=Object.keys(SECT_CARDS) as SectCard[];x.nextBonus=keys[Math.floor(draw(s)*keys.length)];
    x.lastEvent=`修行偶得${SECT_CARDS[x.nextBonus]}启发，下季对应行动成本额外降低2%`;
    lifeEvent(events,s.household.activePersonId,'opportunity',x.lastEvent);
  }else x.lastEvent='本季静修，无额外机缘';
}
export function sectView(s:GameState){
  const x=s.sect;if(!x)return null;
  return {doctrine:x.doctrine,research:x.research,improvements:structuredClone(x.improvements),rules:{...x.rules},
    current:[...x.current],activeId:s.household.activePersonId,ready:sectSuccessors(s).length===2,
    members:Object.entries(x.members).map(([id,m])=>({id,name:s.persons[id].name,practiceEvidence:s.persons[id].practices.filter(v=>v.startsWith('dao:')),...m,consulted:[...m.consulted],time:id===s.household.activePersonId?s.life!.timeRemaining:m.time,stage:sectStage(s,id),effect:Math.round(sectStrength(s,id)*100),life:lifeView(s.persons[id],s.life!.rules)})),
    fortune:x.fortune,odds:sectDrawOdds(s),cards:Object.entries(x.cards).map(([id,level])=>({id,name:SECT_CARDS[id as SectCard],level,effect:level*x.rules.cardPercent})),lastDraw:x.lastDraw,draws:x.draws,lastEvent:x.lastEvent,seasonBonus:x.seasonBonus};
}
