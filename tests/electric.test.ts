import test from 'node:test';
import assert from 'node:assert/strict';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson} from '../src/game/model/state.js';
import {branchNodesFor} from '../src/game/model/branches.js';
import {industryProductsFor} from '../src/game/model/industry.js';
import {electricReady,seasonTime} from '../src/game/model/electric.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {shopCatalog,renewShop} from '../src/game/systems/shop.js';
import {productsFor,processesFor} from '../src/game/systems/economy-catalog.js';
import {branchView} from '../src/game/systems/branches.js';
import {eraView} from '../src/game/systems/eras.js';
import {getObservation} from '../src/game/observation.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {rules as r} from './v27.js';
function fixture(rules=r){
 const s=structuredClone(createInitialState(rules,17,'riverine'));
 s.era!.index=3;s.household.money=200;s.household.food=8;s.location.weather='normal';s.location.water=2;
 s.economy!.branches!.learned[s.household.activePersonId]=branchNodesFor(s).map(n=>n.id);
 activePerson(s).vitality!.pressure=12;renewShop(s,rules,[]);return s;
}
type State=ReturnType<typeof fixture>;
const act=(s:State,id:string,rules=r)=>transition(s,parseActionId('economy:'+id),rules);
const offer=(s:State,id:string,rules=r)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id);
function grid(s:State,loads:string[]=[]){s.economy!.equipment.E01=12;for(const id of loads)s.economy!.equipment[id]=12;s.economy!.modern!.enabled=['E01',...loads];return s;}

test('v27 electrical parameters stay bounded',()=>{
 assert.throws(()=>validateRuleset({...r,electric:undefined}));
 assert.throws(()=>resolveRuleset(r,{'electric.unpoweredPercent':100}));assert.throws(()=>resolveRuleset(r,{'electric.unknown':1}));
 assert.equal(resolveRuleset(r,{'electric.lampTime':3}).electric!.lampTime,3);
 assert.ok(shopCatalog(fixture(),r).some(i=>i.target==='alumina')||productsFor(fixture()).some(p=>p.id==='LAMP'));
});

test('every v27 product, knowledge dependency, physical parent and process is reachable in the catalog',()=>{
 const s=fixture(),catalog=industryProductsFor(s),ids=new Set(catalog.map(p=>p.id)),nodes=new Set(branchNodesFor(s).map(n=>n.id));
 for(const p of catalog){assert.ok(p.knowledge.every(id=>nodes.has(id)),p.id);assert.ok(p.parents.every(id=>ids.has(id)),p.id);assert.ok((p.kind==='device'?productsFor(s):processesFor(s)).some(x=>x.id===p.id),p.id);}
 const branches=branchView(s);assert.ok(branches.products.LAMP);assert.equal(branches.processes.LAMP,undefined);assert.ok(branches.processes.aluminium);assert.equal(branches.products.aluminium,undefined);
 const goods=new Set(shopCatalog(s,r).filter(x=>x.kind==='goods').map(x=>x.target));
 for(const id of ['brick','feedstock','solution','fuel','battery','alumina'])assert.ok(goods.has(id),id);
 for(const id of ['E02','E04','LAMP','TELEGRAPH'])assert.ok(offer(s,'utility:'+id+'-on'));
});

test('paid manual generation, drought, ordered loads and repeated switches conserve energy and time',()=>{
 let s=grid(fixture(),['LAMP','TELEGRAPH']);s.location.weather='dry';
 const n=act(s,'energize:now');s=structuredClone(n.state);
 assert.equal(s.economy!.modern!.power,1);assert.equal(s.location.water,1);assert.equal(s.economy!.equipment.E01,11);
 assert.equal(seasonTime(s),14);assert.equal(s.life!.timeRemaining,12);assert.equal(electricReady(s),true);
 s=structuredClone(act(s,'utility:LAMP-off').state);s=structuredClone(act(s,'utility:LAMP-on').state);
 s=structuredClone(act(s,'energize:now').state);
 assert.equal(s.life!.timeRemaining,10);assert.equal(s.economy!.modern!.power,1);assert.equal(s.economy!.equipment.LAMP,11);
 const next=act(s,'end:season').state;assert.equal(seasonTime(next),12);assert.equal(next.economy!.modern!.power,0);assert.equal(electricReady(next),false);
 const limited=grid(fixture(),['LAMP','TELEGRAPH']);limited.location.weather='dry';limited.electric!.rules.servicePower=2;
 const outage=act(limited,'energize:now').state;assert.equal(outage.economy!.modern!.power,1);assert.equal(outage.economy!.modern!.services.LAMP,outage.clock.absoluteTurn);assert.equal(outage.economy!.modern!.services.TELEGRAPH,undefined);
 const dark=grid(fixture(),['LAMP','TELEGRAPH']);dark.location.water=0;
 const failure=act(dark,'energize:now');assert.equal(failure.state.economy!.modern!.power,0);assert.equal(seasonTime(failure.state),12);
 assert.ok(failure.events.some(e=>e.type==='operations'&&e.detail.includes('停电')));
});

test('fuel and storage have working utility gates, consume fuel and retain only unused electricity',()=>{
 const s=fixture();s.economy!.equipment={E02:12,E04:12};s.economy!.goods.fuel=1;
 let next=act(s,'utility:E02-on').state;next=act(next,'utility:E04-on').state;next=act(next,'energize:now').state;
 assert.equal(next.economy!.goods.fuel,0);assert.equal(next.economy!.modern!.power,6);
 next=act(next,'end:season').state;assert.equal(next.economy!.modern!.power,0);assert.equal(next.economy!.modern!.stored,6);
 next=act(next,'energize:now').state;assert.equal(next.economy!.modern!.power,6);assert.equal(next.economy!.modern!.stored,0);
 next=act(next,'energize:now').state;assert.equal(next.economy!.modern!.power,6);
});

test('new device prototypes validate, aluminium consumes real power and replaces copper in wire',()=>{
 let s=fixture();s.economy!.industry!.products.wire={source:'inspection',protocol:false};s.economy!.goods={wire:2,ceramics:1};
 s=structuredClone(act(s,'build:LAMP').state);assert.equal(s.economy!.equipment.LAMP,12);assert.equal(s.economy!.goods.wire,0);assert.ok(s.economy!.industry!.products.LAMP.protocol);
 s=fixture();s.economy!.equipment.ELECTROLYZER=12;s.economy!.industry!.products.ELECTROLYZER={source:'inspection',protocol:false};s.economy!.goods={alumina:2,polymer:1};
 assert.match(offer(s,'process:aluminium')!.reason,/电力不足/);
 s.economy!.modern!.power=3;s=structuredClone(act(s,'process:aluminium').state);
 assert.equal(s.economy!.modern!.power,0);assert.equal(s.economy!.goods.alumina,0);assert.equal(s.economy!.goods.aluminium,2);assert.equal(s.economy!.equipment.ELECTROLYZER,11);assert.ok(electricReady(s));
 s=structuredClone(act(s,'process:aluminiumwire').state);assert.equal(s.economy!.goods.wire,2);assert.equal(s.economy!.goods.aluminium,1);assert.equal(s.economy!.goods.copper,undefined);
});

test('telegraph delivers newly purchased imports immediately while preserving stock, money and transport limits',()=>{
 for(const enabled of [false,true]){
  let s=fixture();if(enabled)s=structuredClone(act(grid(s,['TELEGRAPH']),'energize:now').state);
  const item=shopCatalog(s,r).find(x=>x.target==='polymer')!;assert.equal(item.local,false);
  s=structuredClone(act(s,'cartadd:'+item.id).state);const money=s.household.money,transport=s.economy!.shop!.transport,stock=s.economy!.shop!.stock[item.id];
  s=structuredClone(act(s,'checkout:cart').state);
  assert.equal(s.household.money,money-item.price);assert.equal(s.economy!.shop!.transport,transport-item.weight);assert.equal(s.economy!.shop!.stock[item.id],stock-1);
  assert.equal(s.economy!.shop!.orders.length,enabled?0:1);assert.equal(s.economy!.goods.polymer??0,enabled?1:0);
 }
});

test('modern settlement preview matches paid reward and ownership alone does not avoid the discount',()=>{
 for(const enabled of [false,true]){
  let s=grid(fixture(),['LAMP']);s.era!.rewardEscrow=12000;s.economy!.goods={};
  if(enabled)s=structuredClone(act(s,'energize:now').state);
  const preview=eraView(s,r);assert.equal(preview.expectedReward,enabled?100:85);
  const n=act(s,'erasettle:stage'),settled=n.events.find(e=>e.type==='era'&&e.operation==='settled');
  assert.ok(settled&&settled.type==='era');assert.equal(settled.money,preview.expectedReward);
 }
});

test('dungeon requires real power, delivery removes an unused appliance, and completed tasks cannot be replayed',()=>{
 let s=fixture();s.era!.dungeon={started:true,tasks:[],powered:false};s.economy!.equipment.LAMP=12;
 s=structuredClone(act(s,'dungeonwork:appliance').state);assert.equal(s.economy!.equipment.LAMP,undefined);assert.ok(s.era!.dungeon.tasks.includes('appliance'));assert.ok(!s.era!.dungeon.tasks.includes('power'));
 assert.equal(offer(s,'dungeonwork:appliance')!.enabled,false);
 s.economy!.modern!.power=4;s=structuredClone(act(s,'dungeonwork:power').state);
 assert.equal(s.economy!.modern!.power,0);assert.ok(s.era!.dungeon.tasks.includes('power'));assert.equal(s.era!.dungeon.powered,true);assert.equal(offer(s,'dungeonwork:power')!.enabled,false);
});

test('observation hides run internals and keeps electric flavour text',async()=>{
 let session=await createSession({runId:'electric-observe',ruleset:r,seed:17,frameworkId:'riverine'});
 for(const id of ['economy:branchlearn:L0','economy:end:season','economy:erasettle:stage'])session=(await submitCommand(session,{commandId:String(session.record.entries.length),expectedRevision:session.record.entries.length,actionId:id})).session;
 const o=observeSession(session);
 assert.doesNotMatch(JSON.stringify(o),/randomState|lifespanSeasons|futureWeather/);
 assert.ok(o.game.economy!.branchView!.nodes.find(n=>n.id==='L6')!.epigraph);
 const s=fixture(),before=structuredClone(s);getObservation(s,r);assert.deepEqual(s,before);
});
