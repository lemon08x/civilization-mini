import {availableDays} from '../systems/calendar.js';
import {dietView} from '../systems/social-food.js';
import {lunarDateAt} from '../systems/calendar.js';
import {FARM_PROJECT_NAMES,workFarmProject,startFarmProject,isCanalBuilt,fieldNeedsWater,irrigateField,farmCoverage,drainOutlet} from '../systems/agriculture.js';
import {plotField,blankField,exploreFarm,resolveFarmDiscovery,farmNeighbors,cookMeal} from '../systems/agriculture.js';
import {COOKING} from '../systems/economy-catalog.js';
import {stageOf} from '../model/eras.js';
import {eraCard} from '../systems/eras.js';
import {branchHas,branchNeeds} from '../systems/branches.js';
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
  const e=s.economy!,p=rules.economy!,out:ActionDefinition[]=[...modernActions(s),...farmMapActions(s)];
  const add=(op:string,target:string,label:string,group:string,cost:Parameters<typeof defineAction>[4],blockers:string[],description:string,execute:ActionDefinition['execute'])=>out.push(defineAction(s,`economy:${op}:${target}`,label,group,cost,blockers,description,execute));
  if(e.farm)for(const recipe of COOKING){
    const ingredients=Object.entries(recipe.inputs).map(([id,n])=>`${n}份${GOODS[id].name}`).join('、');
    add('cook',recipe.id,'烹饪'+recipe.name,'烹饪',{time:recipe.time,energy:recipe.energy},[...missingGoods(s,recipe.inputs),...((s.life?.calendar?.mealDays??0)>0?['当前餐食恢复效果尚未结束']:[])],`${ingredients} → ${recipe.food}天餐食恢复加成。当次享用，提供短期精力恢复加成；日常饮食另按天自动现做现吃，不消耗种子。`,(d,ev)=>cookMeal(d,recipe,ev));
  }
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
    const take=Math.min(available,2+(resource==='wood'&&equipped(s,'T01')?1:0)+(resource==='food'?(s.era?stageOf(s).gatherBonus:0):0));
    add('gather',resource,'采集'+(resource==='food'?'食物':GOODS[resource].name),'生活',{},take<1?['当地资源已耗尽']:[],`取得${take}，真实扣当地库存。${resource==='food'&&s.era&&stageOf(s).gatherBonus?'农社公地额外提供采集。':''}`,(draft,events)=>{
      draft.production!.stocks[key]-=take;if(resource==='food')draft.household.food+=take;else changeGoods(draft,{[resource]:take},1,events,'当地采集');
      if(resource==='wood'&&equipped(draft,'T01'))consumeEquipment(draft,'T01',events);
      events.push({type:'resource-gathered',resource,amount:take,remaining:draft.production!.stocks[key],toolUsed:false});
    });
  }
  add('work','local','临时做工','生活',{},s.production!.market.jobs<1?['本季岗位已满']:[],`1行动赚${(rules.parameters.workIncome+(eraCard(s)?.income??0)+(s.era?stageOf(s).workBonus:0))}钱，扣1当地岗位。${s.era&&stageOf(s).workBonus?'农社帮工提高收入。':''}`,(draft,events)=>{const pay=rules.parameters.workIncome+(eraCard(s)?.income??0)+(s.era?stageOf(s).workBonus:0);draft.production!.market.jobs--;draft.household.money+=pay;events.push({type:'income',source:'work',amount:pay});});
  for(const [id,good]of Object.entries(goodsFor(s))){
    const regional=id==='iron'&&e.regional.iron||id==='fiber'&&e.regional.fiber;
    const price=good.price+(regional?0:1);
    if(!e.shop)add('buy',id,'购买'+good.name,'交换',{ap:0,time:0,energy:0,money:price},e.industrySupply<1?['本季采购额度用完']:[],`购入1${good.name}，价格${price}钱；地区供应成熟后铁料／纤维采购价下降1钱，仍不低于交付价。`,(draft,events)=>{
      const n=1;
      draft.economy!.industrySupply--;changeGoods(draft,{[id]:n},1,events,'市场采购');events.push({type:'economy-trade',good:id,operation:'buy',amount:n,money:price});
    });
    for(const food of [false,true])add(food?'sellfood':'sell',id,'交付'+good.name+(food?'并购粮':''),'交换',{},[
      ...missingGoods(s,{[id]:1}),...(e.market<1?['本季订单已满']:[]),...(food&&s.production!.market.food<2?['市场不足2粮']:[]),...(food&&s.socialFood&&s.socialFood.serviceRemaining<2?['食品服务人员额度不足']:[]),...(food&&s.socialFood&&e.shop!.transport<2?['食品共享运输不足']:[]),...(food&&s.household.money+salePrice(s,id)<2*(s.socialFood?.price??rules.parameters.foodPrice)?['货款与现钱不足购粮']:[]),
    ],`交付1件得${salePrice(s,id)}钱${food?`，同时花${2*(s.socialFood?.price??rules.parameters.foodPrice)}钱买2粮`:''}；商品、钱款、订单和粮源真实扣减。`,(draft,events)=>{
      changeGoods(draft,{[id]:1},-1,events,'订单交付');draft.economy!.market--;draft.household.money+=salePrice(s,id);
      events.push({type:'economy-trade',good:id,operation:'sell',amount:1,money:salePrice(s,id)});
      if(food){const money=2*(s.socialFood?.price??rules.parameters.foodPrice);draft.household.money-=money;draft.household.food+=2;draft.production!.market.food-=2;if(draft.socialFood){draft.socialFood.serviceRemaining-=2;draft.economy!.shop!.transport-=2;}events.push({type:'food-purchased',amount:2,money});}
    });
  }
  if(!e.shop)add('buyfood','bulk','买入4口粮','生活',{ap:0,time:0,energy:0,money:4*(s.socialFood?.price??rules.parameters.foodPrice)},s.production!.market.food<4?['市场不足4粮']:[],'购买普通即食口粮；仓库里的小麦、大豆和面粉也会在季末按需用于生活。',(draft,events)=>{draft.production!.market.food-=4;draft.household.food+=4;events.push({type:'food-purchased',amount:4});});
  for(const crop of Object.keys(CROPS) as Crop[])add('farm',crop,(e.field.crop?'管理／收获':'播种')+CROPS[crop].name,'农业',{ap:e.shop&&!e.field.crop&&equipped(s,'U02')&&e.shop.seededTurn!==s.clock.absoluteTurn?0:1},[
    ...(e.farm&&!e.farm.discovered.includes(crop)?['尚未发现此种子']:[]),...(e.field.crop&&e.field.crop!==crop?['田里种植的是其他作物']:[]),...farmBlocker(s,crop),
  ],'空田播种；生长期缺水时灌溉；成熟后收获。此入口操作起始田，个人与雇工共用。',(draft,events)=>farmWork(draft,crop,events));
  add('fertilize','field','施用堆肥','农业',{},[...(e.branches?branchNeeds(s,['A3']):requirements(s,{agronomy:3})),...missingGoods(s,{compost:1}),...(e.field.composted||e.field.fertility>=3?['本茬已施肥或肥力充足']:[])],'消耗1堆肥，土壤肥力+1，上限3；不直接创造粮食。',(draft,events)=>{changeGoods(draft,{compost:1},-1,events,'施肥');draft.economy!.field.fertility++;draft.economy!.field.composted=true;recordEvidence(draft,'agronomy',events,'堆肥施用');});
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
    add('hire',kind,'雇佣'+WORKER_NAMES[kind],'雇佣',{money:p.hireCost},[...(e.branches?(kind==='manager'?['管理进阶分支尚未接入']:[]):org<required?[ `需生产组织第${required}阶或家族记录`]:[]),...(worker?['已雇有此岗位']:[]),...(Object.keys(e.workers).length>=capacity?['达到当前组织人数上限']:[]),...(e.recruitment<1?['本季招募机会用完']:[])],
      `招募费${p.hireCost}钱，之后按实际工作季支付工资；无任务、缺料、设备占用时待命不收费。熟练人员可使用其专业工艺，不赠送本人技能。`,(draft,events)=>{
        if(draft.economy!.industry){const r=draft.economy!.industry!.rules;draft.economy!.industry!.workers[kind]={timeRemaining:r.workerTime,energy:r.workerEnergy};}
        draft.economy!.recruitment--;draft.economy!.workers[kind]={kind,experience:kind==='laborer'?0:4,job:'rest',active:false,project:null};
        events.push({type:'economy-worker',worker:kind,operation:'hire',money:p.hireCost,detail:'招募完成，需安排任务'});recordEvidence(draft,'organization',events,'建立雇佣关系');
      });
    const crops=Object.keys(CROPS) as Work[];
    const jobs:Work[]=kind==='laborer'||kind==='farmer'?crops:kind==='artisan'?['ceramics','iron','fiber']:[...crops,'ceramics','iron','fiber'];
    for(const job of jobs)add('assign',kind+'-'+job,WORKER_NAMES[kind]+'：'+JOB_NAMES[job],'雇佣',{},[...(!worker?['尚未招募']:[]),...(worker?.project?['先完成或接续此人的在制工序']:[]),...(worker?.active&&worker.job===job?['已安排此任务']:[])],
      '安排后每季尝试一次工作；工资与条件在季末重新检查。暂停不会清除经验或在制品。',(draft,events)=>{if(draft.economy!.operations){if(kind==='farmer')draft.economy!.operations!.farm=null;if(kind==='artisan')draft.economy!.operations!.production=null;}const w=draft.economy!.workers[kind]!;w.job=job;w.active=true;events.push({type:'economy-worker',worker:kind,operation:'assign',money:0,detail:JOB_NAMES[job]});});
    add('pause',kind,'暂停／恢复'+WORKER_NAMES[kind],'雇佣',{},!worker||worker.job==='rest'?['先招募并安排任务']:[], '保留合同、经验与在制品；暂停期间不工作、不扣工资。',(draft,events)=>{const w=draft.economy!.workers[kind]!;w.active=!w.active;events.push({type:'economy-worker',worker:kind,operation:'pause',money:0,detail:w.active?'恢复':'暂停'});});
    add('train',kind,'培训'+WORKER_NAMES[kind],'雇佣',{food:1},[...(!worker?['尚未招募']:[]),...(org<4?['需培训与知识传授']:[]),...(worker&&worker.experience>=8?['已完成此岗位培训']:[]),...(servicePending(s,'training',kind)?['正在委托培训']:[])],'花1行动与1口粮，使雇员经验+2，上限8；经验8后：普通雇工可播种，农工整地增益+1，工匠可按双份原料批量加工；工资也+1。',(draft,events)=>{draft.economy!.workers[kind]!.experience=Math.min(8,draft.economy!.workers[kind]!.experience+2);events.push({type:'economy-worker',worker:kind,operation:'train',money:0,detail:'经验+2（上限8）'});});
  }
  if(!s.life?.calendar)add('end','season','等到下一季','回合',{ap:0},[],`推进到下一季，按日进食与生长；任何田成熟、缺粮、节气、节日或换季会停下。季末只结算生产、保存损耗和人物时代，不重复进食。现有可食库存${foodStock(s)}批`,()=>{});
  if(e.operations)out.push(...operationsActions(s,rules));
  if(e.shop)out.push(...shopActions(s,rules));
  return [...out,...expeditionActions(s,rules),...workshopActions(s,rules),...towerActions(s,rules)];
}


function farmMapActions(s:GameState):ActionDefinition[]{
 const farm=s.economy?.farm;if(!farm)return [];const r=farm.rules,out:ActionDefinition[]=[];
 const event=(d:GameState,ev:import('../model/events.js').GameEvent[],detail:string)=>ev.push({type:'life',personId:d.household.activePersonId,operation:'farm-map',detail});
 for(const p of Object.values(farm.plots)){
  if(p.kind==='unknown'&&farmNeighbors(p).some(n=>farm.plots[n.id]&&farm.plots[n.id].kind!=='unknown'))out.push(defineAction(s,'economy:farmexplore:'+p.id,'探索 '+p.id,'农业',{time:branchHas(s,'A11')?Math.max(3,r.surveyDays-2):r.surveyDays,energy:r.exploreEnergy},[],'揭开相邻地块；探索结果永久保留，不提前显示资源。',(d,ev)=>{
   exploreFarm(d,p.id,ev);
  }));
  if(p.kind==='wild'&&!p.project)out.push(defineAction(s,'economy:farmreclaim:'+p.id,'开垦 '+p.id,'农业',{time:r.reclaimDays,energy:r.reclaimEnergy,money:r.reclaimMoney},[],'开垦为独立田块。新田手动管理；起始田的公共供水、井泵不自动覆盖新田。',(d,ev)=>{const plot=d.economy!.farm!.plots[p.id];plot.kind='field';plot.field={...blankField(),fertility:plot.fertility??2};event(d,ev,p.id+' 已开垦');}));
  if(p.kind==='wild'||p.discovery&&!p.discovery.resolved){
   const kinds:import('../model/economy.js').FarmProjectKind[]=p.kind==='wild'?['canal','pond','drain']:p.discovery?.id==='canal'?['canal']:p.discovery?.id==='fallow'?['restore']:p.discovery?.id==='woodland'?['timber','clearwood','shelter']:[];
   for(const kind of kinds){
    if(p.project&&p.project.kind!==kind)continue;
    const total=p.project?.total??(kind==='canal'?r.canalDays:kind==='restore'?r.restoreDays:kind==='pond'?r.pondDays:kind==='drain'?r.drainDays:r.woodlandDays),done=p.project?.done??0;
    const stageEnd=done<total/2?total/2:total;
    const harvest=Math.min(Infinity,...Object.values(farm.plots).map(t=>plotField(s,t.id)).filter(f=>f?.crop).map(f=>Math.max(0,f!.duration-f!.growth)));
    const maximum=Math.max(0,Math.floor(Math.min(stageEnd-done,availableDays(s),dietView(s)?.days??0,harvest)*2)/2);
    const options=[...new Set([Math.min(3,maximum),Math.min(7,maximum),maximum])];
    for(const days of options){
     const materials=['canal','pond','drain'].includes(kind)&&!p.project?missingGoods(s,{wood:r.projectWood}):[];
     const effect=kind==='canal'?`首段耗${r.projectWood}木材；完成后正交四格共享每${r.waterCycleDays}天${r.canalDoses}次补水，每次扣1公共水；不能自流供给更高田地`:kind==='pond'?`首段耗${r.projectWood}木材；周围八格共享${r.pondCapacity}份储水，每${r.waterCycleDays}天最多补水${r.pondDoses}次；每连续${r.rainRiseDays}天连雨蓄${r.pondRainGain}份，建成时为空`:kind==='drain'?`首段耗${r.projectWood}木材；正交四格每${r.waterCycleDays}天共享${r.drainDoses}次排水；每次降低过湿/积水一档，需要低位出口`:kind==='restore'?'完成后直接建成肥力3的田':kind==='timber'?`完成后获得${r.timberYield}木材，留下普通荒地`:kind==='clearwood'?'完成后直接建成肥力2的田，不额外获得木材':`完成后正交四格失水间隔延长${r.shelterDays}天，不叠加`;
     const source=kind==='canal'&&p.discovery?.id!=='canal'&&!farmNeighbors(p).some(n=>farm.plots[n.id]?.improvement==='canal'&&farm.plots[n.id].land!.elevation>=p.land!.elevation)?['新渠需连接同高或更高的已建水渠']:[];
     const outlet=kind==='drain'&&!drainOutlet(s,p)?['需正交相邻低地、连通有出口的沟，或位于北/西地图边界']:[];
     const date=s.life?.calendar?lunarDateAt(s.life.calendar.rules.referenceYear,s.life.calendar.absoluteDay+days).date:'';
     const definition=defineAction(s,`economy:farmproject:${p.id}-${kind}-${days*2}`,`${FARM_PROJECT_NAMES[kind]} · ${days?`投入${days}天`:'暂缓'}`,'地块工程',{time:days,energy:days?Math.min(6,Math.ceil(days/3)):0},[...materials,...source,...outlet,...(days<=0?['先收获成熟作物或补给，再继续工程']:[])],`总工期${total}天，已完成${done}天；${done<total/2?'整备':'施工'}阶段。本次至${date}，按当前饮食约需${Number((days*(dietView(s)?.dailyGrain??0)).toFixed(3))}批食材。${effect}。${['canal','shelter','pond','drain'].includes(kind)?`覆盖格：${farmCoverage(p,kind==='pond'?8:4).map(n=>n.id).join('、')}`:'仅改造本格'}。开工后固定用途；进度跨季、换代保留。`,(d,ev)=>workFarmProject(d,p.id,kind,days,total,ev));
     definition.prepare=(d,ev)=>startFarmProject(d,p.id,kind,total,ev);out.push(definition);
    }
   }

   const key=p.discovery&&!p.discovery.resolved?p.discovery.id:undefined;
   const choice=(id:string,label:string,time:number,energy:number,blockers:string[],description:string,food=0)=>out.push(defineAction(s,`economy:farmstory:${p.id}-${id}`,label,'探索',{time,energy,food},blockers,description,(d,ev)=>resolveFarmDiscovery(d,p.id,id,ev)));
   if(key==='brambles')choice('clear','清理荆棘',r.clearTime,r.clearEnergy,[],'投入劳力清理，此后可以开垦；也可保留并探索旁边。');
   if(key==='seedbag'||key==='heritage')choice('identify','辨种与留种',branchHas(s,'A11')?Math.min(r.identifyTime,r.interactionTime):r.identifyTime,1,branchNeeds(s,['A0']),'辨认一次，领取种子；地块随后可开垦。异穗麦独立留种，不能在集市购买。');

   if(key==='traveler')choice('share','分一份口粮，听旅人讲述',r.interactionTime,0,[],`付${r.storyFood}份即食口粮，回赠${r.discoverySeeds}麦种；不会扣种子当口粮。`,r.storyFood);
   if(key==='shrine')choice('preserve','描下旧界，保留地标',r.interactionTime,0,[],'永久保留此格，不能开垦；周边仍可探索。');
   if(p.kind==='story'&&!p.project&&key!=='woodland')choice('leave',key==='traveler'?'指路告别':'整理为普通荒地',r.interactionTime,0,[],'结束这次事件，放弃奖励，此格可按普通荒地开垦。');
  }
  if(p.kind!=='field')continue;const field=plotField(s,p.id)!;
  if(s.life?.calendar&&field.crop&&field.growth<field.duration)out.push(defineAction(s,'economy:wait:'+p.id,'等到 '+p.id+' 收获','日历',{ap:0,time:Math.min(field.duration-field.growth,availableDays(s)),energy:0},[],'最多等到此田成熟；其他田成熟、缺粮、节气或节日也会提前停下。',()=>{}));
  for(const crop of Object.keys(CROPS) as Crop[]){
   out.push(defineAction(s,`economy:farmplot:${p.id}-${crop}`,`${p.id} ${!field.crop?'播种':field.growth>=field.duration?'收获':'灌溉'}${CROPS[crop].name}`,'农业',{ap:s.economy!.shop&&!field.crop&&equipped(s,'U02')&&s.economy!.shop.seededTurn!==s.clock.absoluteTurn?0:1},[...(field.crop&&field.crop!==crop?['田里是另一种作物']:[]),...(!farm.discovered.includes(crop)?['尚未发现此种子']:[]),...farmBlocker(s,crop,undefined,field)],'只处理指定田块，实际扣种子、水、时间、精力和工具耐用；生长、肥力与留种沿用农业规则。',(d,ev)=>{const start=ev.length;farmWork(d,crop,ev,undefined,plotField(d,p.id)!);for(const e of ev.slice(start))if(e.type==='economy-farm'){e.plotId=p.id;} }));
  }
  if(farm.rareSeeds>0||field.variety==='heritage')out.push(defineAction(s,'economy:farmrare:'+p.id,p.id+' 播种异穗麦','农业',{time:s.life?.renewal?.farmTime??3,energy:s.life?.renewal?.farmEnergy??2},[...branchNeeds(s,['A0']),...(field.crop?['田里已有作物']:[]),...(farm.rareSeeds<1?['没有异穗麦种']:[])],`消耗1份异穗麦种；成熟收成增加${r.rareBonus}，收获返还1份异穗麦种；不消耗普通麦种，仍受灾害影响。`,(d,ev)=>{const start=ev.length;farmWork(d,'wheat',ev,undefined,plotField(d,p.id)!,true);for(const e of ev.slice(start))if(e.type==='economy-farm')e.plotId=p.id;}));
  out.push(defineAction(s,'economy:farmfertilize:'+p.id,'给 '+p.id+' 施堆肥','农业',{},[...branchNeeds(s,['A3']),...missingGoods(s,{compost:1}),...(field.composted||field.fertility>=3?['本茬已施肥或肥力充足']:[])],'仅本地块肥力+1，上限3。',(d,ev)=>{changeGoods(d,{compost:1},-1,ev,'地块施肥');const f=plotField(d,p.id)!;f.fertility++;f.composted=true;event(d,ev,p.id+' 肥力提升');}));
 }
 const npc=s.sect!.current[1],n=farm.neighbor,person=s.persons[npc],trust=s.persons[s.household.activePersonId].vitality!.experiences!.relationships[npc]??0;
 const needs=person.vitality!.alive?[]:['同门已故，无法互动'];
 const available=(time:number,energy=0)=>[...needs,...(s.sect!.members[npc].time<time||person.vitality!.energy<energy?['同门本季劳力不足']:[])];
 const use=(d:GameState,time:number,energy=0)=>{d.sect!.members[npc].time-=time;d.persons[npc].vitality!.energy-=energy;};
 out.push(defineAction(s,'economy:neighbor:talk','与同门聊近况','同门',{time:r.interactionTime,energy:0},[...available(r.interactionTime),...(n.talked===s.clock.absoluteTurn?['本季已经聊过']:[])],'双方投入时间，关系+1，上限5；不会切换人物或共享库存。',(d,ev)=>{use(d,r.interactionTime);const a=d.persons[d.household.activePersonId].vitality!.experiences!,b=d.persons[npc].vitality!.experiences!,v=Math.min(5,(a.relationships[npc]??0)+1);a.relationships[npc]=v;b.relationships[d.household.activePersonId]=v;d.economy!.farm!.neighbor.talked=d.clock.absoluteTurn;event(d,ev,`与${person.name}交谈，关系${v}`);}));
 for(const crop of ['soy','flax','mallow','rice'] as const)out.push(defineAction(s,'economy:neighbor:trade-'+crop,`与同门换${CROPS[crop].name}种子`,'同门',{time:r.interactionTime,energy:0},[...available(r.interactionTime),...missingGoods(s,{wheat:r.tradeQuantity}),...((n.goods[CROPS[crop].seed]??0)<r.tradeQuantity?['同门种子存量不足']:[]),...(crop==='rice'&&!isCanalBuilt(s)?['建成至少一条渠后，同门才肯分出稻种']:[]),...(n.traded===s.clock.absoluteTurn?['本季已交换']:[])],`${r.tradeQuantity}小麦换${r.tradeQuantity}种子；实际从双方独立库存扣除，每季一次。${crop==='rice'?'同门只与已通渠的农户交换稻种。':''}`,(d,ev)=>{use(d,r.interactionTime);const f=d.economy!.farm!,nn=f.neighbor;changeGoods(d,{wheat:r.tradeQuantity},-1,ev,'同门交换');changeGoods(d,{[CROPS[crop].seed]:r.tradeQuantity},1,ev,'同门交换');nn.goods.wheat=(nn.goods.wheat??0)+r.tradeQuantity;nn.goods[CROPS[crop].seed]-=r.tradeQuantity;nn.traded=d.clock.absoluteTurn;if(!f.discovered.includes(crop))f.discovered.push(crop);event(d,ev,`与${person.name}交换种子；发现后可在集市补购`);}));
 out.push(defineAction(s,'economy:neighbor:learn','向同门请教油料与纤维种植','同门',{time:r.exploreTime,energy:r.interactionTime},[...available(r.exploreTime,r.interactionTime),...(trust<1?['先与同门相识']:[]),...branchNeeds(s,['A0']),...(branchHas(s,'A4')?['已经掌握']:[]),...(!branchHas(s,'A4',npc)?['同门尚未掌握']:[])],'双方投入劳动，学习A4；不赠送种子，也不复制其他课程。',(d,ev)=>{use(d,r.exploreTime,r.interactionTime);d.economy!.branches!.learned[d.household.activePersonId].push('A4');ev.push({type:'branch',operation:'learned',node:'A4',detail:`向同门${person.name}学会油料与纤维种植`});}));
 for(const p of Object.values(farm.plots).filter(p=>p.kind==='field')){
  const f=plotField(s,p.id)!;out.push(defineAction(s,'economy:neighbor:help-'+p.id,'请同门给 '+p.id+' 浇水','同门',{time:r.interactionTime,energy:0},[...available(r.exploreTime,r.exploreEnergy),...(n.helped===s.clock.absoluteTurn?['本季已请求帮助']:[]),...(!f.crop||f.growth>=f.duration||!fieldNeedsWater(s,f)?['此田无需灌溉']:[])],'请求不等于指派：关系不足或同门忙碌会婉拒；接受时耗同门自己的时间、精力与私井供水，每季最多帮助一块田。',(d,ev)=>{const nn=d.economy!.farm!.neighbor;nn.helped=d.clock.absoluteTurn;if(trust<1||nn.busy){event(d,ev,`${person.name}婉拒：${trust<1?'还不熟悉':'本季忙着照料自己的田'}`);return;}use(d,r.exploreTime,r.exploreEnergy);const f=plotField(d,p.id)!;irrigateField(d,f);f.tended=d.clock.absoluteTurn;event(d,ev,`${person.name}用自家供水照料${p.id}，恢复到该作物适宜水分`);}));
 }
 return out;
}
