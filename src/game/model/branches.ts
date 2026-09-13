import type { Subject } from './economy.js';
export interface BranchNode {id:string;name:string;subject:Subject;parents:string[];sample:Record<string,number>;benefit:string;}
export const BRANCH_NODES:BranchNode[]=[
  {id:'A0',name:'基础栽培',subject:'agronomy',parents:[],sample:{},benefit:'小麦播种、照料、收获；开局已会'},
  {id:'A1',name:'田间水分管理',subject:'agronomy',parents:['A0'],sample:{wood:1,clay:1},benefit:'配置自动灌溉与田间排水'},
  {id:'M0',name:'材料识别',subject:'materials',parents:[],sample:{wood:1},benefit:'认识材料用途，选择储存、成形或绝缘分支'},
  {id:'M1',name:'成形与连接',subject:'materials',parents:['M0'],sample:{wood:1},benefit:'锻打工具与部件连接'},
  {id:'M2',name:'密封工艺',subject:'materials',parents:['M1'],sample:{fiber:1,oil:1},benefit:'制作密封件，配合阀门与泵'},
  {id:'M3',name:'食品储存',subject:'materials',parents:['M0'],sample:{wood:1},benefit:'基础容器保护更多口粮'},
  {id:'M4',name:'电工绝缘',subject:'materials',parents:['M0'],sample:{wood:1,clay:1},benefit:'认识绝缘，联络电工材料商'},
  {id:'M5',name:'导线与绕组工艺',subject:'materials',parents:['M4'],sample:{copper:1,polymer:1},benefit:'制作导线、电缆与线圈'},
  {id:'L0',name:'受力与运动基础',subject:'mechanics',parents:[],sample:{wood:1},benefit:'简单提水器，机械与电磁共同基础'},
  {id:'L1',name:'机械传动',subject:'mechanics',parents:['L0'],sample:{wood:1},benefit:'传动轴、手摇传动与磨粮'},
  {id:'L2',name:'压力与流体',subject:'mechanics',parents:['L0'],sample:{clay:1},benefit:'阀门与流体基础，不必先学机械传动'},
  {id:'L3',name:'泵与供水',subject:'mechanics',parents:['L2'],sample:{wood:1},benefit:'制造活塞泵，配合田间知识自动灌溉'},
  {id:'L4',name:'水力动力',subject:'mechanics',parents:['L1'],sample:{wood:1},benefit:'水轮动力，先改善机械加工'},
  {id:'L5',name:'电磁转换基础',subject:'mechanics',parents:['L0'],sample:{copper:1},benefit:'利用购入样品学习电磁，不要求先造发电机'},
  {id:'L6',name:'发电机系统',subject:'mechanics',parents:['L5'],sample:{copper:1,iron:1},benefit:'与传动和绕组工艺共同制造发电机'},
  {id:'L7',name:'基础配电',subject:'mechanics',parents:['L6'],sample:{wire:1},benefit:'接入本地加工负载；不要求区域输电副本'},
  {id:'O0',name:'劳动分工',subject:'organization',parents:[],sample:{},benefit:'招聘与供粮安排'},
  {id:'O1',name:'生产工序',subject:'organization',parents:['O0'],sample:{wood:1},benefit:'工匠持续生产与农业托管'},
  {id:'O2',name:'采购与交付',subject:'organization',parents:['O1'],sample:{},benefit:'自动补货、销售、维护和经营契约'},
];
export const BRANCH_PRODUCTS:Record<string,string[]>={
  W01:['L0'],S01:['M3'],T03:['M1'],W03:['L3','M2'],P01:['L1','M1'],P03:['L4','L1','M1'],
  U06:['L1','M1'],E01:['L6','L1','L4','M1','M5'],U08:['A1','M1'],S02:['M2','M3'],T01:['M1'],U01:['A0','L0','M1'],
};
export const BRANCH_PROCESSES:Record<string,string[]>={seal:['M2'],shaft:['L1','M1'],valve:['L2','M1','M2'],wire:['M5'],coil:['M5','M1'],cable:['M5'],mill:['L1','M1']};
export const BRANCH_PATHS=[
  {id:'farm',name:'稳定农业与自动灌溉',nodes:['A0','A1','M0','M1','M2','M3','L0','L2','L3'],products:['S01','W03'],description:'先储粮，再做密封与泵；持续消耗真实水源、木材和设备耐用。'},
  {id:'workshop',name:'机械加工与销售',nodes:['M0','M1','L0','L1','O0','O1','O2'],products:['T03'],description:'试制轴、首次交付、雇员工序、补货销售；收益取决于真实收支。'},
  {id:'electric',name:'水力发电与基本电工',nodes:['L0','L1','L4','L5','L6','L7','M0','M1','M4','M5'],products:['P03','E01'],description:'水力机械先有收益，再做导线、线圈、发电与本地加工；化工半成品可采购。'},
];
export interface BranchState {
  learned:Record<string,string[]>;
  archives:string[];
  protocols:string[];
  channels:string[];
  delivered:string[];
}
export interface BranchRules {electricFee:number;metalFee:number;basicIronStock:number;metalStock:number;}
