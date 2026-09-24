import {storyPanel,storyArchive,landscapeBenefits} from './story-view.js';

import {artUrl,itemImage,chromeImage,sectImage,encounterCard,cultivationImage} from './illustration.js';
import {uiIcon,placeIcon} from './ui-icons.js';
import {pageNames,playerGroups,ruleGuide,chapterEpigraph,stageModules,stageModulePage} from './player-guide.js';
import type { SessionObservation } from '../../src/runtime/session.js';
import { ALL_GOODS, CROPS, EDIBLE } from '../../src/game/systems/economy-catalog.js';
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
  return `<span>${time} 天</span>${g.life&&a.pressureRelief?`<span>预计压力 −${a.pressureRelief}</span>`:g.life&&a.energy?`<span>压力 +${a.energy}</span>`:''}${a.money?`<span>钱 ${a.money}</span>`:''}${a.food?`<span>粮 ${a.food}</span>`:''}`;
}
export function confirmKind(id:string):'season'|'era'|'retire'|'handover'|null {

  if(id==='economy:erasettle:stage')return 'era';
  if(id==='economy:retire:family')return 'retire';
  if(id==='handover')return 'handover';
  return null;
}
export function actionButton(g:Game, id:string, failed:boolean):string {
  const a=g.actions.find(a=>a.id===id); if(!a)return '';
  const kind=confirmKind(id);
  const icon=(id.includes('sectdaily')||id.includes('sectlearn'))?'meditate':id.includes('sectimprove')?'book':id.includes('sectteach')?'book':id.includes('sectswitch')?'motion':id.includes('sectseek')||id.includes('sectadmit')?'people':id.includes('sectdraw')?'seal':kind==='handover'||kind==='retire'?'seal':'';
  const picture=g.sect?((id.includes('sectdaily')||id.includes('sectlearn'))?1:id.includes('sectimprove')?10:id.includes('sectteach')?0:id.includes('sectseek')?13:id.includes('sectadmit')?14:id.includes('sectdraw')?11:id==='economy:rest:self'||id==='economy:care:self'?12:kind==='handover'||kind==='retire'?11:null):null;
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
  else items.push(`可食储备 ${Number(e.foodTotal.toFixed(3))} / 季耗 ${g.parameters.foodPerTurn}`);
  if(l?.budget.tasks.length)items.push(`已预留：${l.budget.tasks.map(t=>t.name).join('、')}（${l.budget.reservedTime} 时间 / ${l.budget.reservedEnergy} 压力）`);
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
    return {title:modern?'结束现代使命':'结束当前文明阶段',submitLabel:modern?'确认结束旅程':'确认结算并进入下一阶段',body:`<p>当前阶段：<strong>${esc(e.stage.name)}</strong>。</p><p>${modern?'立即结束整个旅程，按已完成的使命计分。':'立即结算当前阶段回报并进入下一文明阶段。师徒、个人修为与所学继续保留。'}</p>${!modern?`<p>当前剩余 <strong>${e.timeBudget.remaining} 天</strong>，可用于折算的剩余时间为 ${e.timeBudget.transferable} 天。</p><p>按 ${e.timeBudget.percent}% 折算，向下取整到半天：下一阶段增加 <strong>${e.timeBudget.carry} 天</strong>，损耗 ${e.timeBudget.lost} 天。</p><p>已取得回报可兑现 ${e.expectedReward} 钱；未度过的时间不再折现。师徒交接不重置倒计时。</p>`:''}${e.crises?`<p>剩余 ${e.crises.remaining} 天 · 当前总分 ${e.crises.score}。</p><p>尚未兜底：${e.crises.entries.filter(x=>x.level<1).map(x=>esc(x.name)).join('、')||'无'}。提前结束将立即判定使命成败。</p>`:''}`};
  }
  if(g.sect&&['handover','economy:retire:family','economy:erasettle:stage'].includes(id)){
    const a=g.actions.find(x=>x.id===id),cr=g.era?.crises;
    return {title:a?.label??'确认交接',submitLabel:'确认提交',body:`<p>${esc(a?.description??'')}</p><p>当代两人各自的修为和所学不会复制给弟子。门派道法、信物、规程与机缘储备保留。</p>${cr?`<p>剩余${cr.remaining}天，总分${cr.score}。未兜底：${cr.entries.filter(x=>x.level<1).map(x=>esc(x.name)).join('、')||'无'}。现在结束将立即判定使命成败。</p>`:''}`};
  }
  const a=g.actions.find(x=>x.id===id);
  const kind=confirmKind(id);
  if(kind==='season'){
    return {title:'结束本季',submitLabel:'确认结束本季',body:`<p>结算生产、口粮与身体恢复，进入下一季。</p><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>${a?`<details><summary>结算详情</summary><p>${esc(a.description)}</p></details>`:''}`};
  }
  if(kind==='era'&&g.era){
    const e=g.era,p=e.projection;
    const modern=e.generationLimit===null;
    return {title:'结算当前社会',submitLabel:'确认结算',body:`<p>${modern?'这会立即结束这次旅程，并按副本任务计分。':`这会立即进入下一社会，由无亲属关系的新随机人物开始；当前剩余 ${e.timeBudget.transferable} 天按 ${e.timeBudget.percent}% 结转，下一阶段增加 ${e.timeBudget.carry} 天、损耗 ${e.timeBudget.lost} 天。`}只兑现已经获得的回报，不额外推进日历。</p><ul class="check-list"><li>现在结算预计兑现 ${e.expectedReward} 钱</li>${modern?`<li>副本总分 ${e.dungeon?.score??0} / ${e.dungeon?.target??0}${e.dungeon?.powered===false?'；通电验收尚未完成':''}</li>`:`<li>已取得回报凭证 ${e.rewardClaims} 份；仅兑现实际取得的收益，不推算未来产能</li>`}${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')}${e.electricRewardPercent!==undefined?`<li>当前回报比例 ${e.electricRewardPercent}%。${esc(e.electricRequirement??'')}</li>`:''}</ul>${a?`<p class="action-note">${esc(a.description)}</p>`:''}`};
  }
  if(kind==='retire'&&g.life){
    const l=g.life;
    return {title:'准备交接',submitLabel:'确认安排交接',body:`<p>${g.era?.lastGeneration?'确认后进入时代结算，下一时代从无亲属关系的新随机人物开始。':'确认后，再由成年后辈接手。'}</p><ul class="check-list"><li>${l.heir?`后辈 ${l.heir.ageYears} 岁，成年线 ${l.adultYears} 岁，${l.heir.alive?'在世':'已故'}`:'尚无后辈'}</li><li>家族实物、记录和员工经验保留</li><li>后辈的个人知识仍需学习</li><li>${esc(successionWork(g))}</li></ul>`};
  }
  return {title:a?.label??'确认行动',submitLabel:'确认提交',body:`<p>${esc(a?.description??'提交后按现行规则结算。')}</p>`};
}

function foodWarning(g:Game):boolean {
  const e=g.economy!;
  return g.life?.diet?g.life.diet.days<7:g.socialFood?g.socialFood.missing>0:e.foodTotal<g.parameters.foodPerTurn;
}

const fieldArt=(f:NonNullable<Game['economy']>['field'])=>!f.crop?'field-empty':f.growth>=f.duration?'field-ready':'field-growing';
const sceneArt=(name:string)=>`<img class="place-illustration" src="${artUrl(name)}" alt="" aria-hidden="true" width="600" height="400" decoding="async">`;

function successionState(g:Game):string {
  if(g.sect)return g.status==='handover'?'自己的弟子已可接班，确认后开启下一代。':g.sect.ready?'自己的弟子已成年，可安排交接。':'你可以收一名弟子，成年后交接；同门独立生活，不参与交接。';
  const l=g.life; if(!l)return '';
  if(g.status==='ended')return '家族经营已经结束。';
  if(g.status==='complete')return g.victory?.won?'旅程已经胜利结束。':'旅程已经结束。';
  if(g.status==='handover')return g.era?.lastGeneration?'本时代已到最后一代；确认后结清回报，下一时代从新随机人物开始。':'已准备交接，成年弟子可以接手，日期不会额外推进。';
  if(!l.heir)return `尚未有后辈。满 ${l.birthYears} 岁且尚无子嗣时迎来新生后辈。`;
  if(!l.heir.alive)return '后辈已故，当前不可继任。';
  if(l.heir.ageYears<l.adultYears)return `后辈尚未成年（${l.heir.ageYears} / ${l.adultYears} 岁）。`;
  if(l.pendingRetirement)return g.era?.lastGeneration?'已准备交接；确认交接后结束本时代，由新随机人物开启下一时代。':'已准备交接。确认后，由后辈接手。';
  return '后辈已成年，可以准备交接。';
}

function knownNames(g:Game, heir=false):string {
  const b=g.economy?.branchView;
  if(b)return b.nodes.filter(n=>heir?n.heirKnown:n.known).map(n=>n.name).join('、')||'尚未掌握课程';
  const list=heir?g.heir.mastered:g.person.mastered;
  return list.length?list.join('、'):'尚未掌握课程';
}

function personPortrait(p:{portrait:string;portraitEra:number;ageYears:number;alive:boolean;sex?:string;character?:{temperament:string}|null},name:string,fullBody=false):string {
  const personalities=['内敛细察','坦率热忱','沉静坚韧','谨慎认真','洒脱好奇','温厚耐心'];
  const temperament=personalities.indexOf(p.character?.temperament??'');
  // Early-era portraits share identity across three age bands. Other eras keep their era-specific art.
  if(temperament>=0&&p.ageYears>=12&&p.portraitEra<2&&(p.sex==='male'||p.sex==='female')){
    const age=p.ageYears<18?0:p.ageYears<55?1:2;
    if(fullBody)return `<div class="self-fullbody${p.alive?'':' is-deceased'}" role="img" aria-label="${esc(name)} · ${esc(p.character!.temperament)} · ${['少年','成年','老年'][age]}全身立绘" style="background-image:url('/illustrations/characters/sect-fullbody-${p.sex}.png');background-position:${temperament*20}% ${age*50}%"></div>`;
    return `<div class="person-portrait character-portrait${p.alive?'':' is-deceased'}" role="img" aria-label="${esc(name)} · ${esc(p.character!.temperament)} · ${['少年','成年','老年'][age]}人物插画" style="background-image:url('/illustrations/characters/sect-portraits-${p.sex}.png');background-position:${temperament*20}% ${age*50}%"></div>`;
  }
  const stage=p.ageYears<6?0:p.ageYears<12?1:p.ageYears<18?2:p.ageYears<35?3:p.ageYears<55?4:5;
  const ages=['幼年','儿童','少年','青年','中年','老年'];
  const eraNames=['农耕村落','市镇百工','电力工业','现代社会'];
  const eraSuffix=['','-town','-industry','-modern'][p.portraitEra];
  return `<div class="person-portrait${p.alive?'':' is-deceased'}" role="img" aria-label="${esc(name)} · ${eraNames[p.portraitEra]} · ${ages[stage]}肖像" style="background-image:url('/illustrations/characters/person-${esc(p.portrait)}${eraSuffix}.jpg');background-position:${stage%3*50}% ${stage<3?0:100}%"></div>`;
}
function family(g:Game,button:Button):string {
  if(g.sect)return sectPage(g,button);
  const l=g.life; if(!l)return '';
  const person=(who:'self'|'heir',actions='')=>{
    const p=who==='self'?l.person:l.heir;
    if(!p)return `<article class="person-card"><h3>后辈</h3><p>尚未有后辈。</p></article>`;
    const name=who==='self'?g.person.name:g.heir.name;
    const raising=who==='heir'&&p.upbringing?`<p class="subtle">养育记录：饱食 ${p.upbringing.fedSeasons} 季 · 陪伴 ${p.upbringing.companySeasons} 季 · 受教 ${p.upbringing.taughtSeasons} 季${p.ageYears<l.adultYears?`（成年时按记录结算体质，出生天赋终身保留${l.seasonCompany?'；本季已陪伴':'；本季尚未陪伴'}）`:'（成年评估已完成）'}</p>`:'';
    return `<article class="person-card">${personPortrait(p,name)}<h3>${esc(name)} <small>${who==='self'?'本代经营者':'后辈'} · ${p.sex==='male'?'男':'女'} · ${p.ageYears} 岁 · ${p.alive?'在世':'已故'}</small></h3><p><span class="tag">出生天赋 · ${esc(p.talent.name)}</span> ${esc(p.talent.effect)}</p>${meter('健康',p.health,p.maxHealth??100,'health')}<p class="pressure-value">压力值 <strong>${p.pressure}</strong> · 劳动耗时 +${Math.round((p.timeMultiplier-1)*100)}%</p>${raising}<p class="subtle">已知学习：${esc(knownNames(g,who==='heir'))}</p>${actions?`<div class="compact-actions">${actions}</div>`:''}</article>`;
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
  if(foodWarning(g))tasks.push({title:'近期饮食不足',detail:`还缺 ${food?.missing??Math.max(0,g.parameters.foodPerTurn-e.foodTotal)} 份口粮`,page:'生活'});
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
    <section class="estate-board"><div class="estate-copy"><span class="chapter-kicker">门中田地</span><h3>${fieldTitle}</h3><p>肥力 ${f.fertility}/3 · ${f.crop?`生长 ${f.growth}/${f.duration} 天`:'尚未播种'}</p>${f.crop?`<p>预计收成 ${e.harvest} · 水分 ${f.moisture}</p>`:''}<button type="button" data-page="农业">去田地 →</button></div><div class="painted-art field-dashboard-art" style="background-image:url('${artUrl(fieldArt(f))}')" aria-hidden="true"></div></section>
    <div class="dashboard-pair"><section class="dashboard-card food-board"><div class="painted-art art-food" aria-hidden="true"></div><h3>生活保障</h3><span class="status-pill ${foodWarning(g)?'status-warning':''}">${foodWarning(g)?'需要补给':'近期储备充足'}</span><p class="board-number">${Number(e.foodTotal.toFixed(3))}<small>份可食储备</small></p><p>每日饮食 ${g.life?.diet?.dailyGrain??0} 批 · 预计支持 ${g.life?.diet?.days??0} 天</p><dl class="board-ledger"><div><dt>预计购粮</dt><dd>${food?.purchase??0} 份</dd></div><div><dt>预计花费</dt><dd>${food?.cost??0} 钱</dd></div><div><dt>生活缺口</dt><dd>${food?.missing??Math.max(0,g.parameters.foodPerTurn-e.foodTotal)} 份</dd></div></dl><button class="text-btn" type="button" data-page="生活">去补给与谋生 →</button></section>
    <section class="dashboard-card family-board"><h3>师徒传承</h3><div class="painted-art art-family" aria-hidden="true"></div><div class="family-snapshot"><div><strong>当前传人${l?` · ${l.person.ageYears}岁`:''}</strong>${l?meter('健康',l.person.health,l.person.maxHealth??100):''}</div><div><strong>${l?.heir?`弟子 · ${l.heir.ageYears}岁`:'尚未收徒'}</strong>${l?.heir?meter(l.heir.alive?'健康':'已故',l.heir.health,l.heir.maxHealth??100):''}</div></div><button class="text-btn" type="button" data-page="家人">查看我的状态 →</button></section></div>
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
  const category=(id:string)=>id.startsWith('seed')?'种子':['food',...EDIBLE].includes(id)?'口粮':['wood','clay','stone','straw','fiber','iron','copper','oil','polymer'].includes(id)?'原料':'加工品与其他';
  const groups=['口粮','种子','原料','加工品与其他'].map(name=>{const entries=stock.filter(([id])=>category(id)===name);return entries.length?`<section class="stock-group"><h3>${name}<small>${entries.length} 种</small></h3><dl class="inventory-grid">${entries.map(([id,n])=>`<div class="inventory-item"><dt>${itemImage(id)}<span>${esc(id==='food'?'即食粮':ALL_GOODS[id]?.name??id)}</span></dt><dd class="num">${n}</dd></div>`).join('')}</dl></section>`:'';}).join('');
  return panel('仓库',`<div class="place-overview warehouse-overview">${sceneArt('warehouse')}<div><span class="chapter-kicker">家里的物资账</span><h3>储备与保存</h3><dl class="stock-summary"><div><dt>可食储备</dt><dd>${Number(e.foodTotal.toFixed(3))}<small>份</small></dd></div><div><dt>食品保护容量</dt><dd>${e.storage}</dd></div><div><dt>即食粮</dt><dd>${g.family.food}</dd></div></dl><p class="subtle">插画为仓储场景示意，实际库存见下方清单。</p></div></div>${groups||'<p class="stock-empty">暂无物资，可以去集市采购或田地收获。</p>'}<p class="subtle">面粉、小麦、大豆、小米、稻谷、稻米、小豆、葵菜、芥菜与腌菜依序补生活缺口；种子不当饭吃。食品保护容量不代表整个仓库的存放上限。</p><div class="stock-links"><button type="button" class="text-btn" data-page="商城">去集市补给 →</button><button type="button" class="text-btn" data-page="农业">查看田地 →</button></div>`);
}

function attention(g:Game,page:string):string {
  const e=g.economy!,l=g.life;
  if(page==='生活')return `<h3>生活缺口</h3>${g.socialFood?`<p>政策 ${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱 · 缺口 ${g.socialFood.missing} 份</p>${g.socialFood.reasons.map(r=>`<p class="blocked-reason">${esc(r)}</p>`).join('')}`:`<p>饮食可支持 ${g.life?.diet?.days??0} 天</p>`}<p><button type="button" class="text-btn" data-page="商城">去集市</button></p>`;
  if(page==='仓库')return `<h3>口粮与保存</h3><p>即食粮 ${g.family.food} · 可食储备 ${Number(e.foodTotal.toFixed(3))} · 保护容量 ${e.storage}</p><p class="subtle">超出保护容量的物资可能发生保存损耗。种子不当饭吃。</p><p><button type="button" class="text-btn" data-page="生活">去补给与谋生</button></p>`;
  if(page==='安排'){const o=e.operationsView;return `<h3>当前安排</h3>${g.socialFood?`<p>吃饭：${esc(g.socialFood.policyName)} · 预计购 ${g.socialFood.purchase} 份 / ${g.socialFood.cost} 钱</p>`:''}${o?`<p>田地 ${o.farm?'托管':'亲自经营'} · 生产${o.production?'已安排':'未安排'} · 补货${o.supplies?'开':'停'} · 交付${o.sales?'开':'停'} · 维护${o.maintenance?'开':'停'}</p>${o.paused?'<p class="blocked-reason">经营安排已暂停，等待接续。</p>':''}`:''}<p><button type="button" class="text-btn" data-page="${e.industryView?'系统':'家业'}">查看产业运行</button></p>`;}
  if(l)return `<h3>日历余量</h3><p>本阶段可用天数 ${l.budget.freeTime}<br>当前压力 ${l.budget.pressure}</p>`;
  return `<h3>当下关注</h3><p>选择一项后，这里会显示条件和报价。</p>`;
}

const OWN_SPREAD=new Set(['图鉴','工坊','贸易','资本','农业','聚落','家人','修炼','学科','制造','系统','雇佣','商城','能源','社会','家业','作坊','副本','试炼']);

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
  const l=g.life,end=g.status==='complete'||g.status==='ended';
  const groups=playerGroups(g),group=groups.find(x=>x.pages.includes(page))??(page==='图鉴'?{name:'图鉴',pages:['图鉴']}:groups[0]);
  const low=foodWarning(g);
  const settle=g.actions.find(a=>a.id==='economy:erasettle:stage');
  const stageExit=g.era&&!end&&settle?`<button type="button" class="stage-exit-button" data-action="economy:erasettle:stage" data-confirm="era" ${!settle.enabled||g.status==='handover'?'disabled':''}>${g.era.index===3?'结束旅程':'结束当前阶段'} →</button>`:'';
  const masthead=`<header class="chronicle-masthead"><div><div class="eyebrow">CIVILIZATION MINI</div><h1>隐士修所 <span>师徒传承</span></h1><p class="rule-line">规则 ${esc(g.rulesVersion)}${g.era?` · ${esc(g.era.framework.name)}`:''}</p></div><div class="masthead-meta"><div class="masthead-stage"><span>${l?esc(g.person.name):'当前家族'}${g.era?` · ${esc(g.era.stage.name)} · 剩余 ${g.era.timeBudget.remaining} 天`:''}</span>${stageExit}</div><div class="masthead-links"><button type="button" class="text-btn" data-page="图鉴" aria-current="${page==='图鉴'?'page':'false'}">${chromeImage('nav-study','utility-image')}<span>图鉴</span></button><details class="options-menu"><summary class="text-btn">${chromeImage('status-save','utility-image')}<span>选项</span></summary><div class="options-panel"><a href="/start">打开其他旅程</a><a href="/start#legacy" target="_blank" rel="noopener">门派缘起与传承之志 ↗</a><a href="/">入口</a><a href="/ai">AI 文本玩法</a><button type="button" id="export">导出存档</button><label class="file-button">导入存档<input id="import" type="file" accept=".json,application/json" hidden></label><p class="subtle">结果由固定规则结算；浏览器存档在开始界面打开或新开，命令行存档在 saves/。</p></div></details><button type="button" class="text-btn" data-guide="${esc(page)}">${chromeImage('status-help','utility-image')}<span>帮助</span></button></div></div></header>`;
  const navigationArt:Record<string,string>={近况:'season',农场:'farm',人物:'family',集市:'market',经营与交易:'trade',社会历程:'society'};
  const nav=`<nav class="chapter-nav" aria-label="篇章" style="--chapter-count:${groups.length}">${groups.map(x=>`<button type="button" class="chapter-tab" data-page="${x.pages.includes(page)?page:x.pages[0]}" aria-current="${x===group?'page':'false'}" title="${esc(x.description)}">${x.name==='人物'&&g.life?`<span class="self-nav-portrait">${personPortrait(g.life.person,g.person.name)}</span>`:stageModules[x.name]?`<img class="chapter-image era-nav-image" src="/illustrations/ui/era-nav-${stageModules[x.name].art}.webp" alt="" width="96" height="96">`:g.sect&&x.name==='人物'?sectImage(x.name==='人物'?0:1,'sect-navigation-picture'):chromeImage('nav-'+navigationArt[x.name],navigationArt[x.name]==='society'?'chapter-image chapter-image-society':'chapter-image')}<span>${esc(x.name)}</span>${stageModules[x.name]?`<small class="era-nav-stage">${(g.era?.index??0)<stageModules[x.name].stage?['一阶段','二阶段','三阶段','四阶段'][stageModules[x.name].stage]:stageModules[x.name].stage===3?'筹备中':'生产已开放'}</small>`:''}</button>`).join('')}</nav>
    ${group.pages.length>1?`<nav class="chapter-subnav" aria-label="${esc(group.name)}分页">${group.pages.map(p=>`<button type="button" data-page="${p}" class="${page===p?'selected':''}" aria-current="${page===p?'page':'false'}">${placeIcon(p)}<span>${pageNames[p]??p}</span></button>`).join('')}</nav>`:''}`;
  const calendar=l?.calendar;
  const hud=calendar&&l?(()=>{
    const latest=calendar.termEvents.at(-1);
    const seasonArt=({春:'spring',夏:'summer',秋:'autumn',冬:'winter'} as Record<string,string>)[calendar.season]??'spring';
    const stat=(art:string,label:string,value:string,detail:string)=>`<div class="overview-stat">${chromeImage('status-'+art,'overview-resource-art')}<div class="overview-stat-copy"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div></div>`;
    const days=calendar.month.days.map(d=>{const note=d.term||d.festivals[0]||'';return `<span class="month-day ${d.today?'today':''} ${note?'occasion':''}" ${d.today?'aria-current="date"':''} title="${esc([calendar.month.name+d.label,d.term,...d.festivals].filter(Boolean).join(' · '))}"><b>${d.day}</b><small>${esc(note||d.label)}</small></span>`;}).join('');
    return `<section class="journey-overview" aria-label="日历与当前状态"><section class="lunar-month" aria-label="${esc(calendar.month.name)}日历"><header><div><small>第${calendar.year}年 · ${calendar.yearName}年</small><strong>${esc(calendar.month.name)}</strong></div><span>${esc(calendar.lunarDate)} · ${calendar.period}</span></header><div class="month-weekdays" aria-hidden="true">${['日','一','二','三','四','五','六'].map(d=>`<span>${d}</span>`).join('')}</div><div class="month-grid">${'<span class="month-blank"></span>'.repeat(calendar.month.offset)}${days}</div></section><div class="overview-main"><div class="overview-resources" aria-label="当前资源">${stat('energy','压力值',`${l.person.pressure}`,`耗时 +${Math.round((l.person.timeMultiplier-1)*100)}% · 无上限`)}${stat('food','粮食可支持',`${l.diet?.days??0}<em> 天</em>`,l.diet?.name??'简单饮食')}${stat('money','钱财',`${g.family.money}`,'可用于补给与建设')}${stat('time','阶段余日',`${l.budget.freeTime}<em> 天</em>`,`预留劳动 ${l.budget.reservedTime} 天`)}</div><div class="overview-environment"><section class="overview-weather" aria-label="当前天气"><img src="/illustrations/scenes/weather-${g.world.weather}-v1-ui.webp" alt="" width="280" height="280"><div><h3>${calendar.weather.name}<small>土地水分随天气变化</small></h3><p>${esc(calendar.weather.effect)}</p><span>约 ${calendar.weather.days} 天后变化</span></div></section><section class="overview-term" aria-label="节气与节日"><span class="overview-season-art"><img src="/illustrations/scenes/almanac-${seasonArt}-v1-ui.webp" alt="" width="88" height="88" decoding="async"><span class="term-season">${calendar.season}</span></span><div><h3>${esc(calendar.currentTerm)}${calendar.festivals.map(f=>`<small class="today-festival" title="${esc(f.description)}">${esc(f.name)}</small>`).join('')}</h3><p>${esc(calendar.termDescription)}</p><div class="overview-upcoming">${calendar.upcoming.slice(0,2).map(d=>`<span title="${esc(d.date)}">${esc(d.name)} <b>${d.days}天后</b></span>`).join('')}</div></div></section></div><div class="overview-notice" aria-label="最近节气见闻"><img class="overview-notice-art" src="/illustrations/farm/farm-affairs-story.webp" alt="" width="30" height="30" decoding="async">${latest?`<span>${esc(latest.term)}见闻</span><strong>${esc(latest.title)}</strong><b class="${latest.positive?'gain':'cost'}">${esc(latest.effect)}</b><p title="${esc(latest.date)} · 已结算">${esc(latest.text)}</p>`:`<span>田间消息</span><p>下一节气「${esc(calendar.nextTerm?.name??'')}」会有新的见闻，日常劳作经过当天也会触发。</p>`}</div></div></section>`;
  })():'';
  const recapHtml=recap?`<section class="chapter-recap" aria-live="polite"><h2>${esc(recap.title)}</h2>${recap.lines.map(t=>/第\d+季 · /.test(t)?encounterCard(t):`<p>${esc(t)}</p>`).join('')}<button type="button" class="text-btn" data-dismiss-recap>关闭回顾</button></section>`:'';
  const main=guide?ruleGuide(g,page):stageModules[page]?stageModulePage(g,page,body):page==='聚落'?village(g,events):page==='家人'?family(g,button):page==='仓库'?inventory(g):body;
  const spread=guide||OWN_SPREAD.has(page)?main:`<div class="spread-body"><div class="reading-pane">${main}</div><aside class="attention-pane">${attention(g,page)}</aside></div>`;
  const budget=l?`<details class="budget-details"><summary>查看劳动安排 · 预留 ${l.budget.reservedTime} 天 / ${l.budget.reservedEnergy} 压力</summary><p>已过 ${l.budget.spentTime} 天 · 阶段剩余 ${l.timeRemaining} 天</p>${l.budget.tasks.map(t=>`<p>${esc(t.name)} <span class="tag">${t.time} 天 / 压力 +${t.energy}</span></p>`).join('')||'<p>暂无系统任务</p>'}</details>`:'';
  const season=end?`<div><h3>${g.status==='ended'?'传承与使命终止':g.victory?.won?'旅程胜利':'旅程结束'}</h3><p>${esc(endingCopy(g))}</p><p><a class="text-btn" href="/start">回到开始界面</a></p></div>`:g.status==='handover'?`<div><h3>${g.sect?'师徒整代交接':g.era?.lastGeneration?'新时代人物':'后辈接手'}</h3><p>${esc(successionState(g))}</p></div><div class="action-primary">${button('handover')}</div>`:`<div><h3>日历与等待</h3><ul class="check-list">${seasonCheck(g).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div><div class="action-primary">${button('economy:wait:half')}${button('economy:wait:week')}${g.life?.calendar?'':button('economy:end:season')}</div>${budget}`;
  return `<div class="chronicle-shell ${g.sect?'sect-theme':''} ${page==='家人'?'is-self-home':''} page-${pageArt(page)} ${page==='聚落'?'is-dashboard':''}">${masthead}${nav}${hud}${low?'<div class="food-alert" role="status">现有干粮、食材与柴火不足以支持一周饮食。<button type="button" data-page="农业">去田地</button><button type="button" data-page="商城">买补给</button><button type="button" data-page="生活">找生计</button></div>':''}<div class="chronicle-spread">${recapHtml}<header class="chapter-head ${g.sect&&['家人','修炼'].includes(page)?'sect-chapter-heading':page!=='聚落'?'illustrated-heading':''}">${page!=='聚落'&&!(g.sect&&['家人','修炼'].includes(page))?`<div class="painted-art art-${pageArt(page)}" aria-hidden="true"></div>`:''}<div class="section-heading"><div><h2>${page==='聚落'?'经营近况':pageNames[page]??page}</h2><p class="chapter-epigraph">${esc(chapterEpigraph(g,page))}</p></div>${!guide?`<button type="button" class="text-btn" data-guide="${esc(page)}">${page==='农业'?'土地指南':page==='家人'?'状态与传承说明':(pageNames[page]??page)+'规则'}</button>`:''}</div></header>${spread}${page==='聚落'||end||g.status==='handover'?`<div class="season-bar">${season}</div>`:''}</div></div>`;
}

export function cultivationPage(g:Game,button:Button,selected=''):string {
 const x=g.sect;if(!x)return '';
 const m=x.members.find(p=>p.id===x.activeId)!;
 const picked=x.courses.find(c=>c.id===selected)??x.courses.find(c=>!c.known&&!c.missing.length)??x.courses[0];
 const fmt=(n:number)=>Number(n.toFixed(2));
 const status=(c:typeof picked)=>c.known?'已修成':c.missing.length?'待前课':c.done>0?'修习中':'可修习';
 const node=(c:typeof picked)=>`<button type="button" class="cultivation-course ${c.known?'known':c.missing.length?'locked':'ready'} ${picked.id===c.id?'selected':''}" data-cultivation="${c.id}" aria-pressed="${picked.id===c.id}" aria-label="${esc(c.name+'，'+status(c))}"><span class="cultivation-course-top"><small>${c.id}</small><small>${status(c)}</small></span>${cultivationImage(c.id)}<strong>${esc(c.name)}</strong><span>${fmt(c.done)} / ${c.total} 修习</span></button>`;
 const foundation=x.courses.filter(c=>c.track==='foundation').map(node).join('');
 const paths=(['body','mind','reason','conduct'] as const).map(track=>`<section class="cultivation-path cultivation-path-${track}" aria-label="${x.tracks[track].name}"><h4>${x.tracks[track].name}</h4><p>${x.tracks[track].description}</p><div class="cultivation-chain">${x.courses.filter(c=>c.track===track).map(node).join('')}</div></section>`).join('');
 const synthesis=x.courses.filter(c=>c.track==='synthesis');
 const requirements=picked.parents.length?picked.parents.map(id=>{const c=x.courses.find(v=>v.id===id)!;return `<button type="button" class="text-btn" data-cultivation="${c.id}">${c.known?'✓':'○'} ${esc(c.name)}</button>`;}).join(''):'<span>入门课程，无前置</span>';
 const detail=`<div class="cultivation-detail-art">${cultivationImage(picked.id,'cultivation-selected-art')}</div><span class="eyebrow">${x.tracks[picked.track].name} · ${picked.id}</span><h3>${esc(picked.name)}</h3><p>${esc(picked.summary)}</p><div class="cultivation-source"><small>名称与思想出处</small><p>${esc(picked.source)}</p></div><blockquote>${esc(picked.exercise)}</blockquote><div class="cultivation-prerequisites"><small>前置课程 · 全部修成后开放</small><div>${requirements}</div></div>${meter('修习进度',fmt(picked.done),picked.total)}<div class="cultivation-effect"><span>课程效果</span><strong>待定</strong><small>目前记录修习与传承，不提供数值加成。</small></div>${picked.known?'<p class="learned-stamp">✓ 已修成 · 疏于日课不会遗失</p>':button(picked.learnActionId)}<p class="subtle">精修可分段接续，完成本次投入后温养功课。</p><details class="cultivation-teaching"><summary>传给弟子</summary>${picked.disciple?`<p>${esc(x.members.find(p=>p.id===picked.disciple!.id)?.name??'弟子')} · ${fmt(picked.disciple.progress)} / ${picked.total}</p>`:'<p>正式收徒后，可传授自己已修成的课程。</p>'}${button(picked.teachActionId)}</details>`;
 return `<div class="cultivation-page"><div class="sect-banner"><div class="sect-art sect-art-practice" aria-hidden="true"></div><div><span class="eyebrow">修身入门 · 四支习学 · 会通所知</span><h3>一日有一日的功课</h3><p>调息、观心、明理、应事。所学记在自己身上，心得留给后来的人。</p></div></div><div class="cultivation-toolbar"><div><strong>${esc(m.name)}</strong> · 第${m.generation}代<span>修成 ${m.completedCourses.length} / ${x.courses.length} 门</span><span>课程效果待定</span></div><button type="button" class="text-btn" data-page="家人">师徒与传承 →</button></div><div class="cultivation-workbench curriculum-workbench"><section class="cultivation-tree" aria-label="修行课程树"><div class="cultivation-foundation">${foundation}</div><p class="cultivation-tree-caption">修身之后，四支可以分别修习</p><div class="cultivation-paths">${paths}</div><div class="cultivation-synthesis"><h4>会通 · 各前课均须修成</h4><div class="cultivation-synthesis-pair">${synthesis.slice(0,2).map(c=>`<div><p>${c.parents.map(id=>x.courses.find(v=>v.id===id)!.name).join(' ＋ ')} ↓</p>${node(c)}</div>`).join('')}</div><div class="cultivation-foundation"><p>知常 ＋ 成己成物 ↓</p>${node(synthesis[2])}</div></div><p class="subtle">课程次序与习练内容为门中编排，借用诸家思想，不复刻某一历史门派。</p></section><aside class="cultivation-inspector" aria-label="修行课程详情" aria-live="polite">${detail}<section class="cultivation-daily"><h4>日课 · 温习所学</h4>${meter('功课储备（天）',fmt(m.cultivation.upkeep),x.rules.upkeepMax)}<p>随日历消耗；每次温习补充${x.rules.upkeepGain}天，最多${x.rules.upkeepMax}天。归零不会遗失课程。</p>${button(x.dailyActionId)}<p class="subtle">效果留空期间，功课状态暂不影响行动效率。</p></section></aside></div><div class="cultivation-footer"><button type="button" class="text-btn" data-page="农业">回到田间 →</button><button type="button" class="text-btn" data-page="学科">前往学艺 →</button></div></div>`;
}
function characterCard(m:NonNullable<Game['sect']>['members'][number]):string {
 const c=m.life?.character;if(!c)return '';
 const junior=(m.life?.ageYears??0)<18;
 const styleArt=c.style.startsWith('素衣')?7:c.style.startsWith('衣着整洁')?9:c.style.startsWith('偏爱旧物')?11:c.style.startsWith('装束利落')?4:c.style.startsWith('喜用温和')?12:14;
 const talentArt=({'健壮':13,'善学':8,'善教':0,'善组织':9,'善恢复':12} as Record<string,number>)[m.life?.talent.name??'']??7;
 return `<div class="character-identity"><p><span class="tag">${m.life?.sex==='male'?'男':'女'}</span> <span class="tag">${esc(c.temperament)}</span> <span class="tag">${junior?'职业见习 · ':''}${esc(c.occupation)}</span></p><p class="character-trait subtle">${sectImage(styleArt,'character-trait-art')}<span>${esc(c.style)}</span></p><p class="character-trait">${sectImage(talentArt,'character-trait-art')}<span><strong>天赋 · ${esc(m.life?.talent.name??'')}</strong><br>${esc(m.life?.talent.effect??'')}</span></p><p>${esc(c.background)}</p><p>学习点 · ${m.life?.experiences?.learning??0} <span class="subtle">学习可节省时间时自动消耗1点，基础时间减少1，最低1时间</span></p>${(m.life?.earnedTalents??[]).map(t=>`<p>后天天赋 · ${esc(t.name)}：${esc(t.effect)}</p>`).join('')}<p>人物关系 · ${m.relationships.map(q=>esc(q.name)+' '+q.value).join(' / ')||'尚无往来记录'}</p>${encounterCard(m.life?.experiences?.lastEvent??'尚未经历季末事件')}<p class="character-feeling"><span class="character-mood-label">此刻心境</span>${esc(c.mood)}</p><details data-fold="character-${esc(m.id)}"><summary>牵挂与成长</summary><p><strong>牵挂</strong> · ${esc(c.attachment)}</p><p><strong>心愿</strong> · ${esc(c.aspiration)}</p><ol>${c.memories.map(n=>`<li><span class="subtle">${n.age}岁</span>${encounterCard(n.text,true)}</li>`).join('')||'<li>故事尚待续写。</li>'}</ol><p class="subtle">职业为社会身份，能力以天赋与实际所学为准。</p></details></div>`;
}

function sectPage(g:Game,button:Button):string {
 const x=g.sect!,me=x.members.find(m=>m.id===x.activeId)!,p=me.life!,l=g.life!,e=g.economy!;
 const members=x.members.filter(m=>m.admitted),disciple=members.find(m=>m.id===me.discipleId);
 const peers=x.current.filter(id=>id!==x.activeId).map(id=>members.find(m=>m.id===id)!).filter(Boolean);
 const candidates=x.members.filter(m=>!m.admitted);
 const plots=e.farm?.plots??[],fields=plots.filter(t=>t.kind==='field');
 const ready=fields.filter(t=>t.field?.crop&&t.field.growth>=t.field.duration).length;
 const learned=e.branchView?.nodes.filter(n=>n.known).length??g.person.mastered.length;
 const end=['ended','complete'].includes(g.status);
 const link=(page:string,label:string,destination='')=>`<button type="button" class="text-btn" data-page="${page}" ${destination?`data-destination="${destination}"`:''}>${label} →</button>`;
 const notices:{title:string;detail:string;action:string}[]=[];
 if(end)notices.push({title:'这一段旅程已结束',detail:endingCopy(g),action:'<a href="/start">回到开始页 →</a>'});
 else if(g.status==='handover')notices.push({title:'轮到弟子接续了',detail:successionState(g),action:button('handover')});
 else {
  if(foodWarning(g))notices.push({title:'先准备这一季的口粮',detail:`可食储备 ${Number(e.foodTotal.toFixed(3))} 份，当前库存与预计购粮尚不足以覆盖季耗。`,action:link('农业','去买补给','market')});
  if(p.health<(p.maxHealth??100))notices.push({title:'照顾一下身体',detail:`健康 ${p.health} / ${p.maxHealth??100}，可查看疗养的条件与费用。`,action:button('economy:care:self')});
  if(l.person.pressure>20)notices.push({title:'压力正在影响效率',detail:`当前压力 ${l.person.pressure}，劳动耗时增加${Math.round((l.person.timeMultiplier-1)*100)}%。主动放松可降低压力。`,action:button('economy:rest:self')});
  if(ready)notices.push({title:`${ready} 块田地可收获`,detail:'作物已经成熟，去田地安排收成。',action:link('农业','去收获','field')});
  if(l.pendingRetirement)notices.push({title:'已准备交接',detail:'确认由弟子接续。',action:''});
 }
 const personDetail=(m:typeof me)=>`<article class="self-person-detail">${m.life?personPortrait(m.life,m.name):''}<h4>${esc(m.name)}</h4><p>${m.life?.ageYears??'—'} 岁 · ${m.life?.alive?'在世':'已故'} · 修成 ${m.completedCourses.length} 门修行课程</p>${characterCard(m)}</article>`;
 return `<div class="self-home self-visual-home">
 <div class="self-visual-opening"><section class="self-hero" aria-label="我的当前状态"><div class="self-identity"><span class="eyebrow">${l.calendar.date} · ${esc(g.world.weatherName)}</span><h3>${esc(me.name)}</h3><p>第 ${me.generation} 代传人 · ${p.ageYears} 岁 · ${esc(p.character?.occupation??'门中传人')}</p><span class="tag">${esc(p.character?.temperament??'门中传人')}</span><span class="tag" title="${esc(p.talent.effect)}">天赋 · ${esc(p.talent.name)}</span><p class="self-mood">${esc(p.character?.mood??'')}</p><div class="self-personal-progress"><span>修行 <strong>${me.completedCourses.length}/${x.courses.length} 门</strong></span><span>功课储备 <strong>${me.cultivation.upkeep} 天</strong></span></div></div><div class="self-portrait">${personPortrait(p,me.name,true)}</div><div class="self-vitals">${meter('健康',p.health,p.maxHealth??100,'health')}<p class="pressure-value">压力值 <strong>${p.pressure}</strong><br><small>无上限 · 劳动耗时 +${Math.round((p.timeMultiplier-1)*100)}%</small></p>${meter('阶段余日',l.budget.freeTime,g.era?.timeBudget.limit??l.timePerSeason)}<small>已过 ${l.budget.spentTime} 天 · 预留 ${l.budget.reservedTime} 天 / ${l.budget.reservedEnergy} 压力</small></div></section>
 </div>
 <div class="self-season-strip"><span>可食储备 <strong>${Number(e.foodTotal.toFixed(3))}</strong> 份</span><span>饮食可支持 <strong>${l.diet?.days??0}</strong> 天</span><span>钱财 <strong>${g.family.money}</strong></span><span>修行课程 <strong>${me.completedCourses.length}</strong> 门</span><span>修行效果 <strong>待定</strong></span><span>已掌握 <strong>${learned}</strong> 门课程</span></div>
 ${notices.length?`<section class="self-focus"><div class="self-section-title"><h3>此刻需要留意</h3><span>${notices.length} 项</span></div>${notices.map(n=>`<article class="self-notice"><div><h4>${n.title}</h4><p>${esc(n.detail)}</p></div>${n.action}</article>`).join('')}</section>`:''}
 <section class="self-records"><div class="self-section-title"><h3>人在山中，事在心上</h3><span>经历与关系 · 按需展开</span></div>
 <details data-fold="self-story"><summary><img class="self-record-art" src="/illustrations/scenes/self-record-story.webp" alt="" width="112" height="88" loading="lazy"><strong>我的经历</strong><span>性情、所学与成长记录</span></summary><div class="self-record-body">${characterCard(me)}<h4>已经掌握的知识</h4><p>${esc(knownNames(g))}</p></div></details>
 ${storyPanel(g,'relaxation')}${landscapeBenefits(g,'memorial')}${storyArchive(g)}<details data-fold="self-rest"><summary><img class="self-record-art" src="/illustrations/scenes/self-record-rest.webp" alt="" width="112" height="88" loading="lazy"><strong>放松与调养</strong><span>健康 ${p.health} · 压力 ${l.budget.pressure}</span></summary><div class="self-record-body self-action-list">${g.actions.filter(a=>a.id.startsWith('economy:rest:')).map(a=>button(a.id)).join('')}${button('economy:wait:week')}${button('economy:care:self')}</div></details>
 <details data-fold="self-peers"><summary><img class="self-record-art" src="/illustrations/scenes/self-record-peers.webp" alt="" width="112" height="88" loading="lazy"><strong>我的同门</strong><span>${peers.map(m=>esc(m.name)).join('、')||'暂无同门'}</span></summary><div class="self-record-body">${peers.map(personDetail).join('')}${link('农业','拜访同门','neighbor')}</div></details>
 <details data-fold="self-disciple"><summary><img class="self-record-art" src="/illustrations/scenes/self-record-disciple.webp" alt="" width="112" height="88" loading="lazy"><strong>我的弟子</strong><span>${disciple?esc(disciple.name)+' · '+(disciple.life?.ageYears??'—')+' 岁':'尚未收徒 · 寻访有缘人'}</span></summary><div class="self-record-body">${disciple?personDetail(disciple):'<p>寻访后先了解候选人的资质，再决定是否收徒。</p>'}${candidates.map(personDetail).join('')}<div class="self-action-list">${button('economy:sectseek:disciple')}${button('economy:sectadmit:disciple')}${g.actions.filter(a=>a.id.startsWith('economy:bond:')).map(a=>button(a.id)).join('')}</div></div></details>
 <details data-fold="self-lineage"><summary><img class="self-record-art" src="/illustrations/scenes/self-record-lineage.webp" alt="" width="112" height="88" loading="lazy"><strong>我的传承</strong><span>${g.status==='handover'?'等待接续':l.pendingRetirement?'已准备交接':x.ready?'弟子已成年，可安排交接':'师承谱系与代际交接'}</span></summary><div class="self-record-body"><p>${esc(successionState(g))}</p><div class="self-action-list">${button('economy:retire:family')}${button('handover')}${g.actions.filter(a=>a.id.startsWith('economy:consult:')).map(a=>button(a.id)).join('')}</div><details data-fold="self-history"><summary>历代门人 · ${members.length} 人</summary>${members.map(personDetail).join('')}</details></div></details></section>
 ${!l.calendar&&!end&&g.status!=='handover'?`<footer class="self-season"><div><strong>安排好这一季，再向前</strong><span>季末会结算生活消耗、生产与恢复。</span></div>${g.life?.calendar?'':button('economy:end:season')}</footer>`:''}
 </div>`;
}
