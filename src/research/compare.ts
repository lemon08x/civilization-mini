import type { RunResult } from './runner.js';

export function compareRuns(results: RunResult[], baselineId = 'baseline') {
  return results.filter(r => r.variant !== baselineId).map(candidate => {
    const baseline = results.find(r => r.variant === baselineId && r.scenario === candidate.scenario && r.agent === candidate.agent && r.seed === candidate.seed);
    if (!baseline) throw new Error(`缺少配对基线：${candidate.runId}`);
    return { candidate: candidate.runId, baseline: baseline.runId, money: candidate.metrics.money - baseline.metrics.money, foodShortfall: candidate.metrics.foodShortfall - baseline.metrics.foodShortfall, learnedNodes: candidate.metrics.learnedNodes.length - baseline.metrics.learnedNodes.length, inheritedNodes: candidate.metrics.inheritedNodes.reduce((n, r) => n + r.nodes.length, 0) - baseline.metrics.inheritedNodes.reduce((n, r) => n + r.nodes.length, 0) };
  });
}
export function reportMarkdown(results: RunResult[]): string {
  return [
    '# 配对规则实验', '',
    '控制器类型逐局记录；scripted 为脚本基线，不是大模型。候选不会自动替换规则。', '',
    '| 参数组 | 场景 | 玩家 | 控制器 | 种子 | 状态 | 钱财 | 口粮 | 缺粮 | 学会数 | 继承数 | 试验样本 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...results.map(r => `| ${r.variant} | ${r.scenario} | ${r.agent} | ${r.controller} | ${r.seed} | ${r.metrics.status} | ${r.metrics.money} | ${r.metrics.food} | ${r.metrics.foodShortfall} | ${r.metrics.learnedNodes.length} | ${r.metrics.inheritedNodes.reduce((n, g) => n + g.nodes.length, 0)} | ${r.metrics.samples} |`), '',
    '## 配对变化', '',
    ...compareRuns(results).map(r => `- ${r.candidate} 对 ${r.baseline}：钱财 ${r.money >= 0 ? '+' : ''}${r.money}，缺粮 ${r.foodShortfall}，学会数 ${r.learnedNodes}，继承数 ${r.inheritedNodes}。`), '',
    '不计算统一胜利分。先看对应轨迹，再区分参数、世界机制与代理策略的问题；需要采纳时再做少量留出检查和人工试玩。',
  ].join('\n');
}
