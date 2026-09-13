import type { SessionObservation } from '../../src/runtime/session.js';
import { esc,inputsText,needsText } from './economy-view.js';

export function expeditionPage(o:SessionObservation,button:(id:string)=>string):string{
  const x=o.game.economy!.expeditionView!;
  const state=x.selected?x.attempts[x.selected]:undefined;
  const selected=x.catalog.find(f=>f.id===x.selected);
  return `<section class="panel"><div class="panel-head"><h2>文明副本</h2><span>供应渠道：${x.supplyLevel}阶</span></div><div class="panel-body">
  <p>先建设农业、工具、加工与分工，再选择生产力能够支撑的挑战。副本消耗真实物资，首次完成后自动发放更高阶段的材料、教材和供应渠道。教材只是学习来源，仍需逐阶学习。</p>
  <p>副本独立选择，无须按列表顺序完成。${x.lineage?'可分批装运已有物资，个人投入见行动报价，下一季到场。早期挑战承认本代已经做过的生产证明，不必先开副本再重做一遍。':'每次装运最多一套物资，个人投入见行动报价，下一季到场。'}每个副本仅首次完成领奖；完成全部副本后仍可继续经营与传承。</p>
  ${x.lineage?'<p>换代时，本代已掌握的学科写入家族记录，后辈按记录接续，不必从第一阶重学；新课题仍要本人学习。本代生产证明不带到下一代。</p>':''}
  ${x.catalog.map(f=>{const a=x.attempts[f.id];return `<details ${f.id===x.selected?'open':''}><summary>${a?.completed?'✓ 已完成：':a?.active?'进行中：':''}${esc(f.name)} · ${needsText(f.requires)}</summary><p>${esc(f.purpose)}</p><p>每有效季投入：${inputsText(f.kit)}${f.power?'；另用'+f.power+'电':''}。${f.clean?'连续':'累计'}${f.seasons}个有效季，家庭须无缺粮。</p><p>能力证明：${esc(f.proofName)}${f.services.length?'；当季无线调度在线':''}${f.clean?'、数字控制在线及清洁发电':''}。</p><p><strong>首次奖励：</strong>${inputsText(f.reward.goods)}；${f.reward.money}钱；${f.bookNames.map(esc).join('、')}教材；供应渠道提高至至少${f.reward.supplyLevel}阶。</p>${a?.completed?'<p>奖励已发放并保留在家庭，不会重复领取。</p>':f.id===x.selected&&a?.active?'':button('economy:expeditionstart:'+f.id)}</details>`;}).join('')}
  </div></section>
  ${selected&&state?`<section class="panel"><div class="panel-head"><h2>当前挑战 · ${esc(selected.name)}</h2></div><div class="panel-body"><p>${state.completed?'已完成并领奖':state.active?'进行中':'已暂停'} · ${state.progress}/${selected.seasons}有效季</p><p>现场：${inputsText(state.stock)||'暂无'}。</p>${state.shipments.map(q=>`<p>在途：${inputsText(q.goods)}，累计第${q.due}季到场。</p>`).join('')}${!state.completed?button('economy:expeditionship:current')+button('economy:expeditionpause:current')+'<h3>待满足条件</h3><ul>'+selected.blockers.map(b=>'<li>'+esc(b)+'</li>').join('')+'</ul>':''}<p>物料到场不等于完成。初期挑战记录本次挑战期间的真实生产，后期挑战逐季检查能力。清洁能源协同区暂停或断供会中断连续验收。</p></div></section>`:''}
  <section class="panel"><div class="panel-head"><h2>副本反馈</h2></div><div class="panel-body">${o.recentEvents.filter(e=>e.type==='expedition').map(e=>`<p>${esc(e.type==='expedition'?e.detail:'')}</p>`).join('')||'<p>开始后显示装运、到货、生产验证与奖励。</p>'}</div></section>`;
}
