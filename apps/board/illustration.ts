import {esc} from './economy-view.js';

// Topic illustrations are decorative, never a representation of owned equipment.
export const subjectArt=(subject:string):string=>({agronomy:'chronicle-farming',materials:'tech-materials',mechanics:'tech-mechanics',organization:'chronicle-journal'}[subject]??'chronicle-study');
export function productArt(id:string):string {
  if(['W01','W03','U08','valve'].includes(id))return 'product-water';
  if(['S01','S02','mill','U06'].includes(id))return 'chronicle-pantry';
  if(['T01','T03','U01'].includes(id))return 'product-tools';
  if(['seal','fuel','aluminium','battery'].includes(id))return 'tech-materials';
  if(['P01','P03','shaft'].includes(id))return 'tech-mechanics';
  return 'chronicle-power';
}
export const artUrl=(name:string)=>`/illustrations/${name}-ui.webp`;
export const illustration=(name:string,className='detail-illustration')=>`<img class="${esc(className)}" src="${artUrl(name)}" alt="" aria-hidden="true" width="384" height="384" loading="lazy" decoding="async">`;

export const itemImage=(id:string)=>`<img class="item-illustration" src="/illustrations/item-${esc(id)}-ui.webp" alt="" aria-hidden="true" width="128" height="128" loading="lazy" decoding="async">`;

export function shopImage(item:{kind:string;target:string}):string {
  const src=item.kind==='goods'?`/illustrations/item-${esc(item.target)}-ui.webp`
    :item.kind==='device'?`/illustrations/device-${esc(item.target)}-ui.webp`
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
  return `<figure class="encounter-card${compact?' encounter-compact':''}"><span class="encounter-picture" aria-hidden="true" style="background-image:url('/illustrations/events-${group}.png');background-position:${column*25}% ${row*100}%"></span><figcaption><span class="encounter-heading">${esc(title)}${text.includes(title+'（重大）')?' · 重大':''}</span><p>${esc(text)}</p></figcaption></figure>`;
}
