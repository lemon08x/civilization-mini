import {eraCard} from '../systems/eras.js';
import { activePerson, blankPerson, heir, type GameState } from '../model/state.js';
import { branchNodesFor } from '../model/branches.js';
import { branchName, branchNeeds } from '../systems/branches.js';
import { hasTalent, canSucceed, consultableNodes, energyCeiling, healthCeiling, lifeEvent, livingElders, makeVitality, namePerson, initializeCharacter, characterMemory, selectSectPerson, gainPractice, sectStage, sectStrength, sectDrawOdds, SECT_CARDS, draw } from '../systems/life.js';
import { defineAction, type ActionDefinition } from './definition.js';

export function lifeActions(s:GameState):ActionDefinition[] {
  if(!s.life)return [];
  const v=activePerson(s).vitality!,r=s.life.rules;
  const actions:ActionDefinition[]=[
    defineAction(s,'economy:rest:self','休息','身体',{},v.energy>=energyCeiling(v)?['精力已满']:[],`用4时间恢复${r.restRecovery+(hasTalent(v,'resilient')?1:0)}精力，不超过健康决定的上限。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.energy;x.energy=Math.min(energyCeiling(x),x.energy+r.restRecovery+(hasTalent(x,'resilient')?1:0));lifeEvent(ev,d.household.activePersonId,'rest',`休息恢复${x.energy-before}精力`);
    }),
    defineAction(s,'economy:care:self','营养疗养','身体',{money:Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))},v.health>=healthCeiling(v,r)?['健康已达到当前年龄上限']:[],`用${s.life.renewal?.careTime??4}时间、${s.life.renewal?.careEnergy??1}精力、${Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))}钱购买营养照护，恢复${r.careRecovery}健康；不能逆转衰老。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.health;x.health=Math.min(healthCeiling(x,r),x.health+r.careRecovery);lifeEvent(ev,d.household.activePersonId,'care',`疗养恢复${x.health-before}健康`);
    }),
  ];
  for(const [index,person] of Object.values(s.persons).entries()){
    if(person.id===s.household.activePersonId||!person.vitality?.alive||!person.vitality.experiences||(s.sect&&!s.sect.members[person.id]?.admitted))continue;
    actions.push(defineAction(s,'economy:bond:'+index,'与'+person.name+'谈心','身体',{time:2,energy:1},v.experiences?.contacts.includes(person.id)?['本季已与此人谈心']:[],
      '倾听与表达：改善双方关系1点（上限5），本季双方遇到关系事件时优先涉及彼此；关系影响季末和解或争执的机会。',(d,ev)=>{
        const mine=activePerson(d).vitality!.experiences!,theirs=d.persons[person.id].vitality!.experiences!;
        const before=mine.relationships[person.id]??0,after=Math.min(5,before+1);
        mine.relationships[person.id]=after;theirs.relationships[d.household.activePersonId]=after;
        mine.contacts.push(person.id);theirs.contacts.push(d.household.activePersonId);
        if(!theirs.actions.includes('bond'))theirs.actions.push('bond');
        lifeEvent(ev,d.household.activePersonId,'bond','与'+person.name+'谈心，关系+'+(after-before)+'（'+after+'）');
      }));
  }
  const child=heir(s),cv=s.household.heirId!==s.household.activePersonId?child.vitality:undefined;
  actions.push(defineAction(s,'economy:company:heir','陪伴成长','身体',{},[
    ...(!cv?['尚无后辈']:[]),
    ...(cv&&!cv.alive?['后辈已故']:[]),
    ...(cv?.alive&&cv.ageSeasons>=r.adultYears*4?['后辈已成年，养育已在成年时结算']:[]),
    ...(s.life.seasonCompany?['本季已陪伴过后辈']:[]),
  ],`用${s.life.renewal?.companyTime??2}时间、${s.life.renewal?.companyEnergy??1}精力陪伴后辈。季末连同饱食、受教一起记入养育；后辈成年时按养育记录结算体质加成，出生天赋终身保留。`,(d,ev)=>{
    d.life!.seasonCompany=true;lifeEvent(ev,d.household.heirId,'company','本季陪伴了成长中的后辈');
  }));
  for(const elder of livingElders(s)){
    for(const nodeId of consultableNodes(s,elder)){
      const node=branchNodesFor(s).find(n=>n.id===nodeId);
      actions.push(defineAction(s,`economy:consult:${nodeId}`,`请教${elder.name}：${branchName(nodeId)}`,'传承',{},[
        ...(s.life.consultPending?['一次只记一门请教的课程，先完成对应学习']:[]),
        ...(node?branchNeeds(s,node.parents):[]),
      ],`${elder.name}掌握${branchName(nodeId)}；请教后本人下一次学习该课程时间减少${s.life.renewal?.consultDiscount??2}。每门课程每代只请教一次，交接后重新计算。`,(d,ev)=>{
        d.life!.consultPending=nodeId;(d.life!.consulted??=[]).push(nodeId);
        lifeEvent(ev,d.household.activePersonId,'consult',`向${elder.name}请教${branchName(nodeId)}，下一次学习该课程时间减少`);
      }));
    }
  }
  actions.push(defineAction(s,'economy:retire:family','安排季末交接','身体',{ap:0},[
    ...(!canSucceed(s)?[s.sect?'下一代两位弟子须均存活并成年':s.household.heirId===s.household.activePersonId?'尚无后辈':`后辈须存活并满${r.adultYears}岁，当前${Math.floor(heir(s).vitality!.ageSeasons/4)}岁`]:[]),
    ...(s.life.pendingRetirement?['已安排本季交接']:[]),
  ],'本季正常结算后进入交接。下一代两位成年弟子接手，个人修为与所学各自独立；门派道法、规程、气运与资产延续。',(d,ev)=>{d.life!.pendingRetirement=true;lifeEvent(ev,d.household.activePersonId,'retire','已安排季末交接');}));
  return s.sect?[...actions.filter(a=>a.offer.id!=='economy:company:heir'),...sectActions(s)]:actions;
}

function sectActions(s:GameState):ActionDefinition[]{
  const x=s.sect!,r=x.rules,id=s.household.activePersonId,m=x.members[id],out:ActionDefinition[]=[];
  const say=(d:GameState,ev:import('../model/events.js').GameEvent[],detail:string)=>lifeEvent(ev,d.household.activePersonId,'sect',detail);
  for(const [slot,pid] of x.current.entries())out.push(defineAction(s,`economy:sectswitch:${slot}`,`转由${s.persons[pid].name}行动`,'师徒',{ap:0,time:0,energy:0},[
    ...(pid===id?['已经是当前行动者']:[]),...(!s.persons[pid].vitality?.alive?['该传人已故']:[]),
    ...(Object.values(s.economy!.industry?.instances??{}).some(v=>v?.enabled&&v.operator==='self')?['切换前请暂停本人负责的生产系统，或改派雇员']:[]),
  ],'切换当代传人，各自时间与精力独立，不刷新本季预算。共享物资与设备不会复制。',(d,ev)=>{selectSectPerson(d,pid);say(d,ev,`由${d.persons[pid].name}继续本季行动`);}));
  out.push(defineAction(s,'economy:sectseek:disciple','寻访弟子','师徒',{time:2,energy:1},[
    ...(m.discipleId?['每位师父只收一名正式弟子']:[]),...(m.candidateId?['已经找到候选人，资质固定']:[]),
  ],`寻访一位${r.candidateAge}岁候选人；独立于婚育。修道只小幅改善候选体质机会，资质生成后不重抽。`,(d,ev)=>{
    const q=d.sect!,master=q.members[id],pid=`person:${Object.keys(d.persons).length+1}`,p=blankPerson(pid,'候选弟子');
    p.vitality=makeVitality(d,d.life!.rules,r.candidateAge);if(d.life!.renewal)p.vitality.minimumEnergy=d.life!.renewal.minimumEnergy;
    if(draw(d)<sectStrength(d)*0.1)p.vitality.constitution++;
    d.persons[pid]=p;namePerson(d,p);initializeCharacter(d,p);master.candidateId=pid;
    q.members[pid]={generation:master.generation+1,masterId:id,discipleId:null,candidateId:null,admitted:false,practice:0,rewardedStage:0,time:d.life!.rules.timePerSeason,consulted:[]};
    say(d,ev,`寻得${p.name}，${r.candidateAge}岁；入门须从零修道`);
  }));
  out.push(defineAction(s,'economy:sectadmit:disciple','正式收徒','师徒',{time:2,energy:1,money:r.recruitMoney},[
    ...(m.discipleId?['已经收徒，不可替换']:[]),...(!m.candidateId?['先寻访弟子']:[]),
    ...(m.candidateId&&!s.persons[m.candidateId].vitality?.alive?['候选人已故']:[]),
  ],'每师一徒、每代两席；徒弟从零修道，课程按前置学习，不受私人婚育影响。',(d,ev)=>{
    const master=d.sect!.members[id],pid=master.candidateId!;master.discipleId=pid;master.candidateId=null;
    d.sect!.members[pid].admitted=true;d.household.memberIds.push(pid);d.household.heirId=pid;
    characterMemory(d,pid,'admitted',`拜${d.persons[id].name}为师，从今日开始修道习术。`,'对新的师承心怀期待，也还惦念原来的生活。',ev);
    d.economy!.branches!.learned[pid]=[];say(d,ev,`${d.persons[pid].name}正式入门，师父${d.persons[id].name}`);
  }));
  out.push(defineAction(s,'economy:sectpractice:dao','静心修道','道',{time:r.practiceTime,energy:r.practiceEnergy},sectStage(s)>=r.maxStage?['个人修为已至当前上限']:[],`修为+${r.practiceGain}；每${r.stageProgress}进度一境。每境首次衍生${r.fortunePerStage}气运，最多储备${r.fortuneCap}。道改善其他行动效率。`,(d,ev)=>gainPractice(d,id,r.practiceGain,ev)));
  const disciple=m.discipleId,student=disciple?x.members[disciple]:null;
  out.push(defineAction(s,'economy:sectteach:dao','授徒修道','道',{time:2,energy:1},[
    ...(!disciple?['先正式收徒']:[]),...(disciple&&!s.persons[disciple].vitality?.alive?['弟子已故']:[]),
    ...(student&&student.practice>=m.practice?['师父修为须高于弟子']:[]),...(student&&student.time<2?['弟子本季学习时间不足']:[]),
    ...(disciple&&s.persons[disciple].vitality!.energy<1?['弟子精力不足']:[]),
  ],'师徒双方投入：弟子耗2时间、1精力，修为最多+2且不超过师父；有效授业同时令师父修为+1，作为兼顾成长与善行的收获。',(d,ev)=>{
    const st=d.sect!.members[disciple!];st.time-=2;d.persons[disciple!].vitality!.energy-=1;
    gainPractice(d,disciple!,Math.min(2,m.practice-st.practice),ev);gainPractice(d,id,1,ev);
  }));
  const learned=s.economy!.branches!.learned[id]??[],needed=r.doctrineCourses*(x.doctrine+1);
  out.push(defineAction(s,'economy:sectimprove:dao','研证本门心法','道',{time:r.practiceTime,energy:r.practiceEnergy,money:r.doctrineMoney},[
    ...(sectStage(s)<r.maxStage?['须达到个人修为上限']:[]),...(x.doctrine>=r.doctrineMax?['本门道法改进已达上限']:[]),
    ...(learned.length<needed?[`须亲自掌握${needed}门术，当前${learned.length}`]:[]),
    ...(new Set(learned.map(k=>k[0])).size<3?['须至少涉猎三个学科分支']:[]),
      ...(s.persons[id].practices.filter(v=>v.startsWith('dao:')).length<2?['须亲自完成耕作、生产、授术中至少两类实践']:[]),
  ],`实际验证${r.doctrineSteps}次才能永久改进一级心法，每步支付资源。当前${x.research}/${r.doctrineSteps}；新人仍从零修行。`,(d,ev)=>{
    const q=d.sect!;q.research++;if(q.research>=r.doctrineSteps){q.research=0;q.doctrine++;q.improvements.push({level:q.doctrine,personId:id,courses:[...learned]});say(d,ev,`本门心法永久提升至${q.doctrine}级，后世须亲自修习以发挥效果`);}else say(d,ev,`心法验证${q.research}/${r.doctrineSteps}`);
  }));
  const odds=sectDrawOdds(s);
  out.push(defineAction(s,'economy:sectdraw:opportunity','求取辅助机缘','机缘',{time:1,energy:0},x.fortune<r.drawCost?[`需${r.drawCost}衍生气运，当前${x.fortune}`]:[],
    `消耗${r.drawCost}气运；基础/进阶/稀有概率${odds.map(v=>(v*100).toFixed(2)+'%').join('/')}，按扣费前计算。只获辅助卡，不改变修为，不抽卡也可完成使命。`,(d,ev)=>{
      const q=d.sect!,p=sectDrawOdds(d),roll=draw(d),rank=roll<p[0]?1:roll<p[0]+p[1]?2:3;
      q.fortune-=r.drawCost;const keys=Object.keys(SECT_CARDS) as (keyof typeof SECT_CARDS)[],key=keys[Math.floor(draw(d)*keys.length)];
      const old=q.cards[key];q.cards[key]=Math.min(r.cardMax,old+rank);const extra=Math.max(0,old+rank-r.cardMax);d.household.food+=extra;
      q.draws++;q.lastDraw=`${SECT_CARDS[key]}：${old}→${q.cards[key]}级${extra?`，溢出转${extra}粮`:''}；气运余${q.fortune}`;say(d,ev,q.lastDraw);
    }));
  return out;
}
