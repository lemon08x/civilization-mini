import test from 'node:test';
import assert from 'node:assert/strict';

import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson} from '../src/game/model/state.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {settleLife,energyCeiling,healthCeiling} from '../src/game/systems/life.js';
import {reservedLabor} from '../src/game/systems/industry.js';
import {ancestorKnows} from '../src/game/systems/ancestry.js';
import {getObservation} from '../src/game/observation.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {rules} from './v27.js';
const fresh=()=>structuredClone(createInitialState(rules,17,'river'));
type State=ReturnType<typeof fresh>;
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
function dry(){const s=fresh();s.location.rain=0;s.location.water=3;s.economy!.industry!.instances.hand={id:'hand',enabled:true,commissioned:true,operator:'self'};return s;}

test('renewal parameters stay bounded',()=>{
 assert.throws(()=>validateRuleset({...rules,renewal:undefined}));
 assert.throws(()=>validateRuleset({...rules,rulesVersion:'0.19.0'}));
 assert.throws(()=>resolveRuleset(rules,{'renewal.inheritedTime':0}));
 assert.equal(resolveRuleset(rules,{'renewal.fedHealth':4}).renewal!.fedHealth,4);
 assert.equal(rules.renewal!.fedHealth,5);
});
test('partial feeding, grace and prolonged hunger have distinct effects',()=>{
 const half=fresh(),full=fresh();
 for(const s of [half,full]){s.household.hardship=1;activePerson(s).vitality!.energy=0;}
 settleLife(half,1,[]);settleLife(full,2,[]);
 assert.equal(activePerson(half).vitality!.health,100);
 assert.ok(activePerson(half).vitality!.energy>activePerson(full).vitality!.energy);
 half.household.hardship=2;full.household.hardship=2;
 settleLife(half,1,[]);settleLife(full,2,[]);
 assert.equal(activePerson(half).vitality!.health,96);assert.equal(activePerson(full).vitality!.health,92);
 full.household.hardship=3;settleLife(full,2,[]);assert.equal(activePerson(full).vitality!.health,77);
 for(let n=0;n<8;n++)settleLife(full,2,[]);
 assert.equal(activePerson(full).vitality!.alive,false);
});
test('refeeding restores health and normal energy even at low health; aging still caps health',()=>{
 const s=fresh(),v=activePerson(s).vitality!;v.health=45;v.energy=0;v.talent='scholar';
 settleLife(s,0,[]);assert.equal(v.health,50);assert.equal(v.energy,3);
 for(let n=0;n<10;n++)settleLife(s,0,[]);assert.equal(v.health,100);
 v.health=1;v.constitution=8;assert.equal(energyCeiling(v),4);
 v.ageSeasons=65*4;v.health=79;settleLife(s,0,[]);assert.equal(v.health,healthCeiling(v,s.life!.rules));
});
test('season settlement supplies the deficit streak and resets it when fed',()=>{
 let s=fresh();s.household.food=0;for(const id of ['wheat','soy','flour'])s.economy!.goods[id]=0;
 s=act(s,'end:season').state;assert.equal(s.household.hardship,1);assert.equal(activePerson(s).vitality!.health,100);
 s=act(s,'end:season').state;assert.equal(activePerson(s).vitality!.health,92);
 s=structuredClone(s);s.household.food=2;s=act(s,'end:season').state;
 assert.equal(s.household.hardship,0);assert.equal(activePerson(s).vitality!.health,97);
});

test('descendant knowledge cannot discount ancestors; deceased ancestor records remain useful',()=>{
 const s=fresh();s.economy!.branches!.learned[s.household.heirId].push('M0');assert.equal(ancestorKnows(s,'M0'),false);
 s.economy!.branches!.learned[s.household.activePersonId].push('L0');activePerson(s).vitality!.alive=false;
 assert.equal(ancestorKnows(s,'L0',s.household.heirId),true);
});
test('dry sowing quotes new reservation and rejects overspending without mutation',()=>{
 const s=dry();s.life!.timeRemaining=5;const before=structuredClone(s);
 assert.deepEqual(reservedLabor(s),{time:0,energy:0});
 const a=offer(s,'farm:wheat');assert.equal(a.enabled,false);assert.match(a.reason,/剩余5.*行动需3.*预留3/);
 assert.throws(()=>act(s,'farm:wheat'));assert.deepEqual(s,before);
 s.life!.timeRemaining=12;const n=act(s,'farm:wheat').state;
 assert.deepEqual(reservedLabor(n),{time:3,energy:2});
 assert.equal(getObservation(n,rules).life!.budget.freeTime,6);
});
test('manual watering can release reservation; pause remains free',()=>{
 const s=dry();s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2,moisture:1,tended:0};s.life!.timeRemaining=3;
 assert.equal(offer(s,'farm:wheat').enabled,true);
 const n=act(s,'farm:wheat');assert.ok(!n.events.some(e=>e.type==='industry'&&e.operation==='worked'&&e.target==='hand'));
 const paused=act(s,'sysrun:hand').state;assert.equal(paused.life!.timeRemaining,3);assert.deepEqual(reservedLabor(paused),{time:0,energy:0});
});

test('observations exclude hidden lifespan and RNG',async()=>{
 let session=await createSession({runId:'renewal-test',ruleset:rules,seed:17,scenarioId:'river'});
 for(const id of ['farm:wheat','branchlearn:M0','end:season'])session=(await submitCommand(session,{commandId:'test-'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:'economy:'+id})).session;
 assert.doesNotMatch(JSON.stringify(observeSession(session)),/lifespanSeasons|randomState|constitution/);
});
