import { economyView } from './systems/economy.js';
import { technologyVictory } from './systems/investment.js';
import { productNetworkView } from './systems/product-network.js';
import { activePerson, channel, heir, project, seedValue, stock } from './model/state.js';
import type { GameState, Person, TrialProject } from './model/state.js';
import type { Ruleset } from './ruleset.js';
import { accessible, has, studyRequired } from './systems/learning.js';
import { harvestPreview } from './systems/production.js';
import { getAvailableActions } from './game.js';
import { gatherPreview, spoilagePreview, storageCapacity, technologyOutcomes } from './systems/crafts.js';
import { contractBlocker } from './systems/society.js';
import { developmentView } from './systems/development.js';

export function personView(person: Person): Omit<Person, 'id'> {
  return { name: person.name, mastered: [...person.mastered], learning: { ...person.learning }, practices: [...person.practices], insights: [...person.insights] };
}
export function projectView(trial: TrialProject | null) {
  return trial ? { started: trial.started, control: seedValue(trial.control), candidate: seedValue(trial.candidate), samples: structuredClone(trial.samples) } : null;
}
export function getObservation(state: GameState, rules: Ruleset) {
  const person = activePerson(state), child = heir(state), family = state.household, canal = channel(state), scenario = rules.scenarios[state.location.id];
  return {
    ...(state.productNetwork ? {productNetwork:productNetworkView(state,rules)} : {}),
    ...(state.economy?{economy:economyView(state,rules)}:{}),
    rulesVersion: rules.rulesVersion,
    victory: technologyVictory(state,rules),
    status: state.status,
    scenario: { id: scenario.id, name: scenario.name, description: scenario.text },
    clock: { ...state.clock, generations: rules.parameters.generations, turnsPerGeneration: rules.parameters.turnsPerGeneration },
    ap: state.ap, parameters: structuredClone(rules.parameters),
    world: { ...structuredClone(state.world), teachers: [...state.location.teachers], weather: state.location.weather, rain: state.location.rain, water: state.location.water, weatherName: { dry: '干旱', normal: '平水', wet: '丰水' }[state.location.weather] },
    person: personView(person), heir: personView(child),
    family: { food: family.food, money: family.money, hardship: family.hardship, channel: canal ? { durability: canal.durability } : null, archives: [...state.knowledge.archives], stock: seedValue(stock(state)), candidate: family.candidateId ? seedValue(stock(state, family.candidateId)) : null, project: projectView(project(state)), reports: state.knowledge.reportIds.map(id => projectView(state.projects[id])!) },
    harvest: harvestPreview(state, rules),
    ...(state.development?{development:developmentView(state,rules)}:{}),
    ...(state.society ? { society: { ...structuredClone(state.society), parameters: structuredClone(rules.socialInheritance!), contractsView: (['woodenware', 'pottery'] as const).map(material => ({ material, ...structuredClone(state.society!.contracts[material]), reason: contractBlocker(state, rules, material) })) } } : {}),
    ...(rules.technologyFeedback&&!state.economy ? { technologyOutcomes: technologyOutcomes(state, rules) } : {}),
    ...(state.production ? { production: { ...structuredClone(state.production), parameters: structuredClone(rules.production!.parameters), environment: structuredClone(rules.scenarios[state.location.id].production!), storageCapacity: storageCapacity(state, rules), spoilageAfterConsumption: spoilagePreview(state, rules), gathering: { food: gatherPreview(state, rules, 'food'), wood: gatherPreview(state, rules, 'wood'), clay: gatherPreview(state, rules, 'clay') } } } : {}),
    technologies: (state.economy?[]:rules.technologies).map(tech => ({ ...structuredClone(tech), unlocked: state.world.technologies.includes(tech.world), accessible: accessible(state, tech), mastered: has(person, tech.id), studied: person.learning[tech.id] ?? 0, required: studyRequired(rules, person, tech, state.knowledge.archives), practicesDone: tech.practices.filter(tag => person.practices.includes(tag)), archived: state.knowledge.archives.includes(tech.id), heirMastered: has(child, tech.id), heirStudied: child.learning[tech.id] ?? 0 })),
    actions: getAvailableActions(state, rules),
  };
}
