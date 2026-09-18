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
  return `<span>时间 ${time}</span>${g.life?`<span>精力 ${a.energy??0}</span>`:''}${a.money?`<span>钱 ${a.money}</span>`:''}${a.food?`<span>粮 ${a.food}</span>`:''}`;
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
  return `<div class="action-option"><button type="button" class="game-action" data-action="${esc(id)}"${kind?` data-confirm="${kind}"`:''} ${!a.enabled||failed?'disabled':''}><span class="action-name">${esc(a.label)}</span><span class="action-cost">${costChips(g,a)}</span></button>${!a.enabled?`<p class="blocked-reason">${esc(a.reason??'暂不可用')}</p>`:`<details class="action-help" data-fold="${esc(id)}"><summary>行动详情</summary><p class="action-note">${esc(a.description)}</p></details>`}</div>`;
}

function successionWork(g:Game):string {
  const e=g.economy!;
  if(e.industryView){
    const self=e.industryView.systems.filter(s=>s.instance?.operator==='self').map(s=>s.name);
    return `设备与人员安排保留。${self.length?`交接后，本人负责的${self.join('、')}会停用，需由新经营者重新安排。`:'交接后请核对各系统的操作人员与劳动预算。'}`;
  }
  const o=e.operationsView;
  return o?(o.charter?'经营安排会自动接续。':'经营安排会暂停，后辈接手后需接续。'):'';
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
    return {title:'结束本季',submitLabel:'确认结束本季',body:`<p>结算生产、口粮与身体恢复，进入下一季。</p><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a?`<details><summary>结算详情</summary><p>${esc(a.description)}</p></details>`:''}`};
  }
  if(kind==='era'&&g.era){
    const e=g.era,p=e.projection;
    return {title:'结算当前社会',submitLabel:'确认结算',body:`<p>这会结束本季并进入下一社会。若当前已是现代，结算即结束这次旅程。预估会受当季实际结果影响，最终金额以结算事件为准。</p><ul class="check-list"><li>现在结算预计兑现 ${e.expectedReward} 钱</li><li>已取得回报凭证 ${e.rewardClaims} 份；剩余 ${p.remaining} 季推算 ${p.claims} 份</li>${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')}${e.electricRewardPercent!==undefined?`<li>当前回报比例 ${e.electricRewardPercent}%。${esc(e.electricRequirement??'')}</li>`:''}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  if(kind==='retire'&&g.life){
    const l=g.life;
    return {title:'安排季末交接',submitLabel:'确认安排交接',body:`<p>本季结束后，再由成年后辈接手。</p><ul class="check-list"><li>${l.heir?`后辈 ${l.heir.ageYears} 岁，成年线 ${l.adultYears} 岁，${l.heir.alive?'在世':'已故'}`:'尚无后辈'}</li><li>家族实物、记录和员工经验保留</li><li>后辈的个人知识仍需学习</li><li>${esc(successionWork(g))}</li></ul>`};
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
  if(l.pendingRetirement)return '已安排季末交接。结束本季后，由后辈接手。';
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
    <p class="subtle">${esc(successionWork(g))}</p>
    <div class="action-primary">${button('economy:retire:family')}</div>
    <div class="compact-actions">${button('economy:rest:self')}${button('economy:care:self')}</div></div>`;
}

function village(g:Game,events:string[]):string {
  const e=g.economy!,l=g.life,f=e.field,food=g.socialFood;
  const tasks:{title:string;detail:string;page:string}[]=[];
  if(foodWarning(g))tasks.push({title:'本季口粮不足',detail:`还缺 ${food?.missing??Math.max(0,g.parameters.foodPerTurn-e.foodTotal)} 份口粮`,page:'生活'});
  if(!f.crop)tasks.push({title:'田地还空着',detail:'选择作物，安排这一季的耕作。',page:'农业'});
  else if(f.growth>=f.duration)tasks.push({title:'作物成熟待收',detail:`${CROPS[f.crop].name}已经成熟，及时收获。`,page:'农业'});
  for(const system of e.industryView?.systems??[])if(system.instance&&system.blockers.length)tasks.push({title:system.name+'待处理',detail:system.blockers.join('；'),page:'系统'});
  if(l?.pendingRetirement||g.status==='handover')tasks.push({title:'等待家族交接',detail:successionState(g),page:'家人'});
  const fieldTitle=!f.crop?'空田待播':f.growth>=f.duration?'成熟待收':CROPS[f.crop].name+'生长中';
  const time=l?.budget;
  const total=Math.max(1,l?.timePerSeason??g.parameters.actionsPerTurn);
  const history=events.length?events.slice(-3):['一家人从一块田开始。'];
  return `<div class="season-dashboard"><div class="dashboard-main">
    <section class="estate-board"><div class="estate-copy"><span class="chapter-kicker">家里的田地</span><h3>${fieldTitle}</h3><p>肥力 ${f.fertility}/3 · ${f.crop?`生长 ${f.growth}/${f.duration} 季`:'尚未播种'}</p>${f.crop?`<p>预计收成 ${e.harvest} · 水分 ${f.moisture}</p>`:''}<button type="button" data-page="农业">去田地 →</button></div><div class="painted-art art-home" aria-hidden="true"></div></section>
    <div class="dashboard-pair"><section class="dashboard-card food-board"><div class="painted-art art-food" aria-hidden="true"></div><h3>生活保障</h3><span class="status-pill ${foodWarning(g)?'status-warning':''}">${foodWarning(g)?'需要补给':'本季够吃'}</span><p class="board-number">${e.foodTotal}<small>份可食储备</small></p><p>季耗 ${g.parameters.foodPerTurn} 份</p><dl class="board-ledger"><div><dt>预计购粮</dt><dd>${food?.purchase??0} 份</dd></div><div><dt>预计花费</dt><dd>${food?.cost??0} 钱</dd></div><div><dt>生活缺口</dt><dd>${food?.missing??Math.max(0,g.parameters.foodPerTurn-e.foodTotal)} 份</dd></div></dl><button class="text-btn" type="button" data-page="生活">调整生活安排 →</button></section>
    <section class="dashboard-card family-board"><h3>家人与成长</h3><div class="painted-art art-family" aria-hidden="true"></div><div class="family-snapshot"><div><strong>经营者${l?` · ${l.person.ageYears}岁`:''}</strong>${l?meter('健康',l.person.health,l.person.maxHealth??100):''}</div><div><strong>${l?.heir?`后辈 · ${l.heir.ageYears}岁`:'尚无后辈'}</strong>${l?.heir?meter(l.heir.alive?'健康':'已故',l.heir.health,l.heir.maxHealth??100):''}</div></div><button class="text-btn" type="button" data-page="家人">查看家人 →</button></section></div>
    ${e.industryView?.systems.some(x=>x.instance)?`<section class="dashboard-card"><h3>家业运行</h3><div class="board-ledger">${e.industryView.systems.filter(x=>x.instance).map(x=>`<div><span>${esc(x.name)}</span><span>${!x.instance?.enabled?'已停用':x.blockers.length?'条件不足':x.instance?.operator?'已安排人员':'待安排'}</span></div>`).join('')}</div><button type="button" class="text-btn" data-page="系统">管理生产 →</button></section>`:''}
    </div><aside class="dashboard-side"><section class="dashboard-card"><h3>等你安排 <span class="task-count">${tasks.length}</span></h3>${tasks.length?tasks.map(t=>`<article class="board-task"><strong>${esc(t.title)}</strong><p>${esc(t.detail)}</p><button type="button" data-page="${t.page}">去处理 →</button></article>`).join(''):'<p class="subtle">当前没有待处理事项。</p>'}<h3 class="time-heading">时间安排</h3><div class="time-track" aria-hidden="true"><span style="width:${Math.min(100,(time?.spentTime??0)/total*100)}%"></span><span style="width:${Math.min(100,(time?.reservedTime??0)/total*100)}%"></span></div><p class="time-labels">已用 ${time?.spentTime??0} · 预留 ${time?.reservedTime??0} · 可用 ${time?.freeTime??g.ap}</p></section><section class="dashboard-card"><h3>最近记事</h3><ol class="board-history">${history.map(t=>`<li>${esc(t)}</li>`).join('')}</ol>${events.length>3?`<details><summary>全部变化</summary>${events.map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}</section></aside></div>`;
}

function pageArt(page:string):string {
  if(['学科'].includes(page))return 'study';
  if(['制造','系统','雇佣','作坊','家业'].includes(page))return 'workshop';
  if(page==='能源')return 'power';
  if(page==='家人')return 'family';
  if(['生活','商城','仓库'].includes(page))return 'food';
  return 'home';
}

function inventory(g:Game):string {
  const e=g.economy!;
  const rows=Object.entries(e.goods).filter(([,n])=>n>0).map(([id,n])=>`<div class="inventory-item"><span>${esc(ALL_GOODS[id]?.name??id)}</span><strong class="num">${n}</strong></div>`).join('')||'<p>暂无物资</p>';
  return panel('仓库',`<div class="inventory-grid">${rows}</div><p class="subtle">即食粮 ${g.family.food}；保存保护容量 ${e.storage}。面粉、小麦、大豆依序补生活缺口；种子不当饭吃。</p>`);
}

function attention(g:Game,page:string,button:Button):string {
  const e=g.economy!,l=g.life;
  if(page==='农业'){
    const f=e.field;
    const note=!f.crop?'空田需要播种或安排持续耕作。':f.growth>=f.duration?'作物已成熟，收获才会变成实际收成。':'作物还在生长，预计收成不是库存。';
    return `<h3>田地状况</h3><p>${esc(note)}</p><div class="action-primary">${g.actions.filter(a=>a.group==='农业'&&a.enabled).slice(0,1).map(a=>button(a.id)).join('')||'<p class="subtle">当前没有可执行的田间行动。</p>'}</div><p><button type="button" class="text-btn" data-page="生活">去生活安排</button><button type="button" class="text-btn" data-page="仓库">去仓库</button></p>`;
  }
  if(page==='生活')return `<h3>生活缺口</h3>${g.socialFood?`<p>政策 ${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱 · 缺口 ${g.socialFood.missing} 份</p>${g.socialFood.reasons.map(r=>`<p class="blocked-reason">${esc(r)}</p>`).join('')}`:`<p>可食储备 ${e.foodTotal} / 季耗 ${g.parameters.foodPerTurn}</p>`}<p><button type="button" class="text-btn" data-page="商城">去集市</button></p>`;
  if(page==='仓库')return `<h3>口粮与保存</h3><p>即食粮 ${g.family.food} · 可食储备 ${e.foodTotal} · 保护容量 ${e.storage}</p><p class="subtle">超出保护容量的物资可能发生保存损耗。种子不当饭吃。</p><p><button type="button" class="text-btn" data-page="生活">去生活安排</button></p>`;
  if(l)return `<h3>本季余量</h3><p>可用时间 ${l.budget.freeTime} / ${l.timePerSeason}<br>可用精力 ${l.budget.freeEnergy}</p>`;
  return `<h3>当下关注</h3><p>选择一项后，这里会显示条件和报价。</p>`;
}

const OWN_SPREAD=new Set(['聚落','家人','学科','制造','系统','雇佣','商城','能源','社会','家业','作坊','副本','试炼']);

export function energyPage(g:Game,button:Button,selectedId=''):string {
  const e=g.economy!,m=e.modern; if(!m)return '';
  const ev=e.electricView;
  const ids=['E01','E02','E03','E04','N08','N10','S08','U08M','U09M','LAMP','TELEGRAPH','ELECTROLYZER'];
  const devices=e.products.filter(p=>ids.includes(p.id));
  const selected=devices.find(p=>p.id===selectedId)??devices[0];
  const installed=(id:string)=>e.equipment[id]!==undefined;
  const condition=(id:string)=>!installed(id)?'未安装':e.equipment[id]<=0?'已安装 · 耐用耗尽，需维修':`已安装 · 耐用 ${e.equipment[id]}`;
  const enabled=(id:string)=>m.enabled.includes(id);
  const mode=(id:string)=>id==='ELECTROLYZER'?'按批加工，无需启停':enabled(id)?'已启用':'未启用';
  const ran=(id:string)=>m.services[id]===g.clock.absoluteTurn?'本季在线':m.operated[id]===g.clock.absoluteTurn?'本季已运行':'本季尚未运行';
  const tile=devices.map(p=>`<button type="button" class="select-tile ${selected?.id===p.id?'selected':''}" data-device="${p.id}" aria-pressed="${selected?.id===p.id}"><strong>${esc(p.name)}</strong><small>${condition(p.id)} · ${mode(p.id)} · ${ran(p.id)}</small></button>`).join('');
  const detail=selected?`<div class="inspector-head"><span>${installed(selected.id)?'已安装':'未安装'}</span></div>
    <h3>${esc(selected.name)}</h3>
    <p>${esc(selected.effect)}</p>
    <div class="device-state"><span class="tag">${condition(selected.id)}</span><span class="tag">${mode(selected.id)}</span><span class="tag">${ran(selected.id)}</span></div>
    <p class="subtle">${selected.id==='ELECTROLYZER'?'电解按批消耗原料、电力与耐用。':'启用后，还需执行本季供能。'}</p>
    ${installed(selected.id)&&e.equipment[selected.id]<=0?'<button type="button" class="text-btn" data-page="商城">前往集市维修 →</button>':''}
    <div class="inspector-action">${selected.id==='ELECTROLYZER'?button('economy:process:aluminium'):button('economy:utility:'+selected.id+'-'+(enabled(selected.id)?'off':'on'))}</div>`:'<p>当前没有可管理的供能设备。</p>';
  return `<div class="workbench-toolbar"><p>可用电力 <strong class="num">${m.power}</strong>${ev?` · 水电本季产能 <strong class="num">${ev.hydroOutput}</strong>（随天气）`:''} · 跨季储能 <strong class="num">${m.stored}</strong></p></div>
    <p>${ev?esc(ev.description):'启停不产电；本人需要提前用电时执行本季供能。'}${ev?' 未储存的余电会在季末耗散，不是所有电力都无法保留。':''} 季末不会自动发电。</p>
    <div class="action-primary">${button('economy:energize:now')}</div>
    <div class="page-workbench"><section><div class="library-heading"><h3>设备</h3><span>安装、启用、本季运行是三种状态</span></div><div class="lesson-grid">${tile||'<p>暂无相关设备。</p>'}</div></section><aside class="course-inspector">${detail}</aside></div>`;
}

function endingCopy(g:Game):string {
  if(g.status==='ended')return '家族经营终止。没有可接手的成年后辈，或经营已经失败。可以从底部导出这次旅程。';
  if(g.status==='complete'&&g.victory?.won)return '最终试炼已完成，家族旅程胜利结束。';
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
  const main=guide?ruleGuide(g,page):page==='聚落'?village(g,events):page==='家人'?family(g,button):page==='仓库'?inventory(g):body;
  const spread=guide||OWN_SPREAD.has(page)?main:`<div class="spread-body"><div class="reading-pane">${main}</div><aside class="attention-pane">${attention(g,page,button)}</aside></div>`;
  const budget=l?`<details class="budget-details"><summary>查看本季劳动安排 · 预留 ${l.budget.reservedTime} 时间 / ${l.budget.reservedEnergy} 精力</summary><p>已用时间 ${l.budget.spentTime} · 剩余时间 ${l.timeRemaining}</p>${l.budget.tasks.map(t=>`<p>${esc(t.name)} <span class="tag">时间 ${t.time} / 精力 ${t.energy}</span></p>`).join('')||'<p>暂无系统任务</p>'}</details>`:'';
  const season=end?`<div><h3>${g.status==='ended'?'家族经营终止':g.victory?.won?'旅程胜利':'旅程结束'}</h3><p>${esc(endingCopy(g))}</p><p><a class="text-btn" href="/start">回到开始界面</a></p></div>`:g.status==='handover'?`<div><h3>后辈接手</h3><p>本季已结束。提交交接后才会换成后辈继续经营。</p></div><div class="action-primary">${button('handover')}</div>`:`<div><h3>季末检查</h3><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="action-primary">${button('economy:end:season')}</div>${budget}`;
  return `<div class="chronicle-shell page-${pageArt(page)} ${page==='聚落'?'is-dashboard':''}">${masthead}${nav}${hud}${g.era&&page!=='社会'?`<div class="era-link"><span>${esc(g.era.card.name)} · 剩余 ${g.era.remaining} 季</span><button type="button" class="text-btn" data-page="社会">社会历程 · 预计回报 ${g.era.expectedReward} 钱 →</button></div>`:''}${low?'<div class="food-alert" role="status">当前库存与预计购粮不足以覆盖本季消耗。<button type="button" data-page="农业">去田地</button><button type="button" data-page="商城">买补给</button><button type="button" data-page="生活">找生计</button></div>':''}<div class="chronicle-spread">${recapHtml}<header class="chapter-head ${page!=='聚落'?'illustrated-heading':''}">${page!=='聚落'?`<div class="painted-art art-${pageArt(page)}" aria-hidden="true"></div>`:''}<div class="section-heading"><div><h2>${page==='聚落'?'本季看板':pageNames[page]??page}</h2><p class="chapter-epigraph">${esc(chapterEpigraph(g,page))}</p></div>${!guide?`<button type="button" class="text-btn" data-guide="${esc(page)}">${pageNames[page]??page}规则</button>`:''}</div></header>${spread}<section ${page==='聚落'?'hidden':''} class="event-log" aria-live="polite"><h3>最近记事</h3>${events.length?events.slice(-3).map(t=>`<p>${esc(t)}</p>`).join(''):'<p>一家人从一块田开始。先安排口粮，再发展技艺。</p>'}${events.length>3?`<details><summary>查看本次全部变化</summary>${events.map(t=>`<p>${esc(t)}</p>`).join('')}</details>`:''}</section><div class="season-bar">${season}</div></div></div>`;
}
