import { studyQuote } from '../systems/life.js';

import {requiresPractice,branchNodesFor,nodeInEra} from '../model/branches.js';
import {ancestorKnows} from '../systems/ancestry.js';
import {branchKnown,branchNeeds,theoryNeeds,branchName} from '../systems/branches.js';
import {changeGoods,missingGoods} from '../systems/economy.js';
import {defineAction,type ActionDefinition} from './definition.js';

import type {GameState} from '../model/state.js';
import type {Ruleset} from '../ruleset.js';
export function branchActions(s:GameState,r:Ruleset):ActionDefinition[]{
  const b=s.economy?.branches;if(!b)return [];
  const out:ActionDefinition[]=[];
  for(const node of branchNodesFor(s)){
    const lesson=studyQuote(s,node.id);
    const unavailable=nodeInEra(s,node.id)?[]:['当前社会尚未开放此课程'];
    const archived=b.archives.includes(node.id),sample=s.economy!.industry||archived?{}:node.sample;
    out.push(defineAction(s,`economy:branchlearn:${node.id}`,'理论学习：'+node.name+(s.life?.calendar?`（${Math.round(lesson.done*100)/100}/${lesson.total}天）`:''),'理论学习',s.life?.calendar?{time:lesson.time,energy:lesson.energy}:{},[
      ...(lesson.time<=0?['可投入时间或饮食不足；请补给或推进日历']:[]),...unavailable,...theoryNeeds(s,node.parents),...(branchKnown(s,node.id)?['理论已完成']:[]),...missingGoods(s,sample),
    ],`学习理论，不自动播种或建设。${requiresPractice(node.id)?'理论完成后到实践页点亮，才可使用相关能力。':'纯加成课程，理论完成后立即生效。'}${ancestorKnows(s,node.id)?'前代已学，享传承学习减费。':''}`,(d,ev)=>{
      if(d.life?.calendar){const c=d.life.calendar;const done=Math.min(lesson.total,lesson.done+lesson.progress);c.study[lesson.key]={done,total:lesson.total};ev.push({type:'branch',operation:'study-progress',node:node.id,detail:`${node.name}理论研习 ${Math.round(done*100)/100}/${lesson.total}天，进度可接续`});if(done<lesson.total)return;delete c.study[lesson.key];}
      if(d.life?.consultPending===node.id)delete d.life.consultPending;
      changeGoods(d,sample,-1,ev,'学习样品');(d.economy!.branches!.learned[d.household.activePersonId]??=[]).push(node.id);

      ev.push({type:'branch',operation:'learned',node:node.id,detail:'完成理论：'+node.name});
    }));
    if(requiresPractice(node.id))out.push(defineAction(s,`economy:branchpractice:${node.id}`,'实践点亮：'+node.name,'实践',{ap:0,time:0,energy:0},[
      ...unavailable,...theoryNeeds(s,[node.id]),...(s.persons[s.household.activePersonId].practices.includes('technology:'+node.id)?['已点亮实践']:[]),
    ],'完成理论后点亮此能力，不额外消耗时间或材料；实际生产、制作和建设仍需满足各自条件。实践由本人完成，传授理论不代替弟子实践。',(d,ev)=>{
      d.persons[d.household.activePersonId].practices.push('technology:'+node.id);
      ev.push({type:'branch',operation:'practiced',node:node.id,detail:'实践已点亮：'+node.name});
    }));
    out.push(defineAction(s,`economy:brancharchive:${node.id}`,'留存：'+node.name,'分支',{},[
      ...unavailable,...theoryNeeds(s,[node.id]),...(archived?['已经留存']:[]),
    ],'保留学习来源，弟子仍须投入时间学习，不自动复制个人理解。',(d,ev)=>{d.economy!.branches!.archives.push(node.id);ev.push({type:'branch',operation:'archived',node:node.id,detail:'已留存'+node.name});}));
    out.push(defineAction(s,`economy:branchteach:${node.id}`,'教导：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,[node.id]),...theoryNeeds(s,node.parents,s.household.heirId),
      ...(s.household.heirId===s.household.activePersonId||!s.persons[s.household.heirId].vitality?.alive?['没有可教导的弟子']:[]),
      ...(s.sect&&(s.sect.members[s.household.heirId]?.time??0)<2?['弟子本季学习时间不足']:[]),
      ...(branchKnown(s,node.id,s.household.heirId)?['弟子已经掌握']:[]),
    ],'一次教导一个有前置基础的节点，让弟子在交接前提前掌握；未教导的节点仍可在接手后自行学习。未成年弟子受教会记入当季养育。',(d,ev)=>{if(d.sect){d.sect.members[d.household.heirId].time-=2;d.persons[d.household.heirId].vitality!.pressure+=1;}if(d.life)d.life.seasonTaught=true;(d.economy!.branches!.learned[d.household.heirId]??=[]).push(node.id);ev.push({type:'branch',operation:'taught',node:node.id,detail:'弟子学会'+branchName(node.id)});}));
  }
  for(const channel of ['electric','metal']){
    const price=channel==='electric'?r.branches!.electricFee:r.branches!.metalFee;
    out.push(defineAction(s,`economy:channel:${channel}`,channel==='electric'?'联络电工材料商':'签订稳定金属供货','渠道',{money:price},[
      ...(b.channels.includes(channel)?['已经建立渠道']:[]),
      ...(channel==='electric'?branchNeeds(s,['M4']):!b.delivered.includes('shaft')?['先完成一次真实传动轴交付']:[]),
    ],`支付${price}钱渠道服务费，材料另行按价购买并受库存、运输与到货限制。下季更新供应，不赠送启动材料。`,(d,ev)=>{d.economy!.branches!.channels.push(channel);ev.push({type:'branch',operation:'channel',node:channel,detail:'已建立采购渠道，下季补充货源'});}));
  }
  return out;
}
