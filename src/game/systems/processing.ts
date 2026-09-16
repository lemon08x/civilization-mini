import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import type { Ruleset } from '../ruleset.js';
import type { Subject, Worker } from '../model/economy.js';
import { ALL_PROCESSES as PROCESSES, ALL_PRODUCTS as PRODUCTS, WORKER_NAMES } from './economy-catalog.js';
import type { ProcessSpec } from './economy-catalog.js';
import { changeGoods, consumeEquipment, equipped, missingGoods } from './inventory.js';
import { recordEvidence, requirements } from './knowledge.js';
import { productNeeds } from './industry-products.js';
import { branchProcessNeeds } from './branches.js';
import { installedIn } from './industry.js';
import { usePower } from './modern.js';
import { steamReady, useSteam } from './operations.js';
import { made } from './shop.js';
import { assemblyReady, processInputs, processMultiplier } from './processing-math.js';

export { assemblyReady, processInputs, processMultiplier };

export function processBlockers(s: GameState, p: ProcessSpec, worker?: Worker): string[] {
  const e = s.economy!;
  const activeProjects = [e.project, ...Object.values(e.workers).map(w => w?.project)].filter(Boolean);
  const busy = p.equipment && activeProjects.some(x => PROCESSES.find(item => item.id === x!.good)?.equipment === p.equipment);
  const power = (p.power ?? 0) * processMultiplier(s, p, worker) + (!p.wait && assemblyReady(s, worker) ? 1 : 0);
  return [
    ...(e.industry ? productNeeds(s, p.id) : e.branches ? branchProcessNeeds(s, p.id, !!worker) : worker && !Object.values(p.requires).some(n => n > 6) ? [] : requirements(s, p.requires)),
    ...(power > (e.modern?.power ?? 0) ? ['电力不足：本批需要' + power + '电'] : []),
    ...missingGoods(s, processInputs(s, p, worker)),
    ...(p.equipment && installedIn(s, p.equipment) ? ['设备已安装在系统中，先暂停并拆出'] : []),
    ...(p.equipment && !equipped(s, p.equipment) ? ['需可用' + PRODUCTS.find(x => x.id === p.equipment)!.name] : []),
    ...(busy || p.equipment && e.equipmentUsed[p.equipment] === s.clock.absoluteTurn ? ['对应设备本季或在制工序占用'] : []),
    ...(!worker && e.project ? ['先完成本人在制项目'] : []),
  ];
}
function completeProcess(s: GameState, p: ProcessSpec, factor: number, events: GameEvent[], actor: string): void {
  changeGoods(s, Object.fromEntries(Object.entries(p.outputs).map(([id, n]) => [id, n * factor])), 1, events, actor + '完成' + p.name);
  events.push({ type: 'economy-process', recipe: p.id, actor, stage: 'complete', factor });
  if (actor === '本人') { for (const d of Object.keys(p.requires)) recordEvidence(s, d as Subject, events, p.name); }
  for (const id of Object.keys(p.outputs)) made(s, id);
  if (p.id === 'iron') s.economy!.ironBatches++;
  if (p.id === 'fiber') s.economy!.fiberBatches++;
}
export function runProcess(s: GameState, p: ProcessSpec, events: GameEvent[], worker?: Worker, rules?: Ruleset): void {
  const factor = processMultiplier(s, p, worker), actor = worker ? WORKER_NAMES[worker.kind] : '本人';
  const assembly = !p.wait && assemblyReady(s, worker);
  if (p.power) usePower(s, p.power * factor, events, p.name);
  if (s.electric && p.id === 'aluminium') s.economy!.modern!.services.ELECTROLYZER = s.clock.absoluteTurn;
  if (assembly) { usePower(s, 1, events, '标准化装配'); consumeEquipment(s, 'T07', events); s.economy!.equipmentUsed.T07 = s.clock.absoluteTurn; }
  changeGoods(s, Object.fromEntries(Object.entries(p.inputs).map(([id, n]) => [id, n * factor])), -1, events, actor + '开工');
  if (p.equipment) { consumeEquipment(s, p.equipment, events); s.economy!.equipmentUsed[p.equipment] = s.clock.absoluteTurn; }
  if (factor === 2 && ['fiber', 'rope'].includes(p.id) && equipped(s, 'P01') && (!worker || worker.experience < 8)) consumeEquipment(s, 'P01', events);
  const accelerated = rules && ['ceramics', 'brick', 'iron'].includes(p.id) && steamReady(s, rules);
  if (accelerated) useSteam(s, rules!, events);
  if (p.wait && !accelerated) {
    const project = { good: p.id, amount: factor, started: s.clock.absoluteTurn };
    if (worker) worker.project = project; else s.economy!.project = project;
    events.push({ type: 'economy-process', recipe: p.id, actor, stage: 'start', factor });
  } else completeProcess(s, p, factor, events, actor);
}
export function finishProcess(s: GameState, events: GameEvent[], worker?: Worker): void {
  const project = worker ? worker.project : s.economy!.project;
  if (!project) throw new Error('没有在制品');
  const p = PROCESSES.find(x => x.id === project.good)!;
  completeProcess(s, p, project.amount, events, worker ? WORKER_NAMES[worker.kind] : '本人');
  if (worker) worker.project = null; else s.economy!.project = null;
}
