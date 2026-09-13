export interface ShopRules {
  transport: number; stock: number; deviceFee: number; importFee: number;
  textbookBase: number; lessonBase: number; trainingPrice: number; trainingExperience: number;
  granaryPrice: number; granaryCapacity: number; libraryPrice: number; repairPercent: number;
}
export interface ShopOrder { kind:'goods'|'device'|'repair'|'training'|'book'|'asset'; target:string; amount:number; due:number; name:string }
export interface ShopState {
  cart: Record<string,number>; stock:Record<string,number>; transport:number;
  orders:ShopOrder[]; books:string[]; assets:string[]; produced:Record<string,number>; seededTurn:number;
}

export const SHOP_BOUNDS:Record<keyof ShopRules,[number,number]>={
 transport:[4,24],stock:[2,20],deviceFee:[2,12],importFee:[1,12],
 textbookBase:[1,8],lessonBase:[1,8],trainingPrice:[2,12],trainingExperience:[1,3],
 granaryPrice:[20,80],granaryCapacity:[16,60],libraryPrice:[20,80],repairPercent:[20,80]
};
