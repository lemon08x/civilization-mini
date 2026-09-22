import type { SessionObservation } from '../../src/runtime/session.js';
import { COOKING, CROPS, ALL_PRODUCTS, ALL_PROCESSES } from '../../src/game/systems/economy-catalog.js';
import { SEED_LORE, CHINESE_ERA_REFERENCE, type SeedLore } from './seed-lore.js';
import { FOOD_LORE, type FoodLore, type CulturalLore } from './food-lore.js';
import { esc } from './economy-view.js';

type Entry={id:string;name:string;category:string;planned:boolean;source:string;use:string;art?:string;amount?:number;lore?:SeedLore;foodLore?:FoodLore};
const categories=['种子','农作物与食材','烹饪食谱','原料与材料','工具与加工品'];
let category='农作物与食材',status='全部',query='',selected='',seedStage='全部',seedSeason='全年',loreTab='history';
// Future entries describe design directions only; they never create goods or recipes.
const plans: [string,string,string,string][]=[
 ['蚕丝','原料与材料','桑叶养蚕、缫丝','纺织原料；养蚕机制尚未开放'],
 ['竹蒸笼','工具与加工品','竹材编制，学习编织技艺','支持蒸制主食；工坊方向'],
 ['酿造缸','工具与加工品','陶土成形烧制','发酵与腌渍容器；工坊方向'],
 ['自动包装线','工具与加工品','工业阶段购置设备、安排员工','产品包装与批量销售；市场玩法方向'],
];
const uses:Record<string,string>={wood:'农舍燃料，也用于修渠、木作和设备制造。',clay:'陶器与陶质构件的原料，不能直接当作田间肥料。',wheat:'可烹饪麦粥、麦豆饭，也可磨粉或补生活口粮。',soy:'可做炖豆、麦豆饭，也用于榨油和生活口粮。',flax:'加工为亚麻纤维，再制成绳索；不能食用。',straw:'收获副产物，可用于堆肥。',compost:'田地施肥投入，用于改善肥力。',flour:'磨粮所得，可补生活口粮。',oil:'榨油加工品，可供后续生产与交易。',fiber:'纤维加工品，用于制绳。',rope:'绳索加工品，可作为制造投入。'};
function entries(g:SessionObservation['game']):Entry[]{
 const e=g.economy!;
 const seeds=Object.entries(CROPS).map(([id,c]):Entry=>({id:c.seed,name:c.name+'种子',category:'种子',planned:false,source:id==='wheat'?'起始物资与农场买卖':'探索辨种或同门换种，发现后可补购；播种需相应栽培知识',use:`播种 → ${c.name}，基础生长 ${c.duration} 天。种子不作为食物。`,art:`item-${c.seed}-ui.webp`,amount:e.goods[c.seed]??0}));
 seeds.push({id:'rare-wheat',name:'异穗麦种',category:'种子',planned:false,source:'探索「一束异穗」并选留；市场不出售',use:'培育异穗麦，收获时留种；仍受旱涝影响。',art:'item-seedWheat-ui.webp'});
 const meals=COOKING.map((r):Entry=>({id:'meal-'+r.id,name:r.name,category:'烹饪食谱',planned:false,source:Object.entries(r.inputs).map(([id,n])=>`${e.goodsCatalog[id]?.name??id} ${n}`).join(' + '),use:`农舍现做现吃；餐食调养 ${r.food} 天，不存为仓库物品，效果期间不能叠加。实际时间、精力以行动报价为准。`,art:`farm-home-${r.id}.webp`,foodLore:{...FOOD_LORE.find(f=>f.id==='meal-'+r.id)!,ingredients:Object.keys(r.inputs)}}));
 const sources=(id:string)=>ALL_PROCESSES.filter(p=>p.outputs[id]).map(p=>p.name).join('、');
 const destinations=(id:string)=>[...ALL_PROCESSES.filter(p=>p.inputs[id]).map(p=>p.name),...ALL_PRODUCTS.filter(p=>p.inputs[id]).map(p=>p.name)].join('、');
 const goods=Object.entries(e.goodsCatalog).filter(([id])=>!id.startsWith('seed')).map(([id,c]):Entry=>({id,name:c.name,category:FOOD_LORE.some(f=>f.id===id)?'农作物与食材':uses[id]||/矿|原料|铁料|铜料|铝料/.test(c.name)?'原料与材料':'工具与加工品',planned:false,source:sources(id)?'加工来源：'+sources(id)+'。需满足对应知识与设备条件。':'随阶段与条件开放，查阅主场景的探索或买卖',use:(uses[id]??'')+(destinations(id)?' 可用于：'+destinations(id)+'。':' 可在开放的买卖中查看交易条件。'),art:`item-${id}-ui.webp`,amount:e.goods[id]??0,foodLore:FOOD_LORE.find(f=>f.id===id)}));
 const tools=ALL_PRODUCTS.map((p):Entry=>({id:'device-'+p.id,name:p.name,category:'工具与加工品',planned:false,source:'制造材料：'+Object.entries(p.inputs).map(([id,n])=>`${e.goodsCatalog[id]?.name??id} ${n}`).join(' + ')+'；还需相应知识与研发条件',use:p.effect,art:`device-${p.id}-ui.webp`}));
 for(const seed of seeds)seed.lore=SEED_LORE.find(l=>l.id===seed.id);
 seeds.push(...SEED_LORE.filter(l=>!seeds.some(x=>x.id===l.id)).map((l):Entry=>({id:l.id,name:l.name,category:'种子',planned:true,source:l.source,use:l.use,lore:l})));
 goods.push({id:'food',name:'即食粮',category:'农作物与食材',planned:false,source:'现有家庭口粮，可从开放的补给渠道取得',use:'直接支持日常生活；种子不作为口粮。',amount:g.family.food,art:'item-food-ui.webp',foodLore:FOOD_LORE.find(f=>f.id==='food')});
 const futureFoods=FOOD_LORE.filter(f=>![...goods,...meals].some(x=>x.id===f.id)).map((f):Entry=>({id:f.id,name:f.name,category:f.kind==='recipe'?'烹饪食谱':'农作物与食材',planned:true,source:f.source,use:f.use,foodLore:f}));
 return [...seeds,...meals,...goods,...futureFoods,...tools,...plans.map(([name,category,source,use],i):Entry=>({id:'plan-'+i,name,category,source,use,planned:true}))];
}
export function atlasPage(g:SessionObservation['game']):string{
 const all=entries(g);
 return `<section class="item-atlas"><header class="atlas-intro"><div><span class="eyebrow">万物小志</span><h3>从一粒种子，到一桌饭菜</h3><p>已实装 ${all.filter(x=>!x.planned).length} 项 · 规划中 ${all.filter(x=>x.planned).length} 项。已实装不代表当前阶段可得；规划内容暂不参与游戏结算。</p></div><img src="/illustrations/item-book-ui.webp" alt="" width="90" height="90"></header>${seedReference()}<div class="atlas-toolbar"><div role="group" aria-label="图鉴分类">${['全部',...categories].map(c=>`<button type="button" data-atlas-category="${c}" aria-pressed="${category===c}">${c} <small>${c==='全部'?all.length:all.filter(x=>x.category===c).length}</small></button>`).join('')}</div><label>内容 <select id="atlas-status">${['全部','已实装','规划中'].map(s=>`<option ${s===status?'selected':''}>${s}</option>`).join('')}</select></label><label class="atlas-search">搜索 <input id="atlas-search" type="search" placeholder="名称、来源或用途" value="${esc(query)}"></label></div>${seedFilters()}<section id="food-atlas-guide" class="food-atlas-guide"><strong>种植材料 → 收获物 → 加工食材 → 烹饪食谱</strong><p>点击详情里的关联条目可以逐级查看。农作物中包含非食用的纤维原料；历史背景、原创故事与科学知识分别呈现，规划食谱暂不产生实际消耗和收益。</p></section><div class="atlas-workbench"><div><p id="atlas-count" class="subtle" aria-live="polite"></p><div class="atlas-grid">${all.map(x=>`<button type="button" class="atlas-card" data-atlas-id="${x.id}" data-category="${x.category}" data-planned="${x.planned}" data-seed-stage="${x.lore?.stage??x.foodLore?.stage??''}" data-seed-seasons="${x.lore?.seasons.join('')??''}" data-search="${esc([x.name,x.source,x.use,x.lore?.history,x.lore?.science,x.lore?.story.text,x.lore?.region,x.lore?.tags.join(' '),x.foodLore?.history,x.foodLore?.science,x.foodLore?.story.text,x.foodLore?.tags.join(' ')].join(' '))}"><span class="atlas-picture">${x.art?`<img src="/illustrations/${x.art}" onerror="this.hidden=true" alt="" loading="lazy">`:`<span class="atlas-specimen" aria-hidden="true">${x.name.slice(0,1)}</span>`}</span><span><small>${x.category} · ${x.planned?'规划中':'已实装'}</small><strong>${esc(x.name)}</strong><em>${x.amount!==undefined?'库存 '+x.amount:x.planned?'未来设想':'查阅用途'}</em>${x.foodLore?`<span class="food-card-kind ${!x.foodLore.edible?'nonfood':''}">${x.foodLore.kind==='recipe'?'食谱':!x.foodLore.edible?'非食用农作物':x.foodLore.kind==='crop'?'收获物':'食材'} · ${['农场','工坊','贸易','现代'][x.foodLore.stage]}</span>`:''}${x.lore?`<span class="seed-card-seasons" title="${esc(x.lore.region)}">${['春','夏','秋','冬'].map(t=>`<i class="${x.lore!.seasons.includes(t as '春'|'夏'|'秋'|'冬')?'sow-season':''}">${t}</i>`).join('')}<small>${x.lore.firstBatch?'首批优先':['农场','工坊','贸易','现代'][x.lore.stage]}</small></span>`:''}</span></button>`).join('')}</div><p id="atlas-empty" hidden>没有找到相关条目，试试其他分类或关键词。</p></div><aside class="atlas-detail" aria-label="物品详情">${all.map(x=>`<article data-atlas-detail="${x.id}" hidden><span class="atlas-badge">${x.planned?'规划中 · 尚未实装':'已实装 · 开放条件以游戏为准'}</span><h3>${esc(x.name)}</h3><p class="subtle">${x.category}${x.amount!==undefined?' · 当前库存 '+x.amount:''}</p><h4>${x.planned?'设想来源':'如何获得'}</h4><p>${esc(x.source)}</p><h4>${x.planned?'发展方向':'有什么用'}</h4><p>${esc(x.use)}</p>${foodConnections(x,all)}${x.foodLore?foodDetail(x.foodLore):''}${x.lore?seedDetail(x.lore):''}${x.planned?'<p class="atlas-note">这是未来内容储备，尚无可执行配方、效果数值或获取入口。</p>':''}</article>`).join('')}</aside></div></section>`;
}
export function bindAtlas():void{
 const cards=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-atlas-id]'));
 const refresh=()=>{
  let count=0;
  for(const c of cards){const d=c.dataset;c.hidden=!(category==='全部'||d.category===category)||!(status==='全部'||(d.planned==='true')===(status==='规划中'))||(['种子','农作物与食材','烹饪食谱'].includes(category)&&seedStage!=='全部'&&d.seedStage!==seedStage)||(category==='种子'&&seedSeason!=='全年'&&!d.seedSeasons?.includes(seedSeason))||!d.search!.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());if(!c.hidden)count++;}
  if(!cards.some(c=>c.dataset.atlasId===selected&&!c.hidden))selected=cards.find(c=>!c.hidden)?.dataset.atlasId??'';
  for(const c of cards)c.setAttribute('aria-pressed',String(c.dataset.atlasId===selected));
  document.querySelectorAll<HTMLElement>('[data-atlas-detail]').forEach(el=>el.hidden=el.dataset.atlasDetail!==selected);
  document.querySelectorAll<HTMLElement>('[data-atlas-category]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.atlasCategory===category)));
  document.getElementById('seed-filters')!.hidden=!['种子','农作物与食材','烹饪食谱'].includes(category);
  document.querySelectorAll<HTMLElement>('[data-seed-only]').forEach(el=>el.hidden=category!=='种子');
  document.getElementById('food-atlas-guide')!.hidden=!['农作物与食材','烹饪食谱'].includes(category);
  document.getElementById('seed-season-guide')!.hidden=category!=='种子';
  document.querySelectorAll<HTMLElement>('[data-atlas-lore-panel]').forEach(el=>el.hidden=el.dataset.atlasLorePanel!==loreTab);
  document.querySelectorAll<HTMLElement>('[data-atlas-lore-tab]').forEach(el=>el.setAttribute('aria-pressed',String(el.dataset.atlasLoreTab===loreTab)));
  document.getElementById('atlas-count')!.textContent=`共 ${count} 项 · 点击查看来源与用途`;
  document.getElementById('atlas-empty')!.hidden=count>0;
 };
 document.querySelectorAll<HTMLButtonElement>('[data-atlas-jump]').forEach(b=>b.onclick=()=>{
  const target=cards.find(c=>c.dataset.atlasId===b.dataset.atlasJump);if(!target)return;
  selected=target.dataset.atlasId!;category=target.dataset.category!;query='';status='全部';seedStage='全部';seedSeason='全年';
  (document.getElementById('atlas-search') as HTMLInputElement).value='';
  (document.getElementById('atlas-status') as HTMLSelectElement).value=status;
  (document.getElementById('seed-stage') as HTMLSelectElement).value=seedStage;
  (document.getElementById('seed-season') as HTMLSelectElement).value=seedSeason;
  refresh();document.querySelector('.atlas-detail')?.scrollTo({top:0});target.focus({preventScroll:true});target.scrollIntoView({block:'nearest'});
 });
 cards.forEach(c=>c.onclick=()=>{selected=c.dataset.atlasId!;refresh();document.querySelector('.atlas-detail')?.scrollTo({top:0});});
 document.querySelectorAll<HTMLButtonElement>('[data-atlas-category]').forEach(b=>b.onclick=()=>{category=b.dataset.atlasCategory!;refresh();});
 (document.getElementById('atlas-search') as HTMLInputElement).oninput=ev=>{query=(ev.target as HTMLInputElement).value;refresh();};
 (document.getElementById('atlas-status') as HTMLSelectElement).onchange=ev=>{status=(ev.target as HTMLSelectElement).value;refresh();};
 (document.getElementById('seed-stage') as HTMLSelectElement).onchange=ev=>{seedStage=(ev.target as HTMLSelectElement).value;refresh();};
 (document.getElementById('seed-season') as HTMLSelectElement).onchange=ev=>{seedSeason=(ev.target as HTMLSelectElement).value;refresh();};
 document.querySelectorAll<HTMLButtonElement>('[data-atlas-lore-tab]').forEach(b=>b.onclick=()=>{loreTab=b.dataset.atlasLoreTab!;refresh();});
 refresh();
}

function seedReference():string {
 return `<details class="atlas-era-reference"><summary>中国历史参考线 · 四阶段如何展开</summary><p>游戏以世界文明为基础，此处以中国历史组织题材。时间分界是玩法参考，作物的最早出现、地方推广与游戏安排阶段并不相同。</p><div>${CHINESE_ERA_REFERENCE.map((e,i)=>`<article><small>0${i+1} · ${e.years}</small><h4>${e.name}</h4><strong>${e.period}</strong><p>${e.focus}</p></article>`).join('')}</div></details>`;
}
function seedFilters():string {
 return `<section id="seed-season-guide" class="seed-season-guide" ${category!=='种子'?'hidden':''}><header><strong>四时种植方向</strong><span>江淮地区作为首批设计参考 · 农时知识尚未作为播种限制实装</span></header><div>${[['春','粟豆瓜麻 · 稻作准备'],['夏','小豆大豆 · 适地接茬'],['秋','大小麦 · 葵芜菁芥菜'],['冬','暖区耐寒菜 · 麦类越冬']].map(([season,text])=>`<article><b>${season}</b><span>${text}</span></article>`).join('')}</div><p>冬播仅适用于温暖地区及相应品种；越冬不等于冬季快速生长。寒冷地区以整地、修渠、留种为主。具体月份须结合当地霜期与品种，不能直接把公历月份套入农历。</p></section><div id="seed-filters" class="seed-filters" ${category!=='种子'?'hidden':''}><label>发展阶段 <select id="seed-stage"><option value="全部" ${seedStage==='全部'?'selected':''}>全部阶段</option>${CHINESE_ERA_REFERENCE.map((e,i)=>`<option value="${i}" ${seedStage===String(i)?'selected':''}>${e.name}</option>`).join('')}</select></label><label data-seed-only>播种季节 <select id="seed-season">${['全年','春','夏','秋','冬'].map(t=>`<option ${seedSeason===t?'selected':''}>${t}</option>`).join('')}</select></label><span data-seed-only>季节亮点表示参考窗口，须同时阅读地域条件。种薯、薯苗也归入种植材料。</span></div>`;
}
function seedDetail(l:SeedLore):string {
 return `<section class="seed-knowledge"><div class="seed-knowledge-tags">${l.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div><h4>农时参考 · 尚非当前播种规则</h4><dl class="seed-facts"><dt>适播</dt><dd>${l.seasons.join('、')} · ${esc(l.region)}</dd><dt>收获</dt><dd>${esc(l.harvest)}</dd><dt>水土</dt><dd>${esc(l.water)}</dd><dt>题材</dt><dd>${CHINESE_ERA_REFERENCE[l.stage].name} · ${esc(l.period)}</dd></dl>${loreReading(l)}</section>`;
}
function loreReading(l:CulturalLore):string {
 return `<div class="seed-reading-tabs" role="group" aria-label="图鉴知识">${[['history','历史背景'],['story','图鉴故事'],['science','科学与发展']].map(([id,name])=>`<button type="button" data-atlas-lore-tab="${id}" aria-pressed="${loreTab===id}">${name}</button>`).join('')}</div><div data-atlas-lore-panel="history"><p>${esc(l.history)}</p><details class="seed-references"><summary>参考书目与考证线索</summary><ul>${l.references.map(r=>`<li>${esc(r)}</li>`).join('')}</ul><p>书目用于后续考证；传播日期、古名对应与特定品种仍应核对具体版本和地方资料，不将首次记载等同起源或普及。</p></details></div><div data-atlas-lore-panel="story" hidden><span class="atlas-badge">原创故事线索 · 未触发的剧情设想</span><h4>${esc(l.story.title)}</h4><p>${esc(l.story.text)}</p></div><div data-atlas-lore-panel="science" hidden><p>${esc(l.science)}</p><div class="seed-hooks"><h4>后续玩法与剧情的生成点</h4><strong>观察</strong><p>${esc(l.hooks.observation)}</p><strong>选择</strong><p>${esc(l.hooks.choice)}</p><strong>发展</strong><p>${esc(l.hooks.consequence)}</p></div><small>这些是设计线索，尚非行动效果。故事不会直接决定游戏产量或奖励。</small></div>`;
}


function foodConnections(x:Entry,all:Entry[]):string {
 const linked=(title:string,ids:string[])=>{
  const entries=[...new Set(ids)].map(id=>all.find(e=>e.id===id)).filter((e):e is Entry=>!!e);
  return entries.length?`<div class="food-relationship"><h4>${title}</h4><div>${entries.map(e=>`<button type="button" data-atlas-jump="${esc(e.id)}">${esc(e.name)}<small>${e.planned?'规划':'已实装'}</small> →</button>`).join('')}</div></div>`:'';
 };
 const sources=x.foodLore?.seedIds??[];
 const ingredients=x.foodLore?.ingredients??[];
 const outputs=all.filter(e=>e.foodLore?.seedIds.includes(x.id)).map(e=>e.id);
 const processed=all.filter(e=>e.foodLore?.kind!=='recipe'&&e.foodLore?.ingredients.includes(x.id)).map(e=>e.id);
 const recipes=all.filter(e=>e.foodLore?.kind==='recipe'&&e.foodLore.ingredients.includes(x.id)).map(e=>e.id);
 return linked('种植来源',sources)+linked(x.foodLore?.kind==='recipe'?(x.planned?'食谱原料 · 配比待定':'当前规则投入'):['oil','food-driedgreens'].includes(x.id)?'可选加工来源':'加工原料',ingredients)+linked('对应收获物',outputs)+linked('加工去向',processed)+linked('相关烹饪食谱',recipes);
}
function foodDetail(l:FoodLore):string {
 return `<section class="seed-knowledge food-knowledge"><div class="seed-knowledge-tags">${l.tags.map(t=>`<span>${esc(t)}</span>`).join('')}</div>${!l.edible?'<p class="food-inedible-note">非食用农作物 · 进入纤维与制造路线，不进入烹饪食谱。</p>':''}<h4>${l.kind==='recipe'?'备料与工艺参考':'供应与保存参考'}</h4><dl class="seed-facts"><dt>题材</dt><dd>${CHINESE_ERA_REFERENCE[l.stage].name} · ${esc(l.period)}</dd><dt>供应</dt><dd>${esc(l.seasonNote)}</dd><dt>保存</dt><dd>${esc(l.storage)}</dd>${l.kind==='recipe'?`<dt>器具</dt><dd>${esc(l.equipment)}</dd>`:''}</dl>${l.kind==='recipe'?`<ol class="food-method">${l.method.map(step=>`<li>${esc(step)}</li>`).join('')}</ol><p class="subtle">工艺用于理解食谱。已实装食谱以页面上方的当前投入和效果为准；规划食谱还需定义配比、成本与条件。</p>`:''}${loreReading(l)}</section>`;
}
