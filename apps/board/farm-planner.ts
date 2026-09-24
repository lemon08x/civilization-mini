import {storyPanel,landscapeBenefits} from './story-view.js';
import type {FarmGame} from './farm-view.js';
import {CROPS} from '../../src/game/systems/economy-catalog.js';
import {lunarDateAt,solarTermDay} from '../../src/game/systems/calendar.js';
import {esc} from './economy-view.js';

type Farm=NonNullable<NonNullable<FarmGame['economy']>['farm']>;
type Plot=Farm['plots'][number];
type Batch=Farm['schedule']['batches'][number];
let year:number|undefined,editing='',draft=new Set<string>(),baseline=new Set<string>(),confirmLeave=false,saving=false;
let notice='';
let selectedSeed='',seedNotice='',seedSaving=false;
const key=(b:Batch)=>`${b.year}-${b.id}`;
const same=(a:Set<string>,b:Set<string>)=>a.size===b.size&&[...a].every(id=>b.has(id));
const plansFor=(p:Plot,b:Batch)=>p.plans.find(v=>v.year===b.year&&v.batchId===b.id);
const growing=(p:Plot,b:Batch)=>!!p.field?.crop&&p.field.batch?.id===b.id&&p.field.batch.year===b.year;
const isSowing=(p:Plot)=>p.kind==='field'&&p.purpose==='sowing';
const selectedFor=(map:Farm,b:Batch)=>new Set(map.plots.filter(p=>!!plansFor(p,b)||growing(p,b)).map(p=>p.id));
const art=(crop:string)=>`<img src="/illustrations/farm/animation/painted/crops/farm-plant-${crop}-2-v2.webp" alt="" width="44" height="44">`;
const control=(label:string,attributes:string,cls='fp-btn')=>`<button type="button" class="${cls}" ${attributes}>${label}</button>`;
const amount=(n:number)=>Number(n.toFixed(2));
const quote=(p:Plot,kind:'sow'|'harvest')=>p.labor?.[kind]??{time:0,energy:0};
const cost=(plots:Plot[],kind:'sow'|'harvest')=>amount(plots.reduce((sum,p)=>sum+quote(p,kind).time,0));
const name=(b:Batch)=>CROPS[b.crop].name;

function dates(map:Farm,p:Plot,b:Batch){
 const existing=plansFor(p,b),actual=p.field?.batch;
 const mature=actual?.id===b.id&&actual.year===b.year?actual.matureDay:b.mature-(map.techniques.nursery?map.rules.nurseryDays:0);
 const yard=map.plots.some(q=>q.improvement==='yard'&&Math.abs(q.x-p.x)+Math.abs(q.y-p.y)===1);
 const bestEnd=mature+map.rules.harvestBestDays+(map.techniques.harvestTools?map.rules.harvestToolDays:0)+(yard?map.rules.yardGraceDays:0);
 return {sow:existing?.sowDay??b.start,mature,harvest:existing?.harvestDay??mature,bestEnd};
}
function unavailable(g:FarmGame,p:Plot,b:Batch):string{
 const map=g.economy!.farm!,own=plansFor(p,b),now=g.life!.calendar.absoluteDay;
 if(!isSowing(p))return p.kind==='field'?'其他用途':'尚未开垦';
 if(growing(p,b))return '已播种，不能移除';
 if(own)return own.harvested?'已收获':own.failed?'本批已结束':own.sown?'已播种，不能移除':'';
 if(!g.actions.some(a=>a.id===`economy:plotplan:${p.id}-add-${key(b)}`&&a.enabled))return '播种窗口已关闭';
 if(p.land?.paddy&&b.crop!=='rice')return '水田不适用';
 if(b.crop==='rice'&&!p.land?.paddy)return '需先改造水田';
 if(p.project&&p.project.done<p.project.total)return '工程进行中';
 const d=dates(map,p,b),start=Math.max(now,b.start);
 if(p.plans.some(v=>!v.failed&&!v.harvested&&v.sowDay<d.harvest&&start<v.harvestDay))return '与已有计划重叠';
 if(p.field?.crop&&(p.maturity?.mature??Infinity)>=start)return '现有作物尚未收获';
 return '';
}
function enter(g:FarmGame,b:Batch,plotId?:string){
 const map=g.economy!.farm!;year=b.year;editing=key(b);baseline=selectedFor(map,b);draft=new Set(baseline);confirmLeave=false;notice='';
 const plot=map.plots.find(p=>p.id===plotId);
 if(plot&&!draft.has(plot.id)&&!unavailable(g,plot,b))draft.add(plot.id);
}
export function openFarmPlanner(g:FarmGame,plotId?:string):void{
 const map=g.economy!.farm!;const p=map.plots.find(p=>p.id===plotId);
 const plan=p?.plans.find(v=>!v.harvested&&!v.failed)??(p?.field?.crop&&p.field.batch?{batchId:p.field.batch.id,year:p.field.batch.year}:undefined);
 const batch=plan?map.schedule.batches.find(b=>b.id===plan.batchId&&b.year===plan.year):map.schedule.batches.find(b=>b.end>g.life!.calendar.absoluteDay&&map.discovered.includes(b.crop)&&(!p||!unavailable(g,p,b)));
 if(batch)enter(g,batch,plotId);else{editing='';year=map.schedule.year;notice=p?.purpose==='other'?'此地为其他用途，先在田地页改为播种用途。':'先准备播种用途的田地，再安排农时。';}
}
export function farmPlannerHasDraft():boolean{return !!editing&&!same(draft,baseline);}

function ownedSeeds(g:FarmGame){
 const map=g.economy!.farm!;
 const owned=Object.entries(CROPS).filter(([,crop])=>(g.economy!.goods[crop.seed]??0)>0).map(([id,crop])=>({id,crop:id,name:crop.name+'种',stock:g.economy!.goods[crop.seed]??0}));
 if(map.rareSeeds>0)owned.push({id:'heritage',crop:'wheat',name:'异穗麦种',stock:map.rareSeeds});
 return owned;
}

/** Inventory is independent of the selected plot and never offers planning actions. */
export function farmSeedStore(g:FarmGame):string {
 return `<section class="farm-seed-inventory" aria-label="当前种子库存"><div class="farm-seed-stock">${ownedSeeds(g).map(s=>`<div class="farm-seed-choice">${art(s.crop)}<span>${esc(s.name)}</span><strong>× ${amount(s.stock)}</strong></div>`).join('')||'<p>种仓暂无种子。</p>'}</div></section>`;
}

/** The sowing picker belongs to plot actions, using the existing planning commands. */
export function farmSowingPicker(g:FarmGame,plotId:string):string {
 const map=g.economy!.farm!,p=map.plots.find(p=>p.id===plotId)!,now=g.life!.calendar.absoluteDay;
 const empty=isSowing(p)&&!p.field?.crop;
 const owned=ownedSeeds(g).filter(s=>s.stock>=1&&empty&&map.schedule.batches.some(b=>b.crop===s.crop&&b.end>now&&(!unavailable(g,p,b)||!!plansFor(p,b))));
 if(!owned.some(seed=>seed.id===selectedSeed))selectedSeed=owned[0]?.id??'';
 const seed=owned.find(seed=>seed.id===selectedSeed);
 const picker=owned.map(s=>`<button type="button" class="farm-seed-choice" data-farm-seed="${s.id}" aria-pressed="${s.id===selectedSeed}">${art(s.crop)}<span>${esc(s.name)}</span><strong>× ${amount(s.stock)}</strong></button>`).join('');
 const rows=seed?map.schedule.batches.filter(b=>b.crop===seed.crop&&b.end>now).sort((a,b)=>a.start-b.start).map(b=>{
  const existing=plansFor(p,b),id=`economy:plotplan:${p.id}-add-${key(b)}`,a=g.actions.find(a=>a.id===id);
  const reason=!empty?'先选择待播种的田地':existing?'本批已有计划':seed.stock<1?'种子不足1份':unavailable(g,p,b)||(!a?.enabled?a?.reason??'暂不可安排':'');
  const d=dates(map,p,b),sowDate=lunarDateAt(map.schedule.referenceYear,existing?.sowDay??Math.max(now,b.start)).date,harvestDate=lunarDateAt(map.schedule.referenceYear,d.harvest).date;
  return `<div class="farm-seed-batch"><div><strong>第${b.year-map.schedule.referenceYear+1}年 · ${esc(b.sowTerm)}播</strong><small>${esc(sowDate)} → ${esc(harvestDate)}</small></div><button type="button" data-farm-seedplan="${id}" ${reason||seedSaving?'disabled':''}>${existing?'已安排':seedSaving?'保存中…':'加入计划'}</button>${reason?`<small class="farm-seed-reason">${esc(reason)}</small>`:''}</div>`;
 }).join(''):'';
 const pending=seed?map.plots.reduce((count,plot)=>count+plot.plans.filter(plan=>!plan.sown&&!plan.failed&&!plan.harvested&&map.schedule.batches.some(b=>b.id===plan.batchId&&b.year===plan.year&&b.crop===seed.crop)).length,0):0;
 return `<section class="farm-seed-store" aria-label="选择播种作物"><button type="button" class="text-btn" data-farm-dock="actions">← 返回行动</button><div class="farm-seed-stock">${picker||`<p>${empty?'当前没有适合此地块的种子或农时批次。':'请先选择待播种的田地。'}</p>`}</div>${seed?`<div class="farm-seed-target"><strong>${p.id} · 待播种</strong><small>在库 ${amount(seed.stock)} · 同作物待播计划 ${pending} 块</small></div>${rows||'<p>当前没有可安排的农时批次。</p>'}<p class="farm-seed-note">只登记计划，不扣种子、不推进日期；到期需手动播种。${seed.id==='heritage'?'异穗麦共用小麦农时，播种时需选择「异穗麦」。':''}</p>`:''}${seedNotice?`<p class="farm-seed-notice" role="status">${esc(seedNotice)}</p>`:''}</section>`;
}

function taskList(g:FarmGame,button:(id:string)=>string,b?:Batch):string{
 const map=g.economy!.farm!,now=g.life!.calendar.absoluteDay;
 const tasks=map.schedule.tasks.filter(t=>!b||t.planId?.endsWith('-'+key(b))||!t.planId&&map.plots.some(p=>p.id===t.plotId&&growing(p,b)));
 const relevant=tasks.filter(t=>t.due||t.day<=now+7).slice(0,12);
 const actions=relevant.map(t=>{
  const p=map.plots.find(p=>p.id===t.plotId),f=p?.field;
  const actual=t.kind==='sow'?!f?.crop:t.kind==='harvest'?!!f?.crop&&f.growth>=f.duration:t.kind==='water'?!!f?.crop:!!f?.crop&&!t.gaps.some(gap=>/实际作物|尚未播种/.test(gap));
  const executable=t.due&&actual&&!t.gaps.some(gap=>/实际作物|尚未播种/.test(gap));
  return `<article class="fp-task"><div><strong>${esc(t.name)}</strong><small>${esc(t.date)} · ${t.time} 天 / 压力 +${t.energy} · 截止 ${esc(t.deadlineDate)}</small>${t.gaps.length?`<p>${esc(t.gaps.join('；'))}</p>`:''}</div>${executable?button(t.actionId):'<span class="fp-tag">等待农时</span>'}</article>`;
 }).join('');
 return `<section class="fp-box fp-tasks"><h3>近期待办 · 农活需亲自执行</h3>${actions||'<p class="fp-caption">未来 7 天没有这批待办；可以先备种、学习或照料已有作物。</p>'}</section>`;
}

export function farmPlanner(g:FarmGame,button:(id:string)=>string):string{
 const map=g.economy!.farm!,s=map.schedule,now=g.life!.calendar.absoluteDay;
 if(!s.batches.some(b=>b.year===year))year=s.year;
 const batch=s.batches.find(b=>key(b)===editing);
 if(editing&&!batch)editing='';
 if(batch&&same(draft,baseline)){baseline=selectedFor(map,batch);draft=new Set(baseline);}
 const visibleYears=[...new Set([s.year,s.year+1,...map.plots.flatMap(p=>[...p.plans.filter(v=>!v.failed&&!v.harvested).map(v=>v.year),...(p.field?.crop&&p.field.batch?[p.field.batch.year]:[])])])].sort();
 const yearControls=`<div class="fp-row">${visibleYears.map(y=>control('第 '+(y-s.referenceYear+1)+' 年',`data-fp-year="${y}" aria-pressed="${year===y}"`)).join('')}</div>`;
 const header=`<div class="fp-heading"><div>${batch?control('← 返回全年排期','data-fp-back','fp-textbtn'):'<div class="fp-eyebrow">农时安排 / 全年排期</div>'}<h1>${batch?'安排'+name(batch)+' · '+batch.sowTerm+'播':'一年的农忙，一眼看清'}</h1></div>${batch?`<span class="fp-tag">${farmPlannerHasDraft()?'有未保存的调整':'编辑安排'}</span>`:yearControls}</div>`;
 const message=`${notice?`<div class="fp-notice" role="status">${esc(notice)}</div>`:''}${confirmLeave?`<div class="fp-confirm"><span>这次分配尚未保存。</span><div class="fp-row">${control('继续编辑','data-fp-stay')}${control('放弃修改并返回','data-fp-discard')}</div></div>`:''}`;
 let body='';
 if(!batch){
  const rows=s.batches.filter(b=>b.year===year),start=solarTermDay(s.referenceYear,year!,'立春'),end=Math.max(solarTermDay(s.referenceYear,year!+1,'立春'),...rows.map(b=>b.mature+map.rules.harvestBestDays));
  const span=end-start;
  const markers=[year!,year!+1].flatMap(y=>['立春','清明','芒种','立秋','寒露','大雪'].map(term=>({day:solarTermDay(s.referenceYear,y,term),label:(y===year?'':'次年')+term}))).filter(m=>m.day>=start&&m.day<=end);
  const planted=map.plots.filter(p=>isSowing(p)&&p.field?.crop).length,planned=map.plots.filter(p=>isSowing(p)&&p.plans.some(v=>v.year===year&&!v.failed&&!v.harvested)).length;
  body=`<div class="fp-row fp-between"><p class="fp-muted">按农时统筹，点开批次分配田块。</p><div class="fp-row"><span class="fp-tag">${planned} 块已安排 · ${planted} 块在田</span>${control('＋ 安排作物批次',`data-fp-open="${key(rows.find(b=>b.end>now&&map.discovered.includes(b.crop))??rows[0])}"`,'fp-btn fp-primary')}</div></div><section class="fp-box fp-timeline"><div class="fp-row fp-between"><h2>全年排期</h2><small class="fp-muted">● 播种　 ━ 生长占地　 ◆ 成熟</small></div><div class="fp-timeline-head"><span>作物批次 / 分配田块</span><div class="fp-date-axis">${markers.map(m=>`<span style="left:${(m.day-start)/span*100}%" title="${esc(lunarDateAt(s.referenceYear,m.day).date)}">${m.label}</span>`).join('')}</div></div>${rows.map(b=>{
   const plots=map.plots.filter(p=>isSowing(p)&&(plansFor(p,b)||growing(p,b))),active=plots.filter(p=>{const plan=plansFor(p,b);return !plan?.harvested&&!plan?.failed;});
   const left=Math.max(0,(b.start-start)/span*100),width=(b.mature-b.start)/span*100;
   return `${storyPanel(g,'farming')}${landscapeBenefits(g,'garden')}<button type="button" class="fp-timeline-row ${active.length?'':'fp-unplanned'}" data-fp-open="${key(b)}"><span class="fp-crop-label">${art(b.crop)}<span><strong>${esc(name(b))} · ${b.sowTerm}播 ↗</strong><small>${plots.length?`${active.length} 块待完成 / 共 ${plots.length} 块`:'尚未安排 · 点击选田'}</small></span></span><span class="fp-lane"><span class="fp-span" style="--start:${left}%;--length:${width}%"><span>● ${b.sowTerm}</span>${width>=22?`<span>${active.length?'生长占地':'可安排'}</span>`:''}<span class="fp-end">◆ ${b.harvestTerm}</span></span></span></button>`;
  }).join('')}</section><div class="fp-bottom"><section class="fp-box ${s.labor.overflow?'fp-warning':''}"><h3>${s.labor.overflow?'已有农时冲突':'劳动与农时'}</h3><p>已安排劳动 ${s.labor.demand} 天 · 最少溢出 ${s.labor.overflow} 天</p>${s.labor.conflicts.length?`<p>需调整：${esc(s.labor.conflicts.join('、'))}</p>`:''}<p class="fp-caption">${esc(s.labor.description)}</p></section><section class="fp-box"><h3>播种用途 ${map.plots.filter(isSowing).length} 块</h3><p>其他用途地用于设施，不参与作物分配。</p>${control('去田地与探索 →','data-farm-panel="field"')}</section></div>${taskList(g,button)}`;
 }else{
  const fields=map.plots.filter(p=>p.kind==='field'),chosen=fields.filter(p=>draft.has(p.id));
  const pending=chosen.filter(p=>{const plan=plansFor(p,batch);return !plan?.harvested&&!plan?.failed;}),unsown=pending.filter(p=>!plansFor(p,batch)?.sown&&!growing(p,batch));
  const sow=cost(unsown,'sow'),harvest=cost(pending,'harvest');
  const currentYearBatches=s.batches.filter(b=>b.year===batch.year).sort((a,b)=>a.start-b.start);
  const ownPlans=new Set(map.plots.flatMap(p=>p.plans.filter(v=>v.batchId===batch.id&&v.year===batch.year).map(v=>v.id)));
  const other=s.tasks.filter(t=>t.kind!=='water'&&!ownPlans.has(t.planId??''));
  const start=Math.max(now,batch.start),mature=batch.mature-(map.techniques.nursery?map.rules.nurseryDays:0);
  const bestHarvestEnd=chosen.length?Math.min(...chosen.map(p=>dates(map,p,batch).bestEnd)):mature+map.rules.harvestBestDays;
  const sowOther=amount(other.filter(t=>t.day>=start&&t.day<batch.bestEnd).reduce((n,t)=>n+t.time,0));
  const harvestOther=amount(other.filter(t=>t.day>=mature&&t.day<bestHarvestEnd).reduce((n,t)=>n+t.time,0));
  const sowWindow=Math.max(0,batch.bestEnd-start),harvestWindow=bestHarvestEnd-mature;
  const warning=sow+sowOther>sowWindow||harvest+harvestOther>harvestWindow;
  const nodes:Record<string,string>={wheat:'A0',soy:'A4',flax:'A4',rice:'A12',millet:'A13',adzuki:'A14',mallow:'A15',mustard:'A15'};
  const knowledge=g.economy!.branchView?.nodes.find(n=>n.id===nodes[batch.crop]);
  const stock=g.economy!.goods[CROPS[batch.crop].seed]??0;
  body=`<div class="fp-terms">${[...new Set(currentYearBatches.map(b=>b.sowTerm))].map(term=>control(`<b>${term}</b><small>${currentYearBatches.filter(b=>b.sowTerm===term).map(name).join(' / ')}</small>`,`data-fp-open="${key(currentYearBatches.find(b=>b.sowTerm===term)!)}" aria-pressed="${term===batch.sowTerm}"`,'fp-term')).join('')}</div><div class="fp-workspace"><aside class="fp-box"><div class="fp-eyebrow">01　农时批次</div>${currentYearBatches.map(b=>control(`${art(b.crop)}<span><strong>${esc(name(b))}</strong><small>${b.sowTerm}播 · ${b.harvestTerm}收</small><small>${selectedFor(map,b).size} 块已安排</small></span>`,`data-fp-open="${key(b)}" aria-pressed="${key(b)===editing}"`,'fp-batch')).join('')}</aside><section class="fp-box"><div class="fp-eyebrow">02　分配播种田</div><div class="fp-row fp-between"><h2>已选 ${chosen.length} 块田</h2>${control('清空可调整选择','data-fp-clear','fp-textbtn')}</div><p class="fp-caption">正常播种至 ${esc(batch.bestEndDate)} · 基础成熟 ${esc(batch.matureDate)}</p><div class="fp-fieldgrid">${fields.map(p=>{
   const why=unavailable(g,p,batch),on=draft.has(p.id);
   return control(`<b>${p.id}</b>${on?'<span class="fp-check">✓</span>':''}<span class="fp-soil"></span><small>${esc(why|| (p.land?.paddy?'水田':quote(p,'sow').time<=.5?'窝棚覆盖':'普通旱田'))}</small>`,`data-fp-field="${p.id}" aria-pressed="${on}" ${why?'disabled':''} title="${esc(why||p.land?.soil+'土')}"`,'fp-field');
  }).join('')||'<p>尚无清理完成的田地，请先去田地与探索开垦。</p>'}</div><p class="fp-caption">✓ 已选 · 其他用途、占用或田型不符的地不可选</p><div class="fp-hint">先安排农时，再备种、学习与照料。登记计划不会自动播种。</div>${control('返回田地与探索 →','data-farm-panel="field"','fp-textbtn')}</section><aside class="fp-box"><div class="fp-eyebrow">03　检查劳动与准备</div><div class="fp-stats"><div class="fp-stat"><small>本批田块</small><b>${chosen.length}</b> 块</div><div class="fp-stat"><small>剩余播种</small><b>${sow}</b> 天</div></div><div class="fp-checkrow"><span>种子</span><span>${stock} / ${unsown.length} ${stock<unsown.length?'· 需补种':''}</span></div><div class="fp-checkrow"><span>栽培知识</span><span>${knowledge?.practiced?'已启用':knowledge?.known?'待点亮实践':'待学'+(knowledge?.name??'栽培知识')}</span></div><div class="fp-checkrow"><span>预计播种增压</span><span>${amount(unsown.reduce((n,p)=>n+quote(p,'sow').energy,0))}</span></div><div class="fp-rule"></div><h3>${warning?'农忙窗口较紧':'播种、收获时间充足'}</h3><div class="fp-checkrow"><span>${batch.sowTerm}正常播期</span><strong>${amount(sow+sowOther)} / ${sowWindow} 天</strong></div><progress max="${Math.max(1,sowWindow)}" value="${sow+sowOther}" aria-label="播种劳动"></progress><p class="fp-caption">本批 ${sow} 天，其他待办 ${sowOther} 天</p><div class="fp-checkrow"><span>${batch.harvestTerm}正常收期</span><strong>${amount(harvest+harvestOther)} / ${harvestWindow} 天</strong></div><progress max="${Math.max(1,harvestWindow)}" value="${harvest+harvestOther}" aria-label="收获劳动"></progress><p class="fp-caption">本批 ${harvest} 天，其他待办 ${harvestOther} 天</p><div class="fp-hint">${warning?'可减少田块或调整日期；晚播、晚收会减产。':'仍需留出休息、灌溉和临时事务时间。'}</div>${control(saving?'正在保存…':'保存安排，返回全年',`data-fp-save ${saving?'disabled':''}`,'fp-btn fp-primary fp-save')}<p class="fp-caption fp-center">按当前压力估算未完成农活；连续劳动增压后需重新评估，保存不推进日期</p></aside></div>${taskList(g,button,batch)}<details class="fp-box fp-plan-details"><summary>逐田日期与田间操作</summary>${chosen.map(p=>{
   const plan=plansFor(p,batch),f=p.field;
   const edits=g.actions.filter(a=>a.id.startsWith(`economy:plotplan:${p.id}-`)&&a.id.endsWith('-'+key(batch))&&!a.id.includes('-add-')&&!a.id.includes('-delete-'));
   const current=f?.crop&&f.batch?.id===batch.id&&f.batch.year===batch.year;
   return `<article class="fp-task"><div><h3>${p.id}</h3><p>${plan?`播种 ${esc(lunarDateAt(s.referenceYear,plan.sowDay).date)} · 收获 ${esc(lunarDateAt(s.referenceYear,plan.harvestDay).date)}`:'保存后可调整日期'}</p>${plan?.failed?`<p>${esc(plan.failureReason??'计划已结束')}</p>`:''}</div><div class="fp-task-actions">${edits.map(a=>button(a.id)).join('')}${current?button(`economy:farmplot:${p.id}-${f.crop}`)+button(`economy:farmfertilize:${p.id}`)+button(`economy:wait:${p.id}`)+button(`economy:neighbor:help-${p.id}`):!f?.crop&&plan&&!plan.failed&&!plan.harvested&&now>=batch.start&&now<batch.end?button(`economy:farmplot:${p.id}-${batch.crop}`)+(batch.crop==='wheat'?button(`economy:farmrare:${p.id}`):''):''}</div></article>`;
  }).join('')||'<p>先分配田块并保存。</p>'}</details>`;
 }
 return `<section id="farm-planner"><div class="fp-main">${message}${header}${body}<footer class="fp-footer"><span>计划与地块跨代保留，农活需手动执行</span><span>日期窗口不含截止日</span></footer></div></section>`;
}

export function bindFarmPlanner(root:Document,g:FarmGame,rerender:()=>void,commit:(ids:string[])=>Promise<boolean>):void{
 const map=g.economy?.farm;if(!map)return;
 root.querySelectorAll<HTMLButtonElement>('[data-farm-seed]').forEach(b=>b.onclick=()=>{if(seedSaving)return;selectedSeed=b.dataset.farmSeed!;seedNotice='';rerender();});
 root.querySelectorAll<HTMLButtonElement>('[data-farm-seedplan]').forEach(b=>b.onclick=()=>{void(async()=>{
  if(seedSaving||b.disabled)return;
  const id=b.dataset.farmSeedplan!;
  if(!g.actions.some(a=>a.id===id&&a.enabled))return;
  seedSaving=true;seedNotice='';rerender();
  try{seedNotice=await commit([id])?'已加入农时安排。':'保存未完成，请查看错误提示。';}
  finally{seedSaving=false;rerender();}
 })();});
 const bind=(selector:string,fn:(b:HTMLButtonElement)=>void)=>root.querySelectorAll<HTMLButtonElement>(selector).forEach(b=>b.onclick=()=>{if(!saving)fn(b);});
 const rejectDraft=()=>{if(farmPlannerHasDraft()){confirmLeave=true;rerender();return true;}return false;};
 bind('[data-fp-open]',el=>{if(rejectDraft())return;const b=map.schedule.batches.find(b=>key(b)===el.dataset.fpOpen);if(b){enter(g,b);rerender();}});
 bind('[data-fp-year]',el=>{if(rejectDraft())return;year=Number(el.dataset.fpYear);editing='';rerender();});
 bind('[data-fp-field]',el=>{const id=el.dataset.fpField!;draft.has(id)?draft.delete(id):draft.add(id);notice='';rerender();root.querySelector<HTMLButtonElement>(`[data-fp-field="${id}"]`)?.focus({preventScroll:true});});
 bind('[data-fp-clear]',()=>{const b=map.schedule.batches.find(b=>key(b)===editing)!;draft=new Set([...draft].filter(id=>!!unavailable(g,map.plots.find(p=>p.id===id)!,b)));rerender();});
 bind('[data-fp-back]',()=>{if(!rejectDraft()){editing='';rerender();}});
 bind('[data-fp-stay]',()=>{confirmLeave=false;rerender();});
 bind('[data-fp-discard]',()=>{editing='';draft=new Set();baseline=new Set();confirmLeave=false;rerender();});
 bind('[data-fp-save]',()=>{void(async()=>{
  const b=map.schedule.batches.find(b=>key(b)===editing);if(!b)return;
  const ids=[...[...baseline].filter(id=>!draft.has(id)).map(id=>`economy:plotplan:${id}-delete-${key(b)}`),...[...draft].filter(id=>!baseline.has(id)).map(id=>`economy:plotplan:${id}-add-${key(b)}`)];
  saving=true;rerender();
  try{if(await commit(ids)){baseline=new Set(draft);editing='';confirmLeave=false;notice='安排已保存，全年排期和农事待办已更新。';}}finally{saving=false;rerender();}
 })();});
}
