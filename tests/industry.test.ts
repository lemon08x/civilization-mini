import test from 'node:test';
import assert from 'node:assert/strict';

import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {BRANCH_NODES} from '../src/game/model/branches.js';
import {INDUSTRY_PRODUCTS,SYSTEMS} from '../src/game/model/industry.js';
import {settleIndustry,reservedLabor} from '../src/game/systems/industry.js';
import {getObservation} from '../src/game/observation.js';
import {createSession,observeSession} from '../src/runtime/session.js';
import {rules} from './v27.js';
const fresh=()=>structuredClone(createInitialState(rules,17,'river'));
type State=ReturnType<typeof fresh>;
const offer=(s:State,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;
const act=(s:State,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
const knows=(s:State,...ids:string[])=>s.economy!.branches!.learned[s.household.activePersonId].push(...ids);
function equippedFixture():State{
 const s=fresh();knows(s,...BRANCH_NODES.map(n=>n.id));s.household.money=60;s.household.food=20;
 s.economy!.goods={...s.economy!.goods,wood:20,iron:20,valve:4,seal:4,fiber:2,oil:2};s.economy!.equipment={T03:12,W03:12};
 for(const p of INDUSTRY_PRODUCTS)s.economy!.industry!.products[p.id]={source:'prototype',protocol:true};
 s.economy!.workers.artisan={kind:'artisan',experience:4,job:'rest',active:false,project:null};
 s.economy!.industry!.workers.artisan={timeRemaining:12,energy:8};
 s.economy!.field={...s.economy!.field,crop:'wheat',growth:0,duration:2,moisture:0};s.location.rain=0;s.location.water=3;
 return s;
}
function install(s:State,id:'hand'|'pump'|'shaft',operator:'self'|'artisan'|null='self'){
 s.economy!.industry!.instances[id]={id,commissioned:true,enabled:true,operator};
}

test('三类树前置类型与DAG闭合，版本和参数严格隔离',()=>{
 const graph=new Map<string,string[]>();
 for(const k of BRANCH_NODES)graph.set('K:'+k.id,k.parents.map(id=>'K:'+id));
 for(const p of INDUSTRY_PRODUCTS)graph.set('P:'+p.id,[...p.knowledge.map(id=>'K:'+id),...p.parents.map(id=>'P:'+id)]);
 for(const s of SYSTEMS)graph.set('S:'+s.id,[...s.knowledge.map(id=>'K:'+id),...s.products.map(id=>'P:'+id),...s.systems.map(id=>'S:'+id)]);
 const visit=(id:string,path:string[]=[])=>{assert.ok(graph.has(id));assert.ok(!path.includes(id));for(const p of graph.get(id)!)visit(p,[...path,id]);};for(const id of graph.keys())visit(id);
 assert.throws(()=>validateRuleset({...rules,industry:undefined}));assert.throws(()=>resolveRuleset(rules,{'industry.workerTime':0}));
 assert.equal(resolveRuleset(rules,{'industry.workerTime':10}).industry!.workerTime,10);assert.equal(rules.industry!.workerTime,12);
});

test('产品必须验证前置；外购检验消耗样品，不取得规程',()=>{
 const s=fresh();knows(s,'M0','M1','M2','L0','L2','L3');s.economy!.goods={iron:4,wood:2,valve:2,seal:2};
 assert.match(offer(s,'build:W03').reason,/需验证前置产品/);
 const n=structuredClone(act(s,'inspect:seal').state);assert.equal(n.economy!.goods.seal,1);assert.equal(n.economy!.industry!.products.seal.protocol,false);
 const v=act(n,'inspect:valve').state;assert.equal(v.economy!.goods.valve,1);assert.ok(v.economy!.industry!.products.valve);
 const depleted=structuredClone(v);depleted.economy!.goods.seal=0;assert.ok(depleted.economy!.industry!.products.seal);assert.match(offer(depleted,'build:W03').reason,/密封件/);
});
test('自行制造写入规程，首次泵试抽真实耗水耗材',()=>{
 const s=equippedFixture();delete s.economy!.industry!.products.W03;delete s.economy!.equipment.W03;
 const before=structuredClone(s);const n=act(s,'build:W03').state;
 assert.equal(n.economy!.industry!.products.W03.source,'prototype');assert.equal(n.economy!.industry!.products.W03.protocol,true);
 assert.equal(n.location.water,before.location.water-1);assert.equal(n.economy!.goods.wood,before.economy!.goods.wood-1);
 s.location.water=0;assert.equal(offer(s,'build:W03').enabled,false);assert.throws(()=>act(s,'build:W03'));assert.equal(s.economy!.goods.iron,20);
});
test('系统安装占设备，调试扣一次真实投入，未调试不能安排',()=>{
 let s=equippedFixture();s=structuredClone(act(s,'sysbuild:pump').state);
 assert.equal(offer(s,'sysassign:pump-self').enabled,false);const before=s.location.water;
 s=structuredClone(act(s,'syscommission:pump').state);assert.equal(s.location.water,before-1);assert.ok(s.economy!.industry!.commissioned.includes('pump'));
 assert.equal(offer(s,'syscommission:pump').enabled,false);
 const t=equippedFixture();install(t,'shaft');assert.match(offer(t,'process:shaft').reason,/已安装/);assert.equal(offer(t,'sysbuild:shaft').enabled,false);
});
test('个人任务预留防止双花，取消安排可释放；岗位资格不能用空闲时间替代',()=>{
 const s=equippedFixture();install(s,'shaft');assert.deepEqual(reservedLabor(s),{time:8,energy:6});
 assert.equal(offer(s,'work:local').enabled,false);
 const paused=act(s,'sysrun:shaft').state;assert.ok(offer(paused,'work:local').enabled);
 s.economy!.workers.laborer={kind:'laborer',experience:0,job:'rest',active:false,project:null};s.economy!.industry!.workers.laborer={timeRemaining:12,energy:8};
 assert.match(offer(s,'sysassign:shaft-laborer').reason,/工匠/);
});

test('无需求、缺料、缺钱均不部分扣工资/精力/材料',()=>{
 for(const reason of ['rain','water','money','material']){
  const s=equippedFixture();install(s,'pump','artisan');if(reason==='rain')s.location.rain=2;if(reason==='water')s.location.water=0;if(reason==='money')s.household.money=0;if(reason==='material')s.economy!.goods.wood=0;
  const before=structuredClone(s),events:Parameters<typeof settleIndustry>[1]=[];settleIndustry(s,events);
  assert.deepEqual(s,before);assert.ok(events.some(e=>e.type==='industry'&&e.operation==='waiting'));
 }
});
test('雇员共享时间精力；休息耗时间不收费，工资按实际任务不按系统重复计季费',()=>{
 const s=equippedFixture();install(s,'pump','artisan');install(s,'shaft','artisan');const money=s.household.money;const events:Parameters<typeof settleIndustry>[1]=[];settleIndustry(s,events);
 assert.equal(s.economy!.industry!.workers.artisan.timeRemaining,2);assert.equal(s.economy!.industry!.workers.artisan.energy,1);assert.equal(s.household.money,money-3);assert.equal(s.economy!.goods.shaft,2);
 const r=equippedFixture();install(r,'shaft','artisan');r.economy!.industry!.workers.artisan.energy=3;const re:Parameters<typeof settleIndustry>[1]=[];settleIndustry(r,re);
 assert.equal(r.economy!.industry!.workers.artisan.timeRemaining,0);assert.equal(r.economy!.industry!.workers.artisan.energy,2);assert.equal(r.household.money,58);assert.ok(re.some(e=>e.type==='industry'&&e.operation==='rest'));
});

test('传承保留验证与工匠系统，不复制个人知识；本人岗位暂停',()=>{
 const s=equippedFixture();install(s,'pump','self');install(s,'shaft','artisan');heir(s).vitality!.ageSeasons=72;s.location.rain=2;
 const next=act(act(act(s,'retire:family').state,'end:season').state,'handover').state;
 assert.equal(next.economy!.industry!.instances.pump!.enabled,false);assert.equal(next.economy!.industry!.instances.shaft!.enabled,true);
 assert.ok(next.economy!.industry!.products.shaft.protocol);assert.equal(next.economy!.branches!.learned[next.household.activePersonId].includes('L1'),false);
 assert.ok(offer(next,'process:seal').enabled); // 继承的规程可执行；研发另查个人知识。
});
test('观察不含隐藏状态',async()=>{
 const s=fresh();assert.ok(getObservation(s,rules).economy!.industryView);
 const session=await createSession({runId:'three-trees-test',ruleset:rules,seed:17,scenarioId:'river'});
 const raw=JSON.stringify(observeSession(session).game);for(const secret of ['randomState','lifespanSeasons','constitution'])assert.ok(!raw.includes(secret));
 assert.equal(activePerson(s).vitality!.health,100);
});
