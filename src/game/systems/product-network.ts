import type { Ruleset } from '../ruleset.js';
import { PASSIVE_EFFECTS } from './investment.js';
import type { GameState } from '../model/state.js';
import type { Device, Product, ProductNetworkState } from '../model/product-network.js';
import { NETWORK_NAMES } from '../model/product-network.js';
import { GOOD_NAMES } from '../model/development.js';
import { DEVELOPMENT_RECIPES } from './development.js';
export const PRODUCT_NAMES = {...GOOD_NAMES,...NETWORK_NAMES};
export const DEVICE_RECIPES: {id:Device; method:string; inputs:Partial<Record<Product,number>>; effect:string}[] = [
  {id:'calibrator',method:'experimentation',inputs:{precisionParts:1,labTools:1},effect:'开启校准：将研究记录转成校准报告；报告用于高级设备制造。'},
  {id:'pump',method:'mechanics',inputs:{precisionParts:1,mechanisms:1,calibrations:1},effect:'开启提水：无渠道也可把公共水转存家用，供后续缺水耕作；无水可取时仍无效。'},
  {id:'kiln',method:'ceramic-engineering',inputs:{precisionParts:1,ceramicParts:2,calibrations:1},effect:'开启回收烧结：实验用后陶料重新制成构件，形成材料回路。'},
];
export function initialProductNetwork():ProductNetworkState {return {goods:{calibrator:0,pump:0,kiln:0,calibrations:0,spentCeramics:0},installed:{calibrator:0,pump:0,kiln:0},storedWater:0,project:null};}
export function productAmount(s:GameState,id:Product):number {return id in s.productNetwork!.goods?s.productNetwork!.goods[id as keyof ProductNetworkState['goods']]:s.development!.goods[id as keyof typeof GOOD_NAMES];}
export function changeProduct(s:GameState,id:Product,amount:number):void {
  if(id in s.productNetwork!.goods)s.productNetwork!.goods[id as keyof ProductNetworkState['goods']]+=amount;
  else s.development!.goods[id as keyof typeof GOOD_NAMES]+=amount;
}
export function productNetworkView(s:GameState,rules?:Ruleset){
  const edges:{from:string;to:string;kind:'consumed'|'enables'|'returns';label:string}[]=[];
  for(const r of DEVELOPMENT_RECIPES)for(const[id,n]of Object.entries(r.inputs))edges.push({from:id,to:r.output,kind:'consumed',label:`投入${n}`});
  for(const r of DEVICE_RECIPES)for(const[id,n]of Object.entries(r.inputs))edges.push({from:id,to:r.id,kind:'consumed',label:`投入${n}`});
  edges.push({from:'labTools',to:'findings',kind:'enables',label:'装备后实验增加记录'},{from:'fieldTools',to:'supplies',kind:'enables',label:'装备后改善收成，余粮再加工'}, {from:'supplies',to:'findings',kind:'consumed',label:'实验消耗1'},{from:'ceramicParts',to:'findings',kind:'consumed',label:'实验消耗1'},
    {from:'findings',to:'calibrations',kind:'consumed',label:'校准消耗1'},{from:'supplies',to:'calibrations',kind:'consumed',label:'校准消耗1'},
    {from:'calibrator',to:'calibrations',kind:'enables',label:'安装后校准'},
    {from:'pump',to:'storedWater',kind:'enables',label:'提取公共水，容量2'},
    {from:'storedWater',to:'supplies',kind:'enables',label:'用于缺水耕作，余粮再加工'},
    {from:'ceramicParts',to:'spentCeramics',kind:'returns',label:'实验后留下1'},
    {from:'kiln',to:'ceramicParts',kind:'enables',label:'安装后回收烧结'},
    {from:'spentCeramics',to:'ceramicParts',kind:'returns',label:'2用后陶料 + 1木材 → 1构件'});
  return {...structuredClone(s.productNetwork!),devices:DEVICE_RECIPES.map(r=>({...r,effect:rules?.passiveInvestment?PASSIVE_EFFECTS[r.id]+" 每季至多1次，每次扣1耐用度，不花行动；缺料自动停机。":r.effect,inputs:{...r.inputs}})),nodes:[...Object.entries(PRODUCT_NAMES).map(([id,name])=>({id,name,amount:productAmount(s,id as Product)})),{id:'storedWater',name:'家用蓄水',amount:s.productNetwork!.storedWater}],edges};
}
