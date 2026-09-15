import type {GameState} from '../model/state.js';
import type {FoodPolicy} from '../model/social-food.js';
import {defineAction,type ActionDefinition} from './definition.js';
import {FOOD_POLICIES,socialFoodEvent} from '../systems/social-food.js';
import {branchNeeds} from '../systems/branches.js';
export function socialFoodActions(s:GameState):ActionDefinition[]{
 const f=s.socialFood;if(!f)return [];
 const out:ActionDefinition[]=[];
 for(const [mode,label] of Object.entries(FOOD_POLICIES))out.push(defineAction(s,'economy:foodpolicy:'+mode,label,'社会食品',{ap:0},f.policy===mode?['已经是此安排']:[],{off:'暂停持续采购；仍可手动购买并食用家中粮食。',self:'先使用家中食品，仅购买本季缺口。',market:'优先购买本季即食食品，保留加工用粮；钱货不足时仍可吃家中粮食。',reserve:'覆盖本季生活后，尝试补足设定的家庭储备；受预算和供应限制，超出保存能力仍会损耗。'}[mode]!, (d,ev)=>{d.socialFood!.policy=mode as FoodPolicy;socialFoodEvent(ev,'policy','生活安排：'+label);}));
 for(const budget of [0,2,4,8,12])out.push(defineAction(s,'economy:foodbudget:'+budget,`每季购粮预算${budget}钱`,'社会食品',{ap:0},f.budget===budget?['已是此预算']:[],'只设定食品采购上限，不提前扣钱，不冻结现钱；季末按可用资金结算。',(d,ev)=>{d.socialFood!.budget=budget;socialFoodEvent(ev,'budget','每季食品采购预算上限'+budget+'钱');}));
 for(const reserve of [0,2,4,8])out.push(defineAction(s,'economy:foodreserve:'+reserve,`饭后储备目标${reserve}份`,'社会食品',{ap:0},f.reserve===reserve?['已是此目标']:[],'仅影响保留储备模式；目标为本季进食后、保存损耗前的全部可食库存。',(d,ev)=>{d.socialFood!.reserve=reserve;socialFoodEvent(ev,'reserve','饭后储备目标'+reserve+'份');}));
 for(const delivery of [true,false])out.push(defineAction(s,'economy:foodplan:'+(delivery?'on':'off'),delivery?'委托社会配送':'改为本人赶集','社会食品',{ap:0},[...(f.delivery===delivery?['已是此安排']:[]),...(s.era?.index===3?['现代零售已提供配送，无需切换']:delivery?branchNeeds(s,['O0']):[])],delivery?'沿用长期供粮服务，由社会人员配送；本人不耗赶集时间，仍按实际数量付粮款并消耗人员服务额度、共享市场库存与运输。不改变生活策略。':'以后需要采购时预留赶集时间；取消配送不暂停采购，暂停请使用“暂停自动购买”。',(d,ev)=>{d.socialFood!.delivery=delivery;socialFoodEvent(ev,'delivery',delivery?'已委托社会食品配送':'改为本人赶集');}));
 return out;
}
