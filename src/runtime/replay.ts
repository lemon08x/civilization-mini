import { deepFreeze, isRecord, resolveRuleset, validateRuleset } from '../game/ruleset.js';
import type { Ruleset } from '../game/ruleset.js';
import { canonical, fingerprint } from './records.js';
import type { ImplementationIdentity, RunRecord, Session } from './records.js';
import { createSession, submitCommand, validateCommand } from './session.js';

export async function replayRecord(value: unknown, implementation: ImplementationIdentity): Promise<Session> {
  if (!isRecord(value) || value.format !== 'civilization-mini-run' || value.formatVersion !== 2 || !isRecord(value.manifest) || !Array.isArray(value.entries) || !Array.isArray(value.snapshots) || value.entries.length > 1500) throw new Error('存档格式或长度无效，原文件应保留');
  const record = value as unknown as RunRecord, manifest = record.manifest;
  if (canonical(manifest.implementation) !== canonical(implementation)) throw new Error('规则实现版本或代码指纹不匹配；请使用对应基线或显式迁移');
  const ruleset = validateRuleset(manifest.ruleset);
  if (await fingerprint(ruleset) !== manifest.rulesFingerprint) throw new Error('完整规则配置指纹不匹配');
  let session = await createSession({ runId: manifest.runId, ruleset, implementation, seed: manifest.seed, scenarioId: manifest.scenarioId, agent: manifest.agent });
  if (canonical(session.record.manifest) !== canonical(manifest)) throw new Error('实验清单存在不支持字段或不匹配数据');
  const seenSnapshots = new Set<number>();
  async function verifySnapshots(): Promise<void> {
    for (const snapshot of record.snapshots.filter(s => s.revision === session.record.entries.length)) {
      if (seenSnapshots.has(snapshot.revision) || canonical(snapshot.state) !== canonical(session.state) || snapshot.hash !== await fingerprint(session.state)) throw new Error('快照校验失败');
      seenSnapshots.add(snapshot.revision);
    }
  }
  await verifySnapshots();
  for (const input of record.entries) {
    const command = validateCommand(input.command);
    const next = await submitCommand(session, command);
    if (next.duplicate || canonical(next.session.record.entries.at(-1)) !== canonical(input)) throw new Error('行动轨迹、事件或状态指纹不一致');
    session = next.session;
    await verifySnapshots();
  }
  if (seenSnapshots.size !== record.snapshots.length || !seenSnapshots.has(0)) throw new Error('快照位置无效或缺少初始快照');
  return deepFreeze({ state: session.state, record: structuredClone(record) });
}

export async function importLegacy(value: unknown, base: Ruleset, implementation: ImplementationIdentity, runId: string): Promise<Session> {
  if (await fingerprint(base) !== 'f44b18f47ae16ab9e58e1d8916e04db6a78524fac65e9f63992b600ea977ea0c') throw new Error('旧存档迁移只能使用已冻结的 v1 基线');
  if (!isRecord(value) || value.format !== 'civilization-mini-replay' || value.formatVersion !== 1 || value.rulesVersion !== '0.1.0' || base.rulesVersion !== '0.1.0' || !isRecord(value.config) || !Array.isArray(value.commands) || value.commands.length > 1500) throw new Error('不支持的旧存档，原文件应保留');
  const ruleset = resolveRuleset(base, value.config.overrides ?? {});
  let session = await createSession({ runId, ruleset, implementation, seed: value.config.seed as number, scenarioId: value.config.scenario as string, agent: { kind: 'human', name: 'legacy-import' } });
  for (const item of value.commands) {
    if (!isRecord(item)) throw new Error('旧命令损坏');
    session = (await submitCommand(session, { commandId: `legacy:${item.revision}`, expectedRevision: item.revision, actionId: item.actionId })).session;
  }
  return session;
}

// 显式复制迁移：先以冻结身份核对旧命令、事件和每个快照，仍保留旧农业规则。
export const FROZEN_AGRICULTURE_IMPLEMENTATION: ImplementationIdentity = {
  version: '0.2.0', codeFingerprint: '65650731a61bc387b3bc94a85f87d9db548cb8b3e93de3ccd8752f3cee48b7ee',
};
export async function importRecord(value: unknown, implementation: ImplementationIdentity, runId: string): Promise<Session> {
  if (!isRecord(value) || !isRecord(value.manifest)) throw new Error('存档清单无效');
  const previous = value.manifest.implementation;
  let verified: Session;
  if (canonical(previous) === canonical(implementation)) verified = await replayRecord(value, implementation);
  else {
    if (canonical(previous) !== canonical(FROZEN_AGRICULTURE_IMPLEMENTATION) || await fingerprint(value.manifest.ruleset) !== 'f44b18f47ae16ab9e58e1d8916e04db6a78524fac65e9f63992b600ea977ea0c') throw new Error('没有此历史实现与参数组的迁移方案；请使用对应版本，原档保留');
    verified = await replayRecord(value, FROZEN_AGRICULTURE_IMPLEMENTATION);
  }
  let session = await createSession({ ...verified.record.manifest, implementation, runId });
  for (const entry of verified.record.entries) session = (await submitCommand(session, entry.command)).session;
  return session;
}
