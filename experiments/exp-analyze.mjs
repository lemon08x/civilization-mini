import { readFileSync } from 'node:fs';
const R = JSON.parse(readFileSync('experiments/exp-100-results.json', 'utf8'));
const avg = a => (a.reduce((x, y) => x + y, 0) / (a.length || 1)).toFixed(1);

console.log('=== 传承效果（gen1/gen2 交接时后辈掌握数） ===');
for (const st of ['inheritance', 'craftLife', 'specialist', 'safe']) {
  const g = R.filter(r => r.strategy === st);
  const h1 = g.map(r => r.handovers.find(h => h.gen === 1)?.heir ?? 0);
  const h2 = g.map(r => r.handovers.find(h => h.gen === 2)?.heir ?? 0);
  console.log(st.padEnd(12), 'gen1后辈=' + avg(h1), 'gen2后辈=' + avg(h2));
}

console.log('\n=== 造出校准仪的局：是否实际使用（校准/蓄水/回收） ===');
const built = R.filter(r => r.milestones['built:calibrator']);
for (const r of built) {
  console.log(`${r.strategy}/${r.scenario} s${r.seed}`, '校准仪@' + r.milestones['built:calibrator'], '安装@' + (r.milestones['installed:calibrator'] ?? '-'), '校准次数=' + r.calibrations, '蓄水=' + r.storedWater, '回收=' + r.recycled);
}
console.log('造出校准仪的局数=' + built.length, '其中实际校准过=' + built.filter(r => r.calibrations > 0).length);

console.log('\n=== specialist/clay-valley 各局推进深度 ===');
for (const r of R.filter(r => r.strategy === 'specialist' && r.scenario === 'clay-valley')) {
  const m = r.milestones;
  console.log('s' + r.seed, '构件@' + (m['made:ceramicParts'] ?? '-'), '机构@' + (m['made:mechanisms'] ?? '-'), '精密件@' + (m['made:precisionParts'] ?? '-'), '校准仪@' + (m['built:calibrator'] ?? '-'), '钱=' + r.money, '最低粮=' + r.minFood, '苦难=' + r.hardship);
}

console.log('\n=== 金钱对比：safe vs 工业类（同场景 clay-valley） ===');
for (const st of ['safe', 'specialist', 'aggressiveDev', 'industrialUse', 'craftLife', 'inheritance']) {
  const g = R.filter(r => r.strategy === st && r.scenario === 'clay-valley');
  if (g.length) console.log(st.padEnd(14), 'n=' + g.length, '平均钱=' + avg(g.map(r => r.money)), '平均最低粮=' + avg(g.map(r => r.minFood)));
}
