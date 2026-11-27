const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {webcrypto} = require('node:crypto');

class Control {
 constructor(tag) {
  this.tag = tag;
  this.children = [];
  this.attributes = {};
  this.classList = {add(v){},remove(v){}};
  this._value = undefined;
  this.hidden = false;
  this.textContent = '';
  this.listeners = {};
 }
 get value() {return this._value??(this.tag==='select'?(this.children.find(n=>n.selected)||this.children[0])?.value??'':'');}
 set value(v) {this._value=String(v);}
 append(...nodes) { for(const node of nodes) {node.parentElement=this;this.children.push(node);} }
 replaceChildren(...nodes) {this.children=[];this.append(...nodes);}
 get childElementCount() {return this.children.length;}
 before(node) {this.parentElement?.append(node);}
 addEventListener(key,fn) {this.listeners[key]=fn;}
 setAttribute(key,val) {this.attributes[key]=val;}
 getAttribute(key) {return this.attributes[key]??null;}
 removeAttribute(key) {delete this.attributes[key];}
 close() {this.open=false;}
 showModal() {this.open=true;}
 click() {return (this.onclick||this.listeners.click)?.();}
 select() {this.selected=true;}
 focus() {}
 scrollIntoView() {}
 remove() {this.parentElement.children=this.parentElement.children.filter(n=>n!==this);}
}
const page=fs.readFileSync('docs/index.html','utf8');
const markup=page.replace(/<(script|style)>[\s\S]*?<\/\1>/g,'');
const staticControls=[];
const nodes={};
for(const [,tag,attrs,content] of markup.matchAll(/<(\w+)([^<>]*)>([^<]*)/g)) {
 const el=new Control(tag);
 for(const [,key,val] of attrs.matchAll(/([\w-]+)="([^"]*)"/g)) el.setAttribute(key,val);
 if(/\bdata-i18n\b/.test(attrs)) {
  el.setAttribute('data-i18n','');
  el.textContent=content.replace(/&amp;/g,'&');
 }
 if(el.attributes.id) nodes[el.attributes.id]=el;
 staticControls.push(el);
}
const preferences = new Map();
const root = new Control('html');
const scope={
 document:{getElementById:key=>nodes[key],createElement:tag=>new Control(tag),body:new Control('body'),
  documentElement:root,querySelectorAll:selector=>staticControls.filter(el=>selector.slice(1,-1) in el.attributes)},
 navigator:{language:'zh-TW'},
 localStorage:{getItem:key=>preferences.get(key),setItem:(key,value)=>preferences.set(key,value)},
 window:{addEventListener(){}},confirm:()=>true,Blob,URL,console,
 crypto:webcrypto,setTimeout(){},clearTimeout(){},Date,Intl,
 assert
};
vm.createContext(scope);
for(const [,script] of page.matchAll(/<script>([\s\S]*?)<\/script>/g)) vm.runInContext(script,scope);
const run=s=>vm.runInContext(s,scope);
const eq=(actual,expected)=>assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected);
const find=(node,predicate)=>[...(predicate(node)?[node]:[]),...node.children.flatMap(n=>find(n,predicate))];
const all=(selector)=>find(nodes.dialogBody,selector);
const aria=label=>all(e=>e.attributes['aria-label']===label)[0];
const text=label=>all(e=>e.textContent===label)[0];
const opt=label=>all(e=>e.tag==='select'&&e.children.some(n=>n.textContent===label))[0];
const label=label=>all(e=>e.tag==='label'&&e.children[0]?.textContent===label)[0].children[1];
const submit=()=>nodes.dialogBody.children[0].onsubmit({preventDefault(){}});
(async()=>{
 assert.equal(nodes.name.textContent,'未命名角色');
 eq(run('pools(cNow()).slots.slice(0,3)'),[2,0,0]);
 run(`cNow().jobs=[{job:'ranger',level:3},{job:'wizard',level:3}]`);
 eq(run('pools(cNow()).slots.slice(0,4)'),[4,3,2,0]);
 run('cNow().rules=defaults(2014)');
 eq(run('pools(cNow()).slots.slice(0,4)'),[4,3,0,0]);
 run("cNow().jobs=[{job:'paladin',level:1},{job:'fighter',level:2}]");
 eq(run('pools(cNow()).slots.slice(0,2)'),[0,0]);
 run('cNow().rules=defaults(2024)');
 eq(run('pools(cNow()).slots.slice(0,2)'),[2,0]);
 run("cNow().jobs=[{job:'fighter',sub:true,level:7}]");
 eq(run('pools(cNow()).slots.slice(0,3)'),[4,2,0]);
 run("cNow().jobs=[{job:'artificer',level:3},{job:'wizard',level:1}]");
 eq(run('pools(cNow()).slots.slice(0,3)'),[4,2,0]);
 run("cNow().jobs=[{job:'wizard',level:5},{job:'warlock',level:5}];cNow().species='drow';render()");
 eq(run('pools(cNow()).pact'),{ring:3,max:2});
 eq(run('autoCards(cNow()).map(s=>[s.name,s.count])'),[['舞光術',1],['妖火術',1],['黑暗術',1]]);
 nodes.character.click();
 label('角色名稱').value='露恩';
 await submit();
 assert.equal(nodes.name.textContent,'露恩');
 assert.equal(nodes.editor.open,false);
 assert.equal(nodes.log.value,'');
 nodes.counts.click();
 aria('一環手動上限').value='5';
 aria('一環已用次數').value='1';
 await submit();
 eq(run('pools(cNow()).slots.slice(0,3)'),[5,3,2]);
 assert.equal(run('cNow().used[0]'),1);
 nodes.addSpell.click();
 label('法術名稱').value='魔法飛彈';
 label('取得來源').value='secondary';
 await submit();
 assert.equal(run("origin(cNow(),cNow().spells[0])"),'secondary');
 assert.ok(find(nodes.board,e=>e.className?.includes('spell origin-secondary')).length);
 const use=()=>find(nodes.board,e=>e.attributes['aria-label']==='使用 魔法飛彈')[0];
 const way=()=>find(nodes.board,e=>e.attributes['aria-label']==='施放方式 魔法飛彈')[0];
 way().value='slot:0';use().click();
 assert.equal(run('cNow().used[0]'),2);
 assert.ok(nodes.log.value.includes('魔法飛彈'));
 assert.ok(find(nodes.summary,e=>e.textContent==='★★★☆☆').length);
 way().value='pact';use().click();
 assert.equal(run('cNow().pactUsed'),1);
 run("cast(cNow(),autoCards(cNow()).find(s=>s.name==='妖火術'),'free')");
 assert.equal(run("cNow().spellUsed['innate:24:drow:1']"),1);
 assert.equal(run("castOptions(cNow(),pools(cNow()),autoCards(cNow()).find(s=>s.name==='妖火術')).some(([m])=>m==='free')"),false);
 nodes.short.click();
 await submit();
 assert.equal(run('cNow().pactUsed'),0);
 assert.equal(run('cNow().used[0]'),2);
 nodes.short.click();
 label('一環恢復幾格').value='2';
 await submit();
 assert.equal(run('cNow().used[0]'),0);
 assert.equal(run('cNow().features.arc24'),true);
 nodes.undo.click();
 assert.equal(run('cNow().used[0]'),2);
 assert.ok(nodes.log.value.includes('復原'));
 nodes.character.click();
 aria('主職業等級').value='6';
 await submit();
 assert.equal(run('cNow().used[0]'),2);
 assert.equal(run("cNow().spellUsed['innate:24:drow:1']"),1);
 assert.equal(run('pools(cNow()).slots[0]'),5);
 const png='data:image/png;base64,iVBORw0KGgo=';
 scope.png=png;
 run("cNow().spells[0].front=png;cNow().spells[0].back=png;render()");
 const viewBtn=find(nodes.board,e=>e.attributes['aria-label']==='放大 魔法飛彈')[0];
 viewBtn.click();
 assert.ok(nodes.viewTitle.textContent.endsWith('正面'));
 nodes.backSide.click();
 assert.ok(nodes.viewTitle.textContent.endsWith('反面'));
 nodes.closeViewer.click();
 nodes.log.ondblclick({currentTarget:nodes.log});
 assert.ok(nodes.log.selected);
 const capture={name:'test.dndprep'};
 scope.window.showSaveFilePicker=async()=>capture;
 capture.createWritable=async()=>({write:async value=>capture.value=value,close:async()=>{}});
 await nodes.save.onclick();
 assert.ok(capture.value.includes(png));
 assert.ok(!run('dirty'));
 nodes.long.click();
 await submit();
 assert.equal(run('cNow().used[0]'),0);
 assert.equal(run("cNow().spellUsed['innate:24:drow:1']"),0);
 capture.getFile=async()=>({name:capture.name,size:capture.value.length,text:async()=>capture.value});
 scope.window.showOpenFilePicker=async()=>[capture];
 await nodes.open.onclick();
 assert.equal(run('cNow().used[0]'),2);
 assert.equal(run("cNow().spellUsed['innate:24:drow:1']"),1);
 assert.ok(nodes.log.value.includes('魔法飛彈'));
 assert.equal(run('cNow().spells[0].back'),png);
 find(nodes.tabs,e=>e.textContent==='＋ 新增角色')[0].click();
 label('角色名稱').value='第二位';
 label('起始規則範本').value='2014';
 await submit();
 assert.equal(nodes.name.textContent,'第二位');
 assert.equal(run('cNow().rules.half14'),true);
 assert.equal(run('cNow().spells.length'),0);
 find(nodes.tabs,e=>e.textContent==='露恩')[0].click();
 assert.equal(nodes.name.textContent,'露恩');
 assert.equal(run('cNow().spells.length'),1);
 nodes.rules.click();
 text('2014 全套預設').click();
 await submit();
 assert.equal(run('cNow().rules.half14'),true);
 assert.equal(run('cNow().rules.half24'),false);
 assert.equal(run('cNow().used[0]'),2);

 // The blank secondary row shows a labeled level and updates the slot table.
 nodes.character.click();
 assert.equal(aria('副職業等級').value,'5');
 aria('副職業').value='ranger';
 aria('副職業').onchange();
 aria('副職業等級').value='3';
 const oldLog=nodes.log.value;
 await submit();
 assert.equal(run('cNow().jobs[1].level'),3);
 assert.equal(run('cNow().jobs[1].job'),'ranger');
 assert.equal(run('pools(cNow()).effective'),7);
 assert.equal(nodes.log.value,oldLog);
 find(nodes.tabs,e=>e.textContent==='第二位')[0].click();
 nodes.character.click();
 assert.equal(aria('副職業等級').disabled,true);
 aria('副職業').value='cleric';aria('副職業').onchange();
 assert.equal(aria('副職業等級').disabled,false);
 aria('副職業等級').value='2';
 await submit();
 assert.equal(run('cNow().jobs[1].level'),2);
 assert.equal(nodes.log.value,'');

 // Each turn rule can be toggled independently. Check both cast orders.
 const ruleCheck=key=>text(run("TURN_RULES.find(([key])=>key==='"+key+"')[1]")).parentElement.children[0];
 const rulesFor=(a,b,house=false)=>{
  nodes.rules.click();
  ruleCheck('turn14').checked=a;
  ruleCheck('turn24').checked=b;
  ruleCheck('reactionHouse').checked=house;
  return submit();
 };
 const prepare=()=>run(`cNow().spells=[
  {id:'a',name:'飛彈',mode:'slot',ring:1,castTime:'action'},
  {id:'b',name:'迅捷',mode:'free',ring:1,castTime:'bonus'},
  {id:'c',name:'戲法',mode:'free',ring:0,castTime:'action'},
  {id:'d',name:'反制',mode:'slot',ring:1,castTime:'reaction'},
  {id:'e',name:'物品',mode:'long',count:2,ring:1,castTime:'action'}];
  cNow().override[0]=12; cNow().pactRing=1; cNow().pactMax=2; render();`);
 prepare();
 assert.equal(nodes.turnBar.hidden,true);
 await rulesFor(true,false);
 assert.equal(nodes.turnBar.hidden,false);
 const press=(i,way='free')=>run("cast(cNow(),cNow().spells["+i+"],'"+way+"')");
 press(1);
 const before=run('cNow().log.length');
 press(0,'slot:0');press(3,'slot:0');press(4);press(1);
 assert.equal(run('cNow().log.length'),before);
 press(2);
 assert.equal(run('cNow().log.length'),before+1);
 nodes.nextTurn.click();
 press(0,'slot:0');
 const actionFirst=run('cNow().log.length');
 press(1);
 assert.equal(run('cNow().log.length'),actionFirst);
 nodes.nextTurn.click();
 await rulesFor(true,false,true);
 press(1);press(3,'slot:0');
 assert.equal(run('cNow().used[0]'),2);

 await rulesFor(false,true);
 assert.equal(run('cNow().rules.turn14'),false);
 nodes.nextTurn.click();
 press(0,'slot:0');
 press(3,'pact');
 assert.equal(run('cNow().pactUsed'),0);
 press(2);press(4);press(1);
 assert.equal(run("cNow().spellUsed.e"),1);
 assert.equal(run('cNow().turn.slot'),true);

 await rulesFor(true,true,true);
 assert.equal(run('cNow().rules.turn14&&cNow().rules.turn24'),true);
 nodes.nextTurn.click();
 press(3,'pact');press(1);press(3,'slot:0');
 assert.equal(run('cNow().pactUsed'),1);
 assert.equal(run('cNow().used[0]'),3);
 assert.equal(run('cNow().turn.bonus'),true);

 // Combat log reset supports cancel, and leaves pools, turn and other characters intact.
 const retainedLog=nodes.log.value;
 nodes.resetLog.click();
 assert.ok(all(e=>e.textContent.includes('戰鬥紀錄將歸零')).length);
 text('取消').click();
 assert.equal(nodes.log.value,retainedLog);
 nodes.resetLog.click();
 await submit();
 assert.equal(nodes.log.value,'');
 assert.equal(run('cNow().used[0]'),3);
 assert.equal(run('cNow().turn.slot'),true);
 assert.equal(run('cNow().pactUsed'),1);
 assert.equal(nodes.resetLog.disabled,true);
 await nodes.save.onclick();
 await nodes.open.onclick();
 assert.equal(run('cNow().turn.slot'),true);
 assert.equal(run('cNow().spells[3].castTime'),'reaction');
 assert.equal(nodes.log.value,'');
 assert.equal(run('project.characters.find(c=>c.name==="露恩").log.length')>0,true);

 const legacy=run(`(()=>{
  const old=JSON.parse(JSON.stringify(project));
  delete old.characters[0].turn;
  delete old.characters[0].rules.turn14;
  old.characters[0].log=['[2026-11-25 19:09:08] 更新角色設定（保留已用次數）','[2026-11-25 19:09:09] 施放 飛彈'];
  return unpack(old).characters[0];
 })()`);
 assert.equal(legacy.turn.number,1);
 assert.equal(legacy.rules.turn14,false);
 eq(legacy.log,['[2026-11-25 19:09:09] 施放 飛彈']);
 const sample=run('cNow()');
 sample.jobs=[{job:'paladin',level:5}];
 sample.species='infernal';
 const beforeLocale=run('projectText()');
 const localeCases=[
  ['zh-Hans','保存','圣骑士','炼狱叱喝','规则','种族'],
  ['en','Save','Paladin','Hellish Rebuke','Rules','Species'],
  ['ja','保存','パラディン','ヘリッシュ・リビューク','ルール','種族'],
  ['ko','저장','팔라딘','지옥의 질책','규칙','종족'],
  ['zh-Hant','存檔','聖騎士','煉獄叱喝','規則','種族']
 ];
 for(const [language,save,job,spell,rules,species] of localeCases) {
  nodes.language.value=language;
  nodes.language.onchange();
  assert.equal(root.lang,language);
  assert.equal(nodes.save.textContent,save);
  assert.equal(nodes.rules.textContent,rules);
  assert.equal(nodes.legend.children[0].textContent,species);
  assert.ok(nodes.byline.textContent.includes(job));
  assert.ok(find(nodes.board,e=>e.textContent===spell).length);
  assert.equal(preferences.get('dnd-spell-prep.language'),language);
  assert.equal(run('projectText()'),beforeLocale);
  nodes.rules.click();
  assert.ok(all(e=>e.tag==='legend').length>=4);
  nodes.closeEditor.click();
 }
 nodes.language.value='en';nodes.language.onchange();
 const preset=run("allSpells(cNow()).find(s=>s.name==='Hellish Rebuke')");
 scope.preset=preset;
 run('spellEditor(preset)');
 label('Spell text').value='At my table';
 await submit();
 assert.equal(run("cNow().presets[preset.id].name"),undefined);
 await nodes.save.onclick();
 await nodes.open.onclick();
 nodes.language.value='ja';nodes.language.onchange();
 assert.ok(find(nodes.board,e=>e.textContent==='ヘリッシュ・リビューク').length);
 assert.ok(find(nodes.board,e=>e.textContent==='At my table').length);
 assert.equal(run("browserLocale('zh-HK')"),'zh-Hant');
 assert.equal(run("browserLocale('zh-CN')"),'zh-Hans');
 assert.equal(run("browserLocale('fr-FR')"),'en');
 console.log('Passed five-language switching, localized presets, and save compatibility');
 console.log('Passed rules, form interactions, source colors, casting, recovery, PNG roundtrip, save/load, independent character state, both turn rules, and confirmed log reset');
})().catch(e=>{console.error(e);process.exitCode=1;});
