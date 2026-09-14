import type { SessionObservation } from '../../src/runtime/session.js';

/** Player-facing projection only. Never accept a Session or a run record here. */
export function textObservation(observation: SessionObservation): string {
  const {runId, revision, game, recentEvents} = observation;
  const {actions, ...state} = game;
  const lines = [
    '# Civilization Mini · AI 文本观察',
    `run: ${runId}`, `revision: ${revision}`, `状态: ${game.status}`,
    '', '只根据本文件观察决策；每次提交一个行动，再读取最新观察。',
    '本文件是可再生成的观察，不是存档。修改本文件不会推进游戏。',
    '', '## 当前可用行动',
    ...actions.filter(a => a.enabled).map(a =>
      `- ${a.id} | ${a.label} | 时间 ${a.time ?? a.ap} / 精力 ${a.energy ?? 0} / 钱 ${a.money ?? 0} / 粮 ${a.food ?? 0}\n  ${a.description}`),
    '', '## 暂不可用行动',
    ...actions.filter(a => !a.enabled).map(a => `- ${a.id} | ${a.label} | ${a.reason}`),
    '', '## 完整可见状态', '```json', JSON.stringify(state, null, 2), '```',
    '', '## 最近事件', '```json', JSON.stringify(recentEvents, null, 2), '```',
    '', '## 提交方式',
    `node scripts/player.mjs act --run ${runId} --revision ${revision} --action <上方可用行动ID> --format text`,
    '',
  ];
  return lines.join('\n');
}
