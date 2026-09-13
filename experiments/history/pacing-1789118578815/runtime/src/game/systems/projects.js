import { activePerson, addUnique, channel, project, seedValue, stock } from '../model/state.js';
import { harvestPreview } from './production.js';
import { has } from './learning.js';
export function prepareCandidate(state, rules, events) {
    const id = `seed:candidate-${Object.keys(state.assets).length}`;
    state.assets[id] = { id, kind: 'seed', name: '耐旱留选种源', potential: Math.max(1, rules.parameters.cropPotential - 1), tolerance: 1 };
    state.household.assetIds.push(id);
    state.household.candidateId = id;
    events.push({ type: 'candidate-prepared', assetId: id });
}
export function startTrial(state, events) {
    if (!state.household.candidateId)
        throw new Error('缺少候选种源');
    const id = `trial:${Object.keys(state.projects).length + 1}`;
    state.projects[id] = { id, kind: 'seed-trial', status: 'active', started: state.clock.absoluteTurn, control: seedValue(stock(state)), candidate: seedValue(stock(state, state.household.candidateId)), samples: [] };
    state.household.activeProjectId = id;
    events.push({ type: 'trial-started', projectId: id });
}
export function sampleTrial(state, rules, events) {
    const trial = project(state);
    if (!trial)
        return;
    const sample = { season: state.clock.absoluteTurn, weather: state.location.weather, control: harvestPreview(state, rules, trial.control).gross, candidate: harvestPreview(state, rules, trial.candidate).gross, irrigation: has(activePerson(state), 'allocation') ? '配水' : (channel(state)?.durability ?? 0) > 0 ? '渠道' : '雨养' };
    trial.samples.push(sample);
    events.push({ type: 'trial-sampled', projectId: trial.id, sample: structuredClone(sample), count: trial.samples.length, target: rules.parameters.trialSeasons });
    if (trial.samples.length >= rules.parameters.trialSeasons) {
        trial.status = 'complete';
        state.knowledge.reportIds.push(trial.id);
        state.household.activeProjectId = null;
        addUnique(activePerson(state).practices, 'trial-completed');
        events.push({ type: 'trial-completed', projectId: trial.id });
    }
}
export function selectStock(state, decision, events) {
    if (!state.household.candidateId)
        throw new Error('缺少候选种源');
    if (decision === 'adopt')
        state.household.stockId = state.household.candidateId;
    state.household.candidateId = null;
    addUnique(activePerson(state).practices, 'stock-release');
    events.push({ type: 'stock-selected', decision, assetId: state.household.stockId });
}
