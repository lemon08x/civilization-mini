import {branchHas} from '../systems/branches.js';
import { expeditionActions } from './expedition.js';
import { modernActions } from './modern.js';
import { usePower } from '../systems/modern.js';
import { topicsFor,productsFor,processesFor,goodsFor } from '../systems/economy-catalog.js';
import { towerActions } from './tower.js';
import { workshopActions } from './workshop.js';
import { operationsActions } from './operations.js';
import { steamReady,useSteam } from '../systems/operations.js';
import { shopActions } from './shop.js';
import { salePrice,made,deviceReserved,servicePending } from '../systems/shop.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { Subject, Crop, WorkerKind, Work } from '../model/economy.js';
import { SUBJECTS } from '../model/economy.js';
import {  ALL_GOODS as GOODS,   CROPS, SUBJECT_NAMES, WORKER_NAMES, ALL_JOB_NAMES as JOB_NAMES } from '../systems/economy-catalog.js';
import { level,equipped,consumeEquipment,changeGoods,requirements,missingGoods,recordEvidence,farmBlocker,farmWork,processBlockers,runProcess,finishProcess,organizationLevel,foodStock } from '../systems/economy.js';
import { defineAction } from './definition.js';
import type { ActionDefinition } from './definition.js';

export function economyActions(s:GameState,rules:Ruleset):ActionDefinition[]{
  const e=s.economy!,p=rules.economy!,out:ActionDefinition[]=modernActions(s);
  const add=(op:string,target:string,label:string,group:string,cost:Parameters<typeof defineAction>[4],blockers:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${target}`,label,group,cost,blockers,description,execute));
  for(const t of topicsFor(s)){
    const current=level(s,t.subject),evidence=(e.evidence[s.household.activePersonId]??[]).includes(t.id);
    const source=e.shop?.books.includes(t.id)||(e.notes[t.subject]??0)>=t.level||(e.regional.teaching[t.subject]??0)>=t.level;
    add('study',t.id,'学习：'+t.name,'学科',{},[...(current!==t.level-1?['需按本学科主干进阶']:[]),...(t.level>1&&!evidence&&!source?['需本课题实验或家族／地区记录']:[])],
      `${SUBJECT_NAMES[t.subject]}第${t.level}阶。独立学科主干；有对应研究证据或家学时1行动掌握，不要求跨学科学习。`,(draft,events)=>{
        const x=draft.economy!,person=draft.household.activePersonId;(x.knowledge[person]??={})[t.subject]=t.level;
        events.push({type:'economy-learned',subject:t.subject,level:t.level,personId:person,source:'study'});
      });
    const sample:Record<string,number>=t.level>6?(t.level>=9?{circuit:1}:t.subject==='agronomy'?{mineral:1}:{copper:1,iron:1}):t.subject==='agronomy'?{seedWheat:1}:t.subject==='mechanics'?{wood:1}:t.subject==='organization'?{}:{wood:equipped(s,'S03')?0:1,clay:1};
    const orgBlocked=t.subject==='organization'&&t.level>1&&!Object.keys(e.workers).length;
    add('research',t.id,'实验：'+t.name,'研究',{money:t.subject==='organization'?1:0},[...(t.level===1?['首阶直接学习，无需实验']:[]),...(current!==t.level-1?['仅研究本学科下一课题']:[]),...(evidence?['已有有效证据，无需重复']:[]),...missingGoods(s,sample),...(orgBlocked?['需先建立雇佣关系，或从实际工作取得组织证据']:[])],
      `进行固定对照，消耗${Object.entries(sample).filter(([,n])=>n).map(([id,n])=>n+GOODS[id].name).join('、')||'1钱组织成本'}。取得本课题证据，不产生通用研究点；重复无新增。`,(draft,events)=>{
        changeGoods(draft,sample,-1,events,t.name+'对照实验');if(['heat','chemistry'].includes(t.subject)&&equipped(draft,'S03'))consumeEquipment(draft,'S03',events);
        recordEvidence(draft,t.subject,events,t.name+'固定对照');
      });
  }
  for(const subject of (e.branches?[]:SUBJECTS)){
    const n=level(s,subject),child=level(s,subject,s.household.heirId);
    add('archive',subject,'留存：'+SUBJECT_NAMES[subject],'传承',{},[...(n<1?['尚未掌握']:[]),...((e.notes[subject]??0)>=n?['家族记录已完整']:[])],'保存本人的当前学科进展，后辈可据此学习。'+(e.shop?.assets.includes('library')?'家学书室同时教导后辈下一课题，上限为本人水平。':'设备和记录不会自动复制个人理解。'),(draft,events)=>{draft.economy!.notes[subject]=n;if(e.shop?.assets.includes('library')&&child<n){(draft.economy!.knowledge[draft.household.heirId]??={})[subject]=child+1;events.push({type:'economy-learned',subject,level:child+1,personId:draft.household.heirId,source:'teach'});}events.push({type:'economy-knowledge',operation:'archive',subject,level:n});});
    add('teach',subject,'教导后辈：'+SUBJECT_NAMES[subject],'传承',{},[...(child>=n?['后辈已达到本人理解水平']:[])],'1行动传授下一阶理解，上限为本人已掌握进展；不复制制造实践。',(draft,events)=>{
      (draft.economy!.knowledge[draft.household.heirId]??={})[subject]=child+1;events.push({type:'economy-learned',subject,level:child+1,personId:draft.household.heirId,source:'teach'});
    });
    add('publish',subject,'传播：'+SUBJECT_NAMES[subject],'社会',{money:1},[...(n<1?['尚未掌握']:[]),...((e.published[subject]??0)>=n?['已传播当前进展']:[])],'向地区传播可复现认识，建立教学来源；实际供货还需持续生产，理论本身不生成商品。',(draft,events)=>{
      draft.economy!.published[subject]=n;draft.economy!.regional.teaching[subject]=n;events.push({type:'economy-knowledge',operation:'publish',subject,level:n});
    });
  }
  for(const resource of ['wood','clay','food'] as const){
    const key=resource==='wood'?'timber':resource==='food'?'wildFood':'clay',available=s.production!.stocks[key];
    const take=Math.min(available,2+(resource==='wood'&&equipped(s,'T01')?1:0));
    add('gather',resource,'采集'+(resource==='food'?'食物':GOODS[resource].name),'生活',{},take<1?['当地资源已耗尽']:[],`取得${take}，真实扣当地库存。`,(draft,events)=>{
      draft.production!.stocks[key]-=take;if(resource==='food')draft.household.food+=take;else changeGoods(draft,{[resource]:take},1,events,'当地采集');
      if(resource==='wood'&&equipped(draft,'T01'))consumeEquipment(draft,'T01',events);
      events.push({type:'resource-gathered',resource,amount:take,remaining:draft.production!.stocks[key],toolUsed:false});
    });
  }
  add('work','local','临时做工','生活',{},s.production!.market.jobs<1?['本季岗位已满']:[],`1行动赚${rules.parameters.workIncome}钱，扣1当地岗位。`,(draft,events)=>{draft.production!.market.jobs--;draft.household.money+=rules.parameters.workIncome;events.push({type:'income',source:'work',amount:rules.parameters.workIncome});});
  for(const [id,good]of Object.entries(goodsFor(s))){
    const regional=id==='iron'&&e.regional.iron||id==='fiber'&&e.regional.fiber;
    const price=good.price+(regional?0:1);
    if(!e.shop)add('buy',id,'购买'+good.name,'交换',{money:price},e.industrySupply<1?['本季采购额度用完']:[],`购入1${good.name}，价格${price}钱；地区供应成熟后铁料／纤维采购价下降1钱，仍不低于交付价。`,(draft,events)=>{
      const n=1;
      draft.economy!.industrySupply--;changeGoods(draft,{[id]:n},1,events,'市场采购');events.push({type:'economy-trade',good:id,operation:'buy',amount:n,money:price});
    });
    for(const food of [false,true])add(food?'sellfood':'sell',id,'交付'+good.name+(food?'并购粮':''),'交换',{},[
      ...missingGoods(s,{[id]:1}),...(e.market<1?['本季订单已满']:[]),...(food&&s.production!.market.food<2?['市场不足2粮']:[]),...(food&&s.socialFood&&s.socialFood.serviceRemaining<2?['食品服务人员额度不足']:[]),...(food&&s.socialFood&&e.shop!.transport<2?['食品共享运输不足']:[]),...(food&&s.household.money+salePrice(s,id)<2*rules.parameters.foodPrice?['货款与现钱不足购粮']:[]),
    ],`交付1件得${salePrice(s,id)}钱${food?`，同时花${2*rules.parameters.foodPrice}钱买2粮`:''}；商品、钱款、订单和粮源真实扣减。`,(draft,events)=>{
      changeGoods(draft,{[id]:1},-1,events,'订单交付');draft.economy!.market--;draft.household.money+=salePrice(s,id);
      events.push({type:'economy-trade',good:id,operation:'sell',amount:1,money:salePrice(s,id)});
      if(food){const money=2*rules.parameters.foodPrice;draft.household.money-=money;draft.household.food+=2;draft.production!.market.food-=2;if(draft.socialFood){draft.socialFood.serviceRemaining-=2;draft.economy!.shop!.transport-=2;}events.push({type:'food-purchased',amount:2,money});}
    });
  }
  if(!e.shop)add('buyfood','bulk','买入4口粮','生活',{money:4*rules.parameters.foodPrice},s.production!.market.food<4?['市场不足4粮']:[],'购买普通即食口粮；仓库里的小麦、大豆和面粉也会在季末按需用于生活。',(draft,events)=>{draft.production!.market.food-=4;draft.household.food+=4;events.push({type:'food-purchased',amount:4});});
  for(const crop of Object.keys(CROPS) as Crop[])add('farm',crop,(e.field.crop?'管理／收获':'播种')+CROPS[crop].name,'农业',{ap:e.shop&&!e.field.crop&&equipped(s,'U02')&&e.shop.seededTurn!==s.clock.absoluteTurn?0:1},[
    ...(e.field.crop&&e.field.crop!==crop?['田里种植的是其他作物']:[]),...farmBlocker(s,crop),
  ],'空田播种；生长期缺水时灌溉；成熟后收获。只有一块家庭田，个人与雇工共用。',(draft,events)=>farmWork(draft,crop,events));
  add('fertilize','field','施用堆肥','农业',{},[...requirements(s,{agronomy:3}),...missingGoods(s,{compost:1}),...(e.field.composted||e.field.fertility>=3?['本茬已施肥或肥力充足']:[])],'消耗1堆肥，土壤肥力+1，上限3；不直接创造粮食。',(draft,events)=>{changeGoods(draft,{compost:1},-1,events,'施肥');draft.economy!.field.fertility++;draft.economy!.field.composted=true;recordEvidence(draft,'agronomy',events,'堆肥施用');});
  for(const product of productsFor(s)){
    add('build',product.id,'制造并安装'+product.name,'产品',{},[...requirements(s,product.requires),...missingGoods(s,product.inputs),...(equipped(s,product.id)?['已有可用设备']:[]),...(deviceReserved(s,product.id)?['设备在制、维修或待交付']:[])],
      `${e.shop&&product.id==='U02'?'每季一次本人播种免行动，仍扣种子和耐用度':product.effect} 消耗${Object.entries(product.inputs).map(([id,n])=>n+GOODS[id].name).join('、')}；安装即具备能力，可传给后代。`,(draft,events)=>{
        changeGoods(draft,product.inputs,-1,events,'制造'+product.name);draft.economy!.equipment[product.id]=p.durability;
        made(draft,product.id);events.push({type:'economy-built',product:product.id,durability:p.durability});for(const d of Object.keys(product.requires))recordEvidence(draft,d as Subject,events,'制造'+product.name);
      });
  }
  for(const recipe of processesFor(s)){
    const steam=steamReady(s,rules)&&['mill','thresh','oil'].includes(recipe.id)&&((e.goods.wood??0)>=(recipe.inputs.wood??0)+rules.operations!.steamFuel);
    const electric=(!e.branches||branchHas(s,'L7'))&&!!e.modern&&e.modern.power>=1&&['mill','thresh','oil'].includes(recipe.id);
    const powered=electric||['mill','thresh','oil'].includes(recipe.id)&&(steam||equipped(s,'P03')&&s.location.water>0&&e.poweredTurn!==s.clock.absoluteTurn);
    add('process',recipe.id,recipe.name,'生产',{ap:powered?0:1},processBlockers(s,recipe),`${recipe.wait?'开工后跨季完成':'当次加工完成'}。${electric?'电力提供免行动加工，消耗1电。':steam?'蒸汽提供本季一次免行动加工，消耗燃料。':powered?'水轮提供本季一次免行动加工，扣1公共水与1耐用度。':''}投入产出见配方。`,(draft,events)=>{
      if(electric)usePower(draft,1,events,'电动食品加工');else if(steam)useSteam(draft,rules,events);else if(powered){draft.location.water--;draft.economy!.poweredTurn=draft.clock.absoluteTurn;consumeEquipment(draft,'P03',events);}runProcess(draft,recipe,events,undefined,rules);
    });
  }
  add('finish','project','完成本人在制项目','生产',{},[...(!e.project?['没有本人在制项目']:[]),...(e.project&&s.clock.absoluteTurn<=e.project.started?['需跨季']:[])],'完成已付料的在制品，后辈也可接续。',(draft,events)=>finishProcess(draft,events));
  const org=organizationLevel(s),capacity=org>=5?4:org>=3?3:org>=2?2:1;
  for(const kind of Object.keys(WORKER_NAMES) as WorkerKind[]){
    const worker=e.workers[kind],required=kind==='laborer'?1:kind==='manager'?5:2;
    add('hire',kind,'雇佣'+WORKER_NAMES[kind],'雇佣',{money:p.hireCost},[...(org<required?[`需生产组织第${required}阶或家族记录`]:[]),...(worker?['已雇有此岗位']:[]),...(Object.keys(e.workers).length>=capacity?['达到当前组织人数上限']:[]),...(e.recruitment<1?['本季招募机会用完']:[])],
      `招募费${p.hireCost}钱，之后按实际工作季支付工资；无任务、缺料、设备占用时待命不收费。熟练人员可使用其专业工艺，不赠送本人技能。`,(draft,events)=>{
        if(draft.economy!.industry){const r=draft.economy!.industry!.rules;draft.economy!.industry!.workers[kind]={timeRemaining:r.workerTime,energy:r.workerEnergy};}
        draft.economy!.recruitment--;draft.economy!.workers[kind]={kind,experience:kind==='laborer'?0:4,job:'rest',active:false,project:null};
        events.push({type:'economy-worker',worker:kind,operation:'hire',money:p.hireCost,detail:'招募完成，需安排任务'});recordEvidence(draft,'organization',events,'建立雇佣关系');
      });
    const jobs:Work[]=kind==='laborer'||kind==='farmer'?['wheat','soy','flax']:kind==='artisan'?['ceramics','iron','fiber']:['wheat','soy','flax','ceramics','iron','fiber'];
    for(const job of jobs)add('assign',kind+'-'+job,WORKER_NAMES[kind]+'：'+JOB_NAMES[job],'雇佣',{},[...(!worker?['尚未招募']:[]),...(worker?.project?['先完成或接续此人的在制工序']:[]),...(worker?.active&&worker.job===job?['已安排此任务']:[])],
      '安排后每季尝试一次工作；工资与条件在季末重新检查。暂停不会清除经验或在制品。',(draft,events)=>{if(draft.economy!.operations){if(kind==='farmer')draft.economy!.operations!.farm=null;if(kind==='artisan')draft.economy!.operations!.production=null;}const w=draft.economy!.workers[kind]!;w.job=job;w.active=true;events.push({type:'economy-worker',worker:kind,operation:'assign',money:0,detail:JOB_NAMES[job]});});
    add('pause',kind,'暂停／恢复'+WORKER_NAMES[kind],'雇佣',{},!worker||worker.job==='rest'?['先招募并安排任务']:[], '保留合同、经验与在制品；暂停期间不工作、不扣工资。',(draft,events)=>{const w=draft.economy!.workers[kind]!;w.active=!w.active;events.push({type:'economy-worker',worker:kind,operation:'pause',money:0,detail:w.active?'恢复':'暂停'});});
    add('train',kind,'培训'+WORKER_NAMES[kind],'雇佣',{food:1},[...(!worker?['尚未招募']:[]),...(org<4?['需培训与知识传授']:[]),...(worker&&worker.experience>=8?['已完成此岗位培训']:[]),...(servicePending(s,'training',kind)?['正在委托培训']:[])],'花1行动与1口粮，使雇员经验+2，上限8；经验8后：普通雇工可播种，农工整地增益+1，工匠可按双份原料批量加工；工资也+1。',(draft,events)=>{draft.economy!.workers[kind]!.experience=Math.min(8,draft.economy!.workers[kind]!.experience+2);events.push({type:'economy-worker',worker:kind,operation:'train',money:0,detail:'经验+2（上限8）'});});
  }
  add('end','season','结束本季','回合',{ap:0},[],`雇佣与田间先结算，再支付${rules.parameters.foodPerTurn}粮生活；现有可食储备${foodStock(s)}。${s.socialFood?'生产后按生活安排购粮，再进食；实际扣款受当时资金、市场和运输限制。':''}`,()=>{});
  if(e.operations)out.push(...operationsActions(s,rules));
  if(e.shop)out.push(...shopActions(s,rules));
  return [...out,...expeditionActions(s,rules),...workshopActions(s,rules),...towerActions(s,rules)];
}
