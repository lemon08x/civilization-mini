import type { BoardView } from './view.js';
export function progressPanel(o:BoardView):string {
 if(!['0.7.0','0.8.0'].includes(o.rulesVersion))return '';
 const v=o.victory;
 const victory=v?`<section class="panel"><div class="panel-head"><h2>${v.won?'科技胜利':o.status==='complete'?'观察期结束，未达科技胜利':'家族科技胜利'}</h2><strong>${v.mastered.length}/${v.total} · ${v.percent}%</strong></div><div class="panel-body"><progress max="${v.total}" value="${v.mastered.length}" aria-label="家族科技完成比例"></progress><p>目标 ${v.targetPercent}%（至少 ${v.required} 项）。历代实际掌握去重；世界已有、买入方法和规划科技不计入。${v.achieved&&!v.won?'已达科技门槛，仍需通过季末生存结算。':'通过季末生存结算且达标即获胜并结束本局。'}</p><p>设备安装即启用，之后每季末自动尝试运行；每季最多一次，缺料不损耗，不产生个人经验。校准报告可卖；工业交付可同时按市价购粮。实习每次最多传2经验，上限为父辈一半。</p></div></section>`:'';
 return victory+`<section class="panel"><div class="panel-head"><h2>家业进展</h2><small>储备 · 熟练生产 · 家族接续</small></div><div class="panel-body"><p>现有口粮可支付约<strong>${Math.floor(o.family.food/o.parameters.foodPerTurn)}</strong>季生活（未计损耗与加工）。${o.production?.storage.woodenware||o.production?.storage.pottery?'已配置储存：可选择一次购买4粮，减少补给行动。':'配置储存后开放集中购粮，口粮不会自动增加。'}</p><p>基础制作每次完工获得2经验；熟练等级门槛为1、4、9…经验。木作1级后普通木制品1行动完成；陶器仍需跨季。留存家族方法后可合并教学与实践，支付练习材料，后辈保留有限熟练经验。</p><p>渠道不必学完整条链再建：满足前置，学过渠道布局且有指导来源即可付费建设，并取得渠道实践。精密制造可专精陶作，机械和实验器具可外购。</p><small>本版需新开局；此前浏览器存档保留在原存储键中，未转换或覆盖。</small></div></section>`;
}
