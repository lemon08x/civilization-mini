import {placeIcon} from './ui-icons.js';
import {pageNames,playerGroups,ruleGuide,chapterEpigraph} from './player-guide.js';
import type { SessionObservation } from '../../src/runtime/session.js';
import { ALL_GOODS, CROPS } from '../../src/game/systems/economy-catalog.js';
import { esc } from './economy-view.js';

type Game = SessionObservation['game'];
type Button = (id: string) => string;
export type Recap = {title:string;kind:string;lines:string[]};

export const panel = (title:string, body:string) => `<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
export function meter(label:string, value:number, max:number, tone=''):string {
  return `<div class="resource-meter ${tone}"><div><span>${esc(label)}</span><strong class="num">${value} / ${max}</strong></div><progress aria-label="${esc(label)}" value="${Math.max(0,Math.min(value,max))}" max="${Math.max(1,max)}"></progress></div>`;
}
function costChips(g:Game, a:Game['actions'][number]):string {
  const time=a.time??a.ap;
  return `<span>时间 ${time}</span>${g.life?`<span>精力 ${a.energy??0}</span>`:''}<span class="${a.money?'':'cost-zero'}">钱 ${a.money}</span><span class="${a.food?'':'cost-zero'}">粮 ${a.food}</span>`;
}
export function confirmKind(id:string):'season'|'era'|'retire'|'handover'|null {
  if(id==='economy:end:season')return 'season';
  if(id==='economy:erasettle:stage')return 'era';
  if(id==='economy:retire:family')return 'retire';
  if(id==='handover')return 'handover';
  return null;
}
export function actionButton(g:Game, id:string, failed:boolean):string {
  const a=g.actions.find(a=>a.id===id); if(!a)return '';
  const kind=confirmKind(id);
  return `<div class="action-option"><button type="button" class="game-action" data-action="${esc(id)}"${kind?` data-confirm="${kind}"`:''} ${!a.enabled||failed?'disabled':''}><span class="action-name">${esc(a.label)}</span><span class="action-cost">${costChips(g,a)}</span></button>${!a.enabled?`<p class="blocked-reason">${esc(a.reason??'暂不可用')}</p>`:`<p class="action-note">${esc(a.description)}</p>`}</div>`;
}

export function seasonCheck(g:Game):string[] {
  const e=g.economy!,l=g.life,items:string[]=[];
  if(g.socialFood)items.push(`预计购粮 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱；生活缺口 ${g.socialFood.missing} 份`);
  else items.push(`可食储备 ${e.foodTotal} / 季耗 ${g.parameters.foodPerTurn}`);
  if(l?.budget.tasks.length)items.push(`已预留：${l.budget.tasks.map(t=>t.name).join('、')}（${l.budget.reservedTime} 时间 / ${l.budget.reservedEnergy} 精力）`);
  const stopped=e.industryView?.systems.filter(s=>s.instance&&s.blockers.length);
  if(stopped?.length)items.push(`已知停机：${stopped.map(s=>`${s.name}（${s.blockers.join('；')}）`).join('、')}`);
  if(l?.pendingRetirement)items.push('已安排本季交接；结束本季后才会进入交接，人物尚未切换。');
  if(e.modern&&e.modern.power>0)items.push(`当前余电 ${e.modern.power}${e.electricView?'；未入库的电会在季末耗散':''}`);
  return items;
}

export function confirmContent(g:Game, id:string):{title:string;body:string;submitLabel:string} {
  const a=g.actions.find(x=>x.id===id);
  const kind=confirmKind(id);
  if(kind==='season'){
    return {title:'结束本季',submitLabel:'确认结束本季',body:`<p>按当前已经发生的安排结算生活消耗、生产和恢复。天气等变化只在结算后出现。下面是现在能看见的条件，不是对下一季粮钱健康的精确预言。</p><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  if(kind==='era'&&g.era){
    const e=g.era,p=e.projection;
    return {title:'结算当前社会',submitLabel:'确认结算',body:`<p>这会结束本季并进入下一社会。若当前已是现代，结算即结束这次旅程。预估会受当季实际结果影响，最终金额以结算事件为准。</p><ul class="check-list"><li>现在结算预计兑现 ${e.expectedReward} 钱</li><li>已取得回报凭证 ${e.rewardClaims} 份；剩余 ${p.remaining} 季推算 ${p.claims} 份</li>${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')}${e.electricRewardPercent!==undefined?`<li>当前回报比例 ${e.electricRewardPercent}%。${esc(e.electricRequirement??'')}</li>`:''}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  if(kind==='retire'&&g.life){
    const l=g.life;
    return {title:'安排季末交接',submitLabel:'确认安排交接',body:`<p>提交后只是安排本季结束后交接，不会立刻换成后辈。</p><ul class="check-list"><li>${l.heir?`后辈 ${l.heir.ageYears} 岁，成年线 ${l.adultYears} 岁，${l.heir.alive?'在世':'已故'}`:'尚无后辈'}</li><li>家族实物、记录和雇员状态会保留</li><li>后辈的个人知识不会自动复制，仍需学习</li>${g.economy?.operationsView?`<li>${g.economy.operationsView.charter?'当前观察：经营安排会自动接续':'当前观察：换代后经营安排将暂停，需一次接续'}</li>`:''}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  return {title:a?.label??'确认行动',submitLabel:'确认提交',body:`<p>${esc(a?.description??'提交后按现行规则结算。')}</p>`};
}

function foodWarning(g:Game):boolean {
  const e=g.economy!;
  return g.socialFood?g.socialFood.missing>0:e.foodTotal<g.parameters.foodPerTurn;
}

export function farm(g:Game,button:Button):string {
  const e=g.economy!,f=e.field;
  const crop=f.crop?CROPS[f.crop].name:'空田';
  const phase=!f.crop?'空田':f.growth>=f.duration?'已成熟':'生长中';
  return panel('家庭田地', `<p>${esc(crop)} · ${phase} · 生长 ${f.growth}/${f.duration} 季</p><div class="farm-stats">${meter('生长进度',f.growth,f.duration)}${meter('肥力',f.fertility,3)}<div class="mini-stat"><span>水分补充</span><strong class="num">${f.moisture}</strong></div><div class="mini-stat"><span>预计收成</span><strong class="num">${f.crop?e.harvest:'—'}</strong></div><div class="mini-stat"><span>持续耕作</span><strong>${e.ongoing?.farm?CROPS[e.ongoing.farm].name:'未安排'}</strong></div></div><p class="subtle">预计收成随天气与田地条件变化，不是已经到手的粮食。</p><div class="action-grid">${g.actions.filter(a=>a.group==='农业').map(a=>button(a.id)).join('')}</div><details><summary>耕作说明</summary><p>可安排持续耕作：季末自动收获并复种，不必每季再点。种子单独留存；缺种子时停在空田。供水系统负责缺水季，不代替收获。</p></details>`);
}

function successionState(g:Game):string {
  const l=g.life; if(!l)return '';
  if(g.status==='ended')return '家族经营已经结束。';
  if(g.status==='complete')return g.victory?.won?'旅程已经胜利结束。':'旅程已经结束。';
  if(g.status==='handover')return '本季已结束，后辈可以接手。人物尚未切换。';
  if(!l.heir)return '尚未有后辈。满 30 岁且尚无子嗣时迎来新生后辈。';
  if(!l.heir.alive)return '后辈已故，当前不可继任。';
  if(l.heir.ageYears<l.adultYears)return `后辈尚未成年（${l.heir.ageYears} / ${l.adultYears} 岁）。`;
  if(l.pendingRetirement)return '已安排季末交接。结束本季后才会真正换人。';
  return '后辈已成年，可以安排季末交接。';
}

function knownNames(g:Game, heir=false):string {
  const b=g.economy?.branchView;
  if(b)return b.nodes.filter(n=>heir?n.heirKnown:n.known).map(n=>n.name).join('、')||'尚未掌握课程';
  const list=heir?g.heir.mastered:g.person.mastered;
  return list.length?list.join('、'):'尚未掌握课程';
}

function family(g:Game,button:Button):string {
  const l=g.life; if(!l)return '';
  const person=(who:'self'|'heir')=>{
    const p=who==='self'?l.person:l.heir;
    if(!p)return `<article class="person-card"><h3>后辈</h3><p>尚未有后辈。</p></article>`;
    const name=who==='self'?g.person.name:g.heir.name;
    return `<article class="person-card"><h3>${esc(name)} <small>${p.ageYears} 岁 · ${p.alive?'在世':'已故'}</small></h3><p><span class="tag">${esc(p.talent.name)}</span> ${esc(p.talent.effect)}</p>${meter('健康',p.health,p.maxHealth??100,'health')}${meter('精力',p.energy,p.maxEnergy,'energy')}<p class="subtle">已知学习：${esc(knownNames(g,who==='heir'))}</p></article>`;
  };
  return `<div class="person-spread">${person('self')}${person('heir')}</div>
    <div class="succession-box"><h3>交接</h3><p>${esc(successionState(g))}</p>
    <p>家族实物和记录会保留；后辈仍要亲自学习。安排交接不会立刻切换人物。</p>
    ${g.economy?.operationsView?`<p class="subtle">${g.economy.operationsView.charter?'当前观察：经营安排会自动接续。':'当前观察：换代后经营安排将暂停，需一次接续。'}</p>`:''}
    <div class="action-primary">${button('economy:retire:family')}</div>
    <div class="compact-actions">${button('economy:rest:self')}${button('economy:care:self')}</div></div>`;
}

function nextSteps(g:Game,button:Button):string {
  const e=g.economy!,items:string[]=[];
  if(!e.field.crop)items.push(`<button type="button" data-page="农业">田地空着，去播种</button>`);
  else if(e.field.growth>=e.field.duration)items.push(`<button type="button" data-page="农业">${esc(CROPS[e.field.crop].name)}已成熟，可以收获</button>`);
  else items.push(`<button type="button" data-page="农业">${esc(CROPS[e.field.crop].name)}生长中 ${e.field.growth}/${e.field.duration} 季</button>`);
  if(foodWarning(g))items.push(`<button type="button" data-page="生活">${g.socialFood?`生活缺口 ${g.socialFood.missing} 份，查看购粮`:'可食储备低于季耗，去安排生活'}</button>`);
  items.push(`<button type="button" data-page="家人">查看身体与传承</button>`);
  const acts=g.actions.filter(a=>a.enabled&&['农业','生活'].includes(a.group)&&!confirmKind(a.id)).slice(0,2);
  for(const a of acts)items.push(button(a.id));
  return `<div class="next-steps">${items.slice(0,5).join('')}</div><p class="subtle">这些是当前能看见的入口，不是评分后的最优建议。</p>`;
}

function village(g:Game):string {
  const e=g.economy!,l=g.life,f=e.field;
  const crop=f.crop?CROPS[f.crop].name:'尚未播种';
  return `<section class="overview-intro">
    <p class="chapter-kicker">${esc(g.person.name)} · ${esc(g.scenario.name)}</p>
    <h2>这一季，先把日子看清楚</h2>
    <p>田里${f.crop?`种着${esc(crop)}，${f.growth>=f.duration?'已经成熟':`生长 ${f.growth}/${f.duration} 季`}`:'还是空田'}。可食储备 ${e.foodTotal}，季耗 ${g.parameters.foodPerTurn}${g.socialFood?`；预计购粮 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱，生活缺口 ${g.socialFood.missing} 份`:''}。家中没有存粮不等于已经断粮，要看预计购粮和缺口。</p>
    ${l?`<p>可用时间 ${l.budget.freeTime} / ${l.timePerSeason}，可用精力 ${l.budget.freeEnergy}。${successionState(g)}</p>`:''}
  </section>
  ${panel('田地摘要', `<p>${esc(crop)} · 肥力 ${f.fertility}/3 · 水分 ${f.moisture} · 预计收成 ${f.crop?e.harvest:'—'}</p><button type="button" data-page="农业">打开田地</button>`)}`;
}

function inventory(g:Game):string {
  const e=g.economy!;
  const rows=Object.entries(e.goods).filter(([,n])=>n>0).map(([id,n])=>`<div class="inventory-item"><span>${esc(ALL_GOODS[id]?.name??id)}</span><strong class="num">${n}</strong></div>`).join('')||'<p>暂无物资</p>';
  return panel('仓库',`<div class="inventory-grid">${rows}</div><p class="subtle">即食粮 ${g.family.food}；保存保护容量 ${e.storage}。面粉、小麦、大豆依序补生活缺口；种子不当饭吃。</p>`);
}

function attention(g:Game,page:string,button:Button):string {
  const e=g.economy!,l=g.life;
  if(page==='聚落')return `<h3>当下关注</h3>${foodWarning(g)?`<p class="blocked-reason">${g.socialFood?'当前库存与预计购粮还补不上本季消耗。':'可食储备低于季耗。'}</p>`:'<p>口粮安排暂时看得过去，仍以行动后的真实结算为准。</p>'}<h3>接下来可做什么</h3>${nextSteps(g,button)}`;
  if(page==='农业'){
    const f=e.field;
    const note=!f.crop?'空田需要播种或安排持续耕作。':f.growth>=f.duration?'作物已成熟，收获才会变成实际收成。':'作物还在生长，预计收成不是库存。';
    return `<h3>田地状况</h3><p>${esc(note)}</p><div class="action-primary">${g.actions.filter(a=>a.group==='农业'&&a.enabled).slice(0,1).map(a=>button(a.id)).join('')||'<p class="subtle">当前没有可执行的田间行动。</p>'}</div><p><button type="button" class="text-btn" data-page="生活">去生活安排</button><button type="button" class="text-btn" data-page="仓库">去仓库</button></p>`;
  }
  if(page==='生活')return `<h3>生活缺口</h3>${g.socialFood?`<p>政策 ${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱 · 缺口 ${g.socialFood.missing} 份</p>${g.socialFood.reasons.map(r=>`<p class="blocked-reason">${esc(r)}</p>`).join('')}`:`<p>可食储备 ${e.foodTotal} / 季耗 ${g.parameters.foodPerTurn}</p>`}<p><button type="button" class="text-btn" data-page="商城">去集市</button></p>`;
  if(page==='家人')return `<h3>身体与交接</h3><p>${esc(successionState(g))}</p><div class="compact-actions">${button('economy:rest:self')}${button('economy:care:self')}</div>`;
  if(page==='仓库')return `<h3>口粮与保存</h3><p>即食粮 ${g.family.food} · 可食储备 ${e.foodTotal} · 保护容量 ${e.storage}</p><p class="subtle">超出保护容量的物资可能发生保存损耗。种子不当饭吃。</p><p><button type="button" class="text-btn" data-page="生活">去生活安排</button></p>`;
  if(l)return `<h3>本季余量</h3><p>可用时间 ${l.budget.freeTime} / ${l.timePerSeason}<br>可用精力 ${l.budget.freeEnergy}</p>`;
  return `<h3>当下关注</h3><p>选择一项后，这里会显示条件和报价。</p>`;
}

const OWN_SPREAD=new Set(['学科','产品','生产','系统','雇佣','商城','能源','社会','家业','作坊','副本','试炼']);

export function energyPage(g:Game,button:Button,selectedId=''):string {
  const e=g.economy!,m=e.modern; if(!m)return '';
  const ev=e.electricView;
  const ids=['E01','E02','E03','E04','N08','N10','S08','U08M','U09M','LAMP','TELEGRAPH','ELECTROLYZER'];
  const devices=e.products.filter(p=>ids.includes(p.id));
  const selected=devices.find(p=>p.id===selectedId)??devices[0];
  const installed=(id:string)=>(e.equipment[id]??0)>0;
  const enabled=(id:string)=>m.enabled.includes(id);
  const ran=(id:string)=>m.services[id]===g.clock.absoluteTurn?'本季在线':m.operated[id]===g.clock.absoluteTurn?'本季已运行':'本季尚未运行';
  const tile=devices.map(p=>`<button type="button" class="select-tile ${selected?.id===p.id?'selected':''}" data-device="${p.id}" aria-pressed="${selected?.id===p.id}"><strong>${esc(p.name)}</strong><small>${installed(p.id)?`已安装 · 耐用 ${e.equipment[p.id]??0}`:'未安装'} · ${enabled(p.id)?'已启用':'未启用'} · ${ran(p.id)}</small></button>`).join('');
  const detail=selected?`<div class="inspector-head"><span>${installed(selected.id)?'已安装':'未安装'}</span></div>
    <h3>${esc(selected.name)}</h3>
    <p>${esc(selected.effect)}</p>
    <div class="device-state"><span class="tag">${installed(selected.id)?`耐用 ${e.equipment[selected.id]??0}`:'尚未安装'}</span><span class="tag">${enabled(selected.id)?'已启用':'未启用'}</span><span class="tag">${ran(selected.id)}</span></div>
    <p class="subtle">启用只改变安排，不会立刻发电。本季是否真正运行，要看供能行动之后的观察。</p>
    <div class="inspector-action">${selected.id==='ELECTROLYZER'?button('economy:process:aluminium'):button('economy:utility:'+selected.id+'-'+(enabled(selected.id)?'off':'on'))}</div>`:'<p>当前没有可管理的供能设备。</p>';
  return `<div class="workbench-toolbar"><p>可用电力 <strong class="num">${m.power}</strong>${ev?` · 水电本季产能 <strong class="num">${ev.hydroOutput}</strong>（随天气）`:''} · 跨季储能 <strong class="num">${m.stored}</strong></p></div>
    <p>${ev?esc(ev.description):'启停不产电；本人需要提前用电时执行本季供能。'}${ev?' 未储存的余电会在季末耗散，不是所有电力都无法保留。':''} 季末不会自动发电。</p>
    <div class="action-primary">${button('economy:energize:now')}</div>
    <div class="page-workbench"><section><div class="library-heading"><h3>设备</h3><span>安装、启用、本季运行是三种状态</span></div><div class="lesson-grid">${tile||'<p>暂无相关设备。</p>'}</div></section><aside class="course-inspector">${detail}</aside></div>`;
}

function endingCopy(g:Game):string {
  if(g.status==='ended')return '家族经营终止。没有可接手的成年后辈，或经营已经失败。可以从底部导出这次旅程。';
  if(g.status==='complete'&&g.victory?.won)return '旅程胜利。完成条件以结算事件为准，不是只因为进度条满或拥有电器。';
  if(g.status==='complete')return '旅程已经结束。若未完成最终副本，这不是通关胜利。';
  return '观察期结束。可以从底部导出这次旅程。';
}

export function humanScreen(g:Game,page:string,body:string,button:Button,events:string[],guide=false,recap:Recap|null=null):string {
  const e=g.economy!,l=g.life,end=g.status==='complete'||g.status==='ended';
  const groups=playerGroups(g),group=groups.find(x=>x.pages.includes(page))??groups[0];
  const low=foodWarning(g);
  const masthead=`<header class="chronicle-masthead"><div><div class="eyebrow">CIVILIZATION MINI</div><h1>世代 <span>家族编年史</span></h1><p class="rule-line">规则 ${esc(g.rulesVersion)} · ${esc(g.scenario.name)}</p></div><div class="masthead-meta"><div>${l?esc(g.person.name):'当前家族'}${g.era?` · ${esc(g.era.stage.name)}`:''}</div><div class="masthead-links"><a class="text-btn" href="/start">旅程与存档</a><button type="button" class="text-btn" data-guide="${esc(page)}">帮助</button></div></div></header>`;
  const nav=`<nav class="chapter-nav" aria-label="篇章">${groups.map(x=>`<button type="button" class="chapter-tab" data-page="${x.pages.includes(page)?page:x.pages[0]}" aria-current="${x===group?'page':'false'}">${esc(x.name)}</button>`).join('')}</nav>
    ${group.pages.length>1?`<nav class="chapter-subnav" aria-label="${esc(group.name)}分页">${group.pages.map(p=>`<button type="button" data-page="${p}" class="${page===p?'selected':''}" aria-current="${page===p?'page':'false'}">${placeIcon(p)}<span>${pageNames[p]??p}</span></button>`).join('')}</nav>`:''}`;
  const hud=`<section class="player-hud"><div class="season-card"><small>第 ${g.clock.generation} 代</small><strong>${l?`第 ${l.calendar.year} 年 · ${l.calendar.season}`:`第 ${g.clock.turn} 季`}</strong><span>${esc(g.world.weatherName)}</span></div><div class="hud-item"><span>可用时间 / 总预算</span><strong class="num">${l?l.budget.freeTime:g.ap}<small> / ${l?l.timePerSeason:g.parameters.actionsPerTurn}</small></strong></div><div class="hud-item"><span>可用精力</span><strong class="num">${l?l.budget.freeEnergy:'—'}</strong></div><div class="hud-item ${low?'resource-warning':''}"><span>可食储备 / 季耗${g.socialFood?` · 预计购 ${g.socialFood.purchase}`:''}</span><strong class="num">${e.foodTotal}<small> / ${g.parameters.foodPerTurn}</small></strong></div><div class="hud-item"><span>钱财</span><strong class="num">${g.family.money}</strong></div></section>`;
  const recapHtml=recap?`<section class="chapter-recap" aria-live="polite"><h2>${esc(recap.title)}</h2>${recap.lines.map(t=>`<p>${esc(t)}</p>`).join('')}<button type="button" class="text-btn" data-dismiss-recap>关闭回顾</button></section>`:'';
  const main=guide?ruleGuide(g,page):page==='聚落'?village(g):page==='家人'?family(g,button):page==='仓库'?inventory(g):body;
  const spread=guide||OWN_SPREAD.has(page)?main:`<div class="spread-body"><div class="reading-pane">${main}</div><aside class="attention-pane">${attention(g,page,button)}</aside></div>`;
  const budget=l?`<details class="budget-details"><summary>查看本季劳动安排 · 预留 ${l.budget.reservedTime} 时间 / ${l.budget.reservedEnergy} 精力</summary><p>已用时间 ${l.budget.spentTime} · 剩余时间 ${l.timeRemaining}</p>${l.budget.tasks.map(t=>`<p>${esc(t.name)} <span class="tag">时间 ${t.time} / 精力 ${t.energy}</span></p>`).join('')||'<p>暂无系统任务</p>'}</details>`:'';
  const season=end?`<div><h3>${g.status==='ended'?'家族经营终止':g.victory?.won?'旅程胜利':'旅程结束'}</h3><p>${esc(endingCopy(g))}</p><p><a class="text-btn" href="/start">回到开始界面</a></p></div>`:g.status==='handover'?`<div><h3>后辈接手</h3><p>本季已结束。提交交接后才会换成后辈继续经营。</p></div><div class="action-primary">${button('handover')}</div>`:`<div><h3>季末检查</h3><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul><p class="subtle">确认后才提交结束本季。没有观察支持的未来精确值不会写在这里。</p></div><div class="action-primary">${button('economy:end:season')}</div>${budget}`;
  return `<div class="chronicle-shell">${masthead}${nav}${hud}${g.era&&page!=='社会'?`<div class="notice-bar"><button type="button" data-page="社会">${esc(g.era.stage.name)} · ${esc(g.era.card.name)} · 剩余${g.era.remaining}季 · 现在结算约${g.era.expectedReward}钱</button></div>`:''}${low?'<div class="food-alert" role="status">当前库存与预计购粮不足以覆盖本季消耗。<button type="button" data-page="农业">去田地</button><button type="button" data-page="商城">买补给</button><button type="button" data-page="生活">找生计</button></div>':''}<div class="chronicle-spread">${recapHtml}<header class="chapter-head"><p class="chapter-kicker">${esc(group.name)} · ${esc(g.person.name)}${g.era?` · ${esc(g.era.stage.name)}`:''}</p><p class="chapter-epigraph">${esc(chapterEpigraph(g,page))}</p><div class="section-heading"><div><p class="breadcrumb">${esc(group.name)}${page!==group.pages[0]?' / '+(pageNames[page]??page):''}</p><h2>${pageNames[page]??page}</h2></div>${!guide?`<button type="button" class="text-btn" data-guide="${esc(page)}">${pageNames[page]??page}规则</button>`:''}</div></header>${spread}<section class="event-log" aria-live="polite"><h3>最近记事</h3>${events.length?events.slice(-3).map(t=>`<p>${esc(t)}</p>`).join(''):'<p>一家人从一块田开始。先安排口粮，再发展技艺。这是最近可见的事件，不是完整跨代档案。</p>'}${events.length>3?`<details><summary>查看本次全部变化</summary>${events.map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}</section><div class="season-bar">${season}</div></div></div>`;
}
