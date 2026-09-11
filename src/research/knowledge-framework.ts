import { isRecord } from '../game/ruleset.js';
import type { Ruleset } from '../game/ruleset.js';
import type { RunRecord } from '../runtime/records.js';

export interface KnowledgeNode {
  id: string; name: string; domain: string; status: 'implemented' | 'proposed'; kind: 'method' | 'tradition';
  world: string; access: string; practice: string; application: string; legacy: string; cost: string; question: string;
  required: string[]; alternative: string[]; helpful: string[]; debates: string[];
}
export interface ResearchQuestion {
  id: string; title: string; nodes: string[]; hypothesis: string; signals: string[]; probe: string;
  parameter: string | null; success: string; guardrails: string[]; stop: string;
}
export interface KnowledgeFramework {
  schemaVersion: 1; version: string; baseRulesVersion: string;
  domains: { id: string; name: string }[]; nodes: KnowledgeNode[]; questions: ResearchQuestion[];
}
const list = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === 'string') && new Set(v).size === v.length;
function fields(v: Record<string, unknown>, keys: string[]) { return keys.every(k => typeof v[k] === 'string' && (v[k] as string).trim()); }
export function validateFramework(value: unknown, rules: Ruleset): KnowledgeFramework {
  if (!isRecord(value) || value.schemaVersion !== 1 || !fields(value, ['version', 'baseRulesVersion']) || value.baseRulesVersion !== rules.rulesVersion || !Array.isArray(value.domains) || !Array.isArray(value.nodes) || !Array.isArray(value.questions)) throw new Error('知识框架格式或基线版本不匹配');
  const domains = new Set<string>(), ids = new Set<string>(), questions = new Set<string>();
  for (const d of value.domains) { if (!isRecord(d) || !fields(d, ['id', 'name']) || domains.has(String(d.id))) throw new Error('领域重复或不完整'); domains.add(String(d.id)); }
  for (const n of value.nodes) {
    if (!isRecord(n) || !fields(n, ['id','name','domain','world','access','practice','application','legacy','cost','question']) || ids.has(String(n.id)) || !domains.has(String(n.domain)) || !['implemented','proposed'].includes(String(n.status)) || !['method','tradition'].includes(String(n.kind)) || !['required','alternative','helpful','debates'].every(k => list(n[k]))) throw new Error('节点缺少因果说明或存在重复/无效字段');
    const current = rules.technologies.find(t => t.id === n.id);
    if ((n.status === 'implemented') !== !!current) throw new Error('候选与现行节点状态不匹配');
    if (current && JSON.stringify([n.required,n.alternative,n.helpful]) !== JSON.stringify([current.prerequisites,current.prerequisiteAny??[],current.helpfulPrerequisites??[]])) throw new Error('现行节点依赖与规则不一致');
    ids.add(String(n.id));
  }
  if (!value.nodes.length || rules.technologies.some(n => !ids.has(n.id))) throw new Error('框架遗漏现行节点');
  const framework = structuredClone(value) as unknown as KnowledgeFramework;
  for (const n of framework.nodes) for (const id of [...n.required,...n.alternative,...n.helpful,...n.debates]) if (!ids.has(id) || id === n.id) throw new Error(`无效关系：${n.id} → ${id}`);
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string) { if (visiting.has(id)) throw new Error('解锁依赖成环'); if (visited.has(id)) return; visiting.add(id); const n = framework.nodes.find(n=>n.id===id)!; [...n.required,...n.alternative].forEach(visit); visiting.delete(id); visited.add(id); }
  framework.nodes.forEach(n=>visit(n.id));
  for (const q of framework.questions) {
    if (!isRecord(q) || !fields(q, ['id','title','hypothesis','probe','success','stop']) || questions.has(q.id) || !list(q.nodes) || !q.nodes.length || q.nodes.some(n=>!ids.has(n)) || !list(q.signals) || !list(q.guardrails) || !q.guardrails.length || !(q.parameter===null || typeof q.parameter==='string' && Object.hasOwn(rules.parameterBounds,q.parameter))) throw new Error('研究问题缺少对照、约束或有效节点');
    questions.add(q.id);
  }
  return framework;
}

export interface Diagnostic { kind: string; nodeId?: string; message: string; evidence: { revision: number; eventIndex: number }[] }
// 只在研究层读历史事件；不进入玩家观察，不作因果裁决，不采纳规则。
export function diagnoseRecord(record: RunRecord) {
  const findings: Diagnostic[] = [], studies = new Map<string, Diagnostic>(), mastered = new Set<string>(), touched = new Set<string>();
  const workshops = new Map<string, Diagnostic>(), completed = new Set<string>();
  for (const entry of record.entries) entry.events.forEach((event, eventIndex) => {
    const evidence = { revision: entry.revision, eventIndex };
    if ('nodeId' in event) touched.add(event.nodeId);
    if (event.type === 'studied') { const key = `${event.personId}:${event.nodeId}`; const item = studies.get(key) ?? { kind:'learning-unfinished',nodeId:event.nodeId,message:`${event.personId}有学习记录，窗口内未见掌握；需检查实践、来源和策略。`,evidence:[] }; item.evidence.push(evidence); studies.set(key,item); }
    if (event.type === 'mastered') mastered.add(`${event.personId}:${event.nodeId}`);
    if (event.type === 'workshop-built') workshops.set(event.material,{kind:'workshop-unused',message:`${event.material}设施建成后未见对应批量完工或委托开工；检查观察窗口、材料和策略。`,evidence:[evidence]});
    if (event.type === 'craft-completed' && event.batch && workshops.has(event.recipe as string)) completed.add(event.recipe);
    if (event.type === 'contract-started' && workshops.has(event.material)) completed.add(event.material);
    if (event.type === 'season-settled' && event.missing > 0) findings.push({kind:'food-shortfall',message:`该季缺粮 ${event.missing}；不能仅凭收入判断方案改善。`,evidence:[evidence]});
    if (event.type === 'contract-waiting') findings.push({kind:'contract-waiting',message:`委托等待：${event.reason}；查看原料、订单和工序。`,evidence:[evidence]});
    if (event.type === 'handed-over') findings.push({kind:'legacy-handoff',message:'已发生交接；资产实际使用和职业转换需继续读后代轨迹。',evidence:[evidence]});
  });
  for (const [key,item] of studies) if (!mastered.has(key)) findings.push(item);
  for (const [key,item] of workshops) if (!completed.has(key)) findings.push(item);
  for (const n of record.manifest.ruleset.technologies) if (!touched.has(n.id)) findings.push({kind:'node-unvisited',nodeId:n.id,message:'未见节点相关事件；仅表示覆盖缺口，不证明不可达或无用。',evidence:[]});
  return { findings, touchedNodes:[...touched], totalNodes:record.manifest.ruleset.technologies.length };
}
