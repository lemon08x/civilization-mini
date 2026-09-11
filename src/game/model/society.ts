export type CraftMaterial = 'woodenware' | 'pottery';
export interface SocietyState {
  teaching: Record<string, number>;
  methods: string[];
  goods: Record<CraftMaterial, number>;
  contracts: Record<CraftMaterial, { active: boolean; project: { started: number; remaining: number } | null }>;
}
