import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {technologyVictory} from '../src/game/systems/investment.js';
import {TOWER_FLOORS} from '../src/game/systems/tower.js';
import {loadCurrentContext} from '../apps/cli/context.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {metrics} from '../src/research/metrics.js';

const r=validateRuleset(JSON.parse(await readFile('experiments/megaproject-trial.v13.json','utf8')));
function fixture(){const s=structuredClone(createInitialState(r,17,'river'));s.household.money=200;s.household.food=8;s.economy!.operations!.food=true;s.economy!.goods={wood:24,iron:12,rope:8,ceramics:8,brick:8,seal:8,valve:8,shaft:8};return s;}
const act=(s:ReturnType<typeof fixture>,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),r);
const end=(s:ReturnType<typeof fixture>)=>act(s,'end:season');
function ready(index:number){const s=fixture();const t=s.economy!.tower!;t.floor=index;t.active=true;t.delivery=false;t.stock=Object.fromEntries(Object.entries(TOWER_FLOORS[index].kit).map(([id,n])=>[id,n!*(index===4?3:4)]));return s;}

test('试炼替代知识货币胜利，未通层不能跳关，开工不会购买进度',()=>{
 let s=fixture();s.economy!.knowledge[s.household.activePersonId]={mechanics:6,materials:6,chemistry:6,heat:6,organization:6,agronomy:6};s.economy!.operations!.projects={food:{stage:'complete',progress:3,founder:'person:1'},mechanical:{stage:'complete',progress:3,founder:'person:1'}};
 assert.equal(technologyVictory(s,r)!.achieved,false);assert.throws(()=>act(s,'towerstart:canal'));const cash=s.household.money;
 s=act(s,'towerstart:camp').state;assert.equal(s.household.money,cash);assert.equal(s.economy!.tower!.progress,0);assert.throws(()=>act(s,'towerstart:camp'));
});

test('供货真实扣库存和余粮、跨季到场，现场施工再次消耗而不是查看持有量',()=>{
 let s=fixture();s=act(s,'towerstart:camp').state;
 const x=end(s);assert.equal(x.state.economy!.tower!.progress,0);assert.equal(x.state.economy!.tower!.stock.wood,1);assert.equal(x.state.economy!.goods.wood,23);
 const y=end(x.state);assert.equal(y.state.economy!.tower!.progress,1);assert.ok(y.events.some(e=>e.type==='tower'&&e.operation==='built'&&e.goods.wood===1&&e.goods.food===1));
 const z=end(y.state);assert.equal(z.state.economy!.tower!.floor,1);assert.equal(z.state.economy!.tower!.stock.wood,0);assert.equal(z.state.economy!.tower!.active,false);assert.equal(z.state.economy!.goods.wood,22);
 assert.ok(getAvailableActions(z.state,r).find(a=>a.id==='economy:towerstart:towpath')!.enabled);
});

test('家庭生存优先，不能把仅有口粮运走或在缺粮季通关',()=>{
 const s=fixture();s.household.food=2;s.household.money=0;s.economy!.operations!.food=false;s.economy!.tower!.active=true;s.economy!.tower!.delivery=true;
 const x=end(s);assert.ok(!x.events.some(e=>e.type==='tower'&&e.operation==='sent'&&e.goods.food));assert.ok(x.events.some(e=>e.type==='season-settled'&&e.missing===0));
 const poor=ready(0);poor.household.food=0;poor.household.money=0;poor.economy!.operations!.food=false;poor.economy!.tower!.progress=1;
 const y=end(poor);assert.equal(y.state.economy!.tower!.floor,0);assert.equal(y.state.economy!.tower!.stock.wood,4);
});

test('绳索库存或手工不能冒充作坊运行，真实作坊工作才计有效施工季',()=>{
 const s=ready(1);const x=end(s);assert.equal(x.state.economy!.tower!.progress,0);assert.ok(x.events.some(e=>e.type==='tower'&&e.detail.includes('绳索作坊')));
 s.economy!.workshops!.nodes.rope={active:true,units:1,logistics:1,source:'household',input:2,output:0};s.economy!.goods.fiber=4;
 const y=end(s);assert.equal(y.state.economy!.tower!.progress,1);assert.equal(y.state.economy!.tower!.stock.rope,3);
});

test('季内较早完成的烧造证据保留，但不得跨季重复使用',()=>{
 let s=ready(2);s.economy!.project={good:'ceramics',amount:1,started:0};s=act(s,'finish:project').state;
 assert.ok(s.economy!.tower!.evidence.includes('kiln'));
 const x=end(s);assert.equal(x.state.economy!.tower!.progress,1);const y=end(x.state);assert.equal(y.state.economy!.tower!.progress,1);assert.ok(y.events.some(e=>e.type==='tower'&&e.operation==='waiting'));
});

test('施工泵实际消耗耐用与现场燃料，共用泵被占用或维修时不施工',()=>{
 const s=ready(3);s.economy!.equipment.W03=8;
 const x=end(s);assert.equal(x.state.economy!.equipment.W03,7);assert.equal(x.state.economy!.tower!.stock.wood,3);assert.equal(x.state.economy!.tower!.progress,1);
 const busy=structuredClone(s);busy.economy!.operations!.mine=true;const y=end(busy);assert.equal(y.state.economy!.tower!.progress,0);assert.equal(y.state.economy!.equipment.W03,7);assert.equal(y.state.economy!.tower!.stock.wood,4);
 const repair=structuredClone(s);repair.economy!.shop!.orders.push({kind:'repair',target:'W03',name:'活塞泵',amount:1,due:99});assert.equal(end(repair).state.economy!.tower!.progress,0);
});

test('合龙必须连续协作，失供归零不退材料，真正完成后才胜利',()=>{
 let s=ready(4);s.economy!.equipment={W03:12,T03:12};s.economy!.workers.artisan={kind:'artisan',experience:4,job:'shaft',active:true,project:null};
 s=end(s).state;assert.equal(s.economy!.tower!.progress,1);const used=s.economy!.tower!.stock.valve;
 let paused=act(s,'towerpause:current').state;paused=end(paused).state;assert.equal(paused.economy!.tower!.progress,0);assert.equal(paused.economy!.tower!.stock.valve,used);
 paused=act(paused,'towerstart:canal').state;
 for(let i=0;i<3;i++)paused=end(paused).state;
 assert.equal(paused.economy!.tower!.floor,5);assert.equal(paused.status,'complete');assert.equal(technologyVictory(paused,r)!.won,true);assert.equal(technologyVictory(paused,r)!.mastered.length,0);
 assert.equal(getAvailableActions(paused,r).length,0);
});

test('货运容量有限且按套配齐，自动销售保留施工料，暂停和跨代不丢货',()=>{
 const s=fixture();s.economy!.tower!.active=true;s.economy!.tower!.delivery=true;s.economy!.operations!.sales=true;s.economy!.goods.wood=2;
 const x=end(s);assert.equal(x.events.filter(e=>e.type==='tower'&&e.operation==='sent').length,2);
 let a=structuredClone(act(x.state,'towerpause:current').state);const stock=structuredClone(a.economy!.tower!.stock);a.status='handover';a=act(a,'handover').state;assert.deepEqual(a.economy!.tower!.stock,stock);assert.equal(a.economy!.tower!.floor,0);
 const industrial=ready(2);industrial.economy!.tower!.stock={};industrial.economy!.tower!.delivery=true;industrial.economy!.operations!.sales=true;industrial.economy!.goods.ceramics=2;
 const z=end(industrial);assert.ok(!z.events.some(e=>e.type==='economy-trade'&&e.operation==='sell'&&e.good==='ceramics'));
});

test('边界、旧规则目标冻结、观察隔离与真实新局命令严格重放',async()=>{
 const old=validateRuleset(JSON.parse(await readFile('rulesets/workshop-network.v12.json','utf8')));assert.equal(createInitialState(old,17,'river').economy!.tower,undefined);assert.ok(!getAvailableActions(createInitialState(old,17,'river'),old).some(a=>a.id.includes('tower')));
 assert.throws(()=>validateRuleset({...r,rulesVersion:'0.12.0'}));assert.throws(()=>resolveRuleset(r,{'tower.finalSeasons':1}));
 const {implementation}=await loadCurrentContext();let session=await createSession({runId:'tower-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
 for(const actionId of ['economy:towerstart:camp','economy:end:season','economy:gather:food','economy:end:season','economy:gather:food','economy:end:season'])session=(await submitCommand(session,{commandId:'t'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId})).session;
 assert.equal(session.state.economy!.tower!.floor,1);assert.deepEqual((await replayRecord(session.record,implementation)).state,session.state);
 assert.deepEqual(metrics(session.record,session.state).tower,{completedFloors:1,constructionSeasons:2,interruptions:0,consumed:{food:2,wood:2},won:false});
 const o=observeSession(session);assert.ok(o.game.economy!.towerView);assert.equal('randomState' in o.game,false);assert.equal('seed' in o.game,false);
 const altered=structuredClone(session.record);altered.manifest.ruleset.tower!.transport=3;await assert.rejects(replayRecord(altered,implementation));
});
