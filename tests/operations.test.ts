import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {validateRuleset} from '../src/game/ruleset.js';
import assert from 'node:assert/strict';
import {loadCurrentContext} from '../apps/cli/context.js';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {foodStock} from '../src/game/systems/economy.js';
import {technologyVictory} from '../src/game/systems/investment.js';
import {resolveRuleset} from '../src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
const {implementation}=await loadCurrentContext();
const r=validateRuleset(JSON.parse(await readFile('rulesets/lasting-enterprise.v11.json','utf8')));
function fixture(){const s=structuredClone(createInitialState(r,17,'river'));s.household.money=200;s.household.food=4;s.economy!.knowledge[s.household.activePersonId]={organization:3,agronomy:3,materials:3,mechanics:3};return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),r);
const worker=(kind:'farmer'|'artisan')=>({kind,experience:4,job:'rest' as const,active:false,project:null});

test('供粮签约真实预留市场库存，季末自动付款配送且不反复花行动',()=>{
 let s=fixture();s.household.food=0;const market=s.production!.market.food;
 s=act(s,'foodplan:on').state;assert.equal(s.production!.market.food,market-4);assert.equal(s.economy!.operations!.foodReserved,4);assert.equal(s.ap,2);
 const money=s.household.money;let x=act(s,'end:season');assert.equal(x.state.household.money,money-4);assert.equal(x.state.household.food,2);assert.equal(x.events.filter(e=>e.type==='action-paid').reduce((n,e)=>n+e.cost.ap,0),0);
 x=act(x.state,'end:season');assert.equal(x.state.household.food,2);assert.equal(x.state.household.money,money-6);
 const paused=act(x.state,'foodplan:off');assert.equal(paused.state.economy!.operations!.foodReserved,0);assert.equal(paused.state.production!.market.food,x.state.production!.market.food+4);
});
test('生活配送先于工资与扩张，没钱时不凭空供粮且显示告警',()=>{
 let s=fixture();s.household.food=0;s.household.money=2;s.economy!.workers.farmer={...worker('farmer'),job:'wheat',active:true};
 s=act(s,'foodplan:on').state;const x=act(s,'end:season');assert.equal(x.state.household.money,0);assert.ok(x.events.some(e=>e.type==='season-settled'&&e.missing===0));assert.equal(x.state.economy!.field.crop,null);
 const y=act(x.state,'end:season');assert.ok(y.events.some(e=>e.type==='season-settled'&&e.missing===2));assert.ok(y.state.economy!.operations!.notice.some(x=>x.includes('供粮不足')));
});
test('农业托管完成留种、收获、轮作与施肥，待命季不收费',()=>{
 let s=fixture();s.economy!.workers.farmer=worker('farmer');s.economy!.equipment.W03=12;s.economy!.goods.wood=10;s.economy!.goods.compost=2;s.economy!.field.fertility=0;
 s=act(s,'farmplan:rotation').state;const x=act(s,'end:season');assert.equal(x.state.economy!.field.crop,'wheat');assert.equal(x.state.economy!.field.fertility,1);assert.equal(x.state.economy!.goods.compost,1);
 let cur=x.state;for(let i=0;i<3;i++)cur=act(cur,'end:season').state;
 assert.equal(cur.economy!.field.crop,'soy');assert.ok(cur.economy!.goods.wheat>0);assert.ok(cur.economy!.goods.seedWheat>=1);
 assert.equal(cur.economy!.operations!.farm,'rotation');
});
test('补货使用同一库存和运输，扣钱有底线，待到货不重复下单',()=>{
 let s=fixture();s.economy!.workers.artisan=worker('artisan');s.economy!.equipment.T03=12;s.economy!.goods={wood:0,iron:0};
 s=act(s,'productionplan:shaft-stock').state;s=act(s,'supplyplan:on').state;
 const x=act(s,'end:season');assert.ok(x.events.some(e=>e.type==='shop'&&e.operation==='purchased'&&e.target==='iron'));assert.equal(x.state.economy!.goods.iron,2);assert.equal(x.state.economy!.goods.wood,4);
 const y=act(x.state,'end:season');assert.ok(!y.events.some(e=>e.type==='shop'&&e.operation==='purchased'));assert.equal(y.state.economy!.goods.shaft,2);
 const low=fixture();low.economy!.workers.artisan={...worker('artisan'),active:true,job:'fiber'};low.economy!.operations!.production={recipe:'fiber',mode:'sell'};low.economy!.operations!.supplies=true;low.economy!.goods={};low.household.money=r.operations!.cashReserve+2;
 assert.equal(act(low,'end:season').state.household.money,low.household.money);
});
test('生产计划跨季完成并自动交付，备货目标到达后停止消耗',()=>{
 let s=fixture();s.economy!.workers.artisan=worker('artisan');s.economy!.equipment.F02=12;s.economy!.goods={wood:10,clay:10};
 s=act(s,'productionplan:ceramics-stock').state;s=act(s,'end:season').state;assert.ok(s.economy!.workers.artisan!.project);s=act(s,'end:season').state;assert.equal(s.economy!.goods.ceramics,2);
 const money=s.household.money,wood=s.economy!.goods.wood;s=act(s,'end:season').state;assert.equal(s.household.money,money);assert.equal(s.economy!.goods.wood,wood);
 s=act(s,'productionplan:ceramics-sell').state;s=act(s,'salesplan:on').state;const x=act(s,'end:season');const y=act(x.state,'end:season');assert.ok(y.events.some(e=>e.type==='operations'&&e.operation==='sold'));assert.equal(y.state.economy!.goods.ceramics,2);
});
test('自动维护让耗尽设备恢复，在制项目不送修且不重复付费',()=>{
 let s=fixture();s.economy!.equipment.F02=1;s.economy!.workers.artisan={...worker('artisan'),active:true,job:'ceramics'};s.economy!.goods={wood:6,clay:6};
 s=act(s,'careplan:on').state;const x=act(s,'end:season');assert.equal(x.state.economy!.equipment.F02,12);assert.equal(x.state.economy!.goods.wood,6);assert.equal(x.events.filter(e=>e.type==='shop'&&e.operation==='repair').length,1);
 const busy=structuredClone(s);busy.economy!.workers.artisan!.project={good:'ceramics',amount:1,started:0};const y=act(busy,'end:season');assert.ok(!y.events.some(e=>e.type==='shop'&&e.operation==='repair'));assert.equal(y.state.economy!.goods.ceramics,2);
});
test('家族契约跨代保留运行，无契约只暂停配置且一次接续可恢复',()=>{
 let s=fixture();s.economy!.workers.farmer=worker('farmer');s=act(s,'farmplan:wheat').state;s=act(s,'foodplan:on').state;
 const h=structuredClone(s);h.status='handover';const x=act(h,'handover');assert.equal(x.state.economy!.operations!.paused,true);assert.equal(x.state.economy!.operations!.farm,'wheat');assert.equal(x.state.economy!.workers.farmer!.active,false);
 const resumed=act(x.state,'resumeplans:family');assert.equal(resumed.state.economy!.workers.farmer!.active,true);assert.equal(resumed.state.economy!.operations!.foodReserved,4);
 const c=act(s,'charter:family').state;const hc=structuredClone(c);hc.status='handover';const y=act(hc,'handover');assert.equal(y.state.economy!.operations!.paused,false);assert.equal(y.state.economy!.workers.farmer!.active,true);assert.equal(y.state.economy!.operations!.foodReserved,4);
});
test('项目靠真实运行而非启动付费完成，暂停恢复不重复扣材料',()=>{
 let s=fixture();s=act(s,'foodplan:on').state;s=act(s,'projectstart:food').state;
 assert.equal(s.economy!.operations!.projects.food!.stage,'commissioning');s=act(s,'projectpause:current').state;const money=s.household.money;s=act(s,'projectstart:food').state;assert.ok(s.household.money>=money-4);
 for(let i=0;i<r.operations!.commissionSeasons;i++)s=act(s,'end:season').state;
 assert.equal(s.economy!.operations!.projects.food!.stage,'complete');assert.throws(()=>act(s,'projectstart:food'));assert.equal(s.economy!.operations!.foodReserved,6);
});
test('机械验证保留本季早先行动证据，不要求加工是最后一个行动',()=>{
 let s=fixture();s.economy!.equipment.P01=12;s.economy!.goods={shaft:2,ceramics:2,flax:20};s=act(s,'projectstart:mechanical').state;
 for(let i=0;i<r.operations!.commissionSeasons;i++){s=act(s,'process:fiber').state;if(s.ap<3)s=act(s,'end:season').state;}
 assert.equal(s.economy!.operations!.projects.mechanical!.stage,'complete');assert.equal(s.economy!.goods.fiber,12);
});
test('排水采掘消耗真实泵和木材，农业优先共用泵，不产生双份排水',()=>{
 const s=fixture();s.economy!.equipment.W03=12;s.economy!.goods.wood=5;s.economy!.operations!.mine=true;s.economy!.operations!.projects.mine={stage:'complete',progress:3,founder:s.household.activePersonId};
 const x=act(s,'end:season');assert.equal(x.state.economy!.goods.ore,2);assert.equal(x.state.economy!.equipment.W03,11);assert.equal(x.state.household.money,s.household.money-1);
 const f=structuredClone(s);f.economy!.field.crop='wheat';f.location.rain=0;f.location.water=1;const y=act(f,'end:season');assert.equal(y.state.economy!.goods.ore,undefined);assert.equal(y.state.economy!.equipment.W03,11);
});
test('蒸汽用燃料替代水并即时完成窑炉批次，每季动力额度共享',()=>{
 const s=fixture();s.economy!.operations!.projects.steam={stage:'complete',progress:3,founder:s.household.activePersonId};s.economy!.operations!.steam=true;s.economy!.equipment={F02:12,U06:12};s.economy!.goods={wood:10,clay:8,wheat:4};s.location.water=0;
 const x=act(s,'process:ceramics');assert.equal(x.state.economy!.goods.ceramics,2);assert.equal(x.state.economy!.project,null);assert.equal(x.state.economy!.goods.wood,6);
 assert.equal(getAvailableActions(x.state,r).find(a=>a.id==='economy:process:mill')!.ap,1);
 const mill=act(s,'process:mill');assert.equal(mill.state.ap,3);assert.equal(mill.state.location.water,0);assert.equal(mill.state.economy!.goods.wood,8);
});
test('仅22知识不再直接胜利，真实成果与知识同时达标才赢，经营参数可有界对照',()=>{
 const s=fixture();s.economy!.knowledge[s.household.activePersonId]={mechanics:4,materials:4,heat:4,chemistry:4,agronomy:3,organization:3};assert.equal(technologyVictory(s,r)!.achieved,false);
 const x=act(s,'end:season');assert.equal(x.state.status,'active');s.economy!.operations!.projects={food:{stage:'complete',progress:3,founder:'person:1'},mechanical:{stage:'complete',progress:3,founder:'person:1'}};assert.equal(act(s,'end:season').state.status,'complete');
 assert.equal(resolveRuleset(r,{'operations.cashReserve':2}).operations!.cashReserve,2);assert.throws(()=>resolveRuleset(r,{'operations.requiredAchievements':5}));
});
test('经营计划与跨季配送由统一接口严格重放，观察不含未来天气或随机种子',async()=>{
 let session=await createSession({runId:'ops-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
 for(const actionId of ['economy:study:O01','economy:foodplan:on','economy:work:local','economy:end:season','economy:end:season'])session=(await submitCommand(session,{commandId:'o'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId})).session;
 const obs=observeSession(session);assert.ok(obs.game.economy!.operationsView);assert.ok(!JSON.stringify(obs).includes('randomState'));assert.equal(foodStock(session.state),obs.game.economy!.foodTotal);assert.deepEqual((await replayRecord(session.record,implementation)).state,session.state);
});

test('生产计划暂停保留在制与配方，可以一键接续原工序但不能换配方逃避',()=>{
 let s=fixture();s.economy!.workers.artisan=worker('artisan');s.economy!.equipment.F02=12;s.economy!.goods={wood:8,clay:8};s=act(s,'productionplan:ceramics-sell').state;s=act(s,'end:season').state;s=act(s,'productionplan:off').state;
 assert.equal(s.economy!.operations!.production!.recipe,'ceramics');assert.ok(s.economy!.workers.artisan!.project);assert.throws(()=>act(s,'productionplan:fiber-sell'));
 s=act(s,'productionplan:ceramics-sell').state;s=act(s,'end:season').state;assert.equal(s.economy!.goods.ceramics,2);
});

test('蒸汽项目消耗压力配套逐季验证后才开放，无材料时不推进',()=>{
 let s=fixture();s.economy!.knowledge[s.household.activePersonId]={heat:6,materials:6,mechanics:5,organization:3};s.economy!.operations!.projects.mine={stage:'complete',progress:3,founder:'person:1'};s.economy!.equipment.F04=12;s.economy!.goods={wood:12,brick:2,spring:2,seal:2,valve:3};
 s=act(s,'projectstart:steam').state;const wait=act(s,'end:season');assert.equal(wait.state.economy!.operations!.projects.steam!.progress,0);assert.ok(wait.state.economy!.operations!.notice.some(x=>x.includes('蒸汽试验等待')));
 s=structuredClone(wait.state);s.economy!.goods.spring=3;for(let i=0;i<3;i++)s=act(s,'end:season').state;assert.equal(s.economy!.operations!.projects.steam!.stage,'complete');assert.equal(s.economy!.operations!.steam,true);assert.equal(s.economy!.goods.spring,0);assert.equal(s.economy!.goods.valve,0);assert.equal(s.economy!.goods.wood,6);assert.equal(s.economy!.equipment.F04,9);
});
