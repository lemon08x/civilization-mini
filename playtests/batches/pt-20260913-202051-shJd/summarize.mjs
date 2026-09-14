// 试玩辅助工具：把 observe/act 输出的完整 JSON 压成决策摘要（0.20 版）。
// 只整理观察，不选择或提交游戏行动。
// 用法: node summarize.mjs <observe.json路径>
import { readFileSync } from 'node:fs';

const file = process.argv[2];
if (!file) {
  console.error('用法: node summarize.mjs <observe.json>');
  process.exit(1);
}
const obs = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const g = obs.game;

const line = (label, value) => console.log(`${label}: ${value}`);

line('runId', obs.runId);
line('revision', obs.revision);
line('rulesVersion', g.rulesVersion);
line('status', g.status);
line('clock', `代${g.clock?.generation}/${g.clock?.generations} 季${g.clock?.absoluteTurn} 年内季${g.clock?.turn} (每代${g.clock?.turnsPerGeneration}季)`);
line('日历', `${g.life?.calendar?.year}年${g.life?.calendar?.season}`);
const p = g.life?.person;
const h = g.life?.heir;
line('本人', `年龄${p?.ageYears} 健康${p?.health}/${p?.maxHealth} 精力${p?.energy}/${p?.maxEnergy} 天赋:${p?.talent?.name}(${p?.talent?.effect})`);
line('后辈', `年龄${h?.ageYears} 健康${h?.health}/${h?.maxHealth} 精力${h?.energy}/${h?.maxEnergy} 天赋:${h?.talent?.name}(${h?.talent?.effect})`);
const b = g.life?.budget;
if (b) {
  line('预算', `已用时间${b.spentTime} 预留时间${b.reservedTime} 可用时间${b.freeTime} 可用精力${b.freeEnergy} 任务:${JSON.stringify(b.tasks ?? [])}`);
}
const rec = g.life?.recovery;
if (rec) line('恢复参数', JSON.stringify(rec));
line('时间', `本季剩余时间${g.life?.timeRemaining}/${g.life?.timePerSeason} 待退休:${g.life?.pendingRetirement}`);
line('家庭', `食物${g.family?.food} 钱${g.family?.money} 艰难${g.family?.hardship} 渠道:${g.family?.channel ?? '无'} 种源潜力${g.family?.stock?.potential}耐性${g.family?.stock?.tolerance}`);
line('世界', `时代:${g.world?.era} 天气:${g.world?.weatherName}(${g.world?.weather}) 雨${g.world?.rain} 公共水${g.world?.water}`);

const eco = g.economy ?? {};
line('物资', JSON.stringify(eco.goods ?? {}));
line('田地', JSON.stringify(eco.field ?? {}));
line('设备', JSON.stringify(eco.equipment ?? {}));
line('雇工', JSON.stringify(eco.workers ?? {}));
line('在制项目', JSON.stringify(eco.project ?? '无'));
line('市场价', `市场${eco.market} 招募${eco.recruitment} 工业供给${eco.industrySupply}`);
line('分支学会', JSON.stringify(eco.branches?.learned ?? {}));
line('产品验证', JSON.stringify(eco.branches?.delivered ?? []));
line('经营安排', `暂停:${eco.operations?.paused} 购粮:${eco.operations?.food} 农场:${JSON.stringify(eco.operations?.farm)} 生产:${JSON.stringify(eco.operations?.production)} 补货:${eco.operations?.supplies} 销售:${eco.operations?.sales} 维护:${eco.operations?.maintenance}`);
line('购物车', JSON.stringify(eco.shop?.cart ?? {}));
line('订单', JSON.stringify(eco.shop?.orders ?? []));
line('电网', `电${eco.modern?.power} 存${eco.modern?.stored} 已开:${JSON.stringify(eco.modern?.enabled)}`);

const fam = g.family ?? {};
line('收获', JSON.stringify(g.harvest ?? {}));
line('库存', JSON.stringify(g.production?.inventory ?? {}));
line('经营阶段', g.economy?.operationsView?.stage);
line('胜利', `掌握${g.victory?.mastered?.length}/${g.victory?.total} 成就${g.victory?.achievements?.length} 完成:${g.victory?.won}`);

console.log('\n== 已启用行动 ==');
const actions = g.actions ?? [];
const enabled = actions.filter((a) => a.enabled);
if (enabled.length === 0) console.log('(无可用行动)');
for (const a of enabled) {
  console.log(`- [${a.id}] ${a.label} | ${a.group} | 时间${a.time} 精力${a.energy} 钱${a.money} 粮${a.food}${a.reason ? ` | ${a.reason}` : ''}`);
}

console.log('\n== 最近事件 ==');
for (const ev of obs.recentEvents ?? []) {
  console.log(`- ${typeof ev === 'string' ? ev : JSON.stringify(ev)}`);
}