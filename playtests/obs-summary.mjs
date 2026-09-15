// Helper: read observe output from stdin (or arg file) and print a compact summary.
// Usage: node scripts/player.mjs observe --run <id> 2>&1 | node playtests/obs-summary.mjs
import fs from 'node:fs';

let raw = '';
try {
  raw = fs.readFileSync(0, 'utf8');
} catch {
  raw = fs.readFileSync(process.argv[2], 'utf8');
}
// strip BOM
raw = raw.replace(/^\uFEFF/, '');
const o = JSON.parse(raw);
const g = o.game;
const eco = g.economy;

const line = (k, v) => console.log(`${k}: ${v}`);

line('runId', o.runId);
line('revision', o.revision);
line('status', o.status ?? '(n/a)');
line('clock', JSON.stringify(g.clock ?? '(n/a)'));
line('era', JSON.stringify(g.era ?? '(n/a)'));
line('foodTotal', eco.foodTotal);
line('storage', eco.storage);
line('harvest', eco.harvest);
line('money', eco.money);
line('time', eco.time);
line('energy', eco.energy);
line('hardship', eco.hardship ?? 0);
line('water', JSON.stringify(eco.water ?? '(n/a)'));
line('weather', JSON.stringify(eco.weather ?? '(n/a)'));
line('inventory', JSON.stringify(eco.inventory ?? '(n/a)'));

// knowledge: may be object {id: {known:...}} or array
const kn = eco.knowledge ?? {};
const knArr = Array.isArray(kn) ? kn : Object.values(kn);
line('knowledge', JSON.stringify(knArr.map(k => ({ id: k.id, known: k.known }))));
const knownIds = knArr.filter(k => k.known).map(k => k.id);
line('knownIds', knownIds.join(','));
line('products', JSON.stringify((eco.products ?? []).map(p => p.id)));
line('crops', JSON.stringify(eco.crops ?? '(n/a)'));

// enabled actions
const acts = (eco.actions ?? []).filter(a => a.enabled);
console.log('--- enabled actions ---');
for (const a of acts) {
  console.log(`${a.id} [${a.action.time}t/${a.action.energy}e${a.action.money ? `/${a.action.money}钱` : ''}] ${a.label}`);
}
console.log('--- actions disabled (reasons) ---');
for (const a of (eco.actions ?? []).filter(a => !a.enabled)) {
  console.log(`${a.id} :: ${(a.reason || '').slice(0, 120)}`);
}