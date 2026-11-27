const RINGS = ['戲法','一環','二環','三環','四環','五環','六環','七環','八環','九環'];
const SLOTS = [
 [],[2],[3],[4,2],[4,3],[4,3,2],[4,3,3],[4,3,3,1],[4,3,3,2],
 [4,3,3,3,1],[4,3,3,3,2],[4,3,3,3,2,1],[4,3,3,3,2,1],
 [4,3,3,3,2,1,1],[4,3,3,3,2,1,1],[4,3,3,3,2,1,1,1],
 [4,3,3,3,2,1,1,1],[4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],
 [4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]
];
const CLASSES = {
 wizard:'法師',sorcerer:'術士',cleric:'牧師',druid:'德魯伊',bard:'吟遊詩人',
 paladin:'聖騎士',ranger:'遊俠',warlock:'邪術師',artificer:'奇械師',fighter:'戰士',
 rogue:'盜賊',barbarian:'野蠻人',monk:'武僧',custom:'自訂職業'
};
const SUBS = {fighter:['奧法騎士'],rogue:['詭術師'],druid:['大地結社']};
const SPECIES = {
 human:'人類',high:'高等精靈',wood:'木精靈',drow:'卓爾精靈',dwarf:'矮人',halfling:'半身人',
 dragonborn:'龍裔',forest:'森林地侏',rock:'岩地侏',infernal:'提夫林・煉獄',abyssal:'提夫林・深淵',
 chthonic:'提夫林・冥界',halfelf:'半精靈',halforc:'半獸人',orc:'獸人',goliath:'歌利亞',aasimar:'阿斯莫',custom:'自訂種族'
};
const OLD = [
 ['half14','聖騎士、遊俠從職業 2 級取得法術位'],
 ['round14','兼職聖騎士、遊俠的等級折半後向下取整'],
 ['race14','套用 2014 種族法術範本'],
 ['arc14','法師奧術恢復每日一次，在短休時選擇恢復的法術位'],
 ['land14','大地結社 2 級啟用自然恢復']
];
const NEW = [
 ['half24','聖騎士、遊俠從職業 1 級取得法術位'],
 ['round24','兼職聖騎士、遊俠的等級折半後向上取整'],
 ['race24','套用 2024 種族法術範本，適用的法術可另消耗法術位施放'],
 ['arc24','法師奧術恢復每長休一次，在短休時選擇恢復的法術位'],
 ['land24','大地結社 6 級啟用自然恢復'],
 ['cunning24','邪術師 2 級啟用魔法巧計，恢復契約法術位上限的一半（向上取整）'],
 ['hunter24','自動加入遊俠的獵人印記免費次數（長休恢復）']
];
const SHARED = [
 ['multi','合併兼職法術位。全施法職業全計、奧法騎士／詭術師各計 1/3（向下取整）、奇械師計一半（向上取整）'],
 ['longSlots','長休恢復一般法術位'],
 ['pactShort','短休恢復契約法術位'],
 ['pactLong','長休恢復契約法術位'],
 ['arcanum','邪術師 11／13／15／17 級解鎖 6／7／8／9 環秘法奧秘，每個獨立計次'],
 ['signature','法師 20 級解鎖兩個招牌法術的免費次數，各 1 次，每短休或長休恢復']
];
const PAIRS = [['half14','half24'],['round14','round24'],['race14','race24'],['arc14','arc24'],['land14','land24']];
const TURN_RULES = [
 ['turn14','2014｜附贈動作施法：同一回合的其他法術只能是以動作施放的戲法'],
 ['turn24','2024｜每回合最多消耗 1 個法術位施法（含契約法術位）'],
 ['reactionHouse','團規｜2014 附贈動作限制放寬，同回合可搭配反應法術']
];
const ALL_RULES = [...OLD,...NEW,...SHARED,...TURN_RULES];
const CAST_TIMES = {action:'動作',bonus:'附贈動作',reaction:'反應',other:'其他／較長施法'};
const PRESET_CAST_TIMES = {
 煉獄叱喝:'reaction',迷蹤步:'bonus',獵人印記:'bonus',修復術:'other'
};
function emptyTurn(number=1) {
 return {number,slot:false,bonus:false,other:false,reaction:false};
}
function tracksTurns(rules) {return rules.turn14||rules.turn24;}
function castBlocked(rules,turn,spell,usesSlot) {
 const time=spell.castTime||'action';
 if(rules.turn14) {
  if(time==='bonus') {
   if(turn.bonus) return '2014｜本回合已以附贈動作施法';
   if(turn.other||(!rules.reactionHouse&&turn.reaction)) return '2014｜本回合已有無法搭配附贈動作的法術';
  } else if(turn.bonus&&!(time==='action'&&spell.ring===0)&&!(time==='reaction'&&rules.reactionHouse)) {
   return rules.reactionHouse?'2014｜附贈動作施法後，只能搭配動作戲法或反應法術':'2014｜附贈動作施法後，只能搭配動作戲法';
  }
 }
 if(rules.turn24&&usesSlot&&turn.slot) return '2024｜本回合已消耗法術位';
 return '';
}
function recordTurn(turn,spell,usesSlot) {
 const time=spell.castTime||'action';
 if(usesSlot) turn.slot=true;
 if(time==='bonus') turn.bonus=true;
 else if(time==='reaction') turn.reaction=true;
 else if(time!=='action'||spell.ring!==0) turn.other=true;
}
function defaults(year) {
 const enabled = new Set([...(year===2014?OLD:NEW),...SHARED].map(([id])=>id));
 return Object.fromEntries(ALL_RULES.map(([id])=>[id,enabled.has(id)]));
}
const full = new Set(['wizard','sorcerer','cleric','druid','bard']);
const half = new Set(['paladin','ranger']);
const num = (v,max=99) => Number.isFinite(+v) ? Math.min(max,Math.max(0,Math.floor(+v))) : 0;
function third(row) { return ['fighter','rogue'].includes(row.job) && row.sub && row.level>=3; }
function classLevel(c,job,sub=false) {
 return c.jobs.find(row=>row.job===job&&(!sub||row.sub))?.level || 0;
}
function progression(c) {
 const r = c.rules;
 const entries = c.jobs.filter(row=>full.has(row.job)||row.job==='artificer'||third(row)||
  (half.has(row.job)&&row.level>=(r.half24?1:r.half14?2:21)));
 const contribution = (row,mixed) => {
  const level = row.level;
  if (full.has(row.job)) return level;
  if (row.job==='artificer') return Math.ceil(level/2);
  if (third(row)) return mixed?Math.floor(level/3):Math.ceil(level/3);
  if (!mixed || r.round24) return Math.ceil(level/2);
  return r.round14?Math.floor(level/2):0;
 };
 let rows, effective;
 if (entries.length>1 && r.multi) {
  effective = entries.reduce((total,row)=>total+contribution(row,true),0);
  rows = [SLOTS[Math.min(20,effective)]];
 } else {
  effective = null;
  rows = entries.map(row=>SLOTS[contribution(row,false)]);
 }
 const slots = Array.from({length:9},(_,i)=>rows.reduce((total,row)=>total+(row[i]||0),0));
 return {slots,effective};
}
function pools(c) {
 const {slots,effective} = progression(c);
 const war = classLevel(c,'warlock');
 const pact = war===0?{ring:0,max:0}:{ring:Math.min(5,Math.ceil(war/2)),max:war===1?1:war<11?2:war<17?3:4};
 return {
  slots:slots.map((s,i)=>c.override[i]===null?s:c.override[i]),
  base:slots, effective, war,
  pact:{ring:c.pactRing??pact.ring,max:c.pactMax??pact.max},basePact:pact
 };
}
const INNATE14 = {
 high:[['自選法師戲法（可編輯）',0,1]], drow:[['舞光術',0,1],['妖火術',1,3],['黑暗術',2,5]],
 forest:[['次級幻影',0,1]], infernal:[['奇術',0,1],['煉獄叱喝',1,3,2],['黑暗術',2,5]]
};
const INNATE24 = {
 high:[['魔法伎倆',0,1],['偵測魔法',1,3],['迷蹤步',2,5]],
 wood:[['德魯伊伎倆',0,1],['大步奔行',1,3],['無跡通行',2,5]],
 drow:[['舞光術',0,1],['妖火術',1,3],['黑暗術',2,5]],
 forest:[['次級幻影',0,1],['動物交談',1,1]], rock:[['修復術',0,1],['魔法伎倆',0,1]],
 aasimar:[['光亮術',0,1]],
 infernal:[['火焰箭',0,1],['煉獄叱喝',1,3],['黑暗術',2,5]],
 abyssal:[['毒液噴濺',0,1],['致病射線',1,3],['人類定身術',2,5]],
 chthonic:[['凍寒之觸',0,1],['虛假生命',1,3],['衰弱射線',2,5]]
};
function autoCards(c) {
 const total = c.jobs.reduce((sum,row)=>sum+row.level,0);
 const year = c.rules.race24?24:c.rules.race14?14:0;
 const species = c.species;
 const spells = (year===24?INNATE24:year===14?INNATE14:{})[species]||[];
 const result = [];
 spells.forEach(([name,ring,level,freeRing],i)=>{
  if(total<level) return;
  const count = year===24 && species==='forest' && ring===1?2+Math.floor((total-1)/4):1;
  result.push({id:'innate:'+year+':'+species+':'+i,name,ring,area:'innate',mode:ring?'long':'free',
   count,freeRing:freeRing??ring,also:year===24&&ring>0,source:'種族法術'});
 });
 const war = classLevel(c,'warlock');
 if (c.rules.arcanum) [11,13,15,17].forEach((level,i)=>{
  if(war>=level) result.push({id:'arcanum:'+i,name:'自選秘法奧秘（可編輯）',ring:i+6,mode:'long',count:1,source:'秘法奧秘'});
 });
 if(c.rules.signature&&classLevel(c,'wizard')>=20) {
  for(let i=0;i<2;i++) result.push({id:'signature:'+i,name:'自選招牌法術（可編輯）',ring:3,mode:'short',count:1,also:true,source:'招牌法術'});
 }
 const ranger = classLevel(c,'ranger');
 if(c.rules.hunter24&&ranger) {
  const count=2+[5,9,13,17].filter(level=>ranger>=level).length;
  result.push({id:'hunter',name:'獵人印記',ring:1,mode:'long',count,also:true,source:'遊俠｜宿敵'});
 }
 return result.map(s=>({...s,freeRing:s.freeRing??s.ring,castTime:PRESET_CAST_TIMES[s.name]||'action',...c.presets[s.id],preset:true}));
}
function poolLeft(max,used) {return Math.max(0,max-used);}
