import { GOOD_NAMES, DISCIPLINE_NAMES } from '../game/model/development.js';
import { NETWORK_NAMES } from '../game/model/product-network.js';
import { RECIPE_NAMES, WORKSHOP_NAMES } from '../game/model/production.js';
/** Descriptive event projection. No success score, state mutation or inferred counterfactual. */
export function lifeChronicle(record) {
    const chapters = [];
    let generation = 1, turn = 1, weather = null;
    const installed = new Map();
    const projects = new Map();
    const chapter = () => {
        let c = chapters.find(c => c.generation === generation);
        if (!c) {
            c = { generation, status: 'ongoing', facts: [], investment: { actions: 0, money: 0, food: 0, materials: {} }, hardship: { seasons: 0, foodMissing: 0 }, unfinished: [] };
            chapters.push(c);
        }
        return c;
    };
    const tech = (id) => record.manifest.ruleset.technologies.find(t => t.id === id)?.name ?? id;
    chapter();
    for (const entry of record.entries)
        entry.events.forEach((e, eventIndex) => {
            const evidence = { revision: entry.revision, eventIndex };
            if (e.type === 'handed-over') {
                chapter().status = 'handed-over';
                generation = e.generation;
                turn = 1;
                weather = null;
                chapter();
            }
            const c = chapter();
            const fact = (id, category, stage, title, detail, beneficiary = '家庭', extra = [], actor = `第${generation}代经营者`) => {
                // Keep the first witnessed change of each kind in each life, not a repeatable points counter.
                if (!c.facts.some(f => f.id === id))
                    c.facts.push({ id, turn, category, stage, title, detail, actor, beneficiary, evidence: [...extra, evidence] });
            };
            if (e.type === 'action-paid') {
                c.investment.actions += e.cost.ap;
                c.investment.money += e.cost.money;
                c.investment.food += e.cost.food;
                for (const [id, n] of Object.entries(e.cost.materials ?? {}))
                    c.investment.materials[id] = (c.investment.materials[id] ?? 0) + n;
            }
            if (e.type === 'product-started' || e.type === 'development-started')
                for (const [id, n] of Object.entries(e.inputs))
                    c.investment.materials[id] = (c.investment.materials[id] ?? 0) + n;
            if (e.type === 'season-started') {
                weather = e.weather;
                turn = e.clock.turn;
            }
            if (e.type === 'season-settled' && e.missing > 0) {
                c.hardship.seasons++;
                c.hardship.foodMissing += e.missing;
            }
            if (e.type === 'mastered') {
                if (e.role === 'active')
                    fact(`learn:${e.nodeId}`, 'practice', 'prepared', `掌握了${tech(e.nodeId)}`, '学习与实践条件已经满足；掌握方法不等于已用它改善生活。', '本人');
                else
                    fact(`heir:${e.nodeId}`, 'legacy', 'prepared', `后辈学会了${tech(e.nodeId)}`, '后辈自己的学习与实践已满足要求；记录没有替后辈决定职业。', '后辈', [], '后辈');
            }
            if (e.type === 'craft-started')
                projects.set('craft', RECIPE_NAMES[e.recipe]);
            if (e.type === 'craft-completed') {
                projects.delete('craft');
                fact(`craft:${e.recipe}`, 'practice', 'prepared', `完成了${RECIPE_NAMES[e.recipe]}`, `本次产出${e.amount}件；使用、出售和留给后代是之后的选择。`);
            }
            if (e.type === 'development-started')
                projects.set('development', GOOD_NAMES[e.recipe] ?? e.recipe);
            if (e.type === 'development-completed') {
                projects.delete('development');
                fact(`develop:${e.good}`, 'practice', 'prepared', `制成了${GOOD_NAMES[e.good]}`, `本次产出${e.amount}件；记录产品完成，不推断其最终用途。`);
            }
            if (e.type === 'product-started')
                projects.set('product', NETWORK_NAMES[e.device]);
            if (e.type === 'product-completed') {
                projects.delete('product');
                fact(`product:${e.device}`, 'practice', 'prepared', `装配完成${NETWORK_NAMES[e.device]}`, '设备已制成；还需安装、耗材与实际操作。');
            }
            if (e.type === 'product-installed') {
                installed.set(e.device, { generation, evidence });
                fact(`install:${e.device}`, 'life', 'prepared', `家庭装上了${NETWORK_NAMES[e.device]}`, `设备可操作${e.durability}次；尚不能据此断言已经产生收益。`);
            }
            if (e.type === 'product-operated') {
                const text = { pump: ['提取公共水并存入家庭', '把公共水转成家用蓄水；取水不等于已完成灌溉。'], calibrator: ['用校准仪取得校准报告', '实际消耗研究记录与补给，取得用于高级设备制造的报告。'], kiln: ['把用后陶料重新制成构件', '实际消耗用后陶料、木材和设备耐用度，材料重新进入生产。'] }[e.device];
                fact(`use:${e.device}`, 'life', 'used', text[0], text[1]);
                const source = installed.get(e.device);
                if (source && source.generation < generation)
                    fact(`continue:${e.device}`, 'legacy', 'continued', `继续使用前代安装的${NETWORK_NAMES[e.device]}`, `第${source.generation}代安装的设备在本代实际使用；只追溯这次安装，不推断全部材料由前代制造。`, '本代家庭', [source.evidence]);
            }
            if (e.type === 'harvest' && e.food > 0 && weather === 'dry') {
                const waterIndex = entry.events.findIndex(x => x.type === 'stored-water-used' && x.amount > 0);
                if (waterIndex >= 0)
                    fact('dry-stored-harvest', 'life', 'used', '旱季耕作实际用上了蓄水', `本次收获${e.food}口粮。记录同时证实蓄水消耗与收成；没有计算“不用蓄水时会怎样”。`, '家庭', [{ revision: entry.revision, eventIndex: waterIndex }]);
                else if (e.drawn > 0)
                    fact('dry-channel-harvest', 'life', 'used', '旱季引水耕作获得收成', `本次公共引水${e.drawn}，收获${e.food}口粮；不将一次收成写成永久免于旱灾。`);
            }
            if (e.type === 'archived')
                fact(`archive:${e.nodeId}`, 'legacy', 'prepared', `留存了${tech(e.nodeId)}的方法`, '家庭保留学习来源；是否被后辈使用，要看之后的记录。', '后辈');
            if (e.type === 'design-refined')
                fact(`design:${e.domain}`, 'legacy', 'prepared', `留下${DISCIPLINE_NAMES[e.domain]}工艺改良`, `家族工艺达到第${e.rank}阶；记录改良成果，不推断后代已使用。`, '家庭与后辈');
            if (e.type === 'social-taught' && e.completed)
                fact(`social:${e.nodeId}`, 'community', 'prepared', `向当地传授了${tech(e.nodeId)}`, '已形成当地教学来源；没有把传播方法等同于所有邻里已经学会。', '当地社会');
            if (e.type === 'public-used' && e.amount > 0)
                fact(`public:${e.material}`, 'community', 'used', '公共商品被邻里实际使用', `邻里使用${e.amount}件${e.material === 'pottery' ? '陶器' : '木容器'}。公共库存不能区分每件商品的生产者，因此不将这次使用全部归功于玩家。`, '邻里', [], '邻里');
            if (e.type === 'contract-sold')
                fact(`contract:${e.material}`, 'life', 'used', `${WORKSHOP_NAMES[e.material]}委托产生了收入`, `受托匠人完成销售，家庭收到${e.earnings}钱；这是一次实际分工收益，仍依赖工资、材料和订单。`, '家庭', [], '受托匠人');
            if (e.type === 'trial-started')
                projects.set('trial', '比较试种');
            if (e.type === 'trial-completed') {
                projects.delete('trial');
                fact('trial', 'practice', 'prepared', '留下完整的比较试种记录', '记录可以支持选种判断；不等于候选种源一定更好。', '家庭与后辈');
            }
            if (e.type === 'generation-ended') {
                c.status = 'window-ended';
                c.unfinished = [...projects.values()];
            }
            if (e.type === 'experiment-ended') {
                c.status = 'ended';
                c.unfinished = [...projects.values()];
            }
        });
    if (chapter().status === 'ongoing')
        chapter().unfinished = [...projects.values()];
    return { schemaVersion: 1, kind: 'life-chronicle', rulesVersion: record.manifest.ruleset.rulesVersion, chapters,
        limitations: ['事实来自已记录事件，不评定人生成功与否。', '投入汇总仅含行动账单与开工部件，不是某条成果的完整供应链成本。', '首季天气若无事件证据，不推断其旱季成就。', '健康、疾病、亲属关系及个人主观幸福尚未模拟。'] };
}
