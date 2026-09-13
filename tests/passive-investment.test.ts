import {lifeChronicle} from '../src/research/life-chronicle.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContext} from '../apps/cli/context.js';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {getObservation} from '../src/game/observation.js';
import {parseActionId} from '../src/game/model/action.js';
import {validateRuleset} from '../src/game/ruleset.js';
import {technologyVictory} from '../src/game/systems/investment.js';
import {experience} from '../src/game/systems/development.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
const {investmentBase:r,pacingBase,implementation}=await loadContext();
// 单元夹具代表已建成的家庭，不作为默认开局可达性的证据。
function fixture(){const s=structuredClone(createInitialState(r,17,'clay-valley'));s.household.food=20;s.production!.inventory.wood=8;return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId(id),r);
test('投资机制独立版本及参数校验，旧规则保留手动操作',()=>{
  assert.throws(()=>validateRuleset({...pacingBase,passiveInvestment:r.passiveInvestment}));
  for(const victoryPercent of [0,101,NaN,1.5])assert.throws(()=>validateRuleset({...r,passiveInvestment:{...r.passiveInvestment,victoryPercent}}));
  const old=createInitialState(pacingBase,17,'clay-valley');assert.ok(getAvailableActions(old,pacingBase).some(a=>a.id==='calibrate'));
  assert.ok(!getAvailableActions(fixture(),r).some(a=>['calibrate','pump-water','recycle-ceramics'].includes(a.id)));
});
test('安装即自动生效，同季末不重复运行；观察不结算，自动运行不增加经验',()=>{
  const s=fixture();s.productNetwork!.goods.calibrator=1;s.development!.goods.findings=3;s.development!.goods.supplies=3;
  const x=act(s,'install-product:calibrator');assert.equal(x.state.ap,s.ap-1);assert.equal(x.state.productNetwork!.goods.calibrations,1);
  assert.equal(x.state.development!.goods.findings,2);assert.equal(x.state.development!.goods.supplies,2);
  assert.equal(experience(x.state,'science'),0);
  const raw=JSON.stringify(x.state);getObservation(x.state,r);getObservation(x.state,r);assert.equal(JSON.stringify(x.state),raw);
  const y=act(x.state,'end-turn');assert.equal(y.events.filter(e=>e.type==='product-operated').length,0);
  const z=act(y.state,'end-turn');assert.equal(z.state.productNetwork!.goods.calibrations,2);assert.equal(z.state.productNetwork!.installed.calibrator,2);
});
test('缺料停机，末季安装仍产出；提水守恒及蓄水满仓不磨损，收成预览一致',()=>{
  const s=fixture();s.clock.turn=r.parameters.turnsPerGeneration;s.clock.generation=r.parameters.generations;
  s.productNetwork!.goods.pump=1;s.location.water=2;s.location.rain=0;
  const x=act(s,'install-product:pump');assert.equal(x.state.location.water,1);assert.equal(x.state.productNetwork!.storedWater,1);assert.equal(x.state.production!.inventory.wood,7);
  const expected=getObservation(x.state,r).harvest.food;
  const y=act(x.state,'cultivate');assert.equal(y.events.find(e=>e.type==='harvest')?.food,expected);
  const full=fixture();full.productNetwork!.installed.pump=4;full.productNetwork!.storedWater=2;
  assert.equal(act(full,'end-turn').state.productNetwork!.installed.pump,4);
  const empty=fixture();empty.productNetwork!.installed.calibrator=4;
  assert.equal(act(empty,'end-turn').state.productNetwork!.installed.calibrator,4);
});
test('控温窑真实消耗两份残料，不能循环复制',()=>{
  const s=fixture();s.productNetwork!.goods.kiln=1;s.productNetwork!.goods.spentCeramics=2;
  const x=act(s,'install-product:kiln');assert.equal(x.state.productNetwork!.goods.spentCeramics,0);assert.equal(x.state.development!.goods.ceramicParts,1);
  const y=act(act(x.state,'end-turn').state,'end-turn');assert.equal(y.state.development!.goods.ceramicParts,1);assert.equal(y.state.productNetwork!.installed.kiln,3);
});
test('工业交付并购粮守恒、市场与资金限制；报告出售需要实物和订单',()=>{
  const s=fixture();s.development!.goods.ceramicParts=1;s.household.money=0;
  const x=act(s,'deliver-food:ceramicParts');assert.equal(x.state.household.money,4-2*r.parameters.foodPrice);assert.equal(x.state.household.food,22);
  assert.equal(x.state.production!.market.food,s.production!.market.food-2);assert.equal(x.state.development!.goods.ceramicParts,0);assert.equal(x.state.development!.ordersRemaining,s.development!.ordersRemaining-1);
  assert.throws(()=>act(x.state,'deliver-food:ceramicParts'));
  s.production!.market.food=1;assert.throws(()=>act(s,'deliver-food:ceramicParts'));
  s.productNetwork!.goods.calibrations=1;const sold=act(s,'sell-calibration');assert.equal(sold.state.household.money,r.passiveInvestment!.reportPrice);assert.equal(sold.state.productNetwork!.goods.calibrations,0);
});
test('mentor 一次至多2经验，不越过父辈一半；后辈经验确实跨代',()=>{
  const s=fixture();s.development!.experience[s.household.activePersonId]={woodwork:7,pottery:0,agriculture:0,science:0};
  let x=act(s,'mentor:woodwork');assert.equal(experience(x.state,'woodwork',s.household.heirId),2);
  x=act(x.state,'mentor:woodwork');assert.equal(experience(x.state,'woodwork',s.household.heirId),3);assert.throws(()=>act(x.state,'mentor:woodwork'));
  const ready=structuredClone(x.state);ready.status='handover';const y=act(ready,'handover');assert.equal(experience(y.state,'woodwork'),3);
});
test('家族科技按实装节点跨人去重，生存结算优先，达标真正终局',()=>{
  const s=fixture(),required=Math.ceil(r.technologies.length*.6),ids=r.technologies.slice(0,required).map(t=>t.id);
  s.persons[s.household.activePersonId].mastered=ids.slice(0,6);s.persons[s.household.heirId].mastered=ids.slice(4);
  assert.equal(technologyVictory(s,r)!.mastered.length,required);
  const x=act(s,'end-turn');assert.equal(x.state.status,'complete');assert.ok(x.events.some(e=>e.type==='technology-victory'));assert.equal(getAvailableActions(x.state,r).length,0);
  s.household.food=0;s.household.hardship=r.parameters.hardshipLimit-1;const lost=act(s,'end-turn');assert.equal(lost.state.status,'ended');assert.equal(getObservation(lost.state,r).victory!.won,false);
  assert.ok(!lost.events.some(e=>e.type==='technology-victory'));
});
test('真实新局行动记录可严格重放，新行动走统一接口',async()=>{
  let s=await createSession({runId:'investment-replay',ruleset:r,implementation,seed:17,scenarioId:'clay-valley'});
  for(const actionId of ['procure:ceramicParts','deliver-food:ceramicParts','end-turn']){
    const o=observeSession(s);s=(await submitCommand(s,{commandId:`step:${o.revision}`,expectedRevision:o.revision,actionId})).session;
  }
  assert.equal(lifeChronicle(s.record).chapters[0].investment.money,5+2*r.parameters.foodPrice);
  assert.deepEqual((await replayRecord(s.record,implementation)).state,s.state);
});
