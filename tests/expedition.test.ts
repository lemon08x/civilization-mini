import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createInitialState,transition,getAvailableActions} from '../src/game/game.js';
import {parseActionId} from '../src/game/model/action.js';
import {validateRuleset} from '../src/game/ruleset.js';
import {shopCatalog} from '../src/game/systems/shop.js';
import {economyView} from '../src/game/systems/economy.js';
import {EXPEDITIONS,newAttempt} from '../src/game/systems/expedition.js';
import {createSession,observeSession,submitCommand} from '../src/runtime/session.js';
import {replayRecord} from '../src/runtime/replay.js';
import {loadContext} from '../apps/cli/context.js';
const r=validateRuleset(JSON.parse(await readFile('experiments/agriculture-civilization.v15.json','utf8')));
const modern=validateRuleset(JSON.parse(await readFile('rulesets/modern-grid.v14.json','utf8')));
const fresh=()=>createInitialState(r,17,'river');
const act=(s:ReturnType<typeof fresh>,id:string)=>transition(s,parseActionId(id.startsWith('economy:')||id==='handover'?id:'economy:'+id),r);
const end=(s:ReturnType<typeof fresh>)=>act(s,'end:season');

test('所有环境统一农业资产，现代目录可发展但没有六阶知识和工业设备',()=>{
 const a=fresh();assert.equal(Object.keys(r.scenarios).length,4);
 for(const id of Object.keys(r.scenarios)){const s=createInitialState(r,17,id);assert.deepEqual(s.economy,a.economy);assert.deepEqual(s.household,a.household);}
 assert.deepEqual(a.economy!.equipment,{});assert.deepEqual(a.economy!.knowledge[a.household.activePersonId],{agronomy:1});assert.equal(a.household.food,6);assert.equal(a.household.money,8);
 assert.equal(economyView(a,r).disciplines.flatMap(d=>d.topics).length,60);
 assert.equal(a.economy!.modern!.power,0);assert.equal(a.economy!.tower,undefined);
 assert.equal(createInitialState(modern,17,'canyon').economy!.knowledge['person:1'].mechanics,6);
 assert.throws(()=>validateRuleset({...r,civilization:undefined}));assert.throws(()=>validateRuleset({...modern,civilization:true}));
});
test('副本材料跨季转移与家庭生活预留，买入库存不能替代真实收获',()=>{
 let s=structuredClone(fresh());s.household.food=6;s.economy!.goods.wheat=3;
 s=act(s,'expeditionstart:harvest').state;
 const before=structuredClone(s),x=act(s,'expeditionship:current');s=x.state;
 assert.equal(s.economy!.goods.wheat,0);assert.equal(s.economy!.goods.wood,0);assert.equal(before.economy!.goods.wheat,3);
 assert.equal(s.economy!.expeditions!.attempts.harvest.stock.wheat,undefined);
 assert.throws(()=>act(s,'expeditionship:current'));
 s=end(s).state;s=end(s).state;
 assert.equal(s.economy!.expeditions!.attempts.harvest.stock.wheat,3);assert.equal(s.economy!.expeditions!.attempts.harvest.completed,false);
 const scarce=structuredClone(before);scarce.household.food=0;assert.throws(()=>act(scarce,'expeditionship:current'));
});
test('副本奖励扣除投入后一次发放，教材不直接授予知识，刷新与重放不能重复领奖',async()=>{
 const {implementation}=await loadContext();let session=await createSession({runId:'agriculture-replay',ruleset:r,implementation,seed:17,scenarioId:'river'});
 let rewarded=false;
 for(let i=0;i<30;i++){
   const o=observeSession(session),g=o.game,e=g.economy!,a=e.expeditionView!.attempts.harvest;
   const enabled=(id:string)=>g.actions.find(x=>x.id==='economy:'+id)?.enabled;
   let id='end:season';
   if(!a)id='expeditionstart:harvest';
   else if(a.completed){rewarded=true;break;}
   else if(a.evidence.includes('harvest')&&enabled('expeditionship:current'))id='expeditionship:current';
   else if(!a.evidence.includes('harvest')&&enabled('farm:wheat'))id='farm:wheat';
   else if(e.foodTotal<5&&enabled('gather:food'))id='gather:food';
   session=(await submitCommand(session,{commandId:'a'+session.record.entries.length,expectedRevision:o.revision,actionId:'economy:'+id})).session;
 }
 assert.equal(rewarded,true);const e=session.state.economy!;
 assert.equal(e.expeditions!.supplyLevel,2);assert.ok(e.shop!.books.includes('M02'));assert.equal(e.knowledge[session.state.household.activePersonId].materials,undefined);
 assert.equal(session.record.entries.flatMap(x=>x.events).filter(e=>e.type==='expedition'&&e.operation==='reward').length,1);
 const replayed=await replayRecord(session.record,implementation);assert.deepEqual(replayed.state,session.state);
 assert.ok(!observeSession(session).game.actions.find(a=>a.id==='economy:expeditionstart:harvest')!.enabled);
 assert.equal('seed' in observeSession(session).game,false);assert.equal('randomState' in observeSession(session).game,false);
 const after=end(session.state);assert.equal(after.events.filter(e=>e.type==='expedition'&&e.operation==='reward').length,0);
});
test('副本按自身生产能力开放，不强制完成前置副本，奖励才提高市场供应',()=>{
 const s=structuredClone(fresh());assert.ok(!shopCatalog(s,r).some(x=>x.target==='E01'||x.target==='circuit'||x.target==='copper'));
 s.economy!.knowledge['person:1']={materials:2,heat:1};
 assert.ok(getAvailableActions(s,r).find(a=>a.id==='economy:expeditionstart:kiln')!.enabled);
 assert.equal(s.economy!.expeditions!.attempts.harvest,undefined);
 s.economy!.expeditions!.supplyLevel=10;
 assert.ok(shopCatalog(s,r).some(x=>x.target==='E01'));assert.ok(shopCatalog(s,r).some(x=>x.target==='circuit'));
 for(const f of EXPEDITIONS)for(const n of Object.values(f.kit))assert.ok(n>0);
});
test('当季电子证明不能跨季替代，连续副本暂停不能保留进度逃过条件',()=>{
 const s=structuredClone(fresh()),x=s.economy!.expeditions!;s.household.food=20;
 s.economy!.knowledge['person:1']={mechanics:10,materials:10,organization:10};
 x.selected='smart';x.attempts.smart=newAttempt();const a=x.attempts.smart;a.progress=2;a.stock={controller:3,composite:3,cable:3};a.evidence=['delegated-control'];
 const next=end(s);assert.equal(next.state.economy!.expeditions!.attempts.smart.progress,0);assert.equal(next.state.economy!.expeditions!.attempts.smart.stock.controller,3);assert.ok(!next.events.some(e=>e.type==='expedition'&&e.operation==='reward'));
 const paused=act(s,'expeditionpause:current').state;assert.equal(paused.economy!.expeditions!.attempts.smart.progress,0);
});
test('第三代之后仍可传承，副本完成与奖励资产保留，旧窗口不再阻塞订货',()=>{
 const s=structuredClone(fresh());s.clock.generation=3;s.clock.turn=16;s.clock.absoluteTurn=48;
 s.economy!.expeditions!.attempts.harvest={...newAttempt(),completed:true,active:false};s.economy!.expeditions!.supplyLevel=2;s.economy!.shop!.books.push('M02');
 const x=end(s);assert.equal(x.state.status,'handover');const y=act(x.state,'handover').state;assert.equal(y.clock.generation,4);assert.equal(y.status,'active');assert.equal(y.economy!.expeditions!.attempts.harvest.completed,true);assert.ok(y.economy!.shop!.books.includes('M02'));
});
