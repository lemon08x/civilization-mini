import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { SUBJECTS } from '../model/economy.js';
import { amount,equipped,consumeEquipment,changeGoods,level,organizationLevel } from './economy.js';
import { ALL_PRODUCTS } from './economy-catalog.js';

export function initializeModern(s:GameState):void {
 const e=s.economy!;
 e.modern={power:0,stored:0,enabled:[],operated:{},services:{},cropBonus:0};
 // 新场景是已有早期工业基础的家业，不把现代工艺免费赋给人物。
 const foundation=Object.fromEntries(SUBJECTS.map(k=>[k,6]));
 e.knowledge[s.household.activePersonId]={...foundation};e.knowledge[s.household.heirId]={...foundation};e.notes={...foundation};
 e.goods={...e.goods,wood:8,iron:6,ceramics:4,brick:4,fiber:4,shaft:2,seal:2,solution:2};
 e.equipment={F02:12,T03:12,F05:12,U06:12,S02:12};
 s.world.era='从电气化到数字协同';
}
export function modernEvent(events:GameEvent[],target:string,detail:string,amount=0):void {events.push({type:'operations',operation:'modern',target,detail,amount,money:0});}
export function usePower(s:GameState,n:number,events:GameEvent[],source:string):void {
 const m=s.economy!.modern;if(!m||m.power<n)throw new Error('可用电力不足');
 m.power-=n;modernEvent(events,source,`${source}消耗${n}电，余${m.power}电`,n);
}
export function modernOnline(s:GameState,id:string):boolean{return s.economy?.modern?.services[id]===s.clock.absoluteTurn;}
export function resetModern(s:GameState,events:GameEvent[]):void {
 const m=s.economy?.modern;if(!m)return;
 if(m.power)modernEvent(events,'expired',`未储存的${m.power}电随季结束耗散`,m.power);
 m.power=0;
}
export const GENERATORS=['E01','E02','E03'];
export const SERVICES=['N08','N10','S08','U08M','U09M'];
export function generateModern(s:GameState,events:GameEvent[]):void {
 const m=s.economy?.modern;if(!m||s.economy!.operations?.paused)return;
 for(const id of GENERATORS){
  if(!m.enabled.includes(id)||m.operated[id]===s.clock.absoluteTurn||!equipped(s,id))continue;
  if(id==='E01'&&s.location.water<1||id==='E02'&&amount(s,'fuel')<1){modernEvent(events,id,'发电待命：缺水或精炼燃料');continue;}
  let output=id==='E03'?(s.location.weather==='wet'?2:4):6;
  if(id==='E01')s.location.water--;
  if(id==='E02'){
   changeGoods(s,{fuel:1},-1,events,'燃料发电');
   if(equipped(s,'H09')){output+=2;consumeEquipment(s,'H09',events);}
  }
  consumeEquipment(s,id,events);s.economy!.equipmentUsed[id]=s.clock.absoluteTurn;m.operated[id]=s.clock.absoluteTurn;m.power+=output;
  modernEvent(events,id,`${ALL_PRODUCTS.find(p=>p.id===id)!.name}实际发出${output}电`,output);
 }
 if(m.enabled.includes('E04')&&m.stored&&equipped(s,'E04')&&m.operated.E04!==s.clock.absoluteTurn){
  const n=m.stored;m.stored=0;m.power+=n;m.operated.E04=s.clock.absoluteTurn;modernEvent(events,'E04',`储能放出${n}电`,n);
 }
}
export function serveModern(s:GameState,events:GameEvent[]):void {
 const m=s.economy?.modern;if(!m||s.economy!.operations?.paused)return;
 for(const id of SERVICES){
  if(!m.enabled.includes(id)||modernOnline(s,id)||!equipped(s,id))continue;
  if(id==='N10'&&(!modernOnline(s,'N08')||organizationLevel(s)<10||level(s,'mechanics')<10))continue;
  if(id==='U09M'&&level(s,'agronomy')<9)continue;
  if(m.power<1){modernEvent(events,id,'服务待命：电力不足');continue;}
  usePower(s,1,events,id);consumeEquipment(s,id,events);s.economy!.equipmentUsed[id]=s.clock.absoluteTurn;m.services[id]=s.clock.absoluteTurn;
  if(id==='U09M'&&s.economy!.field.crop)m.cropBonus=Math.max(m.cropBonus,2);
  modernEvent(events,id,'当季服务在线');
 }
}
export function storeModern(s:GameState,events:GameEvent[]):void {
 const m=s.economy?.modern;if(!m||!m.enabled.includes('E04')||!equipped(s,'E04')||s.economy!.operations?.paused)return;
 const n=Math.min(6-m.stored,m.power);if(n<=0)return;
 usePower(s,n,events,'储能充电');m.stored+=n;consumeEquipment(s,'E04',events);s.economy!.equipmentUsed.E04=s.clock.absoluteTurn;
}
