import test from 'node:test';
import assert from 'node:assert/strict';

import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {getObservation} from '../src/game/observation.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {branchHas,branchView} from '../src/game/systems/branches.js';
import {ancestorKnows} from '../src/game/systems/ancestry.js';
import {recordEraProduction,renewEraServices,projectEraRemainder} from '../src/game/systems/eras.js';
import {personalBudget,systemDefinitions,settleIndustry} from '../src/game/systems/industry.js';
import {socialFoodQuote} from '../src/game/systems/social-food.js';
import {shopCatalog,renewShop} from '../src/game/systems/shop.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import type {GameEvent} from '../src/game/model/events.js';
import {rules as base} from './v27.js';
const rules=resolveRuleset(base,{'eras.generationLimit':1});
const fresh=()=>{const s=structuredClone(createInitialState(rules,17,'riverine'));s.household.food=100;s.household.money=100;s.era!.card='trade';renewEraServices(s,rules);return s;};
type State=ReturnType<typeof fresh>;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id);
const know=(s:State,...ids:string[])=>s.economy!.branches!.learned[s.household.activePersonId].push(...ids);

test('stage generation limit can be overridden on the current ruleset',()=>{
 assert.throws(()=>validateRuleset({...base,eras:undefined}));assert.throws(()=>resolveRuleset(base,{'eras.generationLimit':0}));
 assert.equal(base.eras!.generationLimit,5);assert.equal(rules.eras!.generationLimit,1);
});
test('stage changes when the generation limit is reached if the player has not settled, card draw only then',()=>{
 let s=fresh();const original=s.era!.card;const events:GameEvent[]=[];
 const first=act(s,'end:season');s=structuredClone(first.state);events.push(...first.events);
 assert.equal(s.era!.card,original);assert.equal(s.era!.index,0);
 assert.equal(events.filter(e=>e.type==='era'&&e.operation==='settled').length,0);
 s.era!.startGeneration=s.clock.generation-rules.eras!.generationLimit;
 const next=act(s,'end:season');assert.equal(next.state.era!.index,1);assert.equal(next.state.era!.elapsed,0);
 assert.equal(next.events.filter(e=>e.type==='era'&&e.operation==='settled').length,1);assert.equal(next.events.filter(e=>e.type==='era'&&e.operation==='revealed').length,1);
 assert.equal(next.events.filter(e=>e.type==='era'&&e.operation==='projected').length,0);
});
test('retirement and handover do not advance social time; finishing the season still does',()=>{
 let s=fresh();heir(s).vitality!.ageSeasons=72;
 s=structuredClone(act(s,'retire:family').state);assert.equal(s.era!.elapsed,0);
 s=structuredClone(act(s,'end:season').state);assert.equal(s.status,'handover');assert.equal(s.era!.elapsed,1);
 const card=s.era!.card;s=structuredClone(act(s,'handover').state);assert.equal(s.era!.elapsed,1);assert.equal(s.era!.card,card);assert.equal(s.clock.generation,2);
});
test('actual harvest ending a season earns once, and reward settles before phase changes',()=>{
 const s=fresh();s.era!.startGeneration=s.clock.generation-rules.eras!.generationLimit;s.life!.timeRemaining=3;
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:2,duration:2,stress:0};
 const n=act(s,'farm:wheat');const harvest=n.events.find(e=>e.type==='economy-farm'&&e.operation==='harvest')!;
 assert.equal(harvest.type,'economy-farm');if(harvest.type!=='economy-farm')return;
 const earned=n.events.filter(e=>e.type==='era'&&e.operation==='earned');assert.equal(earned.length,1);
 assert.equal(n.state.household.money,s.household.money+Math.floor(harvest.amount*3/12));assert.equal(n.state.era!.rewardEscrow,0);assert.equal(n.state.era!.index,1);
});
test('seasonal staffed production earns from one completed batch, not goods and process twice',()=>{
 const s=fresh();s.economy!.goods.wood=2;s.economy!.goods.iron=1;s.economy!.equipment.T03=12;
 s.economy!.industry!.products.shaft={source:'prototype',protocol:true};s.economy!.industry!.instances.shaft={id:'shaft',enabled:true,commissioned:true,operator:'self'};
 activePerson(s).vitality!.pressure=10;
 const n=act(s,'end:season');assert.equal(n.state.economy!.goods.shaft,2);assert.equal(n.state.era!.rewardEscrow,20);
 assert.equal(n.events.filter(e=>e.type==='era'&&e.operation==='earned').length,1);
});
test('purchases, resale, construction and passive waiting do not mint production claims',()=>{
 let s=fresh();s=structuredClone(act(s,'cartadd:good-food').state);s=structuredClone(act(s,'checkout:cart').state);s=structuredClone(act(s,'sell:wood').state);
 s=structuredClone(act(s,'end:season').state);assert.equal(s.era!.rewardEscrow,0);
});
test('earlier functioning production gets more reward opportunities in the same fixed window',()=>{
 const early=fresh(),late=fresh();const completion:GameEvent={type:'economy-process',recipe:'shaft',actor:'系统：self',stage:'complete',factor:1};
 for(let season=0;season<4;season++){recordEraProduction(early,[],[completion]);if(season>=2)recordEraProduction(late,[],[completion]);}
 assert.equal(early.era!.rewardEscrow,80);assert.equal(late.era!.rewardEscrow,40);
});
test('generic math remains effective and discounted; era courses stay usable after the society changes',()=>{
 const s=fresh();know(s,'Q0','Q1','A1','A2');assert.equal(branchHas(s,'A2'),true);
 s.era!.index=1;assert.equal(branchHas(s,'A2'),true);assert.ok(s.economy!.branches!.learned[s.household.activePersonId].includes('A2'));
 assert.equal(ancestorKnows(s,'A2',s.household.heirId),true);assert.equal(ancestorKnows(s,'Q0',s.household.heirId),true);
 assert.equal(branchView(s).nodes.find(n=>n.id==='A2')!.active,true);assert.equal(offer(s,'branchlearn:A2')!.enabled,false);
 assert.equal(branchHas(s,'Q1'),true);assert.equal(offer(s,'inspect:W01')!.time,3);
});
test('organization specializations add one production bonus and do not stack',()=>{
 const s=fresh();know(s,'O3');const produced:GameEvent={type:'economy-process',recipe:'shaft',actor:'本人',stage:'complete',factor:1};
 s.era!.index=1;recordEraProduction(s,[],[produced]);assert.equal(s.era!.rewardEscrow,50);
 s.era!.index=2;s.era!.rewardEscrow=0;recordEraProduction(s,[],[produced]);assert.equal(s.era!.rewardEscrow,75);
 know(s,'O4');s.era!.rewardEscrow=0;recordEraProduction(s,[],[produced]);assert.equal(s.era!.rewardEscrow,75);
});
test('well costs real materials, survives stage change, uses finite groundwater instead of public water',()=>{
 let s=fresh();know(s,'A1','A2');s.economy!.goods.wood=4;s.economy!.goods.clay=2;activePerson(s).vitality!.pressure=10;
 s=structuredClone(act(s,'sysbuild:well').state);assert.equal(s.economy!.goods.wood,0);assert.equal(s.life!.timeRemaining,6);
 s=structuredClone(act(s,'syscommission:well').state);assert.equal(s.era!.groundwater,0);
 s=structuredClone(act(s,'end:season').state);s.era!.index=1;s.location.rain=0;s.location.water=0;s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2};
 s=structuredClone(act(s,'sysassign:well-self').state);const events:GameEvent[]=[];settleIndustry(s,events);
 assert.equal(s.era!.groundwater,0);assert.equal(s.location.water,0);assert.equal(s.economy!.field.moisture,2);assert.ok(events.some(e=>e.type==='industry'&&e.operation==='worked'));
 assert.ok(systemDefinitions(s).some(d=>d.id==='well'));
});
test('modern services replace personal hauling, but lack of cash leaves the well as fallback',()=>{
 const s=fresh();s.era!.index=3;s.era!.tap=true;s.socialFood!.delivery=false;s.socialFood!.policy='market';s.household.food=0;s.location.rain=0;
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2};s.economy!.industry!.instances.well={id:'well',enabled:true,commissioned:true,operator:'self'};
 renewEraServices(s,rules);assert.equal(socialFoodQuote(s).time,0);assert.equal(personalBudget(s).reservedTime,0);
 const n=act(s,'end:season');assert.ok(n.events.some(e=>e.type==='era'&&e.operation==='water-service'));assert.ok(!n.events.some(e=>e.type==='industry'&&e.operation==='worked'&&e.target==='well'));
 s.household.money=0;assert.equal(personalBudget(s).reservedTime,2);const fallback=act(s,'end:season');assert.ok(fallback.events.some(e=>e.type==='industry'&&e.operation==='worked'&&e.target==='well'));
});
test('society card affects actual prices, income, education and metal supply',()=>{
 const s=fresh();assert.equal(socialFoodQuote(s).price,2);assert.equal(shopCatalog(s,rules).find(x=>x.id==='good-food')!.price,2);
 assert.match(offer(s,'work:local')!.description,/赚5钱/);s.era!.card='education';const time=offer(s,'branchlearn:Q0')!.time!;s.era!.card='trade';assert.equal(offer(s,'branchlearn:Q0')!.time,time+1);
 s.era!.card='industry';renewShop(s,rules,[]);assert.equal(shopCatalog(s,rules).find(x=>x.id==='good-iron')!.stock,4);
 s.era!.index=2;renewShop(s,rules,[]);assert.ok(shopCatalog(s,rules).some(x=>x.id==='good-copper'));
});

test('short social sequence observations hide RNG',async()=>{
 const short=resolveRuleset(base,{'eras.generationLimit':1});let session=await createSession({runId:'eras-observe',ruleset:short,seed:17,frameworkId:'riverine'});
 for(let i=0;i<4;i++)session=(await submitCommand(session,{commandId:'settle-'+i,expectedRevision:i,actionId:'economy:erasettle:stage'})).session;
 const o=observeSession(session);assert.equal(o.eraSettlements!.length,4);assert.equal(o.game.status,'complete');
 assert.doesNotMatch(JSON.stringify(o),/randomState|lifespanSeasons|futureCards/);
});
function staffWell(s:State,operator:'self'|null='self'){
 s.economy!.industry!.instances.well={id:'well',commissioned:true,enabled:!!operator,operator};
 s.economy!.goods.seedWheat=Math.max(s.economy!.goods.seedWheat??0,1);
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2,stress:0,bonus:0,fertility:2};
}
test('a well does not end the era; the player settles when they choose',()=>{
 const s=fresh();staffWell(s);
 const kept=act(s,'end:season');assert.equal(kept.state.era!.index,0);
 const rng=s.randomState,n=act(s,'erasettle:stage');
 assert.equal(n.state.era!.index,1);assert.equal(n.state.era!.elapsed,0);
 assert.ok(n.events.some(e=>e.type==='era'&&e.operation==='projected'));
 assert.ok(n.events.some(e=>e.type==='era'&&e.operation==='settled'&&e.detail.includes('主动结算')));
 assert.equal(s.randomState,rng);
});
test('faster construction projects more remaining harvest than a later finish',()=>{
 const s=fresh();staffWell(s);const before=structuredClone(s);
 const early=projectEraRemainder(s,rules,6),late=projectEraRemainder(s,rules,2);
 assert.ok(early.harvestUnits>late.harvestUnits);assert.ok(early.claims>late.claims);assert.equal(early.waterSecured,true);
 assert.deepEqual(s.era,before.era);assert.equal(s.randomState,before.randomState);assert.equal(s.household.money,before.household.money);
});
test('paused well does not count as water; town public well does, agriculture tap does not',()=>{
 const s=fresh();staffWell(s);s.era!.tap=true;s.economy!.industry!.instances.well!.enabled=false;
 const paused=projectEraRemainder(s,rules,6);
 s.economy!.industry!.instances.well!.enabled=true;
 const staffed=projectEraRemainder(s,rules,6);
 assert.equal(paused.waterSecured,false);assert.equal(staffed.waterSecured,true);
 assert.ok(staffed.harvestUnits>paused.harvestUnits);
 const town=fresh();town.era!.index=1;assert.equal(projectEraRemainder(town,rules,6).waterSecured,true);
 const noWell=fresh();noWell.era!.tap=true;assert.equal(projectEraRemainder(noWell,rules,6).waterSecured,false);
});
test('shaft staffing projects craft units; later tap water does not claw back a settled well stage',()=>{
 let s=fresh();staffWell(s);
 s.economy!.industry!.instances.shaft={id:'shaft',commissioned:true,enabled:true,operator:'self'};
 const withShaft=projectEraRemainder(s,rules,4);assert.equal(withShaft.shaftBatches,4);assert.equal(withShaft.craftUnits,8);
 const first=act(s,'erasettle:stage');const wellSettle=first.events.find(e=>e.type==='era'&&e.operation==='settled');
 assert.equal(wellSettle?.type,'era');if(wellSettle?.type!=='era')return;
 assert.equal(wellSettle.stage,0);assert.ok(wellSettle.money>0);
 s=structuredClone(first.state);s.era!.index=3;s.era!.tap=true;s.era!.rewardEscrow=0;s.era!.dungeon={started:false,tasks:[]};
 const last=act(s,'erasettle:stage');const modernSettle=last.events.find(e=>e.type==='era'&&e.operation==='settled');
 assert.equal(modernSettle?.type,'era');if(modernSettle?.type!=='era')return;
 assert.equal(modernSettle.stage,3);assert.ok(modernSettle.money>=0);
});
test('deadline without a player settle adds no projected remainder',()=>{
 const s=fresh();s.era!.startGeneration=s.clock.generation-rules.eras!.generationLimit;s.economy!.goods.seedWheat=4;
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2,stress:0};
 const n=act(s,'end:season');
 assert.equal(n.events.filter(e=>e.type==='era'&&e.operation==='projected').length,0);
 assert.equal(n.state.era!.index,1);
});
test('observation allows settling anytime and previews remainder without future weather',()=>{
 const s=fresh();const o=getObservation(s,rules);
 assert.equal(o.era!.canSettle,true);assert.ok((o.era!.services as string[]).some(x=>/公地|帮工/.test(x)));
 assert.ok((o.era!.lockedKnowledge as {id:string}[]).some(n=>n.id==='L1'));
 assert.ok(!(o.era!.lockedKnowledge as {id:string}[]).some(n=>n.id==='A0'));
 assert.ok((o.era!.projection.claims as number)>=0);assert.equal(o.era!.projection.appliesOnSettle,true);
 assert.doesNotMatch(JSON.stringify(o),/randomState|lifespanSeasons|futureCards/);
});
test('agriculture commons gather and work without tech; later eras drop the bonus',()=>{
 const s=fresh();s.production!.stocks.wildFood=10;
 const gathered=act(s,'gather:food').events.find(e=>e.type==='resource-gathered');
 assert.equal(gathered?.type,'resource-gathered');if(gathered?.type!=='resource-gathered')return;
 assert.equal(gathered.amount,3);
 const town=fresh();town.era!.index=1;town.production!.stocks.wildFood=10;town.era!.card='trade';
 const later=act(town,'gather:food').events.find(e=>e.type==='resource-gathered');
 assert.equal(later?.type,'resource-gathered');if(later?.type!=='resource-gathered')return;
 assert.equal(later.amount,2);
 const pay=act(s,'work:local').events.find(e=>e.type==='income');
 assert.equal(pay?.type,'income');if(pay?.type!=='income')return;
 assert.equal(pay.amount,5);
 town.production!.market.jobs=2;
 const townPay=act(town,'work:local').events.find(e=>e.type==='income');
 assert.equal(townPay?.type,'income');if(townPay?.type!=='income')return;
 assert.equal(townPay.amount,4);
});
test('town public well waters fields without pump tech; public mill opens with the township stage',()=>{
 const s=fresh();s.era!.index=1;s.location.rain=0;s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2};
 const n=act(s,'end:season');assert.ok(n.events.some(e=>e.type==='era'&&e.operation==='water-service'));
 const village=fresh();village.economy!.goods.wheat=4;
 assert.equal(offer(village,'publicmill:grain')!.enabled,false);
 const mill=fresh();mill.era!.index=1;mill.economy!.goods.wheat=4;
 assert.equal(offer(mill,'publicmill:grain')!.enabled,true);
 const ground=act(mill,'publicmill:grain');assert.equal(ground.state.economy!.goods.flour,1);assert.equal(ground.state.economy!.goods.wheat,2);
});
