import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadCurrentContext} from '../dist/apps/cli/context.js';
import {validateRuleset,resolveRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';

const {implementation}=await loadCurrentContext();
const base=validateRuleset(JSON.parse(await readFile('experiments/megaproject-trial.v13.json','utf8')));
const directory='artifacts/experiments/megaproject-v13-'+Date.now();await mkdir(directory+'/runs',{recursive:true});
await writeFile(directory+'/policy.mjs',await readFile(new URL(import.meta.url)));
const policyFingerprint=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
await writeFile(directory+'/manifest.json',JSON.stringify({question:'默认开局，现场运力1或2能否形成真实的第一层施工节奏差异，是否侵占家庭生存口粮',controller:'scripted',policyFingerprint,implementation,seed:17,scenario:'river',maxSeasons:8,base},null,2));
function choose({game:g}){
 const t=g.economy.towerView,ok=id=>g.actions.some(x=>x.id===id&&x.enabled);
 if(t.floor>0||g.clock.absoluteTurn>8||g.status!=='active')return null;
 if(g.economy.marketView.quote.lines.length)return ok('economy:checkout:cart')?'economy:checkout:cart':'economy:clearcart:all';
 if(!t.active)return 'economy:towerstart:camp';
 if(g.economy.foodTotal<3&&g.family.money>0&&ok('economy:cartadd:good-food'))return 'economy:cartadd:good-food';
 if(g.economy.foodTotal<4&&ok('economy:gather:food'))return 'economy:gather:food';
 return 'economy:end:season';
}
const results=[];
for(const transport of [1,2]){
 const ruleset=resolveRuleset(base,{'tower.transport':transport}),runId='transport-'+transport;
 let session=await createSession({runId,ruleset,implementation,seed:17,scenarioId:'river',agent:{kind:'scripted',name:'camp-supply-baseline'}});
 for(let i=0;i<40;i++){const actionId=choose(observeSession(session));if(!actionId)break;session=(await submitCommand(session,{commandId:'c'+i,expectedRevision:session.record.entries.length,actionId})).session;}
 await replayRecord(session.record,implementation);
 const events=session.record.entries.flatMap(x=>x.events),g=observeSession(session).game;
 const row={transport,controller:'scripted',rulesFingerprint:session.record.manifest.rulesFingerprint,implementation,completedFloors:g.economy.towerView.floor,seasons:events.filter(x=>x.type==='season-settled').length,commands:session.record.entries.length,construction:events.filter(x=>x.type==='tower'&&x.operation==='built'),missing:events.filter(x=>x.type==='season-settled').reduce((n,x)=>n+x.missing,0),money:g.family.money,remainingWood:g.economy.goods.wood,strictReplay:true};
 results.push(row);await writeFile(directory+'/runs/'+runId+'.json',JSON.stringify(session.record));
}
await writeFile(directory+'/results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({directory,results},null,2));
