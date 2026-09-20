import {esc} from './economy-view.js';
export interface TreeNodeSpec {
  id:string; name:string; lane:string; parents:string[];
  selected?:boolean;
  stateClass?:''|'known'|'ready'|'locked'|'inactive';
  stateText?:string;
  sub?:string;
  image?:string;
  dataAttr:string;
}
export function treeGraph(
  nodes:TreeNodeSpec[],
  lanes:{id:string;name:string}[],
  opts?:{edgeLabel?:(fromId:string,toId:string)=>string;edgeClass?:(fromId:string,toId:string)=>string;ariaLabel?:string}
):string{
 const illustrated=nodes.some(n=>n.image);
 const W=illustrated?248:168,H=illustrated?76:56,COL=illustrated?288:210,ROW=illustrated?98:78,TOP=26;
 const byId=new Map(nodes.map(n=>[n.id,n]));
 const laneList=[...lanes];
 for(const n of nodes)if(!laneList.some(l=>l.id===n.lane))laneList.push({id:n.lane,name:n.lane});
 const depths=new Map<string,number>(),visiting=new Set<string>();
 const depth=(id:string):number=>{if(depths.has(id))return depths.get(id)!;if(visiting.has(id))return 0;visiting.add(id);const parents=(byId.get(id)?.parents??[]).filter(p=>byId.has(p));const d=parents.length?Math.max(...parents.map(depth))+1:0;visiting.delete(id);depths.set(id,d);return d;};
 const positions=new Map<string,{x:number;y:number}>(),laneBands:{name:string;y:number}[]=[];
 let laneTop=TOP+16;
 for(const lane of laneList){
  const group=nodes.filter(n=>n.lane===lane.id);if(!group.length)continue;
  laneBands.push({name:lane.name,y:laneTop});
  const rows=new Map<number,number>();
  for(const n of group){const d=depth(n.id),row=rows.get(d)??0;rows.set(d,row+1);positions.set(n.id,{x:24+d*COL,y:laneTop+row*ROW});}
  laneTop+=Math.max(...rows.values())*ROW+TOP;
 }
 const height=laneTop+8,maxDepth=Math.max(0,...nodes.map(n=>depth(n.id))),width=(maxDepth+1)*COL+24;
 const selected=nodes.find(n=>n.selected);
 const edges=nodes.flatMap(n=>n.parents.filter(p=>byId.has(p)).map(p=>{
  const a=positions.get(p)!,b=positions.get(n.id)!,x1=a.x+W,y1=a.y+H/2,x2=b.x,y2=b.y+H/2;
  const dim=selected&&p!==selected.id&&n.id!==selected.id,label=opts?.edgeLabel?.(p,n.id),cls=opts?.edgeClass?.(p,n.id);
  return `<path class="tree-edge${cls?' '+cls:''}${dim?' dim':''}" d="M${x1},${y1} C${x1+20},${y1} ${x2-20},${y2} ${x2},${y2}" marker-end="url(#tree-arrow)"/>${label?`<text class="tree-edge-label" x="${(x1+x2)/2}" y="${(y1+y2)/2-5}" text-anchor="middle">${esc(label)}</text>`:''}`;
 })).join('');
 const boxes=nodes.map(n=>{
  const p=positions.get(n.id)!,sub=[n.stateText,n.sub].filter(Boolean).join(' · ');
  return `<g class="tree-node ${n.stateClass??''}${n.selected?' selected':''}" role="button" tabindex="0" aria-label="${esc(n.name+'，'+sub)}" aria-pressed="${!!n.selected}" ${n.dataAttr}="${esc(n.id)}" transform="translate(${p.x},${p.y})"><title>${esc(n.name+' · '+sub)}</title><rect width="${W}" height="${H}" rx="10"/>${n.image?`<image href="${esc(n.image)}" x="8" y="8" width="52" height="52" preserveAspectRatio="xMidYMid meet" aria-hidden="true"/>`:''}<text class="tree-name" x="${n.image?68:12}" y="${illustrated?29:23}">${esc(n.name)}</text>${sub?`<text class="tree-sub" x="${n.image?68:12}" y="${illustrated?51:42}">${esc(sub.length>23?sub.slice(0,22)+'…':sub)}</text>`:''}</g>`;
 }).join('');
 const laneLabels=laneBands.map(l=>`<text class="tree-lane-label" x="24" y="${l.y-8}">${esc(l.name)}</text>`).join('');
 return `<svg style="width:${width}px;max-width:none" viewBox="0 0 ${width} ${height}" role="group" aria-label="${esc(opts?.ariaLabel??'依赖关系图')}"><defs><marker id="tree-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#70816d"/></marker></defs>${laneLabels}${edges}${boxes}</svg>`;
}
