export interface Parameters {
  actionsPerTurn: number; turnsPerGeneration: number; generations: number;
  initialFood: number; initialMoney: number; foodPerTurn: number; workIncome: number;
  foodPrice: number; cropPotential: number; channelCost: number; channelDurability: number;
  repairCost: number; trialCost: number; trialSeasons: number; trialLandCost: number;
  archiveCost: number; studyCost: number; trainingCost: number; studyMultiplier: number; hardshipLimit: number;
}
export interface Scenario { id: string; name: string; text: string; drought: number; wet: number; water: number }
export interface Technology {
  id: string; name: string; branch: string; world: string; prerequisites: string[];
  study: number; practices: string[]; benefit: string; insight: string | null; practiceText: string;
}
export interface Ruleset {
  schemaVersion: 1;
  id: string;
  rulesVersion: string;
  parameters: Parameters;
  parameterBounds: Record<keyof Parameters, [number, number]>;
  scenarios: Record<string, Scenario>;
  technologies: Technology[];
  worldTechnologies: string[];
  practiceNames: Record<string, string>;
}
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every(v => typeof v === 'string'); }
export function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(deepFreeze);
  }
  return value;
}

const parameterKeys = ['actionsPerTurn', 'turnsPerGeneration', 'generations', 'initialFood', 'initialMoney', 'foodPerTurn', 'workIncome', 'foodPrice', 'cropPotential', 'channelCost', 'channelDurability', 'repairCost', 'trialCost', 'trialSeasons', 'trialLandCost', 'archiveCost', 'studyCost', 'trainingCost', 'studyMultiplier', 'hardshipLimit'];
export function validateRuleset(value: unknown): Ruleset {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.id !== 'string' || typeof value.rulesVersion !== 'string' || !isRecord(value.parameters) || !isRecord(value.parameterBounds) || !isRecord(value.scenarios) || !Array.isArray(value.technologies) || !strings(value.worldTechnologies) || !isRecord(value.practiceNames)) throw new Error('规则配置格式不完整');
  if (Object.keys(value.parameters).length !== parameterKeys.length || Object.keys(value.parameterBounds).length !== parameterKeys.length) throw new Error('规则参数集合不匹配');
  for (const key of parameterKeys) {
    const bound = value.parameterBounds[key], number = value.parameters[key];
    if (!Array.isArray(bound) || bound.length !== 2 || !bound.every(Number.isInteger) || bound[0] > bound[1] || !Number.isInteger(number) || (number as number) < bound[0] || (number as number) > bound[1]) throw new Error(`参数无效：${key}`);
  }
  const p = value.parameters;
  if ((p.actionsPerTurn as number) < 2 || (p.turnsPerGeneration as number) < 1 || (p.generations as number) < 1 || (p.foodPerTurn as number) < 1 || (p.foodPrice as number) < 1 || (p.trialSeasons as number) < 2 || (p.studyMultiplier as number) < 1) throw new Error('时间、资源或学习参数违反基本约束');
  if (!Object.keys(value.scenarios).length) throw new Error('规则至少需要一个场景');
  for (const [id, scenario] of Object.entries(value.scenarios)) {
    if (!isRecord(scenario) || scenario.id !== id || typeof scenario.name !== 'string' || typeof scenario.text !== 'string' || ![scenario.drought, scenario.wet, scenario.water].every(Number.isInteger) || (scenario.drought as number) < 0 || (scenario.wet as number) < 0 || (scenario.drought as number) + (scenario.wet as number) > 100 || (scenario.water as number) < 0) throw new Error(`场景无效：${id}`);
  }
  const ids = new Set<string>();
  for (const node of value.technologies) {
    if (!isRecord(node) || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || typeof node.branch !== 'string' || typeof node.world !== 'string' || !value.worldTechnologies.includes(node.world) || !strings(node.prerequisites) || !strings(node.practices) || !node.practices.length || !Number.isInteger(node.study) || (node.study as number) < 1 || typeof node.benefit !== 'string' || typeof node.practiceText !== 'string' || !(node.insight === null || typeof node.insight === 'string')) throw new Error('科技定义无效或 ID 重复');
    for (const tag of node.practices) if (typeof value.practiceNames[tag] !== 'string') throw new Error(`实践名称缺失：${tag}`);
    ids.add(node.id);
  }
  // 当前规则实现只支持这些领域方法；新增因果机制需代码版本，而非注入脚本。
  for (const id of ['observation', 'survey', 'ditch', 'allocation', 'selection', 'trial', 'stabilize']) if (!ids.has(id)) throw new Error(`缺少规则实现需要的节点：${id}`);
  const rules = structuredClone(value) as unknown as Ruleset;
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`前置成环：${id}`);
    if (visited.has(id)) return;
    const node = rules.technologies.find(n => n.id === id);
    if (!node) throw new Error(`前置不存在：${id}`);
    visiting.add(id); node.prerequisites.forEach(visit); visiting.delete(id); visited.add(id);
  }
  rules.technologies.forEach(n => visit(n.id));
  return deepFreeze(rules);
}
export function resolveRuleset(base: Ruleset, overrides: unknown = {}): Ruleset {
  if (!isRecord(overrides)) throw new Error('候选参数必须是 JSON 对象');
  const parameters = { ...base.parameters };
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(base.parameterBounds, key)) throw new Error(`未知参数：${key}`);
    const [min, max] = base.parameterBounds[key as keyof Parameters];
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`参数超出范围：${key}`);
    parameters[key as keyof Parameters] = value as number;
  }
  return validateRuleset({ ...base, parameters });
}
