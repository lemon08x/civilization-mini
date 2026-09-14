import { processesFor } from '../systems/economy-catalog.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { Crop,Work } from '../model/economy.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';
import { CROPS,ALL_PRODUCTS as PRODUCTS } from '../systems/economy-catalog.js';
import { organizationLevel,missingGoods,changeGoods } from '../systems/economy.js';
import { opEvent,reserveFood,REGIONAL_PROJECTS,projectBlockers,completed,foodTarget } from '../systems/operations.js';
export function operationsActions(s:GameState,r:Ruleset):ActionDefinition[]{
 const e=s.economy!,o=e.operations!,out:ActionDefinition[]=[],org=organizationLevel(s);
 const add=(op:string,target:string,label:string,cost:Parameters<typeof defineAction>[4],blockers:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${target}`,label,'经营',cost,[...blockers,...(o.paused&&!['resumeplans','charter','projectpause'].includes(op)&&target!=='off'?['先接续家族经营安排']:[])],description,execute));
 add('resumeplans','family','接续家族经营安排',{},o.paused?[]:['经营安排未暂停'],'恢复保存的供粮、农业、生产、补货与维护配置。订立家族契约可让未来换代自动接续。',(d,ev)=>{const ops=d.economy!.operations!;ops.paused=false;if(ops.farm&&d.economy!.workers.farmer)d.economy!.workers.farmer!.active=true;if(ops.production&&d.economy!.workers.artisan)d.economy!.workers.artisan!.active=true;reserveFood(d,r,ev);opEvent(ev,'resumed','family','经营安排已接续');});
 for(const active of [true,false]){
  const t=active?'on':'off';
  if(!s.socialFood)add('foodplan',t,active?'签订长期供粮协议':'暂停供粮协议',{},[...(active&&org<1?['需生产组织1阶或家族记录']:[]),...(o.food===active?['已经是此安排']:[])],`季末按需购入至${foodTarget(s,r)}份可食储备，按普通粮价付费、不花行动；每季先从市场预留供应，缺钱才停供。`,(d,ev)=>{const ops=d.economy!.operations!;ops.food=active;if(active)reserveFood(d,r,ev);else{d.production!.market.food+=ops.foodReserved;ops.foodReserved=0;}opEvent(ev,'plan','food',active?'长期供粮已签订':'供粮已暂停');});
  for(const [op,key,label,required]of [['supplyplan','supplies','自动补货',2],['salesplan','sales','自动交付',2],['careplan','maintenance','委托维护',2]] as const){
   add(op,t,(active?'开启':'暂停')+label,{},[...(active&&org<required?[`需生产组织${required}阶或家族记录`]:[]),...(o[key]===active?['已经是此安排']:[])],key==='supplies'?`只为当前农业与生产计划补足${r.operations!.inputBatches}批原料，计入待到货；保留生活、工资与${r.operations!.cashReserve}钱底线，使用同一市场库存和运输。`:key==='sales'?`按季出售超过${r.operations!.outputReserve}份的工业余货，食品额外保留生活储备；与手动交付共享订单额度。`:`设备耐用≤${r.operations!.repairThreshold}且未在制时自动付费送修，停机一季；生活与工资优先。`,(d,ev)=>{d.economy!.operations![key]=active;opEvent(ev,'plan',key,label+(active?'已开启':'已暂停'));});
  }
  for(const [op,key,project,label]of [['mineplan','mine','mine','矿场排水'],['steamplan','steam','steam','蒸汽供能']] as const)add(op,t,(active?'开启':'暂停')+label,{},[...(active&&!completed(s,project)?['先完成相应地区项目']:[]),...(o[key]===active?['已经是此安排']:[])],project==='mine'?`共用活塞泵；每季1木材、1耐用、1钱分成换${r.operations!.mineYield}矿料。农业灌溉优先。`:`每季一次消耗${r.operations!.steamFuel}木材替代水力；食品加工免行动，陶器、砖和冶铁可即时完成一批。`,(d,ev)=>{d.economy!.operations![key]=active;opEvent(ev,'plan',key,label+(active?'已开启':'已暂停'));});
 }
 for(const crop of ['wheat','soy','flax','rotation','off'] as const){
  const active=crop!=='off';
  add('farmplan',crop,active?'托管：'+(crop==='rotation'?'小麦大豆轮作':CROPS[crop].name):'暂停农业托管',{},[
   ...(active&&org<2?['需生产组织2阶或家族记录']:[]),...(active&&!e.workers.farmer?['先招募熟练农工']:[]),...(o.farm===(active?crop:null)?['已经是此安排']:[])
  ],'由熟练农工按季播种、照料、收获并留种；低肥力时用库存堆肥。需补货、供粮或维修时可另外签约。选择轮作将在空田时切换作物，不铲除在田作物。',(d,ev)=>{const ops=d.economy!.operations!;ops.farm=active?crop as Crop|'rotation':null;const w=d.economy!.workers.farmer;if(w){w.active=active;if(active)w.job=crop==='rotation'?'wheat':crop as Crop;}opEvent(ev,'plan','farm',active?'农业托管已安排':'农业托管已暂停');});
 }
 for(const recipe of processesFor(s))for(const mode of ['stock','sell'] as const){
  add('productionplan',recipe.id+'-'+mode,recipe.name+' · '+(mode==='stock'?'备货后停产':'持续生产'),{},[
   ...(org<2?['需生产组织2阶或家族记录']:[]),...(!e.workers.artisan?['先招募熟练工匠']:[]),...(e.workers.artisan?.project&&e.workers.artisan.project.good!==recipe.id?['先完成此人的在制工序再换配方']:[]),...(o.production?.recipe===recipe.id&&o.production.mode===mode&&e.workers.artisan?.active?['已安排此计划']:[]),
   ...(recipe.equipment&&e.equipment[recipe.equipment]===undefined?['先取得'+PRODUCTS.find(p=>p.id===recipe.equipment)!.name]:[])
  ],`工匠每季执行一项工序，跨季项目自动完成；${mode==='stock'?'产物达到储备目标自动待命':'持续生产，可开启自动交付'}。工资、材料和设备仍真实消耗。`,(d,ev)=>{d.economy!.operations!.production={recipe:recipe.id,mode};const w=d.economy!.workers.artisan!;w.job=recipe.id as Work;w.active=true;opEvent(ev,'plan','production','生产计划已安排：'+recipe.name);});
 }
 add('productionplan','off','暂停生产计划',{},o.production&&e.workers.artisan?.active?[]:['没有运行中的生产计划'],'暂停并保留员工经验与在制项目，恢复时须接续原项目。',(d,ev)=>{if(d.economy!.workers.artisan)d.economy!.workers.artisan!.active=false;opEvent(ev,'plan','production','生产计划暂停，在制品保留');});
 add('charter','family','订立家族经营契约',{money:r.operations!.projectFee},[...(org<3?['需生产组织3阶或家族记录']:[]),...(o.charter?['家族契约已存在']:[])],'换代后保留供粮、农业、生产、补货、交付、维护安排及雇员运行状态；不复制个人理论。',(d,ev)=>{d.economy!.operations!.charter=true;opEvent(ev,'charter','family','家族经营安排可跨代自动接续');});
 for(const p of REGIONAL_PROJECTS){
  const saved=o.projects[p.id];
  add('projectstart',p.id,(saved?'继续':'启动')+p.name,{money:saved?0:r.operations!.projectFee},[
   ...(saved?.stage==='complete'?['成果已经达成']:[]),...(o.activeProject?['先暂停当前项目或完成运行验证']:[]),...projectBlockers(s,p.id),...(!saved?missingGoods(s,p.inputs):[])
  ],`${saved?'已投入材料不重复收取':'启动投入：'+Object.entries(p.inputs).map(([id,n])=>n+' '+id).join('、')}。${p.test}，需${r.operations!.commissionSeasons}次有效季末验证。${p.effect}`,(d,ev)=>{if(!saved){changeGoods(d,p.inputs,-1,ev,'地区项目投入');d.economy!.operations!.projects[p.id]={stage:'commissioning',progress:0,founder:d.household.activePersonId};}d.economy!.operations!.activeProject=p.id;opEvent(ev,'project-start',p.id,p.name+'进入实际运行验证');});
 }
 add('projectpause','current','暂停当前地区项目',{ap:0},o.activeProject?[]:['没有进行中的地区项目'],'保留投入和已完成验证；之后可重新继续。',(d,ev)=>{d.economy!.operations!.activeProject=null;opEvent(ev,'project-pause','current','项目已暂停');});
 return out;
}
