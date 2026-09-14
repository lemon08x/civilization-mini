export interface SocialFoodRules { storage:number; imports:number; serviceCapacity:number; pickupTime:number; defaultBudget:number; defaultReserve:number; }
export type FoodPolicy='off'|'self'|'market'|'reserve';
export interface SocialFoodState {
 rules:SocialFoodRules; foodPerSeason:number; price:number;
 policy:FoodPolicy; budget:number; reserve:number; delivery:boolean;
 serviceRemaining:number;
}
