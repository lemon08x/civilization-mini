import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../../..');
const dumpPath = resolve(here, '_obs.json');

function parseObservation(raw) {
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('no json in output:\n' + raw.slice(0, 400));
  return JSON.parse(raw.slice(start));
}

function summarize(data) {
  const g = data.game ?? {};
  const eco = g.economy ?? {};
  const life = g.life ?? {};
  const person = life.person ?? {};
  const heir = life.heir ?? {};
  const fam = g.family ?? {};
  const world = g.world ?? {};
  const field = eco.field ?? {};
  const modern = eco.modern ?? {};
  const ops = eco.operations ?? {};
  const shop = eco.shop ?? {};
  const bv = eco.branchView ?? {};
  const actions = g.actions ?? [];
  const skip = new Set(['cartadd', 'cartremove', 'clearcart']);

  const known = (bv.nodes ?? []).filter((n) => n.known).map((n) => `${n.id}:${n.name}`);
  const learnable = (bv.nodes ?? []).filter((n) => !n.known && (!n.missing || n.missing.length === 0));

  const enabled = [];
  for (const a of actions) {
    const op = a.action?.operation;
    if (skip.has(op)) continue;
    if (a.enabled) {
      enabled.push(`${a.id} | ${a.label} | t${a.time}/e${a.energy}/m${a.money}/f${a.food} | ${a.description}`);
    }
  }

  const lines = [];
  const cal = life.calendar ?? {};
  const clock = g.clock ?? {};
  lines.push(`run=${data.runId} rev=${data.revision} status=${g.status} abs=${clock.absoluteTurn} gen=${clock.generation} turn=${clock.turn} ${cal.year}年${cal.season}`);
  lines.push(`time=${life.timeRemaining}/${life.timePerSeason} energy=${person.energy}/${person.maxEnergy} health=${person.health} age=${person.ageYears} talent=${person.talent?.name ?? ''} ${person.talent?.effect ?? ''}`);
  lines.push(`heir age=${heir.ageYears} energy=${heir.energy} talent=${heir.talent?.name ?? ''} pendingRetire=${life.pendingRetirement}`);
  lines.push(`weather=${world.weatherName ?? world.weather} rain=${world.rain} water=${world.water} food=${fam.food} money=${fam.money} hardship=${fam.hardship}`);
  lines.push(`goods=${JSON.stringify(eco.goods)} equipment=${JSON.stringify(eco.equipment)} workers=${JSON.stringify(eco.workers)}`);
  lines.push(`field=${JSON.stringify(field)}`);
  lines.push(`ops farm=${JSON.stringify(ops.farm)} prod=${JSON.stringify(ops.production)} food=${ops.food} supplies=${ops.supplies} sales=${ops.sales} maint=${ops.maintenance} charter=${ops.charter} paused=${ops.paused} notice=${JSON.stringify(ops.notice)}`);
  lines.push(`power=${modern.power} stored=${modern.stored} enabled=${JSON.stringify(modern.enabled)} operated=${JSON.stringify(modern.operated)}`);
  lines.push(`cart=${JSON.stringify(shop.cart)} channels=${JSON.stringify(eco.branches?.channels)} protocols=${JSON.stringify(eco.branches?.protocols)} delivered=${JSON.stringify(eco.branches?.delivered)}`);
  lines.push(`known=${known.join(', ')}`);
  lines.push('learnable:');
  for (const n of learnable) {
    lines.push(`  ${n.id} ${n.name} sample=${JSON.stringify(n.sample)} :: ${n.benefit}`);
  }
  lines.push('enabled:');
  for (const e of enabled) lines.push(`  ${e}`);
  lines.push('events:');
  for (const ev of (data.recentEvents ?? []).slice(-16)) {
    lines.push(`  ${ev.kind ?? ev.type ?? ''} ${ev.message ?? ev.text ?? JSON.stringify(ev)}`);
  }
  if (data.error) lines.push(`ERROR ${data.error}`);
  return lines.join('\n');
}

const args = process.argv.slice(2);
let data;
if (args[0] === 'observe') {
  const run = args[args.indexOf('--run') + 1];
  const r = spawnSync(process.execPath, [resolve(root, 'scripts/player.mjs'), 'observe', '--run', run], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20_000_000,
    windowsHide: true,
  });
  const raw = (r.stdout || '') + (r.stderr || '');
  writeFileSync(dumpPath, r.stdout || '', 'utf8');
  data = parseObservation(raw);
} else if (args[0] === 'act') {
  const forwarded = args.slice(1);
  const r = spawnSync(process.execPath, [resolve(root, 'scripts/player.mjs'), 'act', ...forwarded], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20_000_000,
    windowsHide: true,
  });
  const raw = (r.stdout || '') + (r.stderr || '');
  writeFileSync(dumpPath, r.stdout || '', 'utf8');
  data = parseObservation(raw);
} else if (args[0] === 'metrics') {
  const run = args[args.indexOf('--run') + 1];
  const r = spawnSync(process.execPath, [resolve(root, 'scripts/player.mjs'), 'metrics', '--run', run], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20_000_000,
    windowsHide: true,
  });
  process.stdout.write(r.stdout || r.stderr || '');
  process.exit(r.status ?? 0);
} else if (args[0]) {
  const buf = readFileSync(args[0]);
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  data = parseObservation(text);
} else {
  const buf = readFileSync(0);
  const text = buf[0] === 0xff && buf[1] === 0xfe ? buf.toString('utf16le') : buf.toString('utf8');
  data = parseObservation(text);
}

process.stdout.write(summarize(data) + '\n');
