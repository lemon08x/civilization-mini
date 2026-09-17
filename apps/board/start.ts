import { createSession } from '../../src/runtime/session.js';
import { loadAssembledRules } from './rules.js';
import { deleteSave, listSaves, SCENARIO_NAMES, writeSave } from './saves.js';

const form = document.getElementById('start-form') as HTMLFormElement;
const button = document.getElementById('new-game') as HTMLButtonElement;
const error = document.getElementById('error')!;
const savePanel = document.getElementById('save-panel')!;
const saveList = document.getElementById('save-list')!;
let busy = false;

function showError(message: string): void {
  error.textContent = message;
  error.hidden = false;
}

function renderSaves(): void {
  const saves = listSaves();
  savePanel.hidden = saves.length === 0;
  saveList.innerHTML = saves.map(save => {
    const place = SCENARIO_NAMES[save.scenarioId] ?? save.scenarioId;
    const when = save.savedAt.slice(0, 16).replace('T', ' ');
    return `<article class="save-row"><div><strong>${save.name}</strong><p class="subtle">${place} · 第${save.turn}季 · ${save.status} · ${when}</p></div><div class="save-actions"><a class="start-continue" href="/play?save=${encodeURIComponent(save.id)}">打开</a><button type="button" data-delete="${save.id}">删除</button></div></article>`;
  }).join('');
  saveList.querySelectorAll<HTMLButtonElement>('[data-delete]').forEach(item => {
    item.onclick = () => {
      if (busy) return;
      deleteSave(item.dataset.delete!);
      renderSaves();
    };
  });
}

try {
  const rules = await loadAssembledRules();
  renderSaves();
  button.disabled = false;
  button.textContent = '启程 →';
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
