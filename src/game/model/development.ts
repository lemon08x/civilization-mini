export const DISCIPLINES = ['pottery', 'woodwork', 'agriculture', 'science'] as const;
export type Discipline = typeof DISCIPLINES[number];
export const DISCIPLINE_NAMES: Record<Discipline,string> = { pottery:'陶作', woodwork:'木作与机械', agriculture:'农业与加工', science:'实验研究' };
export const DEVELOPMENT_GOODS = ['supplies','ceramicParts','mechanisms','fieldTools','labTools','precisionParts','findings'] as const;
export type DevelopmentGood = typeof DEVELOPMENT_GOODS[number];
export const GOOD_NAMES: Record<DevelopmentGood,string> = { supplies:'工坊补给',ceramicParts:'陶质构件',mechanisms:'传动机构',fieldTools:'农具组件',labTools:'实验器具',precisionParts:'精密器件',findings:'研究记录' };
export interface DevelopmentRules {
  parameters: { experienceStep:number; equipmentDurability:number; marketSupply:number; experimentFood:number; mentorFood:number; tradeSpread:number };
  parameterBounds: Record<keyof DevelopmentRules['parameters'],[number,number]>;
}
export interface DevelopmentState {
  experience: Record<string,Partial<Record<Discipline,number>>>;
  goods: Record<DevelopmentGood,number>;
  designs: Record<Discipline,number>;
  project: { recipe:string; started:number } | null;
  fieldDurability:number; labDurability:number; tradeRemaining:number; ordersRemaining:number;
}
