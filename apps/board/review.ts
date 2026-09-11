import type { Ruleset } from '../../src/game/ruleset.js';
import type { ImplementationIdentity } from '../../src/runtime/records.js';
import type { loadResearchIndex, parameterRows, ExperimentReview, Proposal } from './review-data.js';
type ReviewData = Awaited<ReturnType<typeof loadResearchIndex>> & { rules: Ruleset; implementation: ImplementationIdentity; rulesFingerprint: string; parameters: ReturnType<typeof parameterRows> };
const $ = (id: string) => document.getElementById(id)!;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const show = (v: unknown) => v === null || v === undefined ? '未设置 / 无此机制' : typeof v === 'object' ? JSON.stringify(v) : String(v);
const source = (path: string, label = path.split('/').at(-1)!) => `<button data-source="${esc(path)}">${esc(label)}</button>`;
const statuses: Record<string, string> = { pending_validation: '待验证', pending_decision: '待采纳', accepted: '已接受', rejected: '已拒绝', deferred: '暂不采纳' };
const kinds: Record<string, string> = { parameter: '参数调整', mechanism: '机制变更', strategy: '策略问题', interface: '界面改进' };
let data: ReviewData | undefined, tab = 'rules', selectedTech = 'woodworking', query = '', scope = 'all', status = 'all', sourceRequest = 0;
let frameworkNode = 'woodworking';
function frameworkPage(): string {
  const f = data!.framework;
  if (!f) return '<p class="notice">框架不可读取，请查看读取提示。</p>';
  const n = f.nodes.find(n=>n.id===frameworkNode) ?? f.nodes[0];
  const link = (id: string) => `<button data-knowledge="${esc(id)}">${esc(f.nodes.find(n=>n.id===id)?.name ?? id)}</button>`;
  const relationships = [['必要前置',n.required],['替代前置（任选）',n.alternative],['促进关系（不作门槛）',n.helpful],['思想讨论（无高低等级）',n.debates]] as const;
  const downstream = f.nodes.filter(x=>[...x.required,...x.alternative,...x.helpful,...x.debates].includes(n.id));
  return `<section class="card"><h2>跨领域知识框架 · ${esc(f.version)}</h2><p>${f.domains.length} 个领域 · ${f.nodes.length} 个节点 · ${f.nodes.filter(n=>n.status==='implemented').length} 个已接入 · ${f.nodes.filter(n=>n.status==='proposed').length} 个待实现。框架基于规则 ${esc(f.baseRulesVersion)}，候选尚不能在游戏中学习或产生收益。</p><p>世界已有 → 当地可接触 → 个人学习与实践 → 家庭具备应用条件 → 成果留给后代。关系属于待检验的游戏设计假设，不表示唯一的历史道路。</p><div class="sources">${source('docs/KNOWLEDGE_RESEARCH.md','研究流程与下一步')}${source('experiments/frameworks/knowledge.v1.json','机器可读框架')}</div></section>
    <div class="split"><section class="knowledge-domains">${f.domains.map(d=>`<article class="card"><h3>${esc(d.name)}</h3><div class="knowledge-list">${f.nodes.filter(x=>x.domain===d.id).map(x=>`<button data-knowledge="${esc(x.id)}" class="${x.id===n.id?'selected':''}" aria-pressed="${x.id===n.id}">${esc(x.name)} <small>${x.status==='implemented'?'已接入':'待实现'}${x.kind==='tradition'?' · 思想传统':''}</small></button>`).join('')}</div></article>`).join('')}</section>
    <section class="card knowledge-detail"><h2>${esc(n.name)}</h2><span class="tag ${n.status==='proposed'?'pending':''}">${n.status==='implemented'?'现行机制':'研究候选 · 尚无结算'}</span><p><strong>世界条件：</strong>${esc(n.world)}</p><p><strong>当地接触：</strong>${esc(n.access)}</p><p><strong>个人实践：</strong>${esc(n.practice)}</p><p><strong>家庭应用：</strong>${esc(n.application)}</p><p><strong>跨代留下：</strong>${esc(n.legacy)}</p><p><strong>投入与限制：</strong>${esc(n.cost)}</p><p class="notice"><strong>待研究：</strong>${esc(n.question)}</p>${relationships.map(([title,ids])=>`<p><strong>${title}</strong></p><div class="sources">${ids.map(link).join('')||'无'}</div>`).join('')}<p><strong>影响哪些节点</strong></p><div class="sources">${downstream.map(x=>link(x.id)).join('')||'尚未声明'}</div></section></div>
    <h2>研究队列 · 每轮只回答一个问题</h2><p class="muted">诊断信号不是因果结论。先检查策略是否尝试，再设基线和单项候选；已知失败应记录，不能不断降成本直到某个分数变高。</p><div class="grid">${f.questions.map(q=>`<section class="card"><h3>${esc(q.title)}</h3><div class="sources">${q.nodes.map(link).join('')}</div><p><strong>假设：</strong>${esc(q.hypothesis)}</p><p><strong>最小对照：</strong>${esc(q.probe)}</p><p><strong>成功条件：</strong>${esc(q.success)}</p><p><strong>同时检查：</strong>${esc(q.guardrails.join('；'))}</p><p><strong>停止或转向：</strong>${esc(q.stop)}</p><p class="muted">待实现节点：${q.nodes.filter(id=>f.nodes.find(n=>n.id===id)?.status==='proposed').map(id=>f.nodes.find(n=>n.id===id)!.name).join('、')||'无；可在当前机制内设计实验'}。${q.parameter?`现有候选参数：${esc(q.parameter)}`:'不支持直接参数覆盖；按问题设计策略对照或机制版本。'}</p></section>`).join('')}</div>
    <section class="card section-gap"><h2>轨迹诊断记录 · ${data!.audits.length}</h2><p>每份诊断保留原文件 SHA-256、原规则身份及事件位置；不代表重放验证，不合并历史版本。由研究者运行有限文件检查后，刷新即可读取。</p><pre>npm run research:audit -- &lt;逐局 record.json 路径&gt;</pre><div class="sources">${data!.audits.map(p=>source(p)).join('')||'尚无诊断记录；不会在页面打开时自动模拟。'}</div></section>`;
}
const parameterNames: Record<string, string> = {
  actionsPerTurn: '每季行动', turnsPerGeneration: '每代季数', generations: '观察代数', initialFood: '初始口粮', initialMoney: '初始钱财', foodPerTurn: '每季口粮消耗', workIncome: '每次做工收入', foodPrice: '单份粮食价格', cropPotential: '种源基础潜力', channelCost: '渠道建设费', channelDurability: '渠道耐用度', repairCost: '渠道维修费', trialCost: '试种成本', trialSeasons: '试种季数', trialLandCost: '试种占地', archiveCost: '方法留存费', studyCost: '学习费', trainingCost: '实践费', studyMultiplier: '理论学习倍率', hardshipLimit: '连续缺粮上限', gatherFood: '基础采食量', gatherWood: '基础采木量', gatherClay: '基础采土量', baseStorage: '基础保护余粮', woodenStorage: '木容器额外保护', potteryStorage: '陶器额外保护', spoilDivisor: '损耗除数', toolDurability: '工具耐用度', toolBonus: '工具采木增量', woodRecipeCost: '木作配方木材', potteryClayCost: '陶作黏土', potteryFuelCost: '陶作燃料', woodenwarePrice: '木容器价格', potteryPrice: '陶器价格', methodPrice: '外来方法价格', buildActions: '设施建设行动', workbenchWood: '工作台木材', kilnWood: '陶窑木材', kilnClay: '陶窑黏土', wage: '委托开工工资', goodsCapacity: '公共商品容量', archiveDiscount: '家学理论减免',
};
function currentValue(path: string): unknown { let value: unknown = data!.rules; for (const key of path.split('.')) { if (value === null || typeof value !== 'object' || !Object.hasOwn(value, key)) return null; value = (value as Record<string, unknown>)[key]; } return value; }

function rulesPage(): string {
  const r = data!.rules, p = r.parameters;
  return `<section class="card"><h2>现在固定的是什么？</h2><p>本页读取当前默认规则。每局开始后，机制与参数固定；实验可以使用独立候选，不能在局中改世界。冻结并非永远不能改：结构变化需新规则版本与迁移说明。</p>
    <div class="flow"><span>观察当前条件</span><b>→</b><span>选择合法行动</span><b>→</b><span>统一引擎结算</span><b>→</b><span>留下事件与跨代成果</span></div>
    <p class="muted">每季 ${p.actionsPerTurn} 行动 · 每代 ${p.turnsPerGeneration} 季 · 观察 ${p.generations} 代 · 季耗 ${p.foodPerTurn} 粮。短窗口不是人物完整寿命，也不是统一胜负条件。</p></section>
    <div class="grid three">
    <section class="card"><h3>时间与生活</h3><p>季末公共商品使用与委托结算 → 家庭吃粮 → 余粮损耗 → 终止/交接判断 → 换季天气与供给。</p><p>连续 ${p.hardshipLimit} 季缺粮终止。当前天气可见，未来天气不向玩家开放。</p></section>
    <section class="card"><h3>知识与科技</h3><p>${r.technologies.length} 个节点，区分必要前置、替代前置和有利经验。学习与实践一起满足才能掌握。</p><p>社会已有、当地可接触、本人会做、家庭有生产条件，是不同层次。</p></section>
    <section class="card"><h3>生产与设施</h3><p>原料开工扣除，产品完工才获得；陶器必须跨季干燥。设施开放批量制作，但材料与销路仍受限制。</p><p>货物、工具、容器、设施和在制品可以跨代保存。</p></section>
    <section class="card"><h3>家族传承</h3><p>方法材料减少后人的理论学习，最低仍需一次；前置与实践不免。继承资产不会自动复制个人技能。</p><p>下一代可以换行业，使用遗留容器并保留合作。</p></section>
    <section class="card"><h3>当地社会分工</h3><p>讲授与指导实践后形成当地方法来源；匠人可受托经营家族设施。开工工资、当地原料、跨季工序和订单决定实际货款。</p><p>公共商品来自真实销售，邻里使用或玩家购买都会扣库存。</p></section>
    <section class="card"><h3>明确尚未实现</h3><p>国家/全球技术扩散、其他家族自主研发、时代跃迁、迁居及完整劳动力市场。</p><p>目前七种内置策略是脚本基线，没有后台大模型研究或自动调参循环。</p></section></div>
    <section class="card section-gap"><h2>规则来源与版本</h2><p>以下文档按增量组成现行规则；原始配置记录精确参数与科技定义。旧报告只说明其运行时的版本。</p><div class="sources">${source('docs/DESIGN_DIRECTION.md','设计方向')}${source('docs/RULEBOOK_V2.md','生产基础')}${source('docs/TECHNOLOGY_FEEDBACK_V3.md','科技成果')}${source('docs/SOCIAL_INHERITANCE_V4.md','社会传承与迁移')}${source('rulesets/social-inheritance.v4.json','当前完整规则')}</div><details><summary>旧版规则（查看，不切换当前游戏）</summary><div class="sources">${source('rulesets/traditional-agriculture.v1.json','0.1.0 农业')}${source('rulesets/shared-production.v2.json','0.2.0 生产')}${source('rulesets/technology-feedback.v3.json','0.3.0 科技反馈')}</div></details></section>`;
}
function techPage(): string {
  const nodes = data!.rules.technologies, depths = new Map<string, number>();
  const depth = (id: string): number => { if (depths.has(id)) return depths.get(id)!; const t = nodes.find(n => n.id === id)!; const parents = [...t.prerequisites, ...(t.prerequisiteAny ?? []), ...(t.helpfulPrerequisites ?? [])]; const d = parents.length ? Math.max(...parents.map(depth)) + 1 : 0; depths.set(id, d); return d; };
  nodes.forEach(t => depth(t.id));
  const levels = new Map<number, number>(), positions = new Map<string, { x: number; y: number }>();
  for (const t of nodes) { const d = depth(t.id), row = levels.get(d) ?? 0; positions.set(t.id, { x: 20 + d * 205, y: 30 + row * 100 }); levels.set(d, row + 1); }
  const width = (Math.max(...depths.values()) + 1) * 205 + 20, height = Math.max(...levels.values()) * 100 + 30;
  const lines = nodes.flatMap(t => [['required', t.prerequisites], ['alternative', t.prerequisiteAny ?? []], ['helpful', t.helpfulPrerequisites ?? []]].flatMap(([kind, parents]) => (parents as string[]).map(id => { const a = positions.get(id)!, b = positions.get(t.id)!; return `<path class="edge ${kind}" d="M${a.x+175},${a.y+29} C${a.x+190},${a.y+29} ${b.x-15},${b.y+29} ${b.x},${b.y+29}" marker-end="url(#arrow)"/>`; }))).join('');
  const boxes = nodes.map(t => { const p = positions.get(t.id)!; return `<g class="node ${t.id === selectedTech ? 'selected' : ''}" role="button" tabindex="0" aria-label="查看${esc(t.name)}" data-tech="${esc(t.id)}" transform="translate(${p.x},${p.y})"><rect width="175" height="58" rx="6"/><text x="12" y="25">${esc(t.name.slice(0,10))}</text><text x="12" y="45" style="font-size:11px">${esc(t.branch)}</text></g>`; }).join('');
  const t = nodes.find(t => t.id === selectedTech) ?? nodes[0], names = (ids: string[]) => ids.map(id => nodes.find(n => n.id === id)?.name ?? id).join('、') || '无';
  return `<h2>科技关系网络</h2><p class="muted">横向滚动查看完整网络，点击节点查看条件与实际用途。这里展示配置中的完整网络，不表示当前人物已经掌握；横向位置只表示依赖，不是文明等级。</p><div class="split"><div><div class="network"><svg style="width:${width}px;max-width:none" viewBox="0 0 ${width} ${height}" aria-label="科技依赖关系"><defs><marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#70816d"/></marker></defs>${lines}${boxes}</svg></div><p class="legend"><span>━━ 必要前置</span><span style="color:#7586a6">┄┄ 替代前置（任选）</span><span style="color:#ac812d">┈┈ 有利经验（非必需）</span></p></div><section class="card"><h3>${esc(t.name)}</h3><p class="tag">${esc(t.branch)}</p><p>${esc(t.benefit)}</p><p><strong>必要前置：</strong>${esc(names(t.prerequisites))}</p><p><strong>替代前置：</strong>${esc(names(t.prerequisiteAny ?? []))}</p><p><strong>有利经验：</strong>${esc(names(t.helpfulPrerequisites ?? []))}</p><p><strong>基础理论：</strong>${t.study} 次 × 学习倍率；再按经验、家学减免，最低 1 次。</p><p><strong>实际实践：</strong>${esc(t.practices.map(tag => data!.rules.practiceNames[tag]).join('、'))}</p><p><strong>社会条件：</strong>${esc(t.world)}</p><details><summary>各地区的初始接触条件</summary>${Object.values(data!.rules.scenarios).map(s => `<p>${esc(s.name)}：${s.production?.teachers.includes(t.id) ? '有当地老师' : s.production?.imports.includes(t.id) ? '可交换外来方法' : '没有初始教学或进口来源'}</p>`).join('')}<small>后续家族方法和社会传授可以改变实际可接触性。</small></details></section></div>`;
}
function parametersPage(): string {
  const rows = data!.parameters.filter(p => (scope === 'all' || (scope === 'editable') === p.editable) && `${p.key} ${parameterNames[p.key.split('.').at(-1)!]}`.toLowerCase().includes(query.toLowerCase()));
  return `<section class="card"><h2>谁能改，什么时候改？</h2><div class="table-wrap"><table><tr><th>角色</th><th>权限</th></tr><tr><td>玩家代理</td><td>仅观察与选择合法行动；不能修改规则、资源或未来天气。</td></tr><tr><td>参数对照实验</td><td>开局前覆盖白名单参数，受整数范围与跨字段约束检查；本局运行中固定。</td></tr><tr><td>研究与开发</td><td>可另提机制/科技结构变更；需版本、验证与迁移方案，不自动采纳。</td></tr></table></div><p class="muted">配置里有数字不等于候选入口允许修改。下面的权限来自当前代码支持的参数集合。给代理完整 shell/编辑权限时，项目约定本身不是安全隔离。</p></section>
    <div class="filters"><input id="query" aria-label="搜索参数" placeholder="搜索参数或中文名称" value="${esc(query)}"><select id="scope" aria-label="参数权限"><option value="all">全部参数</option><option value="editable" ${scope==='editable'?'selected':''}>可实验覆盖</option><option value="fixed" ${scope==='fixed'?'selected':''}>未开放覆盖</option></select><button id="apply-filter">筛选</button></div>
    <section class="card"><p>${rows.length} 项。科技节点、前置、场景分布和新结算流程不属于参数覆盖入口。</p><div class="table-wrap"><table><thead><tr><th>参数</th><th>当前值</th><th>允许范围</th><th>候选权限</th></tr></thead><tbody>${rows.map(p=>`<tr><td>${esc(parameterNames[p.key.split('.').at(-1)!] ?? p.key)}<br><code>${esc(p.key)}</code></td><td>${p.value}</td><td>${p.bounds ? p.bounds.join(' — ') : '—'}</td><td>${p.editable ? '可在独立候选中覆盖' : '未接入候选白名单；需开发提案'}</td></tr>`).join('')}</tbody></table></div><details><summary>已有候选示例：基础保护容量 2 → 4（暂不采纳）</summary><pre>{ "production.baseStorage": 4 }</pre><p>候选另存 experiments/，对照不会覆盖 rulesets/。</p>${source('experiments/storage-capacity.json')}</details></section>`;
}
function proposalCard(p: Proposal & { file: string }): string {
  return `<article class="card"><div class="tags"><span class="tag ${p.status==='accepted'?'':'pending'}">${statuses[p.status]}</span><span class="tag">${kinds[p.kind]}</span><small>基线 ${esc(p.baseVersion)} → ${esc(p.targetVersion ?? '未定版本')}</small></div><h3>${esc(p.title)}</h3><p>${esc(p.question)}</p><p class="muted">来源：${esc(p.origin)}</p><p><strong>假设：</strong>${esc(p.hypothesis)}</p>
    <div class="table-wrap"><table class="difference"><tr><th>修改项</th><th>修改前</th><th>建议修改后</th><th>当前配置实际值</th></tr>${p.changes.map(c => `<tr><td>${esc(c.subject)}</td><td>${esc(show(c.before))}</td><td>${esc(show(c.after))}</td><td>${c.configPath ? `${esc(show(currentValue(c.configPath)))}<br><code>${esc(c.configPath)}</code>` : '机制说明：见规则与证据'}</td></tr>`).join('')}</table></div>
    <p><strong>验证结果：</strong>${esc(p.result)}</p><p><strong>副作用／限制：</strong>${esc(p.sideEffects)}</p><p><strong>决定：</strong>${esc(p.decision)}</p><p><strong>实际生效版本：</strong>${esc(p.adoptedVersion ?? '没有采纳记录')}</p>${p.status === 'accepted' && p.changes.some(c => c.configPath && JSON.stringify(currentValue(c.configPath)) !== JSON.stringify(c.after)) ? '<p class="notice">当前配置与此提案的部分值不同，请核对后续版本。历史接受状态不会自动改写。</p>' : ''}<details><summary>反证条件与证据</summary><p>${esc(p.counterEvidence)}</p><div class="sources">${p.evidence.map(f=>source(f)).join('')}${source(p.file,'结构化提案原文')}</div><p>关联实验：${p.experiments.map(id=>`<a href="#experiment-${esc(id)}">${esc(id)}</a>`).join('、') || '尚无'}</p></details></article>`;
}
function experimentCard(e: ExperimentReview): string {
  const proposals = data!.proposals.filter(p=>p.experiments.includes(e.id));
  const impl = e.implementation as { version?: string; codeFingerprint?: string } | null;
  const same = impl?.codeFingerprint === data!.implementation.codeFingerprint;
  const rows = e.results.map(value => { const r = value as Record<string, unknown>, m = r.metrics && typeof r.metrics === 'object' ? r.metrics as Record<string, unknown> : r; return `<tr><td>${esc(r.runId ?? r.variant ?? '—')}</td><td>${esc(r.scenario ?? r.scenarioId ?? '见清单')}</td><td>${esc(r.agent ?? r.variant ?? '见清单')}</td><td>${esc(m.status ?? '—')}</td><td>${esc(m.money ?? '—')}</td><td>${esc(m.food ?? '—')}</td><td>${esc(m.foodShortfall ?? '—')}</td></tr>`; });
  return `<article class="card" id="experiment-${esc(e.id)}"><h3>${esc(e.id)}</h3><div class="tags"><span class="tag historical">规则 ${esc(e.rulesVersion ?? '未知')}</span><span class="tag historical">${same ? '与当前实现相同' : '历史或未知实现'}</span><span class="tag">${esc(e.controllers.map(c=>c==='scripted'?'脚本基线（非大模型）':c==='llm'?'大模型控制器（按记录）':c).join('、') || '控制器未记录')}</span></div>
    <p>${proposals.length ? `关联 ${proposals.length} 个提案：${proposals.map(p=>esc(p.title)).join('、')}` : '尚无提案：有模拟记录，不表示研究者已经给出修改建议。'}</p>
    ${e.issues.map(i=>`<p class="notice">${esc(i)}</p>`).join('')}
    <details><summary>运行条件与原始指纹</summary><p>原记录实现版本：${esc(impl?.version ?? '未知')}</p><p class="mono">实现：${esc(impl?.codeFingerprint ?? '未记录')}<br>清单基线配置：${esc(e.rulesFingerprint ?? '未知')}</p><pre>${esc(JSON.stringify(e.conditions,null,2))}</pre><small>按原清单读取，未重新运行或重放。候选组可能有不同规则指纹，详见原始结果和逐局存档。</small></details>
    <details><summary>本次实验修改了什么？</summary>${e.parameterChanges.length ? `<div class="table-wrap"><table><tr><th>参数组</th><th>参数</th><th>原值 → 候选值</th></tr>${e.parameterChanges.map(c=>`<tr><td>${esc(c.variant)}</td><td><code>${esc(c.path)}</code></td><td>${esc(show(c.before))} → ${esc(show(c.after))}</td></tr>`).join('')}</table></div>` : '<p>清单没有参数覆盖。它可能比较策略或行动选择；不要把行为分组当作规则修改。</p>'}</details>
    <details><summary>结果摘要 · ${e.results.length} 条记录</summary>${rows.length ? `<div class="table-wrap"><table><tr><th>运行／分组</th><th>场景</th><th>策略／分组</th><th>状态</th><th>钱财</th><th>口粮</th><th>缺粮</th></tr>${rows.join('')}</table></div>` : '<p>没有可读结果。</p>'}<details><summary>完整指标（含专门实验的工资、货款等）</summary><pre>${esc(JSON.stringify(e.results,null,2))}</pre></details></details>
    <details><summary>原始文件与逐局证据 · ${e.files.length} 个</summary><div class="sources">${e.files.map(f=>source(f,f.includes('/runs/')?`轨迹 ${f.split('/').at(-1)}`:f.split('/').at(-1))).join('')}</div></details></article>`;
}
function researchPage(): string {
  const proposals = data!.proposals.filter(p => (status==='all'||p.status===status)&&`${p.title} ${p.question}`.includes(query));
  const experiments = data!.experiments.filter(e => !query || e.id.includes(query) || data!.proposals.some(p=>p.experiments.includes(e.id)&&`${p.title} ${p.question}`.includes(query)));
  return `<section class="card"><h2>从发现问题到实际生效</h2><div class="flow"><span>记录假设与差异</span><b>→</b><span>小批量对照</span><b>→</b><span>读轨迹与副作用</span><b>→</b><span>接受 / 拒绝 / 待研究</span><b>→</b><span>新版本生效</span></div><p class="muted">历史提案依据已有报告整理。当前没有大模型自动提案服务；模拟输出不会自动生成建议，也不会自动接受修改。刷新会读取新增实验和独立提案文件。</p><div class="sources">${source('docs/REVIEW_DESK.md','如何提交下一次研究提案')}</div></section>
    <div class="filters"><input id="query" aria-label="搜索研究记录" value="${esc(query)}" placeholder="搜索标题或实验目录"><select id="status" aria-label="提案状态"><option value="all">全部提案状态</option>${Object.entries(statuses).map(([k,v])=>`<option value="${k}" ${status===k?'selected':''}>${v}</option>`).join('')}</select><button id="apply-filter">筛选</button></div>
    <h2>修改提案 · ${proposals.length}</h2>${proposals.map(proposalCard).join('') || '<p class="empty">没有符合条件的提案。</p>'}<h2 class="section-gap">实验记录 · ${experiments.length}</h2><p class="muted">提案状态筛选只作用于上方提案；实验列表保留匹配搜索词的原始记录。</p>${experiments.map(experimentCard).join('') || '<p class="empty">没有可读的实验目录。</p>'}`;
}
function render() {
  if (!data) return;
  $('identity').innerHTML = `当前默认规则 <strong>${esc(data.rules.rulesVersion)}</strong> · 实现 ${esc(data.implementation.version)} · ${data.rules.technologies.length} 科技节点 · ${data.experiments.length} 份实验 · ${data.proposals.length} 个提案<details><summary>当前指纹</summary><div class="mono">规则 ${esc(data.rulesFingerprint)}<br>实现 ${esc(data.implementation.codeFingerprint)}</div></details>`;
  $('review').innerHTML = data.issues.map(i=>`<p class="notice">读取提示：${esc(i)}</p>`).join('') + ({ rules: rulesPage, technology: techPage, parameters: parametersPage, research: researchPage, framework: frameworkPage }[tab] ?? rulesPage)();
  document.querySelectorAll<HTMLButtonElement>('[data-knowledge]').forEach(b=>b.addEventListener('click',()=>{frameworkNode=b.dataset.knowledge!;render();document.querySelector('.knowledge-detail')?.scrollIntoView({block:'start'});}));
  document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.classList.toggle('selected', b.dataset.tab===tab));
  document.querySelectorAll<HTMLElement>('[data-tech]').forEach(b=> { const select=()=>{selectedTech=b.dataset.tech!;render();}; b.addEventListener('click',select);b.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();select();}}); });
  document.querySelectorAll<HTMLButtonElement>('[data-source]').forEach(b=>b.addEventListener('click',()=>void openSource(b.dataset.source!)));
  $('apply-filter')?.addEventListener('click',()=>{ query=($('query') as HTMLInputElement).value; if(tab==='parameters')scope=($('scope') as HTMLSelectElement).value;else status=($('status') as HTMLSelectElement).value;render(); });
  $('query')?.addEventListener('keydown',e=>{if(e.key==='Enter')$('apply-filter').click();});
}
async function openSource(path: string) {
  const request = ++sourceRequest;
  $('source-title').textContent = path; $('source-text').textContent = '正在读取…';
  const dialog = $('source') as HTMLDialogElement; if(!dialog.open)dialog.showModal();
  try { const response=await fetch(`/review-file?path=${encodeURIComponent(path)}`);if(!response.ok)throw new Error('文件不可读取或不在允许范围');const text=await response.text();if(request===sourceRequest)$('source-text').textContent=text; }
  catch(e){if(request===sourceRequest)$('source-text').textContent=(e as Error).message;}
}
async function refresh() {
  const button=$('refresh') as HTMLButtonElement;button.disabled=true;
  try { const response=await fetch('/review-data');if(!response.ok)throw new Error('无法读取审阅数据');data=await response.json() as ReviewData;render(); }
  catch(e){const message=document.createElement('p');message.className='notice';message.textContent=`${(e as Error).message}。已有显示保留，请重试。`;$('review').prepend(message);}
  finally{button.disabled=false;}
}
document.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>b.addEventListener('click',()=>{tab=b.dataset.tab!;query='';render();}));
$('refresh').addEventListener('click',()=>void refresh());
await refresh();
