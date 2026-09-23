import {productArt,artUrl,illustration} from './illustration.js';
import type {SessionObservation} from '../../src/runtime/session.js';
import {SYSTEMS} from '../../src/game/model/industry.js';
import {productName} from '../../src/game/systems/industry-products.js';
import {branchRequirements} from './branch-view.js';
import {esc,inputsText,needsText} from './economy-view.js';
import {treeGraph,type TreeNodeSpec} from './tree-view.js';
const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
const MANUFACTURE_LANES=[
 {id:'field',name:'水土照料',ids:['W01','U08','U09','compost']},
 {id:'harvest',name:'收获、育苗与储粮',ids:['S01','U04','U10','pickles']},
 {id:'food',name:'粮食与油料加工',ids:['U06','mill','oil','hull']},
 {id:'fiber',name:'纤维与绳索加工',ids:['fiber','rope','retting']},
 {id:'parts',name:'工具、部件与动力',ids:['T01','T03','U01','S02','seal','shaft','valve','W03','P01','P03']},
 {id:'power',name:'电气设备与材料',ids:['wire','coil','cable','F07','fuel','battery','E01','E02','E04','LAMP','TELEGRAPH','ELECTROLYZER','aluminium','aluminiumwire']},
];
const manufactureStages=[
 {name:'农场',era:'农耕村落',title:'为田地做工具，把收成留住',flow:'木材与黏土 → 农用设施 → 水土养护、育苗与储粮',description:'先满足自己的田地需要。设施制造、跨季堆肥和材料条件都通过实际行动结算。'},
 {name:'工坊',era:'市镇百工',title:'把农产品加工成更有用的东西',flow:'谷物、油料与亚麻 → 工具与工序 → 面粉、油、纤维与绳索',description:'农产加工是主线，部件和动力是工具支线；不用先把整棵制造树做完。'},
 {name:'贸易',era:'电力工业',title:'制造是行业选择，购入设备也能经营',flow:'购入设备 → 检验与使用，或学习专业工艺 → 自行制造',description:'这里展示电气设备制造专业支线。外购设备不赠送制造规程，检验条件以实际报价为准。'},
 {name:'资本',era:'现代社会',title:'既有产业继续生产',flow:'农场、工坊与工业制造持续可用',description:'金融玩法尚在筹备，不额外编造金融制造物品。可切换之前的阶段继续制作。'},
];
export function manufacturePage(g:SessionObservation['game'],button:(id:string)=>string,selectedId='',selectedStage=-1,embedded=false):string{
 const e=g.economy!,x=e.industryView!,current=g.era?.index??0;
 const stage=selectedStage>=0&&selectedStage<4?selectedStage:current,theme=manufactureStages[stage];
 const catalog=x.catalog.filter(p=>p.unlockStage===stage);
 const actionId=(p:typeof x.catalog[number])=>'economy:'+(p.kind==='device'?'build:':'process:')+p.id;
 const offer=(p:typeof x.catalog[number])=>g.actions.find(a=>a.id===actionId(p));
 const selected=catalog.find(p=>p.id===selectedId)??catalog.find(p=>offer(p)?.enabled)??catalog[0];
 const laneOf=(id:string)=>MANUFACTURE_LANES.find(l=>l.ids.includes(id))?.id??'parts';
 const stock=(p:typeof x.catalog[number])=>p.kind==='device'?`耐用 ${e.equipment[p.id]??0}`:`库存 ${e.goods[p.good!]??0}`;
 const state=(p:typeof x.catalog[number])=>e.project?.good===p.id?'制作中':offer(p)?.enabled?(p.kind==='device'?'可制作':'可加工'):'条件不足';
 const chip=(id:string)=>`<button type="button" data-product="${id}" class="prerequisite ${x.products[id]?'met':''}">${x.products[id]?'✓':'○'} ${esc(productName(id))}${x.catalog.find(p=>p.id===id)?.unlockStage!==stage?' · '+manufactureStages[x.catalog.find(p=>p.id===id)?.unlockStage??0].name:''} →</button>`;
 const project=e.project?`<section class="manufacture-project"><div><strong>正在制作 · ${esc(productName(e.project.good))}</strong><p>材料已投入，跨季后完成；切换目录不影响项目。</p><button class="text-btn" type="button" data-product="${e.project.good}">查看项目 →</button></div>${button('economy:finish:project')}</section>`:'';
 const top=`${embedded?'':`<nav class="study-stage-nav" aria-label="按文明阶段选择制造">${manufactureStages.map((s,i)=>`<button type="button" data-manufacture-stage="${i}" aria-pressed="${i===stage}"><small>第 ${i+1} 阶段${i>current?' · 预览':i===current?' · 当前':''}</small><strong>${s.name}</strong><span>${s.era}</span></button>`).join('')}</nav>`}<header class="study-stage-overview"><span class="eyebrow">${theme.era} · ${stage>current?'尚未开放':stage<current?'可继续生产':'当前阶段'}</span><h3>${theme.title}</h3><p>${theme.flow}</p></header>${project}`;
 if(stage>current||!selected)return `${top}<section class="study-preview"><h3>${stage>current?'到达对应阶段后开放':'本阶段没有新增制造条目'}</h3><p>${theme.description}</p></section>`;
 const record=x.products[selected.id],spec=e.products.find(d=>d.id===selected.id),recipe=e.processes.find(d=>d.id===selected.id);
 const input=inputsText(spec?.inputs??recipe?.inputs??{})||'无';
 const result=recipe?inputsText(recipe.outputs):'1套'+productName(selected.id);
 const uses=x.catalog.filter(c=>c.parents.includes(selected.id));
 const stateClass=(p:typeof selected)=>offer(p)?.enabled?'ready':x.products[p.id]?.protocol?'known':'locked';
 const graphNodes:TreeNodeSpec[]=catalog.map(p=>({id:p.id,name:productName(p.id),image:artUrl(productArt(p.id)),lane:laneOf(p.id),parents:p.parents,selected:p.id===selected.id,stateClass:stateClass(p),stateText:state(p),sub:stock(p),dataAttr:'data-product'}));
 const detail=`<aside class="course-inspector manufacture-inspector" tabindex="-1">${illustration(productArt(selected.id))}<span class="eyebrow">${MANUFACTURE_LANES.find(l=>l.id===laneOf(selected.id))?.name}</span><h3>${esc(productName(selected.id))}</h3><p>${spec?esc(spec.effect):recipe?`加工得到${esc(inputsText(recipe.outputs))}。${recipe.wait?'开工扣料，跨季后完成领取。':'当次完成，产物进入库存。'}`:''}</p><div class="manufacture-recipe"><span class="detail-label">需要投入</span><strong>${esc(input)}</strong><span aria-hidden="true">↓</span><span class="detail-label">制作结果</span><strong>${esc(result)}</strong></div>${recipe?.equipment?`<p class="subtle">设备：${esc(productName(recipe.equipment))}，每批消耗耐用。</p>`:''}${recipe?.power?`<p>每批耗电 ${recipe.power}</p>`:''}<p class="detail-label">自行制作的条件</p>${record?.protocol?'<p>已有跨代制造规程，可沿用；材料、设备、劳动仍需满足。</p>':`<p>知识：${branchRequirements(selected.knowledge)}</p><div class="prerequisite-chain">${selected.parents.length?selected.parents.map(chip).join(''):'<span class="met">不需要前置产品验证</span>'}</div>`}<p>${stock(selected)} · ${record?.protocol?'已有制造规程':record?'外购实物已检验':'尚未验证'}</p><div class="inspector-action">${button(actionId(selected))}</div>${uses.length?`<details><summary>可用于哪些后续工艺</summary>${uses.map(p=>chip(p.id)).join('')}</details>`:''}<details><summary>购入实物与检验</summary><p>购买得到实物；检验只留下验证记录，自行制作才留下规程。已有验证不必重复检验。</p>${!record?button('economy:inspect:'+selected.id):'<p>✓ 已有验证记录</p>'}<button type="button" class="text-btn" data-page="${stage===0?'农业':'商城'}" ${stage===0?'data-destination="market"':''}>查看物资与设备买卖 →</button></details></aside>`;
 return `${top}<p class="manufacture-intro">${theme.description}</p><div class="page-workbench"><section class="manufacture-library"><div class="library-heading"><h3>本阶段可制作</h3><span>${catalog.length} 项 · ${catalog.filter(p=>offer(p)?.enabled).length} 项当前条件满足</span></div>${MANUFACTURE_LANES.map(l=>{const group=catalog.filter(p=>laneOf(p.id)===l.id);return group.length?`<section class="manufacture-group"><h4>${l.name}</h4><div class="manufacture-items">${group.map(p=>`<button type="button" class="manufacture-item ${selected.id===p.id?'selected':''}" data-product="${p.id}" aria-pressed="${selected.id===p.id}">${illustration(productArt(p.id),'manufacture-item-art')}<span><strong>${esc(productName(p.id))}</strong><small>${stock(p)}</small><em class="${offer(p)?.enabled?'ready':''}">${state(p)}</em></span></button>`).join('')}</div></section>`:'';}).join('')}<details class="manufacture-dependencies" ${catalog.some(p=>p.parents.length)?'':'hidden'}><summary>查看本阶段工艺依赖图</summary><p>这里只展示本阶段关系；所需的前期验证可在产品详情中跳转。</p><div class="tree-network" tabindex="0" role="region" aria-label="本阶段制造关系">${treeGraph(graphNodes,MANUFACTURE_LANES,{ariaLabel:'本阶段制造关系'})}</div></details></section>${detail}</div>`;
}

export function manufactureFallback(g:SessionObservation['game'],button:(id:string)=>string):string{
 const e=g.economy!;
 const items=[...new Set(e.products.map(p=>p.category))].map(category=>panel(category,e.products.filter(p=>p.category===category).map(p=>`<details><summary>${p.name} · ${e.equipment[p.id]??0}耐用</summary><p>${p.id==='U02'?'每季一次播种节省个人投入；仍扣种子和耐用度，雇工工资不减免':esc(p.effect)}</p><p>知识：${e.branchView?branchRequirements(e.branchView.products[p.id]):needsText(p.requires)}<br>投入：${esc(inputsText(p.inputs))}</p>${button('economy:build:'+p.id)}</details>`).join(''))).join('');
 const recipes=panel('加工配方',e.processes.map(p=>`<details><summary>${esc(p.name)} → ${esc(inputsText(p.outputs))}</summary><p>投入：${esc(inputsText(p.inputs)||'无')}；${p.wait?'跨季完成':'当次完成'}${p.equipment?'；设备：'+esc(e.products.find(x=>x.id===p.equipment)?.name??p.equipment):''}${p.power?`；单批用电 ${p.power}`:''}。</p>${button('economy:process:'+p.id)}</details>`).join('')||'<p>暂无配方。</p>');
 return items+recipes;
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
