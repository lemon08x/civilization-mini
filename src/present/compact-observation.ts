import type { SessionObservation } from '../runtime/session.js';

export type CompactSection =
  | 'branches' | 'industry' | 'systems' | 'social-food'
  | 'era' | 'catalog' | 'actions-disabled';

export const COMPACT_SECTIONS: CompactSection[] = [
  'branches', 'industry', 'systems', 'social-food', 'era', 'catalog', 'actions-disabled',
];

export interface CompactActionQuote {
  id: string;
  label: string;
  time?: number;
  energy?: number;
  money: number;
  food: number;
  materials?: Record<string, number>;
  description: string;
}

export interface CompactObservation {
  runId: string;
  revision: number;
  status: string;
  clock: { absoluteTurn: number; year?: number; season?: string };
  resources: { money: number; householdFood: number; foodTotal?: number; storage?: number };
  budget?: {
    timeRemaining: number;
    energy: number;
    reservedTime: number;
    reservedEnergy: number;
    availableTime: number;
    availableEnergy: number;
    health?: number;
    hardship: number;
  };
  stage?: { era?: string; remaining?: number; farm?: string; tasks: string[] };
  events: unknown[];
  actions: CompactActionQuote[];
  urgentBlockers: { id: string; reason: string }[];
  details: { section: CompactSection; command: string }[];
  receipt?: { duplicate: boolean; revision: number };
}

type ActionLike = {
  id: string;
  label: string;
  enabled: boolean;
  reason: string;
  description: string;
  time?: number;
  energy?: number;
  money?: number;
  food?: number;
  ap?: number;
  materials?: Record<string, number>;
};

const URGENT_REASON = /时间不足|精力不足|口粮不足|钱财不足|健康|食物|预留|饥饿|困境|hardship|食品/;
const LIFE_ACTIONS = /^(economy:(rest|care|end|farm|farmcycle|buyfood|foodpolicy|foodbudget|foodreserve)|end-turn|buy-food|cultivate)/;

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function num(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function quoteAction(action: ActionLike): CompactActionQuote {
  return {
    id: action.id,
    label: action.label,
    ...(action.time !== undefined ? { time: action.time } : {}),
    ...(action.energy !== undefined ? { energy: action.energy } : {}),
    money: action.money ?? 0,
    food: action.food ?? 0,
    ...(action.materials ? { materials: { ...action.materials } } : {}),
    description: action.description,
  };
}

function isUrgent(action: ActionLike): boolean {
  if (action.enabled) return false;
  return URGENT_REASON.test(action.reason) || LIFE_ACTIONS.test(action.id);
}

function cropName(ongoing: unknown): string | undefined {
  const farm = record(ongoing)?.farm;
  return typeof farm === 'string' ? farm : undefined;
}

export function compactObservation(
  observation: SessionObservation,
  extras?: { receipt?: { duplicate: boolean; revision: number } },
): CompactObservation {
  const game = observation.game as Record<string, unknown>;
  const family = record(game.family) ?? {};
  const life = record(game.life);
  const budget = record(life?.budget);
  const calendar = record(life?.calendar);
  const person = record(life?.person);
  const economy = record(game.economy);
  const era = record(game.era);
  const clock = record(game.clock) ?? {};
  const actions = ((game.actions as ActionLike[] | undefined) ?? []);
  const enabled = actions.filter(action => action.enabled);
  const tasks = Array.isArray(budget?.tasks)
    ? (budget.tasks as { name?: string; id?: string }[]).map(task => str(task.name) ?? str(task.id) ?? '').filter(Boolean)
    : [];
  const farm = cropName(economy?.ongoing);
  const eraStage = record(era?.stage);
  return {
    runId: observation.runId,
    revision: observation.revision,
    status: str(game.status) ?? 'unknown',
    clock: {
      absoluteTurn: num(clock.absoluteTurn),
      ...(typeof calendar?.year === 'number' ? { year: calendar.year } : {}),
      ...(str(calendar?.season) ? { season: str(calendar?.season) } : {}),
    },
    resources: {
      money: num(family.money),
      householdFood: num(family.food),
      ...(typeof economy?.foodTotal === 'number' ? { foodTotal: economy.foodTotal } : {}),
      ...(typeof economy?.storage === 'number' ? { storage: economy.storage } : {}),
    },
    ...(life ? {
      budget: {
        timeRemaining: num(life.timeRemaining),
        energy: num(person?.energy),
        reservedTime: num(budget?.reservedTime),
        reservedEnergy: num(budget?.reservedEnergy),
        availableTime: num(budget?.freeTime, Math.max(0, num(life.timeRemaining) - num(budget?.reservedTime))),
        availableEnergy: num(budget?.freeEnergy, Math.max(0, num(person?.energy) - num(budget?.reservedEnergy))),
        ...(typeof person?.health === 'number' ? { health: person.health } : {}),
        hardship: num(family.hardship),
      },
    } : {}),
    stage: {
      ...(str(eraStage?.name) ? { era: str(eraStage?.name) } : {}),
      ...(typeof era?.remaining === 'number' ? { remaining: era.remaining } : {}),
      ...(farm ? { farm } : {}),
      tasks,
    },
    events: observation.recentEvents ?? [],
    actions: enabled.map(quoteAction),
    urgentBlockers: actions.filter(isUrgent).map(action => ({ id: action.id, reason: action.reason })),
    details: COMPACT_SECTIONS.map(section => ({
      section,
      command: `node scripts/player.mjs observe --run ${observation.runId} --section ${section}`,
    })),
    ...(extras?.receipt ? { receipt: extras.receipt } : {}),
  };
}

function eventLine(event: unknown): string {
  const item = record(event);
  if (!item) return String(event);
  if (typeof item.detail === 'string') return `${String(item.type ?? 'event')}: ${item.detail}`;
  return JSON.stringify(item);
}

export function formatCompactObservation(compact: CompactObservation): string {
  const clock = [
    `第${compact.clock.absoluteTurn}季`,
    compact.clock.year !== undefined ? `${compact.clock.year}年` : '',
    compact.clock.season ?? '',
  ].filter(Boolean).join(' ');
  const budget = compact.budget;
  const lines = [
    '# Civilization Mini · 精简观察',
    `run: ${compact.runId}`,
    `revision: ${compact.revision}`,
    `状态: ${compact.status}`,
    `时钟: ${clock}`,
    `资源: 钱 ${compact.resources.money} / 家庭粮 ${compact.resources.householdFood}`
      + (compact.resources.foodTotal !== undefined ? ` / 可食 ${compact.resources.foodTotal}` : '')
      + (compact.resources.storage !== undefined ? ` / 仓储 ${compact.resources.storage}` : ''),
  ];
  if (budget) {
    lines.push(`预算: 时间 ${budget.timeRemaining}（预留 ${budget.reservedTime}，可用 ${budget.availableTime}） / 精力 ${budget.energy}（预留 ${budget.reservedEnergy}，可用 ${budget.availableEnergy}） / 困境 ${budget.hardship}`
      + (budget.health !== undefined ? ` / 健康 ${budget.health}` : ''));
  }
  if (compact.stage?.era || compact.stage?.farm || (compact.stage?.tasks.length ?? 0) > 0) {
    lines.push(`阶段: ${[compact.stage?.era, compact.stage?.remaining !== undefined ? `剩余${compact.stage.remaining}季` : '', compact.stage?.farm ? `持续耕作 ${compact.stage.farm}` : '', ...(compact.stage?.tasks ?? [])].filter(Boolean).join('；')}`);
  }
  if (compact.receipt) lines.push(`回执: revision ${compact.receipt.revision}${compact.receipt.duplicate ? '（重复命令）' : ''}`);
  lines.push('', '成功行动后直接用本摘要决策，不必再 observe。冲突、失败或文件更新警告时重新观察。', '', '## 可用行动');
  for (const action of compact.actions) {
    const materials = action.materials
      ? ' / 材料 ' + Object.entries(action.materials).map(([id, n]) => `${id}:${n}`).join(',')
      : '';
    lines.push(`- ${action.id} | ${action.label} | 时间 ${action.time ?? 0} / 精力 ${action.energy ?? 0} / 钱 ${action.money} / 粮 ${action.food}${materials}`);
    lines.push(`  ${action.description}`);
  }
  lines.push('', '## 紧急阻碍');
  if (!compact.urgentBlockers.length) lines.push('- （无）');
  else for (const blocker of compact.urgentBlockers) lines.push(`- ${blocker.id} | ${blocker.reason}`);
  lines.push('', '## 最近事件');
  if (!compact.events.length) lines.push('- （无）');
  else for (const event of compact.events) lines.push(`- ${eventLine(event)}`);
  lines.push('', '## 分区详情', '静态目录与不可用行动不在本摘要内，按需读取：');
  for (const detail of compact.details) lines.push(`- ${detail.section}: ${detail.command}`);
  lines.push('', '## 提交方式', `node scripts/player.mjs act --run ${compact.runId} --revision ${compact.revision} --action <可用行动ID>`);
  lines.push('完整观察: node scripts/player.mjs observe --run ' + compact.runId + ' --format text');
  return lines.join('\n') + '\n';
}

function sectionPayload(observation: SessionObservation, section: CompactSection): unknown {
  const game = observation.game as Record<string, unknown>;
  const economy = record(game.economy) ?? {};
  const actions = (game.actions as ActionLike[] | undefined) ?? [];
  switch (section) {
    case 'branches': return economy.branchView ?? null;
    case 'industry': return economy.industryView ?? null;
    case 'systems': return {
      operations: economy.operationsView ?? null,
      workshop: economy.workshopView ?? null,
      tower: economy.towerView ?? null,
      expedition: economy.expeditionView ?? null,
    };
    case 'social-food': return game.socialFood ?? null;
    case 'era': return game.era ?? null;
    case 'catalog': return {
      disciplines: economy.disciplines ?? null,
      products: economy.products ?? null,
      processes: economy.processes ?? null,
      goods: economy.goodsCatalog ?? null,
    };
    case 'actions-disabled': return actions.filter(action => !action.enabled).map(action => ({
      id: action.id, label: action.label, reason: action.reason,
    }));
  }
}

export function observationSection(observation: SessionObservation, section: CompactSection): string {
  if (!COMPACT_SECTIONS.includes(section)) throw new Error('未知观察分区：' + section);
  return [
    `# 观察分区 · ${section}`,
    `run: ${observation.runId}`,
    `revision: ${observation.revision}`,
    '',
    '```json',
    JSON.stringify(sectionPayload(observation, section), null, 2),
    '```',
    '',
  ].join('\n');
}

export function parseCompactSection(value: string): CompactSection {
  if ((COMPACT_SECTIONS as string[]).includes(value)) return value as CompactSection;
  throw new Error('section 仅支持 ' + COMPACT_SECTIONS.join(' / '));
}
