import type {SessionObservation} from '../../src/runtime/session.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {esc} from './economy-view.js';
import {foodPolicyControls} from './social-food-view.js';
import {uiIcon} from './ui-icons.js';
import {assetUrl,farmEventArt,landArt} from './illustration.js';
import {COOKING,EDIBLE} from '../../src/game/systems/economy-catalog.js';
import {sowingSeasons,IMPROVEMENT_NAMES,WATER_NAMES} from '../../src/game/systems/agriculture.js';
import type {Crop} from '../../src/game/model/economy.js';
export type FarmGame=SessionObservation['game'];
export type FarmPanel='field'|'home'|'store'|'market'|'neighbor'|'discoveries'|'manufacture';
let selected='p2q2',panel:FarmPanel='field';
let stockSelection='food';
const projectChoices:Record<string,string>={},projectDurations:Record<string,string>={};
export function selectFarmProject(kind:string){projectChoices[selected]=kind;delete projectDurations[selected];}
export function selectFarmProjectDuration(id:string){projectDurations[selected]=id;}
function projectSketch(kind:string):string {
 if(kind==='drain')return landArt('drain','farm-route-sketch');
 // 水田暂无独立绘件，复用土地图鉴里的过湿格。
 if(kind==='paddy')return landArt('paddy','farm-route-sketch');
 return `<img class="farm-route-sketch" src="/illustrations/farm/farm-project-${kind}-v2-ui.webp" alt="" width="320" height="320">`;
}
function landProfile(p:NonNullable<NonNullable<FarmGame['economy']>['farm']>['plots'][number]):string {
 if(p.kind==='unknown'||!p.land)return '';
 const l=p.land;
 const property=(art:string,label:string,value:string,note:string)=>`<div class="farm-land-property">${landArt(art)}<div><small>${label}</small><strong>${esc(value)}</strong><span>${esc(note)}</span></div></div>`;
 const water=['dry','parched','moist','wet','flood'][l.water]??'moist';
 const fertility=p.field?.fertility??p.fertility;
 const facilityNote=p.improvement==='canal'?(p.waterConnected?'已通水 · 可开闸放水':'未通水 · 需与水源或通水渠相邻'):p.improvement==='drain'?'相邻田过湿／积水自然退档快1天':'减缓相邻田块失水';
 return `<section class="farm-land-profile" aria-label="${p.id}土地属性"><div class="farm-land-properties">${property({'沙质':'sand','壤质':'loam','黏质':'clay'}[l.soil]??'loam','土质',l.soil+'土',`保水${l.retention} · 排水${l.drainage}`)}${property({'低':'low','平':'flat','高':'high'}[l.elevation]??'flat','地势',l.elevation+'地',`${l.areaM2} 平方米`)}${property(water,'当前水分',l.waterName,`第 ${l.water+1} / 5 档`)}${fertility!==undefined?property('fertility','土地肥力',`${fertility} / 3`,'随田间管理变化'):''}</div>${p.improvement?`<div class="farm-land-facility">${landArt(p.improvement)}<div><strong>${IMPROVEMENT_NAMES[p.improvement]}</strong><span>${facilityNote}</span></div></div>`:''}</section>`;
}
export function selectFarmStock(id:string){stockSelection=id;}
export const selectedFarmPlot=()=>selected;
export function selectFarmPlot(id:string){selected=id;panel='field';}
export function selectFarmPanel(id:FarmPanel){panel=id;}
const names={unknown:'未知地块',wild:'可耕荒地',field:'自家田地',tree:'古树',rock:'岩石与地标',brush:'荆棘地',story:'乡野发现',water:'水源'};
const panels:Record<FarmPanel,string>={field:'田地与探索',home:'农舍',store:'仓库',market:'买卖与补给',neighbor:'同门',discoveries:'探索见闻',manufacture:'农具与加工'};
const goodsArt=new Set(['wheat','soy','flax','seedWheat','seedSoy','seedFlax','wood','clay','compost','straw','flour','food']);
const affairsArt=new Set(['talk','exchange','learn','basket','explore','reclaim','water','rare','story']);
const homeArt=new Set(['home','porridge','beans','mixed','rest','reserves','gather']);
// 新种子暂无独立绘件，播种与买卖按钮复用相近的种子袋绘件：谷物种用麦种袋，豆与菜种用豆种袋。
const seedArtAlias:Record<string,string>={seedRice:'seedWheat',seedFoxtail:'seedWheat',seedAdzuki:'seedSoy',seedMallow:'seedSoy',seedMustard:'seedSoy'};
// 新食谱暂无独立绘件，农舍卡片复用相近餐食绘件。
const recipeArtAlias:Record<string,string>={milletPorridge:'porridge',adzukiSoup:'beans',mallowSoup:'porridge',riceMeal:'mixed'};
export function farm(g:FarmGame,renderButton:(id:string)=>string,manufacturing=''):string {
 const button=(id:string)=>renderButton(id)
  .replace(/<details class="action-help"[\s\S]*?<\/details>/g,'')
  .replace(/<span>(?:(?:时间|精力) 0|0 天)<\/span>/g,'')
  .replace('<span class="action-cost"></span>','');
 const diet=g.life?.diet;
 const e=g.economy!,map=e.farm;if(!map)return '<p>此存档缺少地块数据，请新开游戏。</p>';
 const p=map.plots.find(p=>p.id===selected)??map.plots.find(p=>p.id===map.homeId)!;selected=p.id;
 const f=p.field,n=map.neighbor;let title=panels[panel],body='';
 let quickId='';
 if(p.kind==='unknown')quickId='economy:farmexplore:'+p.id;
 else if(p.kind==='wild')quickId='economy:farmreclaim:'+p.id;
 else if(p.kind==='field'&&f?.crop&&f.growth>=f.duration)quickId=`economy:farmplot:${p.id}-${f.crop}`;
 else if(p.discovery&&!p.discovery.resolved)quickId=g.actions.find(a=>a.id.startsWith(`economy:farmstory:${p.id}-`)&&a.enabled)?.id??'';
 if(quickId&&!g.actions.find(a=>a.id===quickId&&a.enabled))quickId='';
 const jump=(id:FarmPanel,label:string)=>`<button type="button" class="text-btn" data-farm-panel="${id}">${label} →</button>`;
 const artSource=(id:string):string|undefined=>{
  const [group,key]=id.split(':');
  if(group==='home'&&homeArt.has(key))return `farm-home-${key}.webp`;
  if(group==='affairs'&&affairsArt.has(key))return `farm-affairs-${key}.webp`;
  if(group==='goods'&&goodsArt.has(key))return `farm-goods-${key}.webp`;
  return undefined;
 };
 const goodArt=(id:string)=>id==='rare'?'affairs:rare':goodsArt.has(id)?'goods:'+id:seedArtAlias[id]?'goods:'+seedArtAlias[id]:'home:reserves';
 const emblem=(id:string)=>artSource(id)
  ?`<div class="farm-item-art farm-painted-art" aria-hidden="true"><img src="${assetUrl(artSource(id)??'farm-affairs-story.webp')}" alt="" width="300" height="300"></div>`
  :`<div class="farm-item-art">${uiIcon(id)}</div>`;
 const illustratedAction=(id:string,art:string)=>button(id).replace('<span class="action-name">',`<span class="action-name"><img class="farm-choice-art" src="${assetUrl(artSource(art)??'farm-affairs-story.webp')}" alt="" width="64" height="64">`);
 const storyArt=(id:string)=>id.endsWith('-identify')?'affairs:rare':id.endsWith('-clear')||id.endsWith('-fill')?'affairs:reclaim':id.endsWith('-repair')||id.endsWith('-dredge')?'affairs:water':id.endsWith('-share')?'goods:food':id.endsWith('-leave')?'affairs:explore':'affairs:story';
 const card=(name:string,detail:string,actions:string,icon='box')=>`<article class="farm-item-card">${emblem(icon)}<h4>${esc(name)}</h4>${detail}<div class="farm-card-actions">${actions}</div></article>`;
 const uses:Record<string,[string,string]>={
  food:['直接食用','批量干粮，按天食用；没有柴火时也可充饥。'],
  wheat:['做饭 · 口粮','可做麦粥、麦豆饭；日常做饭按天取用。播种需要另留麦种。'],
  soy:['做饭 · 口粮','可炖豆、做麦豆饭；日常做饭按天取用。播种需要另留豆种。'],
  flour:['口粮储备','日常做饭按天取用，需要柴火。'],
  wood:['烧火 · 制作','做饭时作为柴火消耗；学会相关制作后，也用于容器和农用设施。'],
  clay:['制作材料','用于排水、堆肥等设施。需先学习对应知识，再到农场的「农具与加工」查看材料要求。'],
  compost:['田间施肥','给田地补充肥力；在田地操作卡片中选择施肥。'],
  straw:['堆肥原料','学会堆肥并备好设施后可腐熟为肥料，不能当作口粮。'],
  flax:['纤维原料','学会相关加工后可制成纤维，供后续搓绳等制作使用；不能食用。'],
  seedWheat:['播种专用','在空田播种小麦。种子与收成分别存放，不计入口粮。'],
  seedSoy:['播种专用','在空田播种大豆，还需掌握对应种植知识；种子不能当口粮。'],
  seedFlax:['播种专用','在空田播种亚麻，还需掌握对应种植知识；收获的是制作原料。'],
  seedRice:['播种专用','在空田播种水稻，需掌握水田稻作且田块已改造为水田；种子不能当口粮。'],
  seedFoxtail:['播种专用','在空田播种粟，需掌握旱地谷物；种子不能当口粮。'],
  seedAdzuki:['播种专用','在空田播种小豆，需掌握杂粮接茬；种子不能当口粮。'],
  seedMallow:['播种专用','在空田播种葵菜，需掌握园圃菜蔬；种子不能当口粮。'],
  seedMustard:['播种专用','在空田播种芥菜，需掌握园圃菜蔬；种子不能当口粮。'],
  rice:['做饭 · 口粮','可煮食，也可碾成稻米；日常做饭按天取用。'],
  milledRice:['做饭 · 口粮','稻谷碾制所得，可做米饭；日常做饭按天取用，需要柴火。'],
  millet:['做饭 · 口粮','可煮小米粥；日常做饭按天取用。'],
  adzuki:['做饭 · 口粮','可煮小豆羹；日常做饭按天取用。'],
  mallow:['做饭 · 口粮','可煮葵菜羹；日常做饭按天取用。'],
  mustard:['做饭 · 腌渍','可煮食，也可加食盐腌渍为腌菜；日常做饭按天取用。'],
  salt:['腌渍原料','集市常驻供应；与芥菜一起腌渍为腌菜，不能当作口粮。'],
  pickles:['直接食用','腌渍所得的腌菜，可直接食用；日常饮食按批取用。'],
  rare:['探索所得 · 独立留种','在空田播种异穗麦，收获后返还专属种子；集市不出售。'],
 };
 const usage=(id:string)=>{const u=uses[id];return u&&panel==='market'?`<details class="farm-good-use farm-use-details"><summary>${u[0]} · 用途</summary><p>${u[1]}</p></details>`:u?`<div class="farm-good-use"><span>${u[0]}</span><p>${u[1]}</p></div>`:'<div class="farm-good-use"><span>制作物资</span><p>在农场「农具与加工」或对应阶段的主场景查看配方用途与条件。</p></div>';};
 const cropTraits=(c:Crop):string[]=>{
  const spec=CROPS[c],tags:string[]=[];
  if((spec.waterNeed??2)>2)tags.push('需水高');
  if(spec.waterNeed===1)tags.push('耐旱');
  if(spec.floodTolerant)tags.push('免涝');
  if(c==='rice')tags.push('需水田');
  if((spec.lateRate??1)>1)tags.push('迟收落粒加倍');
  if(spec.legume)tags.push('豆科养地');
  return tags;
 };
 const cropMeta=(c:Crop)=>{const spec=CROPS[c],traits=cropTraits(c);return `<small class="farm-crop-meta">生长期 ${spec.duration} 天 · ${sowingSeasons(c).map(n=>['春','夏','秋','冬'][n]).join('、')}播${traits.length?' · '+traits.join(' · '):''}</small>`;};

 const fieldTags:string[]=[g.life?.calendar.date??'',g.life?.calendar.currentTerm??'',...(g.life?.calendar.festivals.map(f=>f.name)??[])];
 const techniques=map.techniques;
 if(panel==='field'&&techniques){
  if(p.kind==='unknown'&&techniques.scouting)fieldTags.push('探路辨种 · 已节省探索时间');
  if(p.kind==='field'&&f){
   if(!f.crop&&techniques.rotation&&f.lastCrop)fieldTags.push(`上茬${CROPS[f.lastCrop].name} · 换种收成+1`);
   if(f.crop&&techniques.seedSelection)fieldTags.push(f.variety==='heritage'?'异穗留种 1份':'收获留种 2份');
   if(!f.crop&&techniques.nursery)fieldTags.push('育苗设施 · 下茬成熟缩短1周');
   if(techniques.drainage)fieldTags.push('排涝设施 · 每田防涝耗1耐用');
   if(techniques.harvestTools)fieldTags.push('收割工具 · 迟收宽限1周');
  }
 }
 if(panel==='field'){
  title=p.discovery?.title??names[p.kind];
  let actions='',hint='',careInfo='',seedInfo='';
  const explore=map.plots.find(t=>t.kind==='unknown'&&g.actions.some(a=>a.id==='economy:farmexplore:'+t.id&&a.enabled));
  if(p.kind==='unknown'){hint='走近以后，才能知道这里有什么。';fieldTags.push('尚未探索','抵达后揭晓');actions=illustratedAction('economy:farmexplore:'+p.id,'affairs:explore')||'<p>先探索相邻的未知地块。</p>';}
  if(p.kind==='wild'&&!p.project){hint='开垦后可以播种，独立照料这一方田。';fieldTags.push('可开垦',`初始肥力 ${p.fertility??2}`);actions=illustratedAction('economy:farmreclaim:'+p.id,'affairs:reclaim');}
  if((p.kind==='tree'||p.kind==='rock'||p.kind==='water')&&!p.improvement){hint=p.kind==='water'?'活水长流，是修渠引水的源头。':'保留这处地貌，沿周边继续探索。';fieldTags.push('不可开垦',p.kind==='water'?'永久水源':'地貌保留');actions=explore?`<div class="action-option"><button type="button" class="game-action" data-farm-jump="${explore.id}"><span class="action-name"><img class="farm-choice-art" src="${assetUrl(artSource('affairs:explore')??'farm-affairs-story.webp')}" alt="" width="64" height="64">寻找未知地块</span><span class="action-cost"><span>前往可探索地块 →</span></span></button></div>`:'';}
  if(p.discovery){
   fieldTags.push(p.discovery.resolved?'见闻已收录':'见闻待处理');
   if(!p.discovery.resolved)actions+=g.actions.filter(a=>a.id.startsWith(`economy:farmstory:${p.id}-`)).map(a=>illustratedAction(a.id,storyArt(a.id))).join('');
  }
  const projects=g.actions.filter(a=>a.id.startsWith(`economy:farmproject:${p.id}-`));
  if(p.land){fieldTags.push(`${p.land.soil}土 · ${p.land.elevation}地`,`保水${p.land.retention} · 排水${p.land.drainage}`);if(!p.improvement)fieldTags.push(`水分：${p.land.waterName}`);}
  if(p.improvement){
   title=IMPROVEMENT_NAMES[p.improvement];
   hint=p.improvement==='canal'?(p.waterConnected?'渠水畅通，可开闸放水，灌溉渠链正交相邻的田。':'渠已建成但未通水；需与水源格或通水渠正交相邻，且高程沿链不升。'):p.improvement==='drain'?'有低位出口时，正交相邻田过湿／积水自然退档快1天。':'正交四格失水变慢，不直接增加水分。';
   if(p.improvement==='canal')fieldTags.push(p.waterConnected?'已通水':'未通水');
   careInfo=`<div class="farm-water-guide"><strong>${hint}</strong><p>${p.improvement==='canal'?'开闸放水沿渠链灌溉相邻田块，灌到各自作物所需水分，不耗公共水。':p.improvement==='drain'?'被动生效，无需操作；不排干适宜或更干的田。':'被动生效，无需操作；已干旱的田仍需寻找水源。'}</p></div>`;
   if(p.improvement==='canal'&&p.waterConnected)actions+=illustratedAction('economy:floodgate:'+p.id,'affairs:water');
  }
  if(p.kind==='field'&&f){
   title=f.variety==='heritage'?'异穗麦田':f.crop?CROPS[f.crop].name+'田':p.land?.paddy?'水田待播':'空田待播';
   hint=f.crop?(f.growth>=f.duration?'庄稼成熟，可以收获了。':p.land?.paddy?'水田保持蓄水，水稻免浇水。':'庄稼正在生长，可以补水照料。'):p.land?.paddy?'水田恒过湿，只能种水稻等耐涝作物。':'选一袋种子，开始新一茬。';
   fieldTags.push(f.crop?(f.growth>=f.duration?'成熟待收':`距收获 ${p.maturity?.days??0} 天`):'等待播种',`肥力 ${f.fertility}/3`,`水分 ${p.land?.waterName??"适宜"}`,p.id===map.homeId?'起始田 · 自动供水':'扩展田 · 手动照料');
   if(p.land?.paddy)fieldTags.push('水田 · 恒过湿');
   if(p.maturity)fieldTags.push('预计 '+p.maturity.date+' 收获');
   if(f.crop)fieldTags.push(`预计收成 ${p.harvest}`,`累计受灾 ${Number(f.stress.toFixed(2))}`);
   if(f.crop&&f.growth<f.duration){
    const req=CROPS[f.crop].waterNeed??2,water=p.land?.water??2,need=water<req;
    const offer=g.actions.find(a=>a.id===`economy:farmplot:${p.id}-${f.crop}`);
    careInfo=p.land?.paddy
     ?`<div class="farm-water-guide"><div class="farm-water-heading"><strong>水田 · 每日保持蓄水</strong><span>${CROPS[f.crop].name}无需手动浇水</span></div><p>水田完工后水分恒为过湿，不随天气失水；已有受灾不会消除。</p>${offer&&!offer.enabled?`<p class="farm-water-blocked">${esc(offer.reason??'暂不可用')}</p>`:''}</div>`
     :`<div class="farm-water-guide"><div class="farm-water-heading"><strong>水分${p.land?.waterName} · ${need?'需要补水':water>2&&!CROPS[f.crop].floodTolerant?'有涝害风险':'满足作物需要'}</strong><span>${CROPS[f.crop].name}至少需要${WATER_NAMES[req]}</span></div><p>标准灌溉消耗1公共水，恢复到该作物所需水分；已有受灾不会消除。通水的渠可开闸放水，一次灌溉渠链相邻的田。</p><small>此田持续干燥${p.land?.dryingDays}天失水一档，晴和时需两倍天数；连续${map.rules.rainRiseDays}天连雨升一档。雨后按土质排除多余水分，排水沟可加快退湿。</small>${offer&&!offer.enabled?`<p class="farm-water-blocked">${esc(offer.reason??'暂不可用')}</p>`:''}</div>`;
   }

   actions=(f.crop?[f.crop]:map.discovered).map(c=>{const btn=illustratedAction(`economy:farmplot:${p.id}-${c}`,f.crop?(f.growth>=f.duration?goodArt(c):'affairs:water'):goodArt(CROPS[c].seed));return f.crop?btn:btn.replace('</button>','</button>'+cropMeta(c));}).join('')+(!f.crop?illustratedAction('economy:farmrare:'+p.id,'affairs:rare'):'');
   actions+=illustratedAction('economy:farmfertilize:'+p.id,'goods:compost')+illustratedAction('economy:neighbor:help-'+p.id,'affairs:talk');
   if(f.crop&&f.growth<f.duration)actions+=illustratedAction('economy:wait:'+p.id,'home:rest');
   seedInfo=`<div class="farm-plot-seeds" aria-label="当前种子储备">${map.discovered.map(c=>`<span>${CROPS[c].name}种 <b>${e.goods[CROPS[c].seed]??0}</b></span>`).join('')}${map.rareSeeds?`<span>异穗麦种 <b>${map.rareSeeds}</b></span>`:''}</div>`;
   actions+=`<div class="action-option"><button type="button" class="game-action farm-plot-link" data-farm-panel="market"><span class="action-name"><img class="farm-choice-art" src="${assetUrl(artSource('affairs:basket')??'farm-affairs-story.webp')}" alt="" width="64" height="64">购买种子</span><span class="action-cost"><span>前往买卖与补给 →</span></span></button></div>`;
  }
  body=`<section class="farm-map-dock" aria-label="当前地块操作" data-primary-action="${quickId}"><div class="farm-dock-main"><div class="farm-dock-heading"><span>${p.id} · ${p.improvement?IMPROVEMENT_NAMES[p.improvement]:names[p.kind]}</span><h3>${esc(title)}</h3><p>${hint}</p>${seedInfo}</div><div class="farm-dock-actions" aria-label="地块行动">${actions}</div></div>${careInfo}</section>`;
  if(p.discovery){
   const d=p.discovery;
   const art=d.id==='traveler'?'explore':d.id==='seedbag'||d.id==='heritage'?'sow':d.id==='spring'?'tend':d.id==='brambles'?'reclaim':'discovery';
   body=`<section class="farm-map-dock farm-story-dock" aria-label="${esc(d.title)}"><div class="farm-story-layout"><div class="farm-story-picture">${farmEventArt(art)}<span>田野见闻</span></div><div class="farm-story-content"><div class="farm-story-meta"><span>${p.id} · ${p.improvement?IMPROVEMENT_NAMES[p.improvement]:names[p.kind]}</span><span class="farm-story-state">${d.resolved?'已收录':'待抉择'}</span></div><h3>${esc(d.title)}</h3><p class="farm-story-prose">${esc(d.text)}</p>${d.resolved?`<p class="farm-story-outcome"><span>后记</span>${esc(d.outcome||'已记录地貌。')}</p>`:''}${actions?`<div class="farm-story-choices">${actions}</div>`:''}<small class="farm-story-source">灵感 · ${esc(d.inspiration)}</small></div></div>${careInfo}</section>`;
  }
  if(projects.length){
   const routeInfo:Record<string,{name:string;result:string;note:string;days:number}>={
    canal:{name:'修建水渠',result:'引水入田，可开闸放水',note:'引水链：与水源或通水渠相邻才能开工；完工后可开闸放水',days:map.rules.canalDays},
    paddy:{name:'改造水田',result:'改为水田，恒过湿，可种水稻',note:'需与水源格或通水渠相邻；完工后每日保持蓄水',days:map.rules.paddyDays},
    drain:{name:'开挖排水沟',result:'相邻田加快退湿',note:'被动生效：有低位出口时，正交相邻田过湿／积水自然退档快1天',days:map.rules.drainDays},
    restore:{name:'整治良田',result:'建成肥力 3 的田',note:'可直接播种',days:map.rules.restoreDays},
    timber:{name:'采木留地',result:`获得 ${map.rules.timberYield} 木材`,note:'留下荒地，种植还需开垦',days:map.rules.woodlandDays},
    clearwood:{name:'清林建田',result:'建成肥力 2 的田',note:'可直接播种，不额外得木材',days:map.rules.woodlandDays},
    shelter:{name:'保留护田林',result:'正交四格减缓失水',note:'保留林格，不能种植',days:map.rules.woodlandDays},
    leave:{name:'按普通荒地处理',result:p.discovery?.id==='fallow'?'开垦后肥力 0':'不保留此见闻的收益',note:`整理后另花 ${map.rules.reclaimDays} 天开垦`,days:map.rules.reclaimDays},
   };
   const leave=g.actions.find(a=>a.id===`economy:farmstory:${p.id}-leave`);
   const kinds=[...new Set(projects.map(a=>a.id.split('-')[1])),...(!p.project&&leave?['leave']:[])];
   const kind=p.project?.kind??(kinds.includes(projectChoices[p.id])?projectChoices[p.id]:kinds[0]);
   const info=routeInfo[kind],offers=kind==='leave'?[leave!]:projects.filter(a=>a.id.split('-')[1]===kind);
   const chosen=offers.find(a=>a.id===projectDurations[p.id])??offers.find(a=>a.time===7&&a.enabled)??offers.find(a=>a.enabled)??offers[0];
   const nearby=['canal','shelter','drain'].includes(kind);
   const cells=Array.from({length:9},(_,i)=>{
    const dx=i%3-1,dy=Math.floor(i/3)-1,center=dx===0&&dy===0,affected=!center&&Math.abs(dx)+Math.abs(dy)===1;
    const plot=map.plots.find(t=>t.x===p.x+dx&&t.y===p.y+dy);
    return `<span class="${center?'origin':nearby&&affected?'benefit':''}" title="${esc(plot?.id??'未探索')}">${center?projectSketch(kind):nearby&&affected?(kind==='drain'?'排水':kind==='shelter'?'保水':'通水'):'·'}</span>`;
   }).join('');
   const preview=/本次至(.+?)，按当前饮食约需(.+?)批食材/.exec(chosen.description??'');
   const total=p.project?.total??info.days,done=p.project?.done??0;
   const routeCards=p.project?'':`<div class="farm-purpose-list" aria-label="选择地块用途">${kinds.map(k=>`<button type="button" class="farm-purpose ${kind===k?'selected':''}" data-farm-project="${k}" aria-pressed="${kind===k}">${projectSketch(k)}<span class="farm-purpose-name">${routeInfo[k].name}</span><strong>${routeInfo[k].result}</strong><small>${k==='leave'?'分步整理与开垦':`${routeInfo[k].days} 天 · 两阶段`}</small></button>`).join('')}</div>`;
   body=`<section class="farm-map-dock farm-project-desk" aria-label="地块建设"><header><div><span>${p.id} · ${p.project?'建设中':'规划地块'}</span><h3>${p.project?info.name:esc(p.discovery?.title??'田地建设')}</h3></div><p>${p.project?'工程可以分次完成，离开后保留进度。':'先选这块地的用途，再决定这次做多久。'}</p></header>${routeCards}${p.kind==='wild'&&!p.project?`<div class="farm-story-choices">${illustratedAction('economy:farmreclaim:'+p.id,'affairs:reclaim')}</div>`:''}<div class="farm-project-plan"><div class="farm-project-explain"><div class="farm-benefit-grid" role="img" aria-label="${nearby?'覆盖正交四格':'只改造本格'}">${cells}</div><div><h4>${info.result}</h4><p>${info.note}</p><small>${nearby?'覆盖指正交相邻格；水渠需接通水源才能放水。':'收益只在本格完工后生效。'}${['canal','paddy','drain'].includes(kind)?` 首次开工需 ${map.rules.projectWood} 木材。`:''}</small>${nearby?'<small>不加快成熟，不消除已有受灾。</small>':''}</div></div><div class="farm-project-schedule">${kind!=='leave'?`<div class="farm-build-stages"><span class="${done<total/2?'current':'done'}">① 整备 · ${total/2}天</span><span>→</span><span class="${done>=total/2?'current':''}">② 施工 · ${total/2}天</span><b>${done}/${total} 天</b></div><progress max="${total}" value="${done}" aria-label="工程总进度"></progress>`:''}<div class="farm-duration-picker" aria-label="本次投入时间">${offers.map((a,i)=>`<button type="button" data-farm-duration="${a.id}" aria-pressed="${a.id===chosen.id}">${kind==='leave'?'先整理荒地':i===offers.length-1&&a.time&&a.time>7?`推进本阶段 · ${a.time}天`:a.time?`${a.time}天`:'暂不可施工'}</button>`).join('')}</div><div class="farm-build-preview">${preview?`<span>做到 <b>${esc(preview[1].replace(/^第\d+年 · /,''))}</b></span><span>食材约 <b>${preview[2]} 批</b></span>`:`<span>本次 ${chosen.time??0} 天，之后另行开垦</span>`}<span>精力 <b>${chosen.energy??0}</b></span></div><div class="farm-build-submit">${illustratedAction(chosen.id,kind==='canal'?'affairs:water':'affairs:reclaim').replace(esc(chosen.label),kind==='leave'?'整理为荒地':p.project?'继续施工':'按此方案开工')}</div><small class="farm-build-note">${p.project?'可随时离开，进度跨季保留。':'选择方案不耗资源；开工后用途固定。'} ${kind==='leave'?'放弃本地块的整治收益。':'投入时长已考虑收获期限、余粮与阶段期限。'}</small></div></div></section>`;
  }

 }
 if(panel==='field')body=landProfile(p)+body;
 if(panel==='manufacture')body=manufacturing;
 if(panel==='home'){
  const cooking=g.actions.filter(a=>a.id.startsWith('economy:cook:'));
  body=`<div class="farm-room-hero">${emblem('home:home')}<div><span class="eyebrow">${esc(g.person.name)}的农舍</span><h3>生火做饭，归来歇息</h3><p>可用精力 ${g.life?.budget.freeEnergy??0} · 饮食可支持 ${diet?.days??0} 天 · ${diet?.name??'简单饮食'}</p></div></div><section class="farm-diet-plan"><h4>日常饮食 · 现做现吃</h4><p>${diet?.description??''}</p><div class="farm-status-tags"><span>每天食材 ${diet?.dailyGrain??0} 批</span><span>做饭每天柴火 ${diet?.dailyWood??0} 批</span><span>饱食每天恢复 ${diet?.recovery??0} 精力</span></div><div class="farm-dock-options">${button('economy:diet:simple')}${button('economy:diet:hearty')}</div><p class="subtle">粮食与木柴都是批量库存；不足以做饭时用干粮，不会食用种子。</p></section><h4>用心做一餐 · 短期调养</h4><div class="farm-card-grid">${cooking.map(a=>{const recipe=COOKING.find(r=>a.id==='economy:cook:'+r.id)!;return card(recipe.name,`<p>${Object.entries(recipe.inputs).map(([id,q])=>`${esc(e.goodsCatalog[id]?.name??id)} ${e.goods[id]??0}/${q}`).join(' · ')}</p><p class="farm-result">餐食调养 ${recipe.food} 天 · 每天额外恢复精力</p>`,button(a.id),'home:'+(recipeArtAlias[recipe.id]??recipe.id));}).join('')}</div><p class="subtle">当次做、当次吃，不把熟饭存数月。恢复效果剩余 ${diet?.mealDays??0} 天；效果未结束不能叠加。</p><h4>身体与日常</h4><div class="farm-card-grid">${card('休息与疗养','<p>恢复精力，照料身体。</p>',button('economy:rest:self')+button('economy:care:self'),'home:rest')}${card('生活储备',`<p>饮食可支持 ${diet?.days??0} 天 · 木柴可做饭 ${diet?.woodDays??0} 天</p>`,jump('store','查看仓库')+jump('market','买粮补给'),'home:reserves')}${card('采集与临时帮工','<p>采集木柴与食物，或帮工换取钱财。</p>',g.actions.filter(a=>a.group==='生活'&&['gather','work'].includes(a.id.split(':')[1])).map(a=>button(a.id)).join(''),'home:gather')}</div>${g.socialFood?`<details class="farm-policy"><summary>吃饭与储粮安排 · 预计补粮 ${g.socialFood.purchase} 份</summary>${foodPolicyControls(g,button)}</details>`:''}`;
 }
 if(panel==='store'){
  const cookable=[...new Set(COOKING.flatMap(r=>Object.keys(r.inputs).filter(i=>i!=='wood')))],harvestGoods=[...EDIBLE,'flax','straw'];
  const stock=(id:string,name:string,q:number)=>card(name,`<strong class="farm-stock-quantity">${Number(q.toFixed(3))}<small> 份</small></strong>${usage(id)}`,id.startsWith('seed')||id==='rare'?jump('field','去播种'):cookable.includes(id)?jump('home','去做饭'):'',goodArt(id));
  const goods=Object.entries(e.goods).filter(([,q])=>q>0);
  body=`<div class="farm-room-hero">${emblem('home:reserves')}<div><h3>收好这一季的收成</h3><p>可食储备 ${Number(e.foodTotal.toFixed(3))} · 食品保护容量 ${e.storage} · 超出保护的食物随存放时间逐渐损耗，换季不集中扣除</p></div><div>${jump('market','出售或补给')}</div></div><h4>口粮与收成</h4><div class="farm-card-grid">${stock('food','即食口粮',g.family.food)}${goods.filter(([id])=>harvestGoods.includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}</div><h4>留种与材料</h4><div class="farm-card-grid">${goods.filter(([id])=>!harvestGoods.includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}${map.rareSeeds?stock('rare','异穗麦种',map.rareSeeds):''}</div>`;
  const stockItems=[['food','即食口粮',g.family.food],...goods.map(([id,q])=>[id,e.goodsCatalog[id]?.name??id,q]),...(map.rareSeeds?[['rare','异穗麦种',map.rareSeeds]]:[])] as [string,string,number][];
  const chosen=stockItems.find(([id])=>id===stockSelection)??stockItems[0];
  const seed=chosen[0].startsWith('seed')||chosen[0]==='rare',edible=['food',...EDIBLE].includes(chosen[0]);
  for(const [id,name] of stockItems)body=body.replace(`<h4>${esc(name)}</h4>`,`<h4><button class="text-btn" data-farm-stock="${esc(id)}" aria-pressed="${chosen[0]===id}">${esc(name)}</button></h4>`);
  body=`<div class="farm-room-split"><section>${body}</section><aside class="farm-ledger">${emblem(goodArt(chosen[0]))}<h3>${esc(chosen[1])}</h3><p class="farm-result">持有 ${Number(chosen[2].toFixed(3))} 份</p>${usage(chosen[0])}<p>${seed?'种子单独留存，播种时消耗，不会当作口粮。':edible?'可用于家庭口粮；也能带到农舍灶台主动烹饪，当次享用并提供短期调养效果。':'保留用于制作、农事或交付；不计入可食储备。'}</p>${chosen[0]==='rare'?'<p>探索所得，市场不出售；收获后返还专属种子。</p>':''}${jump(seed?'field':edible?'home':'market',seed?'去播种':edible?'去农舍':'去买卖')}</aside></div>`;
 }
 if(panel==='market'){
  const direct=g.era?.index===0;
  const v=e.marketView,allowed=['wood','clay','compost','straw','salt',...map.discovered.map(c=>CROPS[c].seed)];
  const items=(v?.catalog??[]).filter(i=>i.id==='good-food'||i.kind==='goods'&&allowed.includes(i.target));
  body=`<div class="farm-room-split${direct?' farm-market-direct':''}"><section><h4>农家所需</h4>${direct?'<p class="farm-purchase-note">点击商品即可买入1份并付款；出售也直接成交，无需采购清单。购买不耗时间与精力。</p>':''}<p class="subtle">${g.life?.calendar?`下次补货：${esc(g.life.calendar.businessCycle.nextDate)} · ${g.life.calendar.businessCycle.remaining} 天后。市场暂按独立90天经营周期补货，换季不刷新。`:""}</p><div class="farm-card-grid">${items.map(i=>card(i.name,`<p class="farm-result">${i.price} 钱 / 份</p><p>${i.local?'现货':'下次补货日交付'} · 库存 ${i.stock}</p>${usage(i.id==='good-food'?'food':i.target)}`,button('economy:'+(direct?'checkout:':'cartadd:')+i.id),goodArt(i.id==='good-food'?'food':i.target))).join('')||button('economy:buyfood:bulk')}</div><h4>出售收成</h4><div class="farm-card-grid">${[...EDIBLE,'flax','straw'].filter(id=>(e.goods[id]??0)>0).map(id=>card(e.goodsCatalog[id]?.name??id,`<p>持有 ${e.goods[id]} 份</p>`,button('economy:sell:'+id),goodArt(id))).join('')||'<p class="subtle">暂无可出售的收成。</p>'}</div></section>${direct?'':`<aside class="farm-ledger">${emblem('affairs:basket')}<h3>这趟采购</h3><p class="farm-purchase-note">购买不耗时间与精力</p>${v?`${v.quote.lines.map(l=>`<div class="farm-ledger-line"><strong>${esc(l.item.name)} × ${l.quantity}</strong>${button('economy:cartremove:'+l.item.id)}</div>`).join('')||'<p class="subtle">选好物资，再一起结账。</p>'}<p class="farm-result">合计 ${v.quote.total} 钱</p>${button('economy:checkout:cart')}${button('economy:clearcart:all')}`:''}</aside>`}</div>`;
 }
 if(panel==='neighbor')body=`<div class="farm-room-hero">${emblem('affairs:talk')}<div><span class="eyebrow">同门相助</span><h3>${esc(n.name)} · ${n.title}</h3><p>${n.alive?(n.busy?'正在忙农活':'可前往拜访'):'已故'} · 交情 ${n.trust}/5</p></div></div><div class="farm-card-grid">${card('田边叙话','<p>同门各自修行经营，闲时聊聊近况。</p>',button('economy:neighbor:talk'),'affairs:talk')}${card('互换种子',`<p>可交换豆种 ${n.offers.seedSoy} 份 · 麻种 ${n.offers.seedFlax} 份 · 葵菜种 ${n.offers.seedMallow} 份${n.offers.seedRice!==undefined?` · 稻种 ${n.offers.seedRice} 份`:' · 建成渠后可换稻种'}</p>`,button('economy:neighbor:trade-soy')+button('economy:neighbor:trade-flax')+button('economy:neighbor:trade-mallow')+button('economy:neighbor:trade-rice'),'affairs:exchange')}${card('请教与互助','<p>请教种植知识；灌溉求助需先选择具体田块。</p>',button('economy:neighbor:learn')+jump('field','去田地求助'),'affairs:learn')}</div><p class="subtle">${n.title}的田地、物资与劳动独立结算，不能切换控制；自己的弟子接续自己的传承。</p>`;
 if(panel==='discoveries')body=map.plots.filter(p=>p.discovery).map(p=>`<article class="farm-discovery">${emblem('affairs:story')}<button class="text-btn" data-farm-jump="${p.id}">${p.id} · ${esc(p.discovery!.title)} →</button><p>${esc(p.discovery!.resolved?p.discovery!.outcome||'已记录，保留地貌。':'尚待处理，可以稍后再来。')}</p></article>`).join('')||'<p>沿地图边缘探索，见闻与处理结果会保存在对应地块。</p>';
 return `<section class="pixi-farm"><header class="pixi-farm-heading"><div><span class="eyebrow">${esc(g.life?.calendar.date??'田野')} · ${esc(g.world.weatherName)}</span><h2>${panel==='field'?'耕一方田，探一方天地':panels[panel]}</h2></div><span>田 ${map.plots.filter(p=>p.kind==='field').length} 块 · 已知 ${map.plots.filter(p=>p.kind!=='unknown').length} 格</span></header><nav class="farm-local-nav" aria-label="农场事务">${Object.entries(panels).map(([id,n])=>`<button type="button" data-farm-panel="${id}" aria-pressed="${panel===id}">${n}</button>`).join('')}</nav>${panel==='field'?`<div class="pixi-farm-layout farm-layout-floating"><div class="pixi-farm-viewport"><div id="farm-map"></div><div class="farm-ink-title" aria-hidden="true"><span>一方田野 · ${esc(g.world.weatherName)}</span><strong>田畴</strong></div><div class="farm-map-picker"><label for="farm-plot-select">定位地块</label><select id="farm-plot-select">${map.plots.map(t=>`<option value="${t.id}" ${t.id===p.id?'selected':''}>${t.id} · ${t.improvement?IMPROVEMENT_NAMES[t.improvement]:names[t.kind]}</option>`).join('')}</select></div><div class="pixi-map-tools"><span>有边框即可选 · ? 可探索 · 拖动查看远处</span><div><button data-farm-zoom="-1" aria-label="缩小地图">−</button><button data-farm-zoom="1" aria-label="放大地图">＋</button><button data-farm-center>回到选中地块</button></div></div></div>${body}</div>`:`<div class="farm-room farm-room-${panel}"><div class="farm-room-feedback" role="status" aria-live="polite"></div>${body}</div>`}<footer class="farm-live-footer"><div class="farm-status-tags" role="status" aria-live="polite">${(panel==='field'?fieldTags:[`口粮 ${Number(g.family.food.toFixed(3))} 份`,`可用精力 ${g.life?.budget.freeEnergy??0}`]).map(t=>`<span>${esc(t)}</span>`).join('')}</div>${panel==='field'?'<details class="farm-recent-feedback"><summary>最新动态</summary><div class="farm-effect-layer" role="status" aria-live="polite"></div></details>':''}<div class="pixi-season-end">${button('economy:wait:half')}${button('economy:wait:week')}${g.life?.calendar?'':button('economy:end:season')}</div></footer></section>`;
}
