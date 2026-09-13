import {readFile} from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadCurrentContext} from '../apps/cli/context.js';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {shopCatalog,cartQuote,salePrice} from '../src/game/systems/shop.js';
import {equipped,level,storage} from '../src/game/systems/economy.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
const {implementation}=await loadCurrentContext();
// 冻结原商城回归的开局语义；现代入口与继承资产由 modern.test 单独验证。
const r=validateRuleset(JSON.parse(await readFile('rulesets/megaproject-trial.v13.json','utf8')));
function fixture(){const s=structuredClone(createInitialState(r,17,'river'));s.household.money=200;s.household.food=8;return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId('economy:'+id),r);
function buy(s:ReturnType<typeof fixture>,id:string){return act(act(s,'cartadd:'+id).state,'checkout:cart');}

test('商城目录只含有用途的商品、规则参数有界，整单采购原子扣费一次',()=>{
 let s=fixture();const c=shopCatalog(s,r);assert.equal(c.filter(x=>x.kind==='device').length,19);assert.ok(!c.some(x=>['spring','solution','rope','F04','F05'].includes(x.target)));
 assert.equal(resolveRuleset(r,{'shop.granaryPrice':24}).shop!.granaryPrice,24);assert.equal(r.shop!.granaryPrice,32);assert.throws(()=>resolveRuleset(r,{'shop.granaryPrice':0}));
 assert.throws(()=>validateRuleset({...r,shop:{...r.shop,repairPercent:100}}));
 s=act(s,'cartadd:good-wood').state;s=act(s,'cartadd:good-clay').state;assert.equal(s.ap,3);assert.equal(s.household.money,200);
 const q=cartQuote(s,r);const x=act(s,'checkout:cart');assert.equal(x.state.ap,2);assert.equal(x.state.household.money,200-q.total);assert.equal(x.state.economy!.goods.wood,3);assert.equal(x.state.economy!.goods.clay,3);assert.equal(x.state.economy!.shop!.transport,r.shop!.transport-2);assert.deepEqual(x.state.economy!.shop!.cart,{});assert.throws(()=>act(x.state,'checkout:cart'));
 const poor=structuredClone(s);poor.household.money=0;const before=structuredClone(poor);assert.throws(()=>act(poor,'checkout:cart'));assert.deepEqual(poor,before);
});
test('采购按当前库存和运输重新校验，食品没有第二个无限库存入口',()=>{
 let s=fixture();s=act(s,'cartadd:good-food').state;s=act(s,'cartadd:good-food').state;
 const stale=structuredClone(s);stale.production!.market.food=1;assert.throws(()=>act(stale,'checkout:cart'));
 const full=structuredClone(s);full.economy!.shop!.transport=1;assert.throws(()=>act(full,'checkout:cart'));
 const x=act(s,'checkout:cart');assert.equal(x.state.household.food,10);assert.equal(x.state.production!.market.food,s.production!.market.food-2);
 assert.ok(!getAvailableActions(s,r).some(a=>a.id==='economy:buyfood:bulk'||a.id==='economy:buy:wood'));
 for(const item of shopCatalog(s,r).filter(x=>x.kind==='goods'&&x.target!=='food'))assert.ok(item.price>salePrice(s,item.target));
 assert.equal(shopCatalog(s,r).find(x=>x.target==='flour')!.price,shopCatalog(s,r).find(x=>x.target==='wheat')!.price);
});
test('设备购买无需制造学科，不附赠工艺、研究证据或地方生产进度',()=>{
 const s=fixture();const x=buy(s,'device-F02');assert.equal(x.state.economy!.equipment.F02,12);assert.equal(level(x.state,'heat'),0);assert.deepEqual(x.state.economy!.evidence,{});assert.deepEqual(x.state.economy!.shop!.produced,{});assert.throws(()=>act(x.state,'process:ceramics'));assert.throws(()=>act(x.state,'cartadd:device-F02'));
});
test('外地设备仅下一季安装，未到货不能用、重复购买或制造',()=>{
 let s=fixture();s.economy!.knowledge[s.household.activePersonId]={mechanics:5,materials:3};s.economy!.goods={iron:5,valve:2,seal:2};
 s=buy(s,'device-W03').state;assert.equal(equipped(s,'W03'),false);assert.equal(s.economy!.shop!.orders.length,1);assert.throws(()=>act(s,'build:W03'));assert.throws(()=>act(s,'cartadd:device-W03'));
 const x=act(s,'end:season');assert.equal(equipped(x.state,'W03'),true);assert.equal(x.state.economy!.equipment.W03,12);assert.equal(x.state.economy!.shop!.orders.length,0);assert.equal(act(x.state,'end:season').events.filter(e=>e.type==='shop'&&e.operation==='delivered').length,0);
});
test('维修停机不额外产出，缺耐用资产保留，在制设备拒绝维修和替换',()=>{
 const s=fixture();s.economy!.equipment.W03=3;s.economy!.field.crop='wheat';s.location.rain=0;s.location.water=2;
 const x=act(s,'repair:W03');assert.equal(equipped(x.state,'W03'),false);assert.throws(()=>act(x.state,'build:W03'));assert.throws(()=>act(x.state,'repair:W03'));
 const y=act(x.state,'end:season');assert.ok(!y.events.some(e=>e.type==='economy-farm'&&e.operation==='pump'));assert.equal(y.state.economy!.equipment.W03,12);
 const busy=fixture();busy.economy!.equipment.F02=0;busy.economy!.project={good:'ceramics',amount:1,started:0};assert.throws(()=>act(busy,'repair:F02'));assert.throws(()=>act(busy,'build:F02'));
 const broken=fixture();broken.economy!.equipment.T01=0;assert.ok(act(broken,'repair:T01').state.economy!.shop!.orders.length);
});
test('教材是指定课题的永久来源，授课不能越级且需要本地教师',()=>{
 let s=fixture();s=buy(s,'book-A03').state;assert.throws(()=>act(s,'study:A03'));s=act(s,'end:season').state;
 assert.ok(s.economy!.shop!.books.includes('A03'));assert.equal(level(s,'agronomy'),0);
 s=act(s,'study:A01').state;s=act(s,'tuition:A02').state;s=act(s,'study:A03').state;assert.equal(level(s,'agronomy'),3);assert.equal(level(s,'materials'),0);assert.throws(()=>act(s,'tuition:A05'));assert.throws(()=>act(s,'tuition:A04'));assert.throws(()=>act(s,'cartadd:book-A03'));
});
test('委托培训停止本季工作工资，不允许与本人培训叠刷',()=>{
 const s=fixture();s.economy!.knowledge[s.household.activePersonId]={organization:4};s.economy!.workers.farmer={kind:'farmer',experience:6,job:'wheat',active:true,project:null};
 const x=act(s,'paidtrain:farmer');assert.throws(()=>act(x.state,'train:farmer'));assert.throws(()=>act(x.state,'paidtrain:farmer'));
 const y=act(x.state,'end:season');assert.equal(y.state.household.money,x.state.household.money);assert.equal(y.state.economy!.field.crop,null);assert.equal(y.state.economy!.workers.farmer!.experience,8);
 assert.throws(()=>act(y.state,'paidtrain:farmer'));
});
test('粮仓与书室是真实跨代资产，书室不允许重复留存刷教学',()=>{
 let s=fixture();s=buy(s,'asset-granary').state;s=act(s,'end:season').state;assert.equal(storage(s),30);
 s=buy(s,'asset-library').state;s=act(s,'end:season').state;
 const ready=structuredClone(s);ready.economy!.knowledge[ready.household.activePersonId]={agronomy:3};
 const x=act(ready,'archive:agronomy');assert.equal(level(x.state,'agronomy',x.state.household.heirId),1);assert.throws(()=>act(x.state,'archive:agronomy'));
 const hand=structuredClone(x.state);hand.status='handover';const next=transition(hand,parseActionId('handover'),r).state;assert.equal(storage(next),30);assert.ok(next.economy!.shop!.assets.includes('library'));assert.equal(level(next,'agronomy'),1);
});
test('播种器节省行动而不叠加犁的产量，每季最多一次且照扣种子耐用',()=>{
 const s=fixture();s.economy!.knowledge[s.household.activePersonId]={agronomy:1};s.economy!.equipment={U01:12,U02:12};
 const x=act(s,'farm:wheat');assert.equal(x.state.ap,3);assert.equal(x.state.economy!.field.bonus,1);assert.equal(x.state.economy!.equipment.U02,11);assert.equal(x.state.economy!.goods.seedWheat,0);
 const repeat=structuredClone(x.state);repeat.economy!.field.crop=null;repeat.economy!.goods.seedWheat=1;assert.equal(act(repeat,'farm:wheat').state.ap,2);
});
test('本地化必须有实际制造与传播，外购不会刷出廉价供应',()=>{
 let s=fixture();s.economy!.knowledge[s.household.activePersonId]={materials:3};
 s=buy(s,'good-seal').state;s=act(s,'end:season').state;assert.equal(s.economy!.shop!.produced.seal,undefined);assert.equal(shopCatalog(s,r).find(x=>x.target==='seal')!.local,false);
 const ready=structuredClone(s);ready.economy!.shop!.produced.seal=3;ready.economy!.regional.teaching.materials=3;
 const item=shopCatalog(ready,r).find(x=>x.target==='seal')!;assert.equal(item.local,true);assert.ok(item.price>salePrice(ready,'seal'));
});
test('代际边界交付一次，最后季拒绝无从交付的订单',()=>{
 const s=fixture();s.clock.turn=r.parameters.turnsPerGeneration;
 let x=buy(s,'device-W03').state;x=act(x,'end:season').state;assert.equal(x.status,'handover');assert.equal(equipped(x,'W03'),false);
 x=transition(x,parseActionId('handover'),r).state;assert.equal(equipped(x,'W03'),true);assert.equal(x.economy!.shop!.orders.length,0);
 const last=fixture();last.clock.generation=r.parameters.generations;last.clock.turn=r.parameters.turnsPerGeneration;
 assert.throws(()=>buy(last,'device-W03'));last.economy!.equipment.W03=1;assert.throws(()=>act(last,'repair:W03'));
});
test('商城观察不泄漏未来状态，清单与订单通过同一接口严格重放',async()=>{
 let session=await createSession({runId:'shop-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
 for(const actionId of ['economy:cartadd:good-wood','economy:cartadd:good-clay','economy:checkout:cart','economy:work:local','economy:end:season'])session=(await submitCommand(session,{commandId:'s'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId})).session;
 const obs=observeSession(session);assert.ok(obs.game.economy!.marketView);assert.ok(!JSON.stringify(obs).includes('randomState'));assert.ok(!JSON.stringify(obs).includes('futureWeather'));
 const replayed=await replayRecord(session.record,implementation);assert.deepEqual(replayed.state,session.state);
});
