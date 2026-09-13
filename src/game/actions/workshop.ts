import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { defineAction, type ActionDefinition } from './definition.js';
import { WORKSHOPS } from '../systems/workshop.js';
import { organizationLevel,requirements,missingGoods,changeGoods } from '../systems/economy.js';

export function workshopActions(s:GameState,r:Ruleset):ActionDefinition[]{
  const e=s.economy!,net=e.workshops;if(!net)return [];
  const out:ActionDefinition[]=[];
  for(const spec of WORKSHOPS){const w=net.nodes[spec.id];
    const add=(op:string,label:string,cost:Parameters<typeof defineAction>[4],blocked:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${spec.id}`,label,'作坊',cost,[...(e.operations!.paused?['先接续家族经营安排']:[]),...blocked],description,execute));
    const log=(events:Parameters<ActionDefinition['execute']>[1],detail:string)=>events.push({type:'operations',operation:'workshop-plan',target:spec.id,detail,amount:0,money:0});
    add('workshopbuild','建立'+spec.name,{money:r.economy!.hireCost},[...(w?['已建成']:[]),...(organizationLevel(s)<2?['需生产组织2阶或家族记录']:[]),...requirements(s,{materials:spec.level}),...missingGoods(s,{wood:2}),...(e.recruitment<1?['本季招募额度已用尽']:[])],`投入2木材与招募费，雇用独立作坊工人；不占现有工匠。每批按原配方加工，有效工作才付工资。`,(d,ev)=>{changeGoods(d,{wood:2},-1,ev,'建设'+spec.name);d.economy!.recruitment--;d.economy!.workshops!.nodes[spec.id]={active:true,units:1,logistics:1,source:spec.id==='rope'&&d.economy!.workshops!.nodes.fiber?'upstream':'household',input:0,output:0};log(ev,spec.name+'已建成并雇人');});
    if(!w)continue;
    add('workshoppause',w.active?'暂停'+spec.name:'恢复'+spec.name,{ap:0},[],'保留人员、路线与缓冲；暂停时不取新料、不生产，已发货物仍到达。',(d,ev)=>{d.economy!.workshops!.nodes[spec.id]!.active=!w.active;log(ev,spec.name+(w.active?'已暂停':'已恢复'));});
    add('workshopexpand','增设'+spec.name+'工位',{money:r.economy!.hireCost},[...(w.units>=2?['本轮最多2个工位']:[]),...missingGoods(s,{wood:2}),...(e.recruitment<1?['本季招募额度已用尽']:[])],'再投入2木材和招募费，最多每季加工2批；工资按实际批数付，不扩大运输和缓冲。',(d,ev)=>{changeGoods(d,{wood:2},-1,ev,'扩建'+spec.name);d.economy!.recruitment--;d.economy!.workshops!.nodes[spec.id]!.units++;log(ev,spec.name+'增加1工位');});
    add('workshoptransport','扩充'+spec.name+'运输',{money:r.operations!.projectFee},[...(w.logistics>=2?['运输已扩充']:[]),...missingGoods(s,{wood:2})],`投入2木材和组织费，该作坊原料及家庭交货路线分别从每季${r.workshops!.transport}份增至${r.workshops!.transport*2}份，仍需跨季到达。`,(d,ev)=>{changeGoods(d,{wood:2},-1,ev,'作坊运输扩充');d.economy!.workshops!.nodes[spec.id]!.logistics=2;log(ev,spec.name+'运输容量翻倍');});
    if(spec.id==='rope')for(const source of ['household','upstream'] as const){
      add(source==='household'?'workshophousehold':'workshopupstream',source==='household'?'绳索改用家庭纤维':'连接纤维作坊 → 绳索作坊',{},[...(w.source===source?['已采用此来源']:[]),...(source==='upstream'&&!net.nodes.fiber?['先建立纤维作坊']:[])],'仅改变后续发货来源；现有原料和在途货物保留。家庭纤维可手工生产或从市场购入。',(d,ev)=>{d.economy!.workshops!.nodes.rope!.source=source;log(ev,source==='household'?'绳索从家庭库存取纤维':'纤维作坊已连接绳索作坊');});
    }
  }
  return out;
}
