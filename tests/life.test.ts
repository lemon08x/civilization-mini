import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {getObservation} from '../src/game/observation.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {energyCeiling,healthCeiling} from '../src/game/systems/life.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {loadCurrentContext} from '../apps/cli/context.js';
import {metrics} from '../src/research/metrics.js';

const rules=validateRuleset(JSON.parse(await readFile('rulesets/life-and-time.v17.json','utf8')));
const old=validateRuleset(JSON.parse(await readFile('rulesets/agriculture-civilization.v15.json','utf8')));
const fresh=()=>structuredClone(createInitialState(rules,17,'river'));
const act=(s:ReturnType<typeof fresh>,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
const offer=(s:ReturnType<typeof fresh>,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;

test('人生规则参数严格限定到v17，候选可单独覆盖，旧AP规则不变',()=>{
  assert.throws(()=>validateRuleset({...old,life:rules.life}));
  assert.throws(()=>validateRuleset({...rules,life:undefined}));
  assert.throws(()=>resolveRuleset(rules,{'life.restRecovery':100}));
  assert.throws(()=>resolveRuleset(rules,{'life.unknown':1}));
  assert.equal(resolveRuleset(rules,{'life.restRecovery':4}).life!.restRecovery,4);
  const s=createInitialState(old,17,'river');assert.equal(s.ap,3);assert.equal(s.life,undefined);
  const a=getAvailableActions(s,old).find(a=>a.id==='economy:gather:wood')!;
  assert.equal(a.ap,1);assert.equal(a.time,undefined);
});
test('人物生成确定、不同种子有差异，观察不泄露寿命、体质随机值或随机状态',()=>{
  assert.deepEqual(fresh(),fresh());
  const identities=new Set([17,23,42,59].map(seed=>JSON.stringify(activePerson(createInitialState(rules,seed,'river')).vitality)));
  assert.ok(identities.size>1);
  const o=getObservation(fresh(),rules),serialized=JSON.stringify(o);
  for(const secret of ['lifespanSeasons','randomState','constitution','childId'])assert.ok(!serialized.includes(secret));
  assert.equal(o.life!.person.ageYears,40);assert.equal(o.life!.heir!.ageYears,16);
});
test('报价和扣费一致、疲劳不可透支、拒绝命令不修改原状态',()=>{
  const s=fresh(),a=offer(s,'gather:wood'),before=structuredClone(s);
  const result=act(s,'gather:wood');assert.equal(result.state.life!.timeRemaining,12-a.time!);
  assert.equal(activePerson(result.state).vitality!.energy,activePerson(s).vitality!.energy-a.energy!);
  assert.deepEqual(s,before);assert.deepEqual(result.events[0].type,'action-paid');
  activePerson(s).vitality!.energy=0;
  assert.equal(offer(s,'gather:wood').enabled,false);
  assert.throws(()=>act(s,'gather:wood'),/精力不足/);
  assert.equal(activePerson(s).vitality!.energy,0);
});
test('休息消耗时间且按上限恢复；满精力不能刷休息；免费设置不推进季节',()=>{
  const s=fresh();activePerson(s).vitality!.energy=1;
  const rested=act(s,'rest:self').state;
  assert.equal(rested.life!.timeRemaining,8);assert.ok(activePerson(rested).vitality!.energy>1);
  activePerson(s).vitality!.energy=energyCeiling(activePerson(s).vitality!);
  assert.equal(offer(s,'rest:self').enabled,false);
  const cart=act(s,'cartadd:good-food').state;
  assert.equal(cart.clock.absoluteTurn,1);assert.equal(cart.life!.timeRemaining,12);
  assert.equal(activePerson(cart).vitality!.energy,activePerson(s).vitality!.energy);
  s.life!.timeRemaining=3;activePerson(s).vitality!.energy=0;
  assert.equal(offer(s,'rest:self').enabled,false);assert.ok(offer(s,'end:season').enabled);
});
test('五类天赋只减免对应投入，不凭空生成产出',()=>{
  const s=fresh(),v=activePerson(s).vitality!;
  v.talent='resilient';const work=offer(s,'gather:wood');
  v.talent='strong';assert.equal(offer(s,'gather:wood').energy,work.energy!-1);
  v.talent='scholar';assert.equal(offer(s,'study:L01').time,3);
  v.talent='mentor';assert.equal(offer(s,'teach:agronomy').time,3);assert.equal(offer(s,'teach:agronomy').energy,1);
  v.talent='organizer';assert.equal(offer(s,'checkout:cart').time,1);
});
test('饥饿损害健康而非重复触发三季困顿，疗养不能逆转衰老上限',()=>{
  const s=fresh();s.household.food=0;s.household.hardship=2;s.economy!.goods.wheat=0;
  const next=act(s,'end:season').state;assert.equal(next.status,'active');
  assert.equal(activePerson(next).vitality!.health,85);
  const v=activePerson(s).vitality!;v.ageSeasons=65*4;v.health=79;s.household.money=10;
  const healed=act(s,'care:self').state;
  assert.equal(activePerson(healed).vitality!.health,healthCeiling(v,rules.life!));
  assert.equal(healed.household.money,8);
});
test('16季不强制换代；成年交接先结算，只前进一季且保留真实知识',()=>{
  const s=fresh();s.clock.turn=16;s.clock.absoluteTurn=16;s.household.food=20;
  assert.equal(act(s,'end:season').state.status,'active');
  assert.equal(offer(s,'retire:family').enabled,false);
  heir(s).vitality!.ageSeasons=18*4;
  s.economy!.knowledge[s.household.activePersonId]!.mechanics=5;
  const scheduled=act(s,'retire:family').state;assert.equal(scheduled.clock.absoluteTurn,16);
  const settlement=act(scheduled,'end:season');
  assert.equal(settlement.events.filter(e=>e.type==='generation-ended').length,1);
  const settled=settlement.state;assert.equal(settled.status,'handover');
  const count=Object.keys(s.persons).length,age=heir(settled).vitality!.ageSeasons;
  const next=act(settled,'handover').state;
  assert.equal(next.clock.absoluteTurn,17);assert.equal(next.clock.generation,2);
  assert.equal(activePerson(next).vitality!.ageSeasons,age);
  assert.equal(Object.keys(next.persons).length,count);
  assert.equal(next.economy!.knowledge[next.household.activePersonId]!.mechanics,undefined);
  assert.equal(offer(next,'retire:family').enabled,false);
  assert.equal(getObservation(next,rules).life!.heir,null);
});
test('后辈在生命过程中出生、从零成长，只出生一次',()=>{
  const s=fresh();heir(s).vitality!.ageSeasons=30*4-1;s.household.food=20;
  const born=act(s,'end:season').state;
  const id=heir(born).vitality!.childId!;assert.ok(id);
  assert.equal(born.persons[id].vitality!.ageSeasons,0);
  const next=act(born,'end:season').state;assert.equal(Object.keys(next.persons).length,3);
  assert.equal(next.persons[id].vitality!.ageSeasons,1);
});
test('死亡在季末结算；有成年继任者可交接，无继任者结束且健康不为负',()=>{
  const s=fresh();const v=activePerson(s).vitality!;v.ageSeasons=v.lifespanSeasons-1;
  heir(s).vitality!.ageSeasons=18*4;
  const dead=act(s,'end:season');assert.equal(dead.state.status,'handover');assert.equal(activePerson(dead.state).vitality!.alive,false);
  assert.ok(dead.events.some(e=>e.type==='life'&&e.operation==='death'));
  assert.equal(act(dead.state,'handover').state.status,'active');
  const starving=fresh();activePerson(starving).vitality!.health=1;starving.household.food=0;
  const ended=act(starving,'end:season').state;assert.equal(ended.status,'ended');assert.equal(activePerson(ended).vitality!.health,0);
});
test('真实行动接口重放人生变化，篡改恢复后的快照会被拒绝',async()=>{
  const {implementation}=await loadCurrentContext();
  let session=await createSession({runId:'life-replay',ruleset:rules,implementation,seed:17,scenarioId:'river'});
  for(const actionId of ['economy:gather:wood','economy:rest:self','economy:end:season']){
    const o=observeSession(session);
    session=(await submitCommand(session,{actionId,commandId:'life-'+o.revision,expectedRevision:o.revision})).session;
  }
  assert.deepEqual((await replayRecord(session.record,implementation)).state,session.state);
  const report=metrics(session.record,session.state);
  assert.equal(report.life!.rests,1);assert.equal(report.life!.timeSpent,8);
  const corrupt=structuredClone(session.record);corrupt.snapshots[0].state.persons['person:1'].vitality!.energy=999;
  await assert.rejects(replayRecord(corrupt,implementation));
});
