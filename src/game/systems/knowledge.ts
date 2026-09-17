import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { Ruleset } from '../ruleset.js';
import type { Subject, Worker } from '../model/economy.js';
import { SUBJECT_NAMES, ALL_TOPICS as TOPICS } from './economy-catalog.js';
import { branchHas } from './branches.js';

export function level(s: GameState, subject: Subject, person = s.household.activePersonId): number {
  return s.economy!.knowledge[person]?.[subject] ?? 0;
}
export function requirements(s: GameState, needs: Partial<Record<Subject, number>>): string[] {
  if (s.economy?.branches) return [];
  return Object.entries(needs).filter(([d, n]) => level(s, d as Subject) < n).map(([d, n]) => `需${SUBJECT_NAMES[d as Subject]}第${n}阶`);
}
export function recordEvidence(s: GameState, subject: Subject, events: GameEvent[], source: string): void {
  if (s.economy?.branches) return;
  const n = level(s, subject) + 1;
  if (n > (s.economy?.modern ? 10 : 6)) return;
  const t = TOPICS.find(topic => topic.subject === subject && topic.level === n)!;
  const list = s.economy!.evidence[s.household.activePersonId] ??= [];
  if (!list.includes(t.id)) {
    list.push(t.id);
    events.push({ type: 'economy-evidence', topic: t.id, source });
  }
}
export function organizationLevel(s: GameState): number {
  if (s.economy?.branches) {
    const o0 = branchHas(s, 'O0'), o1 = branchHas(s, 'O1'), o2 = branchHas(s, 'O2');
    if (o1 && o2) return 3;
    if (o1 || o2) return 2;
    return o0 ? 1 : 0;
  }
  return Math.max(level(s, 'organization'), s.economy!.notes.organization ?? 0);
}
export function wage(_s: GameState, rules: Ruleset, w: Worker): number {
  return rules.economy!.wage + (w.kind === 'laborer' ? 0 : w.kind === 'manager' ? 2 : 1) + (w.experience >= 8 ? 1 : 0);
}
