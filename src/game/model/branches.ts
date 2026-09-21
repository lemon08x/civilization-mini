import type { Subject } from './economy.js';
import { frameworkUnlockStage } from './eras.js';
export interface BranchNode {unlockEra?:number;stages?:number[];id:string;name:string;subject:Subject;parents:string[];sample:Record<string,number>;benefit:string;}
export const BRANCH_NODES:BranchNode[]=[
  {id:'A0',name:'基础栽培',subject:'agronomy',unlockEra:0,parents:[],sample:{},benefit:'小麦播种、照料、收获；开局已会'},
  {id:'A1',name:'田间水分管理',subject:'agronomy',unlockEra:0,parents:['A0'],sample:{wood:1,clay:1},benefit:'理解田间需水，配置人工供水；自动供水还需后续泵与工具。'},
  {id:'A3',name:'土壤肥力',subject:'agronomy',unlockEra:0,parents:['A0'],sample:{straw:1},benefit:'施用堆肥恢复地力；不必先学田间水分管理'},
  {id:'A4',name:'油料与纤维作物',subject:'agronomy',unlockEra:0,parents:['A0'],sample:{seedSoy:1},benefit:'探索辨种或与同门换种后，在空田试种豆或麻并掌握种植；也可向同门请教。种植仍须持有已发现的种子。'},
  {id:'A5',name:'轮作计划',subject:'agronomy',unlockEra:0,parents:['A3','A4'],sample:{},benefit:'同一地块改种与上茬不同的作物，播种时本茬潜在收成+1；仍受水分、肥力与灾害影响。'},
  {id:'A6',name:'选种留种',subject:'agronomy',unlockEra:0,parents:['A4'],sample:{},benefit:'普通作物收获返还2份对应种子，原为1份；异穗麦仍只返还1份，不额外复制异种。'},
  {id:'A7',name:'秸秆堆肥',subject:'agronomy',unlockEra:0,parents:['A3','M0'],sample:{},benefit:'制作堆肥设施，把3秸秆跨季腐熟为2堆肥；每批耗1设备耐用，堆肥仍需实际施入田地。'},
  {id:'A8',name:'田间排涝',subject:'agronomy',unlockEra:0,parents:['A1','M0'],sample:{},benefit:'制作排水设施。丰水季每保护一块生长中的田地消耗1耐用，免除该次积水胁迫；不消除已有受灾。'},
  {id:'A9',name:'收获安排',subject:'agronomy',unlockEra:0,parents:['A0','M0'],sample:{},benefit:'制作收割工具；有可用工具时，迟收损失最多宽限1季，每次收获扣1耐用；不延缓作物生长。'},
  {id:'A10',name:'育苗移栽',subject:'agronomy',unlockEra:0,parents:['A6','M3'],sample:{},benefit:'制作育苗设施；播种时消耗1耐用，使本茬成熟时间缩短1季（最低1季），已经播下的作物不追溯变化。'},
  {id:'A11',name:'探路辨种',subject:'agronomy',unlockEra:0,parents:['A0'],sample:{},benefit:'探索相邻未知地块与辨认种囊、异穗时，时间降至日常交互时间（不高于原耗时），精力照常；不预知探索结果，也不改变事件概率。'},
  {id:'M0',name:'材料识别',subject:'materials',unlockEra:0,parents:[],sample:{wood:1},benefit:'认识木材、黏土等材料，为储粮容器与后续工具制作打基础。'},
  {id:'M1',name:'成形与连接',subject:'materials',unlockEra:1,parents:['M0'],sample:{wood:1},benefit:'锻打工具与部件连接；市镇百工以后开放'},
  {id:'M2',name:'密封工艺',subject:'materials',unlockEra:1,parents:['M1'],sample:{fiber:1,oil:1},benefit:'制作密封件，配合阀门与泵'},
  {id:'M3',name:'食品储存',subject:'materials',unlockEra:0,parents:['M0'],sample:{wood:1},benefit:'基础容器保护更多口粮'},
  {id:'M4',name:'电工绝缘',subject:'materials',unlockEra:2,parents:['M0'],sample:{wood:1,clay:1},benefit:'认识绝缘，联络电工材料商；电力工业以后开放'},
  {id:'M5',name:'导线与绕组工艺',subject:'materials',unlockEra:2,parents:['M4'],sample:{copper:1,polymer:1},benefit:'制作导线、电缆与线圈'},
  {id:'L0',name:'受力与运动基础',subject:'mechanics',unlockEra:0,parents:[],sample:{wood:1},benefit:'制作简单提水器，改善田间提水；后续可继续学习机械传动。'},
  {id:'L1',name:'机械传动',subject:'mechanics',unlockEra:1,parents:['L0'],sample:{wood:1},benefit:'传动轴、手摇传动与磨粮；市镇百工以后开放'},
  {id:'L2',name:'压力与流体',subject:'mechanics',unlockEra:1,parents:['L0'],sample:{clay:1},benefit:'阀门与流体基础，不必先学机械传动'},
  {id:'L3',name:'泵与供水',subject:'mechanics',unlockEra:1,parents:['L2'],sample:{wood:1},benefit:'制造活塞泵。公井不要求先学泵'},
  {id:'L4',name:'水力动力',subject:'mechanics',unlockEra:1,parents:['L1'],sample:{wood:1},benefit:'水轮动力；市镇百工以后开放'},
  {id:'L5',name:'电磁转换基础',subject:'mechanics',unlockEra:2,parents:['L0'],sample:{copper:1},benefit:'利用购入样品学习电磁，不要求先造发电机'},
  {id:'L6',name:'发电机系统',subject:'mechanics',unlockEra:2,parents:['L5'],sample:{copper:1,iron:1},benefit:'与传动和绕组工艺共同制造发电机'},
  {id:'L7',name:'基础配电',subject:'mechanics',unlockEra:2,parents:['L5','M4'],sample:{wire:1},benefit:'使用电力负载的知识基础；电力工业开放，不必先学习发电机制造，仍需设备与可用电。'},
  {id:'O0',name:'劳动分工',subject:'organization',unlockEra:2,parents:[],sample:{},benefit:'委托社会供粮与岗位安排的知识基础；工业阶段基础招聘不要求先学习本课。'},
  {id:'O1',name:'生产工序',subject:'organization',unlockEra:1,parents:['M1'],sample:{wood:1},benefit:'组织单工位轴加工；持续生产与农业托管还需人员和具体工艺。市镇可先由本人运行。'},
  {id:'O2',name:'采购与交付',subject:'organization',unlockEra:2,parents:['O0','Q2'],sample:{},benefit:'用于持续补货、销售、维护与经营契约；手动买卖不要求先学本课。电力工业开放。'},
];
export const BRANCH_PRODUCTS:Record<string,string[]>={
  W01:['L0'],S01:['M3'],T03:['M1'],W03:['L3','M2'],P01:['L1','M1'],P03:['L4','M1'],
  U06:['L1','M1'],E01:['L6','L4','M1','M5'],U08:['A8'],U09:['A7'],U04:['A9'],U10:['A10'],S02:['M2','M3'],T01:['M1'],U01:['A0','L0','M1'],
};
export const BRANCH_PROCESSES:Record<string,string[]>={compost:['A7'],fiber:['M1'],rope:['M1'],oil:['M1'],seal:['M2'],shaft:['L1','M1'],valve:['L2','M1','M2'],wire:['M5'],coil:['M5','M1'],cable:['M5'],mill:['L1','M1']};
export const BRANCH_PATHS=[
  {id:'farm',name:'农场 · 栽培与水土',nodes:['A0','A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11'],products:['W01','U08','U09','U04','U10'],description:'种植、肥力、井渠与新种子；探索和留种在田地进行。'},
  {id:'storage',name:'农场 · 提水与储粮',nodes:['M0','M3','L0'],products:['S01','W01'],description:'基础材料用于储粮与提水，不要求先完成工业知识。'},
  {id:'workshop',name:'工坊 · 工具与农产加工',nodes:['M1','L1','L4','O1','Q0','Q1','Q2'],products:['T03','U06','P03'],description:'先制作工具，再磨粮、组织工序；水力为可选升级。'},
  {id:'waterworks',name:'工坊 · 泵与供水工具',nodes:['L2','L3','M2'],products:['W03'],description:'压力、密封与泵组成机械供水支线。'},
  {id:'market',name:'工业 · 用工与经营安排',nodes:['O0','O2'],products:[],description:'基础招聘与手动买卖直接开放；知识用于进一步的分工与持续经营安排。'},
  {id:'power',name:'工业 · 用电基础',nodes:['M4','L5','L7'],products:[],description:'绝缘、电磁与配电支持用电；无需先学发电机制造。'},
  {id:'electric',name:'工业 · 设备制造专业支线',nodes:['M5','L6'],products:['E01'],description:'导线、绕组与发电机制造，不是所有经营者的必经路线。'},
];
export const COURSE_TRACKS:Record<string,{name:string;nodes:string[];use:string}>={
 cultivation:{name:'栽培与留种',nodes:['A0','A4','A6','A10'],use:'农场 · 播种、收获与留种'},
 water:{name:'水分与排涝',nodes:['A1','A2','A8'],use:'农场 · 灌溉、井渠与排水设施'},
 soil:{name:'土壤与轮作',nodes:['A3','A5','A7'],use:'农场与制造 · 肥力、轮作及秸秆堆肥'},
 exploration:{name:'探索与辨种',nodes:['A11'],use:'农场 · 未知地块探索与种囊辨认'},
 supplies:{name:'提水与储粮',nodes:['M0','M3','L0','A9'],use:'农场 · 储粮与简单提水工具'},
 processing:{name:'工具与加工',nodes:['M1','L1','L4','O1','Q0','Q1','Q2'],use:'制造 · 工具、磨粮与工序安排'},
 waterworks:{name:'机械供水',nodes:['M2','L2','L3'],use:'制造与系统 · 密封件、泵与供水'},
 business:{name:'分工与经营',nodes:['O0','O2'],use:'人员与经营安排 · 招聘后的组织与配送'},
 electricity:{name:'用电基础',nodes:['M4','L5','L7'],use:'供能 · 设备与电力负载'},
 specialist:{name:'设备制造支线',nodes:['M5','L6'],use:'制造 · 导线、绕组与发电设备'},
 accounting:{name:'阶段结算核算',nodes:['O3','O4','O5'],use:'阶段结算 · 现行回报加成，非市场或资本能力'},
};
export function courseTrack(id:string){return Object.entries(COURSE_TRACKS).find(([,t])=>t.nodes.includes(id))?.[0]??'processing';}

export interface BranchState {
  learned:Record<string,string[]>;
  archives:string[];
  protocols:string[];
  channels:string[];
  delivered:string[];
}
export interface BranchRules {electricFee:number;metalFee:number;basicIronStock:number;metalStock:number;}

export const ERA_NODES:BranchNode[]=[
 {id:'Q0',name:'基础数学',subject:'mechanics',unlockEra:1,parents:[],sample:{},benefit:'工坊基础：产品检验少1时间；是数量管理与进阶数学的基础。'},
 {id:'Q1',name:'应用数学',subject:'mechanics',unlockEra:1,parents:['Q0'],sample:{},benefit:'本人加工少1精力；最终副本可提供方案验算。市镇百工以后开放。'},
 {id:'Q2',name:'账目与计量',subject:'mechanics',unlockEra:1,parents:['Q0'],sample:{},benefit:'阶段生产核算的数量前置。市镇百工以后开放。'},
 {id:'A2',name:'井渠作业',subject:'agronomy',unlockEra:0,parents:['A1'],sample:{},benefit:'建设家庭水井。不是离开农业的条件；已建井跨社会保留。'},
 {id:'O3',name:'集镇生产核算',subject:'organization',unlockEra:1,parents:['Q2','M1'],sample:{},benefit:'本家庭实际生产的阶段回报凭证增加四分之一。与另外两门核算课不叠乘。市镇百工以后可学。'},
 {id:'O4',name:'工厂批次管理',subject:'organization',unlockEra:2,parents:['Q2','O1'],sample:{},benefit:'本家庭实际生产的阶段回报凭证增加四分之一。电力工业以后可学。'},
 {id:'O5',name:'生产调度核算',subject:'organization',unlockEra:2,parents:['Q2','O2'],sample:{},benefit:'本家庭实际生产的阶段回报凭证增加四分之一。电力工业以后可学。'},
];
export function branchNodesFor(s:{era?:unknown}):BranchNode[]{return s.era?[...BRANCH_NODES,...ERA_NODES]:BRANCH_NODES;}
export function nodeUnlockEra(id:string):number{const n=[...BRANCH_NODES,...ERA_NODES].find(n=>n.id===id);return n?.unlockEra??0;}
export function nodeInEra(s:{era?:{index:number;frameworkId?:string}},id:string):boolean{if(!s.era)return true;if(s.era.frameworkId)return s.era.index>=frameworkUnlockStage(s.era.frameworkId,id);return s.era.index>=nodeUnlockEra(id);}
