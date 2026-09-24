import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
type Game=SessionObservation['game'];
export function storyPanel(g:Game,surface:'place'|'relaxation'|'learning'|'farming'|'inheritance',subjectId?:string):string{
 const records=g.story.records.filter(r=>(subjectId?r.subjectId===subjectId:r.surface===surface)).slice(-3).reverse();
 if(!records.length)return '';
 return `<section class="story-panel" aria-label="相关往事"><small>此刻与来路</small>${records.map(r=>`<article><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p><small>第${Math.floor(r.day)+1}日${r.day%1?' · 下午':' · 上午'}</small></article>`).join('')}</section>`;
}
export function storyArchive(g:Game):string{
 return `<details class="story-archive"><summary>往事记录 · ${g.story.records.length} 段</summary>${[...g.story.records].reverse().map(r=>`<article><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p><small>第${Math.floor(r.day)+1}日${r.day%1?' · 下午':' · 上午'} · ${esc(r.subjectId)}</small></article>`).join('')||'<p>故事会随真实经历留下。</p>'}</details>`;
}
export function landscapeBenefits(g:Game,kind:'reading'|'memorial'|'garden'):string{
 const places=g.landscapes.filter(p=>p.kind===kind);return places.length?`<aside class="landscape-benefit"><strong>景观助益</strong>${places.map(p=>`<p>${esc(p.name)} · ${esc(p.plotId)}：${esc(p.description)}</p>`).join('')}<small>同类效果取最高，不叠加；改建后按当前景观重新计算。</small></aside>`:'';
}

export function storyChoices(g:Game,subjectId:string,button:(id:string)=>string):string {
 return g.story.choices.filter(c=>c.subjectId===subjectId&&g.actions.some(a=>a.id===c.actionId)).map(c=>`<div class="story-choice"><small>${esc(c.label)}</small>${button(c.actionId)}</div>`).join('');
}
