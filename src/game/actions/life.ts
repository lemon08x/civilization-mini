import {eraCard} from '../systems/eras.js';
import { activePerson, heir, type GameState } from '../model/state.js';
import { branchNodesFor } from '../model/branches.js';
import { branchName, branchNeeds } from '../systems/branches.js';
import { canSucceed, consultableNodes, energyCeiling, healthCeiling, lifeEvent, livingElders } from '../systems/life.js';
import { defineAction, type ActionDefinition } from './definition.js';

export function lifeActions(s:GameState):ActionDefinition[] {
  if(!s.life)return [];
  const v=activePerson(s).vitality!,r=s.life.rules;
  const actions:ActionDefinition[]=[
    defineAction(s,'economy:rest:self','休息','身体',{},v.energy>=energyCeiling(v)?['精力已满']:[],`用4时间恢复${r.restRecovery+(v.talent==='resilient'?1:0)}精力，不超过健康决定的上限。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.energy;x.energy=Math.min(energyCeiling(x),x.energy+r.restRecovery+(x.talent==='resilient'?1:0));lifeEvent(ev,d.household.activePersonId,'rest',`休息恢复${x.energy-before}精力`);
    }),
    defineAction(s,'economy:care:self','营养疗养','身体',{money:Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))},v.health>=healthCeiling(v,r)?['健康已达到当前年龄上限']:[],`用${s.life.renewal?.careTime??4}时间、${s.life.renewal?.careEnergy??1}精力、${Math.max(0,(s.life.renewal?.careMoney??2)-(eraCard(s)?.care??0))}钱购买营养照护，恢复${r.careRecovery}健康；不能逆转衰老。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.health;x.health=Math.min(healthCeiling(x,r),x.health+r.careRecovery);lifeEvent(ev,d.household.activePersonId,'care',`疗养恢复${x.health-before}健康`);
    }),
  ];
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
    ...(!canSucceed(s)?[s.household.heirId===s.household.activePersonId?'尚无后辈':`后辈须存活并满${r.adultYears}岁，当前${Math.floor(heir(s).vitality!.ageSeasons/4)}岁`]:[]),
    ...(s.life.pendingRetirement?['已安排本季交接']:[]),
  ],'本季正常结算后进入交接。同一时代由成年后辈接手；若已是本时代最后一代，则结清回报并在新时代生成无亲属关系的新人物。',(d,ev)=>{d.life!.pendingRetirement=true;lifeEvent(ev,d.household.activePersonId,'retire','已安排季末交接');}));
  return actions;
}
