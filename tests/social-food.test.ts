import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {foodStock} from '../src/game/systems/economy.js';
import {socialFoodQuote,settleSocialFood} from '../src/game/systems/social-food.js';
import {personalBudget,systemLabor} from '../src/game/systems/industry.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import type {GameEvent} from '../src/game/model/events.js';
const rules=validateRuleset(JSON.parse(await readFile('rulesets/social-food.v21.json','utf8')));
const old=validateRuleset(JSON.parse(await readFile('rulesets/recovery-inheritance.v20.json','utf8')));
const fresh=()=>structuredClone(createInitialState(rules,17,'river'));
type State=ReturnType<typeof fresh>;
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
function empty(){const s=fresh();s.household.food=0;for(const id of ['flour','wheat','soy'])s.economy!.goods[id]=0;s.production!.market.food=8;return s;}

test('v21 rules isolated, candidates separate, v20 no social state or actions',()=>{
 assert.throws(()=>validateRuleset({...rules,socialFood:undefined}));assert.throws(()=>validateRuleset({...old,socialFood:rules.socialFood}));
 assert.equal(resolveRuleset(rules,{'socialFood.imports':0}).socialFood!.imports,0);assert.equal(rules.socialFood!.imports,4);
 assert.throws(()=>resolveRuleset(rules,{'socialFood.storage':0}));
 const s=createInitialState(old,17,'river');assert.equal(s.socialFood,undefined);assert.ok(!getAvailableActions(s,old).some(a=>a.id.includes('foodpolicy')));
});
test('zero pantry can live on paid social food for successive seasons without accumulating food',()=>{
 let s=empty();s.socialFood!.policy='market';s.socialFood!.delivery=true;
 for(let i=0;i<3;i++){
  const money=s.household.money;const result=act(s,'end:season');s=structuredClone(result.state);
  assert.equal(foodStock(s),0);assert.equal(s.household.money,money-2);assert.equal(s.household.hardship,0);
  assert.equal(result.events.filter(e=>e.type==='food-purchased').length,1);
  assert.ok(result.events.some(e=>e.type==='season-settled'&&e.missing===0));
 }
 assert.equal(activePerson(s).vitality!.health,100);
});
test('self mode eats existing grain; market mode buys ready food; failed market falls back to grain',()=>{
 const self=empty(),market=empty(),broke=empty();
 for(const s of [self,market,broke]){s.economy!.goods.wheat=2;s.socialFood!.policy='market';}
 self.socialFood!.policy='self';broke.household.money=0;
 assert.equal(socialFoodQuote(self).purchase,0);assert.equal(socialFoodQuote(market).purchase,2);
 for(const s of [self,market,broke])settleSocialFood(s,[]);
 assert.equal(self.economy!.goods.wheat,0);assert.equal(market.economy!.goods.wheat,2);assert.equal(broke.economy!.goods.wheat,0);
 assert.equal(broke.household.food,2);assert.equal(market.household.money,6);
});
test('reserve target is post-meal stock and does not overbuy each season',()=>{
 let s=empty();s.household.money=20;s.socialFood!.policy='reserve';s.socialFood!.budget=12;
 s=structuredClone(act(s,'end:season').state);assert.equal(foodStock(s),4);assert.equal(s.household.money,14);
 s=structuredClone(act(s,'end:season').state);assert.equal(foodStock(s),4);assert.equal(s.household.money,12);
});
test('funds, budget, stock, personnel and shared transport each limit partial purchase with distinct reasons',()=>{
 for(const constraint of ['funds','budget','stock','service','transport']){
  const s=empty();s.socialFood!.policy='market';
  if(constraint==='funds')s.household.money=1;
  if(constraint==='budget')s.socialFood!.budget=1;
  if(constraint==='stock')s.production!.market.food=1;
  if(constraint==='service')s.socialFood!.serviceRemaining=1;
  if(constraint==='transport')s.economy!.shop!.transport=1;
  const q=socialFoodQuote(s);assert.equal(q.purchase,1);assert.equal(q.missing,1);assert.equal(q.reasons.length,1);
  const events:GameEvent[]=[];settleSocialFood(s,events);assert.equal(s.household.food,1);assert.equal(events.filter(e=>e.type==='food-purchased').length,1);
 }
});
test('pickup is reserved and charged once; delivery uses external service with no personal time',()=>{
 for(const delivery of [false,true]){
  const s=empty();s.socialFood!.policy='market';s.socialFood!.delivery=delivery;
  assert.equal(personalBudget(s).reservedTime,delivery?0:1);
  const before=s.life!.timeRemaining,transport=s.economy!.shop!.transport;settleSocialFood(s,[]);
  assert.equal(before-s.life!.timeRemaining,delivery?0:1);assert.equal(transport-s.economy!.shop!.transport,2);
  assert.equal(s.socialFood!.serviceRemaining,4);
 }
});
test('income previews newly affordable shopping and prevents spending its reserved time',()=>{
 const s=empty();s.household.money=0;s.socialFood!.policy='market';s.life!.timeRemaining=4;
 assert.equal(personalBudget(s).reservedTime,0);assert.equal(offer(s,'work:local').enabled,false);assert.match(offer(s,'work:local').reason,/预留1/);
 const before=structuredClone(s);assert.throws(()=>act(s,'work:local'));assert.deepEqual(s,before);
 s.life!.timeRemaining=5;const n=act(s,'work:local').state;assert.equal(personalBudget(n).reservedTime,1);
});
test('manual shopping and scheduled food share inventory, transport, and never double-buy',()=>{
 let s=empty();s.socialFood!.policy='self';
 s=act(s,'cartadd:good-food').state;s=act(s,'cartadd:good-food').state;s=act(s,'checkout:cart').state;
 assert.equal(s.household.food,2);assert.equal(socialFoodQuote(s).purchase,0);assert.equal(s.production!.market.food,6);assert.equal(s.socialFood!.serviceRemaining,4);
 const money=s.household.money,events:GameEvent[]=[];const draft=structuredClone(s);settleSocialFood(draft,events);
 assert.equal(draft.household.money,money);assert.equal(events.filter(e=>e.type==='food-purchased').length,0);
});
test('old food contract uses only the new service and cannot secretly reserve or purchase twice',()=>{
 let s=empty();s.economy!.branches!.learned[s.household.activePersonId].push('O0');
 s=act(s,'foodpolicy:market').state;s=act(s,'foodplan:on').state;
 assert.equal(s.socialFood!.delivery,true);assert.equal(s.economy!.operations!.foodReserved,0);assert.equal(s.production!.market.food,8);
 const result=act(s,'end:season');assert.equal(result.events.filter(e=>e.type==='food-purchased').length,1);
 assert.equal(result.state.household.money,6);
});
test('supply carries over and arrivals respect storage; no resetting exhausted market stock',()=>{
 const s=fresh();s.production!.market.food=10;
 const result=act(s,'end:season');assert.equal(result.state.production!.market.food,12);
 assert.ok(result.events.some(e=>e.type==='social-food'&&e.operation==='arrived'&&e.amount===2));
 const zero=resolveRuleset(rules,{'socialFood.imports':0});const exhausted=structuredClone(createInitialState(zero,17,'river'));exhausted.production!.market.food=0;
 const n=transition(exhausted,parseActionId('economy:end:season'),zero).state;assert.equal(n.production!.market.food,0);
});
test('policy survives handover; suspension releases pickup and never grants food',()=>{
 let s=empty();s.socialFood!.policy='reserve';s.socialFood!.budget=8;s.socialFood!.delivery=true;
 heir(s).vitality!.ageSeasons=72;s.status='handover';s=act(s,'handover').state;
 assert.equal(s.socialFood!.policy,'reserve');assert.equal(s.socialFood!.budget,8);assert.equal(s.socialFood!.delivery,true);
 s=act(s,'foodpolicy:off').state;assert.equal(personalBudget(s).reservedTime,0);assert.equal(foodStock(s),0);
});
test('new session observations and commands replay strictly without hidden state',async()=>{
 const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
 let session=await createSession({runId:'social-food-test',ruleset:rules,implementation,seed:17,scenarioId:'river'});
 for(const id of ['foodpolicy:market','foodbudget:8','end:season','end:season','end:season','end:season'])session=(await submitCommand(session,{commandId:'test-'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:'economy:'+id})).session;
 assert.deepEqual(observeSession(await replayRecord(session.record,implementation)),observeSession(session));
 assert.doesNotMatch(JSON.stringify(observeSession(session)),/randomState|lifespanSeasons|constitution/);
});

test('food forecast accounts for personal production commitments, settlement does not reserve them twice',()=>{
 const s=empty();s.socialFood!.policy='market';s.location.rain=0;
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2,moisture:0};
 s.economy!.industry!.instances.hand={id:'hand',operator:'self',enabled:true,commissioned:true};
 s.life!.timeRemaining=3;
 const production=systemLabor(s).time;
 assert.equal(socialFoodQuote(s,false,production).purchase,0);assert.match(socialFoodQuote(s,false,production).reasons.join(''),/赶集时间不足/);
 // Post-production quote uses remaining time directly, even for a continuous processing task.
 s.economy!.industry!.instances.shaft={id:'shaft',operator:'self',enabled:true,commissioned:true};
 s.life!.timeRemaining=1;assert.equal(socialFoodQuote(s,true).purchase,2);
});

test('food service capacity cannot be bypassed by manual checkout or sale-with-food',()=>{
 const s=empty();s.socialFood!.serviceRemaining=0;s.economy!.goods.wood=2;
 assert.equal(offer(s,'cartadd:good-food').enabled,false);assert.equal(offer(s,'sellfood:wood').enabled,false);
 assert.match(offer(s,'sellfood:wood').reason,/服务人员额度/);
});
