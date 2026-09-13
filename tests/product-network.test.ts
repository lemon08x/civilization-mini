import {readFile} from 'node:fs/promises';
import {diagnoseRecord,validateFramework} from '../src/research/knowledge-framework.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContext} from '../apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {resolveRuleset,validateRuleset} from '../src/game/ruleset.js';
import {productNetworkMetrics} from '../src/research/metrics.js';
const {base,developmentBase,implementation}=await loadContext();
async function setup(){
  let session=await createSession({runId:'product-network-test',ruleset:resolveRuleset(base,{actionsPerTurn:6,turnsPerGeneration:24,initialFood:30,initialMoney:30,foodPerTurn:1,workIncome:8,'production.baseStorage':12}),implementation,seed:17,scenarioId:'clay-valley'});
  const o=()=>observeSession(session).game;
  async function act(id:string){session=(await submitCommand(session,{commandId:`product:${session.record.entries.length}`,expectedRevision:session.record.entries.length,actionId:id})).session;}
  async function doAction(id:string){
    for(let i=0;i<30;i++){
      const a=o().actions.find(a=>a.id===id)!;
      if(!a)throw new Error(`不存在行动 ${id}`);
      if(o().family.food<3&&o().actions.find(a=>a.id==='gather:food')?.enabled){await act('gather:food');continue;}
      if(a.enabled){await act(id);return;}
      if(o().family.money<a.money&&o().actions.find(a=>a.id==='work')?.enabled){await act('work');continue;}
      const missing=Object.entries(a.materials??{}).find(([m,n])=>o().production!.inventory[m as 'wood'|'clay']<n);
      if(missing&&o().actions.find(a=>a.id===`gather:${missing[0]}`)?.enabled){await act(`gather:${missing[0]}`);continue;}
      if(!/跨季|采购机会|木材不足|黏土不足|钱财不足/.test(a.reason))throw new Error(`${id}: ${a.reason}`);
      await act('end-turn');
    }
    throw new Error(`等待超限 ${id}`);
  }
  return {get session(){return session;},get o(){return o();},act,doAction,async chain(...ids:string[]){for(const id of ids)await doAction(id);}};
}
test('产品网络独立规则，旧规则不注入；图包含分流、汇合与回路',async()=>{
  assert.equal(validateFramework(JSON.parse(await readFile('experiments/frameworks/knowledge.v3.json','utf8')),base).nodes.filter(n=>n.status==='implemented').length,17);
  assert.equal(base.rulesVersion,'0.6.0');assert.throws(()=>validateRuleset({...developmentBase,productNetwork:true}));
  const old=await createSession({runId:'old-products',ruleset:developmentBase,implementation,seed:17,scenarioId:'woodland'});
  assert.equal(observeSession(old).game.productNetwork,undefined);
  assert.ok(!observeSession(old).game.actions.some(a=>a.id==='calibrate'));
  const g=await setup(),edges=g.o.productNetwork!.edges;
  assert.equal(edges.filter(e=>e.from==='precisionParts').length,3);
  assert.ok(edges.some(e=>e.from==='spentCeramics'&&e.to==='ceramicParts'));
  assert.ok(edges.some(e=>e.from==='calibrations'&&e.to==='pump'));
  assert.ok(!JSON.stringify(observeSession(g.session)).includes('randomState'));
});
test('高级产品开启校准、跨季蓄水、回收新操作，消耗守恒且可跨代使用',async()=>{
  const g=await setup();
  await assert.rejects(g.act('calibrate'),/校准仪/);
  await g.chain('study:experimentation','procure:precisionParts','procure:labTools','fabricate:calibrator');
  assert.ok(diagnoseRecord(g.session.record).findings.some(f=>f.kind==='product-unfinished'));
  assert.match(g.o.actions.find(a=>a.id==='develop:supplies')!.reason,/在制项目/);
  assert.match(g.o.actions.find(a=>a.id==='craft:woodenware')!.reason,/制作项目/);
  assert.equal(g.o.development!.goods.precisionParts,0);assert.equal(g.o.development!.goods.labTools,0);
  const before=JSON.stringify(g.session.record);await assert.rejects(g.act('fabricate:calibrator'),/在制项目/);assert.equal(JSON.stringify(g.session.record),before);
  await g.chain('finish-product','install-product:calibrator');
  assert.ok(diagnoseRecord(g.session.record).findings.some(f=>f.kind==='product-unused'));
  assert.ok(!g.o.actions.find(a=>a.id==='install-product:calibrator')!.enabled);
  for(let i=0;i<2;i++)await g.chain('procure:ceramicParts','procure:supplies','conduct-experiment','procure:supplies','calibrate');
  assert.ok(!diagnoseRecord(g.session.record).findings.some(f=>f.kind==='product-unused'));
  assert.equal(g.o.productNetwork!.goods.calibrations,2);assert.equal(g.o.productNetwork!.goods.spentCeramics,2);
  assert.equal(g.o.development!.goods.findings,0);assert.equal(g.o.productNetwork!.installed.calibrator,2);
  await g.chain('buy-method:woodworking','study:woodworking','gather:wood','craft:woodenware','finish-craft','study:mechanics','procure:precisionParts','procure:mechanisms','fabricate:pump','finish-product','install-product:pump');
  assert.equal(g.o.productNetwork!.goods.calibrations,1);
  await g.chain('gather:wood','gather:wood');
  while(g.o.world.weather!=='dry'||g.o.ap<3||g.o.world.water<2)await g.act('end-turn');
  const water=g.o.world.water,food=g.o.harvest.food;
  await g.act('pump-water');assert.equal(g.o.world.water,water-1);assert.equal(g.o.productNetwork!.storedWater,1);
  await g.act('pump-water');assert.equal(g.o.world.water,water-2);assert.equal(g.o.productNetwork!.storedWater,2);
  await assert.rejects(g.act('pump-water'));await g.act('end-turn');
  assert.equal(g.o.productNetwork!.storedWater,2);
  while(g.o.world.weather!=='dry')await g.act('end-turn');
  assert.ok(g.o.harvest.food>food);assert.equal(g.o.harvest.storedDrawn,2);
  await g.act('cultivate');assert.equal(g.o.productNetwork!.storedWater,0);
  assert.ok(g.session.record.entries.at(-1)!.events.some(e=>e.type==='stored-water-used'&&e.amount===2));
  await g.chain('study:controlled-fire','gather:wood','practice:controlled-fire:fire-tended','study:pottery','study:pottery','gather:clay','gather:wood','craft:pottery','finish-craft','study:ceramic-engineering','procure:precisionParts','procure:ceramicParts','procure:ceramicParts','fabricate:kiln','finish-product','install-product:kiln','gather:wood');
  const parts=g.o.development!.goods.ceramicParts;
  await g.act('recycle-ceramics');assert.equal(g.o.productNetwork!.goods.spentCeramics,0);assert.equal(g.o.development!.goods.ceramicParts,parts+1);
  const frozen=JSON.stringify(g.session.record);await assert.rejects(g.act('recycle-ceramics'),/用后陶料/);assert.equal(JSON.stringify(g.session.record),frozen);
  await g.chain('gather:wood','gather:wood');
  const assets=structuredClone(g.o.productNetwork!);
  while(g.o.status==='active'){if(g.o.family.food<3&&g.o.actions.find(a=>a.id==='gather:food')?.enabled)await g.act('gather:food');else await g.act('end-turn');}
  await g.act('handover');assert.deepEqual(g.o.productNetwork, {...g.o.productNetwork,...assets});
  assert.ok(!g.o.person.mastered.includes('mechanics'));await g.act('pump-water');assert.equal(g.o.productNetwork!.installed.pump,assets.installed.pump-1);
  const m=productNetworkMetrics(g.session.record);assert.equal(m.operations.calibrator,2);assert.equal(m.operations.kiln,1);assert.ok(m.usesByGeneration[2].includes('pump'));
  assert.deepEqual((await replayRecord(g.session.record,implementation)).state,g.session.state);
});
