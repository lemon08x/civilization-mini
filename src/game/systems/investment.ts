import {branchNodesFor,nodeInEra,BRANCH_NODES} from '../model/branches.js';
import { TOWER_FLOORS } from './tower.js';
import { topicsFor } from './economy-catalog.js';
import { level } from './knowledge.js';
import type { GameState } from '../model/state.js';
import type { GameEvent } from '../model/events.js';
import { DUNGEON_TASKS } from '../model/eras.js';
import type { Ruleset } from '../ruleset.js';
import { DEVICES } from '../model/product-network.js';
import type { Device } from '../model/product-network.js';

export const PASSIVE_EFFECTS: Record<Device,string> = {
  calibrator:'安装时及季末自动校准：1研究记录 + 1补给 → 1校准报告，可出售或制造设备。',
  pump:'安装时及季末自动提水：1木材 + 1公共水 → 1家用蓄水（容量2），供缺水耕作。',
  kiln:'安装时及季末自动回收：2用后陶料 + 1木材 → 1陶质构件，减少外购或采料。',
};
// 每台设备每季最多成功运行一次；缺料、满仓不空耗耐用度。
export function operatePassive(s:GameState,rules:Ruleset,events:GameEvent[],only?:Device):void {
  if(!rules.passiveInvestment||!s.productNetwork||!s.development||!s.production)return;
  const n=s.productNetwork,d=s.development,inventory=s.production.inventory;
  for(const device of only?[only]:DEVICES){
    if(n.installed[device]<1||n.lastPassiveTurn?.[device]===s.clock.absoluteTurn)continue;
    if(device==='calibrator'){
      if(d.goods.findings<1||d.goods.supplies<1)continue;
      d.goods.findings--;d.goods.supplies--;n.goods.calibrations++;
    }else if(device==='pump'){
      if(inventory.wood<1||s.location.water<1||n.storedWater>=2)continue;
      inventory.wood--;s.location.water--;n.storedWater++;
    }else{
      if(inventory.wood<1||n.goods.spentCeramics<2)continue;
      inventory.wood--;n.goods.spentCeramics-=2;d.goods.ceramicParts++;
    }
    n.lastPassiveTurn??={};n.lastPassiveTurn[device]=s.clock.absoluteTurn;n.installed[device]--;
    events.push({type:'product-operated',device,remaining:n.installed[device],result:1});
  }
}

export function technologyVictory(s:GameState,rules:Ruleset){
  if(!rules.passiveInvestment)return undefined;
  if(s.era){const mastered=branchNodesFor(s).filter(n=>nodeInEra(s,n.id)&&Object.values(s.economy!.branches!.learned).some(ids=>ids.includes(n.id))).map(n=>n.id);const weights:Record<string,number>=Object.fromEntries(DUNGEON_TASKS.map(t=>[t.id,t.progress]));if(s.electric){weights.power=s.electric.rules.powerProgress;weights.appliance=s.electric.rules.applianceProgress;}const score=s.era.dungeon.tasks.reduce((a,id)=>a+(weights[id]??0),0),target=s.era.rules.dungeonTarget;const complete=(!s.electric||!!s.era.dungeon.powered)&&score>=target;return {mastered,total:branchNodesFor(s).length,required:0,achievements:complete?['final-family-trial']:[],requiredAchievements:1,percent:Math.floor(score/target*100),targetPercent:100,achieved:s.era.closed&&complete,won:s.status==='complete'&&complete};}
  if(s.economy?.branches){const mastered=[...new Set(Object.values(s.economy.branches.learned).flat())];return {mastered,total:BRANCH_NODES.length,required:BRANCH_NODES.length,achievements:[],requiredAchievements:0,percent:Math.floor(mastered.length*100/BRANCH_NODES.length),targetPercent:100,achieved:false,won:false};}
  if(s.economy){const mastered=topicsFor(s).filter(t=>s.household.memberIds.some(id=>level(s,t.subject,id)>=t.level)).map(t=>t.id);const total=topicsFor(s).length,required=Math.ceil(total*rules.passiveInvestment.victoryPercent/100);const achievements=Object.entries(s.economy.operations?.projects??{}).filter(([,p])=>p?.stage==='complete').map(([id])=>id),requiredAchievements=rules.operations?.requiredAchievements??0;const achieved=rules.civilization?false:rules.tower?(s.economy.tower?.floor??0)>=TOWER_FLOORS.length:mastered.length>=required&&achievements.length>=requiredAchievements;return {mastered,total,required,achievements,requiredAchievements,percent:Math.floor(mastered.length*100/total),targetPercent:rules.passiveInvestment.victoryPercent,achieved,won:s.status==='complete'&&achieved};}
  const known=new Set(s.household.memberIds.flatMap(id=>s.persons[id].mastered));
  const mastered=rules.technologies.filter(t=>known.has(t.id)).map(t=>t.id);
  const total=rules.technologies.length,required=Math.ceil(total*rules.passiveInvestment.victoryPercent/100);
  return {mastered,total,required,percent:Math.floor(mastered.length*100/total),targetPercent:rules.passiveInvestment.victoryPercent,achieved:mastered.length>=required,won:s.status==='complete'&&mastered.length>=required};
}
