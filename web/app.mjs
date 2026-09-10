import { applyAction, createGame, exportGame, importGame, metrics, observe } from '/src/engine.mjs';
import { chooseAction } from '/src/policies.mjs';
import { POLICY_NAMES } from '/src/rules.mjs';

const KEY = 'civilization-mini.rules-lab.v1';
const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
let state = createGame({ seed: 17 });
let group = '生活', showUnavailable = false, policy = 'legacy', busy = false, loadFailed = false;

function error(message) { $('error').textContent = message; $('error').hidden = !message; }
try {
  const raw = localStorage.getItem(KEY);
  if (raw) state = importGame(JSON.parse(raw));
} catch (failure) {
  loadFailed = true;
  error(`原存档未覆盖：${failure.message}。可导入有效存档，或开启新实验（旧原文会先备份）。`);
}

function commit(next, backup = false) {
  if (backup) {
    const raw = localStorage.getItem(KEY);
    if (raw) localStorage.setItem(`${KEY}.backup.${Date.now()}`, raw);
  }
  // 先保存，后更新界面；配额异常不会让内存先推进。
  localStorage.setItem(KEY, JSON.stringify(exportGame(next)));
  state = next; loadFailed = false; error(''); render();
}

function act(id, revision) {
  if (busy || loadFailed) return;
  busy = true;
  try { commit(applyAction(state, id, revision)); } catch (failure) { render(); error(failure.message); }
  finally { busy = false; }
}

function techCard(tech, o) {
  const status = tech.mastered ? '已掌握' : tech.studied || tech.practicesDone.length ? '学习中' : tech.prerequisites.every(id => o.person.mastered.includes(id)) ? '可学习' : '缺少前置';
  const names = ids => ids.map(id => o.technologies.find(t => t.id === id)?.name ?? id).join('、');
  const action = o.actions.find(a => a.id === `study:${tech.id}`);
  return `<div class="tech ${tech.mastered ? 'mastered' : tech.studied ? 'learning' : ''}"><h3>${escape(tech.name)}<span>${status}</span></h3><p>社会基础：${escape(tech.world)}</p><p>前置：${escape(names(tech.prerequisites) || '无')}</p><p>学习 ${tech.studied}/${tech.required} · 实践 ${tech.practicesDone.length}/${tech.practices.length}</p><p class="benefit">${escape(tech.benefit)}</p>${tech.archived ? '<p>▣ 家族有完整材料</p>' : ''}${tech.heirMastered ? '<p>● 后辈已掌握</p>' : tech.heirStudied ? `<p>后辈学习 ${tech.heirStudied} 次</p>` : ''}${action?.enabled ? `<button data-action="${escape(action.id)}">学习 · ${action.ap} 行动${action.money ? ` / ${action.money} 钱财` : ''}</button>` : ''}</div>`;
}

function render() {
  const o = observe(state);
  const names = ids => ids.map(id => o.technologies.find(t => t.id === id)?.name ?? id).join('、') || '尚无';
  $('scenario').value = state.scenario;
  $('seed').value = state.config.seed;
  const actions = o.actions.filter(a => a.group === group && a.id !== 'end-turn' && a.id !== 'handover' && (showUnavailable || a.enabled));
  const end = ['complete', 'ended'].includes(o.status);
  const results = metrics(state);
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
    ${end ? `<section class="terminal"><h2>${o.status === 'complete' ? '实验观察结束' : '实验因连续生活缺口终止'}</h2><p>累计产粮 ${results.foodProduced}，生活缺口 ${results.foodShortfall}，用水 ${results.waterUsed}。掌握过 ${results.learnedNodes.length} 个节点，取得 ${results.samples} 次试种记录。</p><p>这不是统一胜负分。导出轨迹后比较生活、学习、设施与传承的取舍。</p></section>` : ''}
    <div class="workspace"><div>
      <section class="panel"><div class="panel-head"><h2>世界与行动</h2><small>行动结果来自同一规则引擎</small></div><div class="panel-body">
        <div class="world-strip"><span class="tag">雨水 ${o.world.rain}</span><span class="tag">公共可引水 ${o.world.water}</span><span class="tag">本季耕作可得 ${o.harvest.food} 口粮</span></div>
        <p class="subtle">${escape(o.scenario.description)}<br>社会技术：${o.world.technologies.map(escape).join(' · ')}。技能不等于设备，家学不等于个人掌握。</p>
        ${!end && o.status !== 'handover' ? `<nav class="tabs" aria-label="行动类型">${['生活', '学习', '实践', '设施', '研究', '传承'].map(item => `<button data-group="${item}" class="${group === item ? 'selected' : ''}">${item}</button>`).join('')}</nav>
        <div class="action-grid">${actions.map(a => `<button class="action-card" data-action="${escape(a.id)}" ${!a.enabled || loadFailed ? 'disabled' : ''}><strong>${escape(a.label)}</strong><span class="cost">${a.ap} 行动${a.money ? ` · ${a.money} 钱财` : ''}${a.food ? ` · ${a.food} 口粮` : ''}</span><span>${escape(a.enabled ? a.description : a.reason)}</span></button>`).join('') || '<p class="empty">当前没有可用行动。可以查看未满足的条件，或切换行动类型。</p>'}</div>
        <div class="actions-footer"><label><input id="unavailable" type="checkbox" ${showUnavailable ? 'checked' : ''}> 显示未满足条件的行动</label><button class="turn-button" data-action="end-turn" ${loadFailed ? 'disabled' : ''}>结束本季 · 消耗 ${o.parameters.foodPerTurn} 口粮</button></div>` : '<p class="subtle">可以继续查看能力、资产和历史记录，或在顶部开启新实验。</p>'}
      </div></section>
      <section class="panel"><div class="panel-head"><h2>家庭与长期项目</h2><small>跨代保存的四类东西</small></div><div class="panel-body">
        <div class="family-grid"><div class="family-item"><strong>个人 / 后辈</strong><p>我：${escape(names(o.person.mastered))}<br>后辈：${escape(names(o.heir.mastered))}</p></div><div class="family-item"><strong>方法材料</strong><p>${escape(names(o.family.archives))}<br>提供学习来源，不直接复制能力。</p></div><div class="family-item"><strong>生产实物</strong><p>渠道：${o.family.channel ? `耐用 ${o.family.channel.durability}/${o.parameters.channelDurability}` : '未建成'}<br>种源：${escape(o.family.stock.name)}<br>丰水潜力 ${o.family.stock.potential} / 耐旱修正 ${o.family.stock.tolerance}</p></div><div class="family-item"><strong>试种项目</strong><p>${o.family.project ? `已经记录 ${o.family.project.samples.length}/${o.parameters.trialSeasons} 个耕作季` : '暂无进行中项目'}<br>${o.family.candidate ? `候选：${escape(o.family.candidate.name)}` : '暂无待定选种源'}<br>完整记录 ${o.family.reports.length} 份</p></div></div>
        ${o.family.reports.length ? `<details><summary>查看比较试种记录</summary><table><thead><tr><th>季</th><th>天气</th><th>原种源</th><th>候选</th></tr></thead><tbody>${o.family.reports.flatMap(r => r.samples).map(s => `<tr><td>${s.season}</td><td>${escape(s.weather)}</td><td>${s.control}</td><td>${s.candidate}</td></tr>`).join('')}</tbody></table><p class="subtle">这些是已观察到的条件，不预测未来天气。</p></details>` : ''}
      </div></section>
      <section class="panel"><div class="panel-head"><h2>策略对照</h2><small>脚本基线 ≠ 大模型</small></div><div class="panel-body"><div class="policy"><label>控制策略</label><select id="policy">${Object.entries(POLICY_NAMES).map(([id, name]) => `<option value="${id}" ${policy === id ? 'selected' : ''}>${name}</option>`).join('')}</select><button id="policy-step" ${end || loadFailed ? 'disabled' : ''}>让策略走一步</button></div><p class="subtle" style="margin-top:12px">只执行一次合法行动，方便检查策略理由与实际结果。批量对照使用命令行，保留完整轨迹。</p></div></section>
    </div><div>
      <section class="panel"><div class="panel-head"><h2>技术与个人专精</h2><small>社会开放 → 学习 → 实践 → 掌握</small></div><div class="panel-body"><p class="tree-intro">世界提供技术条件。学习次数与实践同时满足后才掌握；只有建成设施或完成项目，能力才改变实际生活。</p>
      ${techCard(o.technologies[0], o)}<div class="tree-columns">${['灌溉', '种源'].map(branch => `<div><div class="branch-title">${branch}</div>${o.technologies.filter(t => t.branch === branch).map((t, i) => `${i ? '<div class="connector">↓</div>' : ''}${techCard(t, o)}`).join('')}</div>`).join('')}</div></div></section>
      <section class="panel"><div class="panel-head"><h2>规则账本</h2><small>可重放 · 可追溯</small></div><div class="panel-body"><details><summary>最近 ${o.recentLog.length} 次行动</summary>${o.recentLog.map(entry => `<div class="trace"><strong>#${entry.revision} · ${escape(entry.actionId)}</strong>${entry.feedback.map(line => `<p>${escape(line)}</p>`).join('')}</div>`).join('')}</details><details><summary>当前实验参数</summary><table><tbody>${Object.entries(o.parameters).map(([key, value]) => `<tr><td>${escape(key)}</td><td>${value}</td></tr>`).join('')}</tbody></table></details><details><summary>已完成的世代</summary>${o.history.map(h => `<p>第 ${h.generation} 代：${escape(names(h.mastered))}；教会后辈：${escape(names(h.heir))}</p>`).join('') || '<p>尚无。</p>'}</details></div></section>
    </div></div>`;
  const revision = state.revision;
  document.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => act(button.dataset.action, revision), { once: true }));
  document.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => { group = button.dataset.group; render(); }));
  $('unavailable')?.addEventListener('change', event => { showUnavailable = event.target.checked; render(); });
  $('policy')?.addEventListener('change', event => { policy = event.target.value; });
  $('policy-step')?.addEventListener('click', () => { const id = chooseAction(observe(state), policy); if (id) act(id, revision); });
}

function download(name, value) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('new-game').addEventListener('click', () => {
  try { commit(createGame({ seed: Number($('seed').value), scenario: $('scenario').value }), true); } catch (failure) { error(failure.message); }
});
$('export').addEventListener('click', () => download(`rules-lab-${state.config.seed}-r${state.revision}.json`, exportGame(state)));
$('observation').addEventListener('click', () => download(`observation-r${state.revision}.json`, observe(state)));
$('import').addEventListener('change', async event => {
  const file = event.target.files[0];
  if (!file) return;
  try { if (file.size > 5_000_000) throw new Error('存档文件超过 5 MB'); commit(importGame(JSON.parse(await file.text())), true); }
  catch (failure) { error(`导入失败，原实验保留：${failure.message}`); }
  finally { event.target.value = ''; }
});
render();
