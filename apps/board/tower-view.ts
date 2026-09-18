import type { SessionObservation } from '../../src/runtime/session.js';
import { esc } from './economy-view.js';
import { towerGoodName } from '../../src/game/systems/tower.js';

export function towerPage(observation:SessionObservation,button:(id:string)=>string):string{
 const g=observation.game,t=g.economy!.towerView;if(!t)return '';
 const floor=t.floors[t.floor];
 const goods=(value:Record<string,number|undefined>)=>Object.entries(value).filter(([,n])=>n).map(([id,n])=>`${n}份${towerGoodName(id)}`).join('、');
 return `<section class="panel"><div class="panel-head"><h2>文明试炼 · ${t.name}</h2><span>${t.floor}/${t.total}层完成</span></div><div class="panel-body">
 <p>${g.economy!.modern?'以电力、电子制造与通信调度建成现代工业区。':'用实体供应链贯通两条大河。'}钱用于谋生、采购与工资；通关取决于材料到场、实际施工和持续组织能力。知识帮助你建设，但不再以学科数量判定胜利。</p>
 <ol class="tower-stages">${t.floors.map(f=>`<li class="tower-stage ${f.state}"><span class="tower-step">${f.state==='complete'?'✓':f.index+1}</span><div><strong>${esc(f.name)}</strong><p>${f.state==='complete'?'已完成':f.state==='current'?'当前层':'完成前层后开放'} · ${esc(f.subtitle)}</p><details ${f.state==='current'?'open':''}><summary>本层要求</summary><p>每个有效季消耗：${goods(f.kit)}。<br>${f.continuous?'连续':'累计'}${f.seasons}个有效施工季；家庭本季不能缺粮。</p>${f.proofNames.length?`<p>${f.proofNames.map(esc).join('；')}。</p>`:''}${f.pump?(g.economy!.modern?'<p>施工使用电动离心泵，每季扣1电及1耐用，电力已包含在本层总用电要求中。</p>':'<p>施工使用活塞泵，每次消耗工地木材与1耐用；不能与本季农业、矿场重复占用。</p>'):''}<p>${esc(f.effect)}</p></details></div></li>`).join('')}</ol>
 </div></section>
 ${floor?`<section class="panel"><div class="panel-head"><h2>第${t.floor+1}层 · ${esc(floor.name)}</h2></div><div class="panel-body">
 <p><strong>${t.active?'施工已开启':'等待开工'} · ${floor.continuous?'连续':'有效'}施工 ${t.progress}/${floor.seasons}季</strong></p>
 <progress class="tower-progress" max="${floor.seasons}" value="${t.progress}" aria-label="当前层施工进度"></progress>
 <p>${floor.continuous?'断供、停工或运行条件未满足，连续计数归零；已经消耗的施工材料不会退回。':'暂时缺料不会倒退已完成的施工，补齐条件后可继续。'}</p>
 ${g.economy!.operations!.paused?button('economy:resumeplans:family'):''}
 ${t.active?button('economy:towerpause:current')+button('economy:towerdelivery:'+(t.delivery?'off':'on')):button('economy:towerstart:'+floor.id)}
 <h3>本季待解决</h3>${t.blockers.length?`<ul>${t.blockers.map(b=>`<li>${esc(b)}</li>`).join('')}</ul>`:'<p>当前已具备施工条件，季末仍需先通过家庭生存结算。</p>'}
 <div class="family-grid"><article class="family-item"><h3>现场仓库</h3><p>${Object.values(t.stock).reduce((a,b)=>a+b,0)}/${t.capacity}份 · 运输 ${t.transport}份／季</p><p>${goods(t.stock)||'暂无材料'}</p><p>每季所需：${goods(floor.kit)}</p></article>
 <article class="family-item"><h3>在途与供货</h3><p>${t.delivery?'自动发运已开启':'自动发运已暂停'}。家庭先保留本季口粮，剩余材料分批装运，下一季到场。</p>${t.shipments.length?`<ul>${t.shipments.map(x=>`<li>${x.amount}份${towerGoodName(x.good)} · 累计第${x.due}季到场</li>`).join('')}</ul>`:'<p>暂无在途货物。</p>'}<p>本层尚需发运：${goods(t.needs)||'当前无待发运需求'}</p></article></div>
 <details><summary>采购与生产安排</summary><p>工地供货不会直接买材料。可先自行生产或采购；如果已开启家业自动补货，它也会购买商城可售的本层物资，非卖品仍需制造，并计入现场、运输和市场订单。施工口粮须由家庭余粮供应，供粮协议仍沿用家庭目标。自动销售会保留已安排给工地的物资。</p><button data-page="作坊">管理作坊</button><button data-page="制造">查看制造</button><button data-page="家业">管理家业</button><button data-page="商城">采购物资</button></details>
 </div></section>`:`<section class="panel"><div class="panel-body"><h2>${g.economy!.modern?'现代工业区验收通过':'两河贯通 · 试炼通关'}</h2><p>五层建设已完成，家族留下了一项真实投入、跨季施工的宏大工程。</p></div></section>`}
 <section class="panel"><div class="panel-head"><h2>施工记录</h2></div><div class="panel-body"><ul>${observation.recentEvents.filter(e=>e.type==='tower').map(e=>`<li>${esc(e.type==='tower'?e.detail:'')}</li>`).join('')||'<li>开工后将在这里显示发运、到货、施工与通层记录。</li>'}</ul></div></section>`;
}
