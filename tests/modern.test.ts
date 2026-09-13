import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {validateRuleset} from '../src/game/ruleset.js';
import {economyView} from '../src/game/systems/economy.js';
import {MODERN_FLOORS} from '../src/game/systems/tower.js';
import {shopCatalog} from '../src/game/systems/shop.js';
import {ALL_GOODS,ALL_PRODUCTS,ALL_PROCESSES,TOPICS,PRODUCTS} from '../src/game/systems/economy-catalog.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {loadCurrentContext} from '../apps/cli/context.js';
import {replayRecord} from '../src/runtime/replay.js';

const r=validateRuleset(JSON.parse(await readFile('experiments/modern-grid.v14.json','utf8')));
const old=validateRuleset(JSON.parse(await readFile('rulesets/megaproject-trial.v13.json','utf8')));
function fixture(){const s=structuredClone(createInitialState(r,17,'canyon'));s.household.food=8;s.household.money=200;s.economy!.operations!.food=true;return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId('economy:'+id),r);
const end=(s:ReturnType<typeof fixture>)=>act(s,'end:season');

test('现代目录按版本隔离、课题配方有真实来源，旧六科仍为36课题21设备',()=>{
 const s=fixture(),e=economyView(s,r);assert.equal(e.disciplines.flatMap(d=>d.topics).length,60);assert.equal(e.disciplines[0].level,6);
 assert.equal(TOPICS.length,36);assert.equal(PRODUCTS.length,21);
 const legacy=createInitialState(old,17,'river');assert.equal(legacy.economy!.modern,undefined);assert.equal(economyView(legacy,old).disciplines.flatMap(d=>d.topics).length,36);
 assert.ok(!getAvailableActions(legacy,old).some(a=>a.id.endsWith(':L07')||a.id.endsWith(':E01')||a.id.endsWith(':circuit')));
 assert.ok(!shopCatalog(legacy,old).some(i=>i.target==='copper'||i.target==='E01'));
 for(const p of ALL_PRODUCTS)for(const id of Object.keys(p.inputs))assert.ok(ALL_GOODS[id],p.id+':'+id);
 for(const p of ALL_PROCESSES){for(const id of [...Object.keys(p.inputs),...Object.keys(p.outputs)])assert.ok(ALL_GOODS[id]);if(p.equipment)assert.ok(ALL_PRODUCTS.some(x=>x.id===p.equipment));}
 assert.throws(()=>validateRuleset({...r,modern:undefined}));
});
test('高阶研究消耗样本、按序学习、满十阶后不生成第十一阶证据',()=>{
 let s=fixture();s.economy!.goods.copper=3;
 assert.throws(()=>act(s,'study:L08'));
 s=act(s,'research:L07').state;assert.equal(s.economy!.goods.copper,2);s=act(s,'study:L07').state;assert.equal(s.economy!.knowledge[s.household.activePersonId].mechanics,7);
 s=structuredClone(s);s.economy!.knowledge[s.household.activePersonId].organization=10;s.economy!.workers.artisan={kind:'artisan',experience:4,active:true,job:'shaft',project:null};
 assert.doesNotThrow(()=>end(s));
});
test('发电真实扣水与耐用，同季重复供能不增电，余电到次季清空',()=>{
 let s=fixture();s.location.water=2;s.economy!.equipment.E01=12;s.economy!.modern!.enabled=['E01'];
 s=act(s,'energize:now').state;assert.equal(s.economy!.modern!.power,6);assert.equal(s.location.water,1);assert.equal(s.economy!.equipment.E01,11);
 s=act(s,'energize:now').state;assert.equal(s.economy!.modern!.power,6);assert.equal(s.economy!.equipment.E01,11);
 const x=end(s);assert.equal(x.state.economy!.modern!.power,0);assert.equal(x.state.economy!.equipment.E01,11);
 assert.ok(x.events.some(e=>e.type==='operations'&&e.target==='expired'&&e.amount===6));
});
test('储能只保存余电、维修时不可充放电，能源启停不刷新已发额度',()=>{
 let s=fixture();s.location.water=2;s.economy!.equipment.E01=12;s.economy!.equipment.E04=12;s.economy!.modern!.enabled=['E01','E04'];
 s=end(s).state;assert.equal(s.economy!.modern!.stored,6);assert.equal(s.economy!.modern!.power,0);assert.equal(s.economy!.equipment.E04,11);
 s=act(s,'utility:E01-off').state;s=act(s,'energize:now').state;assert.equal(s.economy!.modern!.stored,0);assert.equal(s.economy!.modern!.power,6);
 const repair=fixture();repair.economy!.modern!.stored=4;repair.economy!.modern!.enabled=['E04'];repair.economy!.equipment.E04=8;repair.economy!.shop!.orders.push({kind:'repair',target:'E04',name:'储能维修',amount:1,due:99});
 assert.equal(act(repair,'energize:now').state.economy!.modern!.power,0);
});
test('电子工艺不能靠雇员跳过知识和断电门槛，产出实际扣电与材料',()=>{
 let s=fixture();s.economy!.equipment.F09=12;s.economy!.goods={silicon:2,wire:2,polymer:2};s.economy!.workers.artisan={kind:'artisan',experience:4,active:true,job:'circuit',project:null};
 let x=end(s);assert.equal(x.state.economy!.goods.circuit,undefined);
 s.economy!.knowledge[s.household.activePersonId]={mechanics:9,materials:9};s.economy!.modern!.power=2;
 x=end(s);assert.equal(x.state.economy!.goods.circuit,1);assert.equal(x.state.economy!.goods.silicon,1);assert.equal(x.state.economy!.equipment.F09,11);
 assert.ok(x.events.some(e=>e.type==='operations'&&e.target==='制造电子电路'&&e.amount===2));
});
test('装配加速使用双份材料和额外电力，不与经验叠成四倍',()=>{
 const s=fixture();s.economy!.knowledge[s.household.activePersonId].organization=7;s.economy!.equipment.T07=12;s.economy!.modern!.power=1;s.economy!.workers.artisan={kind:'artisan',experience:8,active:true,job:'shaft',project:null};const wood=s.economy!.goods.wood;
 const x=end(s);assert.equal(x.state.economy!.goods.shaft,6);assert.equal(x.state.economy!.goods.wood,wood-4);assert.equal(x.state.economy!.equipment.T07,11);
});
test('温室防胁迫、精准农业本茬有界、配方肥料不能反复叠加',()=>{
 let s=fixture();s.economy!.knowledge[s.household.activePersonId].agronomy=10;s.economy!.goods.nutrient=2;s=act(s,'farm:wheat').state;s=act(s,'nutrient:field').state;
 assert.throws(()=>act(s,'nutrient:field'));s=structuredClone(s);s.economy!.modern!.power=2;s.economy!.modern!.enabled=['U08M','U09M'];s.economy!.equipment.U08M=12;s.economy!.equipment.U09M=12;s.location.rain=0;s.location.water=0;
 s=end(s).state;assert.equal(s.economy!.field.stress,0);assert.equal(s.economy!.modern!.cropBonus,2);
});
test('现代副本禁止旧合龙替代，泵站必须耗电，现场缺电不扣套料',()=>{
 const s=fixture(),t=s.economy!.tower!;assert.throws(()=>act(s,'towerstart:canal'));t.floor=2;t.active=true;t.stock={food:2,iron:2,seal:2};s.economy!.equipment.W03=12;
 assert.equal(end(s).state.economy!.tower!.progress,0);s.economy!.equipment.W07=12;s.economy!.modern!.power=3;
 const x=end(s);assert.equal(x.state.economy!.tower!.progress,1);assert.equal(x.state.economy!.equipment.W07,11);assert.equal(x.state.economy!.equipment.W03,12);
});
function finalFixture(){const s=fixture(),t=s.economy!.tower!;t.floor=4;t.active=true;t.stock=Object.fromEntries(Object.entries(MODERN_FLOORS[4].kit).map(([id,n])=>[id,n!*3]));
 s.economy!.knowledge[s.household.activePersonId]={mechanics:10,organization:10,materials:10};s.economy!.goods={circuit:20,cable:12,fuel:6};
 s.economy!.equipment={E01:12,E02:12,N08:12,N10:12,F09:12};s.economy!.modern!.enabled=['E01','E02','N08','N10'];s.economy!.workers.artisan={kind:'artisan',experience:4,active:true,job:'controller',project:null};return s;}
test('最终工程须连续清洁发电、通信与数字制造；燃料发电不能代替清洁电源',()=>{
 let s=finalFixture();s.location.water=2;s=end(s).state;assert.equal(s.economy!.tower!.progress,1);
 const interrupted=structuredClone(s);interrupted.economy!.modern!.enabled=['E02','N08','N10'];const z=end(interrupted);assert.equal(z.state.economy!.tower!.progress,0);assert.equal(z.state.economy!.tower!.stock.controller,2);
 for(let i=0;i<2;i++)s=end(s).state;
 assert.equal(s.economy!.tower!.floor,5);assert.equal(s.status,'complete');
});
test('现代真实新局共享行动接口、严格重放、观察不泄露未来与随机状态',async()=>{
 const {implementation}=await loadCurrentContext();let s=await createSession({runId:'modern-replay',ruleset:r,implementation,seed:17,scenarioId:'canyon'});
 for(const actionId of ['economy:towerstart:survey','economy:foodplan:on','economy:end:season','economy:end:season','economy:end:season'])s=(await submitCommand(s,{actionId,commandId:'m'+s.record.entries.length,expectedRevision:s.record.entries.length})).session;
 assert.equal(s.state.economy!.tower!.floor,1);assert.deepEqual((await replayRecord(s.record,implementation)).state,s.state);
 const o=observeSession(s);assert.equal('randomState' in o.game,false);assert.equal('seed' in o.game,false);assert.equal(o.game.economy!.disciplines[0].topics.length,10);
});
