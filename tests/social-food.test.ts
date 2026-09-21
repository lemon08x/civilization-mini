import test from 'node:test';
import assert from 'node:assert/strict';

import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {foodStock} from '../src/game/systems/economy.js';
import {socialFoodQuote,settleSocialFood} from '../src/game/systems/social-food.js';
import {personalBudget,systemLabor} from '../src/game/systems/industry.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import type {GameEvent} from '../src/game/model/events.js';
import {rules} from './v27.js';
const fresh=()=>structuredClone(createInitialState(rules,17,'riverine'));
type State=ReturnType<typeof fresh>;
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
function empty(){const s=fresh();s.household.food=0;for(const id of ['flour','wheat','soy'])s.economy!.goods[id]=0;s.production!.market.food=8;return s;}

test('social food parameters stay bounded on the current ruleset',()=>{
 assert.throws(()=>validateRuleset({...rules,socialFood:undefined}));
 assert.equal(resolveRuleset(rules,{'socialFood.imports':0}).socialFood!.imports,0);assert.equal(rules.socialFood!.imports,4);
 assert.throws(()=>resolveRuleset(rules,{'socialFood.storage':0}));
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

test('income previews newly affordable shopping and prevents spending its reserved time',()=>{
 const s=empty();s.household.money=0;s.socialFood!.policy='market';s.life!.timeRemaining=4;
 assert.equal(personalBudget(s).reservedTime,0);assert.equal(offer(s,'work:local').enabled,false);assert.match(offer(s,'work:local').reason,/预留1/);
 const before=structuredClone(s);assert.throws(()=>act(s,'work:local'));assert.deepEqual(s,before);
 s.life!.timeRemaining=5;const n=act(s,'work:local').state;assert.equal(personalBudget(n).reservedTime,1);
});

test('old food contract uses only the new service and cannot secretly reserve or purchase twice',()=>{
 let s=empty();s.economy!.branches!.learned[s.household.activePersonId].push('O0');
 s=act(s,'foodpolicy:market').state;s=act(s,'foodplan:on').state;
 assert.equal(s.socialFood!.delivery,true);assert.equal(s.economy!.operations!.foodReserved,0);assert.equal(s.production!.market.food,8);
 const result=act(s,'end:season');assert.equal(result.events.filter(e=>e.type==='food-purchased').length,1);
 assert.equal(result.state.household.money,6);
});

test('policy survives handover; suspension releases pickup and never grants food',()=>{
 let s=empty();s.socialFood!.policy='reserve';s.socialFood!.budget=8;s.socialFood!.delivery=true;
 heir(s).vitality!.ageSeasons=72;s.status='handover';s=act(s,'handover').state;
 assert.equal(s.socialFood!.policy,'reserve');assert.equal(s.socialFood!.budget,8);assert.equal(s.socialFood!.delivery,true);
 s=act(s,'foodpolicy:off').state;assert.equal(personalBudget(s).reservedTime,0);assert.equal(foodStock(s),0);
});
test('session observations exclude hidden state',async()=>{
 let session=await createSession({runId:'social-food-test',ruleset:rules,seed:17,frameworkId:'riverine'});
 for(const id of ['foodpolicy:market','foodbudget:8','end:season'])session=(await submitCommand(session,{commandId:'test-'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:'economy:'+id})).session;
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
