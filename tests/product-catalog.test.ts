import test from 'node:test';
import assert from 'node:assert/strict';
import {loadContext} from '../apps/cli/context.js';
import {productCatalog} from '../apps/board/product-catalog.js';
import {productPage} from '../apps/board/product-view.js';
const {base}=await loadContext();
test('产品树区分现行与规划，关系均可解析，规划不冒充已实现生产',()=>{
 const {nodes,edges}=productCatalog(base),ids=new Set(nodes.map(n=>n.id));
 assert.equal(ids.size,nodes.length);
 for(const e of edges){assert.ok(ids.has(e.from));assert.ok(ids.has(e.to));if(!e.planned){assert.ok(!nodes.find(n=>n.id===e.from)!.planned);assert.ok(!nodes.find(n=>n.id===e.to)!.planned);}}
 for(const id of ['p:medicine','p:copper','p:iron','p:geometry','p:mechanicsModel'])assert.ok(nodes.find(n=>n.id===id)?.planned);
 for(const id of ['g:food','g:pump','g:findings','f:workbench'])assert.equal(nodes.find(n=>n.id===id)?.planned,false);
 const html=productPage(base,'g:pump','工具与设备',false);
 assert.ok(!html.includes('data-product-node="p:'));
 assert.ok(html.includes('data-product-tech="mechanics"'));
 const plan=productPage(base,'p:medicine','药品与医疗',true);
 assert.ok(plan.includes('没有结算或配方'));assert.ok(plan.includes('当前游戏无法生产或使用'));
});

test('分支阅读不混合规划，总览不铺满连线，通用原料仍保留于详情',()=>{
 const overview=productPage(base,'g:pump','all',false);assert.ok(!overview.includes('<svg'));assert.ok(overview.includes('进入工具与设备'));
 const page=productPage(base,'g:precisionParts','材料与金属',false);
 const svg=page.slice(page.indexOf('<svg'),page.indexOf('</svg>'));
 assert.ok(!svg.includes('data-product-node="p:'));assert.ok(!svg.includes('data-product-node="g:pump"'));
 assert.ok(!svg.includes('<title>制作精密器件：基础投入1；基础产出1</title>')||svg.includes('传动机构'));
 assert.ok(page.includes('木材'));assert.ok(page.includes('关联：工具与设备'));
 const planned=productPage(base,'p:iron','材料与金属',true);const planSvg=planned.slice(planned.indexOf('<svg'),planned.indexOf('</svg>'));assert.ok(!planSvg.includes('data-product-node="g:'));
 const a=productPage(base,'g:ceramicParts','材料与金属',false),b=productPage(base,'g:precisionParts','材料与金属',false);
 const coords=(h:string)=>[...h.matchAll(/data-product-node="([^"]+)"[^>]*transform="([^"]+)"/g)].map(m=>[m[1],m[2]]);
 assert.deepEqual(coords(a),coords(b));
});
