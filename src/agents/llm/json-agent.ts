import type { Agent, AgentDecision } from '../contract.js';
import type { SessionObservation } from '../../runtime/session.js';
import { isRecord } from '../../game/ruleset.js';

export const PLAYER_INSTRUCTION = '你是家庭经营者。只从给出的 enabled=true 行动中选一个，返回 JSON {revision, actionId, reason}。不要假设未来天气，不要声明已经获得资源。规则执行器负责全部结果。';
export function parseDecision(text: string, observation: SessionObservation): AgentDecision {
  if (text.length > 8000) throw new Error('模型响应过长');
  const value: unknown = JSON.parse(text);
  if (!isRecord(value) || Object.keys(value).some(key => !['revision', 'actionId', 'reason'].includes(key)) || value.revision !== observation.revision || typeof value.actionId !== 'string' || !(value.reason === undefined || typeof value.reason === 'string' && value.reason.length <= 2000)) throw new Error('模型行动格式或版本无效');
  if (!observation.game.actions.some(action => action.id === value.actionId && action.enabled)) throw new Error('模型选择了不可执行行动');
  return { revision: observation.revision, actionId: value.actionId, ...(value.reason === undefined ? {} : { reason: value.reason as string }) };
}
// 由调用方显式提供模型调用函数。没有默认供应商、凭据、网络请求或自动重试。
export class JsonAgent implements Agent {
  readonly kind = 'llm' as const;
  constructor(readonly id: string, private readonly complete: (instruction: string, observation: string) => Promise<string>) {}
  async decide(observation: SessionObservation): Promise<AgentDecision | null> {
    if (!observation.game.actions.some(a => a.enabled)) return null;
    return parseDecision(await this.complete(PLAYER_INSTRUCTION, JSON.stringify(observation)), observation);
  }
}
