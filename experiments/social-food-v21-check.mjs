// Scripted baseline, not model playtesting. All decisions read observeSession only.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
const ruleset=JSON.parse(await readFile('rulesets/social-food.v21.json','utf8'));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const output='artifacts/experiments/social-food-v21-'+Date.now();await mkdir(output,{recursive:true});const rows=[];
for(const seed of [17,29])for(const policy of ['market','reserve']){
 let session=await createSession({runId:'social-food-'+seed+'-'+policy,ruleset,implementation,seed,scenarioId:'river',agent:{kind:'scripted',name:'paid-food-with-local-work'}});
 const send=async id=>{const o=observeSession(session);if(!o.game.actions.some(a=>a.id===id&&a.enabled))throw Error('Unavailable '+id);session=(await submitCommand(session,{commandId:'step-'+o.revision,expectedRevision:o.revision,actionId:id,reason:'固定脚本基线：每季一次当地做工，精力不足先休息，通过生活安排购粮，不耕作'})).session;};
 await send('economy:foodpolicy:'+policy);
 for(let turn=0;turn<8;turn++){const o=observeSession(session);if(!o.game.actions.some(a=>a.id==='economy:work:local'&&a.enabled))await send('economy:rest:self');await send('economy:work:local');await send('economy:end:season');}
 const o=observeSession(session),events=session.record.entries.flatMap(e=>e.events),meals=events.filter(e=>e.type==='season-settled'),purchases=events.filter(e=>e.type==='food-purchased');
 rows.push({seed,policy,turn:o.game.clock.absoluteTurn,food:o.game.economy.foodTotal,money:o.game.family.money,health:o.game.life.person.health,missing:meals.reduce((n,e)=>n+e.missing,0),purchased:purchases.reduce((n,e)=>n+e.amount,0),spent:purchases.reduce((n,e)=>n+(e.money??0),0),shoppingTime:events.filter(e=>e.type==='social-food').reduce((n,e)=>n+e.time,0)});
 await writeFile(output+'/'+session.record.manifest.runId+'.json',JSON.stringify(session.record,null,2));
}
await writeFile(output+'/report.json',JSON.stringify({implementation,scope:'river, seeds 17/29, 8 seasons, same scripted local-work policy comparing market and reserve arrangements',rows},null,2));console.log(JSON.stringify({output,rows},null,2));
