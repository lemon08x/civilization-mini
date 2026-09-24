import type {StoryDefinition,StoryNode} from '../../contracts.js';
const routes=[
 {kind:'tea',name:'古树茶亭',surface:'relaxation',built:'{actorName}沿旧界安放坐凳，添起茶炉。原先划分田亩的地方，如今也能让劳作的人歇一歇。品茶半日已在放松与调养中开放。',used:'{actorName}第一次在亭中饮茶。水汽散开，田里的事仍要做，却不必在这一刻全压在心头。',upgraded:'{actorName}想起第一次在这里歇脚，用备下的木料将亭檐修得更稳，雨天也能从容喝完一盏茶。'},
 {kind:'reading',name:'静读小院',surface:'learning',built:'{actorName}借着旧界围出小院，放下一张书案。土地有界，疑问却可以不断向外延伸。理论学习的压力增量已降低。',used:'{actorName}第一次带着难解的札记来读。安静没有替人给出答案，却让一个问题终于能被想完整。',upgraded:'{actorName}添了挡风的窗和收纳札记的架子。散页各有归处，后来的人也有了一处可以专心求学的地方。'},
 {kind:'garden',name:'田畔花园',surface:'farming',built:'{actorName}把旧界旁的边角整理成花径。花园不催庄稼长大，却让附近田间的劳作少一些紧绷。两格内农活减压已接入报价。',used:'{actorName}忙完花径旁的一段农活，抬头才看见新开的花。收成仍凭耕作，心里却多了一点余裕。',upgraded:'{actorName}补齐步道，按时令分栽花木。田间一年有忙有闲，这条路也终于四季都有可看的景致。'},
 {kind:'memorial',name:'乡土纪念园',surface:'inheritance',built:'{actorName}描下旧界的刻痕，留出记录修渠、耕田与授业之人的地方。教导和请教的耗时减免已生效。',used:'{actorName}在教与学之间谈起旧田界。记住前人的方法，并不是要求后来者只走同一条路。',upgraded:'{actorName}整理散落的名字和事迹，为尚未到来的人留出空白。此处保存来路，也容得下新的选择。'},
] as const;
const eq=(key:string,value:string|number)=>({source:'event' as const,key,op:'eq' as const,value});
const routeNodes:StoryNode[]=routes.flatMap(r=>[
 {id:r.kind+'-built',topic:'landscape.changed',after:['preserved'],conditions:[eq('kind',r.kind),eq('level',2)],repeat:'event',surface:'place',title:r.name+'初成',text:r.built,choice:r.kind},
 {id:r.kind+'-used',topic:'landscape.used',after:[r.kind+'-built'],conditions:[eq('kind',r.kind)],repeat:'person',surface:r.surface,title:r.name+' · 第一次使用',text:r.used},
 {id:r.kind+'-upgraded',topic:'landscape.changed',after:[r.kind+'-built'],conditions:[eq('kind',r.kind),eq('level',3)],repeat:'event',surface:'place',title:r.name+' · 岁月添成',text:r.upgraded},
]);
export const OLD_BOUNDARY:StoryDefinition={id:'old-boundary',revision:1,scope:'place',title:'桑下旧界',nodes:[
 {id:'discovered',topic:'place.discovered',conditions:[eq('discovery','shrine')],repeat:'once',surface:'place',title:'桑下旧界',text:'{actorName}拂去石片上的苔痕，发现两道并不齐整的田界。刻痕之间留着一条窄路，像是有人曾在争执之后，各退了一步。留下它，或整理土地继续生活，都将成为此地新的故事。',choices:[{id:'preserve',label:'保留旧界',capability:'landmark.preserve'},{id:'reclaim',label:'整理为荒地',capability:'landmark.reclaim'}]},
 {id:'preserved',topic:'landmark.preserved',after:['discovered'],repeat:'once',surface:'place',title:'留一处共同的来路',text:'{actorName}描下旧界，将石旁清理出可以歇脚的地方。地标保留，凭栏散心已在放松与调养中开放；以后可以在此修建不同景观。',choice:'preserve'},
 {id:'reclaimed',topic:'landmark.reclaimed',after:['discovered'],repeat:'once',surface:'place',title:'旧界旁的新生活',text:'{actorName}记下刻痕的位置，将可耕的部分整理成荒地。留下文字，也让这片土地重新承担眼前的生活。',choice:'reclaim'},
 ...routeNodes,
 {id:'converted',topic:'landscape.converted',after:['preserved'],repeat:'event',surface:'place',title:'旧地另有新用',text:'{actorName}将{oldName}改建为{landscapeName}。旧时的使用记录仍在，新用途从今日开始；原有功能随改建撤下。'},
 {id:'inherited',topic:'place.inherited',after:['preserved'],repeat:'person',surface:'inheritance',title:'有人把此地留给后来者',text:'{actorName}接续经营，读到{builderName}留在{landscapeName}的记录。建筑和故事一同留下，自己的经历还要从此刻开始。'},
]};
