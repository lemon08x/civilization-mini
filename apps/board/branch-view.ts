import {INDUSTRY_PRODUCTS,SYSTEMS} from '../../src/game/model/industry.js';
import {productName} from '../../src/game/systems/industry-products.js';
import type {SessionObservation} from '../../src/runtime/session.js';
import {BRANCH_NODES,BRANCH_PATHS,BRANCH_PRODUCTS} from '../../src/game/model/branches.js';
import {ALL_PRODUCTS,SUBJECT_NAMES} from '../../src/game/systems/economy-catalog.js';
import {esc,inputsText} from './economy-view.js';
export const branchRequirements=(ids:string[]|undefined)=>ids?.map(id=>BRANCH_NODES.find(n=>n.id===id)?.name??id).join(' + ')||'无';
export function branchPage(g:SessionObservation['game'],button:(id:string)=>string):string{
 const b=g.economy!.branchView!;
 const panel=(title:string,body:string)=>`<section class="panel"><div class="panel-head"><h2>${title}</h2></div><div class="panel-body">${body}</div></section>`;
 return panel('按目标选择分支',`<p>19个共享节点，最长4层。只需学习节点标出的前置；产品另外检查前置产品验证与学科，材料只在制造和检验时消耗。蒸汽、半导体等进阶内容留待后续版本。</p>${b.paths.map(p=>`<article class="family-item"><h3>${p.name} · ${p.learned}/${p.nodes.length}</h3><p>${p.description}</p><p>${branchRequirements(p.nodes)}</p></article>`).join('')}`)
 +[...new Set(b.nodes.map(n=>n.subject))].map(subject=>panel(SUBJECT_NAMES[subject],`<div class="family-grid">${b.nodes.filter(n=>n.subject===subject).map(n=>`<article class="family-item"><h3>${n.id} ${n.name} · ${n.known?'已掌握':n.missing.length?'待前置':'可选分支'}</h3><p>前置：${branchRequirements(n.parents)}</p><p>${g.economy!.industryView?'学习只依赖前置学科，不要求材料、产品或系统。':n.benefit}</p><p>${g.economy!.industryView?(n.archived?'已有家学，学习减时':'无样品费用'):'样品：'+(n.archived?'已有记录，免样品':inputsText(n.sample)||'无')}；后辈${n.heirKnown?'已掌握':'未掌握'}。</p>${!n.known?button('economy:branchlearn:'+n.id):`${!n.archived?button('economy:brancharchive:'+n.id):'<p>已留存学习来源</p>'}${!n.heirKnown?button('economy:branchteach:'+n.id):''}`}</article>`).join('')}</div>`)).join('')
 +panel('采购渠道与家族工艺',`<p>基础铁料开局可买；渠道服务费不包含材料。联络后下季更新货源，仍受价格、库存、运输和到货限制。</p>${['electric','metal'].map(id=>b.channels.includes(id)?`<p>${id==='electric'?'电工材料商':'稳定金属供货'}：已联络</p>`:button('economy:channel:'+id)).join('')}<p>已试制规程：${esc(b.protocols.map(id=>g.economy!.processes.find(p=>p.id===id)?.name??id).join('、')||'暂无')}。雇员可以接续已验证规程；记录与教导不会自动复制整棵知识树。</p>`);
}
export function branchCatalog(products=false):string{
 return `<section class="card"><h2>0.19.0 · 学科、产品与系统</h2><p>19个共享节点，最长4层；先按用途选择，再补对应前置。当前系统包括${SYSTEMS.map(s=>s.name).join('、')}；流水线和无人化暂未开放。旧十阶主干、副本与高级工业暂不在本版开放。每季12时间，精力、健康和传承沿用0.17；学习默认4时间/2精力，天赋影响报价。学习不消耗样品；家学减少学习时间，个人理解不自动继承。</p>${BRANCH_PATHS.map(p=>`<p>${p.name}：${branchRequirements(p.nodes)}</p>`).join('')}</section>`+(products?ALL_PRODUCTS.filter(p=>BRANCH_PRODUCTS[p.id]).map(p=>`<section class="card"><h3>${p.name}</h3><p>${p.effect}</p><p>知识：${branchRequirements(BRANCH_PRODUCTS[p.id])}；前置产品验证：${(INDUSTRY_PRODUCTS.find(x=>x.id===p.id)?.parents??[]).map(productName).join(' + ')||'无'}</p><p>材料：${inputsText(p.inputs)}</p></section>`):BRANCH_NODES.map(n=>`<section class="card"><h3>${n.id} ${n.name}</h3><p>前置：${branchRequirements(n.parents)}；只依赖前置知识，学习花时间与精力。</p><p>${n.benefit}</p></section>`)).join('');
}
