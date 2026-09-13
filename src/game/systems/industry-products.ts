import {INDUSTRY_PRODUCTS} from '../model/industry.js';
import {BRANCH_NODES} from '../model/branches.js';
import {changeGoods,consumeEquipment} from './economy.js';
import {ALL_PRODUCTS,ALL_PROCESSES} from './economy-catalog.js';
import type {GameState} from '../model/state.js';
import type {GameEvent} from '../model/events.js';

export function productName(id:string):string{return ALL_PRODUCTS.find(p=>p.id===id)?.name??ALL_PROCESSES.find(p=>p.id===id)?.name??id;}
export function knowledgeNeeds(s:GameState,ids:string[]):string[]{return ids.filter(id=>!s.economy!.branches!.learned[s.household.activePersonId]?.includes(id)).map(id=>'需掌握'+(BRANCH_NODES.find(n=>n.id===id)?.name??id));}
export function productNeeds(s:GameState,id:string,inspection=false):string[]{
 const state=s.economy?.industry;if(!state)return [];
 const p=INDUSTRY_PRODUCTS.find(p=>p.id===id);if(!p)return ['产品尚未纳入三类树'];
 if(!inspection&&state.products[id]?.protocol)return [];
 return [...knowledgeNeeds(s,p.knowledge),...p.parents.filter(id=>!state.products[id]).map(id=>'需验证前置产品：'+productName(id))];
}
export function productTrialNeeds(s:GameState,id:string):string[]{
 if(!s.economy?.industry||s.economy.industry.products[id]?.protocol)return [];
 return [...(['W03','E01'].includes(id)&&s.location.water<1?['首次试制需1公共水试运行']:[]),...(id==='W03'&&(s.economy.goods.wood??0)<1?['首次试抽需1木材耗材']:[])];
}
export function recordProducts(s:GameState,events:GameEvent[]):void{
 const state=s.economy?.industry;if(!state)return;
 for(const event of [...events]){
  const id=event.type==='economy-built'?event.product:event.type==='economy-process'&&event.stage==='complete'&&event.actor==='本人'?event.recipe:null;
  if(!id||!INDUSTRY_PRODUCTS.some(p=>p.id===id)||state.products[id]?.protocol)continue;
  if(['W03','E01'].includes(id)){s.location.water--;consumeEquipment(s,id,events);s.economy!.equipmentUsed[id]=s.clock.absoluteTurn;}
  if(id==='W03')changeGoods(s,{wood:1},-1,events,'首次试抽耗材');
  state.products[id]={source:'prototype',protocol:true};
  events.push({type:'industry',operation:'validated',target:id,actor:'self',time:0,energy:0,money:0,detail:productName(id)+'试制完成，产品验证与制造规程保留'});
 }
}
