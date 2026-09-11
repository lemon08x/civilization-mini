import type { Ruleset } from '../game/ruleset.js';
import { isRecord, resolveRuleset } from '../game/ruleset.js';
import type { Agent } from '../agents/contract.js';
import type { ImplementationIdentity, Session } from '../runtime/records.js';
import { createSession, observeSession, submitCommand, validateRunId } from '../runtime/session.js';
import { metrics } from './metrics.js';
import type { Metrics } from './metrics.js';

export interface ExperimentSpec {
  schemaVersion: 1;
  id: string;
  seeds: number[];
  scenarios: string[];
  agents: string[];
  variants: { id: string; parameters: Record<string, number> }[];
  maxActions: number;
  decisionTimeoutMs: number;
}
export interface RunResult { runId: string; variant: string; scenario: string; agent: string; controller: 'scripted' | 'llm'; seed: number; metrics: Metrics; rulesFingerprint: string }
export function validateExperiment(value: unknown, rules: Ruleset, agents: Record<string, Agent>): ExperimentSpec {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.seeds) || !Array.isArray(value.scenarios) || !Array.isArray(value.agents) || !Array.isArray(value.variants) || !Number.isInteger(value.maxActions) || (value.maxActions as number) < 1 || (value.maxActions as number) > 1500 || !Number.isInteger(value.decisionTimeoutMs) || (value.decisionTimeoutMs as number) < 1 || (value.decisionTimeoutMs as number) > 60000) throw new Error('实验计划格式无效');
  validateRunId(value.id);
  if (!value.seeds.length || value.seeds.length > 10 || value.seeds.some(seed => !Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) || new Set(value.seeds).size !== value.seeds.length) throw new Error('实验种子无效或重复');
  for (const id of value.scenarios) if (typeof id !== 'string' || !Object.hasOwn(rules.scenarios, id)) throw new Error('实验场景不存在');
  for (const id of value.agents) if (typeof id !== 'string' || !Object.hasOwn(agents, id)) throw new Error('实验玩家不存在');
  for (const variant of value.variants) { if (!isRecord(variant)) throw new Error('候选无效'); validateRunId(variant.id); resolveRuleset(rules, variant.parameters); }
  if (new Set(value.variants.map(v => v.id)).size !== value.variants.length || new Set(value.scenarios).size !== value.scenarios.length || new Set(value.agents).size !== value.agents.length) throw new Error('实验配置重复');
  const count = value.seeds.length * value.scenarios.length * value.agents.length * value.variants.length;
  if (count < 1 || count > 64) throw new Error('每批实验限 1—64 局；请拆分为可检查的小批次');
  return structuredClone(value) as unknown as ExperimentSpec;
}
async function decide(agent: Agent, session: Session, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([Promise.resolve().then(() => agent.decide(observeSession(session))), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`代理决策超时：${agent.id}`)), timeoutMs); })]);
  } finally { if (timer) clearTimeout(timer); }
}
export async function runExperiment(spec: ExperimentSpec, rules: Ruleset, implementation: ImplementationIdentity, agents: Record<string, Agent>, saveRun: (session: Session, result: RunResult) => Promise<void>): Promise<RunResult[]> {
  validateExperiment(spec, rules, agents);
  const results: RunResult[] = [];
  for (const variant of spec.variants) for (const scenario of spec.scenarios) for (const agentId of spec.agents) for (const seed of spec.seeds) {
    const agent = agents[agentId], runId = `run-${String(results.length + 1).padStart(4, '0')}`;
    let session = await createSession({ runId, ruleset: resolveRuleset(rules, variant.parameters), implementation, seed, scenarioId: scenario, agent: { kind: agent.kind, name: agent.id } });
    while (!['complete', 'ended'].includes(session.state.status)) {
      if (session.record.entries.length >= spec.maxActions) throw new Error(`实验 ${runId} 达到行动上限`);
      const decision = await decide(agent, session, spec.decisionTimeoutMs);
      if (!decision) throw new Error(`实验 ${runId} 未结束但代理未提供行动`);
      const result = await submitCommand(session, { commandId: `decision:${session.record.entries.length}`, expectedRevision: decision.revision, actionId: decision.actionId, ...(decision.reason === undefined ? {} : { reason: decision.reason }) });
      session = result.session;
    }
    const result: RunResult = { runId, variant: variant.id, scenario, agent: agentId, controller: agent.kind, seed, metrics: metrics(session.record, session.state), rulesFingerprint: session.record.manifest.rulesFingerprint };
    await saveRun(session, result); results.push(result);
  }
  return results;
}
