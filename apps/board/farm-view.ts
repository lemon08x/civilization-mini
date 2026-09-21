import type {SessionObservation} from '../../src/runtime/session.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {esc} from './economy-view.js';
import {foodPolicyControls} from './social-food-view.js';
import {uiIcon} from './ui-icons.js';
import {COOKING} from '../../src/game/systems/economy-catalog.js';
export type FarmGame=SessionObservation['game'];
export type FarmPanel='field'|'home'|'store'|'market'|'neighbor'|'discoveries';
let selected='p2q2',panel:FarmPanel='field';
let stockSelection='food';
export function selectFarmStock(id:string){stockSelection=id;}
export const selectedFarmPlot=()=>selected;
export function selectFarmPlot(id:string){selected=id;panel='field';}
export function selectFarmPanel(id:FarmPanel){panel=id;}
const names={unknown:'未知地块',wild:'可耕荒地',field:'自家田地',tree:'古树',rock:'岩石与地标',brush:'荆棘地',story:'乡野发现'};
const panels:Record<FarmPanel,string>={field:'田地与探索',home:'农舍',store:'仓库',market:'买卖与补给',neighbor:'同门',discoveries:'探索见闻'};
const goodsArt=new Set(['wheat','soy','flax','seedWheat','seedSoy','seedFlax','wood','clay','compost','straw','flour','food']);
const affairsArt=new Set(['talk','exchange','learn','basket','explore','reclaim','water','rare','story']);
const homeArt=new Set(['home','porridge','beans','mixed','rest','reserves','gather']);
export function farm(g:FarmGame,renderButton:(id:string)=>string):string {
 const button=(id:string)=>renderButton(id)
  .replace(/<details class="action-help"[\s\S]*?<\/details>/g,'')
  .replace(/<span>(?:时间|精力) 0<\/span>/g,'')
  .replace('<span class="action-cost"></span>','');
 const e=g.economy!,map=e.farm;if(!map)return '<p>此存档缺少地块数据，请新开游戏。</p>';
 const p=map.plots.find(p=>p.id===selected)??map.plots.find(p=>p.id===map.homeId)!;selected=p.id;
 const f=p.field,n=map.neighbor;let title=panels[panel],body='';
 const jump=(id:FarmPanel,label:string)=>`<button type="button" class="text-btn" data-farm-panel="${id}">${label} →</button>`;
 const artSource=(id:string):string|undefined=>{
  const [group,key]=id.split(':');
  if(group==='home'&&homeArt.has(key))return `farm-home-${key}.webp`;
  if(group==='affairs'&&affairsArt.has(key))return `farm-affairs-${key}.webp`;
  if(group==='goods'&&goodsArt.has(key))return `farm-goods-${key}.webp`;
  return undefined;
 };
 const goodArt=(id:string)=>id==='rare'?'affairs:rare':goodsArt.has(id)?'goods:'+id:'home:reserves';
 const emblem=(id:string)=>artSource(id)
  ?`<div class="farm-item-art farm-painted-art" aria-hidden="true"><img src="/illustrations/${artSource(id)}" alt="" width="300" height="300"></div>`
  :`<div class="farm-item-art">${uiIcon(id)}</div>`;
 const illustratedAction=(id:string,art:string)=>button(id).replace('<span class="action-name">',`<span class="action-name"><img class="farm-choice-art" src="/illustrations/${artSource(art)}" alt="" width="64" height="64">`);
 const storyArt=(id:string)=>id.endsWith('-identify')?'affairs:rare':id.endsWith('-clear')?'affairs:reclaim':id.endsWith('-repair')?'affairs:water':id.endsWith('-share')?'goods:food':id.endsWith('-leave')?'affairs:explore':'affairs:story';
 const card=(name:string,detail:string,actions:string,icon='box')=>`<article class="farm-item-card">${emblem(icon)}<h4>${esc(name)}</h4>${detail}<div class="farm-card-actions">${actions}</div></article>`;
 const uses:Record<string,[string,string]>={
  food:['直接食用','季末用于一家人的口粮，不需要再烹饪。'],
  wheat:['做饭 · 口粮','可做麦粥、麦豆饭；也可在季末补足口粮。播种需要另留麦种。'],
  soy:['做饭 · 口粮','可炖豆、做麦豆饭；也可在季末补足口粮。播种需要另留豆种。'],
  flour:['口粮储备','季末可直接用于家庭口粮。'],
  wood:['烧火 · 制作','做饭时作为柴火消耗；学会相关制作后，也用于容器和农用设施。'],
  clay:['制作材料','用于排水、堆肥等设施。需先学习对应知识，再到「学习与制造」查看材料要求。'],
  compost:['田间施肥','给田地补充肥力；在田地的「田间养护与同门求助」中使用。'],
  straw:['堆肥原料','学会堆肥并备好设施后可腐熟为肥料，不能当作口粮。'],
  flax:['纤维原料','学会相关加工后可制成纤维，供后续搓绳等制作使用；不能食用。'],
  seedWheat:['播种专用','在空田播种小麦。种子与收成分别存放，不计入口粮。'],
  seedSoy:['播种专用','在空田播种大豆，还需掌握对应种植知识；种子不能当口粮。'],
  seedFlax:['播种专用','在空田播种亚麻，还需掌握对应种植知识；收获的是制作原料。'],
  rare:['探索所得 · 独立留种','在空田播种异穗麦，收获后返还专属种子；集市不出售。'],
 };
 const usage=(id:string)=>{const u=uses[id];return u?`<div class="farm-good-use"><span>${u[0]}</span><p>${u[1]}</p></div>`:'<div class="farm-good-use"><span>制作物资</span><p>在「学习与制造」查看配方中的用途与解锁要求。</p></div>';};
 const seedBag=()=>`<div class="pixi-seed-bag"><strong>种子袋</strong>${map.discovered.map(c=>`<p>${CROPS[c].name} ${e.goods[CROPS[c].seed]??0} 份</p>`).join('')}${map.rareSeeds?`<p>异穗麦种 ${map.rareSeeds} 份 · 独立留种</p>`:''}${jump('market','购买种子')}</div>`;
 const fieldTags:string[]=[];
 if(panel==='field'){
  title=p.discovery?.title??names[p.kind];
  let actions='',extra='',hint='';
  const explore=map.plots.find(t=>t.kind==='unknown'&&g.actions.some(a=>a.id==='economy:farmexplore:'+t.id&&a.enabled));
  if(p.kind==='unknown'){hint='走近以后，才能知道这里有什么。';fieldTags.push('尚未探索','抵达后揭晓');actions=illustratedAction('economy:farmexplore:'+p.id,'affairs:explore')||'<p>先探索相邻的未知地块。</p>';}
  if(p.kind==='wild'){hint='开垦后可以播种，独立照料这一方田。';fieldTags.push('可开垦',`初始肥力 ${p.fertility===3?3:2}`);actions=illustratedAction('economy:farmreclaim:'+p.id,'affairs:reclaim');}
  if(p.kind==='tree'||p.kind==='rock'){hint='保留这处地貌，沿周边继续探索。';fieldTags.push('不可开垦','地貌保留');actions=explore?`<button type="button" class="game-action" data-farm-jump="${explore.id}">寻找未知地块 →</button>`:'';}
  if(p.discovery){
   fieldTags.push(p.discovery.resolved?'见闻已收录':'见闻待处理');
   extra+=`<details class="farm-dock-story"><summary>查看见闻与出处</summary><h4>${esc(p.discovery.title)}</h4><p>${esc(p.discovery.text)}</p>${p.discovery.resolved?`<p>${esc(p.discovery.outcome||'已记录地貌。')}</p>`:''}<small>${esc(p.discovery.inspiration)}</small></details>`;
   if(!p.discovery.resolved)actions+=g.actions.filter(a=>a.id.startsWith(`economy:farmstory:${p.id}-`)).map(a=>illustratedAction(a.id,storyArt(a.id))).join('');
  }
  if(p.kind==='field'&&f){
   title=f.variety==='heritage'?'异穗麦田':f.crop?CROPS[f.crop].name+'田':'空田待播';
   hint=f.crop?(f.growth>=f.duration?'庄稼成熟，可以收获了。':'庄稼正在生长，可以补水照料。'):'选一袋种子，开始新一茬。';
   fieldTags.push(f.crop?(f.growth>=f.duration?'成熟待收':`生长 ${f.growth}/${f.duration} 季`):'等待播种',`肥力 ${f.fertility}/3`,`补水 ${f.moisture}`,p.id===map.homeId?'起始田 · 自动供水':'扩展田 · 手动照料');
   if(f.crop)fieldTags.push(`预计收成 ${p.harvest}`,`累计受灾 ${f.stress}`);
   actions=(f.crop?[f.crop]:map.discovered).map(c=>illustratedAction(`economy:farmplot:${p.id}-${c}`,f.crop?(f.growth>=f.duration?goodArt(c):'affairs:water'):goodArt(CROPS[c].seed))).join('')+(!f.crop?illustratedAction('economy:farmrare:'+p.id,'affairs:rare'):'');
   extra+=`<details><summary>养护与同门求助</summary><div class="farm-dock-options">${illustratedAction('economy:farmfertilize:'+p.id,'goods:compost')}${illustratedAction('economy:neighbor:help-'+p.id,'affairs:water')}</div></details>`;
   if(p.id===map.homeId)extra+=`<details><summary>持续耕作</summary><div class="farm-dock-options">${map.discovered.map(c=>illustratedAction('economy:farmcycle:'+c,goodArt(CROPS[c].seed))).join('')}${button('economy:farmcycle:off')}</div><p>仅起始田自动耕作；异穗麦收获后仍按所选普通作物复种。</p></details>`;
   extra+=`<details><summary>种子袋</summary>${seedBag()}</details>`;
  }
  body=`<section class="farm-map-dock" aria-label="当前地块操作"><div class="farm-dock-main"><div class="farm-dock-heading"><span>${p.id} · ${names[p.kind]}</span><h3>${esc(title)}</h3><p>${hint}</p></div><div class="farm-dock-actions">${actions}</div></div>${extra?`<div class="farm-dock-extras">${extra}</div>`:''}</section>`;
 }
 if(panel==='home'){
  const cooking=g.actions.filter(a=>a.id.startsWith('economy:cook:'));
  body=`<div class="farm-room-hero">${emblem('home:home')}<div><span class="eyebrow">${esc(g.person.name)}的农舍</span><h3>生火做饭，归来歇息</h3><p>可用精力 ${g.life?.budget.freeEnergy??0} · 即食口粮 ${g.family.food} 份 · 季末需 ${g.parameters.foodPerTurn} 份</p></div></div><h4>灶台 · 用自家收成做饭</h4><div class="farm-card-grid">${cooking.map(a=>{const recipe=COOKING.find(r=>a.id==='economy:cook:'+r.id)!;return card(recipe.name,`<p>${Object.entries(recipe.inputs).map(([id,q])=>`${esc(e.goodsCatalog[id]?.name??id)} ${e.goods[id]??0}/${q}`).join(' · ')}</p><p class="farm-result">做成 ${recipe.food} 份即食口粮</p>`,button(a.id),'home:'+recipe.id);}).join('')}</div><p class="subtle">食材与木柴当次扣除，做好的饭存入口粮；种子单独留存，亚麻不能做饭。</p><h4>身体与日常</h4><div class="farm-card-grid">${card('休息与疗养','<p>恢复精力，照料身体。</p>',button('economy:rest:self')+button('economy:care:self'),'home:rest')}${card('生活储备',`<p>可食 ${e.foodTotal} 份 · 每季需 ${g.parameters.foodPerTurn} 份</p>`,jump('store','查看仓库')+jump('market','买粮补给'),'home:reserves')}${card('采集与临时帮工','<p>采集木柴与食物，或帮工换取钱财。</p>',g.actions.filter(a=>a.group==='生活'&&['gather','work'].includes(a.id.split(':')[1])).map(a=>button(a.id)).join(''),'home:gather')}</div>${g.socialFood?`<details class="farm-policy"><summary>吃饭与储粮安排 · 预计补粮 ${g.socialFood.purchase} 份</summary>${foodPolicyControls(g,button)}</details>`:''}`;
 }
 if(panel==='store'){
  const stock=(id:string,name:string,q:number)=>card(name,`<strong class="farm-stock-quantity">${q}<small> 份</small></strong>${usage(id)}`,id.startsWith('seed')||id==='rare'?jump('field','去播种'):['wheat','soy'].includes(id)?jump('home','去做饭'):'',goodArt(id));
  const goods=Object.entries(e.goods).filter(([,q])=>q>0);
  body=`<div class="farm-room-hero">${emblem('home:reserves')}<div><h3>收好这一季的收成</h3><p>可食储备 ${e.foodTotal} · 食品保护容量 ${e.storage} · 超出保护可能损耗</p></div><div>${jump('market','出售或补给')}</div></div><h4>口粮与收成</h4><div class="farm-card-grid">${stock('food','即食口粮',g.family.food)}${goods.filter(([id])=>['wheat','soy','flour','flax','straw'].includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}</div><h4>留种与材料</h4><div class="farm-card-grid">${goods.filter(([id])=>!['wheat','soy','flour','flax','straw'].includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}${map.rareSeeds?stock('rare','异穗麦种',map.rareSeeds):''}</div>`;
  const stockItems=[['food','即食口粮',g.family.food],...goods.map(([id,q])=>[id,e.goodsCatalog[id]?.name??id,q]),...(map.rareSeeds?[['rare','异穗麦种',map.rareSeeds]]:[])] as [string,string,number][];
  const chosen=stockItems.find(([id])=>id===stockSelection)??stockItems[0];
  const seed=chosen[0].startsWith('seed')||chosen[0]==='rare',edible=['food','wheat','soy','flour'].includes(chosen[0]);
  for(const [id,name] of stockItems)body=body.replace(`<h4>${esc(name)}</h4>`,`<h4><button class="text-btn" data-farm-stock="${esc(id)}" aria-pressed="${chosen[0]===id}">${esc(name)}</button></h4>`);
  body=`<div class="farm-room-split"><section>${body}</section><aside class="farm-ledger">${emblem(goodArt(chosen[0]))}<h3>${esc(chosen[1])}</h3><p class="farm-result">持有 ${chosen[2]} 份</p>${usage(chosen[0])}<p>${seed?'种子单独留存，播种时消耗，不会当作口粮。':edible?'可用于家庭口粮。小麦和大豆也能带到灶台烹饪，做好的饭存入口粮。':'保留用于制作、农事或交付；不计入可食储备。'}</p>${chosen[0]==='rare'?'<p>探索所得，市场不出售；收获后返还专属种子。</p>':''}${jump(seed?'field':edible?'home':'market',seed?'去播种':edible?'去农舍':'去买卖')}</aside></div>`;
 }
 if(panel==='market'){
  const v=e.marketView,allowed=['seedWheat','seedSoy','seedFlax','wood','clay','compost','straw'];
  const items=(v?.catalog??[]).filter(i=>i.id==='good-food'||i.kind==='goods'&&allowed.includes(i.target));
  body=`<div class="farm-room-split"><section><h4>农家所需</h4><div class="farm-card-grid">${items.map(i=>card(i.name,`<p class="farm-result">${i.price} 钱 / 份</p><p>${i.local?'现货':'下一季交付'} · 库存 ${i.stock}</p>${usage(i.id==='good-food'?'food':i.target)}`,button('economy:cartadd:'+i.id),goodArt(i.id==='good-food'?'food':i.target))).join('')||button('economy:buyfood:bulk')}</div><h4>出售收成</h4><div class="farm-card-grid">${['wheat','soy','flax','straw'].filter(id=>(e.goods[id]??0)>0).map(id=>card(e.goodsCatalog[id]?.name??id,`<p>持有 ${e.goods[id]} 份</p>`,button('economy:sell:'+id),goodArt(id))).join('')||'<p class="subtle">暂无可出售的收成。</p>'}</div></section><aside class="farm-ledger">${emblem('affairs:basket')}<h3>这趟采购</h3><p class="farm-purchase-note">购买不耗时间与精力</p>${v?`${v.quote.lines.map(l=>`<div class="farm-ledger-line"><strong>${esc(l.item.name)} × ${l.quantity}</strong>${button('economy:cartremove:'+l.item.id)}</div>`).join('')||'<p class="subtle">选好物资，再一起结账。</p>'}<p class="farm-result">合计 ${v.quote.total} 钱</p>${button('economy:checkout:cart')}${button('economy:clearcart:all')}`:''}</aside></div>`;
 }
 if(panel==='neighbor')body=`<div class="farm-room-hero">${emblem('affairs:talk')}<div><span class="eyebrow">同门相助</span><h3>${esc(n.name)} · ${n.title}</h3><p>${n.alive?(n.busy?'正在忙农活':'本季可前往拜访'):'已故'} · 交情 ${n.trust}/5</p></div></div><div class="farm-card-grid">${card('田边叙话','<p>同门各自修行经营，闲时聊聊近况。</p>',button('economy:neighbor:talk'),'affairs:talk')}${card('互换种子',`<p>可交换豆种 ${n.offers.seedSoy} 份 · 麻种 ${n.offers.seedFlax} 份</p>`,button('economy:neighbor:trade-soy')+button('economy:neighbor:trade-flax'),'affairs:exchange')}${card('请教与互助','<p>请教种植知识；灌溉求助需先选择具体田块。</p>',button('economy:neighbor:learn')+jump('field','去田地求助'),'affairs:learn')}</div><p class="subtle">${n.title}的田地、物资与劳动独立结算，不能切换控制；自己的弟子接续自己的传承。</p>`;
 if(panel==='discoveries')body=map.plots.filter(p=>p.discovery).map(p=>`<article class="farm-discovery">${emblem('affairs:story')}<button class="text-btn" data-farm-jump="${p.id}">${p.id} · ${esc(p.discovery!.title)} →</button><p>${esc(p.discovery!.resolved?p.discovery!.outcome||'已记录，保留地貌。':'尚待处理，可以稍后再来。')}</p></article>`).join('')||'<p>沿地图边缘探索，见闻与处理结果会保存在对应地块。</p>';
 return `<section class="pixi-farm"><header class="pixi-farm-heading"><div><span class="eyebrow">田野 · ${esc(g.world.weatherName)}</span><h2>${panel==='field'?'耕一方田，探一方天地':panels[panel]}</h2></div><span>田 ${map.plots.filter(p=>p.kind==='field').length} 块 · 已知 ${map.plots.filter(p=>p.kind!=='unknown').length} 格</span></header><nav class="farm-local-nav" aria-label="农场事务">${Object.entries(panels).map(([id,n])=>`<button type="button" data-farm-panel="${id}" aria-pressed="${panel===id}">${n}</button>`).join('')}</nav>${panel==='field'?`<div class="pixi-farm-layout farm-layout-floating"><div class="pixi-farm-viewport"><div id="farm-map"></div><div class="farm-ink-title" aria-hidden="true"><span>一方田野 · ${esc(g.world.weatherName)}</span><strong>田畴</strong></div><div class="farm-map-picker"><label for="farm-plot-select">定位地块</label><select id="farm-plot-select">${map.plots.map(t=>`<option value="${t.id}" ${t.id===p.id?'selected':''}>${t.id} · ${names[t.kind]}</option>`).join('')}</select></div><div class="pixi-map-tools"><span>点击地块 · 拖动地图</span><div><button data-farm-zoom="-1" aria-label="缩小地图">−</button><button data-farm-zoom="1" aria-label="放大地图">＋</button><button data-farm-center>回到选中地块</button></div></div>${body}</div></div>`:`<div class="farm-room"><div class="farm-room-feedback" role="status" aria-live="polite"></div>${body}</div>`}<footer class="farm-live-footer"><div class="farm-status-tags" role="status" aria-live="polite">${(panel==='field'?fieldTags:[`口粮 ${g.family.food} 份`,`可用精力 ${g.life?.budget.freeEnergy??0}`]).map(t=>`<span>${esc(t)}</span>`).join('')}</div>${panel==='field'?'<details class="farm-recent-feedback"><summary>最新动态</summary><div class="farm-effect-layer" role="status" aria-live="polite"></div></details>':''}<div class="pixi-season-end">${button('economy:end:season')}</div></footer></section>`;
}
