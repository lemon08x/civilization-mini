/** UI-only bindings. Each render replaces these elements and their handlers. */
export function bindFarmScene(root:Document):void {
 root.querySelectorAll<HTMLButtonElement>('[data-farm-open]').forEach(button=>{
  button.onclick=()=>{
   const panel=root.querySelector<HTMLDetailsElement>(`[data-farm-panel="${button.dataset.farmOpen}"]`);
   if(!panel)return;
   panel.open=true;
   panel.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   panel.querySelector<HTMLElement>('summary')?.focus({preventScroll:true});
  };
 });
 const pause=root.querySelector<HTMLInputElement>('.scene-pause');
 if(pause){
  pause.checked=paused;
  pause.onchange=()=>{
   paused=pause.checked;
   root.querySelector('.farm-effect-layer')?.getAnimations({subtree:true}).forEach(animation=>paused?animation.pause():animation.play());
  };
 }
}
let paused=false;
export type FarmFeedback=Readonly<{kind:'sow'|'harvest'|'tend';label:string}>;
/** Only fresh, successful action events reach this function; no replay on navigation. */
export function playFarmFeedback(root:Document,events:readonly FarmFeedback[]):void {
 const layer=root.querySelector<HTMLElement>('.farm-effect-layer');
 if(!layer||!events.length)return;
 const message=root.createElement('div');
 message.className='farm-feedback';
 message.textContent=events.map(event=>event.label).join('；');
 layer.replaceChildren(message);
 if(paused||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
 const kind=events.at(-1)!.kind;
 let seed=0;
 for(const ch of events.map(event=>event.label).join(''))seed=(seed*31+ch.charCodeAt(0))%233280;
 const rand=()=>{seed=(seed*9301+49297)%233280;return seed/233280;};
 for(let i=0;i<9;i++){
  const particle=root.createElement('span');
  particle.className='farm-particle farm-particle-'+kind;
  particle.setAttribute('aria-hidden','true');
  particle.textContent=kind==='harvest'?'✦':kind==='tend'?'•':'·';
  particle.style.left=(35+i%3*9+(rand()-.5)*7)+'%';
  particle.style.top=(40+Math.floor(i/3)*9+(rand()-.5)*6)+'%';
  layer.append(particle);
  const keyframes:Keyframe[]=kind==='sow'
   ?[{transform:'translateY(-26px) scale(.7)',opacity:0},{opacity:1,offset:.3},{transform:'translateY(16px) scale(1)',opacity:1,offset:.72},{transform:'translateY(30px) scale(.55)',opacity:0}]
   :kind==='tend'
   ?[{transform:'translateY(18px)',opacity:0},{opacity:1,offset:.35},{transform:'translateY(-52px)',opacity:0}]
   :[{transform:'translate(0,0) scale(1)',opacity:1},{transform:`translate(${[-110,10,130][i%3]*(.8+rand()*.5)}px,${[-80,-140,-70][i%3]}px) scale(.3)`,opacity:0}];
  const animation=particle.animate(keyframes,{duration:kind==='sow'?1250:1100,delay:i*65,easing:kind==='sow'?'ease-in':'ease-out',fill:'both'});
  animation.onfinish=()=>particle.remove();
 }
}
