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
