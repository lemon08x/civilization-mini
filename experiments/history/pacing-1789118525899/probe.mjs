import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {loadContext} from '../dist/apps/cli/context.js';
import {validateRuleset} from '../dist/src/game/ruleset.js';
import {createSession,observeSession,submitCommand} from '../dist/src/runtime/session.js';
import {replayRecord} from '../dist/src/runtime/replay.js';
const {base,implementation}=await loadContext();
const candidate=validateRuleset(JSON.parse(await readFile('experiments/household-progress.v7.json','utf8')));
const hash=createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex');
const output=`experiments/history/pacing-${Date.now()}`;await mkdir(output,{recursive:true});
const summaries=[];
function controller(mode){let phase=0;return observation=>{
 const g=observation.game,enabled=id=>g.actions.find(a=>a.id===id)?.enabled,has=id=>g.person.mastered.includes(id),action=id=>g.actions.find(a=>a.id===id);
 const eat=()=>{const free=[['cultivate',g.harvest.food],['gather:food',g.production.gathering.food]].filter(([id,n])=>enabled(id)&&n>0).sort((a,b)=>b[1]-a[1]);if(free.length)return free[0][0];return enabled('buy-food-bulk')?'buy-food-bulk':enabled('buy-food')?'buy-food':enabled('work')?'work':'end-turn';};
 function pay(id,depth=0){if(depth>25)throw new Error('planner recursion '+id);const a=action(id);if(!a)return 'end-turn';if(g.family.food<2+a.food)return eat();if(a.enabled)return id;
   for(const [m,n] of Object.entries(a.materials??{}))if(g.production.inventory[m]<n){if(enabled('gather:'+m))return 'gather:'+m;if(m==='clay')return pay('procure-clay',depth+1);}
   if(g.family.money<a.money){for(const m of ['pottery','woodenware'])if(g.production.inventory[m]>1&&enabled('sell-good:'+m))return 'sell-good:'+m;return enabled('work')?'work':'end-turn';}return 'end-turn';}
 function method(id,depth=0){if(depth>20)throw new Error('method recursion');const t=g.technologies.find(t=>t.id===id);for(const p of t.prerequisites)if(!has(p))return master(p,depth+1);if(has(id)||g.person.learning[id]>=1)return null;if(!t.accessible)return pay('buy-method:'+id);return pay('study:'+id);}
 function craft(recipe){return pay('craft:'+recipe);}
 function master(id,depth=0){if(has(id))return null;const m=method(id,depth+1);if(m)return m;const t=g.technologies.find(t=>t.id===id);if(t.studied<t.required)return pay('study:'+id);const tag=t.practices.find(p=>!g.person.practices.includes(p));if(tag==='cultivation')return pay('cultivate');if(tag==='wood-shaped')return craft('woodenware');if(tag==='pot-fired')return craft('pottery');if(tag==='storage-fitted')return fit();if(tag==='channel-model'&&enabled('build-channel'))return pay('build-channel');if(tag?.startsWith('development-')){const recipe=g.development.recipes.find(r=>r.method===id);return make(recipe.id,depth+1);}return pay('practice:'+id+':'+tag);}
 function make(id,depth=0){if(depth>25)throw new Error('goods recursion '+id);const r=g.development.recipes.find(r=>r.id===id);const m=method(r.method,depth+1);if(m)return m;const skill=g.development.skills.find(s=>s.domain===r.domain);if(skill.level<r.level){if(r.domain==='pottery'&&skill.level>=1&&id!=='ceramicParts')return make('ceramicParts',depth+1);return craft(r.domain==='pottery'?'pottery':'woodenware');}for(const [good,n] of Object.entries(r.inputs))if(g.development.goods[good]<n)return need(good,n,depth+1);return pay('develop:'+id);}
 function need(id,n=1,depth=0){if(g.development.goods[id]>=n)return null;if((mode==='purchase'||mode==='kiln'||mode==='specialist'&&!['ceramicParts','precisionParts'].includes(id))&&id!=='findings')return pay('procure:'+id);if(id==='findings'){const m=method('experimentation',depth+1);if(m)return m;return need('supplies',1,depth+1)||need('ceramicParts',1,depth+1)||pay('conduct-experiment');}return make(id,depth+1);}
 function fit(){const m=method('storage');if(m)return m;if(!g.production.inventory.woodenware){const w=method('woodworking');return w||craft('woodenware');}return pay('install-storage:woodenware');}
 function device(id){const r=g.productNetwork.devices.find(r=>r.id===id);const m=method(r.method);if(m)return m;for(const [good,n] of Object.entries(r.inputs)){if(good==='calibrations'){if(g.productNetwork.goods.calibrations<n)return calibration();}else if(g.development.goods[good]<n)return need(good,n);}return pay('fabricate:'+id);}
 function install(id){if(g.productNetwork.installed[id]>0)return null;if(g.productNetwork.goods[id]>0)return pay('install-product:'+id);return device(id);}
 function calibration(){return install('calibrator')||method('experimentation')||need('findings')||need('supplies')||pay('calibrate');}
 if(g.status==='handover')return 'handover';if(g.status!=='active')return null;
 if(g.family.food<2)return eat();
 for(const id of ['finish-craft','finish-development','finish-product'])if(enabled(id))return pay(id);
 if(g.production.project||g.development.project||g.productNetwork.project){if(g.family.food<4)return eat();return enabled('work')?'work':'end-turn';}
 if(!g.production.storage.woodenware)return fit();
 if(g.clock.generation<3&&g.clock.turn>=13){for(const id of ['woodworking','controlled-fire','pottery','ceramic-engineering','experimentation'])if(has(id)&&!g.heir.mastered.includes(id)){if(!g.family.archives.includes(id))return pay('archive:'+id);const t=g.technologies.find(t=>t.id===id);if(t.prerequisites.every(p=>g.heir.mastered.includes(p)))return pay('teach:'+id);}}
 if(mode==='water')return !g.family.channel?(enabled('build-channel')?pay('build-channel'):master('ditch')||pay('build-channel')):g.family.channel.durability===0?pay('repair-channel'):!has('allocation')?master('allocation'):enabled('cultivate')&&g.harvest.food>0?pay('cultivate'):enabled('work')?'work':'end-turn';
 const goals=[()=>install('calibrator'),()=>g.productNetwork.goods.calibrations>0?null:calibration(),()=>mode==='kiln'?null:install('pump'),()=>mode==='kiln'||g.productNetwork.storedWater>0?null:pay('pump-water'),()=>install('kiln'),()=>g.productNetwork.goods.spentCeramics>=2?null:(method('experimentation')||need('supplies')||need('ceramicParts')||pay('conduct-experiment')),()=>pay('recycle-ceramics')];
 while(phase<goals.length){const next=goals[phase]();if(next){if(phase===goals.length-1&&next==='recycle-ceramics'&&enabled(next))phase++;return next;}phase++;}
 return g.family.food<6?eat():enabled('work')?'work':'end-turn';
};}
for(const mode of (process.argv.slice(2).length?process.argv.slice(2):['self','purchase','water']))for(const [variant,ruleset] of [['v6',base],['candidate',candidate]]){
 const scenarioId=mode==='water'?'river':'clay-valley';let s=await createSession({runId:`pacing-${mode}-${variant}`,ruleset,implementation,seed:17,scenarioId,agent:{kind:'scripted',name:mode,policyFingerprint:hash}});const choose=controller(mode);let minFood=Infinity,maxFood=0,bufferSeasons=0;const milestones={},commands={};
 for(let i=0;i<220;i++){const o=observeSession(s);if(['complete','ended'].includes(o.game.status))break;const id=choose(o);if(!id)break;commands[id]=(commands[id]??0)+1;s=(await submitCommand(s,{commandId:`step:${i}`,expectedRevision:o.revision,actionId:id})).session;for(const e of s.record.entries.at(-1).events){if(['product-operated','product-completed','development-completed','channel-changed'].includes(e.type)){const key=e.type+':'+(e.device??e.good??e.operation);milestones[key]??=o.game.clock.absoluteTurn;}if(e.type==='season-settled'){const f=observeSession(s).game.family.food;minFood=Math.min(minFood,f);maxFood=Math.max(maxFood,f);if(f>=4)bufferSeasons++;}}}
 await replayRecord(s.record,implementation);await writeFile(`${output}/${mode}-${variant}.json`,JSON.stringify(s.record,null,2)+'\n',{flag:'wx'});const events=s.record.entries.flatMap(e=>e.events);summaries.push({mode,variant,scenarioId,seed:17,status:s.state.status,commands,foodRange:[minFood,maxFood],bufferSeasons,missing:events.filter(e=>e.type==='season-settled').reduce((n,e)=>n+e.missing,0),milestones,handover:events.filter(e=>e.type==='generation-ended').map(e=>({generation:e.facts.generation,mastered:e.facts.mastered,heir:e.facts.heir})),manifest:s.record.manifest,replay:'passed'});
}
await writeFile(`${output}/results.json`,JSON.stringify({hypothesis:'experiments/pacing-v7-hypothesis.md',policyFingerprint:hash,kind:'scripted-default-settings-comparison',summaries},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({output,summaries:summaries.map(({manifest,commands,...rest})=>({...rest,actions:Object.values(commands).reduce((a,b)=>a+b,0)}))},null,2));
