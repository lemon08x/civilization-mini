import {draw,energyCeiling} from './life.js';
import {activePerson} from '../model/state.js';
import {changeGoods} from './inventory.js';
import type {GameEvent} from '../model/events.js';
import type {Ruleset} from '../ruleset.js';
import { Lunar, Solar } from 'lunar-typescript';
import type { GameState } from '../model/state.js';

// Offline astronomical calendar. The reference year fixes the calendar, not the story's historical era.
const epochCache = new Map<number, number>();
const termCache = new Map<number, { name: string; serial: number }[]>();
const dateCache = new Map<string, ReturnType<typeof calculateDate>>();
const serial = (solar: Solar) => Math.floor(Date.UTC(solar.getYear(), solar.getMonth() - 1, solar.getDay()) / 86400000);
function epoch(year: number): number {
  if (!epochCache.has(year)) epochCache.set(year, serial(Lunar.fromYmd(year, 1, 1).getSolar()));
  return epochCache.get(year)!;
}
function solarAt(referenceYear: number, absoluteDay: number): Solar {
  const date = new Date((epoch(referenceYear) + Math.floor(absoluteDay)) * 86400000);
  return Solar.fromYmd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
/** Convert the former allowance once, using actual calendar months. */
export function calendarMonthDays(referenceYear:number,day:number,months:number):number {
 const start=solarAt(referenceYear,day);return serial(start.nextMonth(months))-serial(start);
}
export function calendarYearDays(referenceYear:number,day:number):number {
 const start=solarAt(referenceYear,day);return serial(start.nextYear(1))-serial(start);
}
export function availableDays(s:GameState):number {
 const c=s.life?.calendar,b=s.era?.dayBudget;
 return c&&b?Math.max(0,b.started+b.limit-c.absoluteDay):s.life?.timeRemaining??0;
}
function terms(year: number) {
  if (!termCache.has(year)) {
    const entries = new Map<number, string>();
    for (const y of [year - 1, year, year + 1]) {
      for (const [name, solar] of Object.entries(Lunar.fromYmd(y, 1, 1).getJieQiTable())) {
        if (/^[\u4e00-\u9fff]+$/.test(name)) entries.set(serial(solar), name);
      }
    }
    termCache.set(year, [...entries].map(([serial, name]) => ({ serial, name })).sort((a, b) => a.serial - b.serial));
  }
  return termCache.get(year)!;
}

const seasons = ['立春', '立夏', '立秋', '立冬'];
export function seasonAt(referenceYear: number, absoluteDay: number) {
  const solar = solarAt(referenceYear, absoluteDay), today = serial(solar);
  const boundaries = terms(solar.getYear()).filter(t => seasons.includes(t.name));
  const start = boundaries.filter(t => t.serial <= today).at(-1)!;
  const end = boundaries.find(t => t.serial > today)!;
  return { index: seasons.indexOf(start.name), start: start.serial - epoch(referenceYear), end: end.serial - epoch(referenceYear), days: end.serial - start.serial };
}
export function seasonIndex(s: GameState): number {
  const c = s.life?.calendar;
  return c ? seasonAt(c.rules.referenceYear, c.absoluteDay).index : (s.clock.absoluteTurn - 1) % 4;
}

const festivals: Record<string, { name: string; description: string }> = {
  '1-1': { name: '春节', description: '岁首迎新，向亲友同门拜年，整理新一年的打算。' },
  '1-15': { name: '元宵', description: '正月望日，赏灯团聚；春日的农事也渐渐展开。' },
  '2-2': { name: '龙抬头', description: '民间祈愿风调雨顺，准备春耕；各地习俗不同。' },
  '3-3': { name: '上巳', description: '临水踏青，感受春日物候。' },
  '5-5': { name: '端午', description: '悬艾、食粽，夏日留意食物保存。' },
  '7-7': { name: '七夕', description: '乞巧与观星，寄托对手艺和相逢的心愿。' },
  '7-15': { name: '中元', description: '祭祖追思，记念前人的劳作。' },
  '8-15': { name: '中秋', description: '月圆团聚，盘点秋日的收成与储粮。' },
  '9-9': { name: '重阳', description: '登高赏秋，问候长辈。' },
  '12-8': { name: '腊八', description: '寒冬煮粥，准备年末的生活储备。' },
  '12-23': { name: '小年', description: '本地沿用腊月廿三祭灶的习俗；其他地区日期有所不同。' },
};
const termHints: Record<string, string> = {
  立春: '春季开始，查看适播种子，规划开垦。', 雨水: '雨水渐增，留意土壤水分。', 惊蛰: '万物渐醒，适合巡视田野。',
  春分: '昼夜近等，春耕正忙。', 清明: '踏青祭扫，也留意田间农事。', 谷雨: '春雨润田，查看播种与排水。',
  立夏: '夏季开始，可安排大豆播种。', 小满: '作物渐盛，留意水分与长势。', 芒种: '农事繁忙，查看各田的成熟日期。',
  夏至: '白昼渐长，田间仍需按实际水分照料。', 小暑: '暑气渐盛，留意补水。', 大暑: '炎热时节，照看田地和食材储备。',
  立秋: '秋季开始，可安排秋播小麦。', 处暑: '暑热渐退，查看秋收与补种安排。', 白露: '秋意渐浓，留意成熟的庄稼。',
  秋分: '昼夜近等，盘点收成与储粮。', 寒露: '天气渐凉，为冬日留足物资。', 霜降: '深秋将尽，查看尚未收获的田块。',
  立冬: '冬季开始，适合整修与研习。', 小雪: '寒意渐深，检查粮食与柴火。', 大雪: '冬藏时节，备好日常补给。',
  冬至: '长夜之后日渐长，冬日团聚。', 小寒: '寒冬照料身体，留意食材与燃料。', 大寒: '岁末寒深，筹备新一年的田地。',
};

function calculateDate(referenceYear: number, day: number) {
  const solar = solarAt(referenceYear, day), lunar = solar.getLunar(), today = serial(solar);
  const table = terms(solar.getYear()), currentTerm = table.filter(t => t.serial <= today).at(-1)!;
  const solarTerm = table.find(t => t.serial === today)?.name ?? '';
  // Leap months do not repeat ordinary month-date festivals. New Year's Eve can be day 29 or 30.
  const fixed = lunar.getMonth() > 0 ? festivals[lunar.getMonth() + '-' + lunar.getDay()] : undefined;
  const holidays = fixed ? [{ ...fixed }] : [];
  const tomorrow = solar.next(1).getLunar();
  if (tomorrow.getMonth() === 1 && tomorrow.getDay() === 1) holidays.push({ name: '除夕', description: '农历岁末最后一天，辞旧迎新；不固定为腊月三十。' });
  if (solarTerm === '清明') holidays.push({ name: '清明节', description: '按清明节气定日，祭扫与踏青。' });
  const year = lunar.getYear() - referenceYear + 1;
  const lunarDate = lunar.getMonthInChinese() + '月' + lunar.getDayInChinese();
  return { year, month: Math.abs(lunar.getMonth()), day: lunar.getDay(), leapMonth: lunar.getMonth() < 0,
    yearName: lunar.getYearInGanZhi(), lunarDate, date: `第${year}年 · ${lunar.getYearInGanZhi()}年${lunarDate}`,
    solarTerm, currentTerm: currentTerm.name, termDescription: termHints[currentTerm.name], festivals: holidays };
}
export function lunarDateAt(referenceYear: number, absoluteDay: number) {
  const key = referenceYear + ':' + Math.floor(absoluteDay);
  if (!dateCache.has(key)) {
    if (dateCache.size > 1024) dateCache.clear();
    dateCache.set(key, calculateDate(referenceYear, Math.floor(absoluteDay)));
  }
  return dateCache.get(key)!;
}
export function calendarView(s: GameState) {
  const c = s.life!.calendar!, now = lunarDateAt(c.rules.referenceYear, c.absoluteDay);
  const season = seasonAt(c.rules.referenceYear, c.absoluteDay);
  const upcoming: { name: string; days: number; date: string; kind: 'term' | 'festival' }[] = [];
  for (let n = 1; n <= 45 && upcoming.length < 3; n++) {
    const date = lunarDateAt(c.rules.referenceYear, Math.floor(c.absoluteDay) + n);
    const days = n - c.absoluteDay % 1;
    const names=[date.solarTerm,...date.festivals.map(f=>f.name)].filter(name=>name&&!date.festivals.some(f=>f.name===name+'节'));
    if(names.length)upcoming.push({name:names.join(' · '),days,date:date.lunarDate,kind:date.festivals.length?'festival':'term'});
  }
  let nextTerm:{name:string;days:number;date:string}|undefined;
  for(let n=1;n<=20;n++){const d=lunarDateAt(c.rules.referenceYear,Math.floor(c.absoluteDay)+n);if(d.solarTerm){nextTerm={name:d.solarTerm,days:n-c.absoluteDay%1,date:d.lunarDate};break;}}
  const monthStart=Math.floor(c.absoluteDay)-now.day+1;
  const monthDays=[];
  for(let n=0;n<30;n++){const d=lunarDateAt(c.rules.referenceYear,monthStart+n);if(n&&d.day===1)break;monthDays.push({day:d.day,label:d.lunarDate.split('月').at(-1)!,term:d.solarTerm,festivals:d.festivals.map(f=>f.name),today:monthStart+n===Math.floor(c.absoluteDay)});}
  const month={name:now.lunarDate.split('月')[0]+'月',offset:new Date((epoch(c.rules.referenceYear)+monthStart)*86400000).getUTCDay(),days:monthDays};
  const period = c.absoluteDay % 1 ? '下午' : '上午';
  return { ...now, date: now.date + ' · ' + period, period, absoluteDay: c.absoluteDay,
    season: ['春', '夏', '秋', '冬'][season.index], daysPerSeason: season.days,
    businessCycle:{days:c.rules.businessCycleDays,nextDate:lunarDateAt(c.rules.referenceYear,c.nextBusinessDay).date,remaining:c.nextBusinessDay-c.absoluteDay,description:'后续生产、运输与补货暂按独立经营周期运行，与自然换季无关。'},
    month,nextTerm,weather:{name:{dry:'干燥',normal:'晴和',wet:'连雨'}[s.location.weather],rain:s.location.rain,days:Math.max(0,c.weatherNextDay-c.absoluteDay),effect:s.location.weather==='dry'?'降雨供水0，需灌溉或渠林保水，缺水天数累积减产。':s.location.weather==='wet'?'降雨供水3；无排涝设施的田会累积涝害。':'降雨供水2，满足作物基本水分需要。'},termEvents:c.termEvents.map(e=>({...e})),
    upcoming: upcoming.slice(0, 3), lastNotice: c.lastNotice };
}

// Every solar term has its own rural vignette. Only the resolved outcome is public.
const TERM_EVENTS:Record<string,[string,string,string,string]>={
  立春:['春土初醒','邻里分赠留存的春播麦种。','seedWheat','翻检旧种时发现受潮，费力整理种袋。'],
  雨水:['润土寻肥','沟边积下松软腐叶，收作堆肥。','compost','整理旧农具棚与清扫沟口，忙碌消耗了精力。'],
  惊蛰:['虫醒巡田','巡田时收拢越冬枯枝，可供灶火。','wood','新醒的虫蚁扰动苗床，巡护耗了精神。'],
  春分:['分种春耕','同门送来一小袋挑好的麦种。','seedWheat','春耕路上泥泞难行，搬运格外疲惫。'],
  清明:['踏青拾薪','踏青归来捡得干燥落枝。','wood','田埂草盛，顺路清理花了力气。'],
  谷雨:['谷雨养地','收集沟边腐殖土，留作肥料。','compost','沟口淤堵，临时清理耗费精力。'],
  立夏:['夏苗初盛','同门整理旧仓，分赠一份余粮。','wheat','初夏杂草旺长，巡视清理颇费精神。'],
  小满:['田间看穗','老农分赠一份去年精选的麦种。','seedWheat','田边虫情增多，仔细查苗耗费精力。'],
  芒种:['忙里互助','帮邻里归整晒场，获赠储粮。','wheat','农忙时节来回奔走，身体疲惫。'],
  夏至:['树荫歇脚','树荫下喝茶歇脚，精神恢复。','energy','日长炎热，户外巡视让人疲惫。'],
  小暑:['暑日柴棚','整理柴棚收拢散落干柴。','wood','暑热难耐，照看田地耗费精力。'],
  大暑:['雨后归肥','整理沟边积存的腐叶，收作堆肥。','compost','修整遮雨棚、搬运物资，忙到疲惫。'],
  立秋:['秋播留种','同门分赠秋播麦种。','seedWheat','更换农具和翻检种袋，忙碌耗神。'],
  处暑:['暑退归仓','整理旧粮仓找回一份可用储粮。','wheat','旧仓角落漏雨，临时修缮耗费精力。'],
  白露:['晨露巡埂','田边拾得落枝，晾作柴火。','wood','晨露打湿衣物，巡田归来疲倦。'],
  秋分:['秋日馈赠','同门送来一份秋粮。','wheat','秋收路上帮忙搬运，精力有所消耗。'],
  寒露:['积叶养土','收集落叶腐土作肥。','compost','冷露湿滑，照看田埂格外费力。'],
  霜降:['霜前备柴','捡拾干枯枝条，添置冬柴。','wood','赶在霜前整理农具，忙到疲惫。'],
  立冬:['收工具冬藏','归拢田边木料，带回柴棚。','wood','冬藏整理忙碌，耗费精力。'],
  小雪:['围炉叙话','围炉暖身，恢复精神。','energy','寒风来袭，巡查农舍耗费精力。'],
  大雪:['雪前送薪','同门送来一份备冬干柴。','wood','风雪前加固遮棚，身体疲惫。'],
  冬至:['冬至分粮','同门送来一份冬粮。','wheat','冬日奔走置办物资，精力有所消耗。'],
  小寒:['寒日养息','暖屋小坐，精神恢复。','energy','寒意侵人，搬柴护屋耗费精力。'],
  大寒:['岁末备种','整理种箱，收得一份完好的麦种。','seedWheat','岁末清扫与检修，忙碌耗神。'],
};
export function settleTermEvent(s:GameState,events:GameEvent[]):void {
 const c=s.life!.calendar!,day=Math.floor(c.absoluteDay),date=lunarDateAt(c.rules.referenceYear,day);
 if(!date.solarTerm||c.lastTermDay===day)return;
 c.lastTermDay=day;
 const [title,good,item,bad]=TERM_EVENTS[date.solarTerm];
 const positive=draw(s)*100<c.rules.termGoodPercent;
 let effect='',text=positive?good:bad;const v=activePerson(s).vitality!;
 if(positive&&item!=='energy'){changeGoods(s,{[item]:c.rules.termGoods},1,events,'节气见闻');effect=({wood:'木材',wheat:'小麦',compost:'堆肥',seedWheat:'麦种'} as Record<string,string>)[item]+' +'+c.rules.termGoods;}
 else {const before=v.energy;v.energy=positive?Math.min(energyCeiling(v),v.energy+c.rules.termEnergy):Math.max(0,v.energy-c.rules.termEnergy);const delta=Math.round((v.energy-before)*100)/100;effect=delta===0?(positive?'精力已满':'精力已耗尽'):'精力 '+(delta>0?'+':'')+delta;}
 const result={day,date:date.date,term:date.solarTerm,title,text,effect,positive};
 c.termEvents=[...c.termEvents,result].slice(-6);
 events.push({type:'life',personId:s.household.activePersonId,operation:'solar-term',detail:`${date.solarTerm} · ${title}：${text} ${effect}`});
}
export function changeCalendarWeather(s:GameState,rules:Ruleset,events:GameEvent[]):void {
 const c=s.life!.calendar!,scenario=rules.scenarios[s.location.id],roll=draw(s)*100;
 s.location.weather=roll<scenario.drought?'dry':roll<scenario.drought+scenario.wet?'wet':'normal';
 s.location.rain={dry:0,normal:2,wet:3}[s.location.weather];
 s.location.water=s.location.weather==='dry'?Math.min(s.location.water,scenario.water):Math.max(s.location.water,2);
 c.weatherNextDay=Math.floor(c.absoluteDay)+c.rules.weatherDays;
 events.push({type:'life',personId:s.household.activePersonId,operation:'weather',detail:`天气转为${{dry:'干燥',normal:'晴和',wet:'连雨'}[s.location.weather]}，降雨供水${s.location.rain}；${c.rules.weatherDays}天后再次变化。`});
}
