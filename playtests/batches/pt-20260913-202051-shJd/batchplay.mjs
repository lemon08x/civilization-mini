// 试玩辅助：按给定动作序列批量提交 act，自动读取最新 revision（0.20 版）。
// 用文件重定向避免 stdio pipe 的 EPERM 沙箱限制。
// 动作仍由调用者在参数里指定，不算自动决策。
// 用法: node batchplay.mjs <run> <tmpfile> <action1> <action2> ...
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const run = process.argv[2];
const tmp = process.argv[3];
const actions = process.argv.slice(4);
if (!run || !tmp || actions.length === 0) {
  console.error('用法: node batchplay.mjs <run> <tmpfile> <action...>');
  process.exit(1);
}

function callPlayer(args) {
  // 重定向到临时文件（pwsh/文件系统重定向，不是 stdio pipe）
  execFileSync('cmd', ['/c', `node scripts/player.mjs ${args.join(' ')} > "${tmp}" 2> "${tmp}.err"`]);
  return readFileSync(tmp, 'utf8').replace(/^\uFEFF/, '');
}

let json = JSON.parse(callPlayer(['observe', '--run', run]));
for (const act of actions) {
  const rev = json.revision;
  try {
    const out = callPlayer(['act', '--run', run, '--revision', String(rev), '--action', act, '--reason', 'batch']);
    json = JSON.parse(out);
    console.log(`OK  r${json.revision}  ${act}  季${json.game.clock?.absoluteTurn}`);
  } catch (e) {
    const err = readFileSync(`${tmp}.err`, 'utf8').slice(0, 150);
    console.log(`SKIP ${act}: ${err}`);
  }
}
const g = json.game;
console.log('---');
console.log(`最终 revision=${json.revision} 季=${g.clock?.absoluteTurn} 掌握=${g.victory?.mastered?.length}/${g.victory?.total} 健康=${g.life?.person?.health} 食物=${g.family?.food} 钱=${g.family?.money} 阶段=${g.economy?.operationsView?.stage}`);
console.log(`预算 可用时间=${g.life?.budget?.freeTime} 可用精力=${g.life?.budget?.freeEnergy} 任务=${JSON.stringify(g.life?.budget?.tasks ?? [])}`);
console.log(`物资=${JSON.stringify(g.economy?.goods)} 田=${JSON.stringify(g.economy?.field)}`);
console.log(`分支=${JSON.stringify(g.economy?.branches?.learned)}`);
console.log(`设备=${JSON.stringify(g.economy?.equipment)}`);