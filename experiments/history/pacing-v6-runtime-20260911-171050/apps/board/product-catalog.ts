import type { Ruleset } from '../../src/game/ruleset.js';
import { buildLogicGraph } from './logic-graph.js';
export interface ProductNode {id:string;name:string;category:string;stage:number;planned:boolean;detail:string}
export interface ProductLink {from:string;to:string;label:string;planned:boolean}
export const PRODUCT_CATEGORIES=['食品与储存','药品与医疗','材料与金属','工具与设备','知识成果'];
export function productCatalog(r:Ruleset){
 const graph=buildLogicGraph(r);
 const groups:Record<string,[string,number]>={food:['食品与储存',0],woodenware:['食品与储存',1],pottery:['食品与储存',2],storedWater:['食品与储存',3],publicWater:['食品与储存',0],supplies:['食品与储存',2],wood:['材料与金属',0],clay:['材料与金属',0],ceramicParts:['材料与金属',1],mechanisms:['材料与金属',2],precisionParts:['材料与金属',3],spentCeramics:['材料与金属',2],tool:['工具与设备',0],fieldTools:['工具与设备',1],labTools:['工具与设备',1],calibrator:['工具与设备',2],pump:['工具与设备',3],kiln:['工具与设备',3],findings:['知识成果',1],calibrations:['知识成果',2]};
 const nodes:ProductNode[]=graph.nodes.filter(n=>n.kind===2).map(n=>({id:n.id,name:n.name,category:groups[n.id.slice(2)]?.[0]??'材料与金属',stage:groups[n.id.slice(2)]?.[1]??0,planned:false,detail:n.id==='g:findings'?'由真实材料实验产生，可消耗于工艺改良或仪器校准。不是通用科技点。':n.id==='g:calibrations'?'由校准操作产生，用于提水泵和控温窑制造。不是自动解锁全部科技。':n.detail}));
 const edges:ProductLink[]=[];
 const add=(from:string,to:string,label:string,planned=false)=>{if(from!==to&&!edges.some(e=>e.from===from&&e.to===to&&e.label===label))edges.push({from,to,label,planned});};
 // Collapse a production operation into product relationships; exact bills remain in the detail.
 for(const process of graph.nodes.filter(n=>n.kind===1)){
 const inputs=graph.edges.filter(e=>e.to===process.id&&nodes.some(n=>n.id===e.from));
 const outputs=graph.edges.filter(e=>e.from===process.id&&e.kind==='output'&&nodes.some(n=>n.id===e.to));
 for(const input of inputs)for(const output of outputs)add(input.from,output.to,`${process.name}：${input.label}；${output.label}`);
 }
 for(const e of graph.edges)if(nodes.some(n=>n.id===e.from)&&nodes.some(n=>n.id===e.to))add(e.from,e.to,e.label);
 if(r.technologyFeedback){
   const f=r.technologyFeedback;
   nodes.push({id:'f:workbench',name:'木工作台',category:'工具与设备',stage:1,planned:false,detail:'掌握木材加工后建造，花'+f.buildActions+'行动、'+f.workbenchWood+'木材；开放木容器批量制作。设施跨代保留。'},
     {id:'f:potteryKiln',name:'陶窑',category:'工具与设备',stage:1,planned:false,detail:'掌握陶作后建造，花'+f.buildActions+'行动、'+f.kilnWood+'木材、'+f.kilnClay+'黏土；开放陶器批量制作，仍需跨季干燥。'});
   add('g:wood','f:workbench','建造投入'+f.workbenchWood+'木材');add('f:workbench','g:woodenware','掌握木作后开放批量制作，仍消耗配方材料');
   add('g:wood','f:potteryKiln','建造投入'+f.kilnWood+'木材');add('g:clay','f:potteryKiln','建造投入'+f.kilnClay+'黏土');add('f:potteryKiln','g:pottery','掌握陶作后开放批量制作，仍消耗配方材料');
 }
 const plans:[string,string,string,number,string][]=[
 ['grain','谷物','食品与储存',0,'将现有口粮细分为可加工谷物；需要先定义产地、季节与保存规则。'],
 ['flour','面粉','食品与储存',1,'研磨谷物得到加工原料；预期由磨具改变加工方式，尚无配方或数值。'],
 ['bread','熟制主食','食品与储存',2,'面粉经烹制供食用；需定义燃料、保质期与食用收益。'],
 ['preserved','干燥与发酵食品','食品与储存',3,'通过不同保存工艺跨季供食；不是统一高级口粮加成。'],
 ['herbs','药用植物','药品与医疗',0,'仅为医疗分支规划起点；药效需要疾病、剂量与风险机制支撑。'],
 ['medicine','药剂','药品与医疗',2,'供特定治疗使用；当前没有健康、疾病和治疗结算，不能在游戏中服用。'],
 ['copperOre','铜矿石','材料与金属',0,'需要新增矿产获取与冶炼规则。'],['copper','铜材','材料与金属',1,'冶炼所得材料；需要明确燃料、炉温和损耗。'],
 ['bronze','青铜材','材料与金属',2,'铜材与锡料合金路线；待定义配比和具体用途。'],['tin','锡料','材料与金属',1,'青铜路线的另一种投入，尚无获取机制。'],
 ['ironOre','铁矿石','材料与金属',0,'独立矿产路线，不要求先制造铜制品。'],['iron','铁材','材料与金属',2,'冶炼与锻造路线；尚未定义炉具、燃料和工序。'],
 ['mill','磨具','工具与设备',1,'加工谷物；需要定义手工研磨与机械磨的差异。'],['furnace','冶炼炉','工具与设备',1,'专用冶炼设备，不能把现有控温窑直接冒充冶金设备。'],
 ['copperTools','铜制工具','工具与设备',2,'具体用途待定义，例如加工适用范围、可修复性，而非只增加效率。'],['ironTools','铁制工具','工具与设备',3,'用于更困难的加工或作业；须定义能力门槛与维护成本。'],
 ['arithmetic','算术表与计算方法','知识成果',0,'数学成果：可保存、传授的计算方法；预期服务记账、配料与测量，尚不参与结算。'],
 ['geometry','几何测量记录','知识成果',1,'数学成果：由测量实践形成可复用记录；现有地形测量科技不等于已实现这份产品。'],
 ['mechanicsModel','力学模型','知识成果',2,'物理成果：由实验与数学表达形成模型，预期用于设计验证。'],
 ['thermalModel','热学实验记录','知识成果',2,'物理成果：研究热加工条件，预期支持炉具设计；目前无热学规则。'],
 ['design','工程设计图','知识成果',3,'知识成果进入具体工具设计；必须区分图样、制造能力和可用设备。']
 ];
 for(const [id,name,category,stage,detail] of plans)nodes.push({id:'p:'+id,name,category,stage,planned:true,detail});
 for(const [a,b,label] of [
 ['grain','flour','研磨原料'],['mill','flour','工具支持加工'],['flour','bread','烹制原料'],['grain','preserved','保存工艺'],['herbs','medicine','制剂原料'],
 ['copperOre','copper','冶炼'],['furnace','copper','设备条件'],['copper','bronze','合金原料'],['tin','bronze','合金原料'],['copper','copperTools','加工'],['ironOre','iron','冶炼'],['furnace','iron','设备条件'],['iron','ironTools','锻造'],
 ['arithmetic','geometry','计算支持测量'],['geometry','mechanicsModel','建模支持'],['mechanicsModel','design','设计依据'],['thermalModel','design','热加工依据'],['design','furnace','炉具设计'],['design','mill','工具设计']])add('p:'+a,'p:'+b,label+'（规划假设）',true);
 return {nodes,edges,graph};
}
