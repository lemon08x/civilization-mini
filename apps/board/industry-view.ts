import type {SessionObservation} from '../../src/runtime/session.js';
import {INDUSTRY_PRODUCTS,SYSTEMS} from '../../src/game/model/industry.js';
import {productName} from '../../src/game/systems/industry-products.js';
import {branchRequirements} from './branch-view.js';
import {esc,inputsText} from './economy-view.js';
const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
export function industryProducts(g:SessionObservation['game'],button:(id:string)=>string):string{
 const e=g.economy!,x=e.industryView!;
 return panel('产品研发与验证','<p>解锁条件是前置知识与已验证产品。自行试制取得验证和制造规程；购买只获得实物，检验不赠送制造规程。验证记录不因实物消耗而失去。已有规程可跨代执行，新研发仍需个人知识。泵和发电机首次试制还需实际试运行。</p>')
 +INDUSTRY_PRODUCTS.map(p=>{const record=x.products[p.id],device=e.products.find(d=>d.id===p.id),recipe=e.processes.find(d=>d.id===p.id);return panel(productName(p.id),`<p>${record?(record.protocol?'已验证 · 有制造规程':'已检验外购实物 · 无制造规程'):'尚未验证'}；${p.kind==='device'?`实物耐用 ${e.equipment[p.id]??0}`:`实物库存 ${e.goods[p.good!]??0}`}</p><p>知识：${branchRequirements(p.knowledge)}<br>前置产品验证：${p.parents.map(productName).join(' + ')||'无'}<br>制造材料：${inputsText(device?.inputs??recipe?.inputs??{})}</p>${!record?button('economy:inspect:'+p.id):''}${button('economy:'+(p.kind==='device'?'build:':'process:')+p.id)}`);}).join('');
}
export function industrySystems(g:SessionObservation['game'],button:(id:string)=>string):string{
 const e=g.economy!,x=e.industryView!;
 return panel('系统与人员预算',`<p>先建设、实际调试，再安排本人或雇员持续运行。灌溉按需执行，轴加工每季一批；顺序为人工供水 → 机械供水 → 轴加工。缺料、缺水、缺工资或人力时待命，不部分扣费。</p><p>本人预留 ${x.reserved.time}时间 / ${x.reserved.energy}精力；当前未预留 ${Math.max(0,g.life!.timeRemaining-x.reserved.time)}时间 / ${Math.max(0,g.life!.person.energy-x.reserved.energy)}精力。取消安排可释放预留。</p><p>员工每${x.rules.wageTimeUnit}工作时间计1钱（单任务向上取整）；精力不足时可花${x.rules.workerRestTime}时间恢复${x.rules.workerRestRecovery}精力，休息不扣工作工资。流水线及无人系统尚未开放。</p>${Object.entries(x.workers).map(([id,b])=>`<p>${esc(e.staff.find(w=>w.kind===id)?.name??id)}：剩余${b.timeRemaining}时间 / ${b.energy}精力</p>`).join('')}`)
 +x.systems.map(def=>panel(def.name,`<p>${def.description}</p><p>知识：${branchRequirements(def.knowledge)}；产品验证：${def.products.map(productName).join(' + ')||'无'}；前置系统：${def.systems.map(id=>SYSTEMS.find(s=>s.id===id)!.name).join(' + ')||'无'}</p><p>${def.instance?`已安装 · ${def.instance.commissioned?'已调试':'待调试'} · 操作人员 ${def.instance.operator??'未安排'}`:'未建设'}；${esc(def.blockers.join('；'))}</p><p>任务工资 ${def.wage}钱（本人工资为0）；${def.equipment?'同一设备装入后不能同时手动加工。':'按需使用公共水。'}</p>${!def.instance?button('economy:sysbuild:'+def.id):`${!def.instance.commissioned?button('economy:syscommission:'+def.id):['self','laborer','farmer','artisan'].map(id=>button('economy:sysassign:'+def.id+'-'+id)).join('')}${button('economy:sysrun:'+def.id)}${button('economy:sysremove:'+def.id)}`}`)).join('')
 +panel('外部服务与招聘',`<p>长期供粮与付费维修由外部人员提供，不代表自有系统无人运行；原来的免费生产、补货、销售开关已由系统安排和手动交易替代。现阶段农工和普通雇工可承担供水，工匠可承担加工；田地播种收获由本人操作。</p>${button('economy:foodplan:'+(e.operations?.food?'off':'on'))}${g.actions.filter(a=>a.id.startsWith('economy:hire:')).map(a=>button(a.id)).join('')}`);
}
