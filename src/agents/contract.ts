import type { SessionObservation } from '../runtime/session.js';
export interface AgentDecision { revision: number; actionId: string; reason?: string }
export interface Agent {
  readonly id: string;
  readonly kind: 'scripted' | 'llm';
  decide(observation: SessionObservation): AgentDecision | null | Promise<AgentDecision | null>;
}
export const POLICY_NAMES = { subsistence: '维持生活', irrigation: '水利投资', seed: '种源试验', legacy: '培养后代' };
export type PolicyId = keyof typeof POLICY_NAMES;
export const POLICIES = Object.keys(POLICY_NAMES) as PolicyId[];
