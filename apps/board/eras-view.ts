import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
export function erasPage(o:SessionObservation,button:(id:string)=>string):string{
 const e=o.game.era;if(!e)return '';
 const p=e.projection;
 const dungeon=e.dungeon;
 const modern=e.generationLimit===null;
 const clock=modern
   ?'<p>现代阶段不限代，也没有到期结算；何时结束由你决定，主动结算即结束旅程并按副本任务计分。</p>'
   :`<p>本时代第 ${e.generationsLived+1}/${e.generationLimit} 代。住满 ${e.generationLimit} 代后，交接时强制结算；越早结算，剩余产能推算越长。</p>${e.lastGeneration?'<p class="status-pill status-warning">这是本时代最后一代，交接时将强制结算，只兑现已经发生的实际生产。</p>':''}`;
 const goals=!modern&&(e.goals?.length)?`<section class="panel"><div class="panel-head"><h2>本时代结业清单</h2></div><div class="panel-body"><ul class="check-list">${e.goals.map(x=>`<li>${x.done?'✓':'○'} ${esc(x.label)}</li>`).join('')}</ul></div></section>`:'';
 const reading=`<p>回看这一阶段的积累，选择何时进入下一社会。现代阶段结算后，旅程结束。</p>
   ${clock}
   <p>${esc(e.stage.description)}</p>
   <p>历程：${e.stages.map((x,i)=>i===e.index?'【'+x.name+'】':x.name).join(' → ')}</p>
   ${goals}
   <section class="panel"><div class="panel-head"><h2>本阶段社会服务</h2></div><div class="panel-body"><p>这些服务由社会提供，不需要点科技树。</p>${(e.services??[]).map(x=>`<p>${esc(x)}</p>`).join('')}${button('economy:publicmill:grain')}${button('economy:tap:on')}${button('economy:tap:off')}</div></section>
   <section class="panel"><div class="panel-head"><h2>本阶段社会卡</h2></div><div class="panel-body"><h3>${esc(e.card.name)}</h3><p>${esc(e.card.description)}</p><p>效果持续整个阶段，不因人物换代重抽；未来抽牌结果不提前展示。</p></div></section>
   <section class="panel"><div class="panel-head"><h2>知识开放</h2></div><div class="panel-body"><p>部分课程要社会发展到相应阶段才出现在学堂。已经学会的知识继续生效。</p><p>尚未开放：${(e.lockedKnowledge??[]).map(n=>esc(n.name)).join('、')||'当前社会课程均已开放'}</p></div></section>`;
 const settle=`<h3>结算当前社会</h3>
   <p>${modern?'提交后会结束本季、结束这次旅程，并按副本任务计分。':`提交后会结束本季并进入下一社会；剩余约 ${e.remaining} 季（按代际估计）将推算兑现。`}预估会受当季实际结果影响，最终金额以真实结算事件为准。</p>
   <ul class="check-list">
     <li>已取得回报凭证 ${e.rewardClaims} 份</li>
     ${modern?`<li>现在结算预计兑现 ${e.expectedReward} 钱</li>`:`<li>现在结算预计兑现 ${e.expectedReward} 钱（含剩余约 ${p.remaining} 季推算 ${p.claims} 份）</li>`}
     <li>每 ${e.rewardDivisor} 凭证兑换 1 钱，向下取整。每份真实收获计 ${e.stage.foodWeight} 份基础凭证，每份加工产出计 ${e.stage.craftWeight} 份。</li>
     ${modern?'':(p.notes.map(n=>`<li>${esc(n)}</li>`).join('')||'<li>尚未形成可推算的产能。</li>')}
     ${e.electricRewardPercent!==undefined?`<li>${esc(e.electricRequirement??'')} 当前回报比例 ${e.electricRewardPercent}%。预览已计入该比例；结算以本季实际用电为准，不能用“有设备 / 已启用 / 已发电”代替。</li>`:''}
   </ul>
   <div class="inspector-action">${button('economy:erasettle:stage')}</div>
   <h3>已结束的社会</h3>${o.eraSettlements?.map(x=>`<p>${esc(x.detail)}</p>`).join('')||'<p>尚无已结束的社会阶段。住满代数后的强制结算也会出现在记事里。</p>'}
   ${dungeon?`<h3>最终副本：跨代家业试炼</h3>
     <p>总分 ${dungeon.score}/${dungeon.target}。达到 ${dungeon.target} 分即满足胜利条件，超出记为高分。这不是离开现代的条件。完成副本并结算后才算旅程胜利。</p>
     ${dungeon.powered!==undefined?`<p>通电验收：${dungeon.powered?'已真实交付电力':'尚未完成；总分达标后仍须交付电力。拥有电器不等于已经完成验收。'}</p>`:''}
     <ul class="check-list">${dungeon.options.map(x=>`<li>${x.done?'✓':'○'} ${esc(x.name)} · 分值 ${x.progress}${x.done?' · 已完成':' · 可交付'}</li>`).join('')}</ul>
     <div class="inspector-action">${button('economy:dungeonstart:family')}${dungeon.options.map(x=>button('economy:dungeonwork:'+x.id)).join('')}</div>`
     :'<h3>最终副本</h3><p>只在现代社会开放。前面各阶段的生产回报独立结算。</p>'}`;
 return `<div class="page-workbench"><section>${reading}</section><aside class="course-inspector">${settle}</aside></div>`;
}
