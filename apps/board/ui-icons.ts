/** Small, local UI symbols. No network or generated image dependency. */
export function uiIcon(name:string):string {
 const paths:Record<string,string>={
  meditate:'<circle cx="12" cy="5" r="2"/><path d="M8 10h8l2 6-6-2-6 2 2-6ZM8 17l-5 3h18l-5-3M12 8v6"/>',
  seal:'<path d="M7 3h10l3 5-3 12H7L4 8l3-5ZM8 8h8M9 12h6M12 8v8M9 23h6"/>',
  book:'<path d="M12 6c-3-3-7-3-10-2v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Z"/><path d="M12 6v15M5 8h3M16 8h3M5 12h3M16 12h3"/>',
  plant:'<path d="M12 22V10M12 15C4 15 3 10 3 6c6 0 9 3 9 9ZM12 11c0-6 3-9 9-9 0 6-3 9-9 9Z"/>',
  drop:'<path d="M12 2S4 11 4 16a8 8 0 0 0 16 0c0-5-8-14-8-14Z"/><path d="M8 16a4 4 0 0 0 4 4"/>',
  layers:'<path d="m12 3 10 5-10 5L2 8 12 3Zm-10 9 10 5 10-5M2 17l10 5 10-5"/>',
  motion:'<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4M18 8l4 4-4 4"/>',
  people:'<circle cx="9" cy="7" r="3"/><path d="M2 21v-3a7 7 0 0 1 14 0v3M16 4a3 3 0 0 1 0 6M19 14c3 1 3 3 3 7"/>',
  tool:'<path d="m4 21 12-12M13 3l8 8M10 6l7-4 5 5-4 7M2 19l3 3"/>',
  home:'<path d="m2 11 10-9 10 9M5 9v13h14V9M9 22v-8h6v8"/>',
  box:'<path d="m12 2 10 5v12l-10 4-10-4V7l10-5ZM2 7l10 5 10-5M12 12v11M7 4l10 5"/>',
  market:'<path d="M3 10v12h18V10M2 4h20l-2 6H4L2 4ZM8 22v-7h8v7"/>',
  power:'<path d="m14 2-10 12h7l-1 8 10-12h-7l1-8Z"/>',
 };
 return `<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]??paths.book}</svg>`;
}
export const placeIcon=(page:string)=>uiIcon(({聚落:'home',农业:'plant',生活:'plant',家人:'people',仓库:'box',学科:'book',制造:'tool',系统:'tool',雇佣:'people',家业:'home',商城:'market',能源:'power',社会:'book'} as Record<string,string>)[page]??'tool');
