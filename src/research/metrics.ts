import { actionId } from '../game/model/action.js';
import { activePerson } from '../game/model/state.js';
import type { GameState } from '../game/model/state.js';
import type { GenerationFacts } from '../game/model/events.js';
import type { RunRecord } from '../runtime/records.js';

export function collectStatistics(record: RunRecord) {
  const stats = { foodProduced: 0, foodConsumed: 0, shortfall: 0, earnings: 0, waterUsed: 0, studyActions: 0, teachingActions: 0, researchSamples: 0, learned: [] as { generation: number; turn: number; id: string }[], inherited: [] as { generation: number; mastered: string[]; learning: Record<string, number> }[], actionCounts: {} as Record<string, number> };
  const history: (GenerationFacts & { shortfall: number })[] = [];
  for (const entry of record.entries) for (const event of entry.events) {
    switch (event.type) {
      case 'action-paid': { const id = actionId(event.action); stats.actionCounts[id] = (stats.actionCounts[id] ?? 0) + 1; break; }
      case 'harvest': stats.foodProduced += event.food; stats.waterUsed += event.drawn; break;
      case 'season-settled': stats.foodConsumed += event.consumed; stats.shortfall += event.missing; break;
      case 'income': stats.earnings += event.amount; break;
      case 'studied': stats.studyActions++; break;
      case 'taught': stats.teachingActions++; break;
      case 'trial-sampled': stats.researchSamples++; break;
      case 'mastered': if (event.role === 'active') stats.learned.push({ generation: event.clock.generation, turn: event.clock.turn, id: event.nodeId }); break;
      case 'handed-over': stats.inherited.push({ generation: event.generation, mastered: [...event.mastered], learning: { ...event.learning } }); break;
      case 'generation-ended': history.push({ ...structuredClone(event.facts), shortfall: stats.shortfall }); break;
    }
  }
  return { stats, history };
}
export function metrics(record: RunRecord, state: GameState) {
  const { stats, history } = collectStatistics(record);
  return { status: state.status, completedGenerations: history.length, food: state.household.food, money: state.household.money, foodProduced: stats.foodProduced, foodShortfall: stats.shortfall, waterUsed: stats.waterUsed,
    learnedNodes: [...new Set(stats.learned.map(x => x.id))], lastPersonMastered: [...activePerson(state).mastered], inheritedNodes: stats.inherited.map(x => ({ generation: x.generation, nodes: [...x.mastered] })), archivedNodes: [...state.knowledge.archives], samples: stats.researchSamples, studyActions: stats.studyActions, teachingActions: stats.teachingActions, commands: record.entries.length };
}
export type Metrics = ReturnType<typeof metrics>;
