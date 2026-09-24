import {LANDSCAPE_INPUTS} from '../systems/economy-catalog.js';
import {landscapeSource} from '../systems/landscapes.js';
import {calendarView,availableDays} from '../systems/calendar.js';
import {eraCard} from '../systems/eras.js';
import { activePerson, blankPerson, heir, type GameState } from '../model/state.js';
import { branchNodesFor } from '../model/branches.js';
import { branchName, branchNeeds } from '../systems/branches.js';
import { recordLifeGeneration, relaxationRate, hasTalent, canSucceed, consultableNodes,  healthCeiling, lifeEvent, livingElders, makeVitality, namePerson, initializeCharacter, characterMemory, initialCultivation, cultivationKnown, cultivationMissing, cultivationQuote, completeCultivationStudy, maintainCultivation } from '../systems/life.js';
import { CULTIVATION_COURSES } from '../model/life.js';
import { defineAction, type ActionDefinition } from './definition.js';

export function lifeActions(s:GameState):ActionDefinition[] {
  if(!s.life)return [];
  const v=activePerson(s).vitality!,r=s.life.rules;
  const nextDate=s.life.calendar?calendarView(s).nextTerm:undefined;
  const actions:ActionDefinition[]=[
    ...(nextDate?[defineAction(s,'economy:wait:calendar','休养至'+nextDate.name,'日历',{ap:0,time:Math.min(nextDate.days,availableDays(s)),energy:0},v.pressure<=0?['压力已为0']:[],`前往${nextDate.date}，最多${nextDate.days}天；主动休养降低压力并消耗食物；节气会触发随机见闻，其他行动经过同一天也会触发。压力归零、作物成熟、缺粮、节气或节日时会停下。`,()=>{})]:[]),
    ...(s.life.calendar?(['simple','hearty'] as const).map(mode=>defineAction(s,'economy:diet:'+mode,mode==='simple'?'采用简单饮食':'采用丰足饮食','饮食',{ap:0,time:0,energy:0},s.life!.calendar!.diet===mode?['当前安排']:[],mode==='simple'?'每日现做现吃；有食材和柴火就做饭，否则吃库存干粮。':'每日食材消耗增加50%，主动放松时额外降低压力；不需要每天点击做饭。',(d)=>{d.life!.calendar!.diet=mode;})):[]),
    ...(s.life.calendar?[0.5,7].map(days=>defineAction(s,'economy:wait:'+(days===0.5?'half':'week'),days===0.5?'放松半日':'休养数日','日历',{ap:0,time:Math.min(days,availableDays(s)),energy:0},v.pressure<=0?['压力已为0']:[],`主动放松，每天降低${relaxationRate(s)}压力，预计最多降低${Math.min(v.pressure,days*relaxationRate(s))}；压力归零、成熟、缺粮、节气或节日时提前停下。`,()=>{})):[]),

    ...(['landmark','tea'] as const).flatMap(kind=>{const source=landscapeSource(s,kind);return source?[defineAction(s,'economy:rest:'+kind,kind==='tea'?'品茶半日':'凭栏散心','身体',{time:0.5,energy:0,food:kind==='tea'?LANDSCAPE_INPUTS.tea.food:0},v.pressure<=0?['压力已为0']:[],`由${source.id}景观解锁，在此直接使用。半日基础减压${relaxationRate(s,kind)/2}；实际按经过时间结算，最低为0。`,()=>{})]:[];}),
    defineAction(s,'economy:rest:self','放松半日','身体',{time:0.5,energy:0},v.pressure<=0?['压力已为0']:[],`花半天放松，基础降低${r.restRecovery+(hasTalent(v,'resilient')?1:0)}压力；压力最低为0。`,()=>{}),
    defineAction(s,'economy:care:self','营养疗养','身体',{money:Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))},v.health>=healthCeiling(v,r)?['健康已达到当前年龄上限']:[],`投入调养时间、${s.life.renewal?.careEnergy??1}压力、${Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))}钱购买营养照护，恢复${r.careRecovery}健康；不能逆转衰老。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.health;x.health=Math.min(healthCeiling(x,r),x.health+r.careRecovery);lifeEvent(ev,d.household.activePersonId,'care',`疗养恢复${x.health-before}健康`);
    }),
  ];
  for(const [index,person] of Object.values(s.persons).entries()){
    if(person.id===s.economy?.farm?.neighbor.personId||person.id===s.household.activePersonId||!person.vitality?.alive||!person.vitality.experiences||(s.sect&&!s.sect.members[person.id]?.admitted))continue;
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
  ],`用${s.life.renewal?.companyTime??2}时间、${s.life.renewal?.companyEnergy??1}压力陪伴后辈。季末连同饱食、受教一起记入养育；后辈成年时按养育记录结算体质加成，出生天赋终身保留。`,(d,ev)=>{
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
  actions.push(defineAction(s,'economy:retire:family','准备交接','身体',{ap:0},[
    ...(!canSucceed(s)?[s.sect?'自己的弟子须存活并成年':s.household.heirId===s.household.activePersonId?'尚无后辈':`后辈须存活并满${r.adultYears}岁，当前${Math.floor(heir(s).vitality!.ageSeasons/4)}岁`]:[]),
    ...(s.life.pendingRetirement?['已安排本季交接']:[]),
  ],'现在进入交接，不额外推进日历。自己的成年弟子接手，同门不参与交接，个人修为与所学各自独立；门派、规程、计划与资产延续，修行课程和功课状态属于各人。',(d,ev)=>{if(d.life?.calendar){d.status='handover';recordLifeGeneration(d,ev);}else d.life!.pendingRetirement=true;lifeEvent(ev,d.household.activePersonId,'retire','已准备交接');}));
  return s.sect?[...actions.filter(a=>a.offer.id!=='economy:company:heir'),...sectActions(s)]:actions;
}

function sectActions(s:GameState):ActionDefinition[]{
  const x=s.sect!,r=x.rules,id=s.household.activePersonId,m=x.members[id],out:ActionDefinition[]=[];
  const say=(d:GameState,ev:import('../model/events.js').GameEvent[],detail:string)=>lifeEvent(ev,d.household.activePersonId,'sect',detail);
  out.push(defineAction(s,'economy:sectseek:disciple','寻访弟子','师徒',{time:2,energy:1},[
    ...(m.discipleId?['每位师父只收一名正式弟子']:[]),...(m.candidateId?['已经找到候选人，资质固定']:[]),
  ],`寻访一位${r.candidateAge}岁候选人；独立于婚育。资质生成后固定，不随修行或刷新重抽。`,(d,ev)=>{
    const q=d.sect!,master=q.members[id],pid=`person:${Object.keys(d.persons).length+1}`,p=blankPerson(pid,'候选弟子');
    p.vitality=makeVitality(d,d.life!.rules,r.candidateAge);

    d.persons[pid]=p;namePerson(d,p);initializeCharacter(d,p);master.candidateId=pid;
    q.members[pid]={generation:master.generation+1,masterId:id,discipleId:null,candidateId:null,admitted:false,practice:0,rewardedStage:0,time:d.life!.rules.timePerSeason,consulted:[],cultivation:initialCultivation()};
    say(d,ev,`寻得${p.name}，${r.candidateAge}岁；入门须从零修道`);
  }));
  out.push(defineAction(s,'economy:sectadmit:disciple','正式收徒','师徒',{time:2,energy:1,money:r.recruitMoney},[
    ...(m.discipleId?['已经收徒，不可替换']:[]),...(!m.candidateId?['先寻访弟子']:[]),
    ...(m.candidateId&&!s.persons[m.candidateId].vitality?.alive?['候选人已故']:[]),
  ],'自己收徒与传承；徒弟从零修道，课程按前置学习，不受私人婚育影响。',(d,ev)=>{
    const master=d.sect!.members[id],pid=master.candidateId!;master.discipleId=pid;master.candidateId=null;
    d.sect!.members[pid].admitted=true;d.household.memberIds.push(pid);d.household.heirId=pid;
    characterMemory(d,pid,'admitted',`拜${d.persons[id].name}为师，从今日开始修道习术。`,'对新的师承心怀期待，也还惦念原来的生活。',ev);
    d.economy!.branches!.learned[pid]=[];say(d,ev,`${d.persons[pid].name}正式入门，师父${d.persons[id].name}`);
  }));
  const daily=defineAction(s,'economy:sectdaily:practice','温习日课','修行',{time:r.dailyTime*(s.life?.calendar?.rules.actionDaysPerUnit??1),energy:0},[
    ...(!cultivationKnown(s,'C0')?['先修成入门课「修身」']:[]),
    ...(m.cultivation.upkeep>=r.upkeepMax?['功课状态已充足']:[]),
  ],`调息、导引与温习；完成后补充${r.upkeepGain}天功课，最多储备${r.upkeepMax}天。课程效果待定，当前不增加全局加成。`,(d,ev)=>maintainCultivation(d,id,ev));
  daily.deferred=true;out.push(daily);
  for(const course of CULTIVATION_COURSES){
    const quote=cultivationQuote(s,course),known=cultivationKnown(s,course.id);
    const learn=defineAction(s,'economy:sectlearn:'+course.id,'精修 · '+course.name,'修行',{time:quote.time,energy:quote.energy},[
      ...cultivationMissing(s,course),...(known?['此课已修成']:[]),...(quote.time<=0?['没有可投入的时间或口粮']:[]),
    ],`${course.summary} 本次进度+${Number(quote.progress.toFixed(3))}，当前${Number(quote.done.toFixed(3))}/${quote.total}；进度可接续，完成本次修习也温养功课。效果待定，不发放旧境界或机缘奖励。`,(d,ev)=>completeCultivationStudy(d,id,course,quote.progress,ev));
    learn.deferred=true;out.push(learn);
    const disciple=m.discipleId,student=disciple?x.members[disciple]:null;
    const lesson=cultivationQuote(s,course,disciple??id);
    const teach=defineAction(s,'economy:sectteach:'+course.id,'传授 · '+course.name,'师徒',{time:lesson.time,energy:lesson.energy},[
      ...(!disciple?['尚未正式收徒']:[]),...(!known?['师父须先修成此课']:[]),
      ...(disciple&&!s.persons[disciple]?.vitality?.alive?['弟子已故']:[]),
      ...(disciple?cultivationMissing(s,course,disciple):[]),
      ...(disciple&&cultivationKnown(s,course.id,disciple)?['弟子已经修成此课']:[]),
      ...(student&&student.time<lesson.time?['弟子本轮学习时间不足']:[]),...(lesson.time<=0?['没有可投入的时间或口粮']:[]),
    ],`师徒共同修习，双方各占${lesson.time}天、增加${lesson.energy}压力；弟子进度+${Number(lesson.progress.toFixed(3))}，不会直接复制师父所学。`,(d,ev)=>{
      if(d.persons[disciple!]?.vitality?.alive)completeCultivationStudy(d,disciple!,course,lesson.progress,ev);
    });
    teach.deferred=true;
    teach.prepare=(d)=>{d.sect!.members[disciple!].time-=lesson.time;d.persons[disciple!].vitality!.pressure+=lesson.energy;};
    out.push(teach);
  }
  return out;
}
