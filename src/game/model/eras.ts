export interface EraRules { generationLimit:number; rewardDivisor:number; dungeonTarget:number; }
export interface EraState {
 rules:EraRules; index:number; elapsed:number; card:string;
 // A payable economic claim, not a production statistic. Settled into household money when the player chooses or the time budget expires.
 rewardEscrow:number; closed:boolean; groundwater:number; tap:boolean; pendingSettle:boolean;
 startGeneration:number;
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
export const ERAS=[
 {id:'agriculture',name:'农业村落',imports:2,service:3,foodWeight:3,craftWeight:1,gatherBonus:1,workBonus:1,publicWell:false,publicMill:false,description:'农社靠天吃饭。公地采食和帮工不耗科技；收获回报高。成形、流体、泵和工厂知识尚未开放。'},
 {id:'town',name:'集镇分工',imports:3,service:4,foodWeight:2,craftWeight:2,gatherBonus:0,workBonus:0,publicWell:true,publicMill:false,description:'集镇提供公井灌溉，不必先造泵。市集扩大；密封、流体、泵和分工课程在此开放。'},
 {id:'industry',name:'工业城镇',imports:4,service:6,foodWeight:1,craftWeight:3,gatherBonus:0,workBonus:0,publicWell:true,publicMill:true,description:'公共采购提供稳定铁料和电工材料；公共磨坊可把小麦磨成面粉。水力、发电和工厂管理在此开放。'},
 {id:'modern',name:'现代社会',imports:6,service:8,foodWeight:1,craftWeight:3,gatherBonus:0,workBonus:0,publicWell:false,publicMill:true,description:'市政配送口粮、可付费自来水。配电课程与四类存续危机在此开放。自来水不追溯取消前期水井的价值。'},
];
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
