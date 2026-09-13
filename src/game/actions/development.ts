import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import { activePerson, addUnique } from '../model/state.js';
import { DISCIPLINES, DISCIPLINE_NAMES, GOOD_NAMES } from '../model/development.js';
import type { DevelopmentGood } from '../model/development.js';
import { DEVELOPMENT_RECIPES, DEVELOPMENT_PRICES, experience, skillLevel, gainExperience } from '../systems/development.js';
import { methodBlockers } from '../systems/crafts.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';

export function developmentActions(state:GameState,rules:Ruleset):ActionDefinition[] {
  const d=state.development;if(!d||!rules.development)return [];
  const p=rules.development.parameters,actions:ActionDefinition[]=[];
  for(const r of DEVELOPMENT_RECIPES) {
    const missing=Object.entries(r.inputs).filter(([g,n])=>d.goods[g as DevelopmentGood]<n).map(([g])=>`${GOOD_NAMES[g as DevelopmentGood]}不足`);
    const wood=Math.max(r.wood?1:0,r.wood-Math.min(1,d.designs[r.domain]));
    actions.push(defineAction(state,`develop:${r.id}`,r.name,'工业',{food:Math.max(0,r.food-(r.domain==='agriculture'?Math.min(1,d.designs.agriculture):0)),materials:{wood,clay:r.clay}},[
      ...methodBlockers(state,rules,r.method),...missing,...(skillLevel(state,rules,r.domain)<r.level?[`需${DISCIPLINE_NAMES[r.domain]}熟练等级${r.level}`]:[]),
      ...(d.project||state.production!.project||state.productNetwork?.project?['先完成家庭在制项目']:[]),
    ],`${r.benefit} 开工投入${Object.entries(r.inputs).map(([g,n])=>`${n}${GOOD_NAMES[g as DevelopmentGood]}`).join('、')||'原料'}；再用1行动完成${r.wait?'，需跨季':''}。`,(draft,events)=>{
      for(const [g,n] of Object.entries(r.inputs))draft.development!.goods[g as DevelopmentGood]-=n;
      draft.development!.project={recipe:r.id,started:draft.clock.absoluteTurn};
      events.push({type:'development-started',recipe:r.id,inputs:{...r.inputs}});
    }));
  }
  const recipe=DEVELOPMENT_RECIPES.find(r=>r.id===d.project?.recipe);
  actions.push(defineAction(state,'finish-development','完成工业项目','工业',{},[...(!recipe?['没有工业在制品']:[]),...(recipe&&state.clock.absoluteTurn<d.project!.started+recipe.wait?['需跨季干燥或校验']:[])],'完成已布置工序并获得产品与实践；后辈可接续，不自动授予前代技能。',(draft,events)=>{
    const r=recipe!,amount=r.amount+Math.floor(draft.development!.designs[r.domain]/2);
    draft.development!.goods[r.output]+=amount;draft.development!.project=null;
    addUnique(activePerson(draft).practices,`development-${r.method}`);
    gainExperience(draft,r.domain,2,events);
    events.push({type:'development-completed',recipe:r.id,good:r.output,amount});
  }));
  actions.push(defineAction(state,'conduct-experiment','开展材料对照实验','科学',{food:Math.max(0,p.experimentFood-Math.min(1,d.designs.science))},[
    ...methodBlockers(state,rules,'experimentation'),...(d.goods.supplies<1?['需1工坊补给']:[]),...(d.goods.ceramicParts<1?['需1陶质构件']:[]),
  ],`消耗1补给、1陶质构件，取得1研究记录；有实验设备再多得1份并消耗耐用度。研究记录可改良工艺。`,(draft,events)=>{
    if(draft.productNetwork){draft.productNetwork.goods.spentCeramics++;events.push({type:'ceramic-residue',amount:1});}
    const x=draft.development!;x.goods.supplies--;x.goods.ceramicParts--;const equipped=x.labDurability>0;if(equipped)x.labDurability--;
    const amount=equipped?2:1;x.goods.findings+=amount;
    addUnique(activePerson(draft).practices,'development-experimentation');gainExperience(draft,'science',1,events);
    events.push({type:'experiment-conducted',amount,equipped});
  }));
  for(const domain of DISCIPLINES) {
    const rank=d.designs[domain],level=skillLevel(state,rules,domain);
    actions.push(defineAction(state,`refine:${domain}`,`改良${DISCIPLINE_NAMES[domain]}工艺（第${rank+1}次）`,'科学',{},[
      ...(level<rank+1?[`需${DISCIPLINE_NAMES[domain]}熟练等级${rank+1}`]:[]),...(d.goods.findings<rank+1?[`需${rank+1}研究记录`]:[]),...(d.goods.supplies<1?['需1工坊补给']:[]),...(d.project?['完成工业在制项目后再改良']:[]),
    ],'研究记录与补给真实消耗。第一次降低陶作/机械项目1木材投入（至少1），农业加工少用1粮，实验额外口粮少1；每两次改良增加对应工业项目1产出。后续改良需更高熟练度，成果留在家族。',(draft,events)=>{
      const x=draft.development!;x.goods.findings-=rank+1;x.goods.supplies--;x.designs[domain]++;
      events.push({type:'design-refined',domain,rank:rank+1});
    }));
    const parentXP=experience(state,domain),childXP=experience(state,domain,state.household.heirId);
    actions.push(defineAction(state,`mentor:${domain}`,`带后辈实习：${DISCIPLINE_NAMES[domain]}`,'传承',{food:p.mentorFood},[...(parentXP<2?['本人实践积累不足']:[]),...(childXP>=Math.floor(parentXP/2)?['后辈已达到当前可传授的实践水平']:[])],`花1行动与${p.mentorFood}粮传授最多${rules.passiveInvestment?2:1}点经验；后辈${childXP}，本代${parentXP}，可传至${Math.floor(parentXP/2)}。不替代理论与实践条件。`,(draft,events)=>gainExperience(draft,domain,Math.min(rules.passiveInvestment?2:1,Math.floor(parentXP/2)-childXP),events,draft.household.heirId)));
  }
  for(const [good,price] of Object.entries(DEVELOPMENT_PRICES)) {
    const g=good as Exclude<DevelopmentGood,'findings'>;
    actions.push(defineAction(state,`procure:${g}`,`外购${GOOD_NAMES[g]}`,'交换',{money:price},d.tradeRemaining<1?['本季专业采购机会已用完']:[],'从外部行业购入1件实物，消耗一次专业采购机会，不赠送技能。',(draft,events)=>{draft.development!.tradeRemaining--;draft.development!.goods[g]++;events.push({type:'development-traded',good:g,operation:'buy',amount:1,money:price});}));
    const reward=Math.max(1,price-p.tradeSpread);
    actions.push(defineAction(state,`deliver:${g}`,`交付订单：${GOOD_NAMES[g]}`,'交换',{},[...(d.goods[g]<1?['没有对应商品']:[]),...(d.ordersRemaining<1?['本季专业订单已满']:[])],`交付1件得${reward}钱。订单代表外部设备与研究需求，每季有限。`,(draft,events)=>{draft.development!.goods[g]--;draft.development!.ordersRemaining--;draft.household.money+=reward;events.push({type:'development-traded',good:g,operation:'sell',amount:1,money:reward});}));
    if(rules.passiveInvestment){
      const foodCost=2*rules.parameters.foodPrice;
      actions.push(defineAction(state,`deliver-food:${g}`,`交付并购粮：${GOOD_NAMES[g]}`,'交换',{},[
        ...(d.goods[g]<1?['没有对应商品']:[]),...(d.ordersRemaining<1?['本季专业订单已满']:[]),
        ...(state.production!.market.food<2?['市场不足2粮']:[]),...(state.household.money+reward<foodCost?['货款加现钱不足购粮']:[]),
      ],`1行动交付1件得${reward}钱，同时按市价花${foodCost}钱买2粮；净收入${reward-foodCost}钱，扣真实市场供给。`,(draft,events)=>{
        draft.development!.goods[g]--;draft.development!.ordersRemaining--;draft.household.money+=reward-foodCost;
        draft.production!.market.food-=2;draft.household.food+=2;
        events.push({type:'development-traded',good:g,operation:'sell',amount:1,money:reward});
        events.push({type:'food-purchased',amount:2,money:foodCost});
      }));
    }
  }
  actions.push(defineAction(state,'procure-clay','外购一批黏土','交换',{money:3},d.tradeRemaining<1?['本季专业采购机会已用完']:[],'花3钱和1采购机会取得2黏土；来自外部交换，不使当地矿藏再生。',(draft,events)=>{draft.development!.tradeRemaining--;draft.production!.inventory.clay+=2;events.push({type:'industrial-clay-bought',amount:2});}));
  for(const kind of ['field','lab'] as const) {
    const g=kind==='field'?'fieldTools':'labTools',key=kind==='field'?'fieldDurability':'labDurability';
    actions.push(defineAction(state,`equip:${kind}`,kind==='field'?'装备农业设备':'装备实验设备','设施',{},[...(d.goods[g]<1?[`需1${GOOD_NAMES[g]}`]:[]),...(d[key]>0?['现有设备尚可使用']:[])],`消耗1件设备，提供${p.equipmentDurability}次使用；跨代保留，不能重复叠加。`,(draft,events)=>{draft.development!.goods[g]--;draft.development![key]=p.equipmentDurability;events.push({type:'development-equipped',kind,durability:p.equipmentDurability});}));
  }
  return actions;
}
