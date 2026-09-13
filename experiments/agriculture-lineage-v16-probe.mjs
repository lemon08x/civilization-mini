// 最小对照：同一观察驱动脚本，river 种子17，v15 vs v16。非大模型。
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';

const v15=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v15.json','utf8')));
const v16=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v16.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const output=`artifacts/experiments/agriculture-lineage-v16-${Date.now()}`;
await mkdir(output,{recursive:true});

function can(o,id){return o.game.actions.find(a=>a.id===id)?.enabled??false;}
function amt(o,id){return o.game.economy.goods[id]??0;}
function lvl(o,s){return o.game.economy.disciplines.find(d=>d.subject===s)?.level??0;}
function first(o,ids){for(const id of ids)if(can(o,id))return id;return null;}
function done(o,id){return !!o.game.economy.expeditionView.attempts[id]?.completed;}

function choose(o){
  const g=o.game,e=g.economy,x=e.expeditionView,f=e.field;
  if(g.status==='handover')return 'handover';
  if(g.status!=='active')return null;
  if(e.operationsView?.paused&&can(o,'economy:resumeplans:family'))return 'economy:resumeplans:family';
  if(can(o,'economy:finish:project'))return 'economy:finish:project';
  if(e.foodTotal<3){
    if(f.crop&&can(o,`economy:farm:${f.crop}`))return `economy:farm:${f.crop}`;
    return first(o,['economy:gather:food','economy:work:local','economy:end:season']);
  }
  if(f.crop&&f.growth>=f.duration&&can(o,'economy:farm:wheat'))return 'economy:farm:wheat';
  if(!f.crop&&amt(o,'seedWheat')>0&&can(o,'economy:farm:wheat'))return 'economy:farm:wheat';
  if(f.crop&&f.growth<f.duration&&can(o,'economy:farm:wheat'))return 'economy:farm:wheat';
  const order=x.catalog.some(c=>c.id==='parts')
    ?['harvest','kiln','parts','waterworks']
    :['harvest','kiln','waterworks'];
  const goal=order.find(id=>!done(o,id));
  if(goal&&x.selected!==goal&&can(o,`economy:expeditionstart:${goal}`)){
    if(x.selected&&x.attempts[x.selected]?.active&&can(o,'economy:expeditionpause:current'))return 'economy:expeditionpause:current';
    return `economy:expeditionstart:${goal}`;
  }
  if(goal&&x.selected===goal&&can(o,'economy:expeditionship:current'))return 'economy:expeditionship:current';
  if(can(o,'economy:study:O01'))return 'economy:study:O01';
  if(can(o,'economy:foodplan:on'))return 'economy:foodplan:on';
  for(const s of ['materials','heat','mechanics','agronomy','chemistry']){
    const d=e.disciplines.find(x=>x.subject===s);const t=d?.topics.find(t=>t.level===d.level+1);
    if(t&&can(o,`economy:study:${t.id}`))return `economy:study:${t.id}`;
    if(t&&can(o,`economy:research:${t.id}`))return `economy:research:${t.id}`;
  }
  if(can(o,'economy:process:ceramics'))return 'economy:process:ceramics';
  if(can(o,'economy:build:F02'))return 'economy:build:F02';
  if(can(o,'economy:build:T03'))return 'economy:build:T03';
  if(can(o,'economy:process:shaft')&&amt(o,'shaft')<2)return 'economy:process:shaft';
  if(can(o,'economy:process:seal')&&amt(o,'seal')<2)return 'economy:process:seal';
  if(can(o,'economy:process:rope')&&amt(o,'rope')<1)return 'economy:process:rope';
  if(can(o,'economy:process:fiber'))return 'economy:process:fiber';
  if(can(o,'economy:process:oil'))return 'economy:process:oil';
  if(amt(o,'wood')<4&&can(o,'economy:gather:wood'))return 'economy:gather:wood';
  if(amt(o,'clay')<4&&can(o,'economy:gather:clay'))return 'economy:gather:clay';
  if(can(o,'economy:work:local')&&g.family.money<8)return 'economy:work:local';
  return can(o,'economy:end:season')?'economy:end:season':null;
}

async function play(rules,runId){
  let session=await createSession({runId,ruleset:rules,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',id:'lineage-v16-probe'}});
  let n=0,handoverKnow=[];
  while(!['complete','ended'].includes(session.state.status)&&n<220){
    const o=observeSession(session);
    const before=o.game.status;
    const id=choose(o);if(!id)break;
    session=(await submitCommand(session,{actionId:id,commandId:'p'+o.revision,expectedRevision:o.revision,reason:'probe'})).session;
    n++;
    const after=observeSession(session);
    if(before==='handover'&&after.game.status==='active'){
      handoverKnow.push({generation:after.game.clock.generation,knowledge:Object.fromEntries(after.game.economy.disciplines.map(d=>[d.subject,d.level])),notes:Object.fromEntries(after.game.economy.disciplines.map(d=>[d.subject,d.notes]))});
    }
  }
  const replayed=await replayRecord(session.record,implementation);
  const o=observeSession(replayed);
  const completed=Object.fromEntries(o.game.economy.expeditionView.catalog.map(c=>[c.id,!!o.game.economy.expeditionView.attempts[c.id]?.completed]));
  return {runId,rules:rules.rulesVersion,status:o.game.status,generation:o.game.clock.generation,season:o.game.clock.absoluteTurn,food:o.game.economy.foodTotal,money:o.game.family.money,supply:o.game.economy.expeditionView.supplyLevel,completed,knowledge:Object.fromEntries(o.game.economy.disciplines.map(d=>[d.subject,d.level])),handoverKnow,commands:n,replayOk:true};
}

const results=[await play(v15,'lineage-v15'),await play(v16,'lineage-v16')];
const report={question:'v16家学接续与传动工场是否打通窑场到水利，并避免换代从零重学',implementation,method:'观察驱动脚本基线，river，种子17，双方同一策略',results};
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
for(const r of results)console.log(`${r.rules} gen${r.generation}s${r.season} ${r.status} supply${r.supply} done=${Object.entries(r.completed).filter(([,v])=>v).map(([k])=>k).join(',')||'none'} know=${JSON.stringify(r.knowledge)} handovers=${r.handoverKnow.length}`);
console.log('wrote',output+'/report.json');
