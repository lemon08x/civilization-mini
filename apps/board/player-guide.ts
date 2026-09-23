import type { SessionObservation } from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
import {landArt} from './illustration.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {sowingSeasons} from '../../src/game/systems/agriculture.js';
import type {Crop} from '../../src/game/model/economy.js';

export const pageNames:Record<string,string>={
  图鉴:'图鉴',工坊:'工坊',贸易:'贸易',资本:'资本',社会:'社会历程',聚落:'经营近况',农业:'农场',生活:'补给与谋生',家人:'我',修炼:'道',仓库:'仓库',安排:'安排与计划',
  学科:'术',制造:'制造',系统:'生产系统',雇佣:'人员安排',商城:'集市',
  能源:'供能',家业:'家业',作坊:'作坊',副本:'副本',试炼:'试炼',
};

export const stageModules:Record<string,{stage:number;era:string;art:string;theme:string;intro:string;steps:readonly [string,string][]}>={
 工坊:{stage:1,era:'市镇百工',art:'workshop',theme:'把收成做成更好的东西',intro:'以农产品加工为中心，学习制作工具，再用工具组织生产。',steps:[['原料台','接入农场收成，选择要加工的原料。'],['工具台','学习工具制作，准备加工所需的器具。'],['加工台','选择配方，将农产品制成更高价值的产物。']]},
 贸易:{stage:2,era:'电力工业',art:'trade',theme:'生产之后，让产品找到买家',intro:'购买生产工具进入行业，雇佣劳动力搭建流水线，通过宣传和销售管理库存。',steps:[['采购与用工','购买设备，配置岗位与劳动力。'],['生产线','安排投入与产出，控制生产节奏。'],['宣传与销售','寻找市场，销售产品，避免库存积压。']]},
 资本:{stage:3,era:'现代社会',art:'capital',theme:'从经营收入走向资本配置',intro:'第四阶段的金融玩法入口。具体机制待后续确定。',steps:[['资产总览','预留资产与资金概况的位置。'],['投资配置','预留投资选择的位置。'],['收益与风险','预留收益、风险及资金流动的展示位置。']]},
};
export function stageModulePage(g:SessionObservation['game'],page:string,production=''):string {
 const m=stageModules[page];if(!m)return '';
 const open=(g.era?.index??0)>=m.stage;
 return `<section class="era-module"><header class="era-module-hero"><img src="/illustrations/ui/era-nav-${m.art}.webp" alt="" width="160" height="160"><div><span class="era-module-status">第 ${m.stage+1} 阶段 · ${m.era} · ${open?'页面已开放':'尚未开放'}</span><h3>${m.theme}</h3><p>${m.intro}</p></div></header>${open&&production?`${production}<p class="era-module-note">${m.stage===1?'工具制作与农产加工已开放，更多生产协作仍在筹备。':'以下为设备专业制造；宣传、销售渠道与完整市场玩法仍在筹备。'}</p></section>`:`<div class="era-module-flow">${m.steps.map(([name,detail],i)=>`<article><span class="era-module-step">0${i+1}</span><h4>${name}</h4><p>${detail}</p><span class="era-module-placeholder">${open?'筹备中':'进入'+m.era+'后开放'}</span></article>`).join('')}</div><div class="era-module-note">${m.stage===3?'资本玩法仍在筹备中，暂不提供投资操作。':'当前仅可预览；到达对应阶段后可在这里制作工具、设备或加工物资。'}</div>${open?'<p><button type="button" data-page="农业" data-destination="manufacture">农具与加工 →</button> <button type="button" data-page="工坊">工坊生产 →</button> <button type="button" data-page="贸易">工业设备 →</button></p>':''}</section>`}`;
}

export type PlayerGroup = {name:string;pages:string[];description:string;epigraph:string};

export function playerGroups(g:SessionObservation['game']):PlayerGroup[] {
  const e=g.economy!;
  const groups:PlayerGroup[]=[
    {name:'我',pages:['家人'],description:'我的状态、成长与当下事务',epigraph:'从此刻的自己，安排下一步。'},
    ...(g.sect?[{name:'道',pages:['修炼'],description:'个人五境、本门心法与修道机缘',epigraph:'静以修身，学以致用。'}]:[]),
    {name:'术',pages:['学科'],description:'研习各阶段知识与技艺',epigraph:'学以致用，回到田间与工坊实践。'},
    {name:'近况',pages:['聚落'],description:'查看经营安排与当前缺口',epigraph:'把日子安顿好，才有余裕向前。'},
    {name:'农场',pages:['农业'],description:'种田、照料与收成',epigraph:'田里有收成，家里才有下一季。'},
    ...Object.entries(stageModules).map(([name,m])=>({name,pages:[name],description:m.intro,epigraph:m.theme})),
    {name:'集市',pages:['商城'],description:'物资、设备、学习服务与家庭资产的买卖',epigraph:'钱要花在最缺的地方。'},
    {name:'经营与交易',pages:[
      '生活','仓库','安排',
      e.industryView?'系统':'家业',
      ...(e.industryView?[]:['雇佣']),
      ...(e.modern?['能源']:[]),
      ...(e.workshopView?['作坊']:[]),
      ...(e.expeditionView?['副本']:[]),
      ...(e.towerView?['试炼']:[]),
    ],description:'补给买卖、计划安排与生产人员',epigraph:'家业要有人守，也要有人去换。'},
  ];
  if((g.era?.index??0)===0)return groups.filter(x=>!['近况','集市','经营与交易'].includes(x.name));
  return groups;
}

export function chapterEpigraph(g:SessionObservation['game'],page:string):string {
  if(page==='图鉴')return '识百物，知来处，也看见日后生活的可能。';
  return playerGroups(g).find(x=>x.pages.includes(page))?.epigraph??'先安排这一季的日子。';
}

export function ruleGuide(g:SessionObservation['game'],page:string):string {
  const e=g.economy!;
  if(page==='农业'&&e.farm)return landGuide(g);
  if(stageModules[page])return stageModulePage(g,page);
  if(g.sect&&page==='修炼')return `<section class="rules-page"><button class="text-btn" data-page="修炼">← 返回修炼图</button><h2>修炼规则</h2><p>个人五境：定心、观照、知止、守一、通明。名称只表示现有境界，每${g.sect.rules.stageProgress}修为一境；新入门从零修习。</p><p>点击节点只查看详情；静心修道、授徒修道及研证心法通过行动按钮实际结算。切换传人同样是游戏行动，不会刷新预算；节点详情展示当前行动者的数据。</p><p>个人道改善其他行动的时间与精力成本，不能代替知识、物资或电力。心法改进跨代保留，后人仍须逐境修习才能发挥效果。</p><p>研证须个人满境，掌握足够课程并涉猎三类学科，完成两类亲身实践；每级累计${g.sect.rules.doctrineSteps}次付费研证。实际条件和花费以行动报价为准。</p><p>机缘仅为辅助，收在图谱下方；未抽卡不影响修炼与传承。</p></section>`;
  if(g.sect&&['家人','社会'].includes(page))return `<section class="rules-page"><button class="text-btn" data-page="${page}">← 返回</button><h2>${pageNames[page]} · 规则</h2><p>你只控制自己，另一位是独立同门，可在农场拜访。自己的弟子成年后即可交接，同门不参与传承。</p><p>个人入门从零修道。高修为、跨学科实践和多次研证才能永久改进本门道法；本人道的效果已计入行动报价。术须亲自学习，可由师父付出双方时间与精力传授。</p><p>修道阶段产生少量气运；抽卡仅作辅助，不降低修为、不直接给分。概率以行动前报价为准。</p><p>跨时代保留同一师徒谱系、修为和所学。进入现代自动召集，有${g.sect.rules.modernSeasons}季准备期限；四类危机每类须至少完成兜底。各副本只计已完成最高难度分数，升级不叠加旧档分，未完成任务无分。提前结束会判定使命成败。</p></section>`;

  const guides:Record<string,[string,string][]>={
    图鉴:[['查阅物品','按类别、名称或用途检索。已实装表示已有游戏规则，不代表当前阶段已开放或已经拥有。'],['规划中的内容','仅为未来种植、烹饪与加工方向；来源和用途是设计设想，没有实际配方、数值或获取行动。']],
    社会:[['何时结算','阶段期限按实际日历天数计算，换代不重置。提前结束立即兑现已得回报，剩余天数按50%折算、向下取整到半天加入下一阶段，不额外等待换季。只兑现实际取得的回报，不再推算未来收益。现代期限也可接收结转，旅程结束不再结转。水井和泵不是过关条件。'],['社会服务','每个时代提供不靠科技树的公共服务：农耕村落有公地采食和帮工，市镇百工有公井和公共磨坊，电力工业有铁/电工市场，现代有配送和自来水。'],['科技开放','部分课程要社会发展后才出现。个人知识不跨时代复制；新人物从基础学习，生产规程与公共记录保留。'],['收益归属','凭证只在本阶段兑现。后期自来水不会追溯取消前期水井的价值。最终副本只影响现代阶段的胜负，不是离开现代的条件。']],
    学科:[['学堂有什么用','知识是研发与建设的前置。学会知识后，再去产品研发取得相应产品；学习本身不会赠送设备。'],['怎样学习','先展开一门课程，检查前置、效果与当前报价，再点击学习。当前学习只消耗时间与精力，不消耗样品。费用受天赋和传承影响，以行动按钮为准。'],['分叉而不是单链','力学、材料、农学、组织都从根节点分出并列分支。学田间水分不是学肥力或油料作物的前提；学交付不必先开工序。数学在基础之后分成应用数学与账目计量。'],['社会开放课程','成形、泵、发电等要社会发展后才开放。农业就能学的是栽培、储存、基础力学和劳动分工。跨时代保留人物与已学知识；新入门弟子仍须逐项学习。'],['三种状态','当前可学：已满足知识前置，仍需足够时间和精力。待前置：先学指定课程。已掌握：可以查看记录与教导选项。'],['知识怎样传承','弟子仍需按前置逐项学习。师承前代学过的知识会降低学习成本；教导可以让后辈提前掌握。留存记录不等于自动学会。'],['产品与知识的区别','实物、产品验证、制造规程分别记录。买到实物不会自动获得制造规程；具体要求在农场、工坊或贸易主场景查看。']],

    家人:[['养育决定起点','后辈未成年前，每一季吃饱、被陪伴、被教导都会记入养育记录；成年那一季按记录一次性结算体质加成，每个后辈出生时独立随机获得天赋并终身保留；教导帮助后辈学习，不会重抽天赋。性别不影响能力，每个人都能从事全部活动。姓名与面貌在接班后保留；肖像随年龄变化；跨时代会开启新的随机人物与家族，旧人物留作历史记录。陪伴行动在家人页，每季一次。'],['时间与精力',`农历有大小月与闰月，按立春、立夏、立秋、立冬换季；行动推动日历，可跨季进行；换季只改变物候，精力与健康随日常饮食和时间恢复，系统劳动仍占用时间。`],['恢复与健康',`休息换取精力，疗养恢复健康。饱食随日期缓慢恢复身体；持续缺粮会加重损伤。健康上限随年龄变化。`],['长辈请教','交接后退休长辈仍在世时，可以请教其掌握的课程：本人下一次学习该课程的时间减少。每门课程每代一次，交接后重新计算；长辈离世后不可再请教。'],['交接','在满足条件时准备交接，再由后辈接手。同一时代由后辈接班；跨时代则换成无亲属关系的新随机人物。实物与公共记录保留，个人知识仍需学习。']],
    制造:[['研发顺序','前置知识与产品验证 → 试制或检验 → 验证记录。材料只在制造或检验时投入。'],['三类成果','实物可以使用或消耗；验证记录证明产品已验证；制造规程支持后续制造。购买实物不附赠规程。'],['试运行','泵与发电机首次试制还需实际试运行。详情列出当前缺少的知识、产品与材料。'],['加工','先查看配方投入、产出和设备要求。开工投入材料，跨季项目需等待并完成才能获得产品。'],['设备占用','本人和雇员共用设备，不能重复占用。已有制造规程与个人知识是不同条件，以当前行动要求为准。']],
    系统:[['运行顺序','建设 → 实际调试 → 安排本人或员工 → 运行。安排人员后查看劳动预留；取消安排可释放预算。'],['为什么停机','系统会检查材料、水源、设备、人力和工资；不满足条件时待命。查看每个系统的当前阻碍。'],['劳动与成本',`员工按实际任务结算工资${e.industryView?`，每 ${e.industryView.rules.wageTimeUnit} 工作时间计 1 钱，单任务向上取整`:''}。本人劳动占用时间与精力。供水按需执行，轴加工每季一批。`],['自动化范围','当前仍需本人播种、收获、采购和交付。外部供粮与维修不代表自有系统无人运行。']],
    商城:[['采购','选择商品加入清单，检查总价后整单结账；购买不消耗时间与精力。'],['到货','现货即刻使用，订货下一季到场。留意当前库存与运输限制。'],['交付与生活','交付会扣除真实物资。预留家庭口粮、工资与下一轮生产需要的材料。']],
    仓库:[['食物消耗',`每季消耗 ${g.parameters.foodPerTurn} 粮。即食粮不足时，面粉、小麦、大豆、小米、稻谷、稻米、小豆、葵菜、芥菜与腌菜依次补生活缺口；种子不当饭吃，食盐不是口粮。`],['保存',`当前保存保护容量 ${e.storage}。超出保护的物资可能发生保存损耗。`]],
    生活:[['社会食品','在安排页选择自给优先、市场生活或保留储备。采购按预算、资金、共享库存与运输部分执行；暂停自动购买后仍可手动买粮。购买不占个人时间；自动购粮按实际预算与供应执行。'],['零存粮生活','家中没有粮不等于缺粮；查看预计购粮与生活缺口。工资、其他开支和本季采购会改变报价，按日以实际条件结算。'],['谋生与补给','通过当前开放的采集、做工和补给行动维持生活。每项行动都有实际时间、精力和资源成本。'],['行动受限','条件不足的按钮会显示原因。需要恢复时到家人页；需要买粮时到集市。']],
    安排:[['安排页管什么','这里集中长期计划：吃饭策略、田地托管、生产计划、补货交付与维护。设定后每季自动执行，不需要重复点击。'],['吃饭','选择自给优先、市场生活或保留储备，并设定每季购粮预算、储备目标与配送方式；即时库存与缺口在生活页查看。'],['田地与生产','农业托管交给熟练农工，生产计划交给熟练工匠，都需先具备对应人员与条件。补货、交付与维护可随时开关。'],['接续安排','换代后经营安排会暂停；回到本页接续即可恢复供粮、农业、生产与维护配置。']],
    能源:[['供能','本季供能需要本人执行；启用设备不等于已经发电。安装、启用和本季实际运行是三种状态。'],['余电与储能','余电可存入已启用的储能设备；未储存的电会在季末耗散。季末不会自动发电。电灯降低工作精力消耗；调度仍有天数与精力报价。']],
  };
  const rows=guides[page]??[['一季怎样推进','先安排口粮，再按目标学习或生产。每次行动都会结算成本；推进日历会结算生活消耗、生产和恢复。'],['从哪里开始','本季看板处理当下缺口；家人处理恢复、养育与传承；学习处理知识成长，各阶段主场景处理制造；经营与交易处理补给、安排与买卖。本季纪事只显示当前摘要。']];
  return `<section class="rules-page"><button type="button" class="text-btn" data-page="${esc(page)}">← 返回${pageNames[page]??page}</button><h2>${pageNames[page]??page} · 规则详情</h2><p class="subtle">当前规则 ${esc(g.rulesVersion)} · 具体行动以当前报价与条件为准</p>${rows.map(([title,body],i)=>`<article class="rule-section"><span>${i+1}</span><div><h3>${title}</h3><p>${esc(body)}</p></div></article>`).join('')}</section>`;
}


/** Player-facing explanation; reads current rules and never changes the session. */
function landGuide(g:SessionObservation['game']):string {
 const r=g.economy!.farm!.rules;
 const heading=(n:string,id:string,title:string,lead:string)=>`<header class="land-guide-heading"><span>${n}</span><div><h3 id="${id}">${title}</h3><p>${lead}</p></div></header>`;
 const reach=(kind:string,range:4|8)=>`<figure class="land-guide-reach"><div class="land-guide-grid" role="img" aria-label="${range===8?'设施覆盖周围八格，含斜角':'设施只覆盖上下左右四格，不含斜角'}">${Array.from({length:9},(_,i)=>{const center=i===4,active=!center&&(range===8||[1,3,5,7].includes(i));return `<span class="${center?'origin':active?'covered':''}">${center?landArt(kind):active?'覆盖':'—'}</span>`;}).join('')}</div><figcaption>${range===8?'周围八格 · 包含斜角':'正交四格 · 不含斜角'}</figcaption></figure>`;
 const facilities=[
  {id:'canal',name:'水渠',role:'把水源引进田里',range:4 as const,days:r.canalDays,cost:`${r.projectWood}木材`,effect:'与水源格或通水渠正交相邻才能开工，沿渠链高程不升。通水后在渠格开闸放水，一次把渠链相邻的田灌到各自作物所需水分，不耗公共水。',site:'从水源格旁边起步，逐段向外延伸；水不能自行送到更高的田。',choice:'适合集中照料一片田，也是改造水田的前提。未接通水源的渠不会通水。'},
  {id:'drain',name:'排水沟',role:'把多余的水排走',range:4 as const,days:r.drainDays,cost:`${r.projectWood}木材`,effect:'被动生效：有低位出口时，正交相邻田过湿／积水自然退档所需天数-1（下限1天）。',site:'沟不能高于受益田。须有正交相邻低地、通过等高排水沟接到出口，或位于地图北／西边界。施工按钮会说明缺少的条件。',choice:'适合保护容易积水的田。被动生效，无需操作；适宜或更干的田不受影响。'},
  {id:'shelter',name:'护田林',role:'让土里的水留得久一些',range:4 as const,days:r.woodlandDays,cost:'占用林地',effect:`正交相邻田的干燥失水间隔延长${r.shelterDays}天，晴和时再翻倍；多处护田林不叠加。`,site:'从探索到的林地选择营造护田林。保留林格，就放弃这格采木或清林建田的用途。',choice:'不消耗补水次数，也不直接加水。已经干旱的田仍要灌溉，连雨积水仍要排水。'},
  {id:'yard',name:'晒场',role:'给赶不及收的田托底',range:4 as const,days:r.yardDays,cost:`${r.projectWood}木材`,effect:'被动生效：正交相邻田迟收不再落粒减产；已累计的受灾不受影响。',site:'建在紧挨重点田的荒地上；只护上下左右四格，不含斜角。',choice:'需先掌握场院管理。适合给成熟窗口紧的田兜底。永久占格，建成后不能再种。'},
  {id:'cellar',name:'种子窖',role:'把种子留在田边',range:4 as const,days:r.cellarDays,cost:`${r.projectWood}木材`,effect:'被动生效：正交相邻田收获时额外留种1份；异穗麦也额外留1份异穗麦种。',site:'建在常种主粮的田旁；只护上下左右四格。留种直接进入种子库存，不当口粮。',choice:'需先掌握窖藏保种。适合长期自留种的布局。永久占格，建成后不能再种。'},
  {id:'pit',name:'堆肥坑',role:'把秸秆沤成肥料',range:0 as const,days:r.pitDays,cost:'不耗木材',effect:`在坑格投3份秸秆，${r.pitConvertDays}天后自动转成2份堆肥；转化期间不能再投料，到期按日历自动结算。`,site:'任意荒地即可，建在秸秆来源的田旁更顺手；永久占格。',choice:'需先掌握秸秆堆肥。秸秆不再只是副产品；施肥仍在田块操作里进行。'},
  {id:'shed',name:'窝棚',role:'少跑几趟田',range:8 as const,days:r.shedDays,cost:'1木材',effect:'以窝棚为中心两格以内（比图示再远一圈，含斜角）的田，播种、浇水、收获基础时间减半，下限0.5天；报价自动按减半显示。',site:'建在几块田的中间，尽量让更多田落在两格以内。',choice:'需先掌握材料识别。适合田多路远的布局。永久占格，建成后不能再种。'},
  {id:'retting',name:'沤麻塘',role:'把亚麻茎沤成纤维',range:0 as const,days:r.rettingDays,cost:`${r.projectWood}木材`,effect:'建成后农场「农具与加工」开放沤麻工序：2份亚麻茎跨季沤为1份亚麻纤维。',site:'任意荒地即可；永久占格。',choice:'需先掌握沤麻脱胶，是亚麻纤维的前置条件；工序报价会提示需建成沤麻塘。'},
 ];
 const crops=(Object.keys(CROPS) as Crop[]).map(id=>{const c=CROPS[id];const note=id==='rice'?'需改造为水田；免涝':id==='millet'?'需水低，仍怕过湿和积水':id==='adzuki'?'养地；迟收损失比其他作物快':id==='soy'?'收获后恢复肥力':id==='flax'?'纤维原料，不能作为口粮':id==='mallow'?'短周期菜蔬，不产秸秆':id==='mustard'?'可接腌渍加工，不产秸秆':'主粮，兼得秸秆';return `<tr><th scope="row">${c.name}</th><td>${sowingSeasons(id).map(n=>['春','夏','秋','冬'][n]).join('、')}</td><td>${c.duration}天</td><td>${id==='rice'?'水田恒过湿':id==='millet'?'至少偏干':'至少适宜'}</td><td>${note}</td></tr>`;}).join('');
 return `<article class="rules-page land-guide" aria-labelledby="land-guide-title">
 <div class="land-guide-top"><button type="button" class="text-btn" data-page="农业">← 返回农场</button><span>随时查阅 · 阅读不消耗游戏时间</span></div>
 <header class="land-guide-hero"><div><span class="eyebrow">田间手册 · 土地与水利</span><h2 id="land-guide-title">一块地种粮，一块地护田</h2><p>田越多，越要考虑水从哪里来、雨后往哪里去。找到水源、沿链修渠，或护林保墒，让周围的田更容易照料。</p></div><div class="land-guide-hero-art" aria-hidden="true">${landArt('loam')}${landArt('canal')}${landArt('water')}</div></header>
 <nav class="land-guide-nav" aria-label="土地指南目录"><a href="#land-first">开始经营</a><a href="#land-properties">看懂土地</a><a href="#land-buildings">选择设施</a><a href="#land-crops">安排作物</a><a href="#land-trouble">遇到问题</a></nav>
 <section>${heading('01','land-first','先看地，再开工','每格只能选择一种主要用途。设施占下的位置，就不能同时种庄稼。')}
 <ol class="land-guide-steps"><li><strong>选中一格</strong><p>点击地图或使用“定位地块”。未知格先探索，揭晓后查看土质、地势和水分。</p></li><li><strong>比较周围</strong><p>准备种田，就看能否得到供水、排水；准备建设，就看范围里有多少田、地势是否合适。</p></li><li><strong>选用途与工期</strong><p>荒地可开田或建设。预览不花资源，开工才支付成本；开工后用途固定，工程可以分段完成。</p></li><li><strong>回来看变化</strong><p>日历推进时，天气和设施影响土地。查看水分与渠的通水状态，再决定播种、浇水或收获。</p></li></ol>
 <p class="land-guide-note">普通开垦需${r.reclaimDays}天。工程分两阶段，物料在首次开工时扣除，全部完工后才生效；进度和设施跨季、跨代保留。工期会与收获、学习、饮食消耗争夺日历，以当前按钮报价为准。</p></section>
 <section>${heading('02','land-properties','看懂土地上的四项信息','土质和地势决定适合怎么经营；水分和肥力会随着天气与管理变化。')}
 <div class="land-guide-soils">${[['sand','沙质土','保水小 · 排水强',r.sandDryDays,'失水快，要更频繁地留意补水；雨后多余水分退得快。'],['loam','壤质土','保水中 · 排水中',r.loamDryDays,'保水和排水居中，适合用来熟悉不同作物的照料。'],['clay','黏质土','保水大 · 排水弱',r.clayDryDays,'水留得久，连雨后也更容易长时间过湿，要留意排水。']].map(([art,name,label,days,note])=>`<div>${landArt(String(art))}<h4>${name}</h4><strong>${label}</strong><p>${note}</p><small>持续干燥时约${days}天失水一档</small></div>`).join('')}</div>
 <p>晴和时，失水所需时间是干燥时的两倍；连雨每持续${r.rainRiseDays}天升一档。雨后若仍过湿或积水，沙、壤、黏土分别每1、2、3天自然降低一档，回到适宜后再按失水规则变化。空田也会变干或变湿。</p>
 <div class="land-guide-water" aria-label="水分由低到高的五档">${[['dry','干旱','作物缺水'],['parched','偏干','粟可满足需水'],['moist','适宜','普通作物所需'],['wet','过湿','水稻所需，普通作物有涝害'],['flood','积水','普通作物涝害更重']].map(([art,name,note])=>`<div>${landArt(art)}<strong>${name}</strong><span>${note}</span></div>`).join('')}</div>
 <div class="land-guide-pair"><div>${landArt('high')}<h4>地势：低、平、高</h4><p>水渠不能给更高的田自流供水；排水沟不能替更低的田排水。先比较设施格和田格的高低，再决定位置。</p></div><div>${landArt('fertility')}<h4>肥力：看下一茬，也看长期</h4><p>当前肥力仍为0～3。大豆、小豆收获后增加1，其余作物减少1；施堆肥可以恢复。肥力1、2、3当茬的直接收益相同，更高肥力能多支撑几茬。</p></div></div></section>
 <section>${heading('03','land-buildings','水利与加工设施：从浇水到沤麻','图中“覆盖”只说明范围；水源与地势仍要满足条件。加工设施永久占格，建成后不能再种。')}
 <ol class="land-guide-steps"><li><strong>手动浇水</strong><p>逐田灌溉，每次耗1公共水，恢复到作物所需水分。</p></li><li><strong>护田林</strong><p>正交四格失水变慢，但不直接加水。</p></li><li><strong>水源格与渠链</strong><p>开闸一次浇一片，不耗公共水，沿链高程不升。</p></li><li><strong>水田</strong><p>邻水的田改为水田，恒过湿，水稻免浇。</p></li></ol>
 <p class="land-guide-note"><strong>水从哪里来？</strong> 探索时遇到「溪涧活水」见闻，选择疏浚，此格成为永久水源；也可填平整成荒地。水从水源格沿渠链流动：新渠只能修在与水源或通水渠正交相邻的格，且高程沿链不升。</p>
 <div class="land-guide-facilities">${facilities.map(f=>`<article><header>${landArt(f.id)}<div><h4>${f.name}</h4><p>${f.role}</p><small>${f.days}天工程 · ${f.cost}</small></div></header><div class="land-guide-facility-body">${f.range?reach(f.id,f.range):''}<div><p><strong>怎样生效</strong> ${f.effect}</p><p><strong>建在哪里</strong> ${f.site}</p></div></div><p class="land-guide-choice">${f.choice}</p></article>`).join('')}</div>
 <p class="land-guide-note"><strong>再进一步：水田。</strong> 掌握水田稻作后，与水源格或通水渠相邻的田可做水田改造（${r.paddyDays}天工程，首次开工需${r.projectWood}木材）；完工后田块水分恒为过湿，水稻免浇水，非耐涝作物不能种。</p></section>
 <section>${heading('04','land-crops','按季节、水分和用途选下一茬','下面列出适播季节；实际播种还需要已发现的种子与对应栽培知识。')}
 <table class="land-guide-crops"><caption>当前可种作物的农时与照料差异</caption><thead><tr><th scope="col">作物</th><th scope="col">播种季</th><th scope="col">生长期</th><th scope="col">水分门槛</th><th scope="col">选择理由与限制</th></tr></thead><tbody>${crops}</tbody></table>
 <p>起始田的井泵和社会供水不自动覆盖所有新田；扩展田要依靠手动照料或地图设施。亲自灌溉消耗1公共水，恢复到该作物所需水分；已有受灾不会消失，也不会提前成熟。</p>
 <p>成熟后需要手动收获，收完留空，由你决定下一茬。掌握轮作后，更换作物有收成收益。播种前看预计成熟日期，避免多块田同时成熟时又开长工程；尤其留意小豆迟收损失更快。</p>
 <div class="land-guide-example"><strong>一个选址思路</strong><p>水源旁的田可为稻作留位置；从水源格向外逐段修渠，开闸一次浇一片。外围缺少供水的田可考虑需水较低的粟。若普通作物田连雨后常积水，找不高于田地且有出口的位置开沟。</p></div></section>
 <section>${heading('05','land-trouble','设施不生效，先看这些','选中设施，看通水状态；选中田地，看当前水分与作物需求。')}
 <div class="land-guide-faq">${[
 ['有渠，为什么田还缺水？','先看渠是否通水：渠要与水源格或通水渠正交相邻，且高程沿链不升。再确认田与通水的渠相邻。开闸放水按次结算，灌到作物所需水分，不会自动持续供水。'],
 ['水源从哪里来？','探索时遇到「溪涧活水」见闻，选择「疏浚溪涧」即成永久水源；初始田地附近就有一处。水源格不可开垦，是修渠引水的起点。'],
 ['排水沟为什么不能建，或建了不排水？','检查有没有低位出口、是否与有出口的等高沟连通，以及田是否低于沟。排水沟被动生效，无需操作；适宜或更干的田不受影响。'],
 ['有护田林，为什么还要浇水？','林地只减缓失水，不产生水，也不能防涝。田已低于作物所需水分时，仍要寻找水源。'],
 ['现在变得适宜了，预计收成为什么没恢复？','缺水与涝害会累计受灾。补水、排水只能减轻后续损失，不能消除已经发生的损失。'],
 ['扩张之前还要准备什么？','检查口粮、种子、工程材料和照料时间。到“同门”换种或求助，到“买卖与补给”补货；需要休息与烹饪时去“农舍”。不必把所有荒地立刻开完。'],
 ].map(([q,a])=>`<details><summary>${q}</summary><p>${a}</p></details>`).join('')}</div></section>
 <footer class="land-guide-bottom"><p>先选一块地，看看它的土质、水分和邻居，再决定下一步。</p><button type="button" class="primary-btn" data-page="农业" data-destination="field">回到田地，开始规划 →</button></footer>
 </article>`;
}
