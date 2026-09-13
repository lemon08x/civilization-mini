// 冠军策略：学习 22 课题 + 供粮项目 + 机械项目（真正的双支柱胜利）。
// 用法: node experiments/play-champion.mjs [--per 25] [--verbose]
import { createSession, submitCommand, observeSession } from '../dist/src/runtime/session.js';
import { loadCurrentContext } from '../dist/apps/cli/context.js';
const SUBJECTS = ['agronomy','mechanics','materials','heat','chemistry','organization'];
const PREFIX = { mechanics:'L', heat:'H', chemistry:'C', materials:'M', agronomy:'A', organization:'O' };
const RESEARCH_COST = { agronomy:{seedWheat:1}, mechanics:{wood:1}, materials:{wood:1,clay:1}, heat:{wood:1,clay:1}, chemistry:{wood:1,clay:1}, organization:{money:1} };
let base = null, impl = null;
// 冠军：力学+材料优先（机械项目要力学3+材料2+P01），再农学/热学凑课题
const champPref = sc => (base?.scenarios?.[sc]?.production?.stocks?.clay ?? 20) <= 4
  ? ['mechanics','materials','agronomy','organization','heat','chemistry']
  : ['mechanics','materials','agronomy','heat','chemistry','organization'];
function ctx(obs){const g=obs.game,e=g.economy,fam=g.family,goods=e.goods,field=e.field,actions=g.actions;const act=id=>actions.find(a=>a.id===id);const can=id=>{const a=act(id);return !!a&&a.enabled&&g.ap>=a.ap;};const activeLevel=s=>e.disciplines.find(d=>d.subject===s)?.level??0;const topicId=(s,l)=>PREFIX[s]+String(l).padStart(2,'0');const evidenceFor=(s,l)=>e.disciplines.find(d=>d.subject===s)?.topics[l-1]?.evidence??false;const shopHave=good=>(goods[good]??0)+(e.shop?.cart?.['good-'+good]??0);return{g,e,fam,goods,field,can,activeLevel,topicId,evidenceFor,shopHave,foodTotal:e.foodTotal,rain:g.world.rain,water:g.world.water,ap:g.ap};}
function foodAndField(c){const{field,can,goods,foodTotal,rain,water}=c;if(c.activeLevel('agronomy')===0&&can('economy:study:A01'))return'economy:study:A01';if(foodTotal<4){if(field.crop&&field.growth>=field.duration&&can('economy:farm:wheat'))return'economy:farm:wheat';if(!field.crop&&(goods.seedWheat??0)>=1&&can('economy:farm:wheat'))return'economy:farm:wheat';if(can('economy:buyfood:bulk'))return'economy:buyfood:bulk';if(can('economy:gather:food'))return'economy:gather:food';if(can('economy:work:local'))return'economy:work:local';}if(!field.crop&&(goods.seedWheat??0)>=1&&can('economy:farm:wheat'))return'economy:farm:wheat';if(field.crop&&field.growth>=field.duration&&can('economy:farm:wheat'))return'economy:farm:wheat';if(field.crop&&field.growth<field.duration&&rain+field.moisture<2&&water>=1&&can('economy:farm:wheat'))return'economy:farm:wheat';return null;}
function advance(c,t,familyMax){const lvl=c.activeLevel(t);if(lvl>=6||familyMax[t]>=6)return null;if(lvl===0){if(c.can(`economy:study:${c.topicId(t,1)}`))return`economy:study:${c.topicId(t,1)}`;return null;}const frontier=lvl+1;if(!c.evidenceFor(t,frontier)){if(t==='agronomy'){if((c.goods.seedWheat??0)>=2&&c.can(`economy:research:${c.topicId(t,frontier)}`))return`economy:research:${c.topicId(t,frontier)}`;return null;}const cost=RESEARCH_COST[t];const have=Object.entries(cost).every(([r,n])=>r==='money'?c.fam.money>=n:(c.goods[r]??0)>=n);if(have&&c.can(`economy:research:${c.topicId(t,frontier)}`))return`economy:research:${c.topicId(t,frontier)}`;if(!have)for(const[r,n]of Object.entries(cost)){if(r==='money'){if(c.fam.money<n&&c.can('economy:work:local'))return'economy:work:local';continue;}if((c.goods[r]??0)<n){if(c.can(`economy:gather:${r}`))return`economy:gather:${r}`;if(c.can(`economy:buy:${r}`))return`economy:buy:${r}`;}}return null;}if(c.can(`economy:study:${c.topicId(t,frontier)}`))return`economy:study:${c.topicId(t,frontier)}`;return null;}
function makeChampion(PREFERENCE){const familyMax=Object.fromEntries(SUBJECTS.map(s=>[s,0]));let target=null,lastGen=0;const pick=activeLevel=>{let best=null,bk=null;for(const s of PREFERENCE){if(familyMax[s]>=6)continue;if(activeLevel(s)<familyMax[s])continue;const k=[familyMax[s],PREFERENCE.indexOf(s)];if(!bk||k[0]<bk[0]||(k[0]===bk[0]&&k[1]<bk[1])){best=s;bk=k;}}if(best)return best;for(const s of PREFERENCE){if(familyMax[s]>=6)continue;const k=[familyMax[s],PREFERENCE.indexOf(s)];if(!bk||k[0]<bk[0]||(k[0]===bk[0]&&k[1]<bk[1])){best=s;bk=k;}}return best;};
  return obs=>{const g=obs.game;if(g.status==='handover')return'handover';if(g.status!=='active')return null;const c=ctx(obs);for(const d of c.e.disciplines)familyMax[d.subject]=Math.max(familyMax[d.subject],d.level,d.heirLevel);if(g.clock.generation!==lastGen){lastGen=g.clock.generation;target=null;}const ops=c.e.operations;const mechActive=ops.activeProject==='mechanical';const mechDone=ops.projects.mechanical?.stage==='complete';const foodActive=ops.activeProject==='food';const foodDone=ops.projects.food?.stage==='complete';
    // 0) 交接后经营安排会暂停，先接续（否则项目/协议都动不了）
    if(c.e.operations.paused&&c.can('economy:resumeplans:family'))return'economy:resumeplans:family';
    // 1) 农学（种地）
    if(c.activeLevel('agronomy')===0&&c.can('economy:study:A01'))return'economy:study:A01';
    // 2) 机械项目运行中：每季必须做纤维加工（用 P01），否则进度清零
    if(mechActive&&!mechDone){if(c.can('economy:process:fiber'))return'economy:process:fiber';if(c.shopHave('flax')<2&&c.can('economy:cartadd:good-flax'))return'economy:cartadd:good-flax';if(c.can('economy:checkout:cart'))return'economy:checkout:cart';if(c.can('economy:process:rope'))return'economy:process:rope';if(c.can('economy:work:local'))return'economy:work:local';}
    // 3) 食物/田间
    const f=foodAndField(c);if(f)return f;
    // 4) 供粮项目（先做）：组织学1阶 → 供粮协议(on) → 启动food项目；完成后关协议（省去买轴陶的钱）
    if(!foodDone){
      if(c.activeLevel('organization')===0&&c.can('economy:study:O01'))return'economy:study:O01';
      if(!ops.food&&c.can('economy:foodplan:on'))return'economy:foodplan:on';
      if(!foodActive&&ops.food&&c.can('economy:projectstart:food'))return'economy:projectstart:food';
    }else if(ops.food&&c.can('economy:foodplan:off')){
      return'economy:foodplan:off';
    }
    // 5) 机械项目（供粮完成后）：学力学2→攒3木→造P01→学力学3/材料2(家族)→买2轴2陶→启动
    if(foodDone&&!mechDone&&!mechActive){
      const cartCount=Object.values(c.e.shop?.cart??{}).reduce((a,b)=>a+b,0);
      if(!c.e.equipment.P01){
        if(c.activeLevel('mechanics')<2){const a=advance(c,'mechanics',familyMax);if(a)return a;}
        if(c.shopHave('shaft')<1&&c.can('economy:cartadd:good-shaft'))return'economy:cartadd:good-shaft';
        if(cartCount>0){if(c.can('economy:checkout:cart'))return'economy:checkout:cart';if(c.can('economy:work:local'))return'economy:work:local';}
        if((c.goods.wood??0)<3&&c.can('economy:gather:wood'))return'economy:gather:wood';
        if(c.can('economy:build:P01'))return'economy:build:P01';
      }else{
        if(familyMax['mechanics']<3){const a=advance(c,'mechanics',familyMax);if(a)return a;}
        if(familyMax['materials']<2){const a=advance(c,'materials',familyMax);if(a)return a;}
        // 批量买：轴/陶件/亚麻(6个够3季纤维)都加购物车，一次结账（钱不够打工）
        if(c.shopHave('shaft')<2&&c.can('economy:cartadd:good-shaft'))return'economy:cartadd:good-shaft';
        if(c.shopHave('ceramics')<2&&c.can('economy:cartadd:good-ceramics'))return'economy:cartadd:good-ceramics';
        if(c.shopHave('flax')<6&&c.can('economy:cartadd:good-flax'))return'economy:cartadd:good-flax';
        const cartCount=Object.values(c.e.shop?.cart??{}).reduce((a,b)=>a+b,0);
        if(cartCount>0){if(c.can('economy:checkout:cart'))return'economy:checkout:cart';if(c.can('economy:work:local'))return'economy:work:local';}
        if(c.can('economy:projectstart:mechanical'))return'economy:projectstart:mechanical';
      }
    }
    // 6) 攒钱（项目要一次买齐 2轴2陶6亚麻≈45 钱；机械项目没完成前优先攒钱不猛学）
    if(!mechDone&&c.fam.money<45&&c.can('economy:work:local'))return'economy:work:local';
    if(mechDone&&c.fam.money<10&&c.can('economy:work:local'))return'economy:work:local';
    // 7) 学习（22 课题）
    if(!target)target=pick(c.activeLevel);
    const order=[target,...PREFERENCE.filter(s=>s!==target)].filter(Boolean);
    for(const t of order){if(c.activeLevel(t)<familyMax[t]&&t!==target)continue;const a=advance(c,t,familyMax);if(a)return a;}
    if(target&&(c.activeLevel(target)>=6||familyMax[target]>=6))target=pick(c.activeLevel);
    // 8) 攒材料（P01 要 3 木）
    if((c.goods.wood??0)<4&&c.can('economy:gather:wood'))return'economy:gather:wood';
    if((c.goods.clay??0)<3&&c.can('economy:gather:clay'))return'economy:gather:clay';
    return c.can('economy:end:season')?'economy:end:season':null;};}
async function playOne(scenario,seed,runId){const decide=makeChampion(champPref(scenario));let session=await createSession({runId,ruleset:base,implementation:impl,seed,scenarioId:scenario});let obs=observeSession(session);const seasons=[];let guard=0,hardshipMax=0;
  while((obs.game.status==='active'||obs.game.status==='handover')&&guard++<3000){const action=decide(obs);if(!action)break;const before={gen:obs.game.clock.generation,turn:obs.game.clock.turn,food:obs.game.economy.foodTotal,m:obs.game.victory.mastered.length};const result=await submitCommand(session,{commandId:`${runId}:${obs.revision}`,expectedRevision:obs.revision,actionId:action});session=result.session;obs=observeSession(session);hardshipMax=Math.max(hardshipMax,obs.game.family.hardship);const ps=obs.game.economy.operations.projects;seasons.push({...before,action,hardship:obs.game.family.hardship,status:obs.game.status,foodStage:ps.food?.stage,mechStage:ps.mechanical?.stage,pActive:obs.game.economy.operations.activeProject,money:obs.game.family.money,mech:obs.game.economy.disciplines.find(d=>d.subject==='mechanics')?.level,wood:obs.game.economy.goods.wood,shaft:obs.game.economy.goods.shaft,p01:obs.game.economy.equipment.P01});}
  const v=obs.game.victory;const cnt=re=>seasons.filter(s=>s.action.startsWith(re)).length;
  return{scenario,seed,status:obs.game.status,won:v.won,achieved:v.achieved,mastered:v.mastered.length,required:v.required,achievements:v.achievements.length,requiredAchievements:v.requiredAchievements,turns:obs.game.clock.absoluteTurn,hardshipMax,builds:cnt('economy:build'),processes:cnt('economy:process'),projectstarts:cnt('economy:projectstart'),studies:cnt('economy:study'),farms:cnt('economy:farm'),works:cnt('economy:work'),buys:cnt('economy:buy'),equipment:Object.keys(obs.game.economy?.equipment??{}).length,seasons};}
const args=process.argv.slice(2);const getFlag=n=>{const i=args.indexOf(n);return i>=0?args[i+1]:null;};const per=Number(getFlag('--per')??25);const verbose=args.includes('--verbose');
const c0=await loadCurrentContext();base=c0.base;impl=c0.implementation;
const scenarios=['river','dry','woodland','clay-valley'];const results=[];
for(let i=1;i<=per;i++){const scenario=scenarios[(i-1)%scenarios.length];const seed=555000+i*733;const r=await playOne(scenario,seed,'champ'+i);results.push(r);const tag=r.won?'胜':(r.status==='ended'?'困顿亡':'未竟');console.log(`#${String(i).padStart(2,'0')} ${scenario.padEnd(10)} → ${tag} 课题${r.mastered}/${r.required} 项目${r.achievements}/${r.requiredAchievements} 回合${r.turns} 困顿峰${r.hardshipMax} 造${r.builds} 加工${r.processes} 学${r.studies} 种${r.farms} 买${r.buys}`);if(verbose)for(const s of r.seasons)console.log(`   g${s.gen}t${s.turn} ${s.action} 粮${s.food} 钱${s.money} 课题${s.m} 力学${s.mech} 木${s.wood} 轴${s.shaft} P01=${s.p01} 供粮[${s.foodStage??'-'}] 机械[${s.mechStage??'-'}]`);}
const wins=results.filter(r=>r.won).length;const avg=(a,f)=>(a.reduce((x,y)=>x+f(y),0)/a.length).toFixed(1);
console.log(`\n=== 冠军汇总（${results.length} 局）=== 胜 ${wins}/${results.length}  平均回合 ${avg(results,r=>r.turns)}  平均课题 ${avg(results,r=>r.mastered)}/36  平均项目 ${avg(results,r=>r.achievements)}/${results[0].requiredAchievements}  困顿峰 ${avg(results,r=>r.hardshipMax)}`);
console.log(`   平均: 学习 ${avg(results,r=>r.studies)}  种田 ${avg(results,r=>r.farms)}  造设备 ${avg(results,r=>r.builds)}  加工 ${avg(results,r=>r.processes)}  启动项目 ${avg(results,r=>r.projectstarts)}  打工 ${avg(results,r=>r.works)}  购买 ${avg(results,r=>r.buys)}`);
const bySc={};for(const r of results){if(!bySc[r.scenario])bySc[r.scenario]={n:0,won:0};bySc[r.scenario].n++;bySc[r.scenario].won+=r.won?1:0;}
console.log('   分场景: '+Object.entries(bySc).map(([s,x])=>`${s} ${x.won}/${x.n}`).join('  '));
const{writeFile}=await import('node:fs/promises');await writeFile(new URL('./play-champion-results.json',import.meta.url),JSON.stringify(results.map(({seasons,...rest})=>rest),null,2));
console.log('\n结果已写入 experiments/play-champion-results.json');
