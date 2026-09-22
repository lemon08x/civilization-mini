export interface EraRules { generationLimit:number; rewardDivisor:number; dungeonTarget:number; timeCarryPercent:number; }
export interface EraState {
 rules:EraRules; frameworkId:string; index:number; elapsed:number; card:string;
 // A payable economic claim, not a production statistic. Settled into household money when the player chooses or the time budget expires.
 rewardEscrow:number; closed:boolean; groundwater:number; tap:boolean; pendingSettle:boolean;
 startGeneration:number;
 // Additional calendar seasons received from the previous civilization stage.
 timeBonus?:number;
 crises?:{remaining:number; won:boolean|null; entries:Record<string,{level:number;step:number;route:string;lastTurn:number}>};
 dungeon:{started:boolean;tasks:string[];powered?:boolean};
}
// 现代家业试炼的一次性任务清单；progress 是该任务的分值权重，电力相关任务的电力量另读 electric 规则。
export const DUNGEON_TASKS=[
 {id:'food',name:'交付4份家庭余粮',progress:1},
 {id:'craft',name:'交付2根传动轴',progress:2},
 {id:'contract',name:'支付10钱委托施工',progress:1},
 {id:'math',name:'完成一轮数学方案验算',progress:1},
 {id:'power',name:'交付4份可用电完成通电验收',progress:2},
 {id:'appliance',name:'交付一台可用电器',progress:3},
];
// 社会发展框架：开局选择，决定四个阶段的名称、重心、课程开放批次、公共服务与经济加成。
// FrameworkStage 是完整实现的一阶段；预告框架只填大纲（FrameworkOutline.stages 的大纲形状），无数值。
export interface FrameworkStageOutline {id:string;name:string;focus:string;description:string;}
export interface FrameworkStage extends FrameworkStageOutline {
 imports:number;service:number;foodWeight:number;craftWeight:number;gatherBonus:number;workBonus:number;
 publicWell:boolean;publicMill:boolean;courses:string[];
}
export interface FrameworkOutline {id:string;name:string;summary:string;implemented:boolean;stages:FrameworkStageOutline[];}
const RIVERINE_STAGES:FrameworkStage[]=[
 {id:'farming',name:'农耕村落',focus:'农场',imports:2,service:3,foodWeight:3,craftWeight:1,gatherBonus:1,workBonus:1,publicWell:false,publicMill:false,courses:['A0','A1','A2','A3','A4','A5','A6','A7','A8','A9','A10','A11','M0','M3','L0'],description:'农社靠天吃饭。公地采食和帮工不耗科技；收获回报高。成形、流体、泵和工厂知识尚未开放。'},
 {id:'township',name:'市镇百工',focus:'水力机械与市镇手工业',imports:3,service:4,foodWeight:2,craftWeight:2,gatherBonus:0,workBonus:0,publicWell:true,publicMill:true,courses:['M1','M2','L1','L2','L3','L4','O1','O3','Q0','Q1','Q2'],description:'市镇提供公井灌溉，不必先造泵；公共磨坊以水力把小麦磨成面粉。市集扩大；密封、流体、泵、水力与加工工序在此开放。'},
 {id:'electric',name:'电力工业',focus:'购置设备、组织生产与市场经营',imports:4,service:6,foodWeight:1,craftWeight:3,gatherBonus:0,workBonus:0,publicWell:true,publicMill:true,courses:['M4','M5','L5','L6','L7','O0','O2','O4','O5'],description:'公共采购提供稳定铁料和电工材料；用电、劳动分工与经营安排在此开放；发电设备制造为可选专业支线。'},
 {id:'modern',name:'现代社会',focus:'资本经营（筹备中）与存续使命',imports:6,service:8,foodWeight:1,craftWeight:3,gatherBonus:0,workBonus:0,publicWell:false,publicMill:true,courses:[],description:'市政配送口粮、可付费自来水。资本科技尚在筹备，四类存续危机在此开放。自来水不追溯取消前期水井的价值。'},
];
export const FRAMEWORKS:FrameworkOutline[]=[
 {id:'riverine',name:'大河农耕',summary:'以中华文明为背景，沿大河安顿农耕，从村落走到市镇百工，再经电力工业进入现代社会。',implemented:true,stages:RIVERINE_STAGES},
 {id:'maritime',name:'爱琴海城邦',summary:'以古希腊文明为灵感，从橄榄园与葡萄园出发，发展陶器作坊与海上贸易。',implemented:false,stages:[
  {id:'port',name:'海岸聚落',focus:'橄榄、葡萄与渔业',description:'经营海岸农园，利用近海资源。'},
  {id:'guild',name:'城邦作坊',focus:'陶器、榨油与航海贸易',description:'把农产加工为货物，通过港口交换。'},
  {id:'electric',name:'港口工业',focus:'工业与远洋市场',description:'游戏设想：发展港口工业与远洋市场。'},
  {id:'modern',name:'现代社会',focus:'资本与金融',description:'游戏设想：进入现代资本经营。'},
 ]},
 {id:'highland',name:'安第斯文明',summary:'以印加及其前身文明为灵感，从高山梯田、薯类与藜麦出发，发展驼羊毛织造与山地交换。',implemented:false,stages:[
  {id:'mine',name:'高山梯田',focus:'薯类、藜麦与驼羊',description:'适应山地环境，经营梯田与畜群。'},
  {id:'workshop',name:'织造聚落',focus:'毛织、食物保存与山地运输',description:'加工纤维与农产，沿山路交换物资。'},
  {id:'electric',name:'山地工业',focus:'工业与区域市场',description:'游戏设想：发展山地工业与区域市场。'},
  {id:'modern',name:'现代社会',focus:'资本与金融',description:'游戏设想：进入现代资本经营。'},
 ]},
 {id:'polder',name:'尼罗河文明',summary:'以古埃及文明为灵感，依河水泛滥耕种小麦与亚麻，发展灌渠、织布与河运。',implemented:false,stages:[
  {id:'garden',name:'河谷农庄',focus:'泛滥农业与亚麻',description:'顺应河水涨落，经营河谷农田。'},
  {id:'market',name:'河运工坊',focus:'织布、纸草与水利',description:'加工亚麻与纸草，依托河运交换产品。'},
  {id:'electric',name:'河谷工业',focus:'工业与河运市场',description:'游戏设想：发展河谷工业与区域市场。'},
  {id:'modern',name:'现代社会',focus:'资本与金融',description:'游戏设想：进入现代资本经营。'},
 ]},
];
export function frameworkById(id?:string):FrameworkOutline{return FRAMEWORKS.find(f=>f.id===id)??FRAMEWORKS[0];}
export function eraStages(s:{era?:{frameworkId?:string}}):FrameworkStage[]{const f=frameworkById(s.era?.frameworkId);return (f.implemented?f:FRAMEWORKS[0]).stages as FrameworkStage[];}
export function stageOf(s:{era?:{index:number;frameworkId?:string}}):FrameworkStage{const stages=eraStages(s);return stages[Math.min(s.era?.index??0,stages.length-1)];}
// 课程 id 在框架各阶段 courses 中的批次索引；未列出视为开局即开放（0）。
export function frameworkUnlockStage(frameworkId:string|undefined,courseId:string):number{
 const f=frameworkById(frameworkId);if(!f.implemented)return 0;
 const i=(f.stages as FrameworkStage[]).findIndex(st=>st.courses.includes(courseId));
 return i<0?0:i;
}
export const ERA_CARDS=[
 {id:'trade',name:'商贸繁荣',imports:2,price:1,income:2,learning:0,care:0,metal:0,description:'食品到货+2，粮价+1，临时做工收入+2；生活和经营都更依赖现金。'},
 {id:'education',name:'重视教育',imports:0,price:0,income:0,learning:1,care:0,metal:0,description:'首次学习少1时间；生产回报凭证按九成计算，教育投入与当期回报需要取舍。'},
 {id:'industry',name:'工业扩张',imports:-1,price:0,income:0,learning:0,care:0,metal:2,description:'金属原料供应+2，食品到货-1；农业和采购仍是可用退路。'},
 {id:'mutual',name:'地方互助',imports:1,price:0,income:0,learning:0,care:1,metal:-1,description:'疗养少1钱，食品到货+1，金属原料供应-1（不少于1）；基础生活更易保障。'},
];

export const CRISES=[
 {id:'ai',name:'智能系统失控',purpose:'校验失控系统并维持关键服务',technical:['Q1','L0'],coordination:['Q2','O2'],goods:'wire',advanced:'L7'},
 {id:'bio',name:'生物安全危机',purpose:'防护检测与生活保障，阻断系统性扩散',technical:['M3','A1'],coordination:['O1','M0'],goods:'clay',advanced:'M2'},
 {id:'nuclear',name:'核升级与战争危机',purpose:'建立可靠核验与应急通信，降低误判',technical:['Q1','L5'],coordination:['O2','Q2'],goods:'iron',advanced:'M5'},
 {id:'climate',name:'生态与气候危机',purpose:'以持续粮水保障应对复合气候冲击',technical:['A1','L3'],coordination:['A3','O2'],goods:'wood',advanced:'A4'},
] as const;
export const CRISIS_LEVELS=['未完成','兜底','稳局','周全'];
