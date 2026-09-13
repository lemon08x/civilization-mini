import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadContext} from '../dist/apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
import {metrics} from '../dist/src/research/metrics.js';
import {chooseAction} from '../dist/src/agents/scripted/baseline.js';
const {base,implementation}=await loadContext();
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).update(await readFile('dist/src/agents/scripted/baseline.js')).update(await readFile('dist/src/agents/scripted/production.js')).digest('hex');
const output=`experiments/history/craft-growth-${Date.now()}`;await mkdir(output,{recursive:true});
function progression(route) {
  let generation=0,index=0,plan=[];
  const agriculture=['study:observation','cultivate','study:agronomy','develop:supplies','finish-development','study:experimentation','procure:ceramicParts','conduct-experiment','refine:agriculture','mentor:agriculture'];
  const pottery=['study:controlled-fire','practice:controlled-fire:fire-tended','study:pottery','study:pottery','craft:pottery','finish-craft','craft:pottery','finish-craft','study:ceramic-engineering','develop:ceramicParts','finish-development','develop:ceramicParts','finish-development','develop:ceramicParts','finish-development','study:precision-engineering','procure:mechanisms','procure:supplies','develop:precisionParts','finish-development','deliver:precisionParts'];
  const science=['study:experimentation','conduct-experiment','conduct-experiment','refine:science','mentor:science'];
  return {get progress(){return {generation,index,remaining:plan.slice(index)};},choose(observation){
    const o=observation.game,legal=id=>o.actions.find(a=>a.id===id)?.enabled,offer=id=>o.actions.find(a=>a.id===id);
    if(legal('handover'))return 'handover';
    if(o.status!=='active')return null;
    if(generation!==o.clock.generation){generation=o.clock.generation;index=0;plan=generation===1?(route==='agriculture'?agriculture:pottery):science;}
    function food(){return legal('cultivate')&&o.harvest.food>=2?'cultivate':legal('gather:food')?'gather:food':legal('buy-food')?'buy-food':legal('work')?'work':'end-turn';}
    if(o.family.food<o.parameters.foodPerTurn)return food();
    const target=plan[index];
    if(target&&legal(target)) {index++;return target;}
    if(target){
      const a=offer(target);
      if(a&&o.family.food<a.food+ (o.ap===1?o.parameters.foodPerTurn:0))return food();
      if(a&&o.family.money<a.money)return legal('work')?'work':legal('sell-good:pottery')?'sell-good:pottery':'end-turn';
      for(const [g,n]of Object.entries(a?.materials??{}))if(o.production.inventory[g]<n)return legal(`gather:${g}`)?`gather:${g}`:g==='clay'&&legal('procure-clay')?'procure-clay':'end-turn';
      const needed=target==='conduct-experiment'?{supplies:1,ceramicParts:1}:target.startsWith('refine:')?{supplies:1}:{};
      for(const[g,n]of Object.entries(needed))if(o.development.goods[g]<n)return legal(`procure:${g}`)?`procure:${g}`:legal('work')?'work':'end-turn';
      return 'end-turn';
    }
    if(legal('finish-development'))return 'finish-development';
    if(legal('deliver:supplies')&&o.development.goods.supplies>2)return 'deliver:supplies';
    if(legal('develop:supplies')&&o.family.food>=7)return 'develop:supplies';
    if(legal('cultivate')&&o.harvest.food>=2)return 'cultivate';
    if(legal('gather:wood')&&o.production.inventory.wood<2)return 'gather:wood';
    return legal('work')?'work':'end-turn';
  }};
}
const runs=[];
for(const scenarioId of ['woodland','clay-valley'])for(const strategy of ['subsistence','progression']){
  const controller=progression(scenarioId==='woodland'?'agriculture':'pottery');
  let session=await createSession({runId:`growth-${scenarioId}-${strategy}`,ruleset:base,implementation,seed:17,scenarioId,agent:{kind:'scripted',name:strategy,policyFingerprint}});
  for(let i=0;i<160;i++){const o=observeSession(session);const actionId=strategy==='subsistence'?chooseAction(o,'subsistence'):controller.choose(o);if(!actionId)break;session=(await submitCommand(session,{commandId:`probe:${i}`,expectedRevision:o.revision,actionId})).session;}
  await replayRecord(session.record,implementation);
  await writeFile(`${output}/${session.record.manifest.runId}.json`,JSON.stringify(session.record,null,2)+'\n',{flag:'wx'});
  runs.push({scenarioId,strategy,manifest:session.record.manifest,metrics:metrics(session.record,session.state),...(strategy==='progression'?{progress:controller.progress}:{}),replay:'passed'});
}
await writeFile(`${output}/results.json`,JSON.stringify({question:'craft-growth-hypothesis.md',controller:'脚本基线，不是大模型 AI',policyFingerprint,runs},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,runs:runs.map(r=>({scenario:r.scenarioId,strategy:r.strategy,status:r.metrics.status,shortfall:r.metrics.foodShortfall,development:r.metrics.development,progress:r.progress}))},null,2));
