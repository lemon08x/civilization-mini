import type {SessionObservation} from '../../runtime/session.js';
import type {PolicyId} from '../contract.js';
/** Basic observable-only policy for the CLI. Specialist comparisons use recorded probe policies. */
export function chooseEconomyAction({game:g}:SessionObservation,policy:PolicyId):string|null{
  if(g.status==='handover')return 'handover';if(g.status!=='active')return null;
  const e=g.economy!,enabled=(id:string)=>g.actions.find(a=>a.id===id)?.enabled;
  const id=(op:string,t:string)=>`economy:${op}:${t}`;
  const first=(ids:string[])=>ids.find(enabled);
  if(e.marketView?.quote.lines.length){const q=e.marketView.quote,line=q.lines[0];if(q.lines.length===1&&line.item.target==='food'&&line.quantity<Math.min(4,Math.floor(g.family.money/line.item.price),line.item.stock,e.marketView.transport)&&enabled(id('cartadd','good-food')))return id('cartadd','good-food');return first([id('checkout','cart'),id('clearcart','all')])!;}
  if(e.foodTotal<3&&e.marketView&&g.family.money>=g.parameters.foodPrice*2&&e.marketView.transport>=2&&g.actions.find(a=>a.id===id('cartadd','good-food'))?.enabled)return id('cartadd','good-food');
  if(e.foodTotal<3)return first([id('farm','wheat'),id('gather','food'),id('buyfood','bulk'),id('work','local'),id('end','season')])!;
  if(enabled(id('finish','project')))return id('finish','project');
  if(['subsistence','legacy','irrigation','seed'].includes(policy)){
    if(enabled(id('study','A01')))return id('study','A01');
    if(enabled(id('farm','wheat')))return id('farm','wheat');
  }
  const sale=g.actions.find(a=>a.enabled&&a.action.type==='economy'&&a.action.operation==='sellfood'&&(e.goods[a.action.target]??0)>2&&!['wheat','soy'].includes(a.action.target));
  if(sale)return sale.id;
  if(g.family.money<6&&enabled(id('work','local')))return id('work','local');
  const subject=policy==='potter'?'heat':policy==='woodworker'?'materials':'agronomy';
  const d=e.disciplines.find(d=>d.subject===subject)!;
  const t=d.topics.find(t=>t.level===d.level+1);
  if(t){const next=first([id('study',t.id),id('research',t.id)]);if(next)return next;}
  return first([id('gather','wood'),id('gather','clay'),id('end','season')])!;
}
