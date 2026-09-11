type BasicActionType = 'cultivate' | 'work' | 'buy-food' | 'sell-food' | 'build-channel' | 'repair-channel' | 'prepare-seed' | 'start-trial' | 'end-turn' | 'handover';
import type { Material, Recipe } from './production.js';
export type GameAction =
  | { type: BasicActionType }
  | { type: 'gather'; resource: 'food' | 'wood' | 'clay' }
  | { type: 'craft'; recipe: Recipe }
  | { type: 'build-workshop' | 'craft-batch'; material: 'woodenware' | 'pottery' }
  | { type: 'entrust' | 'pause-contract' | 'buy-good'; material: 'woodenware' | 'pottery' }
  | { type: 'share'; nodeId: string }
  | { type: 'finish-craft' }
  | { type: 'sell-good' | 'install-storage'; material: 'woodenware' | 'pottery' }
  | { type: 'buy-method'; nodeId: string }
  | { type: 'study' | 'archive' | 'teach'; nodeId: string }
  | { type: 'practice'; nodeId: string; practiceId: string }
  | { type: 'release'; decision: 'keep' | 'adopt' };
export interface ActionCost { ap: number; money: number; food: number; materials?: Partial<Record<Material, number>> }
export interface ActionOffer extends ActionCost {
  id: string;
  action: GameAction;
  label: string;
  group: string;
  enabled: boolean;
  reason: string;
  description: string;
}
export function actionId(action: GameAction): string {
  if (action.type === 'entrust' || action.type === 'pause-contract' || action.type === 'buy-good') return `${action.type}:${action.material}`;
  if (action.type === 'share') return `share:${action.nodeId}`;
  if (action.type === 'gather') return `gather:${action.resource}`;
  if (action.type === 'craft') return `craft:${action.recipe}`;
  if (action.type === 'sell-good' || action.type === 'install-storage' || action.type === 'build-workshop' || action.type === 'craft-batch') return `${action.type}:${action.material}`;
  if (action.type === 'buy-method') return `buy-method:${action.nodeId}`;
  if (action.type === 'practice') return `practice:${action.nodeId}:${action.practiceId}`;
  if (action.type === 'study' || action.type === 'archive' || action.type === 'teach') return `${action.type}:${action.nodeId}`;
  if (action.type === 'release') return `release:${action.decision}`;
  return action.type;
}
export function parseActionId(id: string): GameAction {
  if (typeof id !== 'string' || id.length > 160) throw new Error('行动 ID 无效');
  const parts = id.split(':');
  const [type, nodeId, practiceId] = parts;
  if ((type === 'entrust' || type === 'pause-contract' || type === 'buy-good') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type, material: nodeId as 'woodenware' | 'pottery' };
  if (type === 'share' && parts.length === 2 && nodeId) return { type, nodeId };
  if (type === 'finish-craft' && parts.length === 1) return { type };
  if (type === 'gather' && parts.length === 2 && ['food', 'wood', 'clay'].includes(nodeId)) return { type, resource: nodeId as 'food' | 'wood' | 'clay' };
  if (type === 'craft' && parts.length === 2 && ['woodenware', 'pottery', 'gather-tool'].includes(nodeId)) return { type, recipe: nodeId as Recipe };
  if ((type === 'build-workshop' || type === 'craft-batch') && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type, material: nodeId as 'woodenware' | 'pottery' };
  if (['sell-good', 'install-storage'].includes(type) && parts.length === 2 && ['woodenware', 'pottery'].includes(nodeId)) return { type: type as 'sell-good' | 'install-storage', material: nodeId as 'woodenware' | 'pottery' };
  if (type === 'buy-method' && parts.length === 2 && nodeId) return { type, nodeId };
  if (['study', 'archive', 'teach'].includes(type) && parts.length === 2 && nodeId) return { type: type as 'study' | 'archive' | 'teach', nodeId };
  if (type === 'practice' && parts.length === 3 && nodeId && practiceId) return { type, nodeId, practiceId };
  if (type === 'release' && parts.length === 2 && (nodeId === 'keep' || nodeId === 'adopt')) return { type, decision: nodeId };
  if (parts.length === 1 && ['cultivate', 'work', 'buy-food', 'sell-food', 'build-channel', 'repair-channel', 'prepare-seed', 'start-trial', 'end-turn', 'handover'].includes(type)) return { type: type as BasicActionType };
  throw new Error(`未知行动：${id}`);
}
