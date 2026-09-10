import { activePerson, channel, heir, project, seedValue, stock } from './model/state.js';
import type { GameState, Person, TrialProject } from './model/state.js';
import type { Ruleset } from './ruleset.js';
import { accessible, has, studyRequired } from './systems/learning.js';
import { harvestPreview } from './systems/production.js';
import { getAvailableActions } from './game.js';

export function personView(person: Person): Omit<Person, 'id'> {
  return { name: person.name, mastered: [...person.mastered], learning: { ...person.learning }, practices: [...person.practices], insights: [...person.insights] };
}
export function projectView(trial: TrialProject | null) {
  return trial ? { started: trial.started, control: seedValue(trial.control), candidate: seedValue(trial.candidate), samples: structuredClone(trial.samples) } : null;
}
export function getObservation(state: GameState, rules: Ruleset) {
  const person = activePerson(state), child = heir(state), family = state.household, canal = channel(state), scenario = rules.scenarios[state.location.id];
  return {
    rulesVersion: rules.rulesVersion,
    status: state.status,
    scenario: { id: scenario.id, name: scenario.name, description: scenario.text },
    clock: { ...state.clock, generations: rules.parameters.generations, turnsPerGeneration: rules.parameters.turnsPerGeneration },
    ap: state.ap, parameters: structuredClone(rules.parameters),
    world: { ...structuredClone(state.world), teachers: [...state.location.teachers], weather: state.location.weather, rain: state.location.rain, water: state.location.water, weatherName: { dry: '干旱', normal: '平水', wet: '丰水' }[state.location.weather] },
    person: personView(person), heir: personView(child),
    family: { food: family.food, money: family.money, hardship: family.hardship, channel: canal ? { durability: canal.durability } : null, archives: [...state.knowledge.archives], stock: seedValue(stock(state)), candidate: family.candidateId ? seedValue(stock(state, family.candidateId)) : null, project: projectView(project(state)), reports: state.knowledge.reportIds.map(id => projectView(state.projects[id])!) },
    harvest: harvestPreview(state, rules),
    technologies: rules.technologies.map(tech => ({ ...structuredClone(tech), unlocked: state.world.technologies.includes(tech.world), accessible: accessible(state, tech), mastered: has(person, tech.id), studied: person.learning[tech.id] ?? 0, required: studyRequired(rules, person, tech), practicesDone: tech.practices.filter(tag => person.practices.includes(tag)), archived: state.knowledge.archives.includes(tech.id), heirMastered: has(child, tech.id), heirStudied: child.learning[tech.id] ?? 0 })),
    actions: getAvailableActions(state, rules),
  };
}
export type GameObservation = ReturnType<typeof getObservation>;
