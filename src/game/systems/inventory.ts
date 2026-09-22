import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { ALL_GOODS as GOODS } from './economy-catalog.js';

export function amount(s: GameState, id: string): number {
  return s.economy!.goods[id] ?? 0;
}
export function changeGoods(s: GameState, goods: Record<string, number>, sign: number, events: GameEvent[], source: string): void {
  for (const [id, n] of Object.entries(goods)) {
    const next = Math.round((amount(s, id) + n * sign)*1000000)/1000000;
    if (next < 0) throw new Error('实物不足：' + id);
    s.economy!.goods[id] = next;
  }
  events.push({ type: 'economy-goods', source, changes: Object.fromEntries(Object.entries(goods).map(([id, n]) => [id, n * sign])) });
}
export function missingGoods(s: GameState, needs: Record<string, number>): string[] {
  return Object.entries(needs).filter(([id, n]) => amount(s, id) < n).map(([id, n]) => `需${n}${GOODS[id]?.name ?? id}`);
}
export function foodStock(s: GameState): number {
  return Math.round((s.household.food + ['flour', 'wheat', 'soy'].reduce((n, id) => n + amount(s, id), 0))*1000000)/1000000;
}
export function equipped(s: GameState, id: string): boolean {
  return (s.economy!.equipment[id] ?? 0) > 0 && !s.economy?.shop?.orders.some(order => order.kind === 'repair' && order.target === id);
}
export function consumeEquipment(s: GameState, id: string, events: GameEvent[]): void {
  s.economy!.equipment[id]--;
  events.push({ type: 'economy-equipment-used', product: id, remaining: s.economy!.equipment[id] });
}
export function storage(s: GameState): number {
  return s.economy!.shop?.assets.includes('granary')
    ? Math.max(equipped(s, 'S02') ? 14 : equipped(s, 'S01') ? 8 : 4, s.economy!.shopGranaryCapacity ?? 0)
    : equipped(s, 'S02') ? 14 : equipped(s, 'S01') ? 8 : 4;
}
