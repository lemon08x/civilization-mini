import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContext} from '../apps/cli/context.js';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {getObservation} from '../src/game/observation.js';
import {parseActionId} from '../src/game/model/action.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {PRODUCTS,PROCESSES,GOODS,TOPICS} from '../src/game/systems/economy-catalog.js';
import {level,foodStock} from '../src/game/systems/economy.js';
import {validateRuleset} from '../src/game/ruleset.js';
const {economyBase:r,investmentBase,implementation}=await loadContext();
function fixture(){const s=structuredClone(createInitialState(r,17,'river'));s.household.food=8;s.household.money=40;return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId(id),r);
test('新版入口只有学科经济行动，目录引用完整且没有规划产品行动',()=>{
  const s=fixture();assert.equal(s.productNetwork,undefined);assert.equal(s.society,undefined);
  assert.equal(TOPICS.length,36);assert.equal(PRODUCTS.length,21);
  assert.ok(getAvailableActions(s,r).every(a=>a.id.startsWith('economy:')));
  assert.throws(()=>act(s,'calibrate'));assert.throws(()=>validateRuleset({...investmentBase,economy:r.economy}));
  for(const p of PRODUCTS)for(const id of Object.keys(p.inputs))assert.ok(GOODS[id]);
  for(const p of PROCESSES){for(const id of [...Object.keys(p.inputs),...Object.keys(p.outputs)])assert.ok(GOODS[id]);if(p.equipment)assert.ok(PRODUCTS.some(x=>x.id===p.equipment));}
});
test('研究证据按人按课题去重，理论无跨学科前置，家族记录帮助后辈',()=>{
  let s=fixture();s=act(s,'economy:study:M01').state;assert.throws(()=>act(s,'economy:study:M02'));
  s=act(s,'economy:research:M02').state;const before=s.economy!.goods.clay;assert.throws(()=>act(s,'economy:research:M02'));assert.equal(s.economy!.goods.clay,before);
  s=act(s,'economy:study:M02').state;assert.equal(level(s,'materials'),2);assert.equal(level(s,'heat'),0);
  s=act(s,'economy:archive:materials').state;s=act(s,'economy:teach:materials').state;assert.equal(level(s,'materials',s.household.heirId),1);
});
test('种植分离粮食、种子和秸秆，不能同季多次收获；亚麻不能用于生活',()=>{
  let s=fixture();s.economy!.knowledge[s.household.activePersonId]={agronomy:2};
  s=act(s,'economy:farm:wheat').state;assert.equal(s.economy!.goods.seedWheat,0);assert.equal(s.economy!.field.growth,0);
  s=act(s,'economy:end:season').state;s=act(s,'economy:end:season').state;
  const result=act(s,'economy:farm:wheat');s=result.state;assert.ok(s.economy!.goods.wheat>0);assert.equal(s.economy!.goods.seedWheat,1);assert.equal(s.economy!.goods.straw,2);assert.equal(s.economy!.field.crop,null);
  const starve=fixture();starve.household.food=0;starve.economy!.goods={flax:20,seedWheat:10};assert.equal(act(starve,'economy:end:season').events.find(e=>e.type==='season-settled')?.missing,2);
});
test('季末从实物食品按需取粮，不把工业原料改成通用口粮',()=>{
  const s=fixture();s.household.food=0;s.economy!.goods={wheat:3,soy:2,flax:8};
  const x=act(s,'economy:end:season');assert.equal(x.state.economy!.goods.wheat,1);assert.equal(x.state.economy!.goods.soy,2);assert.equal(foodStock(x.state),3);assert.equal(x.state.economy!.goods.flax,8);
});
test('招募与工资真实扣除，无钱不生产，雇员实际工作不增加本人农学',()=>{
  let s=fixture();s.economy!.knowledge[s.household.activePersonId]={organization:2};
  s=act(s,'economy:hire:farmer').state;assert.equal(s.household.money,40-r.economy!.hireCost);
  s=act(s,'economy:assign:farmer-wheat').state;
  const noMoney=structuredClone(s);noMoney.household.money=0;const halted=act(noMoney,'economy:end:season');assert.equal(halted.state.economy!.field.crop,null);assert.equal(halted.state.economy!.goods.seedWheat,1);
  const x=act(s,'economy:end:season');assert.equal(x.state.economy!.field.crop,'wheat');assert.equal(level(x.state,'agronomy'),0);assert.equal(x.state.household.money,s.household.money-2);assert.equal(x.state.economy!.workers.farmer!.experience,5);
});
test('工匠与本人共用窑位，在制项目真实扣料一次，跨季完成',()=>{
  let s=fixture();s.economy!.knowledge[s.household.activePersonId]={organization:2,materials:2};s.economy!.goods={wood:8,clay:8};s.economy!.equipment.F02=12;
  s.economy!.workers.artisan={kind:'artisan',experience:4,active:true,job:'ceramics',project:null};
  s=act(s,'economy:process:ceramics').state;assert.equal(s.economy!.goods.wood,6);
  let x=act(s,'economy:end:season');assert.ok(x.events.some(e=>e.type==='economy-worker'&&e.operation==='waiting'));assert.equal(x.state.household.money,s.household.money);
  s=act(x.state,'economy:finish:project').state;assert.equal(s.economy!.goods.ceramics,2);
  x=act(s,'economy:end:season');assert.equal(x.state.economy!.goods.wood,4);assert.ok(x.state.economy!.workers.artisan!.project);
  const y=act(x.state,'economy:end:season');assert.equal(y.state.economy!.goods.wood,4);assert.equal(y.state.economy!.goods.ceramics,4);
});
test('成熟工匠批量消耗双份原料，培训不只是增加工资',()=>{
  const s=fixture();s.economy!.workers.artisan={kind:'artisan',experience:8,active:true,job:'fiber',project:null};s.economy!.goods.flax=4;
  const x=act(s,'economy:end:season');assert.equal(x.state.economy!.goods.flax,0);assert.equal(x.state.economy!.goods.fiber,4);assert.equal(x.state.household.money,37);
});
test('水轮免行动每季限一次，仍扣水、原料和设备耐用',()=>{
  let s=fixture();s.economy!.knowledge[s.household.activePersonId]={mechanics:2};s.economy!.equipment={P03:12,U06:12};s.economy!.goods.wheat=6;s.location.water=2;
  const before=s.ap;s=act(s,'economy:process:mill').state;assert.equal(s.ap,before);assert.equal(s.location.water,1);assert.equal(s.economy!.goods.wheat,4);assert.equal(s.economy!.goods.flour,3);assert.equal(s.economy!.equipment.P03,11);
  assert.equal(getAvailableActions(s,r).find(a=>a.id==='economy:process:mill')!.ap,1);assert.throws(()=>act(s,'economy:process:mill'));
});
test('活塞泵自动供水与满水停机，排水设施只在积水天气生效',()=>{
  const s=fixture();s.economy!.field={...s.economy!.field,crop:'wheat',duration:2};s.economy!.equipment.W03=12;s.location.rain=0;s.location.water=1;
  const x=act(s,'economy:end:season');assert.equal(x.state.economy!.field.stress,0);assert.equal(x.state.economy!.goods.wood,1);assert.equal(x.state.economy!.equipment.W03,11);
  const wet=fixture();wet.economy!.field.crop='wheat';wet.economy!.equipment={W03:12,U08:12};wet.location.rain=3;
  const y=act(wet,'economy:end:season');assert.equal(y.state.economy!.equipment.W03,12);assert.equal(y.state.economy!.equipment.U08,11);assert.equal(y.state.economy!.field.stress,0);
});
test('地区供应由实际生产加传播触发，买卖价格不产生套利',()=>{
  const s=fixture();s.economy!.ironBatches=3;assert.equal(act(s,'economy:end:season').state.economy!.regional.iron,false);
  s.economy!.published.chemistry=5;const x=act(s,'economy:end:season');assert.equal(x.state.economy!.regional.iron,true);
  const buy=getAvailableActions(x.state,r).find(a=>a.id==='economy:buy:iron')!;assert.equal(buy.money,GOODS.iron.price);
});
test('跨代合同有记录才接续，资产、工人经验与在制品保留，理论不复制',()=>{
  const s=fixture();s.status='handover';s.economy!.knowledge[s.household.activePersonId]={organization:3,chemistry:5};
  s.economy!.workers.artisan={kind:'artisan',experience:6,job:'ceramics',active:true,project:{good:'ceramics',amount:1,started:1}};s.economy!.equipment.F02=8;
  const paused=act(s,'handover');assert.equal(paused.state.economy!.workers.artisan!.active,false);assert.equal(level(paused.state,'chemistry'),0);assert.equal(paused.state.economy!.workers.artisan!.experience,6);
  s.economy!.notes.organization=3;const kept=act(s,'handover');assert.equal(kept.state.economy!.workers.artisan!.active,true);assert.ok(kept.state.economy!.workers.artisan!.project);assert.equal(kept.state.economy!.equipment.F02,8);
});
test('新胜利只按36学科节点计，观察不泄露随机状态，合法动作严格重放',async()=>{
  let s=await createSession({runId:'economy-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
  for(const actionId of ['economy:study:A01','economy:farm:wheat','economy:end:season','economy:gather:food']){
    const o=observeSession(s);assert.ok(!JSON.stringify(o).includes('randomState'));s=(await submitCommand(s,{commandId:'step:'+o.revision,expectedRevision:o.revision,actionId})).session;
  }
  assert.deepEqual((await replayRecord(s.record,implementation)).state,s.state);assert.equal(getObservation(s.state,r).victory!.total,36);assert.equal(getObservation(s.state,r).victory!.required,22);
});
