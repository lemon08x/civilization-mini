import { sectSuccessors, selectSectPerson } from './life.js';
import { handoverOperations } from './operations.js';
import { blankPerson, heir } from '../model/state.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import { newSeason } from './time.js';
import { advanceEra, eraEvent } from './eras.js';
import { SUBJECTS } from '../model/economy.js';
import { level } from './knowledge.js';

export function handover(state: GameState, rules: Ruleset, events: GameEvent[]): void {
  if(state.sect){
    const ids=sectSuccessors(state);if(ids.length!==2)throw new Error('下一代两位弟子须均成年且在世');
    const from=state.household.activePersonId;state.sect.current=[ids[0],ids[1]];selectSectPerson(state,ids[0]);
    state.clock.generation++;state.clock.turn=1;state.clock.absoluteTurn++;state.status='active';
    delete state.life!.pendingRetirement;handoverOperations(state,events);
    if(state.economy?.industry)for(const i of Object.values(state.economy.industry.instances))if(i?.operator==='self')i.enabled=false;
    events.push({type:'handed-over',generation:state.clock.generation,fromPersonId:from,personId:ids[0],mastered:[...(state.economy!.branches!.learned[ids[0]]??[])],learning:{}});
    if(state.era&&state.era.index<3&&state.clock.generation-state.era.startGeneration>=state.era.rules.generationLimit)advanceEra(state,events,'完成整代师徒交接，本时代驻留代数已满');
    newSeason(state,rules,events);return;
  }
  // The last handover of an era starts an unrelated household, not the old heir.
  if(state.era&&state.era.index<3&&state.clock.generation+1-state.era.startGeneration>=state.era.rules.generationLimit){
    advanceEra(state,events,'本时代代际预算用尽，结束本时代家族');
    state.clock.turn=1;state.clock.absoluteTurn++;
    newSeason(state,rules,events);return;
  }
  const child = heir(state), fromPersonId = state.household.activePersonId;
  if(state.economy?.lineage){
    for(const subject of SUBJECTS){
      const n=level(state,subject,fromPersonId);
      if(n>(state.economy.notes[subject]??0)){state.economy.notes[subject]=n;events.push({type:'economy-knowledge',operation:'archive',subject,level:n});}
    }
    for(const subject of SUBJECTS){
      const documented=state.economy.notes[subject]??0,current=level(state,subject,child.id);
      if(documented>current){(state.economy.knowledge[child.id]??={})[subject]=documented;events.push({type:'economy-learned',subject,level:documented,personId:child.id,source:'lineage'});}
    }
    if(state.economy.expeditions)state.economy.expeditions.generationProofs=[];
  }
  state.household.activePersonId = child.id;
  if(!state.life)child.name = '本代经营者';
  state.clock.generation++; state.clock.turn = 1; state.clock.absoluteTurn++;
  if(state.era&&state.era.index<3){
    if(state.era.index<3&&state.clock.generation-state.era.startGeneration===state.era.rules.generationLimit-1)eraEvent(state,events,'warning','这是本时代能住的最后一代，下一代将强制结算并进入新社会。');
  }
  if(state.life){
    if(!child.vitality?.alive||child.vitality.ageSeasons<state.life.rules.adultYears*4)throw new Error('没有成年继任者');
    state.household.heirId=child.vitality.childId??child.id;
    delete state.life.pendingRetirement;
    delete state.life.consultPending;delete state.life.seasonCompany;delete state.life.seasonTaught;state.life.consulted=[];
  }else{
  const id = `person:${state.clock.generation + 1}`;
  state.persons[id] = blankPerson(id, '已成年的后辈');
  state.household.memberIds.push(id); state.household.heirId = id;
  }
  if(state.economy&&!state.economy.operations?.charter&&(state.economy.notes.organization??0)<3)for(const w of Object.values(state.economy.workers))if(w)w.active=false;
  state.status = 'active';
  events.push({ type: 'handed-over', generation: state.clock.generation, fromPersonId, personId: child.id, mastered: [...(state.economy?.branches?.learned[child.id]??child.mastered)], learning: { ...child.learning } });
  handoverOperations(state,events);
  if(state.economy?.industry){state.economy.operations!.paused=false;for(const i of Object.values(state.economy.industry.instances))if(i&&i.operator==='self')i.enabled=false;}
  newSeason(state, rules, events);
}
