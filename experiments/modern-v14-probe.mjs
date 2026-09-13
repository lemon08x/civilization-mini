import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const ruleset=validateRuleset(JSON.parse(await readFile('experiments/modern-grid.v14.json','utf8')));
const implementation=JSON.parse(await readFile('dist/implementation.json','utf8'));
const root='artifacts/experiments/modern-v14-'+Date.now();await mkdir(root,{recursive:true});
const results=[];
for(const enabled of [false,true]){
 let session=await createSession({runId:'modern-power-'+enabled,ruleset,implementation,seed:17,scenarioId:'canyon',agent:{kind:'scripted',name:'现代电力观察驱动脚本基线',settings:{enabled}}});
 const act=async id=>{const o=observeSession(session),a=o.game.actions.find(a=>a.id===id);if(!a?.enabled)throw new Error(id+':'+a?.reason);session=(await submitCommand(session,{actionId:id,commandId:'p'+o.revision,expectedRevision:o.revision})).session;};
 // 两组同场景、同种子、同一筹资/采购策略；唯一干预为取得同一机组后启用供能。
 for(const id of ['sell:shaft','sell:shaft','sell:ceramics','sell:ceramics','cartadd:device-E01','cartadd:good-wheat','cartadd:good-wheat','checkout:cart','end:season'])await act('economy:'+id);
 const before=observeSession(session).game;
 if(enabled)await act('economy:utility:E01-on');
 await act('economy:energize:now');await act('economy:process:mill');
 const after=observeSession(session).game;
 const replay=await replayRecord(session.record,implementation);
 const row={enabled,startSeason:before.clock.absoluteTurn,endSeason:after.clock.absoluteTurn,apRemaining:after.ap,foodTotal:after.economy.foodTotal,cash:after.family.money,power:after.economy.modern.power,generatorDurability:after.economy.equipment.E01,flour:after.economy.goods.flour,householdMissing:session.record.entries.flatMap(e=>e.events).filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),strictReplay:JSON.stringify(replay.state)===JSON.stringify(session.state)};
 results.push(row);await writeFile(root+'/'+enabled+'.json',JSON.stringify(session.record,null,2));
}
const report={question:'相同真实现代新局筹资采购后，启用水电是否付出真实运行资源并节省一次食品加工行动？',rulesVersion:ruleset.rulesVersion,implementation,scenario:'canyon',seed:17,method:'观察驱动脚本基线；启用供能为行动干预，两组其他步骤相同。非大模型调用。',results,scope:'只验证取得机组后的供能与单批加工，不证明整局经济与48季通关。'};
await writeFile(root+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({root,...report},null,2));
