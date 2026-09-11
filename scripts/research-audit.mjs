import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { diagnoseRecord, validateFramework } from '../dist/src/research/knowledge-framework.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const inputs = process.argv.slice(2);
if (!inputs.length || inputs.length > 8) throw new Error('用法：npm run research:audit -- <record.json> [最多 8 个逐局文件]；只读取，不模拟');
const hash = text => createHash('sha256').update(text).digest('hex');
const frameworkText = await readFile(resolve(root,'experiments/frameworks/knowledge.v1.json'),'utf8');
const framework = validateFramework(JSON.parse(frameworkText),JSON.parse(await readFile(resolve(root,'rulesets/social-inheritance.v4.json'),'utf8')));
const runs = [];
// 所有输入成功后才写新文件；历史记录保留原身份，不重放、不迁移、不混合比较。
for (const input of inputs) {
  const absolute = resolve(input), raw = await readFile(absolute,'utf8'), record = JSON.parse(raw);
  if (record.format !== 'civilization-mini-run' || record.formatVersion !== 2 || !record.manifest?.ruleset?.technologies || !Array.isArray(record.entries) || !record.entries.every(e=>Number.isInteger(e.revision) && Array.isArray(e.events) && e.events.every(v=>v && typeof v.type==='string'))) throw new Error(`非有效逐局事件记录：${input}`);
  const diagnosis = diagnoseRecord(record);
  runs.push({source:absolute,sourceSha256:hash(raw),runId:record.manifest.runId,rulesVersion:record.manifest.ruleset.rulesVersion,rulesFingerprint:record.manifest.rulesFingerprint,implementation:record.manifest.implementation,controller:record.manifest.agent, ...diagnosis,
    researchQuestions:framework.questions.filter(q=>q.signals.some(s=>diagnosis.findings.some(f=>f.kind===s && (!f.nodeId || q.nodes.includes(f.nodeId))))).map(q=>({id:q.id,hypothesis:q.hypothesis,probe:q.probe,success:q.success,guardrails:q.guardrails,stop:q.stop}))});
}
const report = {schemaVersion:1,kind:'research-diagnostics',createdAt:new Date().toISOString(),frameworkVersion:framework.version,frameworkSha256:hash(frameworkText),analyzerSha256:hash(await readFile(resolve(root,'dist/src/research/knowledge-framework.js'),'utf8')),verification:'原文件文本分析；未验证哈希链或重放物理结果，不是新的实验。记录中的控制器身份按原声明展示。',decision:'仅产生待调查信号；不自动生成参数候选或采纳修改。不同规则、实现、场景和策略的记录不作汇总比较。',runs};
const output=resolve(root,'experiments/audits',`audit-${Date.now()}-${randomUUID().slice(0,8)}.json`);
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,runs:runs.length,findings:runs.reduce((n,r)=>n+r.findings.length,0),verification:report.verification},null,2));
