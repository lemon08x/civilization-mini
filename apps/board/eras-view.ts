import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
export function erasPage(o:SessionObservation,button:(id:string)=>string):string{
 const e=o.game.era;if(!e)return '';
 const p=e.projection;
 const dungeon=e.dungeon;
 const modern=e.generationLimit===null;
 const clock=modern
   ?`<p>现代使命剩余 ${e.crises?.remaining??0} 天；到期或主动结算即结束旅程。四项至少兜底才算使命完成。</p>`
   :`<p>本阶段剩余 ${e.timeBudget.remaining}/${e.timeBudget.limit} 天，包含上阶段结转 ${e.timeBudget.received} 天。到期自动结算；师徒交接不重置倒计时。</p>`;
 const goals=!modern&&(e.goals?.length)?`<section class="panel"><div class="panel-head"><h2>本时代结业清单</h2></div><div class="panel-body"><ul class="check-list">${e.goals.map(x=>`<li>${x.done?'✓':'○'} ${esc(x.label)}</li>`).join('')}</ul></div></section>`:'';
 const reading=`<p>回看这一阶段的积累，选择何时进入下一社会。跨时代保留师徒谱系、个人修为和所学。现代阶段结算后，旅程结束。</p>
   ${clock}
   <p>${esc(e.stage.description)}</p>
   <p>历程：${e.stages.map((x,i)=>i===e.index?'【'+x.name+'】':x.name).join(' → ')}</p>
   ${goals}
   <section class="panel"><div class="panel-head"><h2>本阶段社会服务</h2></div><div class="panel-body"><p>这些服务由社会提供，不需要点科技树。</p>${(e.services??[]).map(x=>`<p>${esc(x)}</p>`).join('')}${button('economy:publicmill:grain')}${button('economy:tap:on')}${button('economy:tap:off')}</div></section>
   <section class="panel"><div class="panel-head"><h2>本阶段社会卡</h2></div><div class="panel-body"><h3>${esc(e.card.name)}</h3><p>${esc(e.card.description)}</p><p>效果持续整个阶段，不因人物换代重抽；未来抽牌结果不提前展示。</p></div></section>
   <section class="panel"><div class="panel-head"><h2>知识开放</h2></div><div class="panel-body"><p>部分课程要社会发展到相应阶段才出现在学堂。个人知识属于实际人物，跨时代不会丢失；新弟子仍须从基础学习。</p><p>尚未开放：${(e.lockedKnowledge??[]).map(n=>esc(n.name)).join('、')||'当前社会课程均已开放'}</p></div></section>`;
 const settle=`<h3>结算当前社会</h3>
   <p>${modern?'提交后会立即结束这次旅程，并按副本任务计分。':`提交后会立即进入下一社会，由原有师徒继续生活；当前剩余 ${e.timeBudget.transferable} 天，按 ${e.timeBudget.percent}% 结转到下一阶段，增加 ${e.timeBudget.carry} 天、损耗 ${e.timeBudget.lost} 天。`}只兑现已经获得的回报，不额外推进日历。</p>
   <ul class="check-list">
     <li>已取得回报凭证 ${e.rewardClaims} 份</li>
     ${modern?`<li>现在结算预计兑现 ${e.expectedReward} 钱</li>`:`<li>现在结算预计兑现 ${e.expectedReward} 钱（仅含已取得的回报）</li>`}
     <li>每 ${e.rewardDivisor} 凭证兑换 1 钱，向下取整。每份真实收获计 ${e.stage.foodWeight} 份基础凭证，每份加工产出计 ${e.stage.craftWeight} 份。</li>
     ${modern?'':(p.notes.map(n=>`<li>${esc(n)}</li>`).join('')||'<li>尚未形成可推算的产能。</li>')}
     ${e.electricRewardPercent!==undefined?`<li>${esc(e.electricRequirement??'')} 当前回报比例 ${e.electricRewardPercent}%。预览已计入该比例；结算以本季实际用电为准，不能用“有设备 / 已启用 / 已发电”代替。</li>`:''}
   </ul>
   <div class="inspector-action">${button('economy:erasettle:stage')}</div>
   <h3>已结束的社会</h3>${o.eraSettlements?.map(x=>`<p>${esc(x.detail)}</p>`).join('')||'<p>尚无已结束的社会阶段。季数耗尽后的自动结算也会出现在记事里。</p>'}
   ${e.crises?`<h3>飞龙在天 · 现代使命</h3><p>剩余${e.crises.remaining}/${e.crises.limit}天 · 总分${e.crises.score} · ${e.crises.won===null?'任务进行中':e.crises.won?'使命完成':'使命未完成'}</p>${e.crises.entries.map(c=>`<section class="panel"><div class="panel-body"><h3>${esc(c.name)}</h3><p>${esc(c.purpose)}</p><p>最高：${c.levelName} · ${c.score}分；当前步骤${c.step}/3。每档分数：${[1,2,3].map(n=>o.game.sect!.rules.crisisScore*n*n).join(' / ')}。</p>${o.game.actions.filter(a=>a.id.startsWith('economy:crisis:'+c.id+'-')).map(a=>button(a.id)).join('')}</div></section>`).join('')}`:''}
   ${dungeon?`<h3>最终副本：跨代家业试炼</h3>
     <p>总分 ${dungeon.score}/${dungeon.target}。达到 ${dungeon.target} 分即满足胜利条件，超出记为高分。这不是离开现代的条件。完成副本并结算后才算旅程胜利。</p>
     ${dungeon.powered!==undefined?`<p>通电验收：${dungeon.powered?'已真实交付电力':'尚未完成；总分达标后仍须交付电力。拥有电器不等于已经完成验收。'}</p>`:''}
     <ul class="check-list">${dungeon.options.map(x=>`<li>${x.done?'✓':'○'} ${esc(x.name)} · 分值 ${x.progress}${x.done?' · 已完成':' · 可交付'}</li>`).join('')}</ul>
     <div class="inspector-action">${button('economy:dungeonstart:family')}${dungeon.options.map(x=>button('economy:dungeonwork:'+x.id)).join('')}</div>`
     :e.crises?'':'<h3>现代使命</h3><p>进入现代时信物自动召集。此前回报只用于经营，不计最终分数。</p>'}`;
 return `<div class="page-workbench"><section>${reading}</section><aside class="course-inspector">${settle}</aside></div>`;
}
