import {farmWork,plotField} from '../systems/agriculture.js';
import {amount} from '../systems/inventory.js';
import {CROPS} from '../systems/economy-catalog.js';
import { gainPractice,studyQuote } from '../systems/life.js';
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
    const lesson=studyQuote(s,node.id);
    const unavailable=nodeInEra(s,node.id)?[]:['当前社会尚未开放此课程'];
    const trial=node.id==='A4'&&!!s.economy!.farm;
    const trialCrop=trial?(['soy','flax'] as const).find(c=>s.economy!.farm!.discovered.includes(c)&&amount(s,CROPS[c].seed)>0):undefined;
    const trialPlot=trial?Object.values(s.economy!.farm!.plots).find(p=>p.kind==='field'&&!plotField(s,p.id)?.crop)?.id:undefined;
    const trialNeeds=trial?[...(!trialCrop?['先探索辨种或向同门换种，持有至少1份已发现的豆种或麻种']:[]),...(!trialPlot?['试种需要一块空田']:[])]:[];
    const archived=b.archives.includes(node.id),sample=trial||s.economy!.industry||archived?{}:node.sample;
    out.push(defineAction(s,`economy:branchlearn:${node.id}`,trial?'试种并掌握：'+node.name+(trialCrop&&trialPlot?`（${trialPlot} · ${CROPS[trialCrop].name}）`:''):'研习：'+node.name+(s.life?.calendar?`（${lesson.done}/${lesson.total}天）`:''),'分支',s.life?.calendar?{time:lesson.time,energy:lesson.energy}:{},[
      ...(lesson.time<=0?['可投入时间或饮食不足；请补给或推进日历']:[]),...unavailable,...trialNeeds,...branchNeeds(s,node.parents),...(branchHas(s,node.id)?['已经掌握']:[]),...missingGoods(s,sample),
    ],`${trial?`实践学习：${trialCrop&&trialPlot?`在 ${trialPlot} 播种${CROPS[trialCrop].name}，消耗1份${CROPS[trialCrop].name}种子`:'发现豆种或麻种并准备一块空田'}；播种后掌握本课，作物正常生长与结算。也可向同门请教本课。`:''}${trial?'试种计入本次行动，无需再播种。':s.economy!.industry?'学科只检查前置知识；部分课程要社会发展到相应阶段才开放。学习不消耗样品，按周投入，累计完成才掌握':node.benefit+'。'}${s.economy!.industry?(archived?'门派记录减少学习时间。':''):archived?'按门派记录学习，无需重复消耗实验样品':'通过地方入门指导与实物练习学习；样品：'+(Object.entries(sample).map(([k,n])=>`${k}×${n}`).join('、')||'无')}。${ancestorKnows(s,node.id)?'前代已学：仍须先学前置，本节点学习成本大幅降低。':s.life?.renewal?'本代首次探索；学会后师承弟子学习成本大幅降低。':''}${s.life?.consultPending===node.id?'长辈已指点：本次学习时间减少。':''}天赋影响时间精力报价。${s.electric&&ELECTRIC_EPIGRAPHS[node.id]?ELECTRIC_EPIGRAPHS[node.id]:''}`,(d,ev)=>{
      if(d.life?.calendar){const c=d.life.calendar;const done=Math.min(lesson.total,lesson.done+lesson.time);c.study[lesson.key]={done,total:lesson.total};ev.push({type:'branch',operation:'study-progress',node:node.id,detail:`${node.name}研习 ${done}/${lesson.total}天，进度可接续`});if(done<lesson.total)return;delete c.study[lesson.key];}
      if(d.life?.consultPending===node.id)delete d.life.consultPending;
      changeGoods(d,sample,-1,ev,'学习样品');(d.economy!.branches!.learned[d.household.activePersonId]??=[]).push(node.id);
      if(trial&&trialCrop&&trialPlot){const start=ev.length;farmWork(d,trialCrop,ev,undefined,plotField(d,trialPlot)!);for(const e of ev.slice(start))if(e.type==='economy-farm')e.plotId=trialPlot;}
      if(d.sect)gainPractice(d,d.household.activePersonId,1,ev);
      ev.push({type:'branch',operation:'learned',node:node.id,detail:'掌握'+node.name});
    }));
    out.push(defineAction(s,`economy:brancharchive:${node.id}`,'留存：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,[node.id]),...(archived?['已经留存']:[]),
    ],'保留学习来源，弟子仍须投入时间学习，不自动复制个人理解。',(d,ev)=>{d.economy!.branches!.archives.push(node.id);ev.push({type:'branch',operation:'archived',node:node.id,detail:'已留存'+node.name});}));
    out.push(defineAction(s,`economy:branchteach:${node.id}`,'教导：'+node.name,'分支',{},[
      ...unavailable,...branchNeeds(s,[node.id]),...branchNeeds(s,node.parents,s.household.heirId),
      ...(s.household.heirId===s.household.activePersonId||!s.persons[s.household.heirId].vitality?.alive?['没有可教导的弟子']:[]),
      ...(s.sect&&(s.sect.members[s.household.heirId]?.time??0)<2?['弟子本季学习时间不足']:[]),
      ...(s.sect&&s.persons[s.household.heirId].vitality!.energy<1?['弟子精力不足']:[]),
      ...(branchHas(s,node.id,s.household.heirId)?['弟子已经掌握']:[]),
    ],'一次教导一个有前置基础的节点，让弟子在交接前提前掌握；未教导的节点仍可在接手后自行学习。未成年弟子受教会记入当季养育。',(d,ev)=>{if(d.sect){d.sect.members[d.household.heirId].time-=2;d.persons[d.household.heirId].vitality!.energy-=1;gainPractice(d,d.household.activePersonId,1,ev);}if(d.life)d.life.seasonTaught=true;(d.economy!.branches!.learned[d.household.heirId]??=[]).push(node.id);ev.push({type:'branch',operation:'taught',node:node.id,detail:'弟子学会'+branchName(node.id)});}));
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
