export function activePerson(state) { return state.persons[state.household.activePersonId]; }
export function heir(state) { return state.persons[state.household.heirId]; }
export function channel(state) {
    return state.household.assetIds.map(id => state.assets[id]).find((asset) => asset.kind === 'channel') ?? null;
}
export function stock(state, id = state.household.stockId) {
    const asset = state.assets[id];
    if (!asset || asset.kind !== 'seed')
        throw new Error(`种源引用失效：${id}`);
    return asset;
}
export function project(state) {
    return state.household.activeProjectId ? state.projects[state.household.activeProjectId] : null;
}
export function seedValue(value) {
    return { name: value.name, potential: value.potential, tolerance: value.tolerance };
}
export function blankPerson(id, name) { return { id, name, mastered: [], learning: {}, practices: [], insights: [] }; }
export function addUnique(values, value) { if (!values.includes(value))
    values.push(value); }
