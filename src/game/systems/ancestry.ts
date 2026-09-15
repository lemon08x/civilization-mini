import {nodeInEra} from '../model/branches.js';
import type {GameState} from '../model/state.js';
// Direct ancestors only; retained records survive retirement and death.
export function ancestorKnows(s:GameState,node:string,person=s.household.activePersonId):boolean {
 if(!s.life?.renewal||!nodeInEra(s,node))return false;
 const seen=new Set<string>();let current=person;
 while(!seen.has(current)){
  seen.add(current);const parent=Object.values(s.persons).find(p=>p.vitality?.childId===current);
  if(!parent)return false;
  if(s.economy?.branches?.learned[parent.id]?.includes(node))return true;
  current=parent.id;
 }
 return false;
}
