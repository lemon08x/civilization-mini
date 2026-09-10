import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { applyAction, createGame, exportGame, metrics, observe } from '../src/engine.mjs';
import { chooseAction } from '../src/policies.mjs';
import { DEFAULT_PARAMETERS, POLICY_NAMES, POLICIES, RULES_VERSION, SCENARIOS } from '../src/rules.mjs';

try {
  const args = process.argv.slice(2);
  const option = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1]; };
  const seeds = (option('--seeds') ?? '7,17').split(',').map(Number);
  if (!seeds.length || seeds.length > 10 || seeds.some(s => !Number.isInteger(s) || s < 1 || s > 0xffffffff)) throw new Error('每批仅支持 1—10 个有效种子');
  const candidatePath = option('--candidate');
  const variants = [{ id: 'baseline', overrides: {} }];
  if (candidatePath) variants.push({ id: 'candidate', overrides: JSON.parse(await readFile(resolve(candidatePath), 'utf8')) });
  const output = resolve(option('--out') ?? `reports/${new Date().toISOString().replace(/[:.]/g, '-')}`);
  await mkdir(dirname(output), { recursive: true });
  await mkdir(output, { recursive: false });
  const runs = [];
  for (const variant of variants) {
    for (const scenario of Object.keys(SCENARIOS)) for (const policy of POLICIES) for (const seed of seeds) {
      let state = createGame({ seed, scenario, overrides: variant.overrides });
      while (!['complete', 'ended'].includes(state.status)) {
        if (state.commands.length > 1500) throw new Error('策略超过行动上限');
        const action = chooseAction(observe(state), policy);
        if (!action) throw new Error('非终局没有合法行动');
        state = applyAction(state, action, state.revision);
      }
      const name = `${variant.id}-${scenario}-${policy}-${seed}`;
      await writeFile(resolve(output, `${name}.replay.json`), JSON.stringify(exportGame(state), null, 2));
      await writeFile(resolve(output, `${name}.trace.json`), JSON.stringify(state.log, null, 2));
      runs.push({ variant: variant.id, scenario, policy, seed, metrics: metrics(state) });
    }
  }
  const report = { rulesVersion: RULES_VERSION, controller: 'scripted-baselines-not-llm', seeds, baselineParameters: DEFAULT_PARAMETERS, variants, runs };
  await writeFile(resolve(output, 'summary.json'), JSON.stringify(report, null, 2));
  const lines = [
    '# 小批量规则实验', '', `规则版本：${RULES_VERSION}。控制器：脚本基线，不是大模型。`, '',
    '同一场景与种子使用相同外部天气流；行动和后果可不同。观察终点不是胜利判定。', '',
    '| 参数组 | 地点 | 策略 | 种子 | 状态 | 钱财 | 口粮 | 累计缺粮 | 学会节点数 | 继承节点数 | 试种样本 |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...runs.map(r => `| ${r.variant} | ${SCENARIOS[r.scenario].name} | ${POLICY_NAMES[r.policy]} | ${r.seed} | ${r.metrics.status} | ${r.metrics.money} | ${r.metrics.food} | ${r.metrics.foodShortfall} | ${r.metrics.learnedNodes.length} | ${r.metrics.inheritedNodes.reduce((n, x) => n + x.nodes.length, 0)} | ${r.metrics.samples} |`),
    '', '## 阅读边界', '',
    '- 不计算统一胜利分；钱财、基本生活、学习、继承与研究分别观察。',
    '- 某节点未使用，可能是策略太弱、窗口太短或前置太贵，不能直接认定节点无用。',
    '- 首版世界只包含一个地区的传统农业过程；数值和两季试种是实验抽象。',
    '- 若比较 candidate，先看每个同场景、同种子、同策略的变化，再核对 trace，不根据单次最高收益采纳。',
    '- 使用未参与调参的新种子做一次留出检查；结论仍需短时人工试玩。',
  ];
  if (variants.length === 2) {
    lines.push('', '## 候选参数的配对变化', '', '| 地点 | 策略 | 种子 | 钱财变化 | 缺粮变化 | 学会数变化 |', '| --- | --- | --- | --- | --- | --- |');
    for (const base of runs.filter(r => r.variant === 'baseline')) {
      const candidate = runs.find(r => r.variant === 'candidate' && r.scenario === base.scenario && r.policy === base.policy && r.seed === base.seed);
      lines.push(`| ${SCENARIOS[base.scenario].name} | ${POLICY_NAMES[base.policy]} | ${base.seed} | ${candidate.metrics.money - base.metrics.money} | ${candidate.metrics.foodShortfall - base.metrics.foodShortfall} | ${candidate.metrics.learnedNodes.length - base.metrics.learnedNodes.length} |`);
    }
  }
  await writeFile(resolve(output, 'report.md'), lines.join('\n'));
  console.log(`完成 ${runs.length} 个脚本基线实验。报告：${resolve(output, 'report.md')}`);
} catch (error) {
  console.error(error.message); process.exitCode = 1;
}
