import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { defineAction,type ActionDefinition } from './definition.js';
import { floorsFor } from '../systems/tower.js';

export function towerActions(s:GameState,_r:Ruleset):ActionDefinition[]{
 const t=s.economy?.tower;if(!t||t.floor>=floorsFor(s).length)return [];
 const out:ActionDefinition[]=[];
 const add=(op:string,target:string,label:string,ap:number,blockers:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${target}`,label,'试炼',{ap},blockers,description,execute));
 const emit=(ev:Parameters<ActionDefinition['execute']>[1],detail:string)=>ev.push({type:'tower',operation:'plan',floor:t.floor,detail,goods:{}});
 for(const [i,f]of floorsFor(s).entries())add('towerstart',f.id,(t.active?'进行中：':'开工：')+f.name,1,[...(i!==t.floor?['需按顺序完成前层']:[]),...(t.active?['本层已开工']:[]),...(s.economy!.operations!.paused?['先接续家族经营安排']:[])],
  '开工并启用工地供货。季末只运家庭现有余料，家庭口粮优先；下一季到货。不会直接扣钱换取工程进度。', (d,ev)=>{const x=d.economy!.tower!;x.active=true;x.delivery=true;emit(ev,f.name+'开工，工地供货已启用');});
 add('towerpause','current','暂停当前施工',0,t.active?[]:['当前未开工'],'停止新发运与施工，现场和在途材料保留；合龙阶段停工跨季会中断连续验证。',(d,ev)=>{d.economy!.tower!.active=false;d.economy!.tower!.delivery=false;emit(ev,'施工暂停，已投入工程和货物保留');});
 for(const enabled of [true,false])add('towerdelivery',enabled?'on':'off',enabled?'恢复工地供货':'暂停工地供货',0,[...(!t.active?['先开工']:[]),...(t.delivery===enabled?['已是此安排']:[])],'仅改变发货，不撤回在途货物；现场物料仍可用于施工。',(d,ev)=>{d.economy!.tower!.delivery=enabled;emit(ev,enabled?'工地供货恢复':'工地供货暂停');});
 return out;
}
