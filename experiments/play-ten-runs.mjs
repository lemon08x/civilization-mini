// 十局试玩脚本基线 v4：观察驱动、不读种子/RNG/未来天气。
// 按 g01 手工对局的正确顺序：开局即启动河谷粮站副本 → 种麦为口粮与副本证据主线 →
// 集齐投入立即装运 → 建陶窑烧陶完成耐火窑场 → 换代后由后辈接续。
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
import {metrics} from '../dist/src/research/metrics.js';

const rules=validateRuleset(JSON.parse(await readFile('rulesets/agriculture-civilization.v15.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const output=`artifacts/experiments/play-ten-${Date.now()}`;
await mkdir(output,{recursive:true});

function en(o,id){return o.game.actions.find(a=>a.id===id)?.enabled??false;}
function amt(o,id){return o.game.economy.goods[id]??0;}
function level(o,subj){const d=o.game.economy.disciplines.find(x=>x.subject===subj);return d?d.level:0;}
function first(o,ids){for(const id of ids)if(en(o,id))return id;return null;}

function choose(o){
  const g=o.game,e=g.economy,x=e.expeditionView,f=e.field;
  if(g.status==='handover')return 'handover';
  if(g.status!=='active')return null;
  const h=x.attempts.harvest,k=x.attempts.kiln;

  // 0) 启动河谷粮站副本（无门槛，开局就能做；不做完不换副本）
  if(x.selected==='harvest'&&h&&!h.completed&&h.active){} // 已在做，继续
  else if(h&&h.completed){ if(x.selected==='harvest'&&en(o,'economy:expeditionstart:kiln'))return 'economy:expeditionstart:kiln'; }
  else if(en(o,'economy:expeditionstart:harvest'))return 'economy:expeditionstart:harvest';

  // 1) 口粮主线：种麦是核心。空田播种 → 成熟收获 → 生长期灌溉。
  if(f.crop&&f.growth>=f.duration&&en(o,'economy:farm:wheat'))return 'economy:farm:wheat'; // 收获（同时是副本证据）
  if(!f.crop&&amt(o,'seedWheat')>0&&en(o,'economy:farm:wheat'))return 'economy:farm:wheat'; // 播种
  if(f.crop&&f.growth<f.duration&&en(o,'economy:farm:wheat'))return 'economy:farm:wheat'; // 灌溉/照料
  // 应急：口粮低但田里等成熟时，采集或买粮
  if(e.foodTotal<3){
    if(en(o,'economy:gather:food'))return 'economy:gather:food';
    if(en(o,'economy:work:local'))return 'economy:work:local';
    const cart=e.marketView.quote.lines.find(l=>l.item.target==='food');
    const inCart=cart?cart.quantity:0;
    if(inCart<2&&en(o,'economy:cartadd:good-food'))return 'economy:cartadd:good-food';
    if(inCart>0&&en(o,'economy:checkout:cart'))return 'economy:checkout:cart';
  }

  // 2) 副本装运：河谷粮站（小麦3+木2）；耐火窑场（陶构件3+木2）
  for(const [id,spec] of [['harvest',x.catalog.find(c=>c.id==='harvest')],['kiln',x.catalog.find(c=>c.id==='kiln')]]){
    const a=x.attempts[id];
    if(!a||a.completed||!a.active||x.selected!==id)continue;
    const missing=Object.entries(spec.kit).some(([gid,n])=>(a.stock[gid]??0)<n);
    const kitFood=Object.entries(spec.kit).reduce((s,[gid,n])=>s+((gid==='wheat'||gid==='soy'||gid==='flour')?n:0),0);
    if(missing&&e.foodTotal-kitFood>=2&&en(o,'economy:expeditionship:current'))return 'economy:expeditionship:current';
  }

  // 3) 耐火窑场准备：建陶窑（黏土4+木2，需热学1材料1）→ 烧陶（木2+黏土2→陶构件2，跨季）→ 完成
  if(k&&!k.completed){
    if(en(o,'economy:finish:project'))return 'economy:finish:project';
    if(en(o,'economy:process:ceramics')&&amt(o,'ceramics')<6)return 'economy:process:ceramics';
    if(en(o,'economy:build:F02')&&amt(o,'ceramics')<3)return 'economy:build:F02';
  }

  // 4) 学科：只学有来源的下一课题（首阶直接学；高阶需证据/书/记录）
  for(const d of e.disciplines){
    if(d.level>=10)continue;
    const topic=d.topics.find(t=>t.level===d.level+1);
    if(!topic)continue;
    const hasSource=topic.evidence||topic.level===1||(e.notes[d.subject]??0)>=topic.level||(e.regional.teaching[d.subject]??0)>=topic.level||e.shop.books.includes(topic.id);
    if(hasSource&&en(o,`economy:study:${topic.id}`))return `economy:study:${topic.id}`;
  }
  for(const d of e.disciplines){
    if(d.level>=10)continue;
    const topic=d.topics.find(t=>t.level===d.level+1);
    if(!topic||topic.evidence||topic.level===1)continue;
    if(en(o,`economy:research:${topic.id}`))return `economy:research:${topic.id}`;
  }

  // 5) 备料：木材/黏土低于副本需要时采集
  if(en(o,'economy:gather:wood')&&amt(o,'wood')<2)return 'economy:gather:wood';
  if(en(o,'economy:gather:clay')&&amt(o,'clay')<4)return 'economy:gather:clay';
  if(en(o,'economy:gather:food'))return 'economy:gather:food';
  if(en(o,'economy:work:local'))return 'economy:work:local';
  return 'economy:end:season';
}

const games=[
  {runId:'g02',seed:17,scenario:'clay-valley',maxActions:110},
  {runId:'g03',seed:17,scenario:'woodland',maxActions:110},
  {runId:'g04',seed:17,scenario:'dry',maxActions:110},
  {runId:'g05',seed:23,scenario:'river',maxActions:110},
  {runId:'g06',seed:23,scenario:'clay-valley',maxActions:110},
  {runId:'g07',seed:23,scenario:'woodland',maxActions:110},
  {runId:'g08',seed:23,scenario:'dry',maxActions:110},
  {runId:'g09',seed:42,scenario:'river',maxActions:110},
  {runId:'g10',seed:42,scenario:'woodland',maxActions:110},
];

const results=[];
for(const game of games){
  let session=await createSession({runId:game.runId,ruleset:rules,implementation,seed:game.seed,scenarioId:game.scenario,agent:{kind:'scripted',id:'play-ten-v4',policyFingerprint}});
  let actions=0;
  while(!['complete','ended'].includes(session.state.status)&&actions<game.maxActions){
    const o=observeSession(session);
    const actionId=choose(o);
    if(!actionId)break;
    const result=await submitCommand(session,{actionId,commandId:`p${o.revision}`,expectedRevision:o.revision,reason:'scripted:play-ten-v4'});
    session=result.session;actions++;
  }
  const replayed=await replayRecord(session.record,implementation);
  const o=observeSession(replayed);
  const m=metrics(replayed.record,replayed.state);
  const ev=replayed.record.entries.flatMap(e=>e.events);
  results.push({
    runId:game.runId,scenario:game.scenario,seed:game.seed,
    season:o.game.clock.absoluteTurn,generation:o.game.clock.generation,status:o.game.status,
    food:o.game.family.food,foodStock:o.game.economy.foodTotal,money:o.game.family.money,
    supplyLevel:o.game.economy.expeditionView.supplyLevel,
    completed:Object.fromEntries(Object.entries(o.game.economy.expeditionView.attempts).map(([k,v])=>[k,{completed:v.completed,progress:v.progress}])),
    knowledge:structuredClone(o.game.economy.knowledge),
    goods:structuredClone(o.game.economy.goods),
    books:[...o.game.economy.shop.books],
    equipment:structuredClone(o.game.economy.equipment),
    shortfall:ev.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),
    commands:m.commands,
  });
  await writeFile(output+`/${game.runId}.json`,JSON.stringify(session.record,null,2),{flag:'wx'});
}
const report={question:'十局试玩 v4：开局即做副本、种麦为口粮与证据主线的脚本基线表现',rulesVersion:rules.rulesVersion,implementation,method:'观察驱动脚本基线（非大模型），每局上限110行动',results};
await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report,null,2));