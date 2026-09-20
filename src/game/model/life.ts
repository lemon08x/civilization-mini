export interface LifeRules {
  eventMoney: number; eventLearning: number; eventHealth: number;
  eventTalentPercent: number; eventPersonalityThreshold: number;
  timePerSeason: number;
  baseEnergy: number;
  recovery: number;
  restRecovery: number;
  careRecovery: number;
  hungerDamage: number;
  adultYears: number;
  birthYears: number;
  agingYears: number;
  lifespanMin: number;
  lifespanMax: number;
  growthConstitutionBonus: number;
}
export const LIFE_BOUNDS: Record<keyof LifeRules, readonly [number, number]> = {
  eventMoney:[1,20],eventLearning:[1,5],eventHealth:[1,15],eventTalentPercent:[1,20],eventPersonalityThreshold:[3,12],
  timePerSeason:[8,20],baseEnergy:[6,16],recovery:[1,6],restRecovery:[2,8],careRecovery:[2,12],
  hungerDamage:[5,30],adultYears:[16,20],birthYears:[24,36],agingYears:[45,65],lifespanMin:[66,80],lifespanMax:[81,100],
  growthConstitutionBonus:[1,6],
};
export type Talent = 'strong' | 'scholar' | 'mentor' | 'organizer' | 'resilient';
export interface Upbringing { fedSeasons: number; companySeasons: number; taughtSeasons: number }
export interface Vitality {
  experiences?: {
    learning: number; talents: Talent[]; outlook: number;
    actions: string[]; contacts: string[]; relationships: Record<string,number>;
    lastEvent: string;
  };
  character?: CharacterProfile;
  sex: 'male' | 'female';
  portrait: string;
  portraitEra: number;
  ageSeasons: number;
  lifespanSeasons: number;
  constitution: number;
  energy: number;
  health: number;
  minimumEnergy?: number;
  talent: Talent;
  alive: boolean;
  childId: string | null;
  upbringing?: Upbringing;
}

export interface CharacterProfile {
  style:string; temperament:string; background:string; attachment:string; aspiration:string;
  occupation:string; vocation:number; originEra:number; mood:string;
  memories:{key:string;age:number;text:string}[];
}


export interface SectRules {
  practiceTime:number; practiceEnergy:number; practiceGain:number; stageProgress:number; maxStage:number;
  doctrineMax:number; doctrineSteps:number; doctrineMoney:number; doctrineCourses:number;
  fortuneCap:number; fortunePerStage:number; drawCost:number; cardMax:number;
  crisisSupply:number; crisisFee:number; crisisPower:number; crisisScore:number;
  candidateAge:number; recruitMoney:number; modernSeasons:number;
  daoPercent:number; doctrinePercent:number; cardPercent:number; eventPercent:number;
}
export const SECT_BOUNDS:Record<keyof SectRules,readonly [number,number]>={
  practiceTime:[1,8],practiceEnergy:[1,6],practiceGain:[1,10],stageProgress:[4,40],maxStage:[2,10],
  doctrineMax:[1,8],doctrineSteps:[3,20],doctrineMoney:[1,50],doctrineCourses:[2,12],
  fortuneCap:[10,100],fortunePerStage:[1,10],drawCost:[2,20],cardMax:[1,5],
  crisisSupply:[2,12],crisisFee:[2,30],crisisPower:[1,8],crisisScore:[1,50],
  candidateAge:[10,16],recruitMoney:[0,10],modernSeasons:[80,400],
  daoPercent:[1,8],doctrinePercent:[1,4],cardPercent:[1,3],eventPercent:[1,10],
};
export type SectCard = 'study'|'craft'|'teach'|'prepare';
export interface DiscipleState {
  generation:number; masterId:string|null; discipleId:string|null; candidateId:string|null; admitted:boolean;
  practice:number; rewardedStage:number; time:number; consulted:string[]; consultPending?:string;
}
export interface SectState {
  rules:SectRules; current:[string,string]; members:Record<string,DiscipleState>;
  doctrine:number; research:number; improvements:{level:number;personId:string;courses:string[]}[];
  fortune:number; cards:Record<SectCard,number>; draws:number; lastDraw:string;
  seasonChance:number; seasonBonus:SectCard|null; nextBonus:SectCard|null; lastEvent:string;
}
