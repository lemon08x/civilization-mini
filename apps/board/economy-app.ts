import {erasPage} from './eras-view.js';
import {socialFoodPage} from './social-food-view.js';
import { actionButton, farm, humanScreen } from './human-view.js';
import {industryProducts,industrySystems} from './industry-view.js';
import {branchPage,branchRequirements} from './branch-view.js';
import { expeditionPage } from './expedition-view.js';
import { towerPage } from './tower-view.js';
import { workshopPage } from './workshop-view.js';
import { operationsPage } from './operations-view.js';
import { marketPage } from './shop-view.js';
import {createSession,observeSession,parseSession,submitCommand} from '../../src/runtime/session.js';
import type {Session} from '../../src/runtime/records.js';
import {ALL_PRODUCTS as PRODUCTS,ALL_GOODS as GOODS,ALL_TOPICS as TOPICS,SUBJECT_NAMES,WORKER_NAMES,CROPS,ALL_PROCESSES as PROCESSES} from '../../src/game/systems/economy-catalog.js';
import {esc,needsText,inputsText} from './economy-view.js';
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
let failed=false,busy=false,page='聚落',guide=false,selectedCourse='',filter='',shopCategory='物资';
let session=await createSession({runId:saveId,ruleset:rules,seed:17,scenarioId:'river'});
const error=(message:string)=>{$('error').hidden=!message;$('error').textContent=message;};
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
  if(e.type==='economy-farm')return `${e.actor}：${{sow:'播种',harvest:'收获',tend:'田间管理',pump:'自动灌溉',waiting:'持续耕作未能执行'}[e.operation]}${CROPS[e.crop as keyof typeof CROPS]?.name??e.crop}${e.operation==='harvest'?' '+e.amount:''}`;
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
async function save(next:Session){writeSave(saveId,next);session=next;failed=false;error('');render();}
async function act(id:string){if(busy||failed)return;busy=true;try{await save((await submitCommand(session,{commandId:session.record.manifest.runId+':'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:id})).session);}catch(e){error((e as Error).message);}finally{busy=false;}}
function render(){
  const o=observeSession(session).game,e=o.economy!,PRODUCTS=e.products,PROCESSES=e.processes;
  $('rule-notice').textContent=`规则 ${o.rulesVersion} · 学科 / 产品 / 系统 · ${e.branchView?.nodes.length??19}个学科节点，${PRODUCTS.length}项设备 · 数值待验证`;
  const button=(id:string)=>actionButton(o,id,failed);
  const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
  const acts=(group:string)=>o.actions.filter(a=>a.group===group&&(!filter||a.label.includes(filter))).map(a=>`<div class="family-item">${button(a.id)}</div>`).join('');
  let body='';
  if(page==='社会')body=erasPage(observeSession(session),button);
  if(page==='副本')body=expeditionPage(observeSession(session),button);
  if(page==='试炼')body=towerPage(observeSession(session),button);
  if(page==='系统'||page==='家业')body=e.industryView?industrySystems(o,button):operationsPage(o,button)+(e.workshopView?'<section class="panel"><div class="panel-body"><h2>作坊协作</h2><p>建立纤维与绳索工序，配置跨季供货，观察库存与运输瓶颈。</p><button data-page="作坊">查看生产网络 →</button></div></section>':'');
  if(page==='作坊')body=workshopPage(o,button,observeSession(session).recentEvents);
  if(page==='学科')body=e.branchView?branchPage(o,button,selectedCourse):e.disciplines.map(d=>panel(d.name+` · 本人${d.level}阶 / 后辈${d.heirLevel}阶`, `<p>家族记录${d.notes}阶；下一阶可通过固定研究、生产证据或购买教材学习；家学书室可合并记录与教导。各学科内部暂按单主干顺序学习。</p><div class="flow">${d.topics.map(t=>`<span class="tag">${t.known?'✓ ':''}${t.level} ${t.name}</span>`).join(' → ')}</div>${d.topics.filter(t=>t.level===d.level+1).map(t=>button('economy:study:'+t.id)+(t.level>1?button('economy:research:'+t.id):'')).join('')}${button('economy:archive:'+d.subject)}${button('economy:teach:'+d.subject)}${button('economy:publish:'+d.subject)}`)).join('');
  if(page==='产品')body=e.industryView?industryProducts(o,button):[...new Set(PRODUCTS.map(p=>p.category))].map(category=>panel(category,PRODUCTS.filter(p=>p.category===category).map(p=>`<details><summary>${p.name} · ${e.equipment[p.id]??0}耐用</summary><p>${p.id==='U02'?'每季一次播种节省个人投入；仍扣种子和耐用度，雇工工资不减免':p.effect}</p><p>知识：${e.branchView?branchRequirements(e.branchView.products[p.id]):needsText(p.requires)}<br>投入：${inputsText(p.inputs)}</p>${button('economy:build:'+p.id)}</details>`).join(''))).join('');
  if(page==='农业')body=farm(o,button);
  if(page==='生产')body=(e.operations?.production?'<p>已有持续生产计划；日常进度见「家业」。下面的手动加工与雇员共用材料和设备。</p>':'')+panel('加工与在制品',`<p>${e.project?'本人项目：'+PROCESSES.find(p=>p.id===e.project?.good)?.name:'暂无本人项目'}。工序需设备时，个人和雇工争用同一设备位置。</p>${PROCESSES.map(p=>`<details><summary>${p.name} → ${inputsText(p.outputs)}</summary><p>投入${inputsText(p.inputs)}；${e.branchView?branchRequirements(e.branchView.processes[p.id]):needsText(p.requires)}；${p.wait?'跨季':'当次完成'}${p.power?'；单批用电'+p.power+'（双份加工用双份电）':''}${p.equipment?'；设备'+PRODUCTS.find(x=>x.id===p.equipment)?.name:''}</p>${button('economy:process:'+p.id)}</details>`).join('')}${button('economy:finish:project')}`);
  if(page==='雇佣')body=e.industryView?industrySystems(o,button):panel('人员与生产关系',`<p>普通雇工先做照料和收获；熟练农工能播种；熟练工匠会专业配方。招募后安排任务，每季至多一项工作。缺工资、缺料、设备占用或无事可做时待命不收费。</p>${e.staff.map(w=>`<article class="family-item"><h3>${w.name} · 经验${w.experience}</h3><p>${w.job==='rest'?'尚未安排任务':(w.active?'执行':'暂停')+w.jobName} · 每工作季${w.wage}钱；${w.project?'在制：'+w.project.good:'无在制品'}<br>${esc(w.blockers.join('；')||'当前具备工作条件')}</p>${button('economy:pause:'+w.kind)}${button('economy:train:'+w.kind)}${o.actions.filter(a=>a.id.startsWith('economy:assign:'+w.kind+'-')).map(a=>button(a.id)).join('')}</article>`).join('')}<details><summary>招募新岗位</summary>${o.actions.filter(a=>a.id.startsWith('economy:hire:')).map(a=>button(a.id)).join('')}</details>`);
  if(page==='商城')body=marketPage(o,shopCategory,filter,button);
  if(page==='能源'&&e.modern){const m=e.modern;body=panel('供能与设备服务',`<p>可用电力 <strong>${m.power}</strong>；${e.electricView?`跨季储能 ${m.stored}/6；水电本季产能 ${e.electricView.hydroOutput} 电。`:e.branchView?'本季电力跨季清空；基础配电支持磨粮用电。':`跨季储能 ${m.stored}/6。未入储能柜的电力跨季清空。`}</p><p>${e.electricView?e.electricView.description+` 本季现代结算回报比例 ${e.electricView.rewardPercent}%。照明增加 ${e.electricView.rules.lampTime} 时间，电报使新订货即时交付；每项服务耗 ${e.electricView.rules.servicePower} 电。`:e.branchView?'新版发电由本人执行本季供能，季末不免费发电。当前只有水力发电，供能系统后续接入。':'季末：补货与维护 → 发电与储能放电 → 设备服务 → 雇员加工 → 余电入库。'}启停不产电；本人需要提前用电时执行本季供能。</p>${button('economy:energize:now')}${PRODUCTS.filter(p=>['E01','E02','E03','E04','N08','N10','S08','U08M','U09M','LAMP','TELEGRAPH','ELECTROLYZER'].includes(p.id)).map(p=>`<article class="family-item"><h3>${p.name} · ${e.equipment[p.id]??0}耐用</h3><p>${p.effect}</p><p>${p.id==='ELECTROLYZER'?'按批加工，无需启停':m.enabled.includes(p.id)?'已启用':'未启用'} · ${m.services[p.id]===o.clock.absoluteTurn?'本季在线':m.operated[p.id]===o.clock.absoluteTurn?'本季已运行':'本季尚未运行'}</p>${p.id==='ELECTROLYZER'?button('economy:process:aluminium'):button('economy:utility:'+p.id+'-'+(m.enabled.includes(p.id)?'off':'on'))}</article>`).join('')}`);}
  if(page==='生活')body=socialFoodPage(o,button)+panel('谋生与补给',acts('生活'));
  $('app').innerHTML=humanScreen(o,page,body,button,session.record.entries.at(-1)?.events.map(feedback).filter(Boolean)??[],guide);
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page!;guide=false;filter='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-course]').forEach(b=>b.onclick=()=>{selectedCourse=b.dataset.course!;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-guide]').forEach(b=>b.onclick=()=>{page=b.dataset.guide!;guide=true;render();});
  document.querySelectorAll<HTMLButtonElement>('[data-shop-category]').forEach(b=>b.onclick=()=>{shopCategory=b.dataset.shopCategory!;filter='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>void act(b.dataset.action!));
  if($('filter-go'))$('filter-go').onclick=()=>{filter=(document.getElementById('filter') as HTMLInputElement).value;render();};
}
function download(name:string,data:unknown){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
$('export').onclick=()=>download('economy-run.json',{record:session.record,state:session.state});
$('import').onchange=async ev=>{const file=(ev.target as HTMLInputElement).files?.[0];if(!file||busy)return;busy=true;try{const value=JSON.parse(await file.text());const next=parseSession(value);if(next.record.manifest.ruleset.rulesVersion!==rules.rulesVersion)throw new Error('仅导入当前规则存档');const id=crypto.randomUUID();writeSave(id,next,`导入 · ${new Date().toLocaleString()}`);location.assign('/play?save='+encodeURIComponent(id));}catch(e){error((e as Error).message);busy=false;}};
render();
