import type { SessionObservation } from '../../src/runtime/session.js';
import { esc } from './economy-view.js';
import { GOODS } from '../../src/game/systems/economy-catalog.js';
import type { GameEvent } from '../../src/game/model/events.js';

export function workshopPage(g:SessionObservation['game'],button:(id:string)=>string,recentEvents:GameEvent[]=[]):string {
  const net=g.economy!.workshopView;if(!net)return '';
  const action=(op:string,id:string)=>button(`economy:${op}:${id}`);
  return `<section class="panel"><div class="panel-head"><h2>作坊协作 · 亚麻 → 纤维 → 绳索</h2></div><div class="panel-body">
    <p>分别建立作坊、雇用工人，让上游供应下游。也可以只建绳索作坊，从家庭库存取用购买或手工制作的纤维。</p>
    <p>季末先运输已有库存，再加工；发货下一季到达。新产物最快下季发运、再下一季到家。每个工位每季最多1批，实际加工每批付${net.wage}钱；缺料或堵塞不扣工资。家庭的手摇设备与工匠经验不加成这些独立工位。</p>
    <p>建立作坊需要生产组织2阶；纤维需材料1阶，绳索需材料2阶。每次建设或扩建都使用当季招募额度。</p>
    ${g.economy!.operations!.paused?'<p>换代后网络已暂停，库存与在途货物保留。</p>'+button('economy:resumeplans:family'):''}
    <div class="family-grid">${net.nodes.map(n=>{const w=n.unit;return `<article class="family-item"><h3>${esc(n.name)}</h3><p>每批：2 ${GOODS[n.input].name} → ${n.id==='fiber'?2:1} ${GOODS[n.output].name}</p>${!w?action('workshopbuild',n.id):`
      <p><strong>${w.active?'已启用':'已暂停'} · ${w.units}个工位</strong><br>当前条件：${esc(n.blockers.join('；')||'具备至少一批加工条件')}</p>
      <p>来源：${w.source==='upstream'?'纤维作坊':'家庭库存'}<br>原料缓冲 ${w.input}/${net.parameters.buffer} · 成品缓冲 ${w.output}/${net.parameters.buffer}<br>每条运输路线 ${net.parameters.transport*w.logistics}份／季<br>满负荷：耗料${2*w.units}份、产出${(n.id==='fiber'?2:1)*w.units}份、工资${net.wage*w.units}钱／季</p>
      ${n.id==='fiber'&&net.nodes.find(x=>x.id==='rope')?.unit?.source==='upstream'?'<p>纤维留给绳索作坊，使用绳索作坊的进料运力；下游暂停时会逐渐积满。</p>':'<p>成品运回家庭库存；可供自用或由自动交付出售。</p>'}
      ${action('workshoppause',n.id)}<details><summary>扩建与运输</summary>${action('workshopexpand',n.id)}${action('workshoptransport',n.id)}</details>
      ${n.id==='rope'?`<details><summary>更换供货来源</summary>${action('workshophousehold',n.id)}${action('workshopupstream',n.id)}</details>`:''}`}</article>`;}).join('')}</div>
    <h3>在途货物</h3>${net.shipments.length?`<ul>${net.shipments.map(x=>`<li>${GOODS[x.good].name} ${x.amount}份 → ${x.target==='household'?'家庭库存':net.nodes.find(n=>n.id===x.target)!.name}，累计第${x.due}季到达</li>`).join('')}</ul>`:'<p>暂无在途货物。初建后先在季末发运原料。</p>'}
    <h3>最近运行记录</h3><ul>${recentEvents.filter(e=>e.type==='operations'&&e.operation.startsWith('workshop-')).map(e=>`<li>${esc(e.type==='operations'?e.detail:'')}</li>`).join('')||'<li>最近没有作坊事件。结算后显示实际发货、产出和等待原因。</li>'}</ul>
    <details><summary>采购、销售与现金</summary><p>自动补货只买家庭供货路线缺少的原料；不会为内部路线购买纤维。预留生活、全部作坊满负荷工资及现金底线，仍受市场库存和采购运输限制。自动交付会保留作坊需要的家庭原料；成品到家后才可出售。</p>${button('economy:supplyplan:on')}${button('economy:salesplan:on')}</details>
  </div></section>`;
}
