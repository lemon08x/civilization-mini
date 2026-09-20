import type {SessionObservation} from '../../src/runtime/session.js';
import {esc} from './economy-view.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {foodPolicyControls} from './social-food-view.js';
export function arrangementsPage(g:SessionObservation['game'],button:(id:string)=>string):string{
 const e=g.economy!,o=e.operationsView;
 const panel=(title:string,note:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body"><p class="subtle">${note}</p>${body}</div></section>`;
 const a=(op:string,t:string)=>button('economy:'+op+':'+t);
 const resume=o?.paused?panel('接续经营安排','换代后经营安排会暂停；接续后恢复供粮、田地、生产、补货与维护配置。',`<div class="action-primary">${a('resumeplans','family')}</div>`):'';
 const food=g.socialFood?panel('吃饭','决定缺粮时怎样自动补粮：策略、每季预算、储备目标与配送方式；库存与缺口看补给页。',foodPolicyControls(g,button)):'';
 if(!o)return resume+food||'<p class="subtle">当前还没有可安排的长期计划。</p>';
 const farm=panel('田地','把播种、照料、收获和留种交给熟练农工，按季自动执行；随时可改回亲自经营。',`<p>当前：${o.farm?(o.farm==='rotation'?'小麦大豆轮作':CROPS[o.farm].name)+'托管':'亲自经营'}。</p><div class="action-grid">${['wheat','soy','flax','rotation','off'].map(t=>a('farmplan',t)).join('')}</div>`);
 const production=panel('生产与供货','让工匠按配方持续生产，并安排自动补货、自动交付与设备维护；工资、材料和设备仍真实消耗。',`<p>当前：${o.production?esc(o.recipes.find(p=>p.id===o.production!.recipe)?.name??'')+' · '+(o.production.mode==='sell'?'持续生产':'备货后待命')+(e.workers.artisan?.active?'':'（已暂停）'):'尚未建立生产计划'}。</p>${o.recipes.filter(p=>!p.equipment||e.equipment[p.equipment]!==undefined).map(p=>`<details><summary>${esc(p.name)}</summary>${a('productionplan',p.id+'-stock')}${a('productionplan',p.id+'-sell')}</details>`).join('')}<div class="compact-actions">${a('productionplan','off')}</div><p>补货${o.supplies?'开启':'暂停'} · 自动交付${o.sales?'开启':'暂停'} · 维护${o.maintenance?'开启':'暂停'}。</p><div class="action-grid">${a('supplyplan',o.supplies?'off':'on')}${a('salesplan',o.sales?'off':'on')}${a('careplan',o.maintenance?'off':'on')}</div>`);
 return resume+food+farm+production;
}
