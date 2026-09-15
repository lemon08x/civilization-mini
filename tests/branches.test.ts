import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,getAvailableActions,transition} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {activePerson,heir} from '../src/game/model/state.js';
import {getObservation} from '../src/game/observation.js';
import {validateRuleset,resolveRuleset} from '../src/game/ruleset.js';
import {BRANCH_NODES,BRANCH_PATHS,branchHas} from '../src/game/systems/branches.js';
import {processBlockers,settleEconomy} from '../src/game/systems/economy.js';
import {processesFor} from '../src/game/systems/economy-catalog.js';
import {cartQuote,shopCatalog} from '../src/game/systems/shop.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
const rules=validateRuleset(JSON.parse(await readFile('rulesets/branch-paths.v18.json','utf8')));
const fresh=()=>structuredClone(createInitialState(rules,17,'river'));
const act=(s:ReturnType<typeof fresh>,id:string)=>transition(s,parseActionId(id==='handover'?id:'economy:'+id),rules);
const offer=(s:ReturnType<typeof fresh>,id:string)=>getAvailableActions(s,rules).find(a=>a.id==='economy:'+id)!;
const know=(s:ReturnType<typeof fresh>,...ids:string[])=>s.economy!.branches!.learned[s.household.activePersonId].push(...ids);

test('共享节点是浅层有向无环树，三路线前置闭合',()=>{
 assert.equal(new Set(BRANCH_NODES.map(n=>n.id)).size,21);
 const depth=(id:string,path:string[]=[]):number=>{assert.ok(!path.includes(id));const n=BRANCH_NODES.find(n=>n.id===id);assert.ok(n);return 1+Math.max(0,...n.parents.map(p=>depth(p,[...path,id])));};
 assert.equal(Math.max(...BRANCH_NODES.map(n=>depth(n.id))),4);
 assert.deepEqual(BRANCH_PATHS.map(p=>p.nodes.length),[9,7,10]);
 for(const p of BRANCH_PATHS)for(const id of p.nodes)for(const parent of BRANCH_NODES.find(n=>n.id===id)!.parents)assert.ok(p.nodes.includes(parent));
 assert.deepEqual(BRANCH_NODES.find(n=>n.id==='O2')!.parents,['O0']);
 assert.deepEqual(BRANCH_NODES.find(n=>n.id==='A3')!.parents,['A0']);
 assert.deepEqual(BRANCH_NODES.find(n=>n.id==='A4')!.parents,['A0']);
});
test('v18参数严格校验，候选不修改基础规则',()=>{
 assert.throws(()=>validateRuleset({...rules,branches:undefined}));
 assert.throws(()=>validateRuleset({...rules,branches:{...rules.branches,extra:1}}));
 assert.throws(()=>resolveRuleset(rules,{'branches.metalStock':21}));
 assert.equal(resolveRuleset(rules,{'branches.metalStock':5}).branches!.metalStock,5);
 assert.equal(rules.branches!.metalStock,6);
});
test('流体与绝缘可独立分支，学习扣样品时间精力，旧等级不解锁',()=>{
 const s=fresh();know(s,'L0','M0');s.economy!.goods.wood=3;
 const a=offer(s,'branchlearn:L2'),next=act(s,'branchlearn:L2').state;
 assert.ok(branchHas(next,'L2'));assert.equal(branchHas(next,'L1'),false);
 assert.equal(next.life!.timeRemaining,s.life!.timeRemaining-a.time!);
 assert.equal(activePerson(next).vitality!.energy,activePerson(s).vitality!.energy-a.energy!);
 assert.equal(next.economy!.goods.clay,s.economy!.goods.clay-1);
 assert.ok(offer(s,'branchlearn:M4').enabled);assert.equal(offer(s,'branchlearn:L6').enabled,false);
 s.economy!.knowledge[s.household.activePersonId]={mechanics:10,materials:10};
 assert.match(offer(s,'build:E01').reason,/发电机系统/);
 assert.equal(offer(s,'study:L08'),undefined);
 assert.throws(()=>act(s,'study:L08'));
});
test('采购渠道真实收费、下季补货；禁止越过渠道买电工材料',()=>{
 const s=fresh(),goods=structuredClone(s.economy!.goods);
 assert.equal(shopCatalog(s,rules).find(i=>i.target==='iron')!.stock,2);
 assert.equal(offer(s,'cartadd:good-copper'),undefined);
 assert.equal(offer(s,'channel:electric').enabled,false);
 know(s,'M0','M4');const n=act(s,'channel:electric').state;
 assert.equal(n.household.money,s.household.money-rules.branches!.electricFee);
 assert.deepEqual(n.economy!.goods,goods);
 assert.equal(shopCatalog(n,rules).find(i=>i.target==='copper')!.stock,0);
 assert.equal(offer(s,'channel:metal').enabled,false);
 const settled=act(n,'end:season').state;
 assert.ok(shopCatalog(settled,rules).find(i=>i.target==='copper')!.stock>0);
});
test('泵需分支与物料，自动灌溉消耗实际水木材和耐用',()=>{
 const s=fresh();know(s,'L0','L2','L3','M0','M1','M2');s.economy!.goods={...s.economy!.goods,iron:2,valve:1,seal:1,wood:4};
 const built=structuredClone(act(s,'build:W03').state);assert.equal(built.economy!.goods.iron,0);
 built.economy!.field={...built.economy!.field,crop:'wheat',growth:0,duration:2,moisture:0};built.location.rain=0;built.location.water=3;
 const noKnowledge=structuredClone(built);const ev:Parameters<typeof settleEconomy>[2]=[];settleEconomy(noKnowledge,rules,ev);
 assert.equal(ev.some(e=>e.type==='economy-farm'&&e.operation==='pump'),false);
 know(built,'A1');const events:Parameters<typeof settleEconomy>[2]=[];settleEconomy(built,rules,events);
 assert.ok(events.some(e=>e.type==='economy-farm'&&e.operation==='pump'));
 assert.equal(built.economy!.goods.wood,3);assert.equal(built.economy!.equipment.W03,rules.economy!.durability-1);
});
test('真实试制后雇员规程跨代保留，个人知识不自动复制',()=>{
 const s=fresh();know(s,'M0','M1','L0','L1');s.economy!.goods.wood=4;s.economy!.goods.iron=3;s.economy!.equipment.T03=12;
 const worker={kind:'artisan' as const,experience:4,job:'shaft' as const,active:true,project:null};const recipe=processesFor(s).find(p=>p.id==='shaft')!;
 assert.match(processBlockers(s,recipe,worker).join('；'),/试制/);
 const trial=structuredClone(act(s,'process:shaft').state);assert.ok(trial.economy!.branches!.protocols.includes('shaft'));
 trial.economy!.goods.wood=4;trial.economy!.equipmentUsed={};trial.household.food=20;trial.household.money=30;
 trial.economy!.workers.artisan=worker;heir(trial).vitality!.ageSeasons=72;
 const next=structuredClone(act(act(act(trial,'retire:family').state,'end:season').state,'handover').state);
 assert.equal(branchHas(next,'L1'),false);assert.ok(next.economy!.branches!.protocols.includes('shaft'));
 next.economy!.goods.wood=4;next.economy!.goods.iron=4;next.economy!.equipmentUsed={};
 assert.deepEqual(processBlockers(next,recipe,worker),[]);
});
test('家学免样品仍需学习和前置；教导一次只传一节点',()=>{
 const s=fresh();know(s,'M0','M1');const taught=act(s,'branchteach:M0').state;
 assert.ok(branchHas(taught,'M0',s.household.heirId));assert.equal(branchHas(taught,'M1',s.household.heirId),false);
 s.economy!.branches!.archives.push('M4');s.economy!.goods.wood=0;s.economy!.goods.clay=0;
 assert.ok(offer(s,'branchlearn:M4').enabled);
 s.economy!.branches!.learned[s.household.activePersonId]=['A0'];assert.equal(offer(s,'branchlearn:M4').enabled,false);
});
test('发电与本地负载无需旧等级，配电前后真实扣能且有设备占用',()=>{
 const s=fresh();know(s,'L0','L1','L4','L5','L6','M0','M1','M4','M5');s.economy!.equipment={E01:12,U06:12};s.economy!.modern!.enabled=['E01'];s.economy!.goods.wheat=8;s.location.water=3;
 const n=structuredClone(act(s,'energize:now').state);assert.equal(n.economy!.modern!.power,6);assert.equal(n.location.water,2);assert.equal(n.economy!.equipment.E01,11);
 assert.equal(offer(n,'process:mill').time,4);know(n,'L7');assert.equal(offer(n,'process:mill').time,1);
 const milled=act(n,'process:mill').state;assert.equal(milled.economy!.modern!.power,5);assert.equal(milled.economy!.goods.wheat,6);assert.equal(milled.economy!.goods.flour,3);
 assert.equal(offer(milled,'process:mill').enabled,false);
});
test('失去采购条件的遗留清单可观察和清空，不能部分结账',()=>{
 const s=fresh();s.economy!.shop!.cart={'device-E01':1,'good-wood':1};
 assert.match(cartQuote(s,rules).blockers.join('；'),/清空清单/);
 assert.doesNotThrow(()=>getObservation(s,rules));assert.equal(offer(s,'checkout:cart').enabled,false);
 assert.deepEqual(act(s,'clearcart:all').state.economy!.shop!.cart,{});
});
test('分支命令严格重放且观察不泄露随机与寿命',async()=>{
 const implementation={version:'0.18.0',codeFingerprint:'a'.repeat(64)};
 let s=await createSession({runId:'branch-replay',ruleset:rules,implementation,seed:17,scenarioId:'river'});
 s=(await submitCommand(s,{commandId:'1',expectedRevision:0,actionId:'economy:branchlearn:M0'})).session;
 const replayed=await replayRecord(s.record,implementation);assert.deepEqual(observeSession(replayed),observeSession(s));
 const view=JSON.stringify(observeSession(s).game);for(const secret of ['randomState','lifespanSeasons','constitution'])assert.ok(!view.includes(secret));
});
