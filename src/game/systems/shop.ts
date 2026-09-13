import {branchHas,BRANCH_PRODUCTS} from './branches.js';
import { topicsFor,productsFor } from './economy-catalog.js';
import type { GameState } from '../model/state.js';
import type { Ruleset } from '../ruleset.js';
import type { GameEvent } from '../model/events.js';
import type { ShopOrder,ShopState } from '../model/shop.js';
import type { Subject } from '../model/economy.js';
import { ALL_GOODS as GOODS,ALL_PRODUCTS as PRODUCTS,ALL_PROCESSES as PROCESSES,SUBJECT_NAMES } from './economy-catalog.js';

export const SHOP_GOODS=['food','wheat','flour','soy','seedWheat','seedSoy','seedFlax','compost','wood','clay','ore','iron','flax','straw','fiber','oil','ceramics','brick','seal','shaft','valve'];
const BASIC=['food','wheat','flour','soy','seedWheat','seedSoy','seedFlax','wood','clay','ore','flax','straw'];
export function salePrice(s:GameState,id:string):number{return s.economy?.shop&&id==='flour'?1:GOODS[id].price;}
export function shopEvent(events:GameEvent[],operation:string,target:string,detail:string,money=0,amount=1){events.push({type:'shop',operation,target,detail,money,amount});}
export function made(s:GameState,id:string):void{const sh=s.economy?.shop;if(sh)sh.produced[id]=Math.min(3,(sh.produced[id]??0)+1);}
export function localNeeds(s:GameState,needs:Partial<Record<Subject,number>>):boolean{return Object.entries(needs).every(([d,n])=>(s.economy!.regional.teaching[d as Subject]??0)>=n);}
export function deviceBusy(s:GameState,id:string):boolean{const e=s.economy!;return [e.project,...Object.values(e.workers).map(w=>w?.project)].some(p=>p&&PROCESSES.find(x=>x.id===p.good)?.equipment===id);}
export function servicePending(s:GameState,kind:ShopOrder['kind'],id:string):boolean{return !!s.economy?.shop?.orders.some(o=>o.kind===kind&&o.target===id);}
export function deviceReserved(s:GameState,id:string):boolean{return deviceBusy(s,id)||servicePending(s,'device',id)||servicePending(s,'repair',id);}
export function deviceBasePrice(r:Ruleset,id:string):number{const p=PRODUCTS.find(p=>p.id===id)!;return Object.entries(p.inputs).reduce((n,[g,q])=>n+(GOODS[g].price+1)*q,0)+r.shop!.deviceFee;}
export function repairPrice(s:GameState,r:Ruleset,id:string):number{return Math.max(1,Math.ceil(deviceBasePrice(r,id)*r.shop!.repairPercent/100*(r.economy!.durability-(s.economy!.equipment[id]??0))/r.economy!.durability));}
const uses:Record<string,string>={food:'即食生活补给；与市场购粮共用库存',wheat:'1份生活口粮，或磨成面粉',flour:'1份生活口粮；按与小麦相同的食用份额定价',soy:'1份口粮或榨油原料',seedWheat:'播种小麦；需农学1阶',seedSoy:'播种大豆；需农学2阶',seedFlax:'播种亚麻；需农学2阶',compost:'恢复田地肥力；施用需农学3阶',wood:'设备、部件与燃料',clay:'建窑、烧陶和烧砖',ore:'冶炼铁料；需冶炼炉与工艺',iron:'直接进入工具和机械部件配方',flax:'加工纤维的农业原料，不能食用',straw:'腐熟堆肥原料',fiber:'密封件与绳索原料',oil:'密封件原料，当前不作为食品',ceramics:'容器、磨粮及其他设备的构件',brick:'高温炉和耐热容器的材料',seal:'泵、阀门和密闭容器的部件',shaft:'动力、播种与脱粒设备的部件',valve:'活塞泵部件'};
export interface ShopItem {id:string;target:string;kind:ShopOrder['kind'];name:string;category:string;price:number;weight:number;local:boolean;effect:string;condition:string;owned:boolean;stock:number;}
export function shopCatalog(s:GameState,r:Ruleset):ShopItem[]{
 const e=s.economy!,sh=e.shop!,cfg=r.shop!;
 const item=(x:Omit<ShopItem,'stock'>):ShopItem=>({...x,stock:x.id==='good-food'?s.production!.market.food:sh.stock[x.id]??0});
 const goods=[...SHOP_GOODS,...(e.modern?['copper','feedstock','mineral','silica','polymer','wire','coil','cable','fuel','nutrient','battery','silicon','circuit','solution']:[])].map(id=>{
   const recipe=PROCESSES.find(p=>Object.hasOwn(p.outputs,id));
   const local=(BASIC.includes(id)||e.modern&&['copper','feedstock','mineral','silica'].includes(id))||!!recipe&&(sh.produced[id]??0)>=3&&localNeeds(s,recipe.requires);
   const base=id==='food'?r.parameters.foodPrice:salePrice(s,id)+1;
   return item({id:'good-'+id,target:id,kind:'goods',name:id==='food'?'即食口粮':GOODS[id].name,category:'物资',price:base+(local?0:1),weight:1,local,effect:uses[id]??'现代制造与工程物资，库存、采购运输和到货时间照常结算',condition:BASIC.includes(id)?'开局本地供应':`本地化：实际完成3批${GOODS[id].name}，并传播${Object.entries(recipe?.requires??{}).map(([d,n])=>SUBJECT_NAMES[d as Subject]+n+'阶').join('、')}；目前${sh.produced[id]??0}/3批`,owned:false});
 });
 const devices=productsFor(s).filter(p=>!['F04','F05'].includes(p.id)&&(!e.modern||!['N10','F10','E03'].includes(p.id))).map(p=>{
   const local=['W01','S01','T01','U01','F02'].includes(p.id)||(sh.produced[p.id]??0)>0&&localNeeds(s,p.requires);
   return item({id:'device-'+p.id,target:p.id,kind:'device',name:p.name,category:'设备',price:deviceBasePrice(r,p.id)+(local?0:cfg.importFee),weight:4,local,effect:p.id==='U02'?'每季一次本人播种免行动，仍扣种子和耐用度；雇工工资不减免':p.effect,condition:`购买无需制造学科；专业加工仍需本人工艺或雇工。${local?'本地现货':'本地化需自行制造一次并传播全部制造学科'}`,owned:(e.equipment[p.id]??0)>0||deviceReserved(s,p.id)});
 });
 const books=topicsFor(s).filter(t=>t.level>1).map(t=>item({id:'book-'+t.id,target:t.id,kind:'book',name:t.name+'教材',category:'学习与服务',price:cfg.textbookBase+t.level*2,weight:1,local:t.level<=2||(e.regional.teaching[t.subject]??0)>=t.level,effect:'永久家庭学习来源，后辈可用；仍需按顺序学习，不直接增加知识',condition:`本地供书与授课：基础2阶，或地区传播${SUBJECT_NAMES[t.subject]}${t.level}阶`,owned:sh.books.includes(t.id)||servicePending(s,'book',t.id)}));
 const assets=[item({id:'asset-granary',target:'granary',kind:'asset',name:'家庭粮仓',category:'家庭资产',price:cfg.granaryPrice,weight:4,local:false,effect:`食品保护容量提高至${cfg.granaryCapacity}，与容器取较大值，永久跨代保留`,condition:'交付时建成，无学科要求，限一座',owned:sh.assets.includes('granary')||servicePending(s,'asset','granary')}),item({id:'asset-library',target:'library',kind:'asset',name:'家学书室',category:'家庭资产',price:cfg.libraryPrice,weight:4,local:false,effect:'留存新的学科记录时，同时教导后辈该学科下一课题；上限为本人水平，永久保留',condition:'交付时建成，不自动继承等级，限一间',owned:sh.assets.includes('library')||servicePending(s,'asset','library')})];
 const available=[...goods,...devices,...books,...assets];
 if(e.branches){
   const channels=e.branches.channels,baseGoods=['food','wheat','flour','wood','clay','iron','fiber','oil','ceramics','seal','shaft','valve','seedWheat'];
   const electrical=['copper','polymer','wire','coil','cable'];
   return available.filter(x=>x.kind==='goods'?(baseGoods.includes(x.target)||channels.includes('electric')&&electrical.includes(x.target)):x.kind==='device'?!!BRANCH_PRODUCTS[x.target]&&(x.target!=='E01'||channels.includes('electric')&&branchHas(s,'L6')):x.kind==='asset'&&x.target==='granary').map(x=>{
     if(x.kind!=='goods')return {...x,condition:'整机外购不赠送个人知识；运行和加工仍检查能力、材料与能源'};
     const metal=x.target==='iron',stable=channels.includes('metal');
     return {...x,effect:x.target==='seedWheat'?'播种小麦；需基础栽培':x.effect,price:metal?(stable?GOODS.iron.price+1:GOODS.iron.price+2):x.price,
       stock:metal?Math.min(x.stock,stable?r.branches!.metalStock:r.branches!.basicIronStock):x.stock,
       condition:electrical.includes(x.target)?'电工材料渠道；按单采购，下季补充货源':metal?(stable?'稳定金属供货，仍需付款与运输':'基础原料商少量铁料；交付传动轴后可签稳定供货'):'基础材料与半成品供应，按价采购，不要求副本等级'};
   });
 }
 if(!e.expeditions)return available;
 const frontier=e.expeditions.supplyLevel;
 return available.filter(x=>{
   if(x.kind==='device')return Math.max(...Object.values(PRODUCTS.find(p=>p.id===x.target)!.requires))<=frontier;
   if(x.kind==='book')return topicsFor(s).find(t=>t.id===x.target)!.level<=frontier+1;
   if(x.kind==='goods'){
     if(['copper','feedstock','mineral','silica'].includes(x.target))return frontier>=6;
     if(x.target==='solution')return frontier>=3;
     const recipe=PROCESSES.find(p=>Object.hasOwn(p.outputs,x.target));
     return !recipe||Math.max(...Object.values(recipe.requires))<=frontier;
   }
   return true;
 });
}
export function initialShop():ShopState{return {cart:{},stock:{},transport:0,orders:[],books:[],assets:[],produced:{},seededTurn:0};}
export function deliverShop(s:GameState,r:Ruleset,o:ShopOrder,events:GameEvent[]):void{
 const e=s.economy!,sh=e.shop!;
 if(o.kind==='goods'){
   if(o.target==='food')s.household.food+=o.amount;
   else e.goods[o.target]=(e.goods[o.target]??0)+o.amount;
 }else if(o.kind==='device'||o.kind==='repair')e.equipment[o.target]=r.economy!.durability;
 else if(o.kind==='book')sh.books.push(o.target);
 else if(o.kind==='asset'){sh.assets.push(o.target);if(o.target==='granary')e.shopGranaryCapacity=r.shop!.granaryCapacity;}
 else {const w=e.workers[o.target as keyof typeof e.workers]!;w.experience=Math.min(8,w.experience+r.shop!.trainingExperience);}
 shopEvent(events,'delivered',o.target,o.name+'已完成交付'+(['device','asset'].includes(o.kind)?'并安装':'')+(o.kind==='training'?'，经验已提升':''),0,o.amount);
}
export function renewShop(s:GameState,r:Ruleset,events:GameEvent[]):void{
 const sh=s.economy?.shop;if(!sh)return;
 const ready=sh.orders.filter(o=>o.due<=s.clock.absoluteTurn);sh.orders=sh.orders.filter(o=>o.due>s.clock.absoluteTurn);
 for(const o of ready)deliverShop(s,r,o,events);
 sh.transport=r.shop!.transport;
 for(const x of shopCatalog(s,r))sh.stock[x.id]=s.economy?.branches&&x.target==='iron'?(s.economy.branches.channels.includes('metal')?r.branches!.metalStock:r.branches!.basicIronStock):x.kind==='goods'?r.shop!.stock:1;
}
export function cartQuote(s:GameState,r:Ruleset){
 const sh=s.economy!.shop!,catalog=shopCatalog(s,r);const unavailable=Object.keys(sh.cart).filter(id=>!catalog.some(x=>x.id===id));const lines=Object.entries(sh.cart).filter(([id])=>!unavailable.includes(id)).map(([id,quantity])=>({item:catalog.find(x=>x.id===id)!,quantity}));
 const final=!r.civilization&&s.clock.generation>=r.parameters.generations&&s.clock.turn>=r.parameters.turnsPerGeneration;
 const total=lines.reduce((n,l)=>n+l.item.price*l.quantity,0),weight=lines.reduce((n,l)=>n+l.item.weight*l.quantity,0);
 const blockers:string[]=unavailable.map(id=>'清单商品已不可采购，请清空清单：'+id);if(!lines.length)blockers.push('采购清单为空');if(final&&lines.some(l=>!l.item.local))blockers.push('最后一季无法交付订货，请移除订货商品');
 if(weight>sh.transport)blockers.push('本季运输容量不足');
 for(const {item,quantity}of lines){if(item.owned)blockers.push(item.name+'已拥有、在制或待交付');if(quantity>item.stock)blockers.push(item.name+'库存不足');}
 return {lines,total,weight,remainingMoney:s.household.money-total,blockers};
}
export function shopView(s:GameState,r:Ruleset){return {catalog:shopCatalog(s,r),quote:cartQuote(s,r),transport:s.economy!.shop!.transport,orders:structuredClone(s.economy!.shop!.orders),assets:[...s.economy!.shop!.assets],books:[...s.economy!.shop!.books],repairPrices:Object.fromEntries(productsFor(s).map(p=>[p.id,repairPrice(s,r,p.id)]))};}
