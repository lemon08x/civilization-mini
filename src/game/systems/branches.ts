import {ancestorKnows} from './ancestry.js';
import { productNeeds,productTrialNeeds } from './industry-products.js';
import {BRANCH_NODES,BRANCH_PRODUCTS,BRANCH_PROCESSES,BRANCH_PATHS} from '../model/branches.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';
export {BRANCH_NODES,BRANCH_PRODUCTS,BRANCH_PROCESSES,BRANCH_PATHS};
export const branchHas=(s:GameState,id:string,person=s.household.activePersonId)=>s.economy?.branches?.learned[person]?.includes(id)??false;
export const branchName=(id:string)=>BRANCH_NODES.find(n=>n.id===id)?.name??id;
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
  if(s.socialFood&&['foodpolicy','foodbudget','foodreserve','foodplan'].includes(op))return [];
  if(s.economy.industry){
    if(['inspect','sysbuild','syscommission','sysassign','sysrun','sysremove'].includes(op))return [];
    if(['assign','pause','farmplan','productionplan','supplyplan','salesplan','careplan','charter'].includes(op))return ['旧经营方式尚未纳入三类树，请使用系统安排与手动采购交付'];
    if(['build','process'].includes(op))return [...productNeeds(s,target),...(op==='build'?productTrialNeeds(s,target):[])];
  }
  if(['branchlearn','branchteach','brancharchive','channel','rest','care','retire','end','cartadd','cartremove','clearcart','checkout','gather','work','sell','sellfood','repair','finish','resumeplans','pause'].includes(op))return [];
  if(target==='off'&&['foodplan','farmplan','productionplan','supplyplan','salesplan','careplan'].includes(op))return [];
  if(op==='build')return BRANCH_PRODUCTS[target]?branchNeeds(s,BRANCH_PRODUCTS[target]):['该设备尚未纳入试点'];
  if(op==='process')return branchProcessNeeds(s,target);
  if(op==='farm')return target==='wheat'?branchNeeds(s,['A0']):['油料与纤维种植分支尚未接入，可采购半成品'];
  if(op==='utility')return target.startsWith('E01-')?(target.endsWith('-off')?[]:branchNeeds(s,['L6'])):['当前仅试点水力发电'];
  if(op==='energize')return branchNeeds(s,['L6']);
  if(op==='hire')return target==='manager'?['管理进阶分支尚未接入']:branchNeeds(s,['O0',...(target==='laborer'?[]:['O1'])]);
  if(op==='assign'){
    const job=target.slice(target.indexOf('-')+1);
    return [...branchNeeds(s,['O0']),...(job==='wheat'?[]:branchProcessNeeds(s,job,true))];
  }
  if(op==='foodplan')return branchNeeds(s,['O0']);
  if(op==='farmplan')return ['wheat','off'].includes(target)?branchNeeds(s,['O1']):['该种植分支尚未接入'];
  if(op==='productionplan')return [...branchNeeds(s,['O1']),...(target==='off'?[]:branchProcessNeeds(s,target.split('-')[0],true))];
  if(['supplyplan','salesplan','careplan','charter','paidtrain'].includes(op))return branchNeeds(s,['O2']);
  return ['该进阶内容尚未纳入三路线试点'];
}
export function recordBranchWork(s:GameState,events:GameEvent[]):void {
  const b=s.economy?.branches;if(!b)return;
  for(const e of [...events]){
    if(e.type==='economy-process'&&e.stage==='complete'&&e.actor==='本人'&&!b.protocols.includes(e.recipe)){
      b.protocols.push(e.recipe);events.push({type:'branch',operation:'protocol',node:e.recipe,detail:'真实试制完成，工艺规程可供雇员跨代接续'});
    }
    if(e.type==='economy-trade'&&e.operation==='sell'&&e.good==='shaft'&&!b.delivered.includes('shaft'))b.delivered.push('shaft');
  }
}
export function branchView(s:GameState){
  const b=s.economy!.branches!;
  return {nodes:BRANCH_NODES.map(n=>({...n,...(s.economy!.industry?{sample:{}}:{}),known:branchHas(s,n.id),inherited:ancestorKnows(s,n.id),heirInherited:ancestorKnows(s,n.id,s.household.heirId),heirKnown:s.household.heirId!==s.household.activePersonId&&branchHas(s,n.id,s.household.heirId),archived:b.archives.includes(n.id),missing:branchNeeds(s,n.parents)})),
    paths:BRANCH_PATHS.map(p=>({...p,learned:p.nodes.filter(id=>branchHas(s,id)).length})),
    channels:[...b.channels],protocols:[...b.protocols],delivered:[...b.delivered],products:BRANCH_PRODUCTS,processes:BRANCH_PROCESSES};
}
