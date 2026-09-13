import type { GameState } from '../model/state.js';
import { defineAction,type ActionDefinition } from './definition.js';
import { ALL_PRODUCTS } from '../systems/economy-catalog.js';
import { GENERATORS,SERVICES,generateModern,serveModern,modernEvent } from '../systems/modern.js';
import { equipped,requirements,missingGoods,changeGoods,recordEvidence } from '../systems/economy.js';

export function modernActions(s:GameState):ActionDefinition[]{
 const m=s.economy?.modern;if(!m)return [];
 const out:ActionDefinition[]=[];
 for(const id of [...GENERATORS,'E04',...SERVICES])for(const on of [true,false])out.push(defineAction(s,`economy:utility:${id}-${on?'on':'off'}`,`${on?'启用':'停用'}${ALL_PRODUCTS.find(p=>p.id===id)!.name}`,'能源',{ap:0},[
  ...(!equipped(s,id)&&on?['需可用设备']:[]),...(m.enabled.includes(id)===on?['已是当前安排']:[]),
 ],'设备按真实原料、电力与耐用运行；启停本身不产生电。',(d,ev)=>{
  const x=d.economy!.modern!;x.enabled=x.enabled.filter(k=>k!==id);if(on)x.enabled.push(id);modernEvent(ev,id,on?'设备已启用':'设备已停用');
 })) ;
 out.push(defineAction(s,'economy:energize:now','执行本季供能与服务','能源',{ap:1},s.economy!.operations?.paused?['先接续家业']:[],'按水电、燃料、光伏、储能、通信、控制、冷库、温室、传感顺序运行；发电每设备每季最多一次。季末也自动尝试。',(d,ev)=>{generateModern(d,ev);serveModern(d,ev);}));
 out.push(defineAction(s,'economy:nutrient:field','施用配方肥料','农业',{ap:1},[
  ...requirements(s,{agronomy:7}),...missingGoods(s,{nutrient:1}),...(!s.economy!.field.crop?['先播种']:[]),...(s.economy!.field.composted?['本茬已施肥']:[]),
 ],'消耗1肥料，本茬产量+2、肥力+1（上限3），不无限翻倍。',(d,ev)=>{changeGoods(d,{nutrient:1},-1,ev,'配方施肥');const f=d.economy!.field;f.bonus+=2;f.fertility=Math.min(3,f.fertility+1);f.composted=true;recordEvidence(d,'agronomy',ev,'矿质营养施肥');}));
 out.push(defineAction(s,'economy:reclaim:straw','循环利用秸秆','农业',{ap:1},[...requirements(s,{agronomy:10}),...missingGoods(s,{straw:2})],'2秸秆制成2堆肥，提高有机物回田效率，不生成金属。',(d,ev)=>{changeGoods(d,{straw:2},-1,ev,'循环农业');changeGoods(d,{compost:2},1,ev,'循环农业产出');}));
 return out;
}
