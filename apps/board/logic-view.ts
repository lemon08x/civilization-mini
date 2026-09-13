import type { Ruleset } from '../../src/game/ruleset.js';
import { buildLogicGraph } from './logic-graph.js';
const esc=(x:unknown)=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function logicPage(r:Ruleset,selected:string,search=''):string {
  const techs=r.technologies,t=techs.find(n=>n.id===selected)??techs[0];
  const relations=techs.flatMap(n=>[
    ...n.prerequisites.map(from=>({from,to:n.id,kind:'required',label:'必要前置'})),
    ...(n.prerequisiteAny??[]).map(from=>({from,to:n.id,kind:'alternative',label:'任选前置'})),
    ...(n.helpfulPrerequisites??[]).map(from=>({from,to:n.id,kind:'helpful',label:'有利经验，非必需'}))]);
  const depths=new Map<string,number>();
  const depth=(id:string):number=>{if(depths.has(id))return depths.get(id)!;const n=techs.find(n=>n.id===id)!;const parents=[...n.prerequisites,...(n.prerequisiteAny??[])];const d=parents.length?Math.max(...parents.map(depth))+1:0;depths.set(id,d);return d;};
  const positions=new Map<string,{x:number;y:number}>(),occupied=new Map<number,Set<number>>();
  for(const n of [...techs].sort((a,b)=>depth(a.id)-depth(b.id))) {
    const d=depth(n.id),used=occupied.get(d)??new Set<number>();
    const parents=[...n.prerequisites,...(n.prerequisiteAny??[])];
    let row=parents.length?Math.round(parents.reduce((sum,id)=>sum+(positions.get(id)!.y-25)/92,0)/parents.length):used.size;
    while(used.has(row))row++;used.add(row);occupied.set(d,used);positions.set(n.id,{x:24+d*215,y:25+row*92});
  }
  const width=(Math.max(...depths.values())+1)*215+24,height=Math.max(...[...positions.values()].map(p=>p.y))+100;
  const lines=relations.filter(e=>e.kind==='required'||(e.kind==='helpful'&&(e.from===t.id||e.to===t.id))).map(e=>{const a=positions.get(e.from)!,b=positions.get(e.to)!;return `<path class="edge ${e.kind}" opacity="${e.from===t.id||e.to===t.id?1:.38}" d="M${a.x+178},${a.y+30} C${a.x+198},${a.y+30} ${b.x-20},${b.y+30} ${b.x},${b.y+30}" marker-end="url(#tech-arrow)"><title>${esc(e.label)}</title></path>`;}).join('');
  const boxes=techs.map(n=>{const p=positions.get(n.id)!;return `<g class="node ${n.id===t.id?'selected':''}" role="button" tabindex="0" aria-label="查看${esc(n.name)}" data-tech="${esc(n.id)}" transform="translate(${p.x},${p.y})"><rect width="178" height="62" rx="7"/><text x="10" y="25">${esc(n.name)}</text><text x="10" y="47" style="font-size:11px">${esc(n.branch)}</text></g>`;}).join('');
  const button=(id:string)=>`<button data-tech="${esc(id)}">${esc(techs.find(n=>n.id===id)!.name)}</button>`;
  const names=(ids:string[])=>ids.map(button).join(' ')||'无';
  const {nodes,edges}=buildLogicGraph(r),node=(id:string)=>nodes.find(n=>n.id===id)!;
  const processes=edges.filter(e=>e.from===t.id&&node(e.to).kind===1).map(e=>node(e.to));
  const applications=processes.map(p=>`<article class="tech-application"><h4>${esc(p.name)}</h4><p>${esc(p.detail)}</p>${['requires','input','output'].map(kind=>{
    const links=edges.filter(e=>kind==='output'?e.from===p.id&&e.kind===kind:e.to===p.id&&e.kind===kind&&e.from!==t.id);
    return links.length?`<p><strong>${{requires:'技能与其他条件',input:'投入',output:'产出'}[kind]}：</strong>${links.map(e=>`${esc(node(kind==='output'?e.to:e.from).name)}（${esc(e.label)}）`).join('；')}</p>`:'';
  }).join('')}${edges.filter(e=>e.from===p.id&&e.kind==='output').map(e=>{const uses=edges.filter(x=>x.from===e.to&&x.to!==p.id&&x.kind!=='requires');return uses.length?`<p><strong>${esc(node(e.to).name)}的用途：</strong>${uses.map(x=>`${esc(node(x.to).name)}（${esc(x.label)}）`).join('；')}</p>`:'';}).join('')}</article>`).join('');
  return `<section class="card"><h2>科技成长网络</h2><p>从基础方法走向新的技艺。全部 ${techs.length} 个科技点始终显示；点击节点，查看如何学会、能做什么、为什么值得投入。</p><form id="tech-search-form" class="filters"><input id="tech-search" aria-label="搜索科技" placeholder="搜索并定位科技" value="${esc(search)}"><button>搜索科技</button></form>${search?`<div class="sources">${techs.filter(n=>n.name.includes(search)).map(n=>button(n.id)).join('')||'没有匹配科技'}</div>`:''}<p class="legend">━━ 必要前置　<span style="color:#7586a6">任选条件见节点详情</span>　<span style="color:#ac812d">┈┈ 所选科技的有利经验</span>。图中位置表示学习依赖。</p></section>
  <div class="tech-workspace"><div><div class="network tech-network"><svg style="width:${width}px;max-width:none" viewBox="0 0 ${width} ${height}" role="group" aria-label="科技成长网络，仅科技节点"><defs><marker id="tech-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6" fill="#70816d"/></marker></defs>${lines}${boxes}</svg></div><p class="muted">横向滚动查看后续科技。材料、熟练度和产品用途在科技详情中展开。</p><details><summary>按领域查找科技</summary>${[...new Set(techs.map(n=>n.branch))].map(branch=>`<p><strong>${esc(branch)}</strong></p><div class="sources">${techs.filter(n=>n.branch===branch).map(n=>button(n.id)).join('')}</div>`).join('')}</details></div>
  <section class="card tech-detail" aria-label="科技详情"><span class="tag">${esc(t.branch)}</span><h2>${esc(t.name)}</h2><h3>为什么值得学</h3><p>${esc(t.benefit)}</p>
  <h3>怎样学会</h3><p><strong>必要前置：</strong>${names(t.prerequisites)}</p>${t.prerequisiteAny?.length?`<p><strong>条件组：以下任选一项</strong>${names(t.prerequisiteAny)}</p>`:''}<p><strong>有利经验：</strong>${names(t.helpfulPrerequisites??[])}</p><p><strong>理论：</strong>无减免时需 ${t.study*r.parameters.studyMultiplier} 次学习；家学、洞见和有利经验可减少次数，最低1次。</p><p><strong>实践：</strong>${esc(t.practices.map(p=>r.practiceNames[p]).join('、'))}。前置、理论和全部实践满足后掌握。</p><details><summary>从哪里接触这项方法</summary><p>世界需已开放“${esc(t.world)}”；当地老师或家庭方法材料提供学习来源。</p>${Object.values(r.scenarios).map(s=>`<p>${esc(s.name)}：${s.production?.teachers.includes(t.id)?'初始有老师':s.production?.imports.includes(t.id)?'可交换外来方法':'无初始老师或进口来源'}</p>`).join('')}<p>家族留存与当地传播可以改变后续学习来源。</p></details>
  <h3>能做什么，需要什么</h3>${applications||`<p>${esc(t.benefit)}</p><p>具体行动需付出时间及界面列出的资源；学习本身不会自动得到收成、设施或研究成果。</p>`}
  <h3>后续成长</h3><div class="sources">${relations.filter(e=>e.from===t.id).map(e=>`<span>${button(e.to)} <small>${esc(e.label)}</small></span>`).join('')||'没有更后续的已实现科技点；仍可使用现有能力。'}</div><h3>能留给后代什么</h3><p>掌握后可留存方法或教学；制造的实物、设施与工艺改良可以延续。后代仍需学习，个人熟练度通过实习传授。</p></section></div>`;
}
