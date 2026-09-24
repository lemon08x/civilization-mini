export interface LifeRules {
  pressureThreshold:number; pressureTimePercent:number;
  eventMoney: number; eventLearning: number; eventHealth: number;
  eventTalentPercent: number; eventPersonalityThreshold: number;
  timePerSeason: number;
  /** Base constitution; legacy configuration name retained. */
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
  pressureThreshold:[0,100],pressureTimePercent:[0,10],
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
  pressure: number;
  health: number;
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
  dailyTime:number; upkeepGain:number; upkeepMax:number;
  practiceTime:number; practiceEnergy:number; practiceGain:number; stageProgress:number; maxStage:number;
  doctrineMax:number; doctrineSteps:number; doctrineMoney:number; doctrineCourses:number;
  fortuneCap:number; fortunePerStage:number; drawCost:number; cardMax:number;
  crisisSupply:number; crisisFee:number; crisisPower:number; crisisScore:number;
  candidateAge:number; recruitMoney:number; modernSeasons:number;
  daoPercent:number; doctrinePercent:number; cardPercent:number; eventPercent:number;
}
export const SECT_BOUNDS:Record<keyof SectRules,readonly [number,number]>={
  dailyTime:[1,4],upkeepGain:[1,30],upkeepMax:[1,60],
  practiceTime:[1,8],practiceEnergy:[1,6],practiceGain:[1,10],stageProgress:[4,40],maxStage:[2,10],
  doctrineMax:[1,8],doctrineSteps:[3,20],doctrineMoney:[1,50],doctrineCourses:[2,12],
  fortuneCap:[10,100],fortunePerStage:[1,10],drawCost:[2,20],cardMax:[1,5],
  crisisSupply:[2,12],crisisFee:[2,30],crisisPower:[1,8],crisisScore:[1,50],
  candidateAge:[10,16],recruitMoney:[0,10],modernSeasons:[80,400],
  daoPercent:[1,8],doctrinePercent:[1,4],cardPercent:[1,3],eventPercent:[1,10],
};
export type SectCard = 'study'|'craft'|'teach'|'prepare';
export type CultivationTrack = 'foundation'|'body'|'mind'|'reason'|'conduct'|'synthesis';
export const CULTIVATION_TRACKS:Record<CultivationTrack,{name:string;description:string}>={
  foundation:{name:'入门',description:'从安顿自己开始，认识门中修习的方法。'},
  body:{name:'养身',description:'调息、导引与身心协调。'},
  mind:{name:'养心',description:'明白取舍，练习安静与倾听。'},
  reason:{name:'明理',description:'温习旧知，寻找依据，分辨缘由。'},
  conduct:{name:'处世',description:'练习表达、回应与体察他人。'},
  synthesis:{name:'会通',description:'联系各支所学，形成自己的理解。'},
};
export interface CultivationCourse {
  id:string; name:string; track:CultivationTrack; tier:number; parents:string[];
  source:string; summary:string; exercise:string; effect:null;
}
// Names borrow classical ideas; prerequisites and exercises belong to this fictional school.
export const CULTIVATION_COURSES:CultivationCourse[]=[
  {id:'C0',name:'修身',track:'foundation',tier:1,parents:[],source:'《墨子·修身》',summary:'从自己的日常行为入手，令所学与所行相应。',exercise:'记下一日所做，找出一件可以认真改好的小事。',effect:null},
  {id:'C1',name:'调息',track:'body',tier:1,parents:['C0'],source:'古代养生与调息传统；课程为游戏化编排',summary:'觉察呼吸与身体的节奏，先求自然安稳。',exercise:'静坐片刻，观察呼吸，不追求奇异感受。',effect:null},
  {id:'C2',name:'导引',track:'body',tier:2,parents:['C1'],source:'《庄子·刻意》所述导引意象',summary:'在舒展与行动中体察身体的配合。',exercise:'在庭中舒展行步，留意动作是否从容连贯。',effect:null},
  {id:'C3',name:'抱一',track:'body',tier:3,parents:['C2'],source:'《老子》第十章',summary:'把分散的注意带回身心协调，不急于求成。',exercise:'将调息与行步连成一段完整功课。',effect:null},
  {id:'C4',name:'知止',track:'mind',tier:1,parents:['C0'],source:'《礼记·大学》“知止而后有定”',summary:'先明白要做什么，也明白何时应当停下。',exercise:'整理今日安排，辨别必须完成与可以暂缓的事。',effect:null},
  {id:'C5',name:'守静',track:'mind',tier:2,parents:['C4'],source:'《老子》第十六章“致虚极，守静笃”',summary:'给心绪留出安静之处，观察事物的往复。',exercise:'在院中静坐，察觉念头起落，不急着追随。',effect:null},
  {id:'C6',name:'心斋',track:'mind',tier:3,parents:['C5'],source:'《庄子·人间世》',summary:'暂放成见，以更开阔的心境接纳眼前之事。',exercise:'听完同门的一段见闻，再尝试复述他的意思。',effect:null},
  {id:'C7',name:'温故',track:'reason',tier:1,parents:['C0'],source:'《论语·为政》“温故而知新”',summary:'回看旧经验，寻找当时没有留意的联系。',exercise:'重读一页旧札记，补上一条今日的新认识。',effect:null},
  {id:'C8',name:'三表',track:'reason',tier:2,parents:['C7'],source:'《墨子·非命上》三表之法',summary:'从依据、见闻与施用结果等方面审视判断。',exercise:'把一种耕作说法的来处、观察与实际结果分开记下。',effect:null},
  {id:'C9',name:'明故',track:'reason',tier:3,parents:['C8'],source:'《墨子·小取》“以说出故”等辨析思想；课程名为概括',summary:'分辨理由与结论，尝试说明一件事为何如此。',exercise:'与同门比较两次不同的结果，逐项辨认原因。',effect:null},
  {id:'C10',name:'捭阖',track:'conduct',tier:1,parents:['C0'],source:'《鬼谷子·捭阖》',summary:'体会表达与收敛的时机，让交谈有来有往。',exercise:'先把自己的意思说清，再留出听人说话的余地。',effect:null},
  {id:'C11',name:'反应',track:'conduct',tier:2,parents:['C10'],source:'《鬼谷子·反应》；此处取反复听察、相互回应之意',summary:'通过倾听与回应辨认话语中的真实意思。',exercise:'用一个问题核对理解，避免只听到自己预想的答案。',effect:null},
  {id:'C12',name:'揣情',track:'conduct',tier:3,parents:['C11'],source:'《鬼谷子·揣篇》',summary:'体察他人的处境与牵挂，避免只凭自己的立场判断。',exercise:'从同门的处境重新讲述一次分歧，寻找彼此能接受的办法。',effect:null},
  {id:'C13',name:'知常',track:'synthesis',tier:4,parents:['C3','C6'],source:'《老子》第十六章“知常曰明”',summary:'联系养身与养心，认识生活中可长期持守的节律。',exercise:'回看四时功课，整理适合自己长期坚持的办法。',effect:null},
  {id:'C14',name:'成己成物',track:'synthesis',tier:4,parents:['C9','C12'],source:'《礼记·中庸》',summary:'把自身所学与对他人、事物的理解联系起来。',exercise:'将自己的经验讲给弟子，并听取他实践后的反馈。',effect:null},
  {id:'C15',name:'道法自然',track:'synthesis',tier:5,parents:['C13','C14'],source:'《老子》第二十五章',summary:'会通各支所学，观察条件与节律，形成从容的行事方法。',exercise:'整理一卷自己的修习札记，写明适用的条件与尚未明白之处。',effect:null},
];
export interface CultivationState { progress:Record<string,number>; upkeep:number }
export interface DiscipleState {
  generation:number; masterId:string|null; discipleId:string|null; candidateId:string|null; admitted:boolean;
  practice:number; rewardedStage:number; time:number; consulted:string[]; consultPending?:string;
  cultivation:CultivationState;
}
export interface SectState {
  curriculumVersion:1;
  rules:SectRules; current:[string,string]; members:Record<string,DiscipleState>;
  doctrine:number; research:number; improvements:{level:number;personId:string;courses:string[]}[];
  fortune:number; cards:Record<SectCard,number>; draws:number; lastDraw:string;
  seasonChance:number; seasonBonus:SectCard|null; nextBonus:SectCard|null; lastEvent:string;
}

export interface CalendarRules {
  businessCycleDays:number; waterRetentionDays:number;
  weatherDays:number; termGoodPercent:number; termGoods:number; termEnergy:number;
  referenceYear:number; daysPerWeek:number; actionDaysPerUnit:number; studyDaysPerUnit:number;
  grainPerDay:number; woodPerDay:number; heartyMultiplier:number;
  /** Legacy ordinary sleep recovery; no longer applied to pressure. */
  dailyRecovery:number; heartyRecovery:number; mealRecovery:number; hungerDamagePerDay:number;
  harvestGraceDays:number; workChunkDays:number; lampEnergyPercent:number;
}
export const CALENDAR_BOUNDS:Record<keyof CalendarRules,readonly [number,number]>={
  businessCycleDays:[90,90],waterRetentionDays:[90,90],
  weatherDays:[3,14],termGoodPercent:[40,90],termGoods:[1,3],termEnergy:[1,6],
  lampEnergyPercent:[50,100],referenceYear:[1900,2300],daysPerWeek:[7,7],actionDaysPerUnit:[0.5,1],studyDaysPerUnit:[1,14],
  grainPerDay:[0.01,1],woodPerDay:[0.001,0.1],heartyMultiplier:[1,2],dailyRecovery:[0,4],
  heartyRecovery:[0,2],mealRecovery:[0,2],hungerDamagePerDay:[0.1,5],harvestGraceDays:[1,28],workChunkDays:[1,14],
};
export interface CalendarState {
  continuousVersion:1; nextBusinessDay:number;
  rules:CalendarRules; absoluteDay:number; seasonStarted:number; seasonLength:number; day:number; diet:'simple'|'hearty'; mealDays:number;
  consumed:number; missing:number; purchaseSpent:number; systemsSettled:boolean; study:Record<string,{done:number;total:number}>;
  weatherNextDay:number; lastTermDay:number; termEvents:{day:number;date:string;term:string;title:string;text:string;effect:string;positive:boolean}[];
  lastNotice:string;
}
