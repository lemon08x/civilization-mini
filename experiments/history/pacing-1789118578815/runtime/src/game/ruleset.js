export function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function strings(value) { return Array.isArray(value) && value.every(v => typeof v === 'string'); }
export function deepFreeze(value) {
    if (value && typeof value === 'object' && !Object.isFrozen(value)) {
        Object.freeze(value);
        Object.values(value).forEach(deepFreeze);
    }
    return value;
}
const parameterKeys = ['actionsPerTurn', 'turnsPerGeneration', 'generations', 'initialFood', 'initialMoney', 'foodPerTurn', 'workIncome', 'foodPrice', 'cropPotential', 'channelCost', 'channelDurability', 'repairCost', 'trialCost', 'trialSeasons', 'trialLandCost', 'archiveCost', 'studyCost', 'trainingCost', 'studyMultiplier', 'hardshipLimit'];
export function validateRuleset(value) {
    if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.id !== 'string' || typeof value.rulesVersion !== 'string' || !isRecord(value.parameters) || !isRecord(value.parameterBounds) || !isRecord(value.scenarios) || !Array.isArray(value.technologies) || !strings(value.worldTechnologies) || !isRecord(value.practiceNames))
        throw new Error('规则配置格式不完整');
    if (!['0.1.0', '0.2.0', '0.3.0', '0.4.0', '0.5.0', '0.6.0', '0.7.0'].includes(value.rulesVersion) || (value.rulesVersion !== '0.1.0') !== (value.production !== undefined))
        throw new Error('规则版本与生产机制不匹配');
    if (value.rulesVersion !== '0.1.0' && !isRecord(value.production))
        throw new Error('新规则必须提供完整生产配置');
    if (['0.3.0', '0.4.0', '0.5.0', '0.6.0', '0.7.0'].includes(value.rulesVersion) !== (value.technologyFeedback !== undefined))
        throw new Error('科技反馈机制与规则版本不匹配');
    if ((['0.4.0', '0.5.0', '0.6.0', '0.7.0'].includes(value.rulesVersion)) !== (value.socialInheritance !== undefined))
        throw new Error('社会传承机制与规则版本不匹配');
    if (value.socialInheritance !== undefined && (!isRecord(value.socialInheritance) || !integerFields(value.socialInheritance, ['wage', 'goodsCapacity', 'archiveDiscount']) || Object.values(value.socialInheritance).some(n => n < 1)))
        throw new Error('社会传承配置无效');
    if (value.technologyFeedback !== undefined && (!isRecord(value.technologyFeedback) || !integerFields(value.technologyFeedback, ['buildActions', 'workbenchWood', 'kilnWood', 'kilnClay']) || Object.values(value.technologyFeedback).some(n => n < 1) || value.technologyFeedback.buildActions > value.parameters.actionsPerTurn))
        throw new Error('科技反馈设施配置无效');
    if (Object.keys(value.parameters).length !== parameterKeys.length || Object.keys(value.parameterBounds).length !== parameterKeys.length)
        throw new Error('规则参数集合不匹配');
    for (const key of parameterKeys) {
        const bound = value.parameterBounds[key], number = value.parameters[key];
        if (!Array.isArray(bound) || bound.length !== 2 || !bound.every(Number.isInteger) || bound[0] > bound[1] || !Number.isInteger(number) || number < bound[0] || number > bound[1])
            throw new Error(`参数无效：${key}`);
    }
    const p = value.parameters;
    if (p.actionsPerTurn < 2 || p.turnsPerGeneration < 1 || p.generations < 1 || p.foodPerTurn < 1 || p.foodPrice < 1 || p.trialSeasons < 2 || p.studyMultiplier < 1)
        throw new Error('时间、资源或学习参数违反基本约束');
    if (!Object.keys(value.scenarios).length)
        throw new Error('规则至少需要一个场景');
    for (const [id, scenario] of Object.entries(value.scenarios)) {
        if (!isRecord(scenario) || scenario.id !== id || typeof scenario.name !== 'string' || typeof scenario.text !== 'string' || ![scenario.drought, scenario.wet, scenario.water].every(Number.isInteger) || scenario.drought < 0 || scenario.wet < 0 || scenario.drought + scenario.wet > 100 || scenario.water < 0)
            throw new Error(`场景无效：${id}`);
    }
    const ids = new Set();
    for (const node of value.technologies) {
        if (!isRecord(node) || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || typeof node.branch !== 'string' || typeof node.world !== 'string' || !value.worldTechnologies.includes(node.world) || !strings(node.prerequisites) || !strings(node.practices) || !node.practices.length || !Number.isInteger(node.study) || node.study < 1 || typeof node.benefit !== 'string' || typeof node.practiceText !== 'string' || !(node.insight === null || typeof node.insight === 'string'))
            throw new Error('科技定义无效或 ID 重复');
        for (const tag of node.practices)
            if (typeof value.practiceNames[tag] !== 'string')
                throw new Error(`实践名称缺失：${tag}`);
        ids.add(node.id);
    }
    // 当前规则实现只支持这些领域方法；新增因果机制需代码版本，而非注入脚本。
    for (const id of ['observation', 'survey', 'ditch', 'allocation', 'selection', 'trial', 'stabilize'])
        if (!ids.has(id))
            throw new Error(`缺少规则实现需要的节点：${id}`);
    if ((['0.5.0', '0.6.0', '0.7.0'].includes(value.rulesVersion)) !== (value.development !== undefined))
        throw new Error('持续成长机制与规则版本不匹配');
    if ((['0.6.0', '0.7.0'].includes(value.rulesVersion)) !== (value.productNetwork === true) || (value.productNetwork !== undefined && value.productNetwork !== true))
        throw new Error('产品网络与规则版本不匹配');
    if ((value.rulesVersion === '0.7.0') !== (value.householdProgress === true) || (value.householdProgress !== undefined && value.householdProgress !== true))
        throw new Error('家庭进展机制与规则版本不匹配');
    if (value.development !== undefined) {
        const d = value.development;
        const keys = ['experienceStep', 'equipmentDurability', 'marketSupply', 'experimentFood', 'mentorFood', 'tradeSpread'];
        if (!isRecord(d) || !integerFields(d.parameters, keys) || !isRecord(d.parameterBounds) || Object.keys(d.parameterBounds).length !== keys.length)
            throw new Error('成长参数集合无效');
        for (const key of keys) {
            const b = d.parameterBounds[key], n = d.parameters[key];
            if (!Array.isArray(b) || b.length !== 2 || !b.every(Number.isInteger) || b[0] < 1 || b[1] > 20 || b[0] > b[1] || n < b[0] || n > b[1])
                throw new Error('成长参数边界无效');
        }
        for (const id of ['agronomy', 'ceramic-engineering', 'mechanics', 'experimentation', 'precision-engineering'])
            if (!ids.has(id))
                throw new Error('缺少工业科学节点');
    }
    const rules = structuredClone(value);
    if (rules.production)
        validateProduction(rules);
    else if (rules.technologies.some(t => t.prerequisiteAny || t.helpfulPrerequisites) || Object.values(rules.scenarios).some(s => s.production))
        throw new Error('旧规则不能注入新生产机制');
    const visiting = new Set(), visited = new Set();
    function visit(id) {
        if (visiting.has(id))
            throw new Error(`前置成环：${id}`);
        if (visited.has(id))
            return;
        const node = rules.technologies.find(n => n.id === id);
        if (!node)
            throw new Error(`前置不存在：${id}`);
        for (const optional of [node.prerequisiteAny, node.helpfulPrerequisites])
            if (optional !== undefined && (!strings(optional) || !optional.length || new Set(optional).size !== optional.length))
                throw new Error('知识依赖列表无效');
        visiting.add(id);
        [...node.prerequisites, ...(node.prerequisiteAny ?? []), ...(node.helpfulPrerequisites ?? [])].forEach(visit);
        visiting.delete(id);
        visited.add(id);
    }
    rules.technologies.forEach(n => visit(n.id));
    return deepFreeze(rules);
}
export function resolveRuleset(base, overrides = {}) {
    if (!isRecord(overrides))
        throw new Error('候选参数必须是 JSON 对象');
    const parameters = { ...base.parameters };
    const production = base.production ? structuredClone(base.production) : undefined;
    const development = base.development ? structuredClone(base.development) : undefined;
    for (const [key, value] of Object.entries(overrides)) {
        if (development && key.startsWith('development.')) {
            const name = key.slice(12);
            if (!Object.hasOwn(development.parameterBounds, name))
                throw new Error('未知成长参数');
            const [min, max] = development.parameterBounds[name];
            if (!Number.isInteger(value) || value < min || value > max)
                throw new Error('成长参数超出范围');
            development.parameters[name] = value;
            continue;
        }
        if (production && key.startsWith('production.')) {
            const name = key.slice('production.'.length);
            if (!Object.hasOwn(production.parameterBounds, name))
                throw new Error(`未知参数：${key}`);
            const [min, max] = production.parameterBounds[name];
            if (!Number.isInteger(value) || value < min || value > max)
                throw new Error(`参数超出范围：${key}`);
            production.parameters[name] = value;
            continue;
        }
        if (!Object.hasOwn(base.parameterBounds, key))
            throw new Error(`未知参数：${key}`);
        const [min, max] = base.parameterBounds[key];
        if (!Number.isInteger(value) || value < min || value > max)
            throw new Error(`参数超出范围：${key}`);
        parameters[key] = value;
    }
    return validateRuleset({ ...base, parameters, ...(development ? { development } : {}), ...(production ? { production } : {}) });
}
const productionKeys = ['gatherFood', 'gatherWood', 'gatherClay', 'baseStorage', 'woodenStorage', 'potteryStorage', 'spoilDivisor', 'toolDurability', 'toolBonus', 'woodRecipeCost', 'potteryClayCost', 'potteryFuelCost', 'woodenwarePrice', 'potteryPrice', 'methodPrice'];
function integerFields(value, keys) {
    return isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Number.isInteger(value[key]) && value[key] >= 0 && value[key] <= 100);
}
function validateProduction(rules) {
    const p = rules.production;
    if (!isRecord(p) || !integerFields(p.parameters, productionKeys) || !isRecord(p.parameterBounds) || Object.keys(p.parameterBounds).length !== productionKeys.length)
        throw new Error('生产参数集合无效');
    for (const key of productionKeys) {
        const range = p.parameterBounds[key], value = p.parameters[key];
        if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] < 1 || range[1] > 100 || range[0] > range[1] || value < range[0] || value > range[1])
            throw new Error(`生产参数边界无效：${key}`);
    }
    for (const id of ['resource-observation', 'woodworking', 'controlled-fire', 'pottery', 'storage'])
        if (!rules.technologies.some(t => t.id === id))
            throw new Error(`缺少生产节点：${id}`);
    for (const scenario of Object.values(rules.scenarios)) {
        const s = scenario.production;
        if (!isRecord(s) || !integerFields(s.stocks, ['wildFood', 'timber', 'clay']) || !integerFields(s.recovery, ['wildFood', 'timber']) || !integerFields(s.market, ['food', 'jobs', 'woodenware', 'pottery', 'methods']) || !strings(s.teachers) || !strings(s.imports))
            throw new Error(`场景生产条件无效：${scenario.id}`);
        if (s.recovery.wildFood > s.stocks.wildFood || s.recovery.timber > s.stocks.timber)
            throw new Error('资源恢复超过容量');
        for (const id of [...s.teachers, ...s.imports])
            if (!rules.technologies.some(t => t.id === id))
                throw new Error(`未知教学来源：${id}`);
    }
}
