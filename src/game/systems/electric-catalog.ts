import type {ProductSpec,ProcessSpec} from './economy-catalog.js';
export const ELECTRIC_GOODS={alumina:{name:'氧化铝原料',price:2,food:0},aluminium:{name:'铝料',price:3,food:0}};
export const ELECTRIC_PRODUCTS:ProductSpec[]=[
 {id:'LAMP',name:'电灯',category:'电器',requires:{},inputs:{wire:2,ceramics:1},from:[],effect:'启用后手动执行供能，每季首次点亮耗1电、1耐用，增加2可用时间，可安排夜间学习；不免除精力成本。'},
 {id:'TELEGRAPH',name:'电报终端',category:'电器',requires:{},inputs:{coil:1,cable:1,wood:2},from:[],effect:'启用后手动执行供能，每季耗1电、1耐用，当季新订货即时交付；仍受库存、资金和运输限制，不加速维修。'},
 {id:'ELECTROLYZER',name:'电解槽',category:'电器',requires:{},inputs:{cable:2,seal:1,ceramics:2},from:[],effect:'开放氧化铝电解，每批耗3电与1耐用，将2氧化铝原料制成2铝；铝线工艺可替代铜线投入。'},
];
export const ELECTRIC_PROCESSES:ProcessSpec[]=[
 {id:'aluminium',name:'电解制铝',inputs:{alumina:2},outputs:{aluminium:2},requires:{},equipment:'ELECTROLYZER',wait:0,power:3},
 {id:'aluminiumwire',name:'以铝制造绝缘导线',inputs:{aluminium:1,polymer:1},outputs:{wire:2},requires:{},wait:0},
];
