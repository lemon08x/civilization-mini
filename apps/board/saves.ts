import type { Session } from '../../src/runtime/records.js';

const INDEX_KEY = 'civilization-mini.saves.v27.index';
const slotKey = (id: string) => `civilization-mini.saves.v27.slot.${id}`;

export interface SaveMeta {
  id: string;
  name: string;
  savedAt: string;
  scenarioId: string;
  status: string;
  turn: number;
}

export const SCENARIO_NAMES: Record<string, string> = {
  river: '河渠农地',
  'clay-valley': '黏土河谷',
  woodland: '林地聚落',
  dry: '缺水聚落',
};

function readIndex(): SaveMeta[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed as SaveMeta[] : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SaveMeta[]): void {
  localStorage.setItem(INDEX_KEY, JSON.stringify(list));
}

export function listSaves(): SaveMeta[] {
  return readIndex().slice().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function loadSave(id: string): { record: unknown; state: unknown } | null {
  const raw = localStorage.getItem(slotKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { record: unknown; state: unknown };
  } catch {
    return null;
  }
}

export function writeSave(id: string, session: Session, name?: string): void {
  const existing = listSaves().find(item => item.id === id);
  const meta: SaveMeta = {
    id,
    name: name ?? existing?.name ?? '存档',
    savedAt: new Date().toISOString(),
    scenarioId: session.record.manifest.scenarioId,
    status: session.state.status,
    turn: session.state.clock.absoluteTurn,
  };
  localStorage.setItem(slotKey(id), JSON.stringify({ record: session.record, state: session.state }));
  writeIndex([...readIndex().filter(item => item.id !== id), meta]);
}

export function deleteSave(id: string): void {
  localStorage.removeItem(slotKey(id));
  writeIndex(readIndex().filter(item => item.id !== id));
}
