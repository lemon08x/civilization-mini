import { createSession, parseSession } from '../../src/runtime/session.js';
import { FRAMEWORKS } from '../../src/game/model/eras.js';
import { loadAssembledRules } from './rules.js';
import { deleteSave, listSaves, writeSave } from './saves.js';

const form = document.getElementById('start-form') as HTMLFormElement;
const button = document.getElementById('new-game') as HTMLButtonElement;
const error = document.getElementById('error')!;
const saveList = document.getElementById('save-list')!;
const importInput = document.getElementById('import') as HTMLInputElement;
let busy = false;

// Progressive enhancement: chapter text and anchor navigation work without JavaScript.
const chapters=Array.from(document.querySelectorAll<HTMLElement>('.legacy-chapter'));
const chapterLinks=Array.from(document.querySelectorAll<HTMLAnchorElement>('.legacy-chapters a'));
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(entry.isIntersecting){
        entry.target.classList.add('legacy-arrived');
        chapterLinks.forEach(link=>{
          if(link.hash==='#'+entry.target.id)link.setAttribute('aria-current','location');
          else link.removeAttribute('aria-current');
        });
      }
    }
  },{rootMargin:'-12% 0px -45% 0px',threshold:0});
  chapters.forEach(chapter=>observer.observe(chapter));
}


function showError(message: string): void {
  error.textContent = message;
  error.hidden = false;
}

function renderSaves(): void {
  const saves = listSaves();
  saveList.innerHTML = saves.length
    ? saves.map(save => {
      const place = FRAMEWORKS.find(f => f.id === save.frameworkId)?.name ?? (save.frameworkId || '旧规则存档，请新开游戏');
      const when = save.savedAt.slice(0, 16).replace('T', ' ');
      return `<article class="save-row"><div><strong>${save.name}</strong><p class="subtle">${place} · ${save.status} · ${when}</p></div><div class="save-actions"><a class="start-continue" href="/play?save=${encodeURIComponent(save.id)}">打开</a><button type="button" data-delete="${save.id}">删除</button></div></article>`;
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
  const frameworkOptions = document.getElementById('framework-options')!;
  frameworkOptions.innerHTML = FRAMEWORKS.map(f => `
    <label class="framework-card${f.implemented ? '' : ' framework-disabled'}">
      <input type="radio" name="framework" value="${f.id}"${f.id === 'riverine' ? ' checked' : ''}${f.implemented ? '' : ' disabled'}>
      <strong>${f.name}</strong>
      <p class="subtle">${f.summary}</p>
      <p class="subtle">${f.stages.map(s => s.name).join(' → ')}</p>
      ${f.implemented ? '' : '<p class="subtle">框架预告 · 暂未开放</p>'}
    </label>`).join('');
  renderSaves();
  button.disabled = false;
  frameworkOptions.addEventListener('change', () => {
    const selected = form.querySelector<HTMLInputElement>('input[name="framework"]:checked');
    document.getElementById('framework-current')!.textContent = FRAMEWORKS.find(f => f.id === selected?.value)?.name ?? '大河农耕';
  });
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
      const frameworkId = (form.querySelector('input[name="framework"]:checked') as HTMLInputElement).value;
      const session = await createSession({
        runId: crypto.randomUUID(),
        ruleset: rules,
        seed: Number((document.getElementById('seed') as HTMLInputElement).value),
        frameworkId,
      });
      const name = `${FRAMEWORKS.find(f => f.id === frameworkId)?.name ?? frameworkId} · ${new Date().toLocaleString()}`;
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
