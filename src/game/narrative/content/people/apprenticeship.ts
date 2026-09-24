import type {StoryDefinition} from '../../contracts.js';
export const APPRENTICESHIP:StoryDefinition={id:'apprenticeship',revision:1,scope:'person',title:'师徒接续',nodes:[
 {id:'arrival',topic:'person.arrived',repeat:'once',surface:'inheritance',title:'从此处安顿下来',text:'{actorName}把随身物件放下。门中传来的志向很长，眼前却要从吃饭、耕作和学习一件件做起。'},
 {id:'first-study',topic:'person.learned',repeat:'once',surface:'learning',title:'札记的第一页',text:'{actorName}完成了新的理论学习。纸上的理解已有轮廓，实际如何使用，还要在实践中逐渐明白。'},
 {id:'succession',topic:'person.succeeded',repeat:'once',surface:'inheritance',title:'接过未完的一卷',text:'{actorName}接续了{predecessorName}的经营。留下的设施仍能使用，往事仍可翻阅；压力、修为和亲身学习属于各自的人生。'},
]};
