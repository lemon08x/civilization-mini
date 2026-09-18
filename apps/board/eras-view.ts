import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
export function erasPage(o:SessionObservation,button:(id:string)=>string):string{
 const e=o.game.era;if(!e)return '';
 const p=e.projection;
 const dungeon=e.dungeon;
 const reading=`<p>回看这一阶段的积累，选择何时进入下一社会。现代阶段结算后，旅程结束。</p>
   <p>本阶段已过 ${e.elapsed}/${e.duration} 季，时间预算还剩 ${e.remaining} 季。越早结算，剩余产能推算越长。</p>
   <progress class="era-progress" aria-label="社会阶段进度" max="${e.duration}" value="${e.elapsed}"></progress>
   <p>${esc(e.stage.description)}</p>
   <p>历程：${e.stages.map((x,i)=>i===e.index?'【'+x.name+'】':x.name).join(' → ')}</p>
   <section class="panel"><div class="panel-head"><h2>本阶段社会服务</h2></div><div class="panel-body"><p>这些服务由社会提供，不需要点科技树。</p>${(e.services??[]).map(x=>`<p>${esc(x)}</p>`).join('')}${button('economy:publicmill:grain')}${button('economy:tap:on')}${button('economy:tap:off')}</div></section>
   <section class="panel"><div class="panel-head"><h2>本阶段社会卡</h2></div><div class="panel-body"><h3>${esc(e.card.name)}</h3><p>${esc(e.card.description)}</p><p>效果持续整个阶段，不因人物换代重抽；未来抽牌结果不提前展示。</p></div></section>
   <section class="panel"><div class="panel-head"><h2>知识开放</h2></div><div class="panel-body"><p>部分课程要社会发展到相应阶段才出现在学堂。已经学会的知识继续生效。</p><p>尚未开放：${(e.lockedKnowledge??[]).map(n=>esc(n.name)).join('、')||'当前社会课程均已开放'}</p></div></section>`;
 const settle=`<h3>结算当前社会</h3>
   <p>提交后会结束本季并进入下一社会。现代阶段结算即结束旅程。预估会受当季实际结果影响，最终金额以真实结算事件为准。</p>
   <ul class="check-list">
     <li>已取得回报凭证 ${e.rewardClaims} 份</li>
     <li>现在结算预计兑现 ${e.expectedReward} 钱（含剩余 ${p.remaining} 季推算 ${p.claims} 份）</li>
     <li>每 ${e.rewardDivisor} 凭证兑换 1 钱，向下取整。每份真实收获计 ${e.stage.foodWeight} 份基础凭证，每份加工产出计 ${e.stage.craftWeight} 份。</li>
     ${p.notes.map(n=>`<li>${esc(n)}</li>`).join('')||'<li>尚未形成可推算的产能。</li>'}
     ${e.electricRewardPercent!==undefined?`<li>${esc(e.electricRequirement??'')} 当前回报比例 ${e.electricRewardPercent}%。预览已计入该比例；结算以本季实际用电为准，不能用“有设备 / 已启用 / 已发电”代替。</li>`:''}
   </ul>
   <div class="inspector-action">${button('economy:erasettle:stage')}</div>
   <h3>已结束的社会</h3>${o.eraSettlements?.map(x=>`<p>${esc(x.detail)}</p>`).join('')||'<p>尚无已结束的社会阶段。阶段到期的自动结算也会出现在记事里。</p>'}
   ${dungeon?`<h3>最终副本：跨代家业试炼</h3>
     <p>工程进度 ${dungeon.progress}/${dungeon.target} · ${dungeon.complete?'进度条件已达成':'可混合农业、机械、资金或数学路线'}。这不是离开现代的条件。完成副本并结算后才算旅程胜利。</p>
     ${dungeon.powered!==undefined?`<p>通电验收：${dungeon.powered?'已真实交付电力':'尚未完成；进度达标后仍须交付电力。拥有电器或进度满不等于已经完成。'}</p>`:''}
     <div class="inspector-action">${button('economy:dungeonstart:family')}${['food','craft','contract','math','power','appliance'].map(x=>button('economy:dungeonwork:'+x)).join('')}</div>`
     :'<h3>最终副本</h3><p>只在现代社会开放。前面各阶段的生产回报独立结算。</p>'}`;
 return `<div class="page-workbench"><section>${reading}</section><aside class="course-inspector">${settle}</aside></div>`;
}
