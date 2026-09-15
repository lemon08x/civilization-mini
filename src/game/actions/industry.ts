import {INDUSTRY_PRODUCTS,type OperatorId} from '../model/industry.js';
import type {GameState} from '../model/state.js';
import {defineAction,type ActionDefinition} from './definition.js';
import {productName,productNeeds} from '../systems/industry-products.js';
import {amount,changeGoods,consumeEquipment,equipped,missingGoods} from '../systems/economy.js';
import {systemDefinitions,assignmentNeeds,installedIn,industryEvent,physicalNeeds,systemInputs,systemUnlockNeeds} from '../systems/industry.js';

export function industryActions(s:GameState):ActionDefinition[]{
 const x=s.economy?.industry;if(!x)return [];
 const result:ActionDefinition[]=[];
 for(const p of INDUSTRY_PRODUCTS){
  const equipment=p.kind==='device';
  result.push(defineAction(s,'economy:inspect:'+p.id,'检验：'+productName(p.id),'产品验证',{time:s.era&&s.economy!.branches!.learned[s.household.activePersonId]?.includes('Q0')?3:4,energy:2},[
   ...productNeeds(s,p.id,true),...(x.products[p.id]?['已有产品验证记录']:[]),
   ...(equipment?(!equipped(s,p.id)?['需可用产品实物']:[]):amount(s,p.good!)<1?['需一件实物样品']:[]),
   ...(equipment&&installedIn(s,p.id)?['先拆出已安装产品再检验']:[]),
   ...(['W03','E01'].includes(p.id)&&s.location.water<1?['试验需要1公共水']:[]),
   ...(p.id==='W03'?missingGoods(s,{wood:1}):[]),
  ],'检验占用时间精力；部件消耗一件样品，设备消耗1耐用。泵/发电机额外用1水试运行，泵另耗1木材。只记录产品验证，不赠送制造规程。',(d,ev)=>{
   if(equipment)consumeEquipment(d,p.id,ev);else changeGoods(d,{[p.good!]:1},-1,ev,'检验样品');
   if(['W03','E01'].includes(p.id))d.location.water--;
   if(p.id==='W03')changeGoods(d,{wood:1},-1,ev,'试抽耗材');
   d.economy!.industry!.products[p.id]={source:'inspection',protocol:false};industryEvent(ev,'inspected',p.id,'self',productName(p.id)+'检验完成；未取得制造规程');
  }));
 }
 for(const def of systemDefinitions(s)){
  const i=x.instances[def.id];
  result.push(defineAction(s,'economy:sysbuild:'+def.id,'建设：'+def.name,'系统',{time:def.id==='well'?6:2,energy:def.id==='well'?4:1},[
   ...systemUnlockNeeds(s,def),...(def.id==='well'?missingGoods(s,{wood:4,clay:2}):[]),...(i?['已建此系统']:[]),
   ...(def.equipment&&!equipped(s,def.equipment)?['需可用'+productName(def.equipment)]:[]),
   ...(def.equipment&&installedIn(s,def.equipment)?['设备已安装在系统中']:[]),
  ],def.id==='well'?'挖井耗4木材、2黏土、6时间、4精力；建成后实际试抽并安排人员。':'投入安装时间；占用已有实物设备，不凭空赠送设备。建成后需本人调试，随后安排操作人员。',(d,ev)=>{
   if(def.id==='well')changeGoods(d,{wood:4,clay:2},-1,ev,'家庭水井建设');
   d.economy!.industry!.instances[def.id]={id:def.id,commissioned:false,enabled:false,operator:null};industryEvent(ev,'built',def.id,'self',def.name+'已安装，等待调试');
  }));
  result.push(defineAction(s,'economy:syscommission:'+def.id,'调试：'+def.name,'系统',{time:def.time,energy:def.energy},[
   ...(!i?['先建设系统']:[]),...(i?.commissioned?['已经调试完成']:[]),...systemUnlockNeeds(s,def),...physicalNeeds(s,def),
  ],'本人按一批任务报价完成实际调试。供水进行试抽；加工产出真实轴。耗材、设备和时间精力均扣一次，不重复收费。',(d,ev)=>{
   changeGoods(d,systemInputs(def),-1,ev,'系统调试投入');
   if(def.equipment){consumeEquipment(d,def.equipment,ev);d.economy!.equipmentUsed[def.equipment]=d.clock.absoluteTurn;}
   if(def.id==='shaft'){changeGoods(d,{shaft:2},1,ev,'调试合格产出');if(d.era)ev.push({type:'economy-process',recipe:'shaft',actor:'调试：本人',stage:'complete',factor:1});}else if(def.id==='well')d.era!.groundwater--;else d.location.water--;
   const instance=d.economy!.industry!.instances[def.id]!;instance.commissioned=true;
   if(!d.economy!.industry!.commissioned.includes(def.id))d.economy!.industry!.commissioned.push(def.id);
   industryEvent(ev,'commissioned',def.id,'self',def.name+'实际调试完成，尚未安排运行');
  }));
  for(const operator of ['self','laborer','farmer','artisan'] as OperatorId[]){
   result.push(defineAction(s,`economy:sysassign:${def.id}-${operator}`,'安排'+(operator==='self'?'本人':operator==='artisan'?'工匠':operator==='farmer'?'农工':'普通雇工')+'：'+def.name,'系统',{ap:0},[
    ...(!i?.commissioned?['先建设并调试系统']:[]),...assignmentNeeds(s,def,operator),
    ...(i?.enabled&&i.operator===operator?['已是当前安排']:[]),
   ],'安排并启用。本人为当前经营者，换代后需确认接续；员工共享各自季预算。缺料待命不扣工资，人力工作才计费。',(d,ev)=>{
    const instance=d.economy!.industry!.instances[def.id]!;instance.operator=operator;instance.enabled=true;industryEvent(ev,'assigned',def.id,operator,def.name+'已安排人员并启用');
   }));
  }
  result.push(defineAction(s,'economy:sysrun:'+def.id,'暂停：'+def.name,'系统',{ap:0},!i?.enabled?['系统未运行']:[], '停止后释放尚未消耗的劳动预留，保留安装和调试记录。',(d,ev)=>{d.economy!.industry!.instances[def.id]!.enabled=false;industryEvent(ev,'paused',def.id,'self',def.name+'已暂停');}));
  result.push(defineAction(s,'economy:sysremove:'+def.id,'拆出：'+def.name,'系统',{ap:0},!i?['没有此系统']:i.enabled?['先暂停系统']:[], '释放设备用于手动加工或其他用途；保留产品和历史调试记录，重新安装仍需本实例调试。',(d,ev)=>{delete d.economy!.industry!.instances[def.id];industryEvent(ev,'removed',def.id,'self',def.name+'已拆出，实物与历史记录保留');}));
 }
 return result;
}
