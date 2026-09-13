import { activePerson } from '../model/state.js';
export function initialDevelopment() {
    return { experience: {}, goods: { supplies: 0, ceramicParts: 0, mechanisms: 0, fieldTools: 0, labTools: 0, precisionParts: 0, findings: 0 }, designs: { pottery: 0, woodwork: 0, agriculture: 0, science: 0 }, project: null, fieldDurability: 0, labDurability: 0, tradeRemaining: 0, ordersRemaining: 0 };
}
export function experience(state, domain, personId = state.household.activePersonId) { return state.development?.experience[personId]?.[domain] ?? 0; }
export function skillLevel(state, rules, domain, personId = state.household.activePersonId) { return Math.floor(Math.sqrt(experience(state, domain, personId) / rules.development.parameters.experienceStep)); }
export function gainExperience(state, domain, amount, events, personId = state.household.activePersonId) {
    const d = state.development;
    const skills = d.experience[personId] ??= {};
    skills[domain] = (skills[domain] ?? 0) + amount;
    events.push({ type: 'experience-gained', personId, domain, amount, total: skills[domain] });
}
export function developFromEvents(state, events, rules) {
    if (!state.development)
        return;
    for (const e of [...events]) {
        if (e.type === 'craft-completed')
            gainExperience(state, e.recipe === 'pottery' ? 'pottery' : 'woodwork', rules.householdProgress ? 2 : 1, events);
        if (e.type === 'harvest' && e.food > 0)
            gainExperience(state, 'agriculture', 1, events);
    }
}
export const DEVELOPMENT_RECIPES = [
    { id: 'supplies', name: '加工工坊补给', domain: 'agriculture', method: 'agronomy', level: 0, wood: 1, clay: 0, food: 4, inputs: {}, output: 'supplies', amount: 2, wait: 0, benefit: '把农业余粮加工为试验与精密生产的消耗品，也可交付订单。' },
    { id: 'ceramicParts', name: '烧制陶质构件', domain: 'pottery', method: 'ceramic-engineering', level: 1, wood: 2, clay: 2, food: 0, inputs: {}, output: 'ceramicParts', amount: 2, wait: 1, benefit: '构件进入传动机构、实验器具和精密器件，陶作不止造罐。' },
    { id: 'mechanisms', name: '装配传动机构', domain: 'woodwork', method: 'mechanics', level: 1, wood: 3, clay: 0, food: 0, inputs: { ceramicParts: 1 }, output: 'mechanisms', amount: 1, wait: 0, benefit: '机械部件用于农具和科学器具；也可对外交付。' },
    { id: 'fieldTools', name: '制作农业设备', domain: 'woodwork', method: 'mechanics', level: 1, wood: 1, clay: 0, food: 0, inputs: { mechanisms: 1 }, output: 'fieldTools', amount: 1, wait: 0, benefit: '装备后在有收成的耕作中多得1粮，消耗耐用度，余粮可继续加工。' },
    { id: 'labTools', name: '制造实验器具', domain: 'science', method: 'experimentation', level: 0, wood: 1, clay: 0, food: 0, inputs: { ceramicParts: 1, mechanisms: 1 }, output: 'labTools', amount: 1, wait: 0, benefit: '装备后每次实验多留下一份研究记录，消耗耐用度。' },
    { id: 'precisionParts', name: '制作精密器件', domain: 'pottery', method: 'precision-engineering', level: 2, wood: 1, clay: 0, food: 0, inputs: { ceramicParts: 2, mechanisms: 1, supplies: 1 }, output: 'precisionParts', amount: 1, wait: 1, benefit: '陶作与机械成果共同形成高阶订单商品，跨季校验后交付。' },
];
export const DEVELOPMENT_PRICES = { supplies: 3, ceramicParts: 5, mechanisms: 8, fieldTools: 10, labTools: 12, precisionParts: 18 };
export function developmentView(state, rules) {
    const d = state.development;
    const personId = activePerson(state).id;
    return { ...structuredClone(d), parameters: structuredClone(rules.development.parameters), skills: ['pottery', 'woodwork', 'agriculture', 'science'].map(domain => ({ domain, experience: experience(state, domain), level: skillLevel(state, rules, domain), next: rules.development.parameters.experienceStep * (skillLevel(state, rules, domain) + 1) ** 2, heirExperience: experience(state, domain, state.household.heirId), personId })), recipes: DEVELOPMENT_RECIPES.map(r => ({ ...r, ...(rules.productNetwork && r.id === 'precisionParts' ? { benefit: '精密器件分流到校准仪、提水泵和控温窑，开启新的研究、取水和回收操作；也可交付订单。' } : {}), woodCost: Math.max(r.wood ? 1 : 0, r.wood - Math.min(1, d.designs[r.domain])), outputAmount: r.amount + Math.floor(d.designs[r.domain] / 2) })) };
}
