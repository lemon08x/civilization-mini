import {ELECTRIC_BOUNDS,type ElectricRules} from './model/electric.js';
import type { EraRules } from './model/eras.js';
import type { SocialFoodRules } from './model/social-food.js';
import type { RenewalRules } from './model/renewal.js';
import type { IndustryRules } from './model/industry.js';
import type { BranchRules } from './model/branches.js';
import { LIFE_BOUNDS, type LifeRules } from './model/life.js';
import { TOWER_BOUNDS,type TowerRules } from './model/tower.js';
import { WORKSHOP_BOUNDS, type WorkshopRules } from './model/workshop.js';
import { OPERATIONS_BOUNDS } from './model/operations.js';
import type { OperationsRules } from './model/operations.js';
import { SHOP_BOUNDS } from './model/shop.js';
import type { ShopRules } from "./model/shop.js";
import type { DevelopmentRules } from './model/development.js';
import type { ProductionParameters, ProductionRules, ProductionScenario } from './model/production.js';
import { applyCatalogOverlay, type CatalogOverlay } from './systems/economy-catalog.js';
export interface Parameters {
  actionsPerTurn: number; turnsPerGeneration: number; generations: number;
  initialFood: number; initialMoney: number; foodPerTurn: number; workIncome: number;
  foodPrice: number; cropPotential: number; channelCost: number; channelDurability: number;
  repairCost: number; trialCost: number; trialSeasons: number; trialLandCost: number;
  archiveCost: number; studyCost: number; trainingCost: number; studyMultiplier: number; hardshipLimit: number;
}
export interface Scenario { id: string; name: string; text: string; drought: number; wet: number; water: number; production?: ProductionScenario }
export interface Technology {
  id: string; name: string; branch: string; world: string; prerequisites: string[];
  study: number; practices: string[]; benefit: string; insight: string | null; practiceText: string;
  prerequisiteAny?: string[];
  helpfulPrerequisites?: string[];
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
  production?: ProductionRules;
  development?: DevelopmentRules;
  productNetwork?: true;
  householdProgress?: true;
  modern?: true;
  civilization?: true;
  householdLineage?: true;
  life?: LifeRules;
  renewal?: RenewalRules;
  socialFood?: SocialFoodRules;
  eras?: EraRules;
  electric?: ElectricRules;
  branches?:BranchRules;
  industry?:IndustryRules;
  tower?: TowerRules;
  workshops?: WorkshopRules;
  operations?: OperationsRules;
  shop?: ShopRules;
  economy?: {wage:number;hireCost:number;durability:number};
  passiveInvestment?: { victoryPercent: number; reportPrice: number };
  technologyFeedback?: { buildActions: number; workbenchWood: number; kilnWood: number; kilnClay: number };
  socialInheritance?: { wage: number; goodsCapacity: number; archiveDiscount: number };
  catalogs: CatalogOverlay;
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
  if (value.rulesVersion !== '0.27.0') throw new Error('只支持规则 0.27.0');
  if (!isRecord(value.production)) throw new Error('必须提供完整生产配置');
  if (['0.3.0', '0.4.0', '0.5.0', '0.6.0', '0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion) !== (value.technologyFeedback !== undefined)) throw new Error('科技反馈机制与规则版本不匹配');
  if ((['0.4.0','0.5.0', '0.6.0', '0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion)) !== (value.socialInheritance !== undefined)) throw new Error('社会传承机制与规则版本不匹配');
  if (value.socialInheritance !== undefined && (!isRecord(value.socialInheritance) || !integerFields(value.socialInheritance, ['wage', 'goodsCapacity', 'archiveDiscount']) || Object.values(value.socialInheritance).some(n => (n as number) < 1))) throw new Error('社会传承配置无效');
  if (value.technologyFeedback !== undefined && (!isRecord(value.technologyFeedback) || !integerFields(value.technologyFeedback, ['buildActions', 'workbenchWood', 'kilnWood', 'kilnClay']) || Object.values(value.technologyFeedback).some(n => (n as number) < 1) || (value.technologyFeedback.buildActions as number) > (value.parameters.actionsPerTurn as number))) throw new Error('科技反馈设施配置无效');
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
  if(!value.economy) for (const id of ['observation', 'survey', 'ditch', 'allocation', 'selection', 'trial', 'stabilize']) if (!ids.has(id)) throw new Error(`缺少规则实现需要的节点：${id}`);
  if ((['0.5.0','0.6.0', '0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion)) !== (value.development !== undefined)) throw new Error('持续成长机制与规则版本不匹配');
  if ((['0.6.0','0.7.0', '0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion)) !== (value.productNetwork === true) || (value.productNetwork !== undefined && value.productNetwork !== true)) throw new Error('产品网络与规则版本不匹配');
  if ((['0.7.0','0.8.0', '0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion)) !== (value.householdProgress===true) || (value.householdProgress!==undefined&&value.householdProgress!==true))throw new Error('家庭进展机制与规则版本不匹配');
  if ((['0.8.0','0.9.0', '0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion)) !== (value.passiveInvestment!==undefined)) throw new Error('被动投资机制与规则版本不匹配');
  if(value.passiveInvestment!==undefined && (!isRecord(value.passiveInvestment)||!integerFields(value.passiveInvestment,['victoryPercent','reportPrice'])||(value.passiveInvestment.victoryPercent as number)<1||(value.passiveInvestment.reportPrice as number)<1)) throw new Error('投资与胜利配置无效');
  if((['0.9.0','0.10.0', '0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.economy!==undefined))throw new Error('学科经济版本不匹配');
  if(value.economy!==undefined&&(!isRecord(value.economy)||!integerFields(value.economy,['wage','hireCost','durability'])||Object.values(value.economy).some(n=>(n as number)<1)))throw new Error('学科经济参数无效');
  if((['0.10.0','0.11.0', '0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.shop!==undefined))throw new Error('商城规则版本不匹配');
  if(value.shop!==undefined){
    const keys=['transport','stock','deviceFee','importFee','textbookBase','lessonBase','trainingPrice','trainingExperience','granaryPrice','granaryCapacity','libraryPrice','repairPercent'];
    if(!isRecord(value.shop)||!integerFields(value.shop,keys)||Object.keys(value.shop).length!==keys.length||Object.values(value.shop).some(n=>!Number.isInteger(n)||(n as number)<1||(n as number)>100)||(value.shop.repairPercent as number)>=100)throw new Error('商城参数无效：整数1—100，维修比例小于100');
  }
  if(isRecord(value.shop))for(const [key,[min,max]]of Object.entries(SHOP_BOUNDS)){const n=value.shop[key] as number;if(n<min||n>max)throw new Error('商城参数超出范围：'+key);}
  if((['0.11.0','0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.operations!==undefined))throw new Error('长期经营版本不匹配');
  if(value.operations!==undefined){if(!isRecord(value.operations)||Object.keys(value.operations).length!==Object.keys(OPERATIONS_BOUNDS).length)throw new Error('长期经营参数不完整');for(const [k,[min,max]]of Object.entries(OPERATIONS_BOUNDS)){const n=value.operations[k];if(!Number.isInteger(n)||(n as number)<min||(n as number)>max)throw new Error('长期经营参数越界：'+k);}}
  if ((['0.12.0','0.13.0','0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.workshops!==undefined))throw new Error('作坊规则版本不匹配');
  if(value.workshops!==undefined){if(!isRecord(value.workshops)||Object.keys(value.workshops).length!==2)throw new Error('作坊参数不完整');for(const [k,[min,max]]of Object.entries(WORKSHOP_BOUNDS)){const n=value.workshops[k];if(!Number.isInteger(n)||(n as number)<min||(n as number)>max)throw new Error('作坊参数越界：'+k);}}
  if ((['0.13.0','0.14.0'].includes(value.rulesVersion))!==(value.tower!==undefined))throw new Error('文明试炼版本不匹配');
  if(value.tower!==undefined){if(!isRecord(value.tower)||Object.keys(value.tower).length!==Object.keys(TOWER_BOUNDS).length)throw new Error('试炼参数不完整');for(const [k,[min,max]]of Object.entries(TOWER_BOUNDS)){const n=value.tower[k];if(!Number.isInteger(n)||(n as number)<min||(n as number)>max)throw new Error('试炼参数越界：'+k);}}
  if (value.development !== undefined) {
    const d = value.development;
    const keys = ['experienceStep','equipmentDurability','marketSupply','experimentFood','mentorFood','tradeSpread'];
    if(!isRecord(d)||!integerFields(d.parameters,keys)||!isRecord(d.parameterBounds)||Object.keys(d.parameterBounds).length!==keys.length)throw new Error('成长参数集合无效');
    for(const key of keys){const b=d.parameterBounds[key],n=(d.parameters as Record<string,number>)[key];if(!Array.isArray(b)||b.length!==2||!b.every(Number.isInteger)||b[0]<1||b[1]>20||b[0]>b[1]||n<b[0]||n>b[1])throw new Error('成长参数边界无效');}
    if(!value.economy) for(const id of ['agronomy','ceramic-engineering','mechanics','experimentation','precision-engineering'])if(!ids.has(id))throw new Error('缺少工业科学节点');
  }
  if((['0.14.0','0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.modern===true)||(value.modern!==undefined&&value.modern!==true))throw new Error('现代科技版本不匹配');
  if((['0.15.0','0.16.0','0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.civilization===true)||(value.civilization!==undefined&&value.civilization!==true))throw new Error('农业文明版本不匹配');
  if(value.householdLineage!==undefined)throw new Error('当前规则不使用家学接续开关');
  if((['0.17.0','0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.life!==undefined))throw new Error('人生规则版本不匹配');
  if(value.life!==undefined){
    if(!isRecord(value.life)||Object.keys(value.life).length!==Object.keys(LIFE_BOUNDS).length)throw new Error('人生参数不完整');
    for(const [key,[min,max]] of Object.entries(LIFE_BOUNDS)){const n=value.life[key];if(!Number.isInteger(n)||(n as number)<min||(n as number)>max)throw new Error('人生参数越界：'+key);}
  }
  if((['0.18.0','0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.branches!==undefined))throw new Error('分支规则版本不匹配');
  if(value.branches!==undefined&&(!integerFields(value.branches,['electricFee','metalFee','basicIronStock','metalStock'])||Object.values(value.branches as Record<string,number>).some(n=>n<1||n>20)))throw new Error('分支渠道参数无效');
  if((['0.19.0','0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.industry!==undefined))throw new Error('三类树版本不匹配');
  if(value.industry!==undefined&&(!integerFields(value.industry,['workerTime','workerEnergy','workerRecovery','workerRestTime','workerRestRecovery','wageTimeUnit','archiveDiscount'])||Object.values(value.industry as Record<string,number>).some(n=>n<1||n>24)))throw new Error('系统劳动参数无效');
  if((['0.20.0','0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.renewal!==undefined))throw new Error('恢复与传承版本不匹配');
  if(value.renewal!==undefined&&(!integerFields(value.renewal,['fedHealth','graceSeasons','minimumEnergy','farmTime','farmEnergy','careTime','careEnergy','careMoney','inheritedTime','inheritedEnergy','companyTime','companyEnergy','consultDiscount'])||Object.values(value.renewal as Record<string,number>).some(n=>n<1||n>12)))throw new Error('恢复与传承参数无效');
  if((['0.21.0','0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.socialFood!==undefined))throw new Error('社会食品版本不匹配');
  if(value.socialFood!==undefined&&(!integerFields(value.socialFood,['storage','imports','serviceCapacity','pickupTime','defaultBudget','defaultReserve'])||(value.socialFood as Record<string,number>).storage<1||(value.socialFood as Record<string,number>).pickupTime<1))throw new Error('社会食品参数无效');
  if((['0.22.0','0.23.0','0.24.0','0.25.0','0.26.0','0.27.0'].includes(value.rulesVersion))!==(value.eras!==undefined))throw new Error('社会阶段版本不匹配');
  if(value.eras!==undefined){if(!isRecord(value.eras)||Object.keys(value.eras).length!==3)throw new Error('社会阶段参数无效');const g=(value.eras as Record<string,unknown>).generationLimit;if(!Number.isInteger(g)||(g as number)<1||(g as number)>10)throw new Error('社会阶段参数无效：generationLimit 限 1—10');if(!['rewardDivisor','dungeonTarget'].every(k=>Number.isInteger((value.eras as Record<string,unknown>)[k])&&((value.eras as Record<string,unknown>)[k] as number)>=1&&((value.eras as Record<string,unknown>)[k] as number)<=400))throw new Error('社会阶段参数无效');}
  if((value.rulesVersion==='0.27.0')!==(value.electric!==undefined))throw new Error('电气规则版本不匹配');
  if(value.electric!==undefined){
    if(!isRecord(value.electric)||Object.keys(value.electric).length!==Object.keys(ELECTRIC_BOUNDS).length)throw new Error('电气参数不完整');
    for(const [k,[min,max]] of Object.entries(ELECTRIC_BOUNDS)){const n=value.electric[k];if(!Number.isInteger(n)||(n as number)<min||(n as number)>max)throw new Error('电气参数越界：'+k);}
  }
  if (!isRecord(value.catalogs) || !isRecord(value.catalogs.goods) || !isRecord(value.catalogs.crops) || !isRecord(value.catalogs.products) || !isRecord(value.catalogs.processes)) throw new Error('目录数值不完整');
  applyCatalogOverlay(value.catalogs as unknown as CatalogOverlay);
  const rules = structuredClone(value) as unknown as Ruleset;
  if (rules.production) validateProduction(rules);
  else if (rules.technologies.some(t => t.prerequisiteAny || t.helpfulPrerequisites) || Object.values(rules.scenarios).some(s => s.production)) throw new Error('旧规则不能注入新生产机制');
  const visiting = new Set<string>(), visited = new Set<string>();
  function visit(id: string): void {
    if (visiting.has(id)) throw new Error(`前置成环：${id}`);
    if (visited.has(id)) return;
    const node = rules.technologies.find(n => n.id === id);
    if (!node) throw new Error(`前置不存在：${id}`);
    for (const optional of [node.prerequisiteAny, node.helpfulPrerequisites]) if (optional !== undefined && (!strings(optional) || !optional.length || new Set(optional).size !== optional.length)) throw new Error('知识依赖列表无效');
    visiting.add(id); [...node.prerequisites, ...(node.prerequisiteAny ?? []), ...(node.helpfulPrerequisites ?? [])].forEach(visit); visiting.delete(id); visited.add(id);
  }
  rules.technologies.forEach(n => visit(n.id));
  return deepFreeze(rules);
}
export function resolveRuleset(base: Ruleset, overrides: unknown = {}): Ruleset {
  if (!isRecord(overrides)) throw new Error('候选参数必须是 JSON 对象');
  const parameters = { ...base.parameters };
  const production = base.production ? structuredClone(base.production) : undefined;
  const tower=base.tower?structuredClone(base.tower):undefined;
  const workshops=base.workshops?structuredClone(base.workshops):undefined;
  const operations=base.operations?structuredClone(base.operations):undefined;
  const industry=base.industry?structuredClone(base.industry):undefined;
  const branches=base.branches?structuredClone(base.branches):undefined;
  const electric=base.electric?structuredClone(base.electric):undefined;
  const eras=base.eras?structuredClone(base.eras):undefined;
  const socialFood=base.socialFood?structuredClone(base.socialFood):undefined;
  const renewal=base.renewal?structuredClone(base.renewal):undefined;
  const life=base.life?structuredClone(base.life):undefined;
  const shop=base.shop?structuredClone(base.shop):undefined;
  const development = base.development ? structuredClone(base.development) : undefined;
  for (const [key, value] of Object.entries(overrides)) {
    if(electric&&key.startsWith('electric.')){const name=key.slice(9) as keyof ElectricRules;if(!Object.hasOwn(ELECTRIC_BOUNDS,name))throw new Error('未知电气参数');const [min,max]=ELECTRIC_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('电气参数越界');electric[name]=value as number;continue;}
    if(eras&&key.startsWith('eras.')){const name=key.slice(5) as keyof EraRules;if(!Object.hasOwn(eras,name)||!Number.isInteger(value)||(value as number)<1||(value as number)>400)throw new Error('社会阶段参数无效');eras[name]=value as number;continue;}
    if(socialFood&&key.startsWith('socialFood.')){const name=key.slice(11) as keyof SocialFoodRules;if(!Object.hasOwn(socialFood,name)||!Number.isInteger(value)||(value as number)<0||(value as number)>100)throw new Error('社会食品参数无效');socialFood[name]=value as number;continue;}
    if(renewal&&key.startsWith('renewal.')){const name=key.slice(8) as keyof RenewalRules;if(!Object.hasOwn(renewal,name)||!Number.isInteger(value)||(value as number)<1||(value as number)>12)throw new Error('恢复与传承参数无效');renewal[name]=value as number;continue;}
    if(industry&&key.startsWith('industry.')){const name=key.slice(9) as keyof IndustryRules;if(!Object.hasOwn(industry,name)||!Number.isInteger(value)||(value as number)<1||(value as number)>24)throw new Error('系统劳动参数无效');industry[name]=value as number;continue;}
    if(branches&&key.startsWith('branches.')){const name=key.slice(9) as keyof BranchRules;if(!Object.hasOwn(branches,name)||!Number.isInteger(value)||(value as number)<1||(value as number)>20)throw new Error('分支渠道参数无效');branches[name]=value as number;continue;}
    if(life&&key.startsWith('life.')){const name=key.slice(5) as keyof LifeRules;if(!Object.hasOwn(LIFE_BOUNDS,name))throw new Error('未知人生参数');const [min,max]=LIFE_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('人生参数越界');life[name]=value as number;continue;}
    if(tower&&key.startsWith('tower.')){const name=key.slice(6) as keyof TowerRules;if(!Object.hasOwn(TOWER_BOUNDS,name))throw new Error('未知试炼参数');const [min,max]=TOWER_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('试炼参数越界');tower[name]=value as number;continue;}
    if(workshops&&key.startsWith('workshops.')){const name=key.slice(10) as keyof WorkshopRules;if(!Object.hasOwn(WORKSHOP_BOUNDS,name))throw new Error('未知作坊参数');const [min,max]=WORKSHOP_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('作坊参数越界');workshops[name]=value as number;continue;}
    if(operations&&key.startsWith('operations.')){const name=key.slice(11) as keyof OperationsRules;if(!Object.hasOwn(OPERATIONS_BOUNDS,name))throw new Error('未知经营参数');const [min,max]=OPERATIONS_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('经营参数越界');operations[name]=value as number;continue;}
    if(shop&&key.startsWith('shop.')){const name=key.slice(5) as keyof ShopRules;if(!Object.hasOwn(SHOP_BOUNDS,name))throw new Error('未知商城参数');const [min,max]=SHOP_BOUNDS[name];if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('商城参数超出范围');shop[name]=value as number;continue;}
    if(development && key.startsWith('development.')){
      const name=key.slice(12) as keyof DevelopmentRules['parameters'];
      if(!Object.hasOwn(development.parameterBounds,name))throw new Error('未知成长参数');
      const [min,max]=development.parameterBounds[name];
      if(!Number.isInteger(value)||(value as number)<min||(value as number)>max)throw new Error('成长参数超出范围');
      development.parameters[name]=value as number;continue;
    }
    if (production && key.startsWith('production.')) {
      const name = key.slice('production.'.length) as keyof ProductionParameters;
      if (!Object.hasOwn(production.parameterBounds, name)) throw new Error(`未知参数：${key}`);
      const [min, max] = production.parameterBounds[name];
      if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`参数超出范围：${key}`);
      production.parameters[name] = value as number;
      continue;
    }
    if (!Object.hasOwn(base.parameterBounds, key)) throw new Error(`未知参数：${key}`);
    const [min, max] = base.parameterBounds[key as keyof Parameters];
    if (!Number.isInteger(value) || (value as number) < min || (value as number) > max) throw new Error(`参数超出范围：${key}`);
    parameters[key as keyof Parameters] = value as number;
  }
  return validateRuleset({ ...base, parameters, ...(electric?{electric}:{}), ...(eras?{eras}:{}), ...(socialFood?{socialFood}:{}), ...(renewal?{renewal}:{}), ...(industry?{industry}:{}), ...(branches?{branches}:{}), ...(life?{life}:{}), ...(tower?{tower}:{}), ...(workshops?{workshops}:{}), ...(operations?{operations}:{}), ...(shop?{shop}:{}), ...(development ? {development} : {}), ...(production ? { production } : {}) });
}

const productionKeys = ['gatherFood', 'gatherWood', 'gatherClay', 'baseStorage', 'woodenStorage', 'potteryStorage', 'spoilDivisor', 'toolDurability', 'toolBonus', 'woodRecipeCost', 'potteryClayCost', 'potteryFuelCost', 'woodenwarePrice', 'potteryPrice', 'methodPrice'];
function integerFields(value: unknown, keys: string[]): boolean {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every(key => Number.isInteger(value[key]) && (value[key] as number) >= 0 && (value[key] as number) <= 100);
}
function validateProduction(rules: Ruleset): void {
  const p = rules.production!;
  if (!isRecord(p) || !integerFields(p.parameters, productionKeys) || !isRecord(p.parameterBounds) || Object.keys(p.parameterBounds).length !== productionKeys.length) throw new Error('生产参数集合无效');
  for (const key of productionKeys as (keyof ProductionParameters)[]) {
    const range = p.parameterBounds[key], value = p.parameters[key];
    if (!Array.isArray(range) || range.length !== 2 || !range.every(Number.isInteger) || range[0] < 1 || range[1] > 100 || range[0] > range[1] || value < range[0] || value > range[1]) throw new Error(`生产参数边界无效：${key}`);
  }
  if(!rules.economy) for (const id of ['resource-observation', 'woodworking', 'controlled-fire', 'pottery', 'storage']) if (!rules.technologies.some(t => t.id === id)) throw new Error(`缺少生产节点：${id}`);
  for (const scenario of Object.values(rules.scenarios)) {
    const s = scenario.production;
    if (!isRecord(s) || !integerFields(s.stocks, ['wildFood', 'timber', 'clay']) || !integerFields(s.recovery, ['wildFood', 'timber']) || !integerFields(s.market, ['food', 'jobs', 'woodenware', 'pottery', 'methods']) || !strings(s.teachers) || !strings(s.imports)) throw new Error(`场景生产条件无效：${scenario.id}`);
    if (s.recovery.wildFood > s.stocks.wildFood || s.recovery.timber > s.stocks.timber) throw new Error('资源恢复超过容量');
    for (const id of [...s.teachers, ...s.imports]) if (!rules.technologies.some(t => t.id === id)) throw new Error(`未知教学来源：${id}`);
  }
}
