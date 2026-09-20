import { createSession, parseSession } from '../../src/runtime/session.js';
import { loadAssembledRules } from './rules.js';
import { deleteSave, listSaves, SCENARIO_NAMES, writeSave } from './saves.js';

const form = document.getElementById('start-form') as HTMLFormElement;
const button = document.getElementById('new-game') as HTMLButtonElement;
const error = document.getElementById('error')!;
const saveList = document.getElementById('save-list')!;
const importInput = document.getElementById('import') as HTMLInputElement;
let busy = false;

function showError(message: string): void {
  error.textContent = message;
  error.hidden = false;
}

function renderSaves(): void {
  const saves = listSaves();
  saveList.innerHTML = saves.length
    ? saves.map(save => {
      const place = SCENARIO_NAMES[save.scenarioId] ?? save.scenarioId;
      const when = save.savedAt.slice(0, 16).replace('T', ' ');
      return `<article class="save-row"><div><strong>${save.name}</strong><p class="subtle">${place} · 第${save.turn}季 · ${save.status} · ${when}</p></div><div class="save-actions"><a class="start-continue" href="/play?save=${encodeURIComponent(save.id)}">打开</a><button type="button" data-delete="${save.id}">删除</button></div></article>`;
    }).join('')
    : '<p class="subtle">还没有本机旅程。可以从下面开启新的一章，或导入一份存档。</p>';
  saveList.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(item => {
    item.onclick = () => {
      if (busy) return;
      deleteSave(item.dataset.delete!);
      renderSaves();
    };
  });
}

async function importSave(file: File): Promise<void> {
  if (busy) return;
  busy = true;
  error.hidden = true;
  try {
    const rules = await loadAssembledRules();
    const value = JSON.parse(await file.text());
    const next = parseSession(value);
    if (next.record.manifest.ruleset.rulesVersion !== rules.rulesVersion) throw new Error('仅导入当前规则存档');
    const id = crypto.randomUUID();
    writeSave(id, next, `导入 · ${new Date().toLocaleString()}`);
    location.assign('/play?save=' + encodeURIComponent(id));
  } catch (cause) {
    showError((cause as Error).message);
    busy = false;
  }
}

try {
  const rules = await loadAssembledRules();
  renderSaves();
  button.disabled = false;
  button.textContent = '写下新的一章 →';
  importInput.onchange = async ev => {
    const file = (ev.target as HTMLInputElement).files?.[0];
    if (file) await importSave(file);
    importInput.value = '';
  };
  form.onsubmit = async event => {
    event.preventDefault();
    if (busy || !form.reportValidity()) return;
    busy = true;
    button.disabled = true;
    error.hidden = true;
    try {
      const scenarioId = (document.getElementById('scenario') as HTMLSelectElement).value;
      const session = await createSession({
        runId: crypto.randomUUID(),
        ruleset: rules,
        seed: Number((document.getElementById('seed') as HTMLInputElement).value),
        scenarioId,
      });
      const name = `${SCENARIO_NAMES[scenarioId] ?? scenarioId} · ${new Date().toLocaleString()}`;
      writeSave(session.record.manifest.runId, session, name);
      location.assign('/play?save=' + encodeURIComponent(session.record.manifest.runId));
    } catch (cause) {
      showError((cause as Error).message);
      busy = false;
      button.disabled = false;
    }
  };
} catch (cause) {
  showError('开始界面加载失败：' + (cause as Error).message);
  button.textContent = '暂时无法开始';
}
