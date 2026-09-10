import { activePerson, addUnique, heir } from '../model/state.js';
import type { GameState, Person } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { Ruleset, Technology } from '../ruleset.js';

export const has = (person: Person, id: string): boolean => person.mastered.includes(id);
export const prerequisites = (person: Person, tech: Technology): boolean => tech.prerequisites.every(id => has(person, id));
export const studyRequired = (rules: Ruleset, person: Person, tech: Technology): number => Math.max(1, tech.study * rules.parameters.studyMultiplier - Number(person.insights.includes(tech.id)));
export function techById(rules: Ruleset, id: string): Technology {
  const tech = rules.technologies.find(t => t.id === id);
  if (!tech) throw new Error(`未知科技：${id}`);
  return tech;
}
export function accessible(state: GameState, tech: Technology): boolean {
  return state.world.technologies.includes(tech.world) && (state.location.teachers.includes(tech.id) || state.knowledge.archives.includes(tech.id));
}
export function masterAvailable(state: GameState, person: Person, rules: Ruleset, events: GameEvent[]): void {
  for (const tech of rules.technologies) {
    if (!has(person, tech.id) && prerequisites(person, tech) && (person.learning[tech.id] ?? 0) >= studyRequired(rules, person, tech) && tech.practices.every(tag => person.practices.includes(tag))) {
      addUnique(person.mastered, tech.id);
      events.push({ type: 'mastered', personId: person.id, role: person.id === state.household.activePersonId ? 'active' : 'heir', nodeId: tech.id, clock: { ...state.clock } });
    }
  }
}
export function study(state: GameState, nodeId: string, events: GameEvent[]): void {
  const person = activePerson(state);
  person.learning[nodeId] = (person.learning[nodeId] ?? 0) + 1;
  events.push({ type: 'studied', personId: person.id, nodeId });
}
export function practice(state: GameState, nodeId: string, practiceId: string, events: GameEvent[]): void {
  const person = activePerson(state);
  addUnique(person.practices, practiceId);
  events.push({ type: 'practiced', personId: person.id, nodeId, practiceId });
}
export function teach(state: GameState, nodeId: string, rules: Ruleset, events: GameEvent[]): void {
  const child = heir(state), tech = techById(rules, nodeId);
  const kind = (child.learning[nodeId] ?? 0) < studyRequired(rules, child, tech) ? 'study' : 'practice';
  if (kind === 'study') child.learning[nodeId] = (child.learning[nodeId] ?? 0) + 1;
  else {
    const tag = tech.practices.find(t => !child.practices.includes(t));
    if (!tag) throw new Error('后辈已完成全部实践');
    addUnique(child.practices, tag);
  }
  events.push({ type: 'taught', personId: child.id, nodeId, kind });
  masterAvailable(state, child, rules, events);
}
