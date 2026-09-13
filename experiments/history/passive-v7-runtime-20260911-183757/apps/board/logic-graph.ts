import type { Ruleset } from '../../src/game/ruleset.js';
import { DEVELOPMENT_RECIPES } from '../../src/game/systems/development.js';
import { DEVICE_RECIPES, PRODUCT_NAMES } from '../../src/game/systems/product-network.js';
import { DISCIPLINE_NAMES } from '../../src/game/model/development.js';
export interface LogicNode { id:string; name:string; kind:number; detail:string }
export interface LogicEdge { from:string; to:string; label:string; kind:'requires'|'input'|'output'|'use' }
export function buildLogicGraph(r:Ruleset) {
  const nodes:LogicNode[]=[], edges:LogicEdge[]=[];
  const add=(id:string,name:string,kind:number,detail:string)=>{if(!nodes.some(n=>n.id===id))nodes.push({id,name,kind,detail});};
  const link=(from:string,to:string,label:string,kind:LogicEdge['kind']='use')=>edges.push({from,to,label,kind});
  for(const t of r.technologies) {
    add(t.id,t.name,0,`${t.benefit} 理论基数${t.study}次，实践：${t.practices.map(p=>r.practiceNames[p]).join('、')}。理论受倍率、家学和有利经验影响；社会开放与当地来源仍需满足。`);
    for(const p of t.prerequisites)link(p,t.id,'必要前置','requires');
    for(const p of t.prerequisiteAny??[])link(p,t.id,'任选前置','requires');
    for(const p of t.helpfulPrerequisites??[])link(p,t.id,'有利经验，非门槛');
  }
  const good=(id:string,name:string,detail='实物可跨代保留；制造、持有和实际使用是不同阶段。')=>add('g:'+id,name,2,detail);
  const process=(id:string,name:string,method:string,detail:string)=>{add(id,name,1,detail);if(method)link(method,id,'方法条件','requires');};
  const result=(id:string,name:string,detail:string)=>add(id,name,3,detail);
  for(const [id,name] of Object.entries({food:'口粮',wood:'木材',clay:'黏土',woodenware:'木容器',pottery:'陶器',tool:'采集工具'}))good(id,name);
  result('harvest','耕作与口粮','收成受种源、天气、供水与设备影响；有设备不等于一定有收成。口粮用于生活，也可投入加工。');
  link('harvest','g:food','获得收成','output');
  result('storage-use','保护余粮','配置容器后增加保护容量；季末先吃粮再结算损耗。容器不凭空产粮。');
  result('trade','交换与分工','出售消耗商品与有限订单；可采购容器和工业商品，无需自己学会所有制造技能。工业采购也有每季次数限制。');
  result('legacy','家族与当地接续','实物、设施、方法材料和工艺改良保留；个人熟练度需传授。讲授与指导邻里后才形成当地方法，具备设施和合作条件才可委托经营。');
  result('seed','种源比较与定选','准备候选 → 多季对照 → 获得记录 → 选择保留或替换；研究不是自动增产。');
  const uses:Record<string,[string,string]>={observation:['harvest','耕作实践'],survey:['harvest','测量实践'],ditch:['harvest','建设渠道后引水'],allocation:['harvest','改善引水利用'],selection:['seed','准备候选'],trial:['seed','多季对照'],stabilize:['seed','依据记录定选'],'resource-observation':['g:food','改善采食']};
  for(const [id,[to,label]] of Object.entries(uses))if(r.technologies.some(t=>t.id===id))link(id,to,label);
  if(r.production) {
    const p=r.production.parameters;
    process('gather','采集当地资源','','消耗行动，扣减有限当地库存；食物、木材按季有限恢复，黏土不恢复。工具和资源观察只能改善实际可采数量。');
    for(const id of ['food','wood','clay'])link('gather','g:'+id,'按所选采集行动取得','output');
    process('craft:wood','制作木制品','woodworking',`开工消耗${p.woodRecipeCost}木材，再用行动完成；木容器与采集工具是不同配方。完成积累木作经验。${r.householdProgress?'本版完工2经验；木作等级1后普通木制品一次行动完工。':''}`);
    link('g:wood','craft:wood',`投入${p.woodRecipeCost}`,'input');link('craft:wood','g:woodenware','容器配方','output');link('craft:wood','g:tool','工具配方','output');link('g:tool','g:wood','制成即可辅助采集，消耗耐用');
    process('craft:pottery','成形与烧陶','pottery',`投入${p.potteryClayCost}黏土、${p.potteryFuelCost}木材；跨季干燥后完成。积累陶作经验。${r.householdProgress?'本版每次完工2经验，仍需跨季。':''}`);
    link('g:clay','craft:pottery',`投入${p.potteryClayCost}`,'input');link('g:wood','craft:pottery',`投入${p.potteryFuelCost}`,'input');link('craft:pottery','g:pottery','完成产出','output');
    process('fit-storage','配置储存','storage','消耗一件容器；每类最多配置一件，无需本人会制造。');
    for(const id of ['woodenware','pottery']) {link('g:'+id,'fit-storage','选择此类容器，消耗1','input');link('g:'+id,'trade','出售或购买');}
    link('fit-storage','storage-use','配置后生效');
    if(r.technologyFeedback)for(const [id,name] of [['woodworking','木工作台'],['pottery','陶窑']]){process('workshop:'+id,'建造'+name,id,'须本人掌握手艺并支付建造行动和材料；设施开放批量制作，仍需原料、陶坯干燥和销路。');link('workshop:'+id,id==='pottery'?'craft:pottery':'craft:wood','开放批量工序');link('workshop:'+id,'legacy','设施保留，可发展委托');}
  }
  if(r.development) {
    for(const [id,name] of Object.entries(DISCIPLINE_NAMES))add('s:'+id,name+'熟练度',0,'等级L需要经验至少'+r.development.parameters.experienceStep+'×L²。完成对应制作、实验或有收成的耕作积累经验；采购不增加经验。带后辈实习传授有限经验，工艺改良跨代保留。');
    link('craft:wood','s:woodwork','完成积累经验');link('craft:pottery','s:pottery','完成积累经验');link('harvest','s:agriculture','有收成积累经验');

    for(const [id,name] of Object.entries(PRODUCT_NAMES))if(r.productNetwork||!['calibrator','pump','kiln','calibrations','spentCeramics'].includes(id))good(id,name);
    for(const recipe of DEVELOPMENT_RECIPES) {
      const id='develop:'+recipe.id;
      process(id,recipe.name,recipe.method,`${DISCIPLINE_NAMES[recipe.domain]}等级≥${recipe.level}（经验≥${r.development.parameters.experienceStep*recipe.level**2}）。开工和完成各1行动${recipe.wait?'，需跨季':''}。基础产出${recipe.amount}；工艺改良可调整投入和产出。完成获得2经验。方法条件：已掌握，或学过一次且有指导来源，并满足必要前置。`);
      for(const [g,n] of Object.entries({...recipe.inputs,wood:recipe.wood,clay:recipe.clay,food:recipe.food}))if(n)link('g:'+g,id,`基础投入${n}`,'input');
      if(recipe.level)link('s:'+recipe.domain,id,'熟练等级≥'+recipe.level,'requires');
      link(id,'s:'+recipe.domain,'完成获得2经验');
      link(id,'g:'+recipe.output,`基础产出${recipe.amount}`,'output');link('g:'+recipe.output,'trade','可采购或交付');
    }
    process('experiment','材料对照实验','experimentation',`消耗1补给、1陶质构件与基础${r.development.parameters.experimentFood}额外口粮；取得1研究记录，装备可用实验器具再多1份。获得1科学经验。`);
    link('g:supplies','experiment','消耗1','input');link('g:ceramicParts','experiment','消耗1','input');link('g:food','experiment','额外口粮','input');link('experiment','g:findings','产出1，设备可加1','output');link('g:labTools','experiment','先装备，使用扣耐用');link('g:fieldTools','harvest','先装备，有收成时增粮');
    process('refine','持续改良工艺','','第n次改良需对应熟练等级n、n份研究记录和1补给；减少部分投入，每两次提高对应工业项目产出。熟练度来自真实实践，不能靠采购获得。');
    link('experiment','s:science','获得1经验');
    for(const id of Object.keys(DISCIPLINE_NAMES))link('s:'+id,'refine','对应领域等级≥改良次数','requires');
    link('g:findings','refine','消耗n','input');link('g:supplies','refine','消耗1','input');link('refine','legacy','改良跨代保留');
    for(const recipe of DEVELOPMENT_RECIPES)link('refine','develop:'+recipe.id,'对应领域改良影响配方');
  }
  if(r.productNetwork) {
    for(const recipe of DEVICE_RECIPES) {
      const id='fabricate:'+recipe.id;process(id,'制造'+PRODUCT_NAMES[recipe.id],recipe.method,'开工、完成各1行动，与其他在制品共用项目槽。'+recipe.effect);
      for(const [g,n] of Object.entries(recipe.inputs))link('g:'+g,id,`消耗${n}`,'input');link(id,'g:'+recipe.id,'产出1，尚需安装','output');link('g:'+recipe.id,'legacy','实物及安装耐用跨代保留');
    }
    process('calibrate','安装后进行校准','experimentation','先安装校准仪；每次校准耗1研究记录、1补给、1耐用度，取得1报告和1科学经验。');
    link('g:calibrator','calibrate','安装后开启');for(const id of ['findings','supplies'])link('g:'+id,'calibrate','消耗1','input');link('calibrate','g:calibrations','产出1','output');
    process('pump-water','安装后提水','','消耗1木材、1设备耐用，将1公共水存入家庭；容量2，无公共水不能提水。');good('storedWater','家用蓄水','跨季保留；缺水耕作先用蓄水，容量2。');good('publicWater','公共水','受世界过程影响的有限水源；提水会扣除公共水。');link('g:pump','pump-water','安装后开启');link('g:wood','pump-water','消耗1','input');link('g:publicWater','pump-water','转移1','input');link('pump-water','g:storedWater','存入1','output');link('g:storedWater','harvest','缺水耕作消耗');
    process('recycle','安装后回收烧结','','2用后陶料 + 1木材 + 1耐用度 → 1陶质构件；获得1陶作经验。回收有损耗。');link('experiment','g:spentCeramics','留下1','output');link('g:kiln','recycle','安装后开启');link('g:spentCeramics','recycle','消耗2','input');link('g:wood','recycle','消耗1','input');link('recycle','g:ceramicParts','回收1','output');
  }
  for(const t of r.technologies)link(t.id,'legacy','可留存方法、教学与传播');
  return {nodes,edges};
}
