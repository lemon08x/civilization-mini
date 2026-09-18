import type { Subject } from '../model/economy.js';
import type { ProductSpec,ProcessSpec } from './economy-catalog.js';

const names:Record<Subject,string[]>={
 mechanics:['流体机械与气压传动','电磁感应与动力转换','电子器件与信号','自动控制与机器人'],
 heat:['高压蒸汽与内燃循环','相变制冷与热泵','能效与余热回收','清洁能源系统集成'],
 chemistry:['电化学与电池','有机合成与高分子','半导体提纯与制程','循环化学与污染治理'],
 materials:['电工材料与绝缘','精密合金与结构材料','半导体与光伏材料','先进复合材料与制造'],
 agronomy:['矿质营养与土壤化学','设施农业与环境控制','传感监测与精准农业','循环农业与资源管理'],
 organization:['标准件与流水装配','通信网络与调度','数字化生产与追溯','协同控制与韧性运营'],
};
const prefix:Record<Subject,string>={mechanics:'L',heat:'H',chemistry:'C',materials:'M',agronomy:'A',organization:'O'};
export const MODERN_TOPICS=Object.entries(names).flatMap(([s,ns])=>ns.map((name,i)=>({id:prefix[s as Subject]+String(i+7).padStart(2,'0'),subject:s as Subject,level:i+7,name})));
export const MODERN_GOODS=Object.fromEntries([
 ['copper','铜料',3],['feedstock','化工原料',3],['mineral','矿质肥料原料',2],['silica','石英原料',2],
 ['polymer','绝缘聚合物',5],['wire','绝缘铜线',6],['coil','电机线圈',9],['cable','输电电缆',9],
 ['fuel','精炼燃料',5],['nutrient','配方肥料',4],['battery','蓄电池单元',8],['silicon','高纯硅',7],
 ['circuit','电子电路',12],['controller','数字控制器',16],['composite','复合结构件',10],
].map(([id,name,price])=>[id as string,{name:name as string,price:price as number,food:0}]));
export const MODERN_PRODUCTS:ProductSpec[]=[
 {id:'W07',name:'电动离心泵',category:'现代供水',effect:'工程排水每季用1电、1耐用，不再燃烧现场木材；与其他用电负载竞争。',requires:{mechanics:7,materials:7},inputs:{iron:2,coil:1,seal:2},from:['W03']},
 {id:'E01',name:'水力发电机组',category:'电力与储能',effect:'开启供能后每季最多一次，消耗1公共水和1耐用，产生6电。',requires:{mechanics:8,materials:7},inputs:{coil:2,shaft:1,ceramics:2},from:['P03']},
 {id:'E02',name:'燃料发电机组',category:'电力与储能',effect:'开启供能后每季最多一次，消耗1精炼燃料和1耐用，产生6电。',requires:{heat:7,mechanics:8,materials:7},inputs:{coil:1,valve:2,brick:2},from:[]},
 {id:'E03',name:'光伏阵列',category:'电力与储能',effect:'开启供能后每季消耗1耐用；丰水季发2电，其他天气发4电，不消耗公共水。',requires:{heat:10,materials:9},inputs:{silicon:3,circuit:1,cable:2},from:[]},
 {id:'E04',name:'储能柜',category:'电力与储能',effect:'季末把最多6份余电存入电池，跨季保留；手动或季末供能时放电，每次充电扣1耐用。',requires:{chemistry:7,materials:7},inputs:{battery:3,cable:1},from:[]},
 {id:'F07',name:'化工反应设备',category:'现代制造',effect:'开放精炼燃料与蓄电池单元组装，逐批扣耐用与原料。',requires:{heat:7,chemistry:8},inputs:{iron:3,seal:2,valve:1},from:['F05']},
 {id:'T07',name:'电动标准化装配台',category:'现代制造',effect:'组织7阶时，雇员即时配方按双份原料生产；每批另用1电与1耐用，不与经验叠成四倍。',requires:{organization:7},inputs:{shaft:2,coil:1,iron:2},from:['T03']},
 {id:'F09',name:'电子洁净制造台',category:'现代制造',effect:'开放高纯硅、电子电路、数字控制器，逐批用电；不能用普通工匠绕过现代工艺知识。',requires:{chemistry:9,materials:9},inputs:{ceramics:2,cable:2,polymer:2},from:[]},
 {id:'F10',name:'材料回收与复合设备',category:'现代制造',effect:'回收废料与制造复合结构件，仍耗电和加工材料，不凭空生成资源。',requires:{chemistry:10,materials:10},inputs:{controller:1,iron:2,cable:1},from:[]},
 {id:'N08',name:'无线电调度站',category:'通信与控制',effect:'开启服务后每季用1电与1耐用；当季工地运力+1，并形成通信运行凭据。',requires:{mechanics:9,organization:8},inputs:{circuit:1,cable:1,coil:1},from:[]},
 {id:'N10',name:'数字协同控制中心',category:'通信与控制',effect:'组织10、力学10时服务每季用1电与1耐用；真实通信同时在线才形成协同控制凭据。',requires:{mechanics:10,organization:10},inputs:{controller:2,cable:2,composite:1},from:['N08']},
 {id:'S08',name:'热泵冷库',category:'现代农业',effect:'开启服务每季用1电与1耐用；当季食品保护容量至少30，断电回到原有储存设施。',requires:{heat:8,chemistry:8},inputs:{coil:1,seal:2,polymer:1},from:['S02']},
 {id:'U08M',name:'环境控制温室',category:'现代农业',effect:'服务每季用1电与1耐用；该季作物免天气胁迫，仍要生长和收获。',requires:{agronomy:8,heat:8},inputs:{polymer:2,coil:1,cable:1},from:['U10']},
 {id:'U09M',name:'精准农业传感站',category:'现代农业',effect:'服务每季用1电与1耐用；农学9时使在田作物本茬额外产量至少+2，不能逐季无限叠加。',requires:{agronomy:9,organization:9},inputs:{circuit:1,controller:1},from:['U08M']},
 {id:'H09',name:'余热回收换热器',category:'电力与储能',effect:'燃料机组发电时追加2电，另扣1耐用；没有燃料发电就没有余热收益。',requires:{heat:9},inputs:{copper:2,seal:1,shaft:1},from:['E02']},
];
export const MODERN_PROCESSES:ProcessSpec[]=[
 {id:'polymer',name:'制备绝缘聚合物',inputs:{feedstock:2,oil:1},outputs:{polymer:2},requires:{chemistry:8},equipment:'F07',wait:1},
 {id:'wire',name:'制造绝缘铜线',inputs:{copper:1,polymer:1},outputs:{wire:2},requires:{materials:7},wait:0},
 {id:'coil',name:'绕制电机线圈',inputs:{wire:2,iron:1},outputs:{coil:1},requires:{mechanics:8},equipment:'T03',wait:0},
 {id:'cable',name:'制造输电电缆',inputs:{wire:2,seal:1},outputs:{cable:1},requires:{materials:8},wait:0},
 {id:'fuel',name:'精炼燃料',inputs:{feedstock:2},outputs:{fuel:2},requires:{heat:7,chemistry:8},equipment:'F07',wait:1},
 {id:'nutrient',name:'调配矿质肥料',inputs:{mineral:2,solution:1},outputs:{nutrient:3},requires:{agronomy:7},equipment:'F07',wait:1},
 {id:'battery',name:'组装蓄电池单元',inputs:{copper:1,solution:1,polymer:1},outputs:{battery:1},requires:{chemistry:7},equipment:'F07',wait:0},
 {id:'silicon',name:'提纯半导体硅',inputs:{silica:2,solution:1},outputs:{silicon:1},requires:{chemistry:9,materials:9},equipment:'F09',wait:1,power:2},
 {id:'circuit',name:'制造电子电路',inputs:{silicon:1,wire:1,polymer:1},outputs:{circuit:1},requires:{mechanics:9,materials:9},equipment:'F09',wait:0,power:2},
 {id:'controller',name:'组装数字控制器',inputs:{circuit:2,cable:1},outputs:{controller:1},requires:{mechanics:10,organization:9},equipment:'F09',wait:0,power:2},
 {id:'composite',name:'制造复合结构件',inputs:{polymer:1,fiber:2,iron:1},outputs:{composite:2},requires:{materials:10},equipment:'F10',wait:0,power:1},
 {id:'recycle',name:'分选回收材料',inputs:{battery:1},outputs:{copper:1},requires:{chemistry:10},equipment:'F10',wait:0,power:1},
];
