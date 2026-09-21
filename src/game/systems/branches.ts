import {industryProductsFor} from '../model/industry.js';
import {APPLIANCES,ELECTRIC_EPIGRAPHS} from '../model/electric.js';
import {ancestorKnows} from './ancestry.js';
import { productNeeds,productTrialNeeds } from './industry-products.js';
import {branchNodesFor,nodeInEra,ERA_NODES,BRANCH_NODES,BRANCH_PRODUCTS,BRANCH_PROCESSES,BRANCH_PATHS} from '../model/branches.js';
import {frameworkUnlockStage} from '../model/eras.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
export {BRANCH_NODES,BRANCH_PRODUCTS,BRANCH_PROCESSES,BRANCH_PATHS};
export const branchHas=(s:GameState,id:string,person=s.household.activePersonId)=>s.economy?.branches?.learned[person]?.includes(id)??false;
export const branchName=(id:string)=>[...BRANCH_NODES,...ERA_NODES].find(n=>n.id===id)?.name??id;
export function branchNeeds(s:GameState,ids:string[],person=s.household.activePersonId):string[]{return ids.filter(id=>!branchHas(s,id,person)).map(id=>'需掌握'+branchName(id));}
export function branchProcessNeeds(s:GameState,id:string,worker=false):string[]{
  const b=s.economy?.branches;if(!b)return [];
  if(!BRANCH_PROCESSES[id])return ['该工艺尚未纳入三路线试点'];
  if(worker)return b.protocols.includes(id)?[]:['先亲自完成一次'+id+'试制，留存工艺规程'];
  return branchNeeds(s,BRANCH_PROCESSES[id]);
}
export function branchActionNeeds(s:GameState,id:string):string[]{
  if(!s.economy?.branches||id==='handover')return [];
  const [,op,target]=id.split(':');
  if(s.economy.farm&&['farmrare','farmstory','farmplot','farmexplore','farmreclaim','farmfertilize','neighbor'].includes(op))return [];
  if(s.sect&&['sectswitch','sectseek','sectadmit','sectpractice','sectteach','sectimprove','sectdraw','crisis'].includes(op))return [];
  if(s.era&&['tap','dungeonstart','dungeonwork','erasettle','publicmill'].includes(op))return [];
  if(s.socialFood&&['foodpolicy','foodbudget','foodreserve','foodplan'].includes(op))return [];
  if(s.economy.industry){
    if(['inspect','sysbuild','syscommission','sysassign','sysrun','sysremove'].includes(op))return [];
    if(['assign','pause','farmplan','productionplan','supplyplan','salesplan','careplan','charter'].includes(op))return ['旧经营方式尚未纳入三类树，请使用系统安排与手动采购交付'];
    if(['build','process'].includes(op))return [...productNeeds(s,target),...(op==='build'?productTrialNeeds(s,target):[])];
  }
  if(['bond','branchlearn','branchteach','brancharchive','channel','rest','care','retire','company','consult','end','cartadd','cartremove','clearcart','checkout','gather','work','sell','sellfood','repair','finish','resumeplans','pause','fertilize','farmcycle'].includes(op))return [];
  if(target==='off'&&['foodplan','farmplan','productionplan','supplyplan','salesplan','careplan'].includes(op))return [];
  if(op==='build')return BRANCH_PRODUCTS[target]?branchNeeds(s,BRANCH_PRODUCTS[target]):['该设备尚未纳入试点'];
  if(op==='process')return branchProcessNeeds(s,target);
  if(op==='farm')return target==='wheat'?branchNeeds(s,['A0']):['soy','flax'].includes(target)?branchNeeds(s,['A4']):['该种植分支尚未接入'];
  if(s.electric&&op==='utility'&&['E01','E02','E04',...APPLIANCES.filter(x=>x!=='ELECTROLYZER')].includes(target.split('-')[0]))return target.endsWith('-off')?[]:branchNeeds(s,APPLIANCES.includes(target.split('-')[0])?['L7']:['L6']);
  if(op==='utility')return target.startsWith('E01-')?(target.endsWith('-off')?[]:branchNeeds(s,['L6'])):['当前仅试点水力发电'];
  if(op==='energize')return branchNeeds(s,['L6']);
  if(op==='hire')return target==='manager'?['管理进阶分支尚未接入']:branchNeeds(s,['O0',...(target==='laborer'?[]:['O1'])]);
  if(op==='assign'){
    const job=target.slice(target.indexOf('-')+1);
    return [...branchNeeds(s,['O0']),...(job==='wheat'?[]:branchProcessNeeds(s,job,true))];
  }
  if(op==='foodplan')return branchNeeds(s,['O0']);
  if(op==='farmplan')return target==='off'||target==='wheat'?branchNeeds(s,['O1']):['soy','flax','rotation'].includes(target)?[...branchNeeds(s,['O1']),...branchNeeds(s,['A4'])]:['该种植分支尚未接入'];
  if(op==='productionplan')return [...branchNeeds(s,['O1']),...(target==='off'?[]:branchProcessNeeds(s,target.split('-')[0],true))];
  if(['supplyplan','salesplan','careplan','charter','paidtrain'].includes(op))return branchNeeds(s,['O2']);
  return ['该进阶内容尚未纳入三路线试点'];
}
export function recordBranchWork(s:GameState,events:GameEvent[]):void {
  const b=s.economy?.branches;if(!b)return;
  for(const e of [...events]){
    if(s.sect){const kind=e.type==='economy-farm'&&e.actor==='本人'&&['harvest','sow','tend'].includes(e.operation)?'farm':e.type==='economy-process'&&e.actor==='本人'&&e.stage==='complete'||e.type==='industry'&&e.actor==='self'&&e.operation==='worked'?'craft':e.type==='branch'&&e.operation==='taught'?'teach':null;const records=s.persons[s.household.activePersonId].practices;if(kind&&!records.includes('dao:'+kind))records.push('dao:'+kind);}
    if(e.type==='economy-process'&&e.stage==='complete'&&e.actor==='本人'&&!b.protocols.includes(e.recipe)){
      b.protocols.push(e.recipe);events.push({type:'branch',operation:'protocol',node:e.recipe,detail:'真实试制完成，工艺规程可供雇员跨代接续'});
    }
    if(e.type==='economy-trade'&&e.operation==='sell'&&e.good==='shaft'&&!b.delivered.includes('shaft'))b.delivered.push('shaft');
  }
}
export function branchView(s:GameState){
  const b=s.economy!.branches!;
  return {nodes:branchNodesFor(s).map(n=>({...n,...(s.electric&&ELECTRIC_EPIGRAPHS[n.id]?{epigraph:ELECTRIC_EPIGRAPHS[n.id]}:{}),...(s.economy!.industry?{sample:{}}:{}),known:branchHas(s,n.id),inherited:ancestorKnows(s,n.id),heirInherited:ancestorKnows(s,n.id,s.household.heirId),heirKnown:s.household.heirId!==s.household.activePersonId&&branchHas(s,n.id,s.household.heirId),archived:b.archives.includes(n.id),scope:frameworkUnlockStage(s.era?.frameworkId,n.id)>0?'社会开放后可学':'通用知识',active:nodeInEra(s,n.id),recorded:!!b.learned[s.household.activePersonId]?.includes(n.id),missing:[...branchNeeds(s,n.parents),...(!nodeInEra(s,n.id)?['当前社会尚未开放此课程']:[])]})),
    paths:BRANCH_PATHS.map(p=>({...p,learned:p.nodes.filter(id=>branchHas(s,id)).length})),
    channels:[...b.channels],protocols:[...b.protocols],delivered:[...b.delivered],products:s.electric?Object.fromEntries(industryProductsFor(s).filter(p=>p.kind==='device').map(p=>[p.id,p.knowledge])):BRANCH_PRODUCTS,processes:s.electric?Object.fromEntries(industryProductsFor(s).filter(p=>p.kind==='goods').map(p=>[p.id,p.knowledge])):BRANCH_PROCESSES};
}
