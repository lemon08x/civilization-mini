import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {resolveRuleset} from '../src/game/ruleset.js';
import {branchHas,branchView} from '../src/game/systems/branches.js';
import {organizationLevel} from '../src/game/systems/economy.js';
import {ERA_NODES} from '../src/game/model/branches.js';
import {rules as base} from './v27.js';
const rules=resolveRuleset(base,{'eras.seasons':8,'eras.warning':1});
const fresh=()=>{const s=structuredClone(createInitialState(rules,17,'river'));s.household.food=100;s.household.money=100;return s;};
type State=ReturnType<typeof fresh>;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id);
const know=(s:State,...ids:string[])=>s.economy!.branches!.learned[s.household.activePersonId].push(...ids);

test('agronomy fans out from cultivation; water is not required for fertility or oil crops',()=>{
 const s=fresh();
 assert.equal(offer(s,'branchlearn:A3')!.enabled,true);assert.equal(offer(s,'branchlearn:A4')!.enabled,true);
 assert.equal(offer(s,'branchlearn:A1')!.enabled,true);assert.equal(offer(s,'branchlearn:A2')!.enabled,false);
 know(s,'A3','A4');
 assert.equal(offer(s,'farm:soy')!.enabled,true);assert.equal(offer(s,'farm:flax')!.enabled,true);
 const noFertility=fresh();noFertility.economy!.goods.compost=2;assert.match(offer(noFertility,'fertilize:field')!.reason||'',/土壤肥力/);
 s.economy!.goods.compost=2;assert.equal(offer(s,'fertilize:field')!.enabled,true);
});
test('organization delivery does not require the workshop branch; shaft still does',()=>{
 const s=fresh();s.era!.index=1;know(s,'O0');
 assert.equal(offer(s,'branchlearn:O2')!.enabled,true);assert.equal(offer(s,'branchlearn:O1')!.enabled,true);
 const trade=act(s,'branchlearn:O2').state;assert.equal(branchHas(trade,'O2'),true);assert.equal(branchHas(trade,'O1'),false);
 assert.equal(organizationLevel(trade),2);
 assert.match(offer(trade,'hire:artisan')!.reason||'',/生产工序/);
 assert.match(offer(trade,'sysbuild:shaft')!.reason||'',/生产工序/);
 assert.equal(organizationLevel(s),1);
 const both=fresh();know(both,'O0','O1','O2');assert.equal(organizationLevel(both),3);
});
test('math splits after Q0; era production courses need accounts not applied math',()=>{
 const s=fresh();know(s,'Q0','O0');s.era!.index=1;
 assert.equal(offer(s,'branchlearn:Q1')!.enabled,true);assert.equal(offer(s,'branchlearn:Q2')!.enabled,true);
 assert.equal(offer(s,'branchlearn:O3')!.enabled,false);
 const accounts=act(s,'branchlearn:Q2').state;assert.equal(branchHas(accounts,'Q1'),false);assert.equal(offer(accounts,'branchlearn:O3')!.enabled,true);
 assert.equal(ERA_NODES.find(n=>n.id==='O3')!.parents.includes('Q2'),true);
 assert.equal(ERA_NODES.find(n=>n.id==='O5')!.parents.includes('O2'),true);
});
test('soy remains blocked without A4, wheat stays on A0',()=>{
 const s=fresh();assert.match(offer(s,'farm:soy')!.reason||'',/油料与纤维/);
 assert.equal(offer(s,'farm:wheat')!.enabled,true);
});
test('mesh view exposes independent agronomy and organization options',()=>{
 const s=fresh();const nodes=branchView(s).nodes;
 assert.deepEqual(nodes.find(n=>n.id==='A3')!.missing,[]);
 assert.ok((nodes.find(n=>n.id==='O2')!.missing as string[]).some(x=>/劳动分工|尚未开放/.test(x)));
 s.era!.index=1;know(s,'O0');assert.deepEqual(branchView(s).nodes.find(n=>n.id==='O2')!.missing,[]);
});
test('later-era courses stay locked until the society opens them',()=>{
 const s=fresh();know(s,'A1','Q0','O0','L0');
 assert.equal(offer(s,'branchlearn:A2')!.enabled,true);
 assert.match(offer(s,'branchlearn:L1')!.reason||'',/尚未开放/);
 assert.match(offer(s,'branchlearn:O2')!.reason||'',/尚未开放/);
 s.era!.index=1;assert.equal(offer(s,'branchlearn:L1')!.enabled,true);assert.equal(offer(s,'branchlearn:O2')!.enabled,true);
 assert.equal(offer(s,'branchlearn:O4')!.enabled,false);
 s.era!.index=2;know(s,'Q2','O1','L5','L6');assert.equal(offer(s,'branchlearn:O4')!.enabled,true);
 assert.match(offer(s,'branchlearn:L7')!.reason||'',/尚未开放/);
 s.era!.index=3;assert.equal(offer(s,'branchlearn:L7')!.enabled,true);
});
test('standing wheat cycle harvests and replants at season end without a farm click',()=>{
 let s=fresh();s.economy!.goods.seedWheat=3;
 s=structuredClone(act(s,'farmcycle:wheat').state);
 assert.equal(s.economy!.ongoing!.farm,'wheat');
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:1,duration:2,stress:0,bonus:0,fertility:2};
 const n=act(s,'end:season');
 assert.ok(n.events.some(e=>e.type==='economy-farm'&&e.operation==='harvest'));
 assert.ok(n.events.some(e=>e.type==='economy-farm'&&e.operation==='sow'));
 assert.equal(n.state.economy!.field.crop,'wheat');assert.equal(n.state.economy!.field.growth,0);
 const paused=structuredClone(act(n.state,'farmcycle:off').state);
 paused.economy!.field={...paused.economy!.field,crop:'wheat',growth:1,duration:2};
 const idle=act(paused,'end:season');
 assert.equal(idle.events.filter(e=>e.type==='economy-farm'&&e.operation==='harvest').length,0);
 assert.equal(idle.state.economy!.field.crop,'wheat');assert.equal(idle.state.economy!.field.growth,2);
});
test('standing farm does not invent seeds',()=>{
 const s=fresh();s.economy!.ongoing={farm:'wheat'};s.economy!.goods.seedWheat=0;s.economy!.field.crop=null;
 const n=act(s,'end:season');
 assert.ok(n.events.some(e=>e.type==='economy-farm'&&e.operation==='waiting'));
 assert.equal(n.state.economy!.field.crop,null);
});
