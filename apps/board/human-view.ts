
import {artUrl,itemImage,chromeImage,sectImage,encounterCard} from './illustration.js';
import {uiIcon,placeIcon} from './ui-icons.js';
import {pageNames,playerGroups,ruleGuide,chapterEpigraph,stageModules,stageModulePage} from './player-guide.js';
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
  const icon=id.includes('sectpractice')?'meditate':id.includes('sectimprove')?'book':id.includes('sectteach')?'book':id.includes('sectswitch')?'motion':id.includes('sectseek')||id.includes('sectadmit')?'people':id.includes('sectdraw')?'seal':kind==='handover'||kind==='retire'?'seal':'';
  const picture=g.sect?(id.includes('sectpractice')?1:id.includes('sectimprove')?10:id.includes('sectteach')?0:id.includes('sectseek')?13:id.includes('sectadmit')?14:id.includes('sectdraw')?11:id==='economy:rest:self'||id==='economy:care:self'?12:kind==='handover'||kind==='retire'?11:null):null;
  return `<div class="action-option"><button type="button" class="game-action" data-action="${esc(id)}"${kind?` data-confirm="${kind}"`:''} ${!a.enabled||failed?'disabled':''}><span class="action-name">${picture!==null?sectImage(picture,'sect-button-picture'):icon?uiIcon(icon):''}${esc(a.label)}</span><span class="action-cost">${costChips(g,a)}</span></button>${!a.enabled?`<p class="blocked-reason">${esc(a.reason??'暂不可用')}</p>`:`<details class="action-help" data-fold="${esc(id)}"><summary>行动详情</summary><p class="action-note">${esc(a.description)}</p></details>`}</div>`;
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
  if(l){
    if(!g.sect&&l.heir?.alive&&l.heir.ageYears<l.adultYears&&!l.seasonCompany)items.push('后辈本季尚未陪伴；饱食与陪伴在成年时增加体质；教导帮助学习，出生天赋终身保留。');
    const consults=(l.elders??[]).reduce((n,x)=>n+x.consultable,0);
    if(consults>0)items.push(`在世长辈可请教 ${consults} 门课程（见家人页）。`);
  }
  if(e.modern&&e.modern.power>0)items.push(`当前余电 ${e.modern.power}${e.electricView?'；未入库的电会在季末耗散':''}`);
  return items;
}

export function confirmContent(g:Game, id:string):{title:string;body:string;submitLabel:string} {
  if(g.sect&&id==='economy:erasettle:stage'&&g.era){
    const e=g.era,modern=e.index===3;
    return {title:modern?'结束现代使命':'结束当前文明阶段',submitLabel:modern?'确认结束旅程':'确认结算并进入下一阶段',body:`<p>当前阶段：<strong>${esc(e.stage.name)}</strong>。</p><p>${modern?'结束本季并结束整个旅程，按已完成的使命计分。':'结束本季，结算当前阶段回报并进入下一文明阶段。师徒、个人修为与所学继续保留。'}</p>${!modern?`<p>预计阶段回报 ${e.expectedReward} 钱，最终金额以本季结算结果为准。</p>`:''}${e.crises?`<p>剩余 ${e.crises.remaining} 季 · 当前总分 ${e.crises.score}。</p><p>尚未兜底：${e.crises.entries.filter(x=>x.level<1).map(x=>esc(x.name)).join('、')||'无'}。提前结束将立即判定使命成败。</p>`:''}`};
  }
  if(g.sect&&['handover','economy:retire:family','economy:erasettle:stage'].includes(id)){
    const a=g.actions.find(x=>x.id===id),cr=g.era?.crises;
    return {title:a?.label??'确认交接',submitLabel:'确认提交',body:`<p>${esc(a?.description??'')}</p><p>当代两人各自的修为和所学不会复制给弟子。门派道法、信物、规程与机缘储备保留。</p>${cr?`<p>剩余${cr.remaining}季，总分${cr.score}。未兜底：${cr.entries.filter(x=>x.level<1).map(x=>esc(x.name)).join('、')||'无'}。现在结束将立即判定使命成败。</p>`:''}`};
  }
  const a=g.actions.find(x=>x.id===id);
  const kind=confirmKind(id);
  if(kind==='season'){
    return {title:'结束本季',submitLabel:'确认结束本季',body:`<p>结算生产、口粮与身体恢复，进入下一季。</p><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a?`<details><summary>结算详情</summary><p>${esc(a.description)}</p></details>`:''}`};
  }
  if(kind==='era'&&g.era){
    const e=g.era,p=e.projection;
    const modern=e.generationLimit===null;
    return {title:'结算当前社会',submitLabel:'确认结算',body:`<p>${modern?'这会结束本季、结束这次旅程，并按副本任务计分。':`这会结束本季并进入下一社会，由无亲属关系的新随机人物开始；剩余约 ${e.remaining} 季（按代际估计）将推算兑现。`}预估会受当季实际结果影响，最终金额以结算事件为准。</p><ul class="check-list"><li>现在结算预计兑现 ${e.expectedReward} 钱</li>${modern?`<li>副本总分 ${e.dungeon?.score??0} / ${e.dungeon?.target??0}${e.dungeon?.powered===false?'；通电验收尚未完成':''}</li>`:`<li>已取得回报凭证 ${e.rewardClaims} 份；剩余约 ${p.remaining} 季（按代际估计）推算 ${p.claims} 份</li>`}${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')}${e.electricRewardPercent!==undefined?`<li>当前回报比例 ${e.electricRewardPercent}%。${esc(e.electricRequirement??'')}</li>`:''}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  if(kind==='retire'&&g.life){
    const l=g.life;
    return {title:'安排季末交接',submitLabel:'确认安排交接',body:`<p>${g.era?.lastGeneration?'本季结束后进入时代结算，下一时代从无亲属关系的新随机人物开始。':'本季结束后，再由成年后辈接手。'}</p><ul class="check-list"><li>${l.heir?`后辈 ${l.heir.ageYears} 岁，成年线 ${l.adultYears} 岁，${l.heir.alive?'在世':'已故'}`:'尚无后辈'}</li><li>家族实物、记录和员工经验保留</li><li>后辈的个人知识仍需学习</li><li>${esc(successionWork(g))}</li></ul>`};
  }
  return {title:a?.label??'确认行动',submitLabel:'确认提交',body:`<p>${esc(a?.description??'提交后按现行规则结算。')}</p>`};
}

function foodWarning(g:Game):boolean {
  const e=g.economy!;
  return g.socialFood?g.socialFood.missing>0:e.foodTotal<g.parameters.foodPerTurn;
}

const fieldArt=(f:NonNullable<Game['economy']>['field'])=>!f.crop?'field-empty':f.growth>=f.duration?'field-ready':'field-growing';
const sceneArt=(name:string)=>`<img class="place-illustration" src="${artUrl(name)}" alt="" aria-hidden="true" width="600" height="400" decoding="async">`;

function successionState(g:Game):string {
  if(g.sect)return g.status==='handover'?'自己的弟子已可接班，确认后开启下一代。':g.sect.ready?'自己的弟子已成年，可安排交接。':'你可以收一名弟子，成年后交接；同门独立生活，不参与交接。';
  const l=g.life; if(!l)return '';
  if(g.status==='ended')return '家族经营已经结束。';
  if(g.status==='complete')return g.victory?.won?'旅程已经胜利结束。':'旅程已经结束。';
  if(g.status==='handover')return g.era?.lastGeneration?'本时代已到最后一代；确认后结清回报，下一时代从新随机人物开始。':'本季已结束，后辈可以接手。人物尚未切换。';
  if(!l.heir)return `尚未有后辈。满 ${l.birthYears} 岁且尚无子嗣时迎来新生后辈。`;
  if(!l.heir.alive)return '后辈已故，当前不可继任。';
  if(l.heir.ageYears<l.adultYears)return `后辈尚未成年（${l.heir.ageYears} / ${l.adultYears} 岁）。`;
  if(l.pendingRetirement)return g.era?.lastGeneration?'已安排季末交接；确认交接后结束本时代，由新随机人物开启下一时代。':'已安排季末交接。结束本季后，由后辈接手。';
  return '后辈已成年，可以安排季末交接。';
}

function knownNames(g:Game, heir=false):string {
  const b=g.economy?.branchView;
  if(b)return b.nodes.filter(n=>heir?n.heirKnown:n.known).map(n=>n.name).join('、')||'尚未掌握课程';
  const list=heir?g.heir.mastered:g.person.mastered;
  return list.length?list.join('、'):'尚未掌握课程';
}

function personPortrait(p:{portrait:string;portraitEra:number;ageYears:number;alive:boolean;sex?:string;character?:{temperament:string}|null},name:string):string {
  const personalities=['内敛细察','坦率热忱','沉静坚韧','谨慎认真','洒脱好奇','温厚耐心'];
  const temperament=personalities.indexOf(p.character?.temperament??'');
  // Early-era portraits share identity across three age bands. Other eras keep their era-specific art.
  if(temperament>=0&&p.ageYears>=12&&p.portraitEra<2&&(p.sex==='male'||p.sex==='female')){
    const age=p.ageYears<18?0:p.ageYears<55?1:2;
    return `<div class="person-portrait character-portrait${p.alive?'':' is-deceased'}" role="img" aria-label="${esc(name)} · ${esc(p.character!.temperament)} · ${['少年','成年','老年'][age]}人物插画" style="background-image:url('/illustrations/sect-portraits-${p.sex}.png');background-position:${temperament*20}% ${age*50}%"></div>`;
  }
  const stage=p.ageYears<6?0:p.ageYears<12?1:p.ageYears<18?2:p.ageYears<35?3:p.ageYears<55?4:5;
  const ages=['幼年','儿童','少年','青年','中年','老年'];
  const eraNames=['农耕村落','市镇百工','电力工业','现代社会'];
  const eraSuffix=['','-town','-industry','-modern'][p.portraitEra];
  return `<div class="person-portrait${p.alive?'':' is-deceased'}" role="img" aria-label="${esc(name)} · ${eraNames[p.portraitEra]} · ${ages[stage]}肖像" style="background-image:url('/illustrations/person-${esc(p.portrait)}${eraSuffix}.jpg');background-position:${stage%3*50}% ${stage<3?0:100}%"></div>`;
}
function family(g:Game,button:Button):string {
  if(g.sect)return sectPage(g,button);
  const l=g.life; if(!l)return '';
  const person=(who:'self'|'heir',actions='')=>{
    const p=who==='self'?l.person:l.heir;
    if(!p)return `<article class="person-card"><h3>后辈</h3><p>尚未有后辈。</p></article>`;
    const name=who==='self'?g.person.name:g.heir.name;
    const raising=who==='heir'&&p.upbringing?`<p class="subtle">养育记录：饱食 ${p.upbringing.fedSeasons} 季 · 陪伴 ${p.upbringing.companySeasons} 季 · 受教 ${p.upbringing.taughtSeasons} 季${p.ageYears<l.adultYears?`（成年时按记录结算体质，出生天赋终身保留${l.seasonCompany?'；本季已陪伴':'；本季尚未陪伴'}）`:'（成年评估已完成）'}</p>`:'';
    return `<article class="person-card">${personPortrait(p,name)}<h3>${esc(name)} <small>${who==='self'?'本代经营者':'后辈'} · ${p.sex==='male'?'男':'女'} · ${p.ageYears} 岁 · ${p.alive?'在世':'已故'}</small></h3><p><span class="tag">出生天赋 · ${esc(p.talent.name)}</span> ${esc(p.talent.effect)}</p>${meter('健康',p.health,p.maxHealth??100,'health')}${meter('精力',p.energy,p.maxEnergy,'energy')}${raising}<p class="subtle">已知学习：${esc(knownNames(g,who==='heir'))}</p>${actions?`<div class="compact-actions">${actions}</div>`:''}</article>`;
  };
  const elders=l.elders??[];
  const consults=g.actions.filter(a=>a.id.startsWith('economy:consult:')).slice(0,4).map(a=>button(a.id)).join('');
  const elderCard=`<article class="person-card"><h3>在世长辈 <small>${elders.length?`可请教 ${elders.reduce((n,x)=>n+x.consultable,0)} 门课程`:'暂无'}</small></h3>${elders.length?elders.map(e=>`<div class="elder-person">${personPortrait(e,e.name)}<p><strong>${esc(e.name)}</strong> · ${e.sex==='male'?'男':'女'} · ${e.ageYears} 岁 · 退休长辈<br><span class="tag">${esc(e.talent.name)}</span><br><span class="subtle">${e.consultable>0?`可请教 ${e.consultable} 门本人未学的课程；请教后下一次学习该课程时间减少，每门每代一次。`:'没有本人未学且可请教的课程。'}</span></p></div>`).join(''):'<p>交接后退休长辈仍在世时，可请教其掌握的课程。</p>'}${consults?`<div class="compact-actions">${consults}</div>`:''}</article>`;
  const handoverCard=`<article class="person-card"><h3>交接 <small>代际传承</small></h3><p>${esc(successionState(g))}</p><p>同一时代内由后辈传承；跨时代从新随机人物开始，个人知识从基础学习。实物和公共记录保留。安排交接不会立刻切换人物。</p><p class="subtle">${esc(successionWork(g))}</p><div class="action-primary">${button('economy:retire:family')}</div></article>`;
  return `<div class="person-spread">${person('self',button('economy:rest:self')+button('economy:care:self'))}${person('heir',button('economy:company:heir'))}${elderCard}${handoverCard}</div>`;
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
  const encounter=events.find(t=>/第\d+季 · /.test(t));
  const history=events.length?(encounter?[encounter,...events.filter(t=>t!==encounter).slice(-2)]:events.slice(-3)):['你与同门，在村中各自经营。'];
  return `<div class="season-dashboard"><div class="dashboard-main">
    <section class="estate-board"><div class="estate-copy"><span class="chapter-kicker">门中田地</span><h3>${fieldTitle}</h3><p>肥力 ${f.fertility}/3 · ${f.crop?`生长 ${f.growth}/${f.duration} 季`:'尚未播种'}</p>${f.crop?`<p>预计收成 ${e.harvest} · 水分 ${f.moisture}</p>`:''}<button type="button" data-page="农业">去田地 →</button></div><div class="painted-art field-dashboard-art" style="background-image:url('${artUrl(fieldArt(f))}')" aria-hidden="true"></div></section>
    <div class="dashboard-pair"><section class="dashboard-card food-board"><div class="painted-art art-food" aria-hidden="true"></div><h3>生活保障</h3><span class="status-pill ${foodWarning(g)?'status-warning':''}">${foodWarning(g)?'需要补给':'本季够吃'}</span><p class="board-number">${e.foodTotal}<small>份可食储备</small></p><p>季耗 ${g.parameters.foodPerTurn} 份</p><dl class="board-ledger"><div><dt>预计购粮</dt><dd>${food?.purchase??0} 份</dd></div><div><dt>预计花费</dt><dd>${food?.cost??0} 钱</dd></div><div><dt>生活缺口</dt><dd>${food?.missing??Math.max(0,g.parameters.foodPerTurn-e.foodTotal)} 份</dd></div></dl><button class="text-btn" type="button" data-page="生活">去补给与谋生 →</button></section>
    <section class="dashboard-card family-board"><h3>师徒传承</h3><div class="painted-art art-family" aria-hidden="true"></div><div class="family-snapshot"><div><strong>当前传人${l?` · ${l.person.ageYears}岁`:''}</strong>${l?meter('健康',l.person.health,l.person.maxHealth??100):''}</div><div><strong>${l?.heir?`弟子 · ${l.heir.ageYears}岁`:'尚未收徒'}</strong>${l?.heir?meter(l.heir.alive?'健康':'已故',l.heir.health,l.heir.maxHealth??100):''}</div></div><button class="text-btn" type="button" data-page="家人">查看师徒 →</button></section></div>
    ${e.industryView?.systems.some(x=>x.instance)?`<section class="dashboard-card"><h3>产业运行</h3><div class="board-ledger">${e.industryView.systems.filter(x=>x.instance).map(x=>`<div><span>${esc(x.name)}</span><span>${!x.instance?.enabled?'已停用':x.blockers.length?'条件不足':x.instance?.operator?'已安排人员':'待安排'}</span></div>`).join('')}</div><button type="button" class="text-btn" data-page="系统">管理生产 →</button></section>`:''}
    </div><aside class="dashboard-side"><section class="dashboard-card"><h3>等你安排 <span class="task-count">${tasks.length}</span></h3>${tasks.length?tasks.map(t=>`<article class="board-task"><strong>${esc(t.title)}</strong><p>${esc(t.detail)}</p><button type="button" data-page="${t.page}">去处理 →</button></article>`).join(''):'<p class="subtle">当前没有待处理事项。</p>'}<h3 class="time-heading">时间安排</h3><div class="time-track" aria-hidden="true"><span style="width:${Math.min(100,(time?.spentTime??0)/total*100)}%"></span><span style="width:${Math.min(100,(time?.reservedTime??0)/total*100)}%"></span></div><p class="time-labels">已用 ${time?.spentTime??0} · 预留 ${time?.reservedTime??0} · 可用 ${time?.freeTime??g.ap}</p></section><section class="dashboard-card"><h3>最近记事</h3><ol class="board-history">${history.map(t=>`<li>${encounterCard(t,true)}</li>`).join('')}</ol>${events.length>3?`<details><summary>全部变化</summary>${events.map(t=>encounterCard(t,true)).join('')}</details>`:''}</section></aside></div>`;
}

function pageArt(page:string):string {
  if(['学科'].includes(page))return 'study';
  if(['制造','系统','雇佣','作坊','家业'].includes(page))return 'workshop';
  if(page==='能源')return 'power';
  if(page==='家人')return 'family';
  if(page==='商城')return 'market';
  if(page==='农业')return 'farming';
  if(page==='社会')return 'journal';
  if(page==='仓库')return 'warehouse';
  if(page==='生活')return 'food';
  if(page==='安排')return 'journal';
  return 'home';
}

function inventory(g:Game):string {
  const e=g.economy!;
  const stock:[string,number][]=[...Object.entries(e.goods).filter(([,n])=>n>0),...(g.family.food>0?[['food',g.family.food] as [string,number]]:[])];
  const category=(id:string)=>id.startsWith('seed')?'种子':['food','wheat','soy','flour'].includes(id)?'口粮':['wood','clay','stone','straw','fiber','iron','copper','oil','polymer'].includes(id)?'原料':'加工品与其他';
  const groups=['口粮','种子','原料','加工品与其他'].map(name=>{const entries=stock.filter(([id])=>category(id)===name);return entries.length?`<section class="stock-group"><h3>${name}<small>${entries.length} 种</small></h3><dl class="inventory-grid">${entries.map(([id,n])=>`<div class="inventory-item"><dt>${itemImage(id)}<span>${esc(id==='food'?'即食粮':ALL_GOODS[id]?.name??id)}</span></dt><dd class="num">${n}</dd></div>`).join('')}</dl></section>`:'';}).join('');
  return panel('仓库',`<div class="place-overview warehouse-overview">${sceneArt('warehouse')}<div><span class="chapter-kicker">家里的物资账</span><h3>储备与保存</h3><dl class="stock-summary"><div><dt>可食储备</dt><dd>${e.foodTotal}<small>份</small></dd></div><div><dt>食品保护容量</dt><dd>${e.storage}</dd></div><div><dt>即食粮</dt><dd>${g.family.food}</dd></div></dl><p class="subtle">插画为仓储场景示意，实际库存见下方清单。</p></div></div>${groups||'<p class="stock-empty">暂无物资，可以去集市采购或田地收获。</p>'}<p class="subtle">面粉、小麦、大豆依序补生活缺口；种子不当饭吃。食品保护容量不代表整个仓库的存放上限。</p><div class="stock-links"><button type="button" class="text-btn" data-page="商城">去集市补给 →</button><button type="button" class="text-btn" data-page="农业">查看田地 →</button></div>`);
}

function attention(g:Game,page:string):string {
  const e=g.economy!,l=g.life;
  if(page==='生活')return `<h3>生活缺口</h3>${g.socialFood?`<p>政策 ${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱 · 缺口 ${g.socialFood.missing} 份</p>${g.socialFood.reasons.map(r=>`<p class="blocked-reason">${esc(r)}</p>`).join('')}`:`<p>可食储备 ${e.foodTotal} / 季耗 ${g.parameters.foodPerTurn}</p>`}<p><button type="button" class="text-btn" data-page="商城">去集市</button></p>`;
  if(page==='仓库')return `<h3>口粮与保存</h3><p>即食粮 ${g.family.food} · 可食储备 ${e.foodTotal} · 保护容量 ${e.storage}</p><p class="subtle">超出保护容量的物资可能发生保存损耗。种子不当饭吃。</p><p><button type="button" class="text-btn" data-page="生活">去补给与谋生</button></p>`;
  if(page==='安排'){const o=e.operationsView;return `<h3>当前安排</h3>${g.socialFood?`<p>吃饭：${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱</p>`:''}${o?`<p>田地 ${o.farm?'托管':'亲自经营'} · 生产${o.production?'已安排':'未安排'} · 补货${o.supplies?'开':'停'} · 交付${o.sales?'开':'停'} · 维护${o.maintenance?'开':'停'}</p>${o.paused?'<p class="blocked-reason">经营安排已暂停，等待接续。</p>':''}`:''}<p><button type="button" class="text-btn" data-page="${e.industryView?'系统':'家业'}">查看产业运行</button></p>`;}
  if(l)return `<h3>本季余量</h3><p>可用时间 ${l.budget.freeTime} / ${l.timePerSeason}<br>可用精力 ${l.budget.freeEnergy}</p>`;
  return `<h3>当下关注</h3><p>选择一项后，这里会显示条件和报价。</p>`;
}

const OWN_SPREAD=new Set(['工坊','贸易','资本','农业','聚落','家人','修炼','学科','制造','系统','雇佣','商城','能源','社会','家业','作坊','副本','试炼']);

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
  if(g.sect)return `旅程结束，现代副本总分${g.era?.crises?.score??0}。${g.era?.crises?.won?'全部危机完成兜底，使命成功。':'使命尚未完成；已完成副本分数保留。'}`;
  if(g.status==='ended')return '家族经营终止。没有可接手的成年后辈，或经营已经失败。可以从底部导出这次旅程。';
  if(g.status==='complete'&&g.victory?.won)return '最终试炼已完成，家族旅程胜利结束。';
  if(g.status==='complete')return '旅程已经结束。若未完成最终副本，这不是通关胜利。';
  return '观察期结束。可以从底部导出这次旅程。';
}

export function humanScreen(g:Game,page:string,body:string,button:Button,events:string[],guide=false,recap:Recap|null=null):string {
  const e=g.economy!,l=g.life,end=g.status==='complete'||g.status==='ended';
  const groups=playerGroups(g),group=groups.find(x=>x.pages.includes(page))??groups[0];
  const low=foodWarning(g);
  const settle=g.actions.find(a=>a.id==='economy:erasettle:stage');
  const stageExit=g.era&&!end&&settle?`<button type="button" class="stage-exit-button" data-action="economy:erasettle:stage" data-confirm="era" ${!settle.enabled||g.status==='handover'?'disabled':''}>${g.era.index===3?'结束旅程':'结束当前阶段'} →</button>`:'';
  const masthead=`<header class="chronicle-masthead"><div><div class="eyebrow">CIVILIZATION MINI</div><h1>隐士修所 <span>师徒传承</span></h1><p class="rule-line">规则 ${esc(g.rulesVersion)}${g.era?` · ${esc(g.era.framework.name)}`:''}</p></div><div class="masthead-meta"><div class="masthead-stage"><span>${l?esc(g.person.name):'当前家族'}${g.era?` · ${esc(g.era.stage.name)}`:''}</span>${stageExit}</div><div class="masthead-links"><details class="options-menu"><summary class="text-btn">${chromeImage('status-save','utility-image')}<span>选项</span></summary><div class="options-panel"><a href="/start">打开其他旅程</a><a href="/start#legacy" target="_blank" rel="noopener">门派缘起与传承之志 ↗</a><a href="/">入口</a><a href="/ai">AI 文本玩法</a><button type="button" id="export">导出存档</button><label class="file-button">导入存档<input id="import" type="file" accept=".json,application/json" hidden></label><p class="subtle">结果由固定规则结算；浏览器存档在开始界面打开或新开，命令行存档在 saves/。</p></div></details><button type="button" class="text-btn" data-guide="${esc(page)}">${chromeImage('status-help','utility-image')}<span>帮助</span></button></div></div></header>`;
  const navigationArt:Record<string,string>={本季:'season',农场:'farm',师徒:'family',修炼:'study',学习与制造:'study',集市:'market',经营与交易:'trade',社会历程:'society'};
  const nav=`<nav class="chapter-nav" aria-label="篇章" style="--chapter-count:${groups.length}">${groups.map(x=>`<button type="button" class="chapter-tab" data-page="${x.pages.includes(page)?page:x.pages[0]}" aria-current="${x===group?'page':'false'}" title="${esc(x.description)}">${stageModules[x.name]?`<img class="chapter-image era-nav-image" src="/illustrations/era-nav-${stageModules[x.name].art}.webp" alt="" width="96" height="96">`:g.sect&&['师徒','修炼'].includes(x.name)?sectImage(x.name==='师徒'?0:1,'sect-navigation-picture'):chromeImage('nav-'+navigationArt[x.name],navigationArt[x.name]==='society'?'chapter-image chapter-image-society':'chapter-image')}<span>${esc(x.name)}</span>${stageModules[x.name]?`<small class="era-nav-stage">${(g.era?.index??0)<stageModules[x.name].stage?'第 '+(stageModules[x.name].stage+1)+' 阶段开放':'筹备中'}</small>`:''}</button>`).join('')}</nav>
    ${group.pages.length>1?`<nav class="chapter-subnav" aria-label="${esc(group.name)}分页">${group.pages.map(p=>`<button type="button" data-page="${p}" class="${page===p?'selected':''}" aria-current="${page===p?'page':'false'}">${placeIcon(p)}<span>${pageNames[p]??p}</span></button>`).join('')}</nav>`:''}`;
  const weatherArt=g.world.weather==='wet'?'rain':g.world.weather==='dry'?'sun':null;
  const hudItem=(icon:string,label:string,value:string,warning=false,detail='')=>`<div class="hud-item ${warning?'resource-warning':''}" title="${esc([label,detail].filter(Boolean).join(' · '))}">${chromeImage('status-'+icon)}<div class="hud-copy"><span>${esc(label)}</span><strong class="num">${value}</strong>${detail?`<small class="hud-detail">${esc(detail)}</small>`:''}</div></div>`;
  const hud=`<section class="player-hud" aria-label="本季状态"><div class="season-card">${chromeImage('status-season')}<div class="season-copy"><small>第 ${g.clock.generation} 代</small><strong>${l?`第 ${l.calendar.year} 年 · ${l.calendar.season}`:`第 ${g.clock.turn} 季`}</strong><span class="weather-status">${weatherArt?chromeImage('status-'+weatherArt,'weather-image'):''}${esc(g.world.weatherName)}</span></div></div>${hudItem('time','时间 / 季预算',`${l?l.budget.freeTime:g.ap}<small> / ${l?l.timePerSeason:g.parameters.actionsPerTurn}</small>`)}${hudItem('energy','精力',`${l?l.budget.freeEnergy:'—'}`)}${hudItem('food','口粮 / 季耗',`${e.foodTotal}<small> / ${g.parameters.foodPerTurn}</small>`,low,g.socialFood?`预计购 ${g.socialFood.purchase}`:'')}${hudItem('money','钱财',`${g.family.money}`)}</section>`;
  const recapHtml=recap?`<section class="chapter-recap" aria-live="polite"><h2>${esc(recap.title)}</h2>${recap.lines.map(t=>/第\d+季 · /.test(t)?encounterCard(t):`<p>${esc(t)}</p>`).join('')}<button type="button" class="text-btn" data-dismiss-recap>关闭回顾</button></section>`:'';
  const main=guide?ruleGuide(g,page):stageModules[page]?stageModulePage(g,page):page==='聚落'?village(g,events):page==='家人'?family(g,button):page==='仓库'?inventory(g):body;
  const spread=guide||OWN_SPREAD.has(page)?main:`<div class="spread-body"><div class="reading-pane">${main}</div><aside class="attention-pane">${attention(g,page)}</aside></div>`;
  const budget=l?`<details class="budget-details"><summary>查看本季劳动安排 · 预留 ${l.budget.reservedTime} 时间 / ${l.budget.reservedEnergy} 精力</summary><p>已用时间 ${l.budget.spentTime} · 剩余时间 ${l.timeRemaining}</p>${l.budget.tasks.map(t=>`<p>${esc(t.name)} <span class="tag">时间 ${t.time} / 精力 ${t.energy}</span></p>`).join('')||'<p>暂无系统任务</p>'}</details>`:'';
  const season=end?`<div><h3>${g.status==='ended'?'传承与使命终止':g.victory?.won?'旅程胜利':'旅程结束'}</h3><p>${esc(endingCopy(g))}</p><p><a class="text-btn" href="/start">回到开始界面</a></p></div>`:g.status==='handover'?`<div><h3>${g.sect?'师徒整代交接':g.era?.lastGeneration?'新时代人物':'后辈接手'}</h3><p>${esc(successionState(g))}</p></div><div class="action-primary">${button('handover')}</div>`:`<div><h3>季末检查</h3><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="action-primary">${button('economy:end:season')}</div>${budget}`;
  return `<div class="chronicle-shell ${g.sect?'sect-theme':''} page-${pageArt(page)} ${page==='聚落'?'is-dashboard':''}">${masthead}${nav}${hud}${low?'<div class="food-alert" role="status">当前库存与预计购粮不足以覆盖本季消耗。<button type="button" data-page="农业">去田地</button><button type="button" data-page="商城">买补给</button><button type="button" data-page="生活">找生计</button></div>':''}<div class="chronicle-spread">${recapHtml}<header class="chapter-head ${g.sect&&['家人','修炼'].includes(page)?'sect-chapter-heading':page!=='聚落'?'illustrated-heading':''}">${page!=='聚落'&&!(g.sect&&['家人','修炼'].includes(page))?`<div class="painted-art art-${pageArt(page)}" aria-hidden="true"></div>`:''}<div class="section-heading"><div><h2>${page==='聚落'?'本季看板':pageNames[page]??page}</h2><p class="chapter-epigraph">${esc(chapterEpigraph(g,page))}</p></div>${!guide?`<button type="button" class="text-btn" data-guide="${esc(page)}">${pageNames[page]??page}规则</button>`:''}</div></header>${spread}${page==='聚落'||end||g.status==='handover'?`<div class="season-bar">${season}</div>`:''}</div></div>`;
}

export function cultivationPage(g:Game,button:Button,selected=''):string {
 const x=g.sect;if(!x)return '';
 const r=x.rules,m=x.members.find(p=>p.id===x.activeId)!;
 const names=['定心','观照','知止','守一','通明'];
 const verses=['心有所定，方能有所学。','观事察己，日有所省。','知进退，明取舍。','守其本，笃其行。','明其道，通其用。'];
 const valid=/^(personal|doctrine):(\d+)$/.exec(selected);
 const kind=valid?.[1]??'personal',limit=kind==='personal'?r.maxStage:r.doctrineMax;
 const level=Math.max(1,Math.min(limit,valid?Number(valid[2]):Math.min(r.maxStage,m.stage+1)));
 const picked=`${kind}:${level}`;
 const node=(type:string,lv:number,name:string,state:string,sub:string,known:boolean)=>`<button type="button" class="cultivation-node ${known?'known':''} ${picked===type+':'+lv?'selected':''}" data-cultivation="${type}:${lv}" aria-pressed="${picked===type+':'+lv}">${sectImage(type==='personal'?lv+1:lv+6,'sect-node-picture')}<span class="cultivation-number">${lv.toString().padStart(2,'0')}</span><strong>${name}</strong><small>${state}</small><small>${sub}</small></button>`;
 const personal=Array.from({length:r.maxStage},(_,i)=>{const lv=i+1;return node('personal',lv,names[i]??`第${lv}境`,lv<=m.stage?'✓ 已达境':lv===m.stage+1?'○ 修习中':'· 尚未达到',`修为 ${lv*r.stageProgress}`,lv<=m.stage);}).join('');
 const doctrine=Array.from({length:r.doctrineMax},(_,i)=>{const lv=i+1;return node('doctrine',lv,`心法第${lv}重`,lv<=x.doctrine?'✓ 已传承':lv===x.doctrine+1?'○ 待研证':'· 尚未改进',`每境额外减耗 ${lv*r.doctrinePercent}%`,lv<=x.doctrine);}).join('');
 let detail='';
 if(kind==='personal'){
   const target=level*r.stageProgress,progress=Math.max(0,Math.min(r.stageProgress,m.practice-(level-1)*r.stageProgress));
   const effect=Math.min(35,level*(r.daoPercent+x.doctrine*r.doctrinePercent));
   detail=`<div class="eyebrow">个人修为 · 第${level}境</div><h3>${names[level-1]??`第${level}境`}</h3><blockquote>${verses[level-1]??'修道习术，笃行不怠。'}</blockquote><div class="cultivation-effect"><span>达到此境时 · 本人时间与精力减耗</span><strong>${effect}%</strong><small>基础 ${level*r.daoPercent}% ＋ 心法 ${level*x.doctrine*r.doctrinePercent}% · 封顶35%</small></div>${meter('本境修习',progress,r.stageProgress)}<p class="subtle">${m.practice>=target?'此境已成。':`累计修为需${target}，还差${target-m.practice}。`}</p><ul class="check-list"><li>用于学习、劳动、授徒、休养与筹备</li><li>首次达境衍生${r.fortunePerStage}气运${m.rewardedStage>=level?' · 已领取':''}</li></ul><div class="cultivation-actions">${button('economy:sectpractice:dao')}</div><p class="subtle">静修增加${r.practiceGain}修为，按累计进度达境；选中节点不会直接解锁境界。</p><details><summary>授徒修道</summary>${button('economy:sectteach:dao')}</details>`;
 }else{
   const record=x.improvements.find(i=>i.level===level),learned=g.economy!.branchView?.nodes.filter(n=>n.recorded)??[];
   const needed=r.doctrineCourses*level,subjects=new Set(learned.map(n=>n.id[0])).size;
   const evidence=m.practiceEvidence.map(v=>({'dao:farm':'耕作','dao:craft':'生产','dao:teach':'授术'}[v]??v));
   const check=(met:boolean,text:string)=>`<li>${met?'✓':'○'} ${text}</li>`;
   detail=`<div class="eyebrow">本门心法 · 永久传承</div><h3>心法第${level}重</h3><blockquote>传下修行之法，修为仍须亲得。</blockquote><div class="cultivation-effect"><span>每一境额外减耗</span><strong>${level*r.doctrinePercent}%</strong><small>后人从零修炼，逐境发挥效果</small></div>${level<=x.doctrine?`<p class="learned-stamp">✓ 已改进 · 跨代保留</p><p>${esc(x.members.find(p=>p.id===record?.personId)?.name??'前代传人')}整理成篇${record?`，记录${record.courses.length}门术`:''}。</p>`:`<ul class="check-list">${check(m.stage>=r.maxStage,`个人达到第${r.maxStage}境 · 当前${m.stage}境`)}${check(learned.length>=needed,`亲自掌握${needed}门术 · 当前${learned.length}门`)}${check(subjects>=3,`涉猎三类学科 · 当前${subjects}类`)}${check(evidence.length>=2,`两类亲身实践 · ${esc(evidence.join(' / ')||'尚无记录')}`)}${level>x.doctrine+1?check(false,'须完成前一重心法改进'):''}</ul>${meter('本重研证',level===x.doctrine+1?x.research:0,r.doctrineSteps)}${level===x.doctrine+1?button('economy:sectimprove:dao'):'<p class="subtle">尚未轮到此重研证，请先完成前一重。</p>'}<p class="subtle">每步基础投入：${r.practiceTime}时间、${r.practiceEnergy}精力、${r.doctrineMoney}钱。</p>`}`;
 }
 return `<div class="cultivation-page"><div class="sect-banner"><div class="sect-art sect-art-practice" aria-hidden="true"></div><div><span class="eyebrow">修身 · 明道 · 致用</span><h3>静水深流，日有所进</h3><p>修为由自己积累，心法为后来者留下。</p></div></div><div class="cultivation-toolbar"><div><strong>${esc(m.name)}</strong> · 第${m.generation}代<span>修为 ${m.practice}/${r.stageProgress*r.maxStage}</span><span>本道减耗 ${m.effect}%</span></div><div class="cultivation-people">${x.current.map((id)=>{const p=x.members.find(v=>v.id===id)!;return `<div><span>${esc(p.name)} · ${p.stage}境${id===x.activeId?' · 当前':''}</span>${id===x.activeId?'':'<button data-page="农业">拜访同门</button>'}</div>`;}).join('')}</div></div><div class="cultivation-workbench"><section><div class="cultivation-lane-head"><h3>个人修为</h3><span>亲自修习 · 新人从零开始</span></div><div class="cultivation-nodes" style="--cultivation-count:${r.maxStage}" role="group" aria-label="个人修为五境">${personal}</div><p class="cultivation-legend">✓ 已达境　○ 修习中　· 尚未达到 <span>五境相承，循序而进</span></p><div class="cultivation-lane-head"><h3>本门心法</h3><span>跨代保留 · 后人修习时受益</span></div><div class="cultivation-nodes doctrine-nodes" style="--cultivation-count:${r.doctrineMax}" role="group" aria-label="本门心法永久改进">${doctrine}</div><div class="cultivation-legacy">${x.improvements.length?x.improvements.map(i=>`<p>传承 · 第${x.members.find(p=>p.id===i.personId)?.generation??'—'}代 ${esc(x.members.find(p=>p.id===i.personId)?.name??i.personId)}改进第${i.level}重心法</p>`).join(''):'<p>尚无永久改进。传下更好的方法，每位弟子仍须亲修。</p>'}</div><details class="cultivation-fortune"><summary>${sectImage(11,'sect-inline-picture')}衍生机缘 · 气运${x.fortune}/${r.fortuneCap} · 可选辅助</summary><p>每次求取消耗${r.drawCost}气运；不抽卡也能修道与完成使命。</p><p>基础 / 进阶 / 稀有：${x.odds.map(n=>(n*100).toFixed(2)+'%').join(' / ')}，按扣费前计算。</p>${button('economy:sectdraw:opportunity')}<p>${esc(x.lastDraw)}</p><ul>${x.cards.map(c=>`<li>${esc(c.name)} ${c.level}/${r.cardMax}级 · 对应行动减耗${c.effect}%</li>`).join('')}</ul><p>${esc(x.lastEvent)}</p></details></section><aside class="cultivation-inspector" aria-label="修炼节点详情" aria-live="polite">${sectImage(kind==='personal'?level+1:level+6,'sect-detail-picture')}${detail}</aside></div><div class="cultivation-footer"><button type="button" class="text-btn" data-page="家人">师徒与身体休养 →</button><button type="button" class="text-btn" data-page="学科">前往学堂习术 →</button></div></div>`;
}

function characterCard(m:NonNullable<Game['sect']>['members'][number]):string {
 const c=m.life?.character;if(!c)return '';
 const junior=(m.life?.ageYears??0)<18;
 const styleArt=c.style.startsWith('素衣')?7:c.style.startsWith('衣着整洁')?9:c.style.startsWith('偏爱旧物')?11:c.style.startsWith('装束利落')?4:c.style.startsWith('喜用温和')?12:14;
 const talentArt=({'健壮':13,'善学':8,'善教':0,'善组织':9,'善恢复':12} as Record<string,number>)[m.life?.talent.name??'']??7;
 return `<div class="character-identity"><p><span class="tag">${m.life?.sex==='male'?'男':'女'}</span> <span class="tag">${esc(c.temperament)}</span> <span class="tag">${junior?'职业见习 · ':''}${esc(c.occupation)}</span></p><p class="character-trait subtle">${sectImage(styleArt,'character-trait-art')}<span>${esc(c.style)}</span></p><p class="character-trait">${sectImage(talentArt,'character-trait-art')}<span><strong>天赋 · ${esc(m.life?.talent.name??'')}</strong><br>${esc(m.life?.talent.effect??'')}</span></p><p>${esc(c.background)}</p><p>学习点 · ${m.life?.experiences?.learning??0} <span class="subtle">学习可节省时间时自动消耗1点，基础时间减少1，最低1时间</span></p>${(m.life?.earnedTalents??[]).map(t=>`<p>后天天赋 · ${esc(t.name)}：${esc(t.effect)}</p>`).join('')}<p>人物关系 · ${m.relationships.map(q=>esc(q.name)+' '+q.value).join(' / ')||'尚无往来记录'}</p>${encounterCard(m.life?.experiences?.lastEvent??'尚未经历季末事件')}<p class="character-feeling"><span class="character-mood-label">此刻心境</span>${esc(c.mood)}</p><details data-fold="character-${esc(m.id)}"><summary>牵挂与成长</summary><p><strong>牵挂</strong> · ${esc(c.attachment)}</p><p><strong>心愿</strong> · ${esc(c.aspiration)}</p><ol>${c.memories.map(n=>`<li><span class="subtle">${n.age}岁</span>${encounterCard(n.text,true)}</li>`).join('')||'<li>故事尚待续写。</li>'}</ol><p class="subtle">职业为社会身份，能力以天赋与实际所学为准。</p></details></div>`;
}

function sectPage(g:Game,button:Button):string {
 const x=g.sect!,current=x.members.find(m=>m.id===x.activeId)!,r=x.rules;
 const members=x.members.filter(m=>m.admitted);
 const lineage=x.current.map((id,slot)=>{
   const m=members.find(p=>p.id===id)!,disciple=members.find(p=>p.id===m.discipleId),active=id===x.activeId;
   return `<article class="sect-lineage ${active?'is-active':''}"><div class="sect-lineage-head"><span class="sect-seal">${slot===0?'壹':'贰'}</span><span>第 ${m.generation} 代 · ${active?'当前行动者':'独立同门'}</span></div>${m.life?personPortrait(m.life,m.name):''}<h3>${esc(m.name)}</h3>${characterCard(m)}<p class="subtle">${m.life?.ageYears??'—'} 岁 · ${m.life?.alive?'在世':'已故'} · ${esc(m.life?.talent.name??'')}</p><div class="sect-stats"><span><strong>${m.stage}</strong>境界</span><span><strong>${m.time}</strong>时间</span><span><strong>${m.life?.energy??'—'}</strong>精力</span></div>${meter('个人修为',m.practice,r.stageProgress*r.maxStage)}<p class="subtle">本道减耗 ${m.effect}%</p>${active?'<p class="sect-active-label">● 正在以此人行动</p>':'<button data-page="农业">去田野拜访同门</button>'}${active?`<div class="sect-disciple">${disciple?.life?personPortrait(disciple.life,disciple.name):sectImage(13,'sect-disciple-picture')}<span class="eyebrow">↓ 师承相续</span><h4>${disciple?esc(disciple.name):'虚席待徒'}</h4>${disciple?characterCard(disciple):''}<p>${disciple?`${disciple.life?.ageYears??'—'} 岁 · ${disciple.life?.alive?'在世':'已故'} · 修为 ${disciple.practice}`:'寻访有缘人，再由当前传人收为弟子。'}</p></div>`:'<p class="subtle">田地、库存与劳动预算独立；不替你经营家业。</p>'}</article>`;
 }).join('');
 return `<div class="sect-banner"><div class="sect-art sect-art-teaching" aria-hidden="true"></div><div><span class="eyebrow">道以传志 · 术以济世</span><h3>一人经营，同门相助</h3><p>只能控制自己；同门可交谈、换种、请教与求助。自己的弟子成年后可接手。</p><span class="tag">当前由 ${esc(current.name)} 行动 · 同门不可切换控制</span></div></div><div class="sect-workbench"><section><div class="sect-lineages">${lineage}</div>
 ${panel('寻访与收徒',`${sectImage(13,'sect-panel-picture')}${x.members.filter(m=>!m.admitted).map(m=>`<div class="sect-candidate">${m.life?personPortrait(m.life,m.name):''}<h3>候选 · ${esc(m.name)}</h3>${characterCard(m)}<p>${m.life?.ageYears}岁 · ${esc(m.life?.talent.name??'')} · 精力上限${m.life?.maxEnergy}；资质已固定</p></div>`).join('')||'<p class="subtle">先寻访，再查看候选资质并决定是否收徒。</p>'}<div class="sect-action-row">${button('economy:sectseek:disciple')}${button('economy:sectadmit:disciple')}</div>`)}
 ${panel('师徒谱系',`${sectImage(7,'sect-panel-picture')}<details data-fold="sect-lineage-history"><summary>查看历代门人 · ${members.length} 人</summary><ul class="check-list">${members.map(m=>`<li>第${m.generation}代 ${esc(m.name)} · ${m.life?.ageYears}岁 · ${m.life?.alive?'在世':'已故'} · 师父${esc(members.find(p=>p.id===m.masterId)?.name??'开派传人')} · 修为${m.practice}${characterCard(m)}</li>`).join('')}</ul></details>`)}
 </section><aside>${panel('传承交接',`${sectImage(11,'sect-panel-picture')}<p>${esc(successionState(g))}</p><p class="subtle">传下心法与志向，弟子仍须亲自修道习术。</p>${button('economy:retire:family')}${button('handover')}`)}${panel('身体与术的传授',`${sectImage(12,'sect-panel-picture')}${button('economy:rest:self')}${button('economy:care:self')}${g.actions.filter(a=>a.id.startsWith('economy:bond:')).map(a=>button(a.id)).join('')}<p class="subtle">术须逐门学习，可在学堂教导弟子，也可向在世师父请教。</p>${g.actions.filter(a=>a.id.startsWith('economy:consult:')).map(a=>button(a.id)).join('')}`)}${panel('本门心法',`${sectImage(10,'sect-panel-picture')}<p>心法 ${x.doctrine}/${r.doctrineMax} 重 · 跨代保留</p><button type="button" data-page="修炼">前往静修与研证 →</button>`)}</aside></div>`;
}
