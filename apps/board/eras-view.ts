import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
import {panel} from './human-view.js';
export function erasPage(o:SessionObservation,button:(id:string)=>string):string{
 const e=o.game.era;if(!e)return '';
 const p=e.projection;
 return panel(e.stage.name,`<p>这是文明背景。你可以随时结算进入下一社会，不必建成水井或泵。到期仍会结算，但只兑实际生产。</p><p>本阶段已过${e.elapsed}/${e.duration}季，时间预算还剩${e.remaining}季。越早结算，剩余产能推算越长。</p><progress aria-label="社会阶段进度" max="${e.duration}" value="${e.elapsed}"></progress><p>${esc(e.stage.description)}</p><p>历程：${e.stages.map((x,i)=>i===e.index?'【'+x.name+'】':x.name).join(' → ')}</p>${button('economy:erasettle:stage')}`)
 +panel('本阶段社会服务',`<p>这些服务由社会提供，不需要点科技树。</p>${(e.services??[]).map(x=>`<p>${esc(x)}</p>`).join('')}${button('economy:publicmill:grain')}${button('economy:tap:on')}${button('economy:tap:off')}`)
 +panel('本阶段社会卡',`<h3>${esc(e.card.name)}</h3><p>${esc(e.card.description)}</p><p>效果持续整个阶段，不因人物换代重抽；未来抽牌结果不提前展示。</p>`)
 +panel('本阶段生产与回报',`<p>已取得回报凭证${e.rewardClaims}份。现在结算预计兑现${e.expectedReward}钱（含剩余${p.remaining}季推算${p.claims}份）。每${e.rewardDivisor}凭证兑换1钱，向下取整。</p><p>每份真实收获计${e.stage.foodWeight}份基础凭证，每份加工产出计${e.stage.craftWeight}份。推算按已建系统、公共供水和人员约束，不掷未来天气。</p><p>${p.notes.map(esc).join('；')||'尚未形成可推算的产能。'}</p><p>本阶段收益结清后不被后续公共服务追溯取消。</p>${o.eraSettlements?.map(x=>`<p>${esc(x.detail)}</p>`).join('')||'<p>尚无已结束的社会阶段。</p>'}`)
 +panel('知识开放',`<p>部分课程要社会发展到相应阶段才出现在学堂。已经学会的知识继续生效。</p><p>尚未开放：${(e.lockedKnowledge??[]).map(n=>esc(n.name)).join('、')||'当前社会课程均已开放'}</p>`)
 +(e.dungeon?panel('最终副本：跨代家业试炼',`<p>工程进度${e.dungeon.progress}/${e.dungeon.target} · ${e.dungeon.complete?'已完成':'可混合农业、机械、资金或数学路线'}</p><p>不是离开现代的条件。完成副本并结算后才算旅程胜利。</p>${button('economy:dungeonstart:family')}${['food','craft','contract','math'].map(x=>button('economy:dungeonwork:'+x)).join('')}`):panel('最终副本','<p>只在现代社会开放。前面各阶段的生产回报独立结算。</p>'));
}
