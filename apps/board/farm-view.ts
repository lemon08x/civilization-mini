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
export function farm(g:FarmGame,button:(id:string)=>string):string {
 const e=g.economy!,map=e.farm;if(!map)return '<p>此存档缺少地块数据，请新开游戏。</p>';
 const p=map.plots.find(p=>p.id===selected)??map.plots.find(p=>p.id===map.homeId)!;selected=p.id;
 const f=p.field,n=map.neighbor;let title=panels[panel],body='';
 const jump=(id:FarmPanel,label:string)=>`<button type="button" class="text-btn" data-farm-panel="${id}">${label} →</button>`;
 const emblem=(id:string)=>`<div class="farm-item-art">${uiIcon(id)}</div>`;
 const card=(name:string,detail:string,actions:string,icon='box')=>`<article class="farm-item-card">${emblem(icon)}<h4>${esc(name)}</h4>${detail}<div class="farm-card-actions">${actions}</div></article>`;
 const seedBag=()=>`<div class="pixi-seed-bag"><strong>种子袋</strong>${map.discovered.map(c=>`<p>${CROPS[c].name} ${e.goods[CROPS[c].seed]??0} 份</p>`).join('')}${map.rareSeeds?`<p>异穗麦种 ${map.rareSeeds} 份 · 独立留种</p>`:''}${jump('market','购买种子')}</div>`;
 if(panel==='field'){
  title=names[p.kind];
  body=`<label for="farm-plot-select">选择田块或探索方向</label><select id="farm-plot-select">${map.plots.map(t=>`<option value="${t.id}" ${t.id===p.id?'selected':''}>${t.id} · ${names[t.kind]}</option>`).join('')}</select><p class="eyebrow">${p.id}</p>`;
  if(p.discovery)body+=`<article class="farm-discovery"><h4>${esc(p.discovery.title)}</h4><p>${esc(p.discovery.text)}</p>${p.discovery.resolved?`<p class="notice">${esc(p.discovery.outcome||'已记录地貌。')}</p>`:''}<details><summary>灵感与出处</summary><p>${esc(p.discovery.inspiration)}</p></details></article>`;
  if(p.kind==='unknown')body+='<p>沿已知边界探索，结果在抵达后揭晓。可能遇到可耕地、障碍、种子或乡野故事。</p>'+button('economy:farmexplore:'+p.id);
  if(p.kind==='wild')body+=`<p>可开垦成独立田地。${p.fertility===3?'淤泥归田，初始肥力3。':'初始肥力2。'}</p>`+button('economy:farmreclaim:'+p.id);
  if(p.kind==='tree'||p.kind==='rock')body+='<p class="notice">此格不能开垦。可沿周边继续探索，不会堵死整片地图。</p>';
  if(p.discovery&&!p.discovery.resolved)body+='<div class="pixi-farm-actions">'+g.actions.filter(a=>a.id.startsWith(`economy:farmstory:${p.id}-`)).map(a=>button(a.id)).join('')+'</div>';
  if(p.kind==='field'&&f){
   title=f.variety==='heritage'?'异穗麦田':f.crop?CROPS[f.crop].name+'田':'空田待播';
   body+=f.crop?`<p>${f.growth>=f.duration?'成熟待收':`生长 ${f.growth}/${f.duration} 季`} · 预计收成 ${p.harvest}</p><p>肥力 ${f.fertility}/3 · 补水 ${f.moisture} · 累计受灾 ${f.stress}</p>`:'<p>选择已发现的种子开始新一茬。</p>';
   body+='<div class="pixi-farm-actions">'+(f.crop?[f.crop]:map.discovered).map(c=>button(`economy:farmplot:${p.id}-${c}`)).join('')+(!f.crop?button('economy:farmrare:'+p.id):'')+`</div><details><summary>田间养护与同门求助</summary>${button('economy:farmfertilize:'+p.id)}${button('economy:neighbor:help-'+p.id)}</details>`;
   if(p.id===map.homeId)body+=`<details><summary>起始田持续耕作</summary>${map.discovered.map(c=>button('economy:farmcycle:'+c)).join('')}${button('economy:farmcycle:off')}<p>仅起始田自动耕作；异穗麦收获后仍按所选普通作物复种。</p></details>`;
   body+=seedBag();
  }
 }
 if(panel==='home'){
  const cooking=g.actions.filter(a=>a.id.startsWith('economy:cook:'));
  body=`<div class="farm-room-hero">${emblem('home')}<div><span class="eyebrow">${esc(g.person.name)}的农舍</span><h3>生火做饭，归来歇息</h3><p>可用精力 ${g.life?.budget.freeEnergy??0} · 即食口粮 ${g.family.food} 份 · 季末需 ${g.parameters.foodPerTurn} 份</p></div></div><h4>灶台 · 用自家收成做饭</h4><div class="farm-card-grid">${cooking.map(a=>{const recipe=COOKING.find(r=>a.id==='economy:cook:'+r.id)!;return card(recipe.name,`<p>${Object.entries(recipe.inputs).map(([id,q])=>`${esc(e.goodsCatalog[id]?.name??id)} ${e.goods[id]??0}/${q}`).join(' · ')}</p><p class="farm-result">做成 ${recipe.food} 份即食口粮</p>`,button(a.id),'meal');}).join('')}</div><p class="subtle">食材与木柴当次扣除，做好的饭存入口粮；种子单独留存，亚麻不能做饭。</p><h4>身体与日常</h4><div class="farm-card-grid">${card('休息与疗养','<p>恢复精力，照料身体。</p>',button('economy:rest:self')+button('economy:care:self'),'home')}${card('生活储备',`<p>可食 ${e.foodTotal} 份 · 每季需 ${g.parameters.foodPerTurn} 份</p>`,jump('store','查看仓库')+jump('market','买粮补给'),'box')}${card('采集与临时帮工','<p>采集木柴与食物，或帮工换取钱财。</p>',g.actions.filter(a=>a.group==='生活'&&['gather','work'].includes(a.id.split(':')[1])).map(a=>button(a.id)).join(''),'tool')}</div>${g.socialFood?`<details class="farm-policy"><summary>吃饭与储粮安排 · 预计补粮 ${g.socialFood.purchase} 份</summary>${foodPolicyControls(g,button)}</details>`:''}`;
 }
 if(panel==='store'){
  const stock=(id:string,name:string,q:number)=>card(name,`<strong class="farm-stock-quantity">${q}<small> 份</small></strong><p>${id.startsWith('seed')||id==='rare'?'播种专用 · 不作口粮':['food','wheat','soy','flour'].includes(id)?'食用储备':'制作与农用物资'}</p>`,id.startsWith('seed')||id==='rare'?jump('field','去播种'):['wheat','soy'].includes(id)?jump('home','去做饭'):'',id.startsWith('seed')||id==='rare'?'plant':id==='food'?'meal':'box');
  const goods=Object.entries(e.goods).filter(([,q])=>q>0);
  body=`<div class="farm-room-hero">${emblem('box')}<div><h3>收好这一季的收成</h3><p>可食储备 ${e.foodTotal} · 食品保护容量 ${e.storage} · 超出保护可能损耗</p></div><div>${jump('market','出售或补给')}</div></div><h4>口粮与收成</h4><div class="farm-card-grid">${stock('food','即食口粮',g.family.food)}${goods.filter(([id])=>['wheat','soy','flour','flax','straw'].includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}</div><h4>留种与材料</h4><div class="farm-card-grid">${goods.filter(([id])=>!['wheat','soy','flour','flax','straw'].includes(id)).map(([id,q])=>stock(id,e.goodsCatalog[id]?.name??id,q)).join('')}${map.rareSeeds?stock('rare','异穗麦种',map.rareSeeds):''}</div>`;
  const stockItems=[['food','即食口粮',g.family.food],...goods.map(([id,q])=>[id,e.goodsCatalog[id]?.name??id,q]),...(map.rareSeeds?[['rare','异穗麦种',map.rareSeeds]]:[])] as [string,string,number][];
  const chosen=stockItems.find(([id])=>id===stockSelection)??stockItems[0];
  const seed=chosen[0].startsWith('seed')||chosen[0]==='rare',edible=['food','wheat','soy','flour'].includes(chosen[0]);
  for(const [id,name] of stockItems)body=body.replace(`<h4>${esc(name)}</h4>`,`<h4><button class="text-btn" data-farm-stock="${esc(id)}" aria-pressed="${chosen[0]===id}">${esc(name)}</button></h4>`);
  body=`<div class="farm-room-split"><section>${body}</section><aside class="farm-ledger">${emblem(seed?'plant':edible?'meal':'box')}<h3>${esc(chosen[1])}</h3><p class="farm-result">持有 ${chosen[2]} 份</p><p>${seed?'种子单独留存，播种时消耗，不会当作口粮。':edible?'可用于家庭口粮。小麦和大豆也能带到灶台烹饪，做好的饭存入口粮。':'保留用于制作、农事或交付；不计入可食储备。'}</p>${chosen[0]==='rare'?'<p>探索所得，市场不出售；收获后返还专属种子。</p>':''}${jump(seed?'field':edible?'home':'market',seed?'去播种':edible?'去农舍':'去买卖')}</aside></div>`;
 }
 if(panel==='market'){
  const v=e.marketView,allowed=['seedWheat','seedSoy','seedFlax','wood','clay','compost','straw'];
  const items=(v?.catalog??[]).filter(i=>i.id==='good-food'||i.kind==='goods'&&allowed.includes(i.target));
  body=`<div class="farm-room-split"><section><h4>农家所需</h4><div class="farm-card-grid">${items.map(i=>card(i.name,`<p class="farm-result">${i.price} 钱 / 份</p><p>${i.local?'现货':'下一季交付'} · 库存 ${i.stock}</p>`,button('economy:cartadd:'+i.id),i.id==='good-food'?'meal':i.target.startsWith('seed')?'plant':'box')).join('')||button('economy:buyfood:bulk')}</div><h4>出售收成</h4><div class="farm-card-grid">${['wheat','soy','flax','straw'].filter(id=>(e.goods[id]??0)>0).map(id=>card(e.goodsCatalog[id]?.name??id,`<p>持有 ${e.goods[id]} 份</p>`,button('economy:sell:'+id),'plant')).join('')||'<p class="subtle">暂无可出售的收成。</p>'}</div></section><aside class="farm-ledger"><h3>这趟采购</h3>${v?`${v.quote.lines.map(l=>`<div class="farm-ledger-line"><strong>${esc(l.item.name)} × ${l.quantity}</strong>${button('economy:cartremove:'+l.item.id)}</div>`).join('')||'<p class="subtle">选好物资，再一起结账。</p>'}<p class="farm-result">合计 ${v.quote.total} 钱</p>${button('economy:checkout:cart')}${button('economy:clearcart:all')}`:''}</aside></div>`;
 }
 if(panel==='neighbor')body=`<div class="farm-room-hero">${emblem('people')}<div><span class="eyebrow">同门相助</span><h3>${esc(n.name)} · ${n.title}</h3><p>${n.alive?(n.busy?'正在忙农活':'本季可前往拜访'):'已故'} · 交情 ${n.trust}/5</p></div></div><div class="farm-card-grid">${card('田边叙话','<p>同门各自修行经营，闲时聊聊近况。</p>',button('economy:neighbor:talk'),'people')}${card('互换种子',`<p>可交换豆种 ${n.offers.seedSoy} 份 · 麻种 ${n.offers.seedFlax} 份</p>`,button('economy:neighbor:trade-soy')+button('economy:neighbor:trade-flax'),'plant')}${card('请教与互助','<p>请教种植知识；灌溉求助需先选择具体田块。</p>',button('economy:neighbor:learn')+jump('field','去田地求助'),'book')}</div><p class="subtle">${n.title}的田地、物资与劳动独立结算，不能切换控制；自己的弟子接续自己的传承。</p>`;
 if(panel==='discoveries')body=map.plots.filter(p=>p.discovery).map(p=>`<article class="farm-discovery">${emblem(p.kind==='tree'?'plant':'book')}<button class="text-btn" data-farm-jump="${p.id}">${p.id} · ${esc(p.discovery!.title)} →</button><p>${esc(p.discovery!.resolved?p.discovery!.outcome||'已记录，保留地貌。':'尚待处理，可以稍后再来。')}</p></article>`).join('')||'<p>沿地图边缘探索，见闻与处理结果会保存在对应地块。</p>';
 return `<section class="pixi-farm"><header class="pixi-farm-heading"><div><span class="eyebrow">田野 · ${esc(g.world.weatherName)}</span><h2>${panel==='field'?'耕一方田，探一方天地':panels[panel]}</h2></div><span>田 ${map.plots.filter(p=>p.kind==='field').length} 块 · 已知 ${map.plots.filter(p=>p.kind!=='unknown').length} 格</span></header><nav class="farm-local-nav" aria-label="农场事务">${Object.entries(panels).map(([id,n])=>`<button type="button" data-farm-panel="${id}" aria-pressed="${panel===id}">${n}</button>`).join('')}</nav>${panel==='field'?`<div class="pixi-farm-layout"><div class="pixi-farm-viewport"><div id="farm-map"></div><div class="farm-ink-title" aria-hidden="true"><span>一方田野 · ${esc(g.world.weatherName)}</span><strong>田畴</strong></div><div class="pixi-map-tools"><span>点击地块 · 拖动地图</span><div><button data-farm-zoom="-1" aria-label="缩小地图">−</button><button data-farm-zoom="1" aria-label="放大地图">＋</button><button data-farm-center>回到选中地块</button></div></div><div class="farm-effect-layer" role="status" aria-live="polite"></div></div><aside class="pixi-farm-inspector"><h3>${title}</h3>${body}</aside></div>`:`<div class="farm-room"><div class="farm-room-feedback" role="status" aria-live="polite"></div>${body}</div>`}<footer><p>起始田 ${map.homeId} 接入自动供水与持续耕作；扩展田手动管理。探索结果永久保留，未知格不预告内容。</p><div class="pixi-season-end">${button('economy:end:season')}</div></footer></section>`;
}
