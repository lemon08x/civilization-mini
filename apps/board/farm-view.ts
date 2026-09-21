import type {SessionObservation} from '../../src/runtime/session.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {esc} from './economy-view.js';
import {foodPolicyControls} from './social-food-view.js';
import {farmEventArt,type FarmArt} from './illustration.js';
export type FarmGame=SessionObservation['game'];
export type FarmPanel='field'|'home'|'store'|'market'|'neighbor'|'discoveries';
let selected='p2q2',panel:FarmPanel='field';
export const selectedFarmPlot=()=>selected;
export function selectFarmPlot(id:string){selected=id;panel='field';}
export function selectFarmPanel(id:FarmPanel){panel=id;}
const names={unknown:'未知地块',wild:'可耕荒地',field:'自家田地',home:'你的农舍',tree:'古树',rock:'岩石与地标',brush:'荆棘地',story:'乡野发现'};
const panels:Record<FarmPanel,string>={field:'田地与探索',home:'农舍',store:'仓库',market:'买卖与补给',neighbor:'邻里',discoveries:'探索见闻'};
export function farm(g:FarmGame,button:(id:string)=>string):string {
 const e=g.economy!,map=e.farm;if(!map)return '<p>此存档缺少地块数据，请新开游戏。</p>';
 const p=map.plots.find(p=>p.id===selected)??map.plots.find(p=>p.id===map.homeId)!;selected=p.id;
 const f=p.field,n=map.neighbor;let title=panels[panel],body='';
 const art:FarmArt|null=panel==='discoveries'?'discovery':panel!=='field'?null:p.kind==='unknown'?'explore':p.kind==='wild'?'reclaim':p.kind==='field'?(!f?.crop?'sow':f.growth>=f.duration?'harvest':'tend'):p.discovery?'discovery':null;
 const jump=(id:FarmPanel,label:string)=>`<button type="button" class="text-btn" data-farm-panel="${id}">${label} →</button>`;
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
   body+='<div class="pixi-farm-actions">'+(f.crop?[f.crop]:map.discovered).map(c=>button(`economy:farmplot:${p.id}-${c}`)).join('')+(!f.crop?button('economy:farmrare:'+p.id):'')+`</div><details><summary>田间养护与邻里求助</summary>${button('economy:farmfertilize:'+p.id)}${button('economy:neighbor:help-'+p.id)}</details>`;
   if(p.id===map.homeId)body+=`<details><summary>起始田持续耕作</summary>${map.discovered.map(c=>button('economy:farmcycle:'+c)).join('')}${button('economy:farmcycle:off')}<p>仅起始田自动耕作；异穗麦收获后仍按所选普通作物复种。</p></details>`;
   body+=seedBag();
  }
  if(p.kind==='home')body='<p>一处遮风避雨的家。休息、储粮和日常往来在面板中安排。</p>'+jump('home','回农舍')+jump('store','查看库存');
 }
 if(panel==='home'){
  body=`<p>${esc(g.person.name)} · 可用精力 ${g.life?.budget.freeEnergy??0}</p>${button('economy:rest:self')}${button('economy:care:self')}<h4>生活储备</h4><p>可食 ${e.foodTotal} 份 · 每季需 ${g.parameters.foodPerTurn} 份</p>${g.socialFood?`<p>本季预计补粮 ${g.socialFood.purchase} 份，花 ${g.socialFood.cost} 钱；缺口 ${g.socialFood.missing}。</p><details><summary>调整吃饭与储粮安排</summary>${foodPolicyControls(g,button)}</details>`:''}${jump('market','买粮补给')}<details><summary>采集与临时帮工</summary>${g.actions.filter(a=>a.group==='生活'&&['gather','work'].includes(a.id.split(':')[1])).map(a=>button(a.id)).join('')}</details><p><button data-page="家人">人物与传承 →</button><button data-page="修炼">修身 →</button></p>`;
 }
 if(panel==='store')body=`<p>可食储备 ${e.foodTotal} · 食品保护容量 ${e.storage}</p><table class="farm-stock"><tbody><tr><td>即食粮</td><td>${g.family.food}</td></tr>${Object.entries(e.goods).filter(([,v])=>v>0).map(([id,v])=>`<tr><td>${esc(e.goodsCatalog[id]?.name??id)}</td><td>${v}</td></tr>`).join('')}${map.rareSeeds?`<tr><td>异穗麦种</td><td>${map.rareSeeds}</td></tr>`:''}</tbody></table><p class="subtle">种子不作口粮。食品超出保护容量可能损耗。</p>${jump('market','出售或补给')}`;
 if(panel==='market'){
  const v=e.marketView;
  const food=v?.catalog.find(i=>i.id==='good-food');
  body=`<h4>买粮</h4>${food?`<p>${esc(food.name)} · ${food.price} 钱 · 库存 ${food.stock}</p>${button('economy:cartadd:'+food.id)}`:button('economy:buyfood:bulk')}<h4>买种与农用物资</h4>`;
  const allowed=['seedWheat','seedSoy','seedFlax','wood','clay','compost','straw'];
  body+=(v?.catalog??[]).filter(i=>i.kind==='goods'&&allowed.includes(i.target)).map(i=>`<div class="farm-market-row"><strong>${esc(i.name)}</strong><p>${i.price} 钱 · ${i.local?'现货':'下一季交付'} · 库存 ${i.stock}</p>${button('economy:cartadd:'+i.id)}</div>`).join('');
  if(v)body+=`<details ${v.quote.lines.length?'open':''}><summary>采购清单 · ${v.quote.total} 钱</summary>${v.quote.lines.map(l=>`<p>${esc(l.item.name)} × ${l.quantity}</p>${button('economy:cartremove:'+l.item.id)}`).join('')}${button('economy:checkout:cart')}${button('economy:clearcart:all')}</details>`;
  body+=`<details><summary>出售收成</summary>${['wheat','soy','flax','straw'].filter(id=>(e.goods[id]??0)>0).map(id=>button('economy:sell:'+id)).join('')||'<p>暂无可出售的收成。</p>'}</details>`;
 }
 if(panel==='neighbor')body=`<p>${esc(n.name)} · ${n.alive?(n.busy?'忙于农活':'在世'):'已故'}</p><p>关系 ${n.trust}/5 · 独立生活，不可控制</p><p>可交换豆种 ${n.offers.seedSoy} · 亚麻种 ${n.offers.seedFlax}</p><div class="pixi-farm-actions">${['talk','trade-soy','trade-flax','learn'].map(a=>button('economy:neighbor:'+a)).join('')}</div><p class="subtle">灌溉求助在具体田块中选择。</p>`;
 if(panel==='discoveries')body=map.plots.filter(p=>p.discovery).map(p=>`<article class="farm-discovery"><button class="text-btn" data-farm-jump="${p.id}">${p.id} · ${esc(p.discovery!.title)} →</button><p>${esc(p.discovery!.resolved?p.discovery!.outcome||'已记录，保留地貌。':'尚待处理，可以稍后再来。')}</p></article>`).join('')||'<p>沿地图边缘探索，见闻与处理结果会保存在对应地块。</p>';
 return `<section class="pixi-farm"><header class="pixi-farm-heading"><div><span class="eyebrow">田野 · ${esc(g.world.weatherName)}</span><h2>耕一方田，探一方天地</h2></div><span>田 ${map.plots.filter(p=>p.kind==='field').length} 块 · 已知 ${map.plots.filter(p=>p.kind!=='unknown').length} 格</span></header><nav class="farm-local-nav" aria-label="农场事务">${Object.entries(panels).map(([id,n])=>`<button type="button" data-farm-panel="${id}" aria-pressed="${panel===id}">${n}</button>`).join('')}</nav><div class="pixi-farm-layout"><div class="pixi-farm-viewport"><div id="farm-map"></div><div class="pixi-map-tools"><span>点击地块 · 拖动地图</span><div><button data-farm-zoom="-1" aria-label="缩小地图">−</button><button data-farm-zoom="1" aria-label="放大地图">＋</button><button data-farm-center>回到选中地块</button></div></div><div class="farm-effect-layer" role="status" aria-live="polite"></div></div><aside class="pixi-farm-inspector">${art?farmEventArt(art):''}<h3>${title}</h3>${body}</aside></div><footer><p>起始田 ${map.homeId} 接入自动供水与持续耕作；扩展田手动管理。探索结果永久保留，未知格不预告内容。</p><div class="pixi-season-end">${button('economy:end:season')}</div></footer></section>`;
}
