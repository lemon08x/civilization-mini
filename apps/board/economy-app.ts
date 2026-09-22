import {farm,selectFarmPanel,type FarmPanel} from './farm-view.js';
import {bindFarmScene,playFarmFeedback,type FarmFeedback} from './farm-animation/controller.js';
import {socialFoodPage} from './social-food-view.js';
import { cultivationPage, actionButton, humanScreen, energyPage, confirmKind, confirmContent } from './human-view.js';
import type { Recap } from './human-view.js';
import {industrySystems,staffPage,manufacturePage,manufactureFallback} from './industry-view.js';
import {branchPage} from './branch-view.js';
import { expeditionPage } from './expedition-view.js';
import { towerPage } from './tower-view.js';
import { workshopPage } from './workshop-view.js';
import { operationsPage } from './operations-view.js';
import { arrangementsPage } from './arrangements-view.js';
import { marketPage } from './shop-view.js';
import {createSession,observeSession,parseSession,submitCommand} from '../../src/runtime/session.js';
import type {Session} from '../../src/runtime/records.js';
import {ALL_PRODUCTS as PRODUCTS,ALL_GOODS as GOODS,ALL_TOPICS as TOPICS,SUBJECT_NAMES,WORKER_NAMES,CROPS,ALL_PROCESSES as PROCESSES} from '../../src/game/systems/economy-catalog.js';
import type {GameEvent} from '../../src/game/model/events.js';
import { loadAssembledRules } from './rules.js';
import { loadSave, writeSave } from './saves.js';
const $=(id:string)=>document.getElementById(id)!;
const rules=await loadAssembledRules();
const requested=new URLSearchParams(location.search).get('save');
if(!requested){location.replace('/start');throw new Error('missing save');}
const saveId=requested;
const loaded=loadSave(saveId);
if(!loaded){location.replace('/start');throw new Error('missing save');}
let failed=false,busy=false,page='家人',guide=false,selectedCultivation='',selectedCourse='',selectedProduct='',selectedSystem='',selectedDevice='',filter='',shopCategory='物资';
let selectedTechStage=-1;
const manufactureScenes=['农业','工坊','贸易','资本'];
function openManufacture(stage:number):void {page=manufactureScenes[stage]??'农业';if(page==='农业')selectFarmPanel('manufacture');}
let recap:Recap|null=null,pendingAction='';
let feedbackTimer:ReturnType<typeof setTimeout>|undefined;
function sectFeedback(id:string,lines:string[]):void {
  if(!observeSession(session).game.sect||(!id.includes(':sect')&&!['handover','economy:retire:family'].includes(id)))return;
  const box=$('sect-feedback');
  clearTimeout(feedbackTimer);
  box.textContent=lines.at(-1)??'行动已结算，请查看当前状态。';
  box.hidden=false;box.classList.remove('is-visible');
  void box.offsetWidth;box.classList.add('is-visible');
  const target=document.querySelector(id.includes('sectswitch')?'.sect-lineage.is-active, .cultivation-toolbar':'.cultivation-inspector, .sect-workbench');
  target?.classList.add('sect-action-flash');
  feedbackTimer=setTimeout(()=>{box.hidden=true;},5000);
}
let session=await createSession({runId:saveId,ruleset:rules,seed:17,frameworkId:'riverine'});
const error=(message:string)=>{$('error').hidden=!message;$('error').textContent=message;if(message)$('error').focus();};
try{session=parseSession(loaded);if(session.record.manifest.ruleset.rulesVersion!==rules.rulesVersion)throw new Error('只接受当前规则；请另开新局');}catch(e){failed=true;error('当前存档无法读取，请新开局：'+(e as Error).message);}
function feedback(e:GameEvent):string {
  if(e.type==='era')return e.detail;
  if(e.type==='social-food')return e.detail;
  if(e.type==='industry')return e.detail;
  if(e.type==='branch')return e.detail;
  if(e.type==='life')return e.detail;
  if(e.type==='expedition')return e.detail;
  if(e.type==='tower')return e.detail;
  if(e.type==='operations')return e.detail;
  if(e.type==='shop')return e.detail+(e.money?'，支付'+e.money+'钱':'')+(e.amount>1?' × '+e.amount:'');
  if(e.type==='economy-goods'&&!Object.keys(e.changes).length)return '';
  if(e.type==='economy-goods')return e.source.replace('大运河施工装运','工程施工装运')+'：'+Object.entries(e.changes).map(([id,n])=>`${GOODS[id]?.name??id} ${n>0?'+':''}${n}`).join('、');
  if(e.type==='economy-learned')return `${e.source==='teach'?'后辈':'本人'}掌握${TOPICS.find(t=>t.subject===e.subject&&t.level===e.level)?.name}。`;
  if(e.type==='economy-evidence')return `取得${TOPICS.find(t=>t.id===e.topic)?.name}的证据：${e.source}`;
  if(e.type==='economy-worker')return `${WORKER_NAMES[e.worker as keyof typeof WORKER_NAMES]}：${e.detail}${e.money?'；支付'+e.money+'钱':''}`;
  if(e.type==='economy-built')return `${PRODUCTS.find(p=>p.id===e.product)?.name}已制造安装，耐用${e.durability}。`;
  if(e.type==='economy-equipment-used')return `${PRODUCTS.find(p=>p.id===e.product)?.name}生效，剩余${e.remaining}次。`;
  if(e.type==='economy-trade')return `${e.operation==='buy'?'购入':'交付'}${e.amount}${GOODS[e.good]?.name}，${e.money}钱。`;
  if(e.type==='economy-farm')return `${e.plotId?e.plotId+' · ':''}${e.actor}：${{sow:'播种',harvest:'收获',tend:'田间管理',pump:'自动灌溉',waiting:'持续耕作未能执行'}[e.operation]}${CROPS[e.crop as keyof typeof CROPS]?.name??e.crop}${e.operation==='harvest'?' '+e.amount:''}`;
  if(e.type==='economy-crop-growth')return `${CROPS[e.crop as keyof typeof CROPS].name}生长${e.growth}季，累计天气胁迫${e.stress}。`;
  if(e.type==='economy-process')return `${e.actor}${e.stage==='start'?'开工':'完成'}${PROCESSES.find(p=>p.id===e.recipe)?.name}。`;
  if(e.type==='economy-knowledge')return `${e.operation==='archive'?'留存家族记录':'传播地区知识'}：${SUBJECT_NAMES[e.subject as keyof typeof SUBJECT_NAMES]} ${e.level}阶。`;
  if(e.type==='economy-region')return `地区${e.industry==='iron'?'铁料':'纤维'}供应形成，采购价格下降。`;
  if(e.type==='food-purchased')return `买入${e.amount}粮${e.money?'，支付'+e.money+'钱':''}。`;
  if(e.type==='season-settled')return `季末消耗${e.consumed}粮，缺口${e.missing}。`;
  if(e.type==='food-spoiled')return `保存损耗${e.amount}粮，保护容量${e.protected}。`;
  if(e.type==='income')return `收入${e.amount}钱。`;
  if(e.type==='technology-victory')return `家族发展胜利：${e.mastered}/${e.total}项知识与实际成果均已达标。`;
  if(e.type==='handed-over')return '后辈接手，实物与雇员状态保留。';
  return '';
}
function recapFor(id:string,lines:string[]):Recap|null {
  const kind=confirmKind(id);
  if(!kind||!lines.length)return null;
  const title=kind==='season'?'本季已经写下':kind==='era'?'这一社会已经结算':kind==='handover'?'新的一章开始了':'交接已经安排';
  return {title,kind,lines};
}
function focusKey():string {
  const el=document.activeElement as HTMLElement|null;
  if(!el)return '';
  for(const attr of ['data-action','data-page','data-cultivation','data-course','data-course-stage','data-manufacture-stage','data-product','data-recipe','data-system','data-device','data-shop-category','data-guide','id'] as const){
    const value=el.getAttribute(attr); if(value)return attr+'='+value;
  }
  return '';
}
function restoreFocus(key:string):void {
  if(!key||(document.getElementById('confirm-dialog') as HTMLDialogElement|null)?.open)return;
  const eq=key.indexOf('='); if(eq<0)return;
  const attr=key.slice(0,eq),value=CSS.escape(key.slice(eq+1));
  document.querySelector<HTMLElement>(`[${attr}="${value}"]`)?.focus({preventScroll:true});
}
function openFolds():string[] {
  return Array.from(document.querySelectorAll<HTMLDetailsElement>('details[open]')).map(d=>d.dataset.fold??(d.querySelector('summary')?.textContent??'').trim().slice(0,80));
}
function restoreFolds(keys:string[]):void {
  document.querySelectorAll('details').forEach(d=>{
    const key=d.dataset.fold??(d.querySelector('summary')?.textContent??'').trim().slice(0,80);
    if(keys.includes(key))d.open=true;
  });
}
async function save(next:Session){writeSave(saveId,next);session=next;failed=false;error('');render();}
async function act(id:string){
  if(busy||failed)return;
  busy=true;
  $('app').setAttribute('aria-busy','true');
  try{
    const before=session.record.entries.length;
    const next=(await submitCommand(session,{commandId:session.record.manifest.runId+':'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:id})).session;
    const lines=(next.record.entries.at(-1)?.events.map(feedback).filter(Boolean)??[]) as string[];
    recap=next.record.entries.length>before?recapFor(id,lines):recap;
    if(id.startsWith('economy:sectswitch:')||id==='economy:sectpractice:dao'||id==='economy:sectimprove:dao')selectedCultivation='';
    await save(next);
    if(next.record.entries.length>before)sectFeedback(id,lines);
    if(page==='农业'&&next.record.entries.length>before){
      const events=next.record.entries.slice(before).flatMap(entry=>entry.events);
      playFarmFeedback(document,events.flatMap<FarmFeedback>(event=>event.type==='economy-farm'&&['sow','harvest','tend'].includes(event.operation)?[{kind:event.operation as 'sow'|'harvest'|'tend',label:feedback(event)}]:event.type==='life'&&event.operation==='farm-map'||event.type==='branch'&&id.startsWith('economy:neighbor:')?[{kind:id.startsWith('economy:farmreclaim:')?'reclaim' as const:id.startsWith('economy:farmexplore:')?'explore' as const:id.startsWith('economy:farmstory:')?'discovery' as const:'notice' as const,label:feedback(event)}]:[]));
    }
  }catch(e){error((e as Error).message);}
  finally{busy=false;$('app').removeAttribute('aria-busy');}
}
function bindApp():void {
$('export').onclick=()=>download('economy-run.json',{record:session.record,state:session.state});
$('import').onchange=async ev=>{const file=(ev.target as HTMLInputElement).files?.[0];if(!file||busy)return;busy=true;try{const value=JSON.parse(await file.text());const next=parseSession(value);if(next.record.manifest.ruleset.rulesVersion!==rules.rulesVersion)throw new Error('仅导入当前规则存档');const id=crypto.randomUUID();writeSave(id,next,`导入 · ${new Date().toLocaleString()}`);location.assign('/play?save='+encodeURIComponent(id));}catch(e){error((e as Error).message);busy=false;}};
  bindFarmScene(document,observeSession(session).game,render);
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page!;if(page==='学科'){selectedTechStage=-1;selectedCourse='';}if(page==='制造'){openManufacture(observeSession(session).game.era?.index??0);selectedProduct='';}if(b.dataset.destination)selectFarmPanel(b.dataset.destination as FarmPanel);guide=false;filter='';render();});
  const showSelection=()=>{
    render();
    if(matchMedia('(max-width: 900px)').matches){
      const detail=document.querySelector<HTMLElement>('.course-inspector');
      detail?.focus({preventScroll:true});
      detail?.scrollIntoView({block:'start'});
    }
  };
  document.querySelectorAll<HTMLButtonElement>('[data-cultivation]').forEach(b=>b.onclick=()=>{selectedCultivation=b.dataset.cultivation!;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-course-stage]').forEach(b=>b.onclick=()=>{selectedTechStage=Number(b.dataset.courseStage);selectedCourse='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(b=>{const go=()=>{selectedCourse=b.dataset.course!;selectedTechStage=observeSession(session).game.economy!.branchView?.nodes.find(n=>n.id===selectedCourse)?.unlockStage??-1;showSelection();};b.onclick=go;if(b.tagName!=='BUTTON')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  document.querySelectorAll<HTMLButtonElement>('[data-product]').forEach(b=>{const go=()=>{selectedProduct=b.dataset.product!;openManufacture(observeSession(session).game.economy!.industryView?.catalog.find(p=>p.id===selectedProduct)?.unlockStage??0);showSelection();};b.onclick=go;if(b.tagName!=='BUTTON')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  document.querySelectorAll<HTMLButtonElement>('[data-system]').forEach(b=>{const go=()=>{selectedSystem=b.dataset.system!;showSelection();};b.onclick=go;if(b.tagName!=='BUTTON')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  document.querySelectorAll<HTMLButtonElement>('[data-device]').forEach(b=>{const go=()=>{selectedDevice=b.dataset.device!;showSelection();};b.onclick=go;if(b.tagName!=='BUTTON')b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();go();}};});
  document.querySelectorAll<HTMLElement>('.course-inspector').forEach(detail=>{
    detail.tabIndex=-1;
    if(!document.querySelector('.lesson-tile.selected, .select-tile.selected, .tree-node.selected'))return;
    const back=document.createElement('button');
    back.type='button';back.className='text-btn detail-back';back.textContent='返回选择列表 ↓';
    back.onclick=()=>{
      const selected=document.querySelector<HTMLElement>('.lesson-tile.selected, .select-tile.selected, .tree-node.selected');
      for(let parent=selected?.parentElement;parent;parent=parent.parentElement){
        if(parent instanceof HTMLDetailsElement)parent.open=true;
      }
      selected?.focus({preventScroll:true});selected?.scrollIntoView({block:'center'});
    };
    detail.prepend(back);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-guide]').forEach(b=>b.onclick=()=>{page=b.dataset.guide!;guide=true;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-shop-category]').forEach(b=>b.onclick=()=>{shopCategory=b.dataset.shopCategory!;filter='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-dismiss-recap]').forEach(b=>b.onclick=()=>{recap=null;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.action!;
    if(b.dataset.confirm){openConfirm(id);return;}
    void act(id);
  });
  const filterGo=$('filter-go');
  if(filterGo)filterGo.onclick=()=>{filter=(document.getElementById('filter') as HTMLInputElement).value;render();};
}
function openConfirm(id:string):void {
  const o=observeSession(session).game;
  const content=confirmContent(o,id);
  pendingAction=id;
  $('confirm-title').textContent=content.title;
  $('confirm-body').innerHTML=content.body;
  const submit=$('confirm-submit') as HTMLButtonElement;
  submit.textContent=content.submitLabel;
  const dialog=$('confirm-dialog') as HTMLDialogElement;
  if(typeof dialog.showModal==='function')dialog.showModal();
  else dialog.setAttribute('open','');
  submit.focus();
}
function render():void {
  const key=focusKey(),folds=openFolds();
  const o=observeSession(session).game,e=o.economy!;
  if(page==='社会'){page='农业';guide=false;}
  if((o.era?.index??0)===0){const legacy:Record<string,FarmPanel>={仓库:'store',商城:'market',生活:'home',安排:'home'};if(legacy[page]){selectFarmPanel(legacy[page]);page='农业';}if(['系统','家业','能源','雇佣','作坊','副本','试炼'].includes(page))page='农业';}
  const button=(id:string)=>actionButton(o,id,failed);
  const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
  const acts=(group:string)=>o.actions.filter(a=>a.group===group&&!a.id.startsWith('economy:buyfood:')&&(!filter||a.label.includes(filter))).map(a=>`<div class="family-item">${button(a.id)}</div>`).join('');
  let body='';
  if(page==='修炼')body=cultivationPage(o,button,selectedCultivation);
  if(page==='副本')body=expeditionPage(observeSession(session),button);
  if(page==='试炼')body=towerPage(observeSession(session),button);
  if(page==='系统')body=e.industryView?industrySystems(o,button,selectedSystem):operationsPage(o,button)+(e.workshopView?'<section class="panel"><div class="panel-body"><h2>作坊协作</h2><p>建立纤维与绳索工序，配置跨季供货，观察库存与运输瓶颈。</p><button type="button" data-page="作坊">查看生产网络 →</button></div></section>':'');
  if(page==='家业')body=operationsPage(o,button)+(e.workshopView?'<section class="panel"><div class="panel-body"><h2>作坊协作</h2><p>建立纤维与绳索工序，配置跨季供货，观察库存与运输瓶颈。</p><button type="button" data-page="作坊">查看生产网络 →</button></div></section>':'');
  if(page==='作坊')body=workshopPage(o,button,observeSession(session).recentEvents);
  if(page==='学科')body=e.branchView?branchPage(o,button,selectedCourse,selectedTechStage):e.disciplines.map(d=>panel(d.name+` · 本人${d.level}阶 / 后辈${d.heirLevel}阶`, `<p>家族记录${d.notes}阶；下一阶可通过固定研究、生产证据或购买教材学习；家学书室可合并记录与教导。各学科内部暂按单主干顺序学习。</p><div class="flow">${d.topics.map(t=>`<span class="tag">${t.known?'✓ ':''}${t.level} ${t.name}</span>`).join(' → ')}</div>${d.topics.filter(t=>t.level===d.level+1).map(t=>button('economy:study:'+t.id)+(t.level>1?button('economy:research:'+t.id):'')).join('')}${button('economy:archive:'+d.subject)}${button('economy:teach:'+d.subject)}${button('economy:publish:'+d.subject)}`)).join('');
  const production=(stage:number)=>e.industryView?manufacturePage(o,button,selectedProduct,stage,true):manufactureFallback(o,button);
  if(page==='农业')body=farm(o,button,production(0));
  if(page==='工坊'&&(o.era?.index??0)>=1)body=production(1);
  if(page==='贸易'&&(o.era?.index??0)>=2)body=production(2);
  if(page==='雇佣')body=staffPage(o,button);
  if(page==='商城')body=marketPage(o,shopCategory,filter,button);
  if(page==='能源'&&e.modern)body=energyPage(o,button,selectedDevice);
  if(page==='生活')body=socialFoodPage(o)+panel('谋生与补给',acts('生活'));
  if(page==='安排')body=arrangementsPage(o,button);
  $('app').innerHTML=humanScreen(o,page,body,button,session.record.entries.at(-1)?.events.map(feedback).filter(Boolean)??[],guide,recap);
  // Retain the initial default selection when its available/learned group changes.
  const selection=document.querySelector<HTMLElement>('.lesson-tile.selected, .select-tile.selected')?.dataset;
  if(selection?.course)selectedCourse=selection.course;
  if(selection?.product)selectedProduct=selection.product;
  if(selection?.system)selectedSystem=selection.system;
  if(selection?.device)selectedDevice=selection.device;
  bindApp();
  restoreFolds(folds);
  restoreFocus(key);
}
const confirmForm=$('confirm-form') as HTMLFormElement;
const confirmDialog=$('confirm-dialog') as HTMLDialogElement;
confirmForm.addEventListener('submit',ev=>{
  const submitter=(ev as SubmitEvent).submitter as HTMLButtonElement|null;
  if(submitter?.value==='confirm'){
    ev.preventDefault();
    const id=pendingAction;
    pendingAction='';
    confirmDialog.close();
    if(id)void act(id);
  }else pendingAction='';
});
confirmDialog.addEventListener('click',ev=>{if(ev.target===confirmDialog)confirmDialog.close();});
confirmDialog.addEventListener('close',()=>{pendingAction='';});
function download(name:string,data:unknown){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
render();
