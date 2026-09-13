import { activePerson, heir, type GameState } from '../model/state.js';
import { canSucceed, energyCeiling, healthCeiling, lifeEvent } from '../systems/life.js';
import { defineAction, type ActionDefinition } from './definition.js';

export function lifeActions(s:GameState):ActionDefinition[] {
  if(!s.life)return [];
  const v=activePerson(s).vitality!,r=s.life.rules;
  return [
    defineAction(s,'economy:rest:self','休息','身体',{},v.energy>=energyCeiling(v)?['精力已满']:[],`用4时间恢复${r.restRecovery+(v.talent==='resilient'?1:0)}精力，不超过健康决定的上限。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.energy;x.energy=Math.min(energyCeiling(x),x.energy+r.restRecovery+(x.talent==='resilient'?1:0));lifeEvent(ev,d.household.activePersonId,'rest',`休息恢复${x.energy-before}精力`);
    }),
    defineAction(s,'economy:care:self','营养疗养','身体',{money:2},v.health>=healthCeiling(v,r)?['健康已达到当前年龄上限']:[],`用4时间、1精力、2钱购买营养照护，恢复${r.careRecovery}健康；不能逆转衰老。`,(d,ev)=>{
      const x=activePerson(d).vitality!,before=x.health;x.health=Math.min(healthCeiling(x,r),x.health+r.careRecovery);lifeEvent(ev,d.household.activePersonId,'care',`疗养恢复${x.health-before}健康`);
    }),
    defineAction(s,'economy:retire:family','安排季末交接','身体',{ap:0},[
      ...(!canSucceed(s)?[s.household.heirId===s.household.activePersonId?'尚无后辈':`后辈须存活并满${r.adultYears}岁，当前${Math.floor(heir(s).vitality!.ageSeasons/4)}岁`]:[]),
      ...(s.life.pendingRetirement?['已安排本季交接']:[]),
    ],'本季正常结算后交给成年后辈；不会额外生成一季时间或自动复制个人知识。',(d,ev)=>{d.life!.pendingRetirement=true;lifeEvent(ev,d.household.activePersonId,'retire','已安排季末交接');}),
  ];
}
