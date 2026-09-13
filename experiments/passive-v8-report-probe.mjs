import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadContext} from '../dist/apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const {pacingBase,investmentBase,implementation}=await loadContext();
const output=`experiments/history/report-commerce-${Date.now()}`;await mkdir(output,{recursive:true});
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
function controller(){
  const steps=['study:experimentation','procure:precisionParts','procure:labTools','fabricate:calibrator','finish-product','install-product:calibrator',
    ...Array.from({length:4},()=>['procure:ceramicParts','procure:supplies','conduct-experiment','procure:supplies','operate','sell']).flat()];
  let index=0;
  return ({game:g})=>{
    if(g.status==='handover')return 'handover';if(g.status!=='active'||index>=steps.length)return null;
    const offer=id=>g.actions.find(a=>a.id===id),enabled=id=>offer(id)?.enabled;
    const eat=()=>[['cultivate',g.harvest.food],['gather:food',g.production.gathering.food]].filter(([id,n])=>enabled(id)&&n>0).sort((a,b)=>b[1]-a[1])[0]?.[0]??(enabled('buy-food')?'buy-food':enabled('work')?'work':'end-turn');
    let id=steps[index];
    if(id==='sell'&&!offer('sell-calibration')){index++;return 'end-turn';}
    if(id==='sell')id='sell-calibration';
    if(id==='operate')id=offer('calibrate')?'calibrate':'end-turn';
    if(g.family.food<2+(offer(id)?.food??0))return eat();
    if(id==='conduct-experiment'&&!enabled(id)&&!(g.person.learning.experimentation>=1)&&!g.person.mastered.includes('experimentation'))return enabled('study:experimentation')?'study:experimentation':enabled('work')?'work':'end-turn';
    if(enabled(id)){index++;return id;}
    if(g.family.money<(offer(id)?.money??0))return enabled('work')?'work':'end-turn';
    return 'end-turn';
  };
}
const summaries=[];
for(const [variant,ruleset]of [['v7',pacingBase],['v8',investmentBase]]){
  let s=await createSession({runId:`report-${variant}`,ruleset,implementation,seed:17,scenarioId:'clay-valley',agent:{kind:'scripted',name:'report-commerce',policyFingerprint}});const choose=controller();
  for(let i=0;i<220;i++){const o=observeSession(s),actionId=choose(o);if(!actionId)break;s=(await submitCommand(s,{commandId:`step:${i}`,expectedRevision:o.revision,actionId})).session;}
  await replayRecord(s.record,implementation);await writeFile(`${output}/${variant}.json`,JSON.stringify(s.record,null,2)+'\n',{flag:'wx'});
  const e=s.record.entries.flatMap(e=>e.events);
  summaries.push({variant,manifest:s.record.manifest,season:s.state.clock.absoluteTurn,status:s.state.status,reportRevenue:e.filter(e=>e.type==='calibration-sold').reduce((n,e)=>n+e.money,0),reportsProduced:e.filter(e=>e.type==='product-operated'&&e.device==='calibrator').length,partsPurchaseCost:e.filter(e=>e.type==='development-traded'&&e.operation==='buy').reduce((n,e)=>n+e.money,0),manualOperations:s.record.entries.filter(e=>e.command.actionId==='calibrate').length,missing:e.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),commands:s.record.entries.length,replay:'passed'});
}
await writeFile(`${output}/results.json`,JSON.stringify({kind:'scripted-baseline',hypothesis:'experiments/passive-v8-hypothesis.md',policyFingerprint,summaries},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,summaries:summaries.map(({manifest,...s})=>s)},null,2));
