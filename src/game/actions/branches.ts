import {ELECTRIC_EPIGRAPHS} from '../model/electric.js';
import {branchNodesFor,nodeInEra} from '../model/branches.js';
import {ancestorKnows} from '../systems/ancestry.js';
import {branchHas,branchNeeds,branchName} from '../systems/branches.js';
import {changeGoods,missingGoods} from '../systems/economy.js';
import {defineAction,type ActionDefinition} from './definition.js';
import type {GameState} from '../model/state.js';
import type {Ruleset} from '../ruleset.js';
export function branchActions(s:GameState,r:Ruleset):ActionDefinition[]{
  const b=s.economy?.branches;if(!b)return [];
  const out:ActionDefinition[]=[];
  for(const node of branchNodesFor(s)){
    const unavailable=nodeInEra(s,node.id)?[]:['当前社会尚未开放此课程'];
    const archived=b.archives.includes(node.id),sample=s.economy!.industry||archived?{}:node.sample;
    out.push(defineAction(s,`economy:branchlearn:${node.id}`,'学习：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,node.parents),...(branchHas(s,node.id)?['已经掌握']:[]),...missingGoods(s,sample),
    ],`${s.economy!.industry?'学科只检查前置知识；部分课程要社会发展到相应阶段才开放。学习不消耗样品。':node.benefit+'。'}${s.economy!.industry?(archived?'家学减少学习时间。':''):archived?'按家学学习，无需重复消耗实验样品':'通过地方入门指导与实物练习学习；样品：'+(Object.entries(sample).map(([k,n])=>`${k}×${n}`).join('、')||'无')}。${ancestorKnows(s,node.id)?'前代已学：仍须先学前置，本节点学习成本大幅降低。':s.life?.renewal?'本代首次探索；学会后直系后代学习成本大幅降低。':''}${s.life?.consultPending===node.id?'长辈已指点：本次学习时间减少。':''}天赋影响时间精力报价。${s.electric&&ELECTRIC_EPIGRAPHS[node.id]?ELECTRIC_EPIGRAPHS[node.id]:''}`,(d,ev)=>{
      if(d.life?.consultPending===node.id)delete d.life.consultPending;
      changeGoods(d,sample,-1,ev,'学习样品');(d.economy!.branches!.learned[d.household.activePersonId]??=[]).push(node.id);
      ev.push({type:'branch',operation:'learned',node:node.id,detail:'掌握'+node.name});
    }));
    out.push(defineAction(s,`economy:brancharchive:${node.id}`,'留存：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,[node.id]),...(archived?['已经留存']:[]),
    ],'保留学习来源，后辈仍须投入时间学习，不自动复制个人理解。',(d,ev)=>{d.economy!.branches!.archives.push(node.id);ev.push({type:'branch',operation:'archived',node:node.id,detail:'已留存'+node.name});}));
    out.push(defineAction(s,`economy:branchteach:${node.id}`,'教导：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,[node.id]),...branchNeeds(s,node.parents,s.household.heirId),
      ...(s.household.heirId===s.household.activePersonId||!s.persons[s.household.heirId].vitality?.alive?['没有可教导的后辈']:[]),
      ...(branchHas(s,node.id,s.household.heirId)?['后辈已经掌握']:[]),
    ],'一次教导一个有前置基础的节点，让后辈在交接前提前掌握；未教导的节点仍可在接手后自行学习。未成年后辈受教会记入当季养育。',(d,ev)=>{if(d.life)d.life.seasonTaught=true;(d.economy!.branches!.learned[d.household.heirId]??=[]).push(node.id);ev.push({type:'branch',operation:'taught',node:node.id,detail:'后辈学会'+branchName(node.id)});}));
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
