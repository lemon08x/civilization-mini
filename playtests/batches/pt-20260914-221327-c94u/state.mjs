// 只读辅助：打印观察的核心状态行（不含行动列表），便于逐步决策时省上下文。
// 用法: node state.mjs <observe.json> [最近事件条数，默认4]
import { readFileSync } from 'node:fs';

const file = process.argv[2];
const nEvents = process.argv[3] ? parseInt(process.argv[3], 10) : 4;
if (!file) {
  console.error('用法: node state.mjs <observe.json>');
  process.exit(1);
}
const obs = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const g = obs.game;
const line = (label, value) => console.log(`${label}: ${value}`);

line('revision', obs.revision);
line('status', g.status);
line('clock', `代${g.clock?.generation}/${g.clock?.generations} 绝对季${g.clock?.absoluteTurn}`);
const p = g.life?.person;
const h = g.life?.heir;
line('本人', `年龄${p?.ageYears} 健康${p?.health}/${p?.maxHealth} 精力${p?.energy}/${p?.maxEnergy}`);
line('后辈', `年龄${h?.ageYears} 健康${h?.health}/${h?.maxHealth} 精力${h?.energy}/${h?.maxEnergy}`);
const b = g.life?.budget;
line('预算', `可用时间${b?.freeTime} 可用精力${b?.freeEnergy} 预留时间${b?.reservedTime} 任务:${JSON.stringify(b?.tasks ?? [])}`);
line('家庭', `食物${g.family?.food} 钱${g.family?.money} 艰难${g.family?.hardship} 渠道:${g.family?.channel ?? '无'}`);
line('世界', `天气:${g.world?.weatherName}(${g.world?.weather}) 雨${g.world?.rain} 公共水${g.world?.water}`);
line('物资', JSON.stringify(g.economy?.goods ?? {}));
line('田地', JSON.stringify(g.economy?.field ?? {}));
line('设备', JSON.stringify(g.economy?.equipment ?? {}));
line('雇工', JSON.stringify(g.economy?.workers ?? {}));
line('分支学会', JSON.stringify(g.economy?.branches?.learned ?? {}));
line('产品验证/交付', JSON.stringify(g.economy?.branches?.delivered ?? []));
line('行业产品', JSON.stringify(g.economy?.industry?.products ?? {}));
line('购物车', JSON.stringify(g.economy?.shop?.cart ?? {}));
line('订单', JSON.stringify(g.economy?.shop?.orders ?? []));
line('收获', JSON.stringify(g.harvest ?? {}));
line('社会食品', `策略:${g.socialFood?.policyName} 家库存${g.socialFood?.householdStock} 缺口${g.socialFood?.missing} 需购${g.socialFood?.purchase} 花费${g.socialFood?.cost}`);
line('era', `阶段:${g.era?.stage?.name} 已过${g.era?.elapsed}/${g.era?.duration} 待兑${g.era?.rewardClaims}/${g.era?.rewardDivisor} 地下水${g.era?.groundwater}`);
if (g.era?.goal) {
  line('建设目标', `${g.era.goal.name} ${g.era.goal.complete ? '✓已完成' : '未完成'}${g.era.goal.missing?.length ? ' 缺:' + g.era.goal.missing.join('、') : ''}`);
  const p = g.era.projection;
  if (p) line('推算预览', `剩余${p.remaining}季 收获${p.harvestUnits}份 加工${p.craftUnits}份 凭证${p.claims} 兑现后约${p.previewReward}钱 供水保障:${p.waterSecured} 适用:${p.appliesOnSettle}`);
}
line('胜利', `掌握${g.victory?.mastered?.length}/${g.victory?.total} 完成:${g.victory?.won}`);

console.log('== 最近事件 ==');
const evs = obs.recentEvents ?? [];
for (const ev of evs.slice(-nEvents)) {
  console.log(`- ${typeof ev === 'string' ? ev : JSON.stringify(ev)}`);
}
