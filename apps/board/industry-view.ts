import type {SessionObservation} from '../../src/runtime/session.js';
import {SYSTEMS} from '../../src/game/model/industry.js';
import {productName} from '../../src/game/systems/industry-products.js';
import {branchRequirements} from './branch-view.js';
import {esc,inputsText} from './economy-view.js';
const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;

export function industryProducts(g:SessionObservation['game'],button:(id:string)=>string,selectedId=''):string{
 const e=g.economy!,x=e.industryView!;
 const selected=x.catalog.find(p=>p.id===selectedId)??x.catalog[0];
 const tile=x.catalog.map(p=>{
  const record=x.products[p.id];
  const stock=p.kind==='device'?`耐用 ${e.equipment[p.id]??0}`:`库存 ${e.goods[p.good!]??0}`;
  return `<button type="button" class="select-tile ${selected?.id===p.id?'selected':''}" data-product="${p.id}" aria-pressed="${selected?.id===p.id}"><strong>${esc(productName(p.id))}</strong><small>实物 ${stock} · 验证 ${record?'已有':'无'} · 规程 ${record?.protocol?'已有':'无'}</small></button>`;
 }).join('');
 const detail=(()=>{
  if(!selected)return '<p>暂无产品条目。</p>';
  const record=x.products[selected.id],device=e.products.find(d=>d.id===selected.id),recipe=e.processes.find(d=>d.id===selected.id);
  const stock=selected.kind==='device'?`实物耐用 ${e.equipment[selected.id]??0}`:`实物库存 ${e.goods[selected.good!]??0}`;
  return `<h3>${esc(productName(selected.id))}</h3>
    <div class="production-stages"><span class="${record?'done':''}">${record?'✓':'○'} 产品验证</span><span aria-hidden="true">→</span><span class="${record?.protocol?'done':''}">${record?.protocol?'✓':'○'} 制造规程</span></div>
    <p>${stock}</p>
    <p>${record?(record.protocol?'已验证，并有制造规程。':'已检验外购实物，没有制造规程。购买实物不赠送规程。'):'尚未验证。检验也不能自动获得规程。'}</p>
    <p>${esc(device?.effect??'')}</p>
    <p>知识：${branchRequirements(selected.knowledge)}<br>前置产品验证：${selected.parents.map(productName).join(' + ')||'无'}<br>制造材料：${inputsText(device?.inputs??recipe?.inputs??{})}</p>
    <p><button type="button" class="text-btn" data-page="商城">去集市补缺</button><button type="button" class="text-btn" data-page="学科">去学堂</button></p>
    <div class="inspector-action">${!record?button('economy:inspect:'+selected.id):''}${button('economy:'+(selected.kind==='device'?'build:':'process:')+selected.id)}</div>`;
 })();
 return `<details><summary>如何获得实物、验证与规程</summary><p>解锁条件是前置知识与已验证产品。自行试制取得验证和制造规程；购买只获得实物，检验不赠送制造规程。验证记录不因实物消耗而失去。已有规程可跨代执行，新研发仍需个人知识。泵和发电机首次试制还需实际试运行。产品关系图不是必须依次造过全部产品。</p></details>
  <div class="page-workbench"><section><div class="library-heading"><h3>产品目录</h3><span>${x.catalog.length} 项</span></div><div class="lesson-grid">${tile||'<p>暂无产品。</p>'}</div></section><aside class="course-inspector">${detail}</aside></div>`;
}

export function industryProcesses(g:SessionObservation['game'],button:(id:string)=>string,selectedId=''):string{
 const e=g.economy!,processes=e.processes;
 const selected=processes.find(p=>p.id===selectedId)??processes[0];
 const tile=processes.map(p=>`<button type="button" class="select-tile ${selected?.id===p.id?'selected':''}" data-recipe="${p.id}" aria-pressed="${selected?.id===p.id}"><strong>${esc(p.name)}</strong><small>${p.wait?'跨季完成':'当次完成'}${p.equipment?` · ${e.products.find(x=>x.id===p.equipment)?.name??p.equipment}`:''}</small></button>`).join('');
 const detail=selected?`<h3>${esc(selected.name)}</h3>
   <div class="recipe-flow"><span>投入 ${esc(inputsText(selected.inputs)||'无')}</span><span aria-hidden="true">→</span><span>工序 ${selected.wait?'跨季等待':'当次完成'}${selected.power?` · 单批用电 ${selected.power}`:''}</span><span aria-hidden="true">→</span><span>产出 ${esc(inputsText(selected.outputs)||'无')}</span></div>
   <p>${e.branchView?`知识与规程：${branchRequirements(e.branchView.processes[selected.id])}`:''}${selected.equipment?` · 设备 ${e.products.find(x=>x.id===selected.equipment)?.name??selected.equipment}，本人和雇工共用，不能重复占用。`:''}</p>
   <p>本人项目：${e.project?e.processes.find(p=>p.id===e.project?.good)?.name??e.project.good:'暂无'}。跨季项目需等待并完成才能拿到产品。</p>
   <div class="inspector-action">${button('economy:process:'+selected.id)}${button('economy:finish:project')}</div>`:'<p>暂无配方。</p>';
 return `${e.operations?.production?'<p>已有持续生产计划；日常进度见「家业」。下面的手动加工与雇员共用材料和设备。</p>':''}
  <div class="page-workbench"><section><div class="library-heading"><h3>配方</h3><span>${processes.length} 项</span></div><div class="lesson-grid">${tile||'<p>暂无配方。</p>'}</div></section><aside class="course-inspector">${detail}</aside></div>`;
}

export function industrySystems(g:SessionObservation['game'],button:(id:string)=>string,selectedId=''):string{
 const e=g.economy!,x=e.industryView!;
 const selected=x.systems.find(s=>s.id===selectedId)??x.systems[0];
 const tile=x.systems.map(def=>`<button type="button" class="select-tile ${selected?.id===def.id?'selected':''}" data-system="${def.id}" aria-pressed="${selected?.id===def.id}"><strong>${esc(def.name)}</strong><small>${def.instance?`${def.instance.commissioned?'已调试':'待调试'} · ${def.instance.operator??'未安排人员'}`:'未建设'} · ${esc(def.blockers[0]??'可安排')}</small></button>`).join('');
 const detail=selected?`<h3>${esc(selected.name)}</h3>
   <div class="production-stages"><span class="${selected.instance?'done':''}">${selected.instance?'✓':'○'} 建设</span><span>→</span><span class="${selected.instance?.commissioned?'done':''}">${selected.instance?.commissioned?'✓':'○'} 调试</span><span>→</span><span class="${selected.instance?.operator?'done':''}">${selected.instance?.operator?'✓':'○'} 安排人员</span></div>
   <p>${esc(selected.description)}</p>
   <p>知识：${branchRequirements(selected.knowledge)}；产品验证：${selected.products.map(productName).join(' + ')||'无'}；前置系统：${selected.systems.map(id=>SYSTEMS.find(s=>s.id===id)?.name??id).join(' + ')||'无'}</p>
   <p>${selected.instance?`已安装 · ${selected.instance.commissioned?'已调试':'待调试'} · 操作人员 ${selected.instance.operator??'未安排'}`:'未建设'}。${esc(selected.blockers.join('；')||'当前没有额外阻碍。')}</p>
   <p>任务工资 ${selected.wage}钱（本人工资为0）；${selected.equipment?'同一设备装入后不能同时手动加工。':'按需使用公共水。'}缺料时不会显示为正在生产。</p>
   <div class="inspector-action">${!selected.instance?button('economy:sysbuild:'+selected.id):`${!selected.instance.commissioned?button('economy:syscommission:'+selected.id):['self','laborer','farmer','artisan'].map(id=>button('economy:sysassign:'+selected.id+'-'+id)).join('')}${button('economy:sysrun:'+selected.id)}${button('economy:sysremove:'+selected.id)}`}</div>`:'<p>暂无系统。</p>';
 return `<details><summary>运行顺序、人员预算与工资</summary><p>先建设、实际调试，再安排本人或雇员持续运行。灌溉按需执行，轴加工每季一批；顺序为人工供水 → 机械供水 → 轴加工。缺料、缺水、缺工资或人力时待命，不部分扣费。</p><p>本人预留 ${x.reserved.time}时间 / ${x.reserved.energy}精力；当前未预留 ${Math.max(0,g.life!.timeRemaining-x.reserved.time)}时间 / ${Math.max(0,g.life!.person.energy-x.reserved.energy)}精力。取消安排可释放预留。</p><p>员工每${x.rules.wageTimeUnit}工作时间计1钱（单任务向上取整）；精力不足时可花${x.rules.workerRestTime}时间恢复${x.rules.workerRestRecovery}精力，休息不扣工作工资。流水线及无人系统尚未开放。当前仍需本人播种、收获、采购和交付。</p>${Object.entries(x.workers).map(([id,b])=>`<p>${esc(e.staff.find(w=>w.kind===id)?.name??id)}：剩余${b.timeRemaining}时间 / ${b.energy}精力</p>`).join('')}</details>
  <div class="page-workbench"><section><div class="library-heading"><h3>系统</h3><span>${x.systems.length} 项</span></div><div class="lesson-grid">${tile||'<p>暂无系统。</p>'}</div></section><aside class="course-inspector">${detail}</aside></div>
  ${panel('外部服务与招聘',`<p>生活页设置购粮策略与预算；食品配送与付费维修由外部人员提供，不代表自有系统无人运行。</p>${button('economy:foodplan:'+((g.socialFood?.delivery??e.operations?.food)?'off':'on'))}${g.actions.filter(a=>a.id.startsWith('economy:hire:')).map(a=>button(a.id)).join('')}`)}`;
}

export function staffPage(g:SessionObservation['game'],button:(id:string)=>string):string{
 const e=g.economy!;
 if(e.industryView)return industrySystems(g,button);
 return panel('人员与生产关系',`<p>普通雇工先做照料和收获；熟练农工能播种；熟练工匠会专业配方。招募后安排任务，每季至多一项工作。缺工资、缺料、设备占用或无事可做时待命不收费。当前仍需本人播种、收获、采购和交付。</p>${e.staff.map(w=>`<article class="family-item"><h3>${esc(w.name)} · 经验${w.experience}</h3><p>${w.job==='rest'?'尚未安排任务':(w.active?'执行':'暂停')+w.jobName} · 每工作季${w.wage}钱；${w.project?'在制：'+w.project.good:'无在制品'}<br>${esc(w.blockers.join('；')||'当前具备工作条件')}</p>${button('economy:pause:'+w.kind)}${button('economy:train:'+w.kind)}${g.actions.filter(a=>a.id.startsWith('economy:assign:'+w.kind+'-')).map(a=>button(a.id)).join('')}</article>`).join('')}<details><summary>招募新岗位</summary>${g.actions.filter(a=>a.id.startsWith('economy:hire:')).map(a=>button(a.id)).join('')}</details>`);
}
