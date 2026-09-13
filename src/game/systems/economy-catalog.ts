import { MODERN_TOPICS,MODERN_GOODS,MODERN_PRODUCTS,MODERN_PROCESSES } from './modern-catalog.js';
import type { GameState } from '../model/state.js';
import type { Subject, Crop, WorkerKind } from '../model/economy.js';
export const SUBJECT_NAMES:Record<Subject,string>={mechanics:'力学',heat:'热学',chemistry:'化学',materials:'材料学',agronomy:'农学',organization:'生产组织学'};
const topics:Record<Subject,string[]>={
  mechanics:['力与平衡','杠杆与转动','运动传递','功与动力','静水压力','流动与阻力'],
  heat:['温度与受热变化','热传递','保温与散热','物态变化','气体膨胀','热与功'],
  chemistry:['物质性质与变化','溶解与结晶','分离与提纯','燃烧与氧化还原','金属提取','酸碱与中和'],
  materials:['材料性质','成形与连接','密封与耐压','耐热与隔热','强度与韧性','合金与热处理'],
  agronomy:['植物生长条件','水土管理','土壤肥力','栽培与收获','选种与繁育','病虫害与轮作'],
  organization:['劳动分工','工序组织','成本与契约','培训与知识传授','协作与管理','合作组织'],
};
const prefixes:Record<Subject,string>={mechanics:'L',heat:'H',chemistry:'C',materials:'M',agronomy:'A',organization:'O'};
export const TOPICS=Object.entries(topics).flatMap(([s,names])=>names.map((name,i)=>({id:prefixes[s as Subject]+String(i+1).padStart(2,'0'),subject:s as Subject,level:i+1,name})));
export const GOODS:Record<string,{name:string;price:number;food:number}>={
  wood:{name:'木材',price:1,food:0},clay:{name:'黏土',price:1,food:0},ore:{name:'矿料',price:2,food:0},iron:{name:'铁料',price:5,food:0},
  wheat:{name:'小麦',price:1,food:1},soy:{name:'大豆',price:2,food:1},flax:{name:'亚麻茎',price:2,food:0},straw:{name:'秸秆',price:1,food:0},
  flour:{name:'面粉',price:2,food:1},oil:{name:'植物油',price:4,food:0},fiber:{name:'亚麻纤维',price:4,food:0},rope:{name:'绳索',price:6,food:0},
  compost:{name:'腐熟堆肥',price:2,food:0},ceramics:{name:'陶质构件',price:5,food:0},brick:{name:'耐火砖',price:4,food:0},seal:{name:'密封件',price:5,food:0},
  valve:{name:'阀门',price:8,food:0},shaft:{name:'传动轴',price:7,food:0},spring:{name:'弹簧',price:8,food:0},solution:{name:'提纯溶液',price:6,food:0},
  seedWheat:{name:'小麦种子',price:1,food:0},seedSoy:{name:'大豆种子',price:2,food:0},seedFlax:{name:'亚麻种子',price:2,food:0},
};
export const CROPS:Record<Crop,{name:string;seed:string;duration:number;yield:number;straw:number;level:number}>={
  wheat:{name:'小麦',seed:'seedWheat',duration:2,yield:6,straw:2,level:1},soy:{name:'大豆',seed:'seedSoy',duration:2,yield:4,straw:1,level:2},flax:{name:'亚麻',seed:'seedFlax',duration:3,yield:5,straw:1,level:2},
};
export interface ProductSpec {id:string;name:string;category:string;effect:string;requires:Partial<Record<Subject,number>>;inputs:Record<string,number>;from:string[];}
export const PRODUCTS:ProductSpec[]=[
  {id:'W01',name:'提水辘轳',category:'供水与排水',effect:'田间管理从1公共水取得2点供水；每次扣1耐用度。',requires:{mechanics:1},inputs:{wood:3},from:[]},
  {id:'W03',name:'活塞泵',category:'供水与排水',effect:'有作物且缺水时每季自动抽取1公共水灌溉，消耗1木材和1耐用度。',requires:{mechanics:5,materials:3},inputs:{iron:2,valve:1,seal:1},from:['W01']},
  {id:'P01',name:'手摇传动装置',category:'生产动力',effect:'纤维和绳索加工一次处理双份，原料产出均翻倍，每批扣1耐用度。',requires:{mechanics:2},inputs:{wood:3,shaft:1},from:[]},
  {id:'P03',name:'水轮动力装置',category:'生产动力',effect:'有公共水时，磨粮、脱粒、榨油可免个人行动；每季限一批，仍扣原料与耐用度。',requires:{mechanics:3},inputs:{wood:4,iron:1,shaft:1},from:['P01']},
  {id:'T01',name:'切削工具组',category:'加工工具',effect:'采木多取1木材，扣当地库存与1耐用度。',requires:{materials:1},inputs:{wood:1,iron:1},from:[]},
  {id:'T03',name:'锻打工具组',category:'加工工具',effect:'开放传动轴、阀门制造，每批扣1耐用度。',requires:{materials:2},inputs:{wood:2,iron:2},from:[]},
  {id:'F02',name:'陶窑',category:'加热与材料处理',effect:'开放陶质构件和耐火砖烧制；本人和雇工共用窑位，每批扣1耐用度。',requires:{heat:1,materials:1},inputs:{clay:4,wood:2},from:[]},
  {id:'F03',name:'高温冶炼炉',category:'加热与材料处理',effect:'开放矿料冶铁；本人和雇工共用炉位，每批扣1耐用度。',requires:{heat:2,chemistry:5,materials:4},inputs:{brick:3,wood:2},from:['F02']},
  {id:'F04',name:'热处理炉',category:'加热与材料处理',effect:'开放弹簧热处理，每批扣1耐用度。',requires:{heat:3,materials:6},inputs:{brick:2,iron:2},from:['F03']},
  {id:'F05',name:'蒸馏装置',category:'加热与材料处理',effect:'开放提纯溶液加工，每批扣1耐用度。',requires:{heat:4,chemistry:3},inputs:{ceramics:2,seal:1},from:[]},
  {id:'S01',name:'基础容器',category:'储存与防护',effect:'食品保护容量从4增至8，不产生额外食物。',requires:{materials:1},inputs:{wood:2},from:[]},
  {id:'S02',name:'密闭容器',category:'储存与防护',effect:'食品保护容量增至14，不与基础容器重复叠加。',requires:{materials:3},inputs:{ceramics:1,seal:1},from:['S01']},
  {id:'S03',name:'耐热容器',category:'储存与防护',effect:'热学、化学实验少用1木材（最低0），每次扣1耐用度。',requires:{materials:4,heat:1},inputs:{brick:1,ceramics:1},from:['S01']},
  {id:'U01',name:'翻土犁',category:'农业作业',effect:'播种时本茬潜在收成+1，扣1耐用度。',requires:{agronomy:1,mechanics:1},inputs:{wood:3,iron:1},from:[]},
  {id:'U02',name:'播种器',category:'农业作业',effect:'播种时均匀布种，本茬潜在收成+1，扣1耐用度。',requires:{agronomy:4,mechanics:2},inputs:{wood:2,shaft:1},from:['U01']},
  {id:'U04',name:'收割工具',category:'农业作业',effect:'免除本茬最多1季延迟收获损失，每次收获扣1耐用度。',requires:{agronomy:4,materials:2},inputs:{wood:1,iron:1},from:[]},
  {id:'U05',name:'脱粒装置',category:'农业作业',effect:'2小麦加工为2面粉和1秸秆，每批扣1耐用度。',requires:{agronomy:4,mechanics:2},inputs:{wood:3,shaft:1},from:[]},
  {id:'U06',name:'磨粮装置',category:'农业作业',effect:'2小麦加工为3面粉，每批扣1耐用度，不与脱粒重复结算。',requires:{mechanics:2},inputs:{wood:2,ceramics:1},from:['U05']},
  {id:'U08',name:'排水设施',category:'农业作业',effect:'丰水季自动免除在田作物积水胁迫，每次扣1耐用度。',requires:{agronomy:2},inputs:{wood:2,clay:2},from:[]},
  {id:'U09',name:'堆肥设施',category:'农业作业',effect:'3秸秆跨季腐熟为2堆肥，施肥恢复土壤肥力，每批扣1耐用度。',requires:{agronomy:3},inputs:{wood:2,clay:1},from:[]},
  {id:'U10',name:'育苗设施',category:'农业作业',effect:'播种时提前1季成熟（最低1季），扣1耐用度。',requires:{agronomy:5,materials:2},inputs:{wood:3,ceramics:1},from:['U02']},
];
export const PLANNED_PRODUCTS=[['W02','连续提水机','持续供水'],['W04','压力供水装置','高处供水'],['W05','矿井排水装置','深层采掘'],['W06','分配供水系统','多用途供水'],['P02','脚踏传动装置','腾出双手'],['P04','风力动力装置','风力供能'],['P05','蒸汽动力装置','燃料动力'],['P06','多机动力分配装置','多机协作'],['T02','钻孔工具','孔洞加工'],['T04','车削装置','旋转部件加工'],['T05','动力锤','大型锻件'],['T06','镗削装置','深孔腔加工'],['F01','封闭炉具','稳定热源'],['F06','蒸汽发生装置','提供蒸汽'],['S04','耐腐蚀容器','保存反应物'],['S05','压力容器','承受压力'],['S06','隔热储存箱','温度保存'],['U03','除草工具','控制杂草'],['U07','灌溉管渠','多地块输水']];
export interface ProcessSpec {id:string;name:string;inputs:Record<string,number>;outputs:Record<string,number>;requires:Partial<Record<Subject,number>>;equipment?:string;wait:number;power?:number;}
export const PROCESSES:ProcessSpec[]=[
  {id:'ceramics',name:'烧制陶质构件',inputs:{wood:2,clay:2},outputs:{ceramics:2},requires:{materials:2},equipment:'F02',wait:1},
  {id:'brick',name:'烧制耐火砖',inputs:{wood:2,clay:3},outputs:{brick:2},requires:{materials:4,heat:2},equipment:'F02',wait:1},
  {id:'iron',name:'冶炼铁料',inputs:{ore:2,wood:2},outputs:{iron:2},requires:{chemistry:5},equipment:'F03',wait:1},
  {id:'fiber',name:'加工亚麻纤维',inputs:{flax:2},outputs:{fiber:2},requires:{materials:1},wait:0},
  {id:'rope',name:'搓制绳索',inputs:{fiber:2},outputs:{rope:1},requires:{materials:2},wait:0},
  {id:'oil',name:'压榨植物油',inputs:{soy:3},outputs:{oil:1},requires:{chemistry:1},wait:0},
  {id:'seal',name:'制作密封件',inputs:{fiber:1,oil:1},outputs:{seal:2},requires:{materials:3},wait:0},
  {id:'shaft',name:'制造传动轴',inputs:{wood:2,iron:1},outputs:{shaft:2},requires:{mechanics:3},equipment:'T03',wait:0},
  {id:'valve',name:'制造阀门',inputs:{iron:1,seal:1},outputs:{valve:1},requires:{mechanics:5},equipment:'T03',wait:0},
  {id:'spring',name:'制造弹簧',inputs:{iron:1,wood:1},outputs:{spring:1},requires:{materials:6},equipment:'F04',wait:0},
  {id:'solution',name:'制备提纯溶液',inputs:{soy:1,wood:1},outputs:{solution:1},requires:{chemistry:3},equipment:'F05',wait:0},
  {id:'thresh',name:'脱粒加工',inputs:{wheat:2},outputs:{flour:2,straw:1},requires:{agronomy:4},equipment:'U05',wait:0},
  {id:'mill',name:'磨粮',inputs:{wheat:2},outputs:{flour:3},requires:{mechanics:2},equipment:'U06',wait:0},
  {id:'compost',name:'腐熟堆肥',inputs:{straw:3},outputs:{compost:2},requires:{agronomy:3},equipment:'U09',wait:1},
];
export const WORKER_NAMES:Record<WorkerKind,string>={laborer:'普通雇工',farmer:'熟练农工',artisan:'熟练工匠',manager:'生产负责人'};
export const JOB_NAMES={brick:'耐火砖生产',rope:'绳索生产',oil:'榨油',seal:'密封件生产',shaft:'传动轴生产',valve:'阀门生产',spring:'弹簧生产',solution:'溶液生产',thresh:'脱粒',mill:'磨粮',compost:'堆肥',rest:'暂停',wheat:'小麦种植',soy:'大豆种植',flax:'亚麻种植',ceramics:'陶质构件生产',iron:'冶铁',fiber:'纤维加工'};

export const ALL_TOPICS=[...TOPICS,...MODERN_TOPICS];
export const ALL_GOODS={...GOODS,...MODERN_GOODS};
export const ALL_PRODUCTS=[...PRODUCTS,...MODERN_PRODUCTS];
export const ALL_PROCESSES=[...PROCESSES,...MODERN_PROCESSES];
export const ALL_JOB_NAMES:Record<string,string>={...JOB_NAMES,...Object.fromEntries(MODERN_PROCESSES.map(p=>[p.id,p.name]))};
export const topicsFor=(s:GameState)=>s.economy?.modern?ALL_TOPICS:TOPICS;
export const productsFor=(s:GameState)=>s.economy?.modern?ALL_PRODUCTS:PRODUCTS;
export const processesFor=(s:GameState)=>s.economy?.modern?ALL_PROCESSES:PROCESSES;
export const goodsFor=(s:GameState)=>s.economy?.modern?ALL_GOODS:GOODS;
