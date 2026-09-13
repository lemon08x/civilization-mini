import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadContext} from '../dist/apps/cli/context.js';
import {resolveRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
import {metrics} from '../dist/src/research/metrics.js';
const {base,implementation}=await loadContext();
if(base.rulesVersion!=='0.6.0')throw new Error('探针仅用于规则0.6.0；请创建新版探针，不混用历史实验。');
const ruleset=resolveRuleset(base,{initialMoney:30,initialFood:30,actionsPerTurn:6,turnsPerGeneration:24,'production.baseStorage':12});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const output=`experiments/history/product-network-${Date.now()}`;await mkdir(output,{recursive:true});
const results=[];
for(const mode of ['sell','calibrate']){
 let session=await createSession({runId:`product-${mode}`,ruleset,implementation,seed:17,scenarioId:'clay-valley',agent:{kind:'scripted',name:`product-${mode}`,policyFingerprint}});
 const plan=['study:experimentation','procure:precisionParts','procure:labTools',...(mode==='sell'?['deliver:precisionParts','deliver:labTools']:['fabricate:calibrator','finish-product','install-product:calibrator']),'procure:ceramicParts','procure:supplies','conduct-experiment',...(mode==='calibrate'?['procure:supplies','calibrate']:[])];
 let step=0;
 for(let i=0;i<90&&step<plan.length;i++){
  const o=observeSession(session),g=o.game,a=g.actions.find(a=>a.id===plan[step]),legal=id=>g.actions.some(a=>a.id===id&&a.enabled);
  let actionId;
  if(g.status!=='active')break;
  if(g.family.food<3)actionId=legal('cultivate')&&g.harvest.food>0?'cultivate':legal('gather:food')?'gather:food':legal('buy-food')?'buy-food':'end-turn';
  else if(a?.enabled){actionId=a.id;step++;}
  else if(a&&g.family.money<a.money&&legal('work'))actionId='work';
  else actionId='end-turn';
  session=(await submitCommand(session,{commandId:`probe:${i}`,expectedRevision:o.revision,actionId})).session;
 }
 await replayRecord(session.record,implementation);
 await writeFile(`${output}/${mode}.json`,JSON.stringify(session.record,null,2)+'\n',{flag:'wx'});
 results.push({mode,completedPlan:step===plan.length,manifest:session.record.manifest,metrics:metrics(session.record,session.state),replay:'passed'});
}
await writeFile(`${output}/results.json`,JSON.stringify({kind:'scripted-capability-probe',question:'product-network-hypothesis.md',policyFingerprint,results},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,results:results.map(r=>({mode:r.mode,completed:r.completedPlan,money:r.metrics.money,foodShortfall:r.metrics.foodShortfall,productNetwork:r.metrics.productNetwork,assets:r.metrics.productAssets}))},null,2));
