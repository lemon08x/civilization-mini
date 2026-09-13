import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {validateRuleset} from '../src/game/ruleset.js';
import {economyView} from '../src/game/systems/economy.js';
import {EXPEDITIONS,LINEAGE_EXPEDITIONS,newAttempt} from '../src/game/systems/expedition.js';

const v15=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v15.json','utf8')));
const v16=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v16.json','utf8')));
const fresh=(rules=v16)=>structuredClone(createInitialState(rules,17,'river'));
const act=(s:ReturnType<typeof createInitialState>,id:string,rules=v16)=>transition(s,parseActionId(id.startsWith('economy:')||id==='handover'?id:'economy:'+id),rules);
const end=(s:ReturnType<typeof createInitialState>,rules=v16)=>act(s,'end:season',rules);

test('家学接续只属于0.16.0，v15目录仍是六副本且整套装运',()=>{
  assert.equal(v15.householdLineage,undefined);
  assert.equal(v16.householdLineage,true);
  assert.throws(()=>validateRuleset({...v15,rulesVersion:'0.16.0'}));
  assert.throws(()=>validateRuleset({...v16,householdLineage:undefined}));
  const a=createInitialState(v15,17,'river'),b=createInitialState(v16,17,'river');
  assert.equal(a.economy!.lineage,undefined);
  assert.equal(b.economy!.lineage,true);
  assert.equal(economyView(a,v15).expeditionView!.catalog.length,6);
  assert.ok(economyView(b,v16).expeditionView!.catalog.some(f=>f.id==='parts'));
  assert.equal(EXPEDITIONS.find(f=>f.id==='waterworks')!.kit.shaft,2);
  assert.equal(LINEAGE_EXPEDITIONS.find(f=>f.id==='waterworks')!.kit.seal,2);
  assert.equal(LINEAGE_EXPEDITIONS.find(f=>f.id==='waterworks')!.kit.shaft,undefined);
  let s=fresh(v15);
  s=act(s,'expeditionstart:harvest',v15).state;s=structuredClone(s);
  s.economy!.goods.wheat=3;s.economy!.goods.wood=1;s.household.food=6;
  assert.throws(()=>act(s,'expeditionship:current',v15));
});

test('换代把本代学科写入家学并接续给后辈，生产证明不跨代',()=>{
  let s=fresh();
  s.economy!.knowledge['person:1']={agronomy:2,mechanics:3,materials:2,heat:1};
  s.clock.generation=1;s.clock.turn=16;s.clock.absoluteTurn=16;s.economy!.expeditions!.generationProofs=['mechanical'];
  const x=end(s);assert.equal(x.state.status,'handover');
  const handed=act(x.state,'handover');
  const y=handed.state;
  assert.equal(y.clock.generation,2);
  assert.equal(y.economy!.notes.mechanics,3);
  assert.equal(y.economy!.notes.materials,2);
  assert.equal(y.economy!.knowledge[y.household.activePersonId].mechanics,3);
  assert.equal(y.economy!.knowledge[y.household.activePersonId].agronomy,2);
  assert.deepEqual(y.economy!.expeditions!.generationProofs,[]);
  assert.ok(handed.events.some(e=>e.type==='economy-learned'&&e.source==='lineage'&&e.subject==='mechanics'));
});

test('v16可分批装运，本代先加工轴再开传动工场仍算证据',()=>{
  let s=fresh();
  s.household.food=8;s.economy!.goods={...s.economy!.goods,wood:4,iron:3,shaft:0};
  s.economy!.knowledge['person:1']={agronomy:1,mechanics:3,materials:2,heat:1};
  s.economy!.equipment.T03=12;
  s=act(s,'process:shaft').state;
  assert.ok(s.economy!.expeditions!.generationProofs?.includes('mechanical'));
  assert.ok(getAvailableActions(s,v16).find(a=>a.id==='economy:expeditionstart:parts')!.enabled);
  s=act(s,'expeditionstart:parts').state;s=structuredClone(s);
  assert.ok(s.economy!.expeditions!.attempts.parts.evidence.includes('mechanical'));
  s.economy!.goods.shaft=1;s.household.food=6;s.ap=3;
  s=act(s,'expeditionship:current').state;
  assert.equal(s.economy!.goods.shaft,0);
  assert.equal(s.economy!.expeditions!.attempts.parts.shipments[0].goods.shaft,1);
  assert.equal(s.economy!.expeditions!.attempts.parts.shipments[0].goods.seal,undefined);
});

test('传动工场首次奖励一次发放，水利不再索取轴和绳',()=>{
  let s=fresh();
  s.household.food=8;s.clock.absoluteTurn=3;
  s.economy!.knowledge['person:1']={agronomy:1,mechanics:3,materials:2,organization:1};
  s.economy!.expeditions!.selected='parts';
  s.economy!.expeditions!.attempts.parts={...newAttempt(),stock:{shaft:2},evidence:['mechanical'],evidenceTurn:3,seasonEvidence:['mechanical']};
  const done=end(s);
  assert.ok(done.events.some(e=>e.type==='expedition'&&e.operation==='reward'&&e.id==='parts'));
  assert.equal(done.state.economy!.expeditions!.supplyLevel,5);
  assert.ok(done.state.economy!.shop!.books.includes('M03'));
  assert.equal(done.state.economy!.goods.fiber,4);
  assert.equal(done.state.economy!.goods.rope,1);
  const water=LINEAGE_EXPEDITIONS.find(f=>f.id==='waterworks')!;
  assert.deepEqual(water.kit,{seal:2});
  assert.equal(water.requires.organization,1);
  const again=end(done.state);
  assert.equal(again.events.filter(e=>e.type==='expedition'&&e.operation==='reward').length,0);
});
