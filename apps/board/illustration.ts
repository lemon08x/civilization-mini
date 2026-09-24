import {esc} from './economy-view.js';

// Topic illustrations are decorative, never a representation of owned equipment.
export const subjectArt=(subject:string):string=>({agronomy:'chronicle-farming',materials:'tech-materials',mechanics:'tech-mechanics',organization:'chronicle-journal'}[subject]??'chronicle-study');
// Each course has a concrete visual cue shared by its node and inspector.
const COURSE_ART:Record<string,string>={
 A0:'farm-goods-wheat.webp',A1:'farm-affairs-water.webp',A2:'device-W07-ui.webp',
 A3:'farm-goods-compost.webp',A4:'farm-goods-flax.webp',A5:'field-growing-ui.webp',
 A6:'item-seedWheat-ui.webp',A7:'device-U09-ui.webp',A8:'device-U08-ui.webp',
 A9:'device-U04-ui.webp',A10:'device-U10-ui.webp',A11:'farm-affairs-explore.webp',
 M0:'tech-materials-ui.webp',M1:'device-T01-ui.webp',M2:'item-seal-ui.webp',
 M3:'device-S01-ui.webp',M4:'item-polymer-ui.webp',M5:'item-wire-ui.webp',
 L0:'device-W01-ui.webp',L1:'item-shaft-ui.webp',L2:'item-valve-ui.webp',
 L3:'device-W03-ui.webp',L4:'device-P03-ui.webp',L5:'item-coil-ui.webp',
 L6:'device-E01-ui.webp',L7:'item-cable-ui.webp',
 O0:'ui-nav-family-ui.webp',O1:'chronicle-workbench-ui.webp',O2:'farm-affairs-basket.webp',
 O3:'chronicle-market-ui.webp',O4:'device-T07-ui.webp',O5:'era-nav-trade.webp',
 Q0:'item-book-ui.webp',Q1:'tech-mechanics-ui.webp',Q2:'chronicle-journal-ui.webp',
};
export const courseArtUrl=(id:string):string=>assetUrl(COURSE_ART[id]??'chronicle-study-ui.webp');
// Cultivation motifs are decorative; unlocks and effects remain live text.
export const cultivationImage=(id:string,className='cultivation-course-art'):string=>`<img class="${esc(className)}" src="${assetUrl('sect-course-'+(/^(C[0-9]|C1[0-5])$/.test(id)?id:'C0')+'-v2.webp')}" alt="" aria-hidden="true" width="192" height="192" decoding="async">`;
export function productArt(id:string):string {
  if(['W01','W03','U08','valve'].includes(id))return 'product-water';
  if(['S01','S02','mill','U06'].includes(id))return 'chronicle-pantry';
  if(['T01','T03','U01','U04'].includes(id))return 'product-tools';
  if(['U09','compost','U10'].includes(id))return 'chronicle-farming';
  // 沤麻暂无独立绘件，复用纤维类材料绘件。
  if(['fiber','rope','oil','retting'].includes(id))return 'tech-materials';
  if(['seal','fuel','aluminium','battery'].includes(id))return 'tech-materials';
  if(['P01','P03','shaft'].includes(id))return 'tech-mechanics';
  return 'chronicle-power';
}
// Runtime artwork names stay stable when their category directory changes.
export function assetUrl(filename:string):string {
 const folder=/^(ui-|era-nav-)/.test(filename)?'ui'
  :filename.startsWith('item-')?'items'
  :filename.startsWith('device-')?'devices'
  :/^(person-|sect-)/.test(filename)?'characters'
  :/^(atlas-|events-)/.test(filename)||['farm-events-atlas.png','farm-land-atlas-v1.png','self-scenes.png'].includes(filename)?'atlases'
  :filename.startsWith('farm-plant-')?(filename.endsWith('-v2.webp')?'farm/animation/painted/crops':'farm/animation/watercolor/crops')
  :/^(farm-|field-)/.test(filename)?'farm':'scenes';
 return '/illustrations/'+folder+'/'+filename;
}
export const artUrl=(name:string)=>assetUrl(name+'-ui.webp');
export type FarmArt='explore'|'reclaim'|'sow'|'tend'|'harvest'|'discovery';
export function farmEventArt(topic:FarmArt):string {
  const cell={explore:0,reclaim:1,sow:2,tend:3,harvest:4,discovery:5}[topic];
  return `<span class="farm-event-art" aria-hidden="true" style="background-position:${cell%3*50}% ${Math.floor(cell/3)*100}%"></span>`;
}
export const illustration=(name:string,className='detail-illustration')=>`<img class="${esc(className)}" src="${artUrl(name)}" alt="" aria-hidden="true" width="384" height="384" loading="lazy" decoding="async">`;

// 新物资暂无独立绘件，复用相近物品绘件：谷物种用麦种袋、豆与菜种用豆种袋，谷物收成用麦，
// 小豆用大豆，稻米用面粉（碾制加工粮），食盐用矿石，葵菜/芥菜与腌菜用口粮。
const itemArtAlias:Record<string,string>={seedRice:'seedWheat',seedFoxtail:'seedWheat',seedAdzuki:'seedSoy',seedMallow:'seedSoy',seedMustard:'seedSoy',rice:'wheat',millet:'wheat',adzuki:'soy',milledRice:'flour',salt:'ore',mallow:'food',mustard:'food',pickles:'food'};
export const itemImage=(id:string)=>`<img class="item-illustration" src="/illustrations/items/item-${esc(itemArtAlias[id]??id)}-ui.webp" alt="" aria-hidden="true" width="128" height="128" loading="lazy" decoding="async">`;

export function shopImage(item:{kind:string;target:string}):string {
  const src=item.kind==='goods'?`/illustrations/items/item-${esc(itemArtAlias[item.target]??item.target)}-ui.webp`
    :item.kind==='device'?`/illustrations/devices/device-${esc(item.target)}-ui.webp`
    :item.kind==='book'?artUrl('item-book')
    :artUrl('item-'+item.target);
  const fallback=artUrl(item.kind==='goods'?'item-food':productArt(item.target));
  return `<img class="item-illustration shop-item-image" src="${src}" onerror="this.onerror=null;this.src='${fallback}'" alt="" aria-hidden="true" width="128" height="128" loading="lazy" decoding="async">`;
}

// Small, eager-loaded images for navigation and live status; labels remain real text.
export const chromeImage=(name:string,className='chrome-image')=>`<img class="${esc(className)}" src="${artUrl('ui-'+name)}" alt="" aria-hidden="true" width="128" height="128" decoding="async">`;

// Decorative watercolor atlas; cell choice conveys a topic, never an unlocked state.
export function sectImage(cell:number,className=''):string {
  return `<span class="sect-picture ${className}" aria-hidden="true" style="background-position:${cell%4*100/3}% ${[2.5,35.5,66.6667,100][Math.floor(cell/4)]}%"></span>`;
}

// Titles are presentation keys from observed encounter text, not event selection logic.
const encounterPictures:readonly (readonly [string,string,number,number])[]=[
  ['札记中的顿悟','study',0,0], ['思路陷入瓶颈','study',0,1],
  ['问答相长','study',1,0], ['解答留下疑窦','study',1,1],
  ['静坐闻新意','study',2,0], ['静修杂念生','study',2,1],
  ['旧学互相印证','study',3,0], ['旧说彼此冲突','study',3,1],
  ['新刊打开眼界','study',4,0], ['新术名词迷阵','study',4,1],
  ['辛劳得到酬谢','work',0,0], ['临工结算折损','work',0,1],
  ['田间经验获谢','work',1,0], ['田间补修支出','work',1,1],
  ['手艺赢得口碑','work',2,0], ['返工赔付','work',2,1],
  ['识材受到赏识','work',3,0], ['采集行装损耗','work',3,1],
  ['设备经验获酬','work',4,0], ['操作疏漏赔补','work',4,1],
  ['意外的谢礼','daily',0,0], ['临时开支','daily',0,1],
  ['周转得到援手','daily',1,0], ['拮据又逢支出','daily',1,1],
  ['邻里应候相助','daily',2,0], ['天气添了花销','daily',2,1],
  ['故人托来薄礼','daily',3,0], ['旧物修缮','daily',3,1],
  ['集市退回余款','daily',4,0], ['集市账目差错','daily',4,1],
  ['身心渐复','body',0,0], ['偶感不适','body',0,1],
  ['休养见效','body',1,0], ['休养仍有反复','body',1,1],
  ['劳后调息得法','body',2,0], ['积劳不适','body',2,1],
  ['饥困中得到照护','body',3,0], ['饥困难安眠','body',3,1],
  ['暮年调养有方','body',4,0], ['旧疾随岁月反复','body',4,1],
  ['谈话解开心结','bond',0,0], ['一场未解的争执','bond',0,1],
  ['坦诚之后更亲近','bond',1,0], ['好意被误解','bond',1,1],
  ['师徒互相体谅','bond',2,0], ['师徒期许错位','bond',2,1],
  ['旧怨渐渐松动','bond',3,0], ['旧怨又被提起','bond',3,1],
  ['托付得到回应','bond',4,0], ['熟稔生出疏忽','bond',4,1],
];
export function encounterCard(text:string,compact=false):string {
  const entry=encounterPictures.find(([title])=>text.includes(title+'：')||text.includes(title+'（重大）：'));
  if(!entry)return `<p>${esc(text)}</p>`;
  const [title,group,column,row]=entry;
  return `<figure class="encounter-card${compact?' encounter-compact':''}"><span class="encounter-picture" aria-hidden="true" style="background-image:url('/illustrations/atlases/events-${group}.png');background-position:${column*25}% ${row*100}%"></span><figcaption><span class="encounter-heading">${esc(title)}${text.includes(title+'（重大）')?' · 重大':''}</span><p>${esc(text)}</p></figcaption></figure>`;
}

// Land and facilities share the same Qinglü tile silhouette on the map and in cards.
const landFrames:Record<string,number>={sand:1,loam:2,clay:3,dry:4,parched:4,moist:5,wet:6,flood:7,grass:0};
const landTiles:Record<string,string>={water:'water',paddy:'paddy',drain:'drain',canal:'canal-connected','canal-dry':'canal-dry',shelter:'shelter',yard:'yard',cellar:'cellar',pit:'pit','pit-active':'pit-active',shed:'shed',retting:'retting',low:'low',flat:'flat',high:'high',fertility:'fertility',unknown:'unknown',timber:'timber',clearwood:'clearwood'};
export function landArt(key:string,extra=''):string {
 const tile=landTiles[key];
 const style=tile?`background-image:url('/illustrations/farm/animation/painted/terrain/farm-tile-${tile}-qinglu-v1.png');background-size:contain;background-position:center`
  :`background-image:url('/illustrations/farm/animation/painted/terrain/farm-land-qinglu-v1.png');background-size:400% 200%;background-position:${(landFrames[key]??2)%4*100/3}% ${Math.floor((landFrames[key]??2)/4)*100}%`;
 return `<span class="farm-land-art ${extra}" style="${style};background-repeat:no-repeat" aria-hidden="true"></span>`;
}
