import { operatePassive, PASSIVE_EFFECTS } from '../systems/investment.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { DEVICES, NETWORK_NAMES } from '../model/product-network.js';
import type { Product } from '../model/product-network.js';
import { DEVICE_RECIPES, PRODUCT_NAMES, productAmount, changeProduct } from '../systems/product-network.js';
import { methodBlockers } from '../systems/crafts.js';
import { gainExperience } from '../systems/development.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';
export function productNetworkActions(s:GameState,rules:Ruleset):ActionDefinition[]{
  const n=s.productNetwork;if(!n)return [];
  const actions:ActionDefinition[]=[];
  for(const r of DEVICE_RECIPES) {
    actions.push(defineAction(s,`fabricate:${r.id}`,`制造${NETWORK_NAMES[r.id]}`,'工业',{},[
      ...methodBlockers(s,rules,r.method),...(n.project||s.development!.project||s.production!.project?['先完成家庭在制项目']:[]),
      ...Object.entries(r.inputs).filter(([id,count])=>productAmount(s,id as Product)<count).map(([id,count])=>`需${count}${PRODUCT_NAMES[id as Product]}`),
    ],`${Object.entries(r.inputs).map(([id,count])=>`${count}${PRODUCT_NAMES[id as Product]}`).join(' + ')}；开工、完成各1行动。${rules.passiveInvestment?PASSIVE_EFFECTS[r.id]:r.effect}`,(draft,events)=>{
      for(const[id,count]of Object.entries(r.inputs))changeProduct(draft,id as Product,-count);
      draft.productNetwork!.project=r.id;events.push({type:'product-started',device:r.id,inputs:{...r.inputs}});
    }));
  }
  actions.push(defineAction(s,'finish-product','完成高级设备','工业',{},n.project?[]:['没有高级设备在制品'],'完成已布置的装配；设备需安装后使用，可跨代接续。',(draft,events)=>{
    const device=draft.productNetwork!.project!;draft.productNetwork!.goods[device]++;draft.productNetwork!.project=null;
    gainExperience(draft,device==='pump'?'woodwork':device==='kiln'?'pottery':'science',2,events);
    events.push({type:'product-completed',device});
  }));
  for(const device of DEVICES)actions.push(defineAction(s,`install-product:${device}`,`安装${NETWORK_NAMES[device]}`,'设施',{},[
    ...(n.goods[device]<1?['没有对应设备']:[]),...(n.installed[device]>0?['现有设备仍可使用']:[]),
  ],`消耗1件设备，提供${rules.development!.parameters.equipmentDurability}次${rules.passiveInvestment?'自动运行（安装时及季末，每季最多一次，不花行动）':'专用操作'}。继承者可使用，不自动学会制造。`,(draft,events)=>{
    const x=draft.productNetwork!;x.goods[device]--;x.installed[device]=rules.development!.parameters.equipmentDurability;
    events.push({type:'product-installed',device,durability:x.installed[device]});
    operatePassive(draft,rules,events,device);
  }));
  if(rules.passiveInvestment){
    const price=rules.passiveInvestment.reportPrice;
    actions.push(defineAction(s,'sell-calibration','出售校准报告','交换',{},[...(n.goods.calibrations<1?['需1校准报告']:[]),...(s.development!.ordersRemaining<1?['本季专业订单已满']:[])],`出售1份报告获得${price}钱，消耗1专业订单；报告也用于造泵和窑，请预留。`,(draft,events)=>{draft.productNetwork!.goods.calibrations--;draft.development!.ordersRemaining--;draft.household.money+=price;events.push({type:'calibration-sold',money:price});}));
    return actions;
  }
  actions.push(defineAction(s,'calibrate','进行仪器校准','科学',{},[
    ...(n.installed.calibrator<1?['需安装可用校准仪']:[]),...methodBlockers(s,rules,'experimentation'),
    ...(s.development!.goods.findings<1?['需1研究记录']:[]),...(s.development!.goods.supplies<1?['需1工坊补给']:[]),
  ],'消耗1研究记录、1补给及1设备耐用度，产生1校准报告；用于制造提水泵与控温窑。',(draft,events)=>{
    draft.development!.goods.findings--;draft.development!.goods.supplies--;draft.productNetwork!.goods.calibrations++;
    draft.productNetwork!.installed.calibrator--;gainExperience(draft,'science',1,events);
    events.push({type:'product-operated',device:'calibrator',remaining:draft.productNetwork!.installed.calibrator,result:1});
  }));
  actions.push(defineAction(s,'pump-water','提取并储存公共水','生活',{materials:{wood:1}},[
    ...(n.installed.pump<1?['需安装可用提水泵']:[]),...(s.location.water<1?['公共水源不足']:[]),...(n.storedWater>=2?['家用蓄水已满']:[]),
  ],'消耗1木材维护、1设备耐用度，把1公共水转为家用蓄水（容量2）；蓄水跨季保留，缺水耕作先用蓄水。',(draft,events)=>{
    draft.location.water--;draft.productNetwork!.storedWater++;draft.productNetwork!.installed.pump--;
    events.push({type:'product-operated',device:'pump',remaining:draft.productNetwork!.installed.pump,result:1});
  }));
  actions.push(defineAction(s,'recycle-ceramics','回收烧结陶料','工业',{materials:{wood:1}},[
    ...(n.installed.kiln<1?['需安装可用控温窑']:[]),...(n.goods.spentCeramics<2?['需2用后陶料']:[]),
  ],'消耗2用后陶料、1木材、1设备耐用度，重制1陶质构件；材料有损耗，不能无限复制。',(draft,events)=>{
    draft.productNetwork!.goods.spentCeramics-=2;draft.development!.goods.ceramicParts++;draft.productNetwork!.installed.kiln--;
    gainExperience(draft,'pottery',1,events);events.push({type:'product-operated',device:'kiln',remaining:draft.productNetwork!.installed.kiln,result:1});
  }));
  return actions;
}
