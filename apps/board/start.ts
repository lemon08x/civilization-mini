import { createSession } from '../../src/runtime/session.js';
import { validateRuleset } from '../../src/game/ruleset.js';
import type { ImplementationIdentity } from '../../src/runtime/records.js';

const key='civilization-mini.social-food.v21';
const form=document.getElementById('start-form') as HTMLFormElement;
const button=document.getElementById('new-game') as HTMLButtonElement;
const error=document.getElementById('error')!;
let busy=false;
try {
  const previous=localStorage.getItem(key);
  document.getElementById('continue-game')!.hidden=!previous;
  document.getElementById('save-notice')!.hidden=!previous;
  const rules=validateRuleset(await (await fetch('/rulesets/social-food.v21.json')).json());
  const implementation:ImplementationIdentity=await(await fetch('/implementation.json')).json();
  button.disabled=false;button.textContent='启程 →';
  form.onsubmit=async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    busy=true;button.disabled=true;error.hidden=true;
    try {
      if(localStorage.getItem(key)!==previous)throw new Error('另一页面更新了存档，请刷新开始界面后重试。');
      const next=await createSession({runId:crypto.randomUUID(),ruleset:rules,implementation,
        seed:Number((document.getElementById('seed') as HTMLInputElement).value),
        scenarioId:(document.getElementById('scenario') as HTMLSelectElement).value});
      if(localStorage.getItem(key)!==previous)throw new Error('另一页面更新了存档，请刷新开始界面后重试。');
      // Preserve the exact old bytes, including unreadable records; never migrate them.
      if(previous!==null)localStorage.setItem(`${key}.backup.${Date.now()}.${crypto.randomUUID()}`,previous);
      localStorage.setItem(key,JSON.stringify(next.record));
      location.assign('/play');
    } catch(cause) {
      error.textContent=(cause as Error).message;error.hidden=false;busy=false;button.disabled=false;
    }
  };
} catch(cause) {
  error.textContent='开始界面加载失败：'+(cause as Error).message;error.hidden=false;
  button.textContent='暂时无法开始';
}
