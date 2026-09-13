import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateRuleset,resolveRuleset } from '../src/game/ruleset.js';
import { createInitialState,transition,getAvailableActions } from '../src/game/game.js';
import { parseActionId } from '../src/game/model/action.js';
import { workshopPayroll } from '../src/game/systems/workshop.js';
import { loadCurrentContext } from '../apps/cli/context.js';
import { createSession,observeSession,submitCommand } from '../src/runtime/session.js';
import { replayRecord } from '../src/runtime/replay.js';

const r=validateRuleset(JSON.parse(await readFile('experiments/workshop-network.v12.json','utf8')));
function fixture(){const s=structuredClone(createInitialState(r,17,'river'));s.household.money=200;s.household.food=4;s.economy!.knowledge[s.household.activePersonId]={organization:3,materials:2};s.economy!.goods={wood:12,flax:40};s.economy!.operations!.food=true;s.economy!.workshops!.nodes={fiber:{active:true,units:1,logistics:1,source:'household',input:0,output:0},rope:{active:true,units:1,logistics:1,source:'upstream',input:0,output:0}};return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),r);
const end=(s:ReturnType<typeof fixture>)=>act(s,'end:season');

test('独立建设扣材料、招募费和名额，组织与工艺门槛不能绕过',()=>{
 let s=fixture();s.economy!.workshops!.nodes={};const cash=s.household.money;
 s=act(s,'workshopbuild:fiber').state;assert.equal(s.economy!.goods.wood,10);assert.equal(s.household.money,cash-r.economy!.hireCost);assert.equal(s.economy!.recruitment,0);assert.deepEqual(s.economy!.workers,{});
 assert.throws(()=>act(s,'workshopbuild:rope'));assert.throws(()=>act(s,'workshopbuild:fiber'));
 s=end(s).state;s=act(s,'workshopbuild:rope').state;assert.equal(s.economy!.workshops!.nodes.rope!.source,'upstream');
 const low=fixture();low.economy!.workshops!.nodes={};low.economy!.knowledge={};assert.throws(()=>act(low,'workshopbuild:fiber'));
});

test('整条链跨季运输、配方守恒，内部库存不可被本人直接使用',()=>{
 let s=fixture();const start=s.economy!.goods.flax;
 s=end(s).state;assert.equal(s.economy!.workshops!.nodes.fiber!.input,2);assert.equal(s.economy!.workshops!.nodes.fiber!.output,0);
 s=end(s).state;assert.equal(s.economy!.workshops!.nodes.fiber!.output,2);assert.equal(s.economy!.workshops!.nodes.rope!.input,0);assert.equal(s.economy!.goods.fiber,undefined);
 s=end(s).state;assert.equal(s.economy!.workshops!.nodes.rope!.input,2);assert.equal(s.economy!.workshops!.nodes.rope!.output,0);
 s=end(s).state;assert.equal(s.economy!.workshops!.nodes.rope!.output,1);assert.equal(s.economy!.goods.rope,undefined);
 s=end(s).state;assert.equal(s.economy!.goods.rope,1);
 const n=s.economy!.workshops!,f=n.nodes.fiber!,q=n.nodes.rope!;
 const remaining=(s.economy!.goods.flax??0)+f.input+f.output+q.input+2*q.output+2*(s.economy!.goods.rope??0)+n.shipments.reduce((a,x)=>a+x.amount*(x.good==='rope'?2:1),0);
 assert.equal(remaining,start);
});

test('下游暂停导致缓冲堵塞，上游待命不扣工资，恢复后继续流动',()=>{
 let s=fixture();s.economy!.workshops!.nodes.fiber!.output=r.workshops!.buffer;s.economy!.workshops!.nodes.fiber!.input=4;s.economy!.workshops!.nodes.rope!.active=false;
 const x=end(s);assert.ok(!x.events.some(e=>e.type==='operations'&&e.operation==='workshop-worked'));assert.ok(x.events.some(e=>e.type==='operations'&&e.detail.includes('成品缓冲已满')));
 s=act(x.state,'workshoppause:rope').state;const y=end(s);assert.ok(y.events.some(e=>e.type==='operations'&&e.operation==='workshop-worked'&&e.target==='fiber'));
 assert.ok(y.state.economy!.workshops!.nodes.fiber!.output<=r.workshops!.buffer);
});

test('工位扩建不凭空扩运、工资只收有效批数，缺钱不扣料',()=>{
 let s=fixture();s.economy!.workshops!.nodes.fiber!.input=2;s=act(s,'workshopexpand:fiber').state;
 const x=end(s);assert.equal(x.state.economy!.workshops!.nodes.fiber!.logistics,1);const worked=x.events.find(e=>e.type==='operations'&&e.operation==='workshop-worked');assert.ok(worked?.type==='operations');assert.equal(worked.money,r.economy!.wage+1);assert.equal(worked.amount,2);
 const broke=fixture();broke.household.money=0;broke.economy!.workshops!.nodes.fiber!.input=4;const y=end(broke);assert.equal(y.state.economy!.workshops!.nodes.fiber!.output,0);assert.ok(y.state.economy!.workshops!.nodes.fiber!.input>=4);assert.ok(!y.events.some(e=>e.type==='operations'&&e.operation==='workshop-worked'));
});

test('供应与工资充足时提高运力才提高链吞吐，不会因同季遍历直接产出',()=>{
 const outputs:number[]=[];
 for(const transport of [1,2]){
   const rules=resolveRuleset(r,{'workshops.transport':transport});let s=fixture();let rope=0;
   for(let i=0;i<10;i++){const x=transition(s,parseActionId('economy:end:season'),rules);s=x.state;rope+=x.events.filter(e=>e.type==='operations'&&e.operation==='workshop-worked'&&e.target==='rope').reduce((n,e)=>n+(e.type==='operations'?e.amount:0),0);}
   outputs.push(rope);
 }
 assert.ok(outputs[1]>outputs[0]);assert.equal(outputs[1],7);
});

test('外购替代保留在途货物，内部与家庭路线不会重复取料或超容量',()=>{
 let s=fixture();s.economy!.goods.fiber=10;s.economy!.workshops!.nodes.fiber!.output=4;
 s=end(s).state;assert.equal(s.economy!.goods.fiber,10);assert.equal(s.economy!.workshops!.nodes.rope!.input,2);
 s=act(s,'workshophousehold:rope').state;const x=end(s);assert.equal(x.state.economy!.goods.fiber,10); // 家庭取2，同时上游交回2
 assert.equal(x.state.economy!.workshops!.nodes.rope!.input,2);
 for(let i=0;i<5;i++){s=end(i? s:x.state).state;for(const w of Object.values(s.economy!.workshops!.nodes)){assert.ok(w!.input<=r.workshops!.buffer);assert.ok(w!.output<=r.workshops!.buffer);}}
});

test('补货保护作坊工资与原料，内部路线不购纤维，成品到家才销售',()=>{
 const s=fixture();s.economy!.goods={wood:2,flax:4,rope:4};s.economy!.operations!.supplies=true;s.economy!.operations!.sales=true;
 const x=end(s);assert.ok(!x.events.some(e=>e.type==='shop'&&e.operation==='purchased'&&e.target==='fiber'));assert.ok(!x.events.some(e=>e.type==='economy-trade'&&e.operation==='sell'&&e.good==='flax'));
 assert.ok(x.events.some(e=>e.type==='economy-trade'&&e.operation==='sell'&&e.good==='rope'));
 assert.equal(workshopPayroll(s,r),2*(r.economy!.wage+1));
 const low=fixture();low.economy!.goods={};low.economy!.operations!.supplies=true;low.household.money=r.operations!.cashReserve+workshopPayroll(low,r);const y=end(low);assert.ok(!y.events.some(e=>e.type==='shop'&&e.operation==='purchased'));
});

test('代际暂停保留网络和在途，接续及契约沿用已有经营语义',()=>{
 let s=fixture();s.economy!.workshops!.shipments.push({target:'rope',good:'fiber',amount:2,due:2});s.status='handover';
 s=act(s,'handover').state;assert.equal(s.economy!.operations!.paused,true);assert.equal(s.economy!.workshops!.nodes.rope!.input,2);assert.ok(s.economy!.workshops!.nodes.rope!.active);
 const x=end(s);assert.ok(!x.events.some(e=>e.type==='operations'&&e.operation==='workshop-worked'));
 const resumed=act(x.state,'resumeplans:family');assert.equal(resumed.state.economy!.operations!.paused,false);
 const contract=fixture();contract.economy!.operations!.charter=true;contract.status='handover';assert.equal(act(contract,'handover').state.economy!.operations!.paused,false);
});

test('参数边界、旧版隔离和观察保护，所有新增行动仍由统一会话执行并严格重放',async()=>{
 assert.equal(resolveRuleset(r,{'workshops.transport':1}).workshops!.transport,1);assert.throws(()=>resolveRuleset(r,{'workshops.buffer':3}));assert.throws(()=>validateRuleset({...r,rulesVersion:'0.11.0'}));
 const old=validateRuleset(JSON.parse(await readFile('rulesets/lasting-enterprise.v11.json','utf8')));assert.ok(!getAvailableActions(createInitialState(old,17,'river'),old).some(a=>a.id.includes('workshop')));
 const {implementation}=await loadCurrentContext();let session=await createSession({runId:'workshop-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
 for(const actionId of ['economy:study:O01','economy:hire:laborer','economy:study:O02','economy:end:season','economy:study:M01','economy:workshopbuild:fiber','economy:end:season']){session=(await submitCommand(session,{commandId:'w'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId})).session;}
 assert.deepEqual((await replayRecord(session.record,implementation)).state,session.state);
 const o=observeSession(session);assert.ok(o.game.economy!.workshopView);assert.equal('randomState' in o.game,false);assert.equal('seed' in o.game,false);
 const altered=structuredClone(session.record);altered.manifest.ruleset.workshops!.transport=1;await assert.rejects(replayRecord(altered,implementation));
});
