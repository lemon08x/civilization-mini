import type { ActionCost, GameAction } from './action.js';
import type { Clock, TrialSample, Weather } from './state.js';

export interface GenerationFacts {
  generation: number;
  food: number;
  money: number;
  mastered: string[];
  heir: string[];
  archives: string[];
  project: { started: number; control: { name: string; potential: number; tolerance: number }; candidate: { name: string; potential: number; tolerance: number }; samples: TrialSample[] } | null;
}
export type GameEvent =
  | { type: 'action-paid'; action: GameAction; cost: ActionCost }
  | { type: 'harvest'; food: number; drawn: number; deficit: number; channelExhausted: boolean }
  | { type: 'income'; source: 'work' | 'sale'; amount: number }
  | { type: 'food-purchased'; amount: number }
  | { type: 'channel-changed'; operation: 'build' | 'repair'; assetId: string; durability: number }
  | { type: 'studied'; personId: string; nodeId: string }
  | { type: 'practiced'; personId: string; nodeId: string; practiceId: string }
  | { type: 'mastered'; personId: string; role: 'active' | 'heir'; nodeId: string; clock: Clock }
  | { type: 'archived'; nodeId: string }
  | { type: 'taught'; personId: string; nodeId: string; kind: 'study' | 'practice' }
  | { type: 'candidate-prepared'; assetId: string }
  | { type: 'trial-started'; projectId: string }
  | { type: 'trial-sampled'; projectId: string; sample: TrialSample; count: number; target: number }
  | { type: 'trial-completed'; projectId: string }
  | { type: 'stock-selected'; decision: 'keep' | 'adopt'; assetId: string }
  | { type: 'season-settled'; consumed: number; missing: number; hardship: number }
  | { type: 'season-started'; clock: Clock; weather: Weather }
  | { type: 'generation-ended'; facts: GenerationFacts; final: boolean }
  | { type: 'handed-over'; generation: number; fromPersonId: string; personId: string; mastered: string[]; learning: Record<string, number> }
  | { type: 'experiment-ended'; reason: 'hardship' };
