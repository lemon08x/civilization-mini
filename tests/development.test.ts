import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadContext } from '../apps/cli/context.js';
import { createSession, observeSession, submitCommand } from '../src/runtime/session.js';
import { replayRecord } from '../src/runtime/replay.js';
import { resolveRuleset, validateRuleset } from '../src/game/ruleset.js';
import { validateFramework } from '../src/research/knowledge-framework.js';
import { developmentMetrics } from '../src/research/metrics.js';
const {developmentBase:base,societyBase,implementation}=await loadContext();
async function game(scenarioId='woodland') {
  let session=await createSession({runId:'development-test',ruleset:resolveRuleset(base,{actionsPerTurn:6,turnsPerGeneration:24,initialFood:30,initialMoney:30,'production.baseStorage':12}),implementation,seed:17,scenarioId});
  return {get session(){return session;},get o(){return observeSession(session).game;},async act(...ids:string[]){for(const actionId of ids)session=(await submitCommand(session,{commandId:`test:${session.record.entries.length}`,expectedRevision:session.record.entries.length,actionId})).session;}};
}
test('新规则与框架独立版本，参数有界，旧规则没有新增状态或行动',async()=>{
  assert.equal(base.rulesVersion,'0.5.0');
  const f=validateFramework(JSON.parse(await readFile('experiments/frameworks/knowledge.v2.json','utf8')),base);
  assert.equal(f.nodes.length,34);assert.equal(f.nodes.filter(n=>n.status==='implemented').length,17);
  assert.throws(()=>resolveRuleset(base,{'development.experienceStep':0}));
  assert.throws(()=>resolveRuleset(societyBase,{'development.experienceStep':2}));
  assert.throws(()=>validateRuleset({...societyBase,development:base.development}));
  const s=await createSession({runId:'frozen',ruleset:societyBase,implementation,seed:17,scenarioId:'woodland'});
  assert.equal(observeSession(s).game.development,undefined);
  assert.ok(!observeSession(s).game.actions.some(a=>a.id.startsWith('develop:')));
});
test('完成制作才长技能，工业扣料一次、共用项目位，失败不改变记录',async()=>{
  const g=await game();
  await g.act('study:woodworking','study:woodworking','gather:wood','craft:woodenware');
  assert.equal(g.o.development!.skills.find(s=>s.domain==='woodwork')!.experience,0);
  await g.act('finish-craft','gather:wood','craft:woodenware','finish-craft','study:mechanics','procure:ceramicParts','gather:wood');
  assert.equal(g.o.development!.skills.find(s=>s.domain==='woodwork')!.level,1);
  while(g.o.production!.inventory.wood<3)await g.act('gather:wood');
  if(g.o.ap===1)await g.act('end-turn');
  const wood=g.o.production!.inventory.wood;
  await g.act('develop:mechanisms');
  assert.equal(g.o.production!.inventory.wood,wood-3);assert.equal(g.o.development!.goods.ceramicParts,0);
  const before=JSON.stringify(g.session.record);
  await assert.rejects(g.act('craft:woodenware'),/项目/);await assert.rejects(g.act('develop:mechanisms'));
  assert.equal(JSON.stringify(g.session.record),before);
  await g.act('finish-development');assert.equal(g.o.development!.goods.mechanisms,1);
  assert.equal(g.o.production!.inventory.wood,wood-3);
  assert.deepEqual((await replayRecord(g.session.record,implementation)).state,g.session.state);
});
test('农业补给实际进入科学实验、工艺改良，实习与实物跨代保留',async()=>{
  const g=await game();
  await g.act('study:observation','cultivate','study:agronomy','gather:wood','develop:supplies','finish-development','study:experimentation','procure:ceramicParts','conduct-experiment');
  assert.equal(g.o.development!.goods.supplies,1);assert.equal(g.o.development!.goods.findings,1);
  await g.act('refine:agriculture','mentor:agriculture');
  assert.equal(g.o.development!.goods.findings,0);assert.equal(g.o.development!.goods.supplies,0);
  assert.equal(g.o.actions.find(a=>a.id==='develop:supplies')!.food,3);
  assert.equal(g.o.development!.skills.find(s=>s.domain==='agriculture')!.heirExperience,1);
  await g.act('procure:fieldTools','equip:field','gather:wood','develop:supplies');
  const assets=structuredClone(g.o.development!);
  while(g.o.status==='active') {if(g.o.family.food<4)await g.act('gather:food');else await g.act('end-turn');}
  await g.act('handover');
  assert.deepEqual(g.o.development!.designs,assets.designs);assert.deepEqual(g.o.development!.project,assets.project);
  assert.equal(g.o.development!.fieldDurability,4);
  assert.equal(g.o.development!.skills.find(s=>s.domain==='agriculture')!.experience,1);
  assert.ok(!g.o.person.mastered.includes('agronomy'));
  await g.act('finish-development');assert.equal(g.o.development!.goods.supplies,2);
  assert.equal(developmentMetrics(g.session.record).refinements,1);
  assert.deepEqual((await replayRecord(g.session.record,implementation)).state,g.session.state);
});
test('采购不加经验，买卖不套利，设备不叠加、真实使用才损耗',async()=>{
  const g=await game();await g.act('procure:fieldTools','equip:field');
  const m=g.o.family.money;await g.act('procure:supplies','deliver:supplies');assert.equal(g.o.family.money,m-1);
  assert.ok(g.o.development!.skills.every(s=>s.experience===0));
  await assert.rejects(g.act('equip:field'));
  await g.act('cultivate');const harvest=g.session.record.entries.at(-1)!.events.find(e=>e.type==='harvest');assert.ok(harvest);
  assert.equal(g.o.development!.fieldDurability,harvest.food>0?3:4);
  assert.ok(!JSON.stringify(observeSession(g.session)).includes('randomState'));
  assert.ok(!Object.hasOwn(observeSession(g.session),'seed'));
});
test('陶作跨季后才完工，构件继续积累陶作经验',async()=>{
  const g=await game('clay-valley');
  await g.act('study:controlled-fire','gather:wood','practice:controlled-fire:fire-tended','study:pottery','study:pottery','gather:clay');
  for(let i=0;i<2;i++) {
    await g.act('gather:wood','gather:clay','craft:pottery');
    if(!g.o.actions.find(a=>a.id==='finish-craft')!.enabled)await g.act('end-turn');
    await g.act('finish-craft');
  }
  await g.act('study:ceramic-engineering');
  while(g.o.production!.inventory.wood<2) {if(g.o.production!.stocks.timber===0)await g.act('end-turn');else await g.act('gather:wood');}
  while(g.o.production!.inventory.clay<2)await g.act('gather:clay');
  if(g.o.ap===1)await g.act('end-turn');
  await g.act('develop:ceramicParts');
  await assert.rejects(g.act('finish-development'),/跨季/);
  await g.act('end-turn','finish-development');
  assert.equal(g.o.development!.goods.ceramicParts,2);
  assert.equal(g.o.development!.skills.find(s=>s.domain==='pottery')!.experience,4);
});

test('实验设备提高研究产出；持续陶作可进入精密制造并交付',async()=>{
  const g=await game('clay-valley');
  await g.act('study:controlled-fire','gather:wood','practice:controlled-fire:fire-tended','study:pottery','study:pottery');
  async function start(id:string) {
    for(let i=0;i<30;i++) {
      const a=g.o.actions.find(a=>a.id===id)!;
      if(a.enabled){await g.act(id);return;}
      const needed=Object.entries(a.materials??{}).find(([m,n])=>g.o.production!.inventory[m as 'wood'|'clay']<n);
      if(needed&&g.o.actions.find(a=>a.id===`gather:${needed[0]}`)!.enabled)await g.act(`gather:${needed[0]}`);
      else if(g.o.family.food<4 && g.o.actions.find(a=>a.id==='cultivate')!.enabled)await g.act('cultivate');
      else await g.act('end-turn');
    }
    assert.fail('材料工序未能就绪');
  }
  async function finish(id:string){if(!g.o.actions.find(a=>a.id===id)!.enabled)await g.act('end-turn');await g.act(id);}
  for(let i=0;i<2;i++){await start('craft:pottery');await finish('finish-craft');}
  await g.act('study:ceramic-engineering');
  for(let i=0;i<3;i++){await start('develop:ceramicParts');await finish('finish-development');}
  assert.equal(g.o.development!.skills.find(s=>s.domain==='pottery')!.level,2);
  await g.act('study:precision-engineering','procure:mechanisms');
  if(!g.o.actions.find(a=>a.id==='procure:supplies')!.enabled)await g.act('end-turn');
  await g.act('procure:supplies');await start('develop:precisionParts');
  const parts=g.o.development!.goods.ceramicParts;
  await finish('finish-development');assert.equal(g.o.development!.goods.precisionParts,1);assert.equal(g.o.development!.goods.ceramicParts,parts);
  await g.act('deliver:precisionParts');assert.equal(developmentMetrics(g.session.record).deliveryIncome,17);
  await g.act('study:experimentation','procure:labTools','equip:lab');
  if(!g.o.actions.find(a=>a.id==='procure:supplies')!.enabled)await g.act('end-turn');
  await g.act('procure:supplies');
  if(g.o.family.food<3)await g.act('buy-food');
  await g.act('conduct-experiment');
  assert.equal(g.o.development!.goods.findings,2);assert.equal(g.o.development!.labDurability,3);
  assert.deepEqual((await replayRecord(g.session.record,implementation)).state,g.session.state);
});
