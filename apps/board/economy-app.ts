import { towerPage } from './tower-view.js';
import { workshopPage } from './workshop-view.js';
import { operationsPage } from './operations-view.js';
import { marketPage } from './shop-view.js';
import {createSession,observeSession,submitCommand} from '../../src/runtime/session.js';
import {replayRecord} from '../../src/runtime/replay.js';
import type {Session,ImplementationIdentity} from '../../src/runtime/records.js';
import {validateRuleset} from '../../src/game/ruleset.js';
import {ALL_PRODUCTS as PRODUCTS,ALL_GOODS as GOODS,ALL_TOPICS as TOPICS,SUBJECT_NAMES,WORKER_NAMES,CROPS,ALL_PROCESSES as PROCESSES} from '../../src/game/systems/economy-catalog.js';
import {esc,needsText,inputsText} from './economy-view.js';
import type {GameEvent} from '../../src/game/model/events.js';
const $=(id:string)=>document.getElementById(id)!;
const rules=validateRuleset(await (await fetch('/rulesets/modern-grid.v14.json')).json());
const implementation:ImplementationIdentity=await(await fetch('/implementation.json')).json();
const KEY='civilization-mini.modern.v14';let raw=localStorage.getItem(KEY),failed=false,busy=false,page='试炼',filter='',shopCategory='物资';
let session=await createSession({runId:crypto.randomUUID(),ruleset:rules,implementation,seed:17,scenarioId:'canyon'});
const error=(message:string)=>{$('error').hidden=!message;$('error').textContent=message;};
try{if(raw){session=await replayRecord(JSON.parse(raw),implementation);if(session.record.manifest.ruleset.rulesVersion!==rules.rulesVersion)throw new Error('只接受当前文明试炼规则；旧档保留，请另开新局');}}catch(e){failed=true;error('当前存档无法读取，请新开局：'+(e as Error).message);}
function feedback(e:GameEvent):string {
  if(e.type==='tower')return e.detail;
  if(e.type==='operations')return e.detail;
  if(e.type==='shop')return e.detail+(e.money?'，支付'+e.money+'钱':'')+(e.amount>1?' × '+e.amount:'');
  if(e.type==='economy-goods')return e.source.replace('大运河施工装运','工程施工装运')+'：'+Object.entries(e.changes).map(([id,n])=>`${GOODS[id]?.name??id} ${n>0?'+':''}${n}`).join('、');
  if(e.type==='economy-learned')return `${e.source==='teach'?'后辈':'本人'}掌握${TOPICS.find(t=>t.subject===e.subject&&t.level===e.level)?.name}。`;
  if(e.type==='economy-evidence')return `取得${TOPICS.find(t=>t.id===e.topic)?.name}的证据：${e.source}`;
  if(e.type==='economy-worker')return `${WORKER_NAMES[e.worker as keyof typeof WORKER_NAMES]}：${e.detail}${e.money?'；支付'+e.money+'钱':''}`;
  if(e.type==='economy-built')return `${PRODUCTS.find(p=>p.id===e.product)?.name}已制造安装，耐用${e.durability}。`;
  if(e.type==='economy-equipment-used')return `${PRODUCTS.find(p=>p.id===e.product)?.name}生效，剩余${e.remaining}次。`;
  if(e.type==='economy-trade')return `${e.operation==='buy'?'购入':'交付'}${e.amount}${GOODS[e.good]?.name}，${e.money}钱。`;
  if(e.type==='economy-farm')return `${e.actor}：${{sow:'播种',harvest:'收获',tend:'田间管理',pump:'自动灌溉'}[e.operation]}${CROPS[e.crop as keyof typeof CROPS].name}${e.operation==='harvest'?' '+e.amount:''}`;
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
async function save(next:Session){if(localStorage.getItem(KEY)!==raw)throw new Error('另一页面更新了存档，请刷新');const nextRaw=JSON.stringify(next.record);localStorage.setItem(KEY,nextRaw);raw=nextRaw;session=next;failed=false;error('');render();}
async function act(id:string){if(busy||failed)return;busy=true;try{await save((await submitCommand(session,{commandId:session.record.manifest.runId+':'+session.record.entries.length,expectedRevision:session.record.entries.length,actionId:id})).session);}catch(e){error((e as Error).message);}finally{busy=false;}}
function render(){
  const o=observeSession(session).game,e=o.economy!;
  ($('scenario') as HTMLSelectElement).value=session.record.manifest.scenarioId;
  ($('seed') as HTMLInputElement).value=String(session.record.manifest.seed);
  $('rule-notice').textContent=`规则 ${o.rulesVersion} · 现代电网 / 数字协同 · 60项学科，${PRODUCTS.length}项设备 · 数值待验证`;
  const button=(id:string)=>{const a=o.actions.find(a=>a.id===id);return a?`<button data-action="${esc(id)}" ${!a.enabled||failed?'disabled':''}>${esc(a.label)} · ${a.ap}行动${a.money?' / '+a.money+'钱':''}${a.food?' / '+a.food+'粮':''}</button><p class="subtle">${esc(a.enabled?a.description:a.reason)}</p>`:'';};
  const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
  const acts=(group:string)=>o.actions.filter(a=>a.group===group&&(!filter||a.label.includes(filter))).map(a=>`<div class="family-item">${button(a.id)}</div>`).join('');
  let body='';
  if(page==='试炼')body=towerPage(observeSession(session),button);
  if(page==='家业')body=operationsPage(o,button)+(e.workshopView?'<section class="panel"><div class="panel-body"><h2>作坊协作</h2><p>建立纤维与绳索工序，配置跨季供货，观察库存与运输瓶颈。</p><button data-page="作坊">查看生产网络 →</button></div></section>':'');
  if(page==='作坊')body=workshopPage(o,button,observeSession(session).recentEvents);
  if(page==='学科')body=e.disciplines.map(d=>panel(d.name+` · 本人${d.level}阶 / 后辈${d.heirLevel}阶`, `<p>家族记录${d.notes}阶；下一阶可通过固定研究、生产证据或购买教材学习；家学书室可合并记录与教导。各学科内部暂按单主干顺序学习。</p><div class="flow">${d.topics.map(t=>`<span class="tag">${t.known?'✓ ':''}${t.level} ${t.name}</span>`).join(' → ')}</div>${d.topics.filter(t=>t.level===d.level+1).map(t=>button('economy:study:'+t.id)+(t.level>1?button('economy:research:'+t.id):'')).join('')}${button('economy:archive:'+d.subject)}${button('economy:teach:'+d.subject)}${button('economy:publish:'+d.subject)}`)).join('');
  if(page==='产品')body=[...new Set(PRODUCTS.map(p=>p.category))].map(category=>panel(category,PRODUCTS.filter(p=>p.category===category).map(p=>`<details><summary>${p.name} · ${e.equipment[p.id]??0}耐用</summary><p>${p.id==='U02'?'每季一次本人播种免行动；仍扣种子和耐用度，雇工工资不减免':p.effect}</p><p>学科：${needsText(p.requires)}<br>投入：${inputsText(p.inputs)}</p>${button('economy:build:'+p.id)}</details>`).join(''))).join('');
  if(page==='农业')body=panel('家庭田地',`<p>${e.field.crop?`${CROPS[e.field.crop].name} · 生长${e.field.growth}/${e.field.duration}季 · 当前预计收成${e.harvest}`:'空田，可播种'}；肥力${e.field.fertility}/3；水分补充${e.field.moisture}。</p><p>小麦供主食，大豆兼顾食品、油料与轮作，亚麻提供工业纤维。种子独立留存，个人与雇工共用同一块田。</p>${e.operations?.farm?'<details><summary>托管中 · 展开手动干预</summary>'+acts('农业')+'</details>':acts('农业')}`);
  if(page==='生产')body=(e.operations?.production?'<p>已有持续生产计划；日常进度见「家业」。下面的手动加工与雇员共用材料和设备。</p>':'')+panel('加工与在制品',`<p>${e.project?'本人项目：'+PROCESSES.find(p=>p.id===e.project?.good)?.name:'暂无本人项目'}。工序需设备时，个人和雇工争用同一设备位置。</p>${PROCESSES.map(p=>`<details><summary>${p.name} → ${inputsText(p.outputs)}</summary><p>投入${inputsText(p.inputs)}；${needsText(p.requires)}；${p.wait?'跨季':'当次完成'}${p.power?'；单批用电'+p.power+'（双份加工用双份电）':''}${p.equipment?'；设备'+PRODUCTS.find(x=>x.id===p.equipment)?.name:''}</p>${button('economy:process:'+p.id)}</details>`).join('')}${button('economy:finish:project')}`);
  if(page==='雇佣')body=panel('人员与生产关系',`<p>普通雇工先做照料和收获；熟练农工能播种；熟练工匠会专业配方。招募后安排任务，每季至多一项工作。缺工资、缺料、设备占用或无事可做时待命不收费。</p>${e.staff.map(w=>`<article class="family-item"><h3>${w.name} · 经验${w.experience}</h3><p>${w.job==='rest'?'尚未安排任务':(w.active?'执行':'暂停')+w.jobName} · 每工作季${w.wage}钱；${w.project?'在制：'+w.project.good:'无在制品'}<br>${esc(w.blockers.join('；')||'当前具备工作条件')}</p>${button('economy:pause:'+w.kind)}${button('economy:train:'+w.kind)}${o.actions.filter(a=>a.id.startsWith('economy:assign:'+w.kind+'-')).map(a=>button(a.id)).join('')}</article>`).join('')}<details><summary>招募新岗位</summary>${o.actions.filter(a=>a.id.startsWith('economy:hire:')).map(a=>button(a.id)).join('')}</details>`);
  if(page==='商城')body=marketPage(o,shopCategory,filter,button);
  if(page==='能源'&&e.modern){const m=e.modern;body=panel('供能与设备服务',`<p>可用电力 <strong>${m.power}</strong>；跨季储能 <strong>${m.stored}/6</strong>。未入储能柜的电力跨季清空。</p><p>季末：补货与维护 → 发电与储能放电 → 通信/控制/冷库/农业服务 → 雇员加工 → 工地用电 → 余电入库。启停不产电；本人需要提前用电时执行本季供能。</p>${button('economy:energize:now')}${PRODUCTS.filter(p=>['E01','E02','E03','E04','N08','N10','S08','U08M','U09M'].includes(p.id)).map(p=>`<article class="family-item"><h3>${p.name} · ${e.equipment[p.id]??0}耐用</h3><p>${p.effect}</p><p>${m.enabled.includes(p.id)?'已启用':'未启用'} · ${m.services[p.id]===o.clock.absoluteTurn?'本季在线':m.operated[p.id]===o.clock.absoluteTurn?'本季已运行':'本季尚未运行'}</p>${button('economy:utility:'+p.id+'-'+(m.enabled.includes(p.id)?'off':'on'))}</article>`).join('')}`);}
  if(page==='生活')body=panel('谋生与补给',acts('生活'));
  const end=o.status==='complete'||o.status==='ended';
  $('app').innerHTML=`<section class="status"><div class="counter primary"><small>${o.scenario.name} · ${o.world.weatherName}</small><strong>第${o.clock.generation}代 第${o.clock.turn}季</strong></div><div class="counter"><small>行动</small><strong>${o.ap}/${o.parameters.actionsPerTurn}</strong></div><div class="counter"><small>可食储备（含即食${o.family.food}）</small><strong>${e.foodTotal}</strong></div><div class="counter"><small>钱财</small><strong>${o.family.money}</strong></div><div class="counter"><small>${e.towerView?'文明试炼 · 已完成层数':'家族学科'}</small><strong>${e.towerView?e.towerView.floor+'/'+e.towerView.total:o.victory?.mastered.length+'/'+o.victory?.total}</strong></div></section><section class="feedback" aria-live="polite">${session.record.entries.at(-1)?.events.map(feedback).filter(Boolean).map(t=>`<p>${esc(t)}</p>`).join('')||'已继承六阶工业基础。先保障生活与现金，再研究电工材料、建设供能并向现代工地供货。'}</section>${end?panel(o.victory?.won?(e.towerView?'现代工业区 · 验收通关':'家族发展胜利'):o.status==='ended'?'因困顿终止':(e.towerView?'观察期结束 · 试炼未完成':'观察期结束'),'可导出记录查看实际成果。'):o.status==='handover'?panel('后辈接手',button('handover')):''}${panel('家庭库存',`<p>季耗${o.parameters.foodPerTurn}粮，保存保护容量${e.storage}；面粉、小麦、大豆按此顺序补生活缺口，亚麻与种子不当饭吃。</p><div class="world-strip">${Object.entries(e.goods).filter(([,n])=>n>0).map(([id,n])=>`<span class="tag">${GOODS[id]?.name??id} ${n}</span>`).join('')}</div>`)}<nav class="tabs" aria-label="新版栏目">${[...(e.towerView?['试炼']:[]),'家业',...(e.modern?['能源']:[]),...(e.workshopView?['作坊']:[]),'学科','产品','农业','生产','雇佣','商城','生活'].map(p=>`<button data-page="${p}" class="${page===p?'selected':''}">${p}</button>`).join('')}</nav>${body}${!end&&o.status!=='handover'?panel('本季结算',button('economy:end:season')):''}`;
  document.querySelectorAll<HTMLButtonElement>('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page!;filter='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-shop-category]').forEach(b=>b.onclick=()=>{shopCategory=b.dataset.shopCategory!;filter='';render();});
  document.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(b=>b.onclick=()=>void act(b.dataset.action!));
  if($('filter-go'))$('filter-go').onclick=()=>{filter=(document.getElementById('filter') as HTMLInputElement).value;render();};
}
function download(name:string,data:unknown){const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=name;a.click();URL.revokeObjectURL(u);}
$('new-game').onclick=async()=>{if(busy)return;busy=true;try{await save(await createSession({runId:crypto.randomUUID(),ruleset:rules,implementation,seed:Number(($('seed') as HTMLInputElement).value),scenarioId:($('scenario') as HTMLSelectElement).value}));}catch(e){error((e as Error).message);}finally{busy=false;}};
$('export').onclick=()=>download('economy-run.json',session.record);$('observation').onclick=()=>download('economy-observation.json',observeSession(session));
$('import').onchange=async ev=>{const file=(ev.target as HTMLInputElement).files?.[0];if(!file||busy)return;busy=true;try{const value=JSON.parse(await file.text());if(value.manifest?.ruleset?.rulesVersion!==rules.rulesVersion)throw new Error('仅导入当前新版，不迁移旧存档');await save(await replayRecord(value,implementation));}catch(e){error((e as Error).message);}finally{busy=false;}};
render();
