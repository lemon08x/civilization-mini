import {BRANCH_PRODUCTS,BRANCH_PROCESSES} from './branches.js';

export interface IndustryRules {
  workerTime:number;workerEnergy:number;workerRecovery:number;
  workerRestTime:number;workerRestRecovery:number;wageTimeUnit:number;archiveDiscount:number;
}
export interface ProductDefinition {id:string;knowledge:string[];parents:string[];kind:'device'|'goods';good?:string;}
const parents:Record<string,string[]>={W03:['valve','seal'],P01:['shaft'],P03:['shaft'],S02:['S01','seal'],E01:['coil','shaft'],shaft:['T03'],valve:['seal'],coil:['wire'],cable:['wire','seal'],mill:['U06']};
export const INDUSTRY_PRODUCTS:ProductDefinition[]=[
  ...Object.entries(BRANCH_PRODUCTS).map(([id,knowledge])=>({id,knowledge,parents:parents[id]??[],kind:'device' as const})),
  ...Object.entries(BRANCH_PROCESSES).map(([id,knowledge])=>({id,knowledge,parents:parents[id]??[],kind:'goods' as const,good:id==='mill'?'flour':id})),
];
export type SystemId='hand'|'pump'|'shaft';
export type OperatorId='self'|'laborer'|'farmer'|'artisan';
export interface SystemDefinition {
  id:SystemId;name:string;knowledge:string[];products:string[];systems:SystemId[];
  equipment?:string;time:number;energy:number;qualification:'field'|'craft';description:string;
}
export const SYSTEMS:SystemDefinition[]=[
  {id:'hand',name:'人工供水',knowledge:['A1'],products:[],systems:[],time:4,energy:4,qualification:'field',description:'缺水时人工提水；4时间/4精力，1公共水补2水分。'},
  {id:'pump',name:'机械供水',knowledge:['A1','O0'],products:['W03'],systems:[],equipment:'W03',time:2,energy:1,qualification:'field',description:'操作员使用泵，2时间/1精力；1公共水、1木材耗材、1耐用补2水分。'},
  {id:'shaft',name:'单工位轴加工',knowledge:['O1'],products:['T03','shaft'],systems:[],equipment:'T03',time:8,energy:6,qualification:'craft',description:'搬运2/1、加工4/4、检验2/1合为一批；木2铁1产轴2，每季至多一批。'},
];
export interface SystemInstance {id:SystemId;commissioned:boolean;enabled:boolean;operator:OperatorId|null;}
export interface WorkerBudget {timeRemaining:number;energy:number;}
export interface IndustryState {
  rules:IndustryRules;
  products:Record<string,{source:'prototype'|'inspection';protocol:boolean}>;
  commissioned:SystemId[];
  instances:Partial<Record<SystemId,SystemInstance>>;
  workers:Record<string,WorkerBudget>;
}
