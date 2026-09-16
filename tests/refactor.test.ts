import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, relative } from 'node:path';
import { loadContext, projectRoot } from '../apps/cli/context.js';
import { createSession, submitCommand, observeSession } from '../src/runtime/session.js';
import { importLegacy, replayRecord } from '../src/runtime/replay.js';
import { FileRunStore } from '../src/runtime/file-store.js';
import { resolveRuleset } from '../src/game/ruleset.js';
import { collectStatistics, metrics } from '../src/research/metrics.js';
import type { Session } from '../src/runtime/records.js';

const { legacyBase: base, implementation } = await loadContext();
const fixture = JSON.parse(await readFile(join(projectRoot, 'tests/fixtures/legacy-v1.json'), 'utf8')) as { cases: { name: string; replay: {config: {seed: number; scenario: string; overrides: object}; commands: {revision: number; actionId: string}[]}; snapshots: unknown[] }[] };
const fresh = () => createSession({runId:'test', ruleset:base, implementation, seed:17, scenarioId:'river'});
function projection(session: Session) {
  const {status,clock,ap,world,person,heir,family,harvest,actions} = observeSession(session).game;
  return {status,clock,ap,world,person,heir,family,harvest,actions:actions.map(({id,ap,money,food,enabled,reason})=>({id,ap,money,food,enabled,reason})), ...collectStatistics(session.record), metrics:metrics(session.record,session.state)};
}
for (const item of fixture.cases) test(`旧规则逐步一致：${item.name}`, async()=>{
  let session=await createSession({runId:item.name,ruleset:resolveRuleset(base,item.replay.config.overrides),implementation,seed:item.replay.config.seed,scenarioId:item.replay.config.scenario});
  assert.deepEqual(projection(session),item.snapshots[0]);
  for(const command of item.replay.commands){
    session=(await submitCommand(session,{commandId:`legacy:${command.revision}`,expectedRevision:command.revision,actionId:command.actionId})).session;
    assert.deepEqual(projection(session),item.snapshots[command.revision+1],`revision ${command.revision+1}`);
  }
  assert.deepEqual((await replayRecord(session.record,implementation)).state,session.state);
  assert.deepEqual((await importLegacy(item.replay,base,implementation,item.name)).state,session.state);
});
test('命令幂等、过期拒绝、输入冻结与观察隔离',async()=>{
 const initial=await fresh(), command={commandId:'one',expectedRevision:0,actionId:'work'};
 const next=(await submitCommand(initial,command)).session;
 assert.equal(initial.state.ap,3); assert.ok(Object.isFrozen(initial.state.household));
 assert.equal((await submitCommand(next,command)).duplicate,true);
 await assert.rejects(submitCommand(next,{...command,actionId:'cultivate'}));
 await assert.rejects(submitCommand(next,{...command,commandId:'two'}));
 await assert.rejects(submitCommand(initial,{...command,actionId:'build-channel'}));
 const observation=JSON.stringify(observeSession(next));
 assert.ok(!observation.includes('randomState'));assert.ok(!observation.includes('codeFingerprint'));
});
test('篡改轨迹、配置、快照和实现指纹均拒绝',async()=>{
 const session=(await submitCommand(await fresh(),{commandId:'one',expectedRevision:0,actionId:'work'})).session;
 for(const mutate of [
  (s: typeof session.record)=>{s.entries[0].stateHash='broken';},
  (s: typeof session.record)=>{s.manifest.ruleset.parameters.initialFood++;},
  (s: typeof session.record)=>{s.snapshots[0].state.ap++;},
  (s: typeof session.record)=>{s.manifest.implementation.version='9.0.0';},
 ]){const copy=structuredClone(session.record);mutate(copy);await assert.rejects(replayRecord(copy,implementation));}
 assert.throws(()=>resolveRuleset(base,{unknownParameter:1}));
});
test('文件保存保留历史，拒绝覆盖、重复提交和路径穿越',async()=>{
 const root=await mkdtemp(join(tmpdir(),'civilization-mini-test-')),store=new FileRunStore(root,implementation);
 await store.create(await fresh());await assert.rejects(store.create(await fresh()));
 const command={commandId:'one',expectedRevision:0,actionId:'work'};
 await store.submit('test',command);assert.equal((await store.submit('test',command)).duplicate,true);
 assert.equal((await store.load('test')).record.entries.length,1);
 assert.equal(JSON.parse(await readFile(join(root,'test/history/0.json'),'utf8')).entries.length,0);
 await assert.rejects(store.load('../test'));
});
test('领域层和运行层依赖边界',async()=>{
 for(const layer of ['game','runtime','present']){
  const root=join(projectRoot,'src',layer);
  for(const file of (await readdir(root,{recursive:true})).filter(f=>f.endsWith('.ts'))){
   const source=await readFile(join(root,file),'utf8');
   for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)){
    const target=relative(projectRoot,resolve(dirname(join(root,file)),match[1])).replaceAll('\\','/');
    assert.ok(!/^(src\/(research|agents)|apps)\//.test(target),`${layer}/${file}: ${match[1]}`);
    if(layer==='game')assert.ok(!/runtime|node:|src\/present/.test(match[1]) && !target.startsWith('src/present/'));
    if(layer==='runtime')assert.ok(!target.startsWith('src/present/'),`${layer}/${file}: ${match[1]}`);
    if(layer==='present')assert.ok(!target.startsWith('src/game/'),`${layer}/${file}: ${match[1]}`);
   }
  }
 }
});
test('库存与供粮不再进入工业循环依赖',async()=>{
 const root=join(projectRoot,'src/game/systems');
 const files=(await readdir(root)).filter(f=>f.endsWith('.ts'));
 const imports=new Map<string,string[]>();
 for(const file of files){
  const source=await readFile(join(root,file),'utf8');
  const deps=[...source.matchAll(/from\s+'\.\/([^']+)\.js'/g)].map(m=>m[1]+'.ts').filter(dep=>files.includes(dep));
  imports.set(file,deps);
 }
 function reaches(start:string,goal:string,seen=new Set<string>()):boolean{
  if(seen.has(start))return false;
  seen.add(start);
  return (imports.get(start)??[]).some(dep=>dep===goal||reaches(dep,goal,seen));
 }
 assert.equal(reaches('inventory.ts','industry.ts'),false);
 assert.equal(reaches('inventory.ts','economy.ts'),false);
 assert.equal(reaches('social-food.ts','industry.ts'),false);
 assert.equal(reaches('industry.ts','economy.ts'),false);
 assert.equal(reaches('agriculture.ts','economy.ts'),false);
 assert.equal(reaches('knowledge.ts','economy.ts'),false);
});
