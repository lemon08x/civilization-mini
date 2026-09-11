import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { resolve, sep, extname } from 'node:path';
import { isRecord } from '../../src/game/ruleset.js';
import type { Ruleset } from '../../src/game/ruleset.js';
import { fingerprint } from '../../src/runtime/records.js';
import { validateFramework } from '../../src/research/knowledge-framework.js';
import type { KnowledgeFramework } from '../../src/research/knowledge-framework.js';

export type ProposalStatus = 'pending_validation' | 'pending_decision' | 'accepted' | 'rejected' | 'deferred';
export interface Proposal {
  schemaVersion: 1; id: string; title: string; kind: 'parameter' | 'mechanism' | 'strategy' | 'interface';
  status: ProposalStatus; origin: string; question: string; hypothesis: string; counterEvidence: string;
  baseVersion: string; targetVersion: string | null; experiments: string[]; evidence: string[];
  changes: { subject: string; before: unknown; after: unknown; configPath?: string }[];
  result: string; sideEffects: string; decision: string; adoptedVersion: string | null;
}
export interface ExperimentReview {
  id: string; files: string[]; rulesVersion: string | null; implementation: unknown;
  rulesFingerprint: string | null; controllers: string[]; conditions: unknown;
  parameterChanges: { variant: string; path: string; before: unknown; after: unknown }[];
  results: unknown[]; issues: string[];
}
export function configValue(value: unknown, path: string): unknown {
  let current = value;
  for (const key of path.split('.')) { if (!isRecord(current) || !Object.hasOwn(current, key)) return null; current = current[key]; }
  return current;
}
export function validateProposal(value: unknown): Proposal {
  if (!isRecord(value) || value.schemaVersion !== 1) throw new Error('提案 schemaVersion 应为 1');
  for (const key of ['id', 'title', 'origin', 'question', 'hypothesis', 'counterEvidence', 'baseVersion', 'result', 'sideEffects', 'decision']) if (typeof value[key] !== 'string' || !(value[key] as string).trim()) throw new Error(`提案缺少 ${key}`);
  if (!/^[a-z0-9-]+$/.test(value.id as string)) throw new Error('提案 ID 无效');
  if (!['parameter', 'mechanism', 'strategy', 'interface'].includes(String(value.kind)) || !['pending_validation', 'pending_decision', 'accepted', 'rejected', 'deferred'].includes(String(value.status))) throw new Error('提案分类或状态无效');
  for (const key of ['targetVersion', 'adoptedVersion']) if (value[key] !== null && typeof value[key] !== 'string') throw new Error(`提案缺少 ${key}`);
  if (value.status === 'accepted' && !value.adoptedVersion) throw new Error('已接受提案需声明实际生效版本');
  for (const key of ['experiments', 'evidence']) if (!Array.isArray(value[key]) || !(value[key] as unknown[]).every(x => typeof x === 'string')) throw new Error(`提案 ${key} 应为列表`);
  if (!Array.isArray(value.changes) || !value.changes.length || !value.changes.every(c => isRecord(c) && typeof c.subject === 'string' && Object.hasOwn(c, 'before') && Object.hasOwn(c, 'after') && (c.configPath === undefined || typeof c.configPath === 'string'))) throw new Error('提案需要明确的前后差异');
  return structuredClone(value) as unknown as Proposal;
}

// 只允许读取规则、文档及研究产物；规范化路径后再校验真实路径，拒绝越界链接。
export async function readReviewFile(root: string, path: string): Promise<string> {
  if (!/^(docs\/|rulesets\/|experiments\/|artifacts\/experiments\/)/.test(path) || !['.md', '.json'].includes(extname(path)) || path.includes('\\') || path.split('/').some(p => !p || p === '.' || p === '..')) throw new Error('不允许读取此研究文件');
  const prefix = path.startsWith('artifacts/') ? 'artifacts/experiments' : path.split('/')[0];
  const allowed = resolve(root, prefix), actual = await realpath(resolve(root, path));
  if (!actual.startsWith(allowed + sep)) throw new Error('研究文件越界');
  if ((await stat(actual)).size > 8_000_000) throw new Error('研究文件超过 8 MB，请在本地查看');
  return readFile(actual, 'utf8');
}
export async function loadResearchIndex(root: string, rules?: Ruleset) {
  const issues: string[] = [], proposals: (Proposal & { file: string })[] = [], experiments: ExperimentReview[] = [];
  async function names(path: string): Promise<string[]> {
    try { return (await readdir(resolve(root, path), { withFileTypes: true })).filter(e => !e.isSymbolicLink()).map(e => e.name).sort(); }
    catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') issues.push(`${path}：${(e as Error).message}`); return []; }
  }
  for (const name of (await names('experiments/proposals')).filter(n => n.endsWith('.proposal.json'))) {
    const file = `experiments/proposals/${name}`;
    try { const p = validateProposal(JSON.parse(await readReviewFile(root, file))); if (proposals.some(x => x.id === p.id)) throw new Error('提案 ID 重复'); proposals.push({ ...p, file }); }
    catch (e) { issues.push(`${file}：${(e as Error).message}`); }
  }
  for (const id of await names('artifacts/experiments')) {
    const directory = `artifacts/experiments/${id}`;
    if (!(await stat(resolve(root, directory))).isDirectory()) continue;
    const files = (await names(directory)).filter(n => /\.(md|json)$/.test(n)).map(n => `${directory}/${n}`);
    for (const name of await names(`${directory}/runs`)) if (name.endsWith('.json')) files.push(`${directory}/runs/${name}`);
    const item: ExperimentReview = { id, files, rulesVersion: null, implementation: null, rulesFingerprint: null, controllers: [], conditions: null, parameterChanges: [], results: [], issues: [] };
    async function json(file: string): Promise<unknown> { try { return JSON.parse(await readReviewFile(root, `${directory}/${file}`)); } catch (e) { item.issues.push(`${file}：${(e as Error).message}`); return null; } }
    const metaFile = files.includes(`${directory}/manifest.json`) ? 'manifest.json' : files.includes(`${directory}/plan.json`) ? 'plan.json' : null;
    if (metaFile) {
      const meta = await json(metaFile);
      if (isRecord(meta)) {
        const rules = meta.baseRuleset ?? meta.ruleset;
        item.implementation = meta.implementation ?? null;
        if (isRecord(rules)) { item.rulesVersion = typeof rules.rulesVersion === 'string' ? rules.rulesVersion : null; item.rulesFingerprint = await fingerprint(rules); }
        const spec = isRecord(meta.spec) ? meta.spec : meta;
        item.conditions = { seeds: spec.seeds ?? spec.seed, scenarios: spec.scenarios ?? spec.scenario, agents: spec.agents, variants: spec.variants, maxActions: spec.maxActions, policyFingerprint: meta.policyFingerprint };
        if (typeof meta.controller === 'string') item.controllers.push(meta.controller);
        if (Array.isArray(spec.variants)) for (const v of spec.variants) if (isRecord(v) && isRecord(v.parameters)) for (const [key, after] of Object.entries(v.parameters)) item.parameterChanges.push({ variant: String(v.id), path: key, before: configValue(rules, key.startsWith('production.') ? `production.parameters.${key.slice(11)}` : `parameters.${key}`), after });
      }
    } else item.issues.push('缺少实验清单，不能确认运行条件');
    const resultsFile = files.includes(`${directory}/metrics.json`) ? 'metrics.json' : files.includes(`${directory}/results.json`) ? 'results.json' : null;
    if (resultsFile) { const result = await json(resultsFile); if (Array.isArray(result)) { item.results = result.filter(isRecord); if (item.results.length !== result.length) item.issues.push('部分结果不是对象，已标记无效并排除显示'); } else item.issues.push('结果应为数组'); }
    else item.issues.push('没有结果文件；可能未完成或失败');
    for (const row of item.results) if (isRecord(row) && typeof row.controller === 'string') item.controllers.push(row.controller);
    item.controllers = [...new Set(item.controllers)];
    experiments.push(item);
  }
  const known = new Set(experiments.map(e => e.id));
  for (const p of proposals) {
    for (const id of p.experiments) if (!known.has(id)) issues.push(`提案 ${p.id} 引用的实验不存在：${id}`);
    for (const file of p.evidence) try { await readReviewFile(root, file); } catch (e) { issues.push(`提案 ${p.id} 的证据不可读取：${file}（${(e as Error).message}）`); }
  }
  let framework: KnowledgeFramework | null = null;
  if (rules) try { framework = validateFramework(JSON.parse(await readReviewFile(root,'experiments/frameworks/knowledge.v1.json')),rules); } catch(e) { issues.push(`知识框架：${(e as Error).message}`); }
  const audits = (await names('experiments/audits')).filter(n=>n.endsWith('.json')).map(n=>`experiments/audits/${n}`);
  return { proposals, experiments: experiments.reverse(), issues, framework, audits };
}
export function parameterRows(rules: Ruleset) {
  return [
    ...Object.entries(rules.parameters).map(([key, value]) => ({ key, value, bounds: rules.parameterBounds[key as keyof typeof rules.parameters], editable: true })),
    ...Object.entries(rules.production?.parameters ?? {}).map(([key, value]) => ({ key: `production.${key}`, value, bounds: rules.production!.parameterBounds[key as keyof NonNullable<Ruleset['production']>['parameters']], editable: true })),
    ...['technologyFeedback', 'socialInheritance'].flatMap(group => Object.entries((rules as unknown as Record<string, Record<string, number>>)[group] ?? {}).map(([key, value]) => ({ key: `${group}.${key}`, value, bounds: null, editable: false }))),
  ];
}
