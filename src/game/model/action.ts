type BasicActionType = 'cultivate' | 'work' | 'buy-food' | 'sell-food' | 'build-channel' | 'repair-channel' | 'prepare-seed' | 'start-trial' | 'end-turn' | 'handover';
export type GameAction =
  | { type: BasicActionType }
  | { type: 'study' | 'archive' | 'teach'; nodeId: string }
  | { type: 'practice'; nodeId: string; practiceId: string }
  | { type: 'release'; decision: 'keep' | 'adopt' };
export interface ActionCost { ap: number; money: number; food: number }
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
  if (action.type === 'practice') return `practice:${action.nodeId}:${action.practiceId}`;
  if (action.type === 'study' || action.type === 'archive' || action.type === 'teach') return `${action.type}:${action.nodeId}`;
  if (action.type === 'release') return `release:${action.decision}`;
  return action.type;
}
export function parseActionId(id: string): GameAction {
  if (typeof id !== 'string' || id.length > 160) throw new Error('行动 ID 无效');
  const parts = id.split(':');
  const [type, nodeId, practiceId] = parts;
  if (['study', 'archive', 'teach'].includes(type) && parts.length === 2 && nodeId) return { type: type as 'study' | 'archive' | 'teach', nodeId };
  if (type === 'practice' && parts.length === 3 && nodeId && practiceId) return { type, nodeId, practiceId };
  if (type === 'release' && parts.length === 2 && (nodeId === 'keep' || nodeId === 'adopt')) return { type, decision: nodeId };
  if (parts.length === 1 && ['cultivate', 'work', 'buy-food', 'sell-food', 'build-channel', 'repair-channel', 'prepare-seed', 'start-trial', 'end-turn', 'handover'].includes(type)) return { type: type as BasicActionType };
  throw new Error(`未知行动：${id}`);
}
