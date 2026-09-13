// Minimal observation-only scripted baseline. No model calls or automatic adoption.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const rules=validateRuleset(JSON.parse(await readFile('experiments/life-and-time.v17.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const directory=`artifacts/experiments/life-v17-${Date.now()}`;
await mkdir(directory,{recursive:true});
function choose(o,rest){
  const can=id=>o.game.actions.some(a=>a.id===id&&a.enabled);
  if(o.game.status==='handover')return 'handover';
  if(o.game.economy.foodTotal<5&&can('economy:gather:food'))return 'economy:gather:food';
  if(rest&&o.game.life.person.energy<=3&&can('economy:rest:self'))return 'economy:rest:self';
  for(const id of ['economy:work:local','economy:gather:wood'])if(can(id))return id;
  return 'economy:end:season';
}
const results=[];
for(const seed of [17,23])for(const rest of [false,true]){
  const runId=`life-${seed}-${rest?'rest':'base'}`;
  let session=await createSession({runId,ruleset:rules,implementation,seed,scenarioId:'river',agent:{kind:'scripted',id:'life-probe',policyFingerprint}});
  for(let i=0;i<80;i++){
    const o=observeSession(session);
    if(o.game.clock.absoluteTurn>=7||['ended','complete'].includes(o.game.status))break;
    const actionId=choose(o,rest);
    session=(await submitCommand(session,{actionId,commandId:`p-${o.revision}`,expectedRevision:o.revision,reason:'scripted baseline; rest preference is the only intervention'})).session;
  }
  const replayed=await replayRecord(session.record,implementation),o=observeSession(replayed),events=replayed.record.entries.flatMap(e=>e.events);
  if(o.game.life.person.energy<0||o.game.life.person.energy>o.game.life.person.maxEnergy||o.game.life.person.health<0||o.game.life.person.health>100)throw Error('Body invariant failed; original records retained');
  await writeFile(`${directory}/${runId}.json`,JSON.stringify(session.record,null,2),{flag:'wx'});
  results.push({runId,seed,rest,season:o.game.clock.absoluteTurn,status:o.game.status,body:o.game.life.person,food:o.game.economy.foodTotal,money:o.game.family.money,commands:o.revision,rests:events.filter(e=>e.type==='life'&&e.operation==='rest').length,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),strictReplay:true});
}
const report={question:'同一观察驱动劳动策略下，主动休息如何改变前六季劳动、粮食与身体状态？',method:'脚本基线，无大模型调用；river、种子17/23，各对照仅改变低精力时是否主动休息',rulesVersion:rules.rulesVersion,implementation,policyFingerprint,results,scope:'仅六季机制对照；不证明长期寿命、传承、天赋或全科技路线平衡。后续不为追齐实现指纹重跑。'};
await writeFile(`${directory}/report.json`,JSON.stringify(report,null,2),{flag:'wx'});
console.log(JSON.stringify({directory,results},null,2));
