import type { SessionObservation } from '../../src/runtime/session.js';
import { PRODUCTS,TOPICS } from '../../src/game/systems/economy-catalog.js';
import { esc } from './economy-view.js';
import { shopImage } from './illustration.js';
export function marketPage(g:SessionObservation['game'],category:string,filter:string,button:(id:string)=>string):string{
 const e=g.economy!,v=e.marketView;if(!v)return '';
 const small=(id:string,label:string)=>{
  const a=g.actions.find(a=>a.id===id); if(!a)return '';
  const reason=a.enabled?'':'<p class="blocked-reason">'+esc(a.reason||'暂不可用')+'</p>';
  return '<button type="button" data-action="'+esc(id)+'" '+(a.enabled?'':'disabled')+'>'+esc(label)+'</button>'+reason;
 };
 const quote=v.quote;
 const cart=`<h3>采购清单</h3><p>编辑清单免费、不占库存；结账时间与精力见按钮。本季剩余运输 ${v.transport}，本单占用 ${quote.weight}。</p>${quote.lines.length?`<ul class="shop-cart-lines">${quote.lines.map(({item,quantity})=>`<li>${shopImage(item)}<span>${esc(item.name)} × ${quantity} · ${item.price*quantity}钱 · ${item.local?'现货，即刻到账':'下一季交付'}</span>${small('economy:cartremove:'+item.id,'减一份')}</li>`).join('')}</ul>`:'<p>还没有选择商品。</p>'}<p><strong>合计 ${quote.total}钱</strong> · 购买后剩余 ${quote.remainingMoney}钱${quote.remainingMoney<0?'（资金不足）':''}</p><div class="inspector-action">${button('economy:checkout:cart')}</div>${Object.keys(e.shop!.cart).length?small('economy:clearcart:all','清空清单'):''}
   <h3>待交付</h3>${v.orders.length?`<ul>${v.orders.map(o=>`<li>${esc(o.name)} × ${o.amount} · 第${o.due}总季开始完成；${o.kind==='repair'?'设备本季停用':o.kind==='training'?'员工本季停工、不扣工资':'已付款，无需再花行动'}</li>`).join('')}</ul>`:'<p>没有待交付订单。</p>'}<p>资产：${v.assets.map(x=>x==='granary'?'家庭粮仓':'家学书室').join('、')||'暂无'}；家庭教材 ${v.books.length} 册，均可跨代使用。</p>${v.books.length?`<details><summary>查看已有教材</summary>${v.books.map(id=>`<p>${esc(TOPICS.find(t=>t.id===id)?.name)}</p>`).join('')}</details>`:''}`;
 const nav=`<nav class="tabs" aria-label="集市分类">${['物资','设备','学习与服务','家庭资产','交付商品'].map(c=>`<button type="button" data-shop-category="${c}" class="${category===c?'selected':''}">${c}</button>`).join('')}</nav><div class="shop-search"><input id="filter" aria-label="筛选商品" value="${esc(filter)}" placeholder="按名称筛选"><button type="button" id="filter-go">筛选</button></div>`;
 const items=v.catalog.filter(x=>x.category===category&&(!filter||x.name.includes(filter)));
 let body=items.map(item=>`<article class="family-item shop-item"><div class="shop-item-head">${shopImage(item)}<h3>${esc(item.name)}</h3></div><p>${esc(e.industryView&&item.target==='W03'?'安装到机械供水系统，由人员操作；拥有泵不再免费自动灌溉。':item.effect)}</p><p><strong>${item.price}钱</strong> · ${item.local?'本地现货，立即交付':'外地订货，下一季交付'} · 库存${item.stock} · 占运输${item.weight}</p><p class="subtle">${esc(item.condition)}</p>${item.owned?'<p>已拥有、在制或待交付</p>':small('economy:cartadd:'+item.id,'加入'+item.name)}${(e.shop?.cart[item.id]??0)>0?`<span class="tag">已选${e.shop!.cart[item.id]}</span>`:''}${item.kind==='device'?`<p class="subtle">现有耐用：${e.equipment[item.target]??0}；实物可跨代，购买不增加学科进度，也不赠送规程。</p>`:''}</article>`).join('');
 if(category==='物资')body=`<article class="family-item"><h3>当场买粮</h3><p>不加入采购清单，本人当场买入4份口粮，占用本人时间与精力；整单采购见右侧清单。</p>${button('economy:buyfood:bulk')}</article>${body}`;
 if(category==='学习与服务'){
  const lessons=e.disciplines.flatMap(d=>d.topics.filter(t=>t.level===d.level+1&&t.level>1));
  body=`${e.industryView?'<p>学科只检查前置知识，去学堂页学习，不需要购买教材或授课。</p>':''}<article class="family-item"><h3>指定课题授课</h3><p>只完成本人下一课题，不附送教材。基础2阶有教师，更高课题需要地区知识传播。</p>${lessons.filter(t=>!filter||t.name.includes(filter)).map(t=>button('economy:tuition:'+t.id)).join('')}</article><article class="family-item"><h3>委托岗位培训</h3><p>员工停工一季，下一季取得经验，不要求本人具备培训理论。招募与岗位安排在人员页。</p>${e.staff.map(w=>button('economy:paidtrain:'+w.kind)).join('')||'先招募人员。'}</article>${body}`;
 }
 if(category==='设备')body=`<article class="family-item"><h3>维修已有设备</h3><p>维修当季停用，下一季恢复满耐用度；已有跨季项目须先完工。维修不会被电报加速。</p>${(e.industryView?e.products:PRODUCTS).filter(p=>e.equipment[p.id]!==undefined&&(!filter||p.name.includes(filter))).map(p=>button('economy:repair:'+p.id)).join('')||'暂无设备。'}</article>${body}`;
 if(category==='交付商品')body=g.actions.filter(a=>a.action.type==='economy'&&['sell','sellfood'].includes(a.action.operation)&&(!filter||a.label.includes(filter))).map(a=>`<article class="family-item">${button(a.id)}</article>`).join('');
 return `<p>钱可以换取物资、已安装设备、学习服务与家庭资产。现货即刻使用；订货下一季开始交付。采购前记得预留口粮与工资。</p>
  <div class="page-workbench"><section>${nav}<div class="family-grid shop-grid">${body||'<p>没有匹配的商品。</p>'}</div></section><aside class="course-inspector">${cart}</aside></div>`;
}
