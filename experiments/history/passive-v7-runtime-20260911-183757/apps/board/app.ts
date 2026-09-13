import { progressPanel } from './progress-panel.js';
import { NETWORK_NAMES } from '../../src/game/model/product-network.js';
import { DISCIPLINE_NAMES, GOOD_NAMES } from '../../src/game/model/development.js';
import { createSession, submitCommand, observeSession } from '../../src/runtime/session.js';
import { importLegacy, importRecord, replayRecord } from '../../src/runtime/replay.js';
import type { Session, ImplementationIdentity } from '../../src/runtime/records.js';
import { validateRuleset } from '../../src/game/ruleset.js';
import { chooseAction } from '../../src/agents/scripted/baseline.js';
import { POLICY_NAMES } from '../../src/agents/contract.js';
import type { PolicyId } from '../../src/agents/contract.js';
import { boardView } from './view.js';
import type { BoardView } from './view.js';
import { MATERIAL_NAMES, RECIPE_NAMES } from '../../src/game/model/production.js';
import type { Material } from '../../src/game/model/production.js';
const KEY = 'civilization-mini.rules-lab.v8';
const $ = (id: string) => document.getElementById(id) as HTMLInputElement;
const escape = (text: unknown) => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
const implementation: ImplementationIdentity = await (await fetch('/implementation.json')).json();
const ruleset = validateRuleset(await (await fetch('/rulesets/household-progress.v7.json')).json());
const legacyRuleset = validateRuleset(await (await fetch('/rulesets/traditional-agriculture.v1.json')).json());
const fresh = (seed=17, scenarioId='woodland') => createSession({runId: crypto.randomUUID(), ruleset, implementation, seed, scenarioId});
let state: Session = await fresh();
let lifeCategory='all';
let group = '获取', showUnavailable = false, policy = 'mixed', busy = false, loadFailed = false;
let storageRaw = localStorage.getItem(KEY);
function error(message: string) { $('error').textContent = message; $('error').hidden = !message; }
try {
  if (storageRaw) state = await replayRecord(JSON.parse(storageRaw), implementation);
} catch (failure) { loadFailed = true; error('原存档未覆盖：' + (failure as Error).message); }
function commit(next: Session, backup=false) {
  if (localStorage.getItem(KEY) !== storageRaw) throw new Error('另一页面已更新存档，请刷新后继续');
  if (backup && storageRaw) localStorage.setItem(KEY + '.backup.' + Date.now(), storageRaw);
  const raw = JSON.stringify(next.record);
  localStorage.setItem(KEY, raw); storageRaw = raw; state = next; loadFailed=false; error(''); render();
}
async function act(id: string, revision: number) {
  if (busy || loadFailed) return; busy=true;
  try { commit((await submitCommand(state, {commandId: state.record.manifest.runId + ':' + revision, expectedRevision: revision, actionId:id})).session); }
  catch(failure) { render(); error((failure as Error).message); } finally {busy=false;}
}
function techCard(tech: BoardView["technologies"][number], o: BoardView) {
  const available = o.actions.some(a => a.id === `study:${tech.id}` && a.enabled);
  const status = tech.mastered ? '已掌握' : tech.studied || tech.practicesDone.length ? '学习中' : available ? '可学习' : '条件未满足';
  const names = (ids: string[]) => ids.map(id => o.technologies.find(t => t.id === id)?.name ?? id).join('、');
  const action = o.actions.find(a => a.id === `study:${tech.id}`);
  return `<div class="tech ${tech.mastered ? 'mastered' : tech.studied ? 'learning' : ''}"><h3>${escape(tech.name)}<span>${status}</span></h3><p>社会基础：${escape(tech.world)}</p><p>前置：${escape(names(tech.prerequisites) || '无')}</p>${tech.prerequisiteAny ? `<p>替代前置（任选）：${escape(names(tech.prerequisiteAny))}</p>` : ''}${tech.helpfulPrerequisites ? `<p>有利经验（非必需）：${escape(names(tech.helpfulPrerequisites))}</p>` : ''}<p>学习来源：${tech.accessible ? '可接触' : '当地无教师，需取得方法材料'}</p><p>学习 ${tech.studied}/${tech.required} · 实践 ${tech.practicesDone.length}/${tech.practices.length}</p><p class="benefit">${escape(tech.benefit)}</p>${tech.archived ? `<p>▣ 家族有完整材料${o.society ? '，已计入理论学习减免；实践不免' : ''}</p>` : ''}${tech.heirMastered ? '<p>● 后辈已掌握</p>' : tech.heirStudied ? `<p>后辈学习 ${tech.heirStudied} 次</p>` : ''}${action?.enabled ? `<button data-action="${escape(action.id)}">学习 · ${action.ap} 行动${action.money ? ` / ${action.money} 钱财` : ''}</button>` : ''}</div>`;
}

function render() {
  const o = boardView(state);
  if (!o.production && ['获取', '制作', '保存', '交换'].includes(group)) group = '生活';
  const policies = Object.entries(POLICY_NAMES).filter(([id]) => o.production || !['woodworker', 'potter', 'mixed'].includes(id));
  if (!policies.some(([id]) => id === policy)) policy = 'subsistence';
  $('rule-notice').textContent = `规则 ${o.rulesVersion} · ${o.society ? '持续成长 / 农业、工业与科学' : o.technologyOutcomes ? '科技改变生活 / 设施、批量制作与传承' : o.production ? '跨地域生产 / 木作、陶作、储存与农业' : '旧农业基线'} · 每代${o.clock.turnsPerGeneration}季是实验窗口，数值仍待检验`;
  const names = (ids: string[]) => ids.map(id => o.technologies.find(t => t.id === id)?.name ?? id).join('、') || '尚无';
  $('scenario').value = state.record.manifest.scenarioId;
  $('seed').value = String(state.record.manifest.seed);
  const actions = o.actions.filter(a => a.group === group && a.id !== 'end-turn' && a.id !== 'handover' && (showUnavailable || a.enabled));
  const end = ['complete', 'ended'].includes(o.status);
  const results = o.results;
  $('app').innerHTML = `
    <section class="status" aria-label="当前局面">
      <div class="counter primary"><small>${escape(o.scenario.name)} · ${escape(o.world.weatherName)}</small><strong>第 ${o.clock.generation} 代 / 第 ${o.clock.turn} 季</strong></div>
      <div class="counter"><small>行动点</small><strong>${o.ap} <span class="subtle">/ ${o.parameters.actionsPerTurn}</span></strong></div>
      <div class="counter"><small>口粮 · 季耗 ${o.parameters.foodPerTurn}</small><strong>${o.family.food}</strong></div>
      <div class="counter"><small>钱财</small><strong>${o.family.money}</strong></div>
      <div class="counter"><small>连续困顿 / ${o.parameters.hardshipLimit}</small><strong>${o.family.hardship}</strong></div>
    </section>
    <section class="feedback" aria-live="polite">${o.feedback.map(line => `<p>${escape(line)}</p>`).join('')}</section>
    ${o.status === 'handover' ? `<section class="terminal"><h2>交接前，看清真正留下了什么</h2><p>后辈已掌握：${escape(names(o.heir.mastered))}。家族有方法材料：${escape(names(o.family.archives))}。${o.family.project ? '正在进行的试种项目会保留。' : ''}</p><p>未教会、未留存的个人技艺不会复制；家庭实物继续保留。</p><button data-action="handover">开始后辈的经营窗口</button></section>` : ''}
    ${end ? `<section class="terminal"><h2>${o.status === 'complete' ? '实验观察结束' : '实验因连续生活缺口终止'}</h2><p>累计耕作产粮 ${results.foodProduced}${results.production ? `、采食 ${results.production.gatheredFood}、损耗 ${results.production.spoiledFood}、手工交换收入 ${results.production.craftEarnings}` : ''}，生活缺口 ${results.foodShortfall}，用水 ${results.waterUsed}。掌握过 ${results.learnedNodes.length} 个节点，取得 ${results.samples} 次试种记录。</p><p>这不是统一胜负分。导出轨迹后比较生活、学习、设施与传承的取舍。</p></section>` : ''}
    ${progressPanel(o)}
    ${lifePanel(o)}
    ${productNetworkPanel(o)}
    <div class="workspace"><div>
      ${developmentPanel(o)}
      ${productionPanel(o)}
      ${outcomesPanel(o)}
      ${societyPanel(o)}
      <section class="panel"><div class="panel-head"><h2>世界与行动</h2><small>行动结果来自同一规则引擎</small></div><div class="panel-body">
        <div class="world-strip"><span class="tag">雨水 ${o.world.rain}</span><span class="tag">公共可引水 ${o.world.water}</span><span class="tag">耕作：${o.actions.some(a => a.id === 'cultivate' && a.enabled) ? `当前可得 ${o.harvest.food} 粮` : '本季不可再执行'}</span></div>
        <p class="subtle">${escape(o.scenario.description)}<br>社会技术：${o.world.technologies.map(escape).join(' · ')}。技能不等于设备，家学不等于个人掌握。</p>
        ${!end && o.status !== 'handover' ? `<nav class="tabs" aria-label="行动类型">${(o.production ? ['获取', '制作', ...(o.development ? ['工业', '科学'] : []), '保存', '交换', '生活', '学习', '实践', '设施', '研究', '传承', ...(o.society ? ['社会'] : [])] : ['生活', '学习', '实践', '设施', '研究', '传承']).map(item => `<button data-group="${item}" class="${group === item ? 'selected' : ''}">${item}</button>`).join('')}</nav>
        <div class="action-grid">${actions.map(a => `<button class="action-card" data-action="${escape(a.id)}" ${!a.enabled || loadFailed ? 'disabled' : ''}><strong>${escape(a.label)}</strong><span class="cost">${a.ap} 行动${a.money ? ` · ${a.money} 钱财` : ''}${a.food ? ` · ${a.food} 口粮` : ''}${Object.entries(a.materials ?? {}).map(([id, amount]) => ` · ${amount} ${MATERIAL_NAMES[id as Material]}`).join('')}</span><span>${escape(a.enabled ? a.description : a.reason)}</span></button>`).join('') || '<p class="empty">当前没有可用行动。可以查看未满足的条件，或切换行动类型。</p>'}</div>
        <div class="actions-footer"><label><input id="unavailable" type="checkbox" ${showUnavailable ? 'checked' : ''}> 显示未满足条件的行动</label><button class="turn-button" data-action="end-turn" ${loadFailed ? 'disabled' : ''}>结束本季 · 消耗 ${o.parameters.foodPerTurn} 口粮</button></div>` : '<p class="subtle">可以继续查看能力、资产和历史记录，或在顶部开启新实验。</p>'}
      </div></section>
      <section class="panel"><div class="panel-head"><h2>家庭与长期项目</h2><small>跨代保存的四类东西</small></div><div class="panel-body">
        <div class="family-grid"><div class="family-item"><strong>个人 / 后辈</strong><p>我：${escape(names(o.person.mastered))}<br>后辈：${escape(names(o.heir.mastered))}</p></div><div class="family-item"><strong>方法材料</strong><p>${escape(names(o.family.archives))}<br>提供学习来源，不直接复制能力。</p></div><div class="family-item"><strong>生产实物</strong><p>渠道：${o.family.channel ? `耐用 ${o.family.channel.durability}/${o.parameters.channelDurability}` : '未建成'}<br>种源：${escape(o.family.stock.name)}<br>丰水潜力 ${o.family.stock.potential} / 耐旱修正 ${o.family.stock.tolerance}</p></div><div class="family-item"><strong>试种项目</strong><p>${o.family.project ? `已经记录 ${o.family.project.samples.length}/${o.parameters.trialSeasons} 个耕作季` : '暂无进行中项目'}<br>${o.family.candidate ? `候选：${escape(o.family.candidate.name)}` : '暂无待定选种源'}<br>完整记录 ${o.family.reports.length} 份</p></div></div>
        ${o.family.reports.length ? `<details><summary>查看比较试种记录</summary><table><thead><tr><th>季</th><th>天气</th><th>原种源</th><th>候选</th></tr></thead><tbody>${o.family.reports.flatMap(r => r.samples).map(s => `<tr><td>${s.season}</td><td>${escape(s.weather)}</td><td>${s.control}</td><td>${s.candidate}</td></tr>`).join('')}</tbody></table><p class="subtle">这些是已观察到的条件，不预测未来天气。</p></details>` : ''}
      </div></section>
      <section class="panel"><div class="panel-head"><h2>策略对照</h2><small>脚本基线 ≠ 大模型</small></div><div class="panel-body"><div class="policy"><label>控制策略</label><select id="policy">${policies.map(([id, name]) => `<option value="${id}" ${policy === id ? 'selected' : ''}>${name}</option>`).join('')}</select><button id="policy-step" ${end || loadFailed ? 'disabled' : ''}>让策略走一步</button></div><p class="subtle" style="margin-top:12px">只执行一次合法行动，方便检查策略理由与实际结果。批量对照使用命令行，保留完整轨迹。</p></div></section>
    </div><div>
      <section class="panel"><div class="panel-head"><h2>技术与个人专精</h2><small>社会开放 → 学习 → 实践 → 掌握</small></div><div class="panel-body"><p class="tree-intro">世界提供技术条件。学习次数与实践同时满足后才掌握；只有建成设施或完成项目，能力才改变实际生活。</p>
      <div class="tree-columns">${[...new Set(o.technologies.map(t => t.branch))].map(branch => `<div><div class="branch-title">${branch}</div>${o.technologies.filter(t => t.branch === branch).map(t => `${techCard(t, o)}`).join('')}</div>`).join('')}</div></div></section>
      <section class="panel"><div class="panel-head"><h2>规则账本</h2><small>可重放 · 可追溯</small></div><div class="panel-body"><details><summary>最近 ${o.recentLog.length} 次行动</summary>${o.recentLog.map(entry => `<div class="trace"><strong>#${entry.revision} · ${escape(entry.actionId)}</strong>${entry.feedback.map(line => `<p>${escape(line)}</p>`).join('')}</div>`).join('')}</details><details><summary>当前实验参数</summary><table><tbody>${Object.entries(o.parameters).map(([key, value]) => `<tr><td>${escape(key)}</td><td>${value}</td></tr>`).join('')}</tbody></table></details><details><summary>已完成的世代</summary>${o.history.map(h => `<p>第 ${h.generation} 代：${escape(names(h.mastered))}；教会后辈：${escape(names(h.heir))}</p>`).join('') || '<p>尚无。</p>'}</details></div></section>
    </div></div>`;
  const revision = state.record.entries.length;
  document.querySelectorAll<HTMLButtonElement>('[data-life-category]').forEach(button=>button.addEventListener('click',()=>{lifeCategory=button.dataset.lifeCategory!;render();}));
  $('life-export')?.addEventListener('click',()=>{
    download('life-chronicle.json',{...o.chronicle,runId:state.record.manifest.runId,implementation:state.record.manifest.implementation,rulesFingerprint:state.record.manifest.rulesFingerprint});
  });
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => button.addEventListener('click', () => void act(button.dataset.action!, revision), { once: true }));
  document.querySelectorAll<HTMLButtonElement>('[data-group]').forEach(button => button.addEventListener('click', () => { group = button.dataset.group!; render(); }));
  $('unavailable')?.addEventListener('change', event => { showUnavailable = (event.target as HTMLInputElement).checked; render(); });
  $('policy')?.addEventListener('change', event => { policy = (event.target as HTMLSelectElement).value; });
  $('policy-step')?.addEventListener('click', () => { const id = chooseAction(observeSession(state), policy as PolicyId); if (id) void act(id, revision); });
}

function download(name: string, value: unknown) {
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)], {type:'application/json'}));
  const link=document.createElement('a'); link.href=url; link.download=name; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('new-game').addEventListener('click', async()=>{
  if(busy) return; busy=true;
  try {commit(await fresh(Number($('seed').value),$('scenario').value),true);} catch(failure){error((failure as Error).message);} finally {busy=false;}
});
$('export').addEventListener('click',()=>download('rules-lab.json',state.record));
$('observation').addEventListener('click',()=>download('observation.json',observeSession(state)));
$('import').addEventListener('change',async()=>{
 const file=$('import').files?.[0]; if(!file || busy)return; busy=true;
 try {if(file.size>5000000)throw new Error('存档文件超过 5 MB'); const raw=JSON.parse(await file.text()); commit(raw.formatVersion===1 ? await importLegacy(raw,legacyRuleset,implementation,crypto.randomUUID()) : await importRecord(raw,implementation,crypto.randomUUID()),true);}
 catch(failure){error('导入失败，原实验保留：'+(failure as Error).message);} finally {busy=false;$('import').value='';}
});
render();

function productionPanel(o: BoardView): string {
  const p = o.production;
  if (!p) return '';
  return `<section class="panel"><div class="panel-head"><h2>材料、制作与保存</h2><small>同一需求，多种工艺路径</small></div><div class="panel-body">
    <div class="world-strip">${Object.entries(p.inventory).map(([id, amount]) => `<span class="tag">${MATERIAL_NAMES[id as Material]} ${amount}</span>`).join('')}</div>
    <div class="family-grid">
      <div class="family-item"><strong>当地可采资源</strong><p>食物 ${p.stocks.wildFood} · 木材 ${p.stocks.timber} · 黏土 ${p.stocks.clay}<br>每次当前可取 ${p.gathering.food} 食物 / ${p.gathering.wood} 木材 / ${p.gathering.clay} 黏土<br>食物与木材按季有限恢复，黏土不恢复。</p></div>
      <div class="family-item"><strong>当季交换机会</strong><p>岗位 ${p.market.jobs} · 可售粮 ${p.market.food}<br>木容器订单 ${p.market.woodenware} · 陶器订单 ${p.market.pottery}<br>外来方法机会 ${p.market.methods}</p></div>
      <div class="family-item"><strong>在制品与工具</strong><p>${p.project ? `${p.project.batch ? '批量' : ''}${RECIPE_NAMES[p.project.recipe]}已成形${p.project.recipe === 'pottery' && p.project.started === o.clock.absoluteTurn ? '，等待跨季干燥' : '，可继续完成'}；原料已支付` : '暂无制作项目'}<br>采集工具耐用 ${p.toolDurability} / ${p.parameters.toolDurability}<br>在制品、工具和原料跨代保留。</p></div>
      <div class="family-item"><strong>储存条件</strong><p>木容器 ${p.storage.woodenware ? '已配置' : '未配置'} · 陶器 ${p.storage.pottery ? '已配置' : '未配置'}<br>保护余粮 ${p.storageCapacity}；若现在结束本季，吃粮后预计损失 ${p.spoilageAfterConsumption}<br>${o.society ? '无需学会制造，学习储存即可配置购买或继承的容器。' : '木作或陶作任选其一可进入储存学习。'}</p></div>
    </div></div></section>`;
}

function lifePanel(o:BoardView):string {
  const categories:Record<string,string>={all:'全部经历',life:'生活变化',practice:'手艺与研究',legacy:'家族接续',community:'当地社会'};
  const stages={prepared:'已具备条件',used:'已实际发生',continued:'已跨代使用'};
  return `<section class="panel"><div class="panel-head"><h2>经历与传承</h2><small>经历记录 · 不设人生总分</small></div><div class="panel-body">
    <button id="life-export">导出经历记录</button>
    <nav class="tabs" aria-label="经历类别">${Object.entries(categories).map(([id,name])=>`<button data-life-category="${id}" class="${lifeCategory===id?'selected':''}">${name}</button>`).join('')}</nav>
    ${[...o.chronicle.chapters].reverse().map(c=>`<details ${c.generation===o.clock.generation?'open':''}><summary>第${c.generation}代 · ${{'ongoing':'仍在经历','handed-over':'已交接','window-ended':'经营窗口结束','ended':'困顿终止'}[c.status]}</summary>
      <p>本代行动账单：${c.investment.actions}行动、${c.investment.money}钱、${c.investment.food}额外口粮；缺粮${c.hardship.seasons}季，共${c.hardship.foodMissing}口粮。这是代价与处境，不是评价。</p>
      <div class="family-grid">${c.facts.filter(f=>lifeCategory==='all'||f.category===lifeCategory).map(f=>`<article class="family-item"><strong>${escape(f.title)}</strong><small>第${f.turn}季 · ${stages[f.stage]}</small><p>${escape(f.detail)}</p><p>行动者：${escape(f.actor)} · 涉及：${escape(f.beneficiary)}</p><details><summary>核对事实来源</summary>${f.evidence.map(e=>{const entry=state.record.entries.find(x=>x.revision===e.revision);return `<p>行动#${e.revision} · 事件${e.eventIndex+1}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere">${escape(JSON.stringify(entry?.events[e.eventIndex],null,2))}</pre>`;}).join('')}</details></article>`).join('')||'<p>这类变化尚无记录。没有记录不代表这一生没有价值。</p>'}</div>
      ${c.unfinished.length?`<p>仍在进行的项目：${c.unfinished.map(escape).join('、')}。这是可以继续的工作，不记作失败。</p>`:''}
    </details>`).join('')}
    <details><summary>记录边界</summary><p class="subtle">${o.chronicle.limitations.map(escape).join(' ')}</p></details>
  </div></section>`;
}

function productNetworkPanel(o:BoardView):string {
  const n=o.productNetwork;if(!n)return '';
  const offer=(id:string)=>{const a=o.actions.find(a=>a.id===id);return a?`<button data-action="${escape(a.id)}" data-revision="${o.revision}" ${a.enabled?'':'disabled'}>${escape(a.label)}</button><small>${a.enabled?escape(a.description):escape(a.reason)}</small>`:'';};
  return `<section class="panel"><div class="panel-head"><h2>高级设备与操作</h2><small>库存 · 安装 · 使用</small></div><div class="panel-body">
    <p><a href="/review#technology">查看科技树与各科技的条件、产品和用途 →</a></p>
    <div class="world-strip">${n.nodes.filter(p=>Object.hasOwn(NETWORK_NAMES,p.id)).map(p=>`<span class="tag">${escape(p.name)} ${p.amount}</span>`).join('')}</div>
    <p>家用蓄水 ${n.storedWater}/2 · 公共水 ${o.world.water}。设备实物与安装后的耐用度分开记录，均可传给后代。</p>
    <details><summary>制造、安装与使用高级产品</summary><div class="family-grid">${n.devices.map(d=>`<div class="family-item"><strong>${NETWORK_NAMES[d.id]} · 剩余 ${n.installed[d.id]} 次</strong><p>${escape(d.effect)}</p>${offer('fabricate:'+d.id)}${offer('install-product:'+d.id)}</div>`).join('')}</div></details>
    ${n.project?offer('finish-product'):''}${offer('calibrate')}${offer('pump-water')}${offer('recycle-ceramics')}
  </div></section>`;
}

function developmentPanel(o:BoardView):string {
  const d=o.development;if(!d)return '';
  const offer=(id:string)=>{const a=o.actions.find(a=>a.id===id);return a?`<button data-action="${escape(a.id)}" data-revision="${o.revision}" ${a.enabled?'':'disabled'}>${escape(a.label)}</button><small>${a.enabled?`${a.ap}行动 · ${a.money}钱 · ${a.food}粮`:escape(a.reason)}</small>`:'';};
  return `<section class="panel development"><div class="panel-head"><h2>手艺成长、工业与科学</h2><small>真实实践积累 · 设备与工艺留给家族</small></div><div class="panel-body">
    <p>陶作 → 陶质构件 → 机械与实验器具 → 精密器件；农业 → 工坊补给 → 实验 → 工艺改良。</p>
    <div class="family-grid">${d.skills.map(s=>`<div class="family-item"><strong>${DISCIPLINE_NAMES[s.domain]} · 等级 ${s.level}</strong><p>经验 ${s.experience} / 下一等级 ${s.next} · 后辈 ${s.heirExperience}<br>家族工艺改良 ${d.designs[s.domain]} 次</p><progress max="${s.next}" value="${s.experience}" aria-label="${DISCIPLINE_NAMES[s.domain]}经验"></progress></div>`).join('')}</div>
    <div class="world-strip">${Object.entries(d.goods).map(([g,n])=>`<span class="tag">${GOOD_NAMES[g as keyof typeof GOOD_NAMES]} ${n}</span>`).join('')}</div>
    <p>农具耐用 ${d.fieldDurability} · 实验设备耐用 ${d.labDurability} · 本季专业采购 ${d.tradeRemaining} / 订单 ${d.ordersRemaining}。外购让你专攻一行，制造与使用不必由同一个人完成。</p>
    ${d.project?`<div class="family-item"><strong>工业在制品：${escape(d.recipes.find(r=>r.id===d.project!.recipe)?.name??d.project.recipe)}</strong><p>开工季 ${d.project.started}，原料已支付；后辈可接续。</p>${offer('finish-development')}</div>`:''}
    <details><summary>查看 6 条生产配方与开工条件</summary><div class="family-grid">${d.recipes.map(r=>`<div class="family-item"><strong>${escape(r.name)}</strong><p>${escape(r.benefit)}<br>${DISCIPLINE_NAMES[r.domain]}等级 ${r.level} · ${r.woodCost}木材 / ${r.clay}黏土 / ${r.food}基础口粮<br>${Object.entries(r.inputs).map(([g,n])=>`${n}${GOOD_NAMES[g as keyof typeof GOOD_NAMES]}`).join(' + ')} → ${r.outputAmount}${GOOD_NAMES[r.output]}</p>${offer(`develop:${r.id}`)}</div>`).join('')}</div></details>
    <p>在“科学”中开展材料对照、改良工艺，在“传承”中带后辈实习。经验由实际完成的工作获得；新一代不会自动得到前代的熟练度。</p>
    ${offer('conduct-experiment')}
  </div></section>`;
}

function outcomesPanel(o: BoardView): string {
  const outcomes = o.technologyOutcomes;
  if (!outcomes) return '';
  const storage = outcomes.storage;
  return `<section class="panel"><div class="panel-head"><h2>科技带来的改变</h2><small>学会 → 建成 → 改善生活</small></div><div class="panel-body">
    <p class="subtle">设施和方法可以留给后辈；个人手艺需要传授。批量生产节省的是制作劳动，原料和销路仍由你安排。</p>
    <div class="family-grid">${outcomes.workshops.map(workshop => {
      const action = o.actions.find(a => a.id === (workshop.built ? workshop.batchAction : workshop.buildAction));
      return `<div class="family-item"><strong>${escape(workshop.name)} · ${workshop.built ? '已建成' : workshop.mastered ? '已掌握建造手艺' : '尚需掌握手艺'}</strong>
        <p>每批 ${workshop.output} 件${MATERIAL_NAMES[workshop.material]}<br>同等产品：普通制作 ${workshop.ordinaryCraftActions} 行动 → 批量 ${workshop.batchCraftActions} 行动<br>${workshop.built && !workshop.mastered ? '继承了设施；新开批量项目仍需学会手艺。' : workshop.material === 'pottery' ? '陶坯仍需跨季干燥，燃料按两份配方投入。' : '同等原料，减少重复成形与装配。'}</p>
        ${action ? `<p>${action.ap} 行动${Object.entries(action.materials ?? {}).map(([id, amount]) => ` · ${amount} ${MATERIAL_NAMES[id as Material]}`).join('')}</p><button data-action="${escape(action.id)}" ${!action.enabled || loadFailed ? 'disabled' : ''}>${escape(action.label)}</button>${!action.enabled ? `<p>${escape(action.reason)}</p>` : ''}` : ''}</div>`;
    }).join('')}</div>
    <p class="subtle" style="margin:14px 0 0">${o.status === 'active' ? `若现在结束本季：只有基础储存会损失 ${storage.withoutContainers} 粮；现有容器下损失 ${storage.withContainers} 粮，容器本季可少损失 ${storage.avoidedNow} 粮。` : '本季已结算，储存收益预览在下一季更新。'}这是当前余粮的比较，不是累计收益。</p>
  </div></section>`;
}

function societyPanel(o: BoardView): string {
  const s = o.society;
  if (!s) return '';
  const names = (ids: string[]) => ids.map(id => o.technologies.find(t => t.id === id)?.name ?? id).join('、') || '尚无';
  const button = (id: string) => {
    const a = o.actions.find(a => a.id === id);
    return a ? `<p>${a.ap} 行动${a.money ? ` · ${a.money} 钱财` : ''}${Object.entries(a.materials ?? {}).map(([material, amount]) => ` · ${amount} ${MATERIAL_NAMES[material as Material]}`).join('')}</p><button data-action="${escape(id)}" ${!a.enabled || loadFailed ? 'disabled' : ''}>${escape(a.label)}</button>${!a.enabled ? `<p>${escape(a.reason)}</p>` : ''}` : '';
  };
  return `<section class="panel"><div class="panel-head"><h2>个人、家族与社会</h2><small>换一条人生路线，积累仍有用途</small></div><div class="panel-body">
    <div class="family-grid"><div class="family-item"><strong>这一生的能力</strong><p>${escape(names(o.person.mastered))}<br>可以选择新的行业；继承设施不会自动授予手艺。</p>${o.person.mastered.includes('observation') ? '' : button('study:observation')}</div>
    <div class="family-item"><strong>家族留下的条件</strong><p>方法：${escape(names(o.family.archives))}<br>家族方法少学 ${s.parameters.archiveDiscount} 次理论（最低 1 次），仍需前置和实践。设施、存货、合作关系跨代保留。</p></div></div>
    <p class="subtle" style="margin-top:14px">已向当地传授：${escape(names(s.methods))}。这些方法成为当地教学来源；学成匠人可接续作坊，商品也能被邻里使用。</p>
    <div class="family-grid">${s.contractsView.map(c => `<div class="family-item"><strong>${c.material === 'woodenware' ? '木作' : '陶作'}合作 · ${c.active ? '委托中' : '未委托'}</strong><p>${c.project ? `在制 ${c.project.remaining} 件，已付开工工资` : '没有在制品'}<br>${escape(c.reason || (c.project ? '本季可按剩余订单完工销售' : '本季具备开工条件'))}<br>每次开工付 ${s.parameters.wage} 钱；当地原料、订单不足会等待。</p>${button(`${c.active ? 'pause-contract' : 'entrust'}:${c.material}`)}<p>公共库存：${s.goods[c.material]} / ${s.parameters.goodsCapacity} 件；邻里每季使用一件。</p>${button(`buy-good:${c.material}`)}</div>`).join('')}</div>
    <p class="subtle" style="margin-top:14px">在“传承”中留存家族方法，在“社会”中讲授和指导邻里实践。作坊由匠人经营后，你可以把行动用于农业、研究或其他手艺。委托是有材料与工资成本的分工。</p>
  </div></section>`;
}

