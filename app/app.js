'use strict';
const $ = id => document.getElementById(id);
const editor = $('editor');
const viewer = $('viewer');
const id = () => globalThis.crypto?.randomUUID?.()||'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
const arr9 = fill => Array(9).fill(fill);
const own = (o,k) => Object.prototype.hasOwnProperty.call(o,k);
const str = (v,n=160) => typeof v==='string'?v.slice(0,n):'';
const img = v => typeof v==='string'&&/^data:image\/(?:png|jpeg|webp|gif);base64,[\w+/=]+$/i.test(v)?v:'';
const TYPES = {
 slot:'消耗法術位',free:'不限次數，不耗法術位',long:'獨立次數｜長休恢復',
 short:'獨立次數｜短休或長休恢復',manual:'獨立次數｜手動恢復',
 slotLong:'消耗法術位與獨立次數｜長休恢復',
 slotShort:'消耗法術位與獨立次數｜短休或長休恢復',slotManual:'消耗法術位與獨立次數｜手動恢復'
};
const SOURCES = {primary:'主職業',secondary:'副職業',innate:'種族',other:'其他'};
const limited = s=>!['free','slot'].includes(s.mode);
const needsSlot = s=>s.mode==='slot'||s.mode.startsWith('slot');
const title = c=>c.name||t('未命名角色');
function newCharacter() {
 return {id:id(),name:'',species:'human',speciesName:'',jobs:[{job:'wizard',level:1}],rules:defaults(2024),
  override:arr9(null),pactRing:null,pactMax:null,used:arr9(0),pactUsed:0,spellUsed:{},
  features:{},spells:[],presets:{},turn:emptyTurn(),log:[]};
}
function jobName(row) {return row.job==='custom'&&row.name?row.name:t(CLASSES[row.job]);}
function origin(c,s) {
 if(s.area==='innate') return 'innate';
 const job = s.id.startsWith('arcanum:')?'warlock':s.id.startsWith('signature:')?'wizard':s.id==='hunter'?'ranger':'';
 if(job) return c.jobs[0].job===job?'primary':'secondary';
 return s.origin||'other';
}
function allSpells(c) {
 const presets=autoCards(c).map(s=>({...s,name:c.presets[s.id]?.name||t(s.name)}));
 return [...presets,...c.spells];
}
const fallback = newCharacter();
let project = {version:1,active:fallback.id,characters:[fallback]};
let dirty = false;
let revision = 0;
let fileHandle = null;
let fileName = '';
let fileBusy = false;
let toastTimer;
const undo = new Map();
function cNow() {return project.characters.find(c=>c.id===project.active);}
function toast(message) {
 clearTimeout(toastTimer);
 $('toast').textContent=message;
 $('toast').hidden=false;
 toastTimer=setTimeout(()=>$('toast').hidden=true,4100);
}
function element(tag,cls='',content='') {
 const e = document.createElement(tag);
 if(cls) e.className=cls;
 if(content) e.textContent=content;
 return e;
}
function btn(label,fn,cls='') {
 const e=element('button',cls,label);
 e.type='button';
 e.addEventListener('click',fn);
 return e;
}
function input(type,value='') {
 const e=element('input');
 e.type=type;
 e.value=value??'';
 return e;
}
function number(value,min=0,max=99) {
 const e=input('number',value);
 e.min=min;
 e.max=max;
 e.step=1;
 return e;
}
function select(options,value) {
 const e=element('select');
 for(const [key,label] of options) {
  const option=element('option','',t(label));
  option.value=key;
  if(String(key)===String(value)) option.selected=true;
  e.append(option);
 }
 return e;
}
function field(label,control) {
 const e=element('label','field');
 e.append(element('span','',t(label)),control);
 return e;
}
function check(label,on) {
 const control=input('checkbox');
 control.checked=!!on;
 const e=element('label','check');
 e.append(control,element('span','',t(label)));
 return [e,control];
}
function mark() {
 revision++;
 dirty=true;
 renderFile();
}
function renderFile() {
 $('fileState').textContent=(fileName||t('新專案'))+(dirty?' · '+t('有未存變更'):'');
}
function log(c,message) {
 const clock = new Date().toLocaleTimeString('en-GB',{hourCycle:'h23',hour:'2-digit',minute:'2-digit',second:'2-digit'});
 const day = new Intl.DateTimeFormat('sv-SE').format(new Date());
 c.log.push('['+day+' '+clock+'] '+message);
 mark();
}
function undoPoint(c) {
 undo.set(c.id,{
  used:[...c.used],pactUsed:c.pactUsed,spellUsed:{...c.spellUsed},features:{...c.features},turn:{...c.turn},
  last:c.log.length
 });
}
function update(c,message) {
 log(c,message);
 render();
}
function ratio(max,used) {
 const left=poolLeft(max,used);
 const group=element('span','ratio',left+'／'+max+(used>max?t('（已用 {0}）',used):''));
 group.title=t('剩餘 {0}，已用 {1}，上限 {2}',left,used,max);
 return group;
}
function stars(max,used) {
 const left=poolLeft(max,used);
 const clipped=Math.min(max,10);
 const solid=Math.min(left,clipped);
 const e=element('span','stars','★'.repeat(solid)+'☆'.repeat(clipped-solid)+(max>clipped?'…':''));
 e.setAttribute('aria-hidden','true');
 return e;
}
function render() {
 const c=cNow(), p=pools(c);
 const tabs=$('tabs');
 const tabScroll=tabs.scrollLeft;
 tabs.replaceChildren();
 for(const role of project.characters) {
  const isActive = role.id===c.id;
  const b=btn(title(role),()=>{
   if(isActive) return;
   project.active=role.id;
   mark();
   render();
   $('board').scrollLeft=0;
  });
  b.setAttribute('aria-current',String(isActive));
  tabs.append(b);
 }
 tabs.append(btn(t('＋ 新增角色'),()=>character(true)));
 tabs.scrollLeft=tabScroll;
 $('name').textContent=title(c);
 const detail=[c.species==='custom'?(c.speciesName||t(SPECIES.custom)):t(SPECIES[c.species]),
  t('總等級 {0}',c.jobs.reduce((sum,row)=>sum+row.level,0)),...c.jobs.map(row=>jobName(row)+' '+row.level+(row.specialty?'（'+row.specialty+'）':''))];
 if(p.effective!==null) detail.push(t('兼職施法者等級 {0}',p.effective));
 $('byline').textContent=detail.join(' · ');
 $('cunning').hidden=!(c.rules.cunning24&&p.war>=2);
 $('cunning').disabled=c.features.cunning||!c.pactUsed||!p.pact.max;
 const sum=$('summary');
 sum.replaceChildren();
 function entry(label,max,used) {
  const e=element('div','summary-entry');
  e.append(element('b','',label),stars(max,used),ratio(max,used));
  sum.append(e);
 }
 p.slots.forEach((max,i)=>{if(max||c.used[i]) entry(t(RINGS[i+1]),max,c.used[i]);});
 if(p.pact.max||c.pactUsed) entry(t('契約・{0}',p.pact.ring?t(RINGS[p.pact.ring]):t('未設定')),p.pact.max,c.pactUsed);
 if(!sum.childElementCount) sum.append(element('small','',t('目前沒有法術位')));
 $('turnBar').hidden=!tracksTurns(c.rules);
 $('turnState').textContent=t('第 {0} 回合',c.turn.number);
 const turnStatus=[];
 if(c.rules.turn14) turnStatus.push(c.turn.bonus?t('2014：已用附贈動作施法'):t('2014：附贈動作施法限制'));
 if(c.rules.turn24) turnStatus.push(c.turn.slot?t('2024：已消耗法術位'):t('2024：可消耗 1 個法術位'));
 $('turnRuleState').textContent=turnStatus.join(' · ');
 renderBoard(c,p);
 $('log').value=c.log.join('\n');
 $('log').scrollTop=$('log').scrollHeight;
 $('undo').disabled=!undo.has(c.id);
 $('copy').disabled=$('exportTxt').disabled=$('resetLog').disabled=!c.log.length;
 renderFile();
}
function castOptions(c,p,s) {
 const options=[];
 const spent = c.spellUsed[s.id]||0;
 const canUseCharge = !limited(s)||spent<s.count;
 if(!needsSlot(s)) {
  if(!limited(s)||canUseCharge) options.push(['free',s.mode==='free'?t('不耗法術位'):t('使用獨立次數')]);
  if(!s.also) return options;
 } else if(!canUseCharge) return options;
 p.slots.forEach((max,i)=>{
  if(i+1>=s.ring&&poolLeft(max,c.used[i])) options.push(['slot:'+i,t('{0}法術位',t(RINGS[i+1]))]);
 });
 if(p.pact.ring>=s.ring&&poolLeft(p.pact.max,c.pactUsed)) options.push(['pact',t('契約・{0}',t(RINGS[p.pact.ring]))]);
 return options;
}
function castChoices(c,p,s) {
 const options=[];
 let reason='';
 for(const option of castOptions(c,p,s)) {
  const blocked=castBlocked(c.rules,c.turn,s,option[0]!=='free');
  if(blocked) reason=t(blocked);
  else options.push(option);
 }
 return {options,reason};
}
function cast(c,s,mode) {
 const p=pools(c);
 const option=castChoices(c,p,s).options.find(([value])=>value===mode);
 if (!option) return;
 undoPoint(c);
 const consumesCharge = limited(s)&&(mode==='free'||needsSlot(s));
 if(consumesCharge) c.spellUsed[s.id]=(c.spellUsed[s.id]||0)+1;
 if(mode==='pact') c.pactUsed++;
 if(mode.startsWith('slot:')) c.used[Number(mode.split(':')[1])]++;
 const freeRing = (s.freeRing>s.ring&&mode==='free')?' · '+t('{0}施放',t(RINGS[s.freeRing])):'';
 const leftCharge = consumesCharge?' · '+t('獨立剩 {0}／{1}',poolLeft(s.count,c.spellUsed[s.id]),s.count):'';
 const useSlot = mode==='pact'?' · '+t('剩 {0}／{1}',poolLeft(p.pact.max,c.pactUsed),p.pact.max):
  mode.startsWith('slot:')?(()=>{const i=+mode.split(':')[1];return ' · '+t('剩 {0}／{1}',poolLeft(p.slots[i],c.used[i]),p.slots[i]);})():'';
 const track=tracksTurns(c.rules);
 if(track) recordTurn(c.turn,s,mode!=='free');
 const turnLabel=track?t('第 {0} 回合',c.turn.number)+' · '+t(CAST_TIMES[s.castTime||'action'])+' · ':'';
 update(c,turnLabel+t('施放 {0}（{1}）',s.name,option[1]+freeRing+useSlot+leftCharge));
}
function renderBoard(c,p) {
 const board=$('board');
 const scroll = board.scrollLeft;
 const spells=allSpells(c);
 let highest = Math.max(1,p.pact.ring);
 p.slots.forEach((n,i)=>{if(n||c.used[i]) highest=Math.max(i+1,highest);});
 spells.forEach(s=>{if(s.area!=='innate') highest=Math.max(highest,s.ring);});
 board.replaceChildren();
 $('legend').replaceChildren(...['innate','primary','secondary'].map(source=>
  element('span','origin-'+source,t(SOURCES[source]))));
 for(const key of [...Array.from({length:highest},(_,i)=>i+1),0,'innate']) {
  const lane=element('section','lane');
  const label=key==='innate'?t('種族先天法術'):t(RINGS[key]);
  const header=element('header','lane-head');
  const add=btn('＋',()=>spellEditor(null,key));
  add.setAttribute('aria-label',t('新增{0}',label));
  header.append(element('h3','',label),add);
  const laneCards=element('div','lane-cards');
  const cards=spells.filter(s=>key==='innate'?s.area==='innate':s.area!=='innate'&&s.ring===key);
  if(!cards.length) laneCards.append(element('p','empty',t('新增文字或拖曳法術卡圖片')));
  for(const s of cards) laneCards.append(card(c,p,s));
  lane.append(header,laneCards);
  allowDrop(lane,files=>spellEditor(null,key,files));
  board.append(lane);
 }
 board.scrollLeft=scroll;
}
function card(c,p,s) {
 const used=c.spellUsed[s.id]||0;
 const {options,reason}=castChoices(c,p,s);
 const source=origin(c,s);
 const e=element('article','spell origin-'+source+(!options.length||(limited(s)&&used>=s.count)?' spent':''));
 const picture=s.front||s.back;
 if(picture) {
  const image=document.createElement('img');
  image.alt=t('{0}法術卡',s.name);
  image.src=picture;
  image.loading='lazy';
  const art=btn('',()=>view(s),'art');
  art.setAttribute('aria-label',t('放大 {0}',s.name));
  art.append(image);
  e.append(art);
 }
 const body=element('div','spell-body');
 const head=element('div','spell-title');
 const edit=btn(t('編輯'),()=>spellEditor(s),'tiny');
 edit.setAttribute('aria-label',t('編輯 {0}',s.name));
 head.append(element('strong','',s.name),edit);
 body.append(head);
 const badges=element('div','spell-meta');
 badges.append(element('span','source-label',t(SOURCES[source])));
 if(tracksTurns(c.rules)) badges.append(element('span','',t(CAST_TIMES[s.castTime||'action'])));
 if(s.source&&s.source!=='種族法術') badges.append(element('span','',t(s.source)));
 if(s.area==='innate') badges.append(element('span','',t(RINGS[s.ring])));
 if(s.front&&s.back) badges.append(element('span','',t('正／反')));
 body.append(badges);
 if(s.notes) body.append(element('p','',s.notes));
 const end=element('div','spell-end');
 if(limited(s)) {
  const remain=element('div','spell-meta');
  const rest=/short/i.test(s.mode)?t('短休／長休'):/long/i.test(s.mode)?t('長休'):t('手動恢復');
  remain.append(stars(s.count,used),ratio(s.count,used),element('span','',rest));
  end.append(remain);
 }
 const use=btn(t('使用'),()=>cast(c,s,choice?.value||options[0]?.[0]),'cast');
 use.disabled=!options.length;
 use.setAttribute('aria-label',t('使用 {0}',s.name));
 let choice;
 if(options.length>1 || (options.length===1&&options[0][0]!=='free')) {
  choice=select(options,options[0][0]);
  choice.setAttribute('aria-label',t('施放方式 {0}',s.name));
  const row=element('div','cast-row');
  row.append(choice,use);
  end.append(row);
 } else {
  if(!options.length) use.textContent=reason?t('本回合無法使用'):t('無可用次數');
  end.append(use);
  if(reason) end.append(element('small','turn-block',reason));
 }
 body.append(end);
 e.append(body);
 return e;
}
function dialog(label,submitLabel,build,submit,destructive=false) {
 const body=$('dialogBody');
 const form=element('form','form');
 form.noValidate=false;
 let err;
 const actions=element('div','form-buttons');
 const clear=()=>editor.close();
 const confirm=element('button',destructive?'danger':'primary',submitLabel);
 confirm.type='submit';
 build(form,actions,errText=>err.textContent=errText);
 err=element('p','form-error');
 err.setAttribute('role','alert');
 const cancel=btn(t('取消'),clear);
 if(destructive) cancel.autofocus=true;
 actions.append(cancel,confirm);
 form.append(err,actions);
 form.onsubmit=async event=>{
  event.preventDefault();
  err.textContent='';
  confirm.disabled=true;
  try {
   const message=await submit();
   if(message) err.textContent=message;
   else editor.close();
  } catch(error) {
   err.textContent=error.message||t('操作未完成，請重試。');
  } finally {
   confirm.disabled=false;
  }
 };
 $('dialogTitle').textContent=t(label);
 body.replaceChildren(form);
 if(!editor.open) editor.showModal();
}
function group() {return element('div','form-grid');}
function section(name) {
 const e=element('fieldset');
 e.append(element('legend','',t(name)));
 return e;
}
function character(isNew=false) {
 const original=isNew?newCharacter():cNow();
 let name,species,customSpecies,rows,keep,year;
 const jobControls=[];
 function jobRow(job,level,sub=false,custom='',main=false,specialty='') {
  const row=element('div','job');
  const jobLabel=main?t('主職業'):t('副職業');
  const jobLevelLabel=main?t('主職業等級'):t('副職業等級');
  const labelOptions=Object.entries(CLASSES);
  if(!main) labelOptions.unshift(['',t('選擇副職業')]);
  const which=select(labelOptions,job);
  const lvl=number(level,1,20);
  lvl.placeholder='1–20';
  const more=element('div','job-extra');
  const subclass=input('text',specialty);
  subclass.maxLength=50;
  subclass.placeholder=t('子職業名稱');
  subclass.setAttribute('aria-label',t('{0}的子職業',jobLabel));
  const subField=field(t('子職業（選填）'),subclass);
  subField.classList.add('job-sub');
  const details={row,which,lvl,subclass,getExtra:()=>({})};
  const sync=(existingSub=false,existingName='')=>{
   more.replaceChildren();
   const enabled=!!which.value;
   lvl.disabled=!enabled;
   lvl.required=enabled;
   subField.hidden=!enabled;
   if(SUBS[which.value]) {
    const [label,box]=check(SUBS[which.value][0],existingSub);
    more.append(label);
    details.getExtra=()=>({sub:box.checked});
   } else if(which.value==='custom') {
    const customName=input('text',existingName);
    customName.placeholder=t('輸入職業名稱');
    customName.maxLength=50;
    customName.required=true;
    more.append(field(t('自訂職業名稱'),customName));
    details.getExtra=()=>({name:customName.value.trim()});
   } else details.getExtra=()=>({});
  };
  which.onchange=()=>{
   if(which.value&&!lvl.value) lvl.value='1';
   sync();
  };
  which.setAttribute('aria-label',jobLabel);
  lvl.setAttribute('aria-label',t(jobLevelLabel));
  row.append(field(jobLabel,which),field(jobLevelLabel,lvl));
  if(!main) row.append(btn(t('移除'),()=>{jobControls.splice(jobControls.indexOf(details),1);row.remove();},'tiny danger job-remove'));
  row.append(subField,more);
  rows.append(row);
  jobControls.push(details);
  sync(sub,custom);
 }
 dialog(isNew?t('新增角色'):t('編輯角色'),isNew?t('建立角色'):t('套用設定'),(form,actions)=>{
  const info=group();
  name=input('text',original.name);
  name.placeholder=t('輸入角色名稱');
  name.required=true;
  name.maxLength=80;
  species=select(Object.entries(SPECIES),original.species);
  customSpecies=input('text',original.speciesName);
  customSpecies.maxLength=50;
  const custom=field(t('種族名稱'),customSpecies);
  species.onchange=()=>{custom.hidden=species.value!=='custom';customSpecies.required=!custom.hidden;};
  species.onchange();
  info.append(field(t('角色名稱'),name),field(t('種族'),species),custom);
  if(isNew) {
   year=select([[2024,'2024｜5.5e'],[2014,'2014｜5e']],2024);
   info.append(field(t('起始規則範本'),year));
  }
  form.append(info);
  rows=section(t('主職業與副職業等級'));
  const jobs=element('div');
  rows.append(jobs);
  form.append(rows);
  rows=jobs;
  original.jobs.forEach((row,i)=>jobRow(row.job,row.level,row.sub,row.name,i===0,row.specialty));
  if(original.jobs.length===1) jobRow('','');
  form.append(btn(t('＋ 新增副職業'),()=>jobRow('','')));
  if(!isNew) {
   const retained=check(t('保留已消耗的法術位與獨立次數'),true);
   keep=retained[1];
   form.append(retained[0],element('small','',t('法術位自動依新等級計算。先前手填的格數保留，可在「調整法術位／次數」還原自動。')));
   if(project.characters.length>1) actions.append(btn(t('刪除這個角色'),()=>{
    if(!confirm(t('刪除「{0}」及其法術與紀錄？',title(original)))) return;
    project.characters=project.characters.filter(c=>c.id!==original.id);
    project.active=project.characters[0].id;
    undo.delete(original.id);
    mark();
    editor.close();
    render();
   },'danger push'));
  }
 },()=>{
  const jobs=jobControls.filter(({which})=>which.value).map(({which,lvl,subclass,getExtra})=>({job:which.value,level:+lvl.value,specialty:subclass.value.trim(),...getExtra()}));
  if(!name.value.trim()) return t('請輸入角色名稱。');
  if(species.value==='custom'&&!customSpecies.value.trim()) return t('請輸入種族名稱。');
  if(jobs.some(row=>!Number.isInteger(row.level)||row.level<1||row.level>20)) return t('請輸入 1 到 20 之間的職業等級。');
  if(jobs.some(row=>row.job==='custom'&&!row.name)) return t('請輸入自訂職業名稱。');
  if(new Set(jobs.map(r=>r.job==='custom'?r.job+':'+r.name.toLowerCase():r.job)).size!==jobs.length) return t('同一職業請合併成一筆等級。');
  if(jobs.reduce((sum,row)=>sum+row.level,0)>20) return t('角色總等級上限為 20。');
  Object.assign(original,{name:name.value.trim(),species:species.value,speciesName:customSpecies.value.trim(),jobs});
  if(isNew) {
   original.rules=defaults(+year.value);
   project.characters.push(original);
   project.active=original.id;
   mark();
   render();
   $('board').scrollLeft=0;
  } else {
   if(!keep.checked) resetUsed(original);
   undo.delete(original.id);
   mark();
   render();
  }
 });
}
function resetUsed(c) {
 c.used=arr9(0);
 c.pactUsed=0;
 c.spellUsed={};
 c.features={};
 c.turn=emptyTurn(c.turn.number);
}
const ruleNames = [['2014｜5e',OLD],['2024｜5.5e',NEW],['兩版共通與兼職',SHARED],['回合施法限制（選用）',TURN_RULES]];
function rules() {
 const c=cNow();
 let keep;
 const boxes={};
 const applyYear=year=>{
  const set=defaults(year);
  for(const [key,box] of Object.entries(boxes)) {
   if(!TURN_RULES.some(([rule])=>rule===key)) box.checked=set[key];
  }
 };
 dialog(t('混用規則'),t('套用規則'),(form)=>{
  const quick=element('div','actions');
  quick.append(btn(t('2014 全套預設'),()=>applyYear(2014)),btn(t('2024 全套預設'),()=>applyYear(2024)));
  form.append(quick,element('small','',t('同類版本規則擇一。關閉兼職合併時，會將各職業自己的法術位逐環相加。兩種兼職折半都未選時，聖騎士／遊俠不計入兼職等級。')));
  for(const [label,list] of ruleNames) {
   const block=section(label);
   for(const [key,text] of list) {
    const [row,box]=check(t(text),c.rules[key]);
    boxes[key]=box;
    box.onchange=()=>{
     const pair=PAIRS.find(p=>p.includes(key));
     if(box.checked&&pair) boxes[pair.find(other=>other!==key)].checked=false;
    };
    block.append(row);
   }
   if(list===TURN_RULES) block.append(element('small','rule-note',t('兩版限制可各自開關，也可同時套用。啟用後，目前角色在新的生物回合施法前，請按「下一回合」。反應例外只影響 2014 附贈動作限制。')));
   form.append(block);
  }
  const retained=check(t('保留已消耗的法術位與獨立次數'),true);
  keep=retained[1];
  form.append(retained[0]);
 },()=>{
  const previouslyTracked=tracksTurns(c.rules);
  c.rules=Object.fromEntries(Object.entries(boxes).map(([key,box])=>[key,box.checked]));
  if(!previouslyTracked&&tracksTurns(c.rules)) c.turn=emptyTurn();
  if(!keep.checked) resetUsed(c);
  undo.delete(c.id);
  mark();
  render();
 });
}
function counts() {
 const c=cNow(), p=pools(c);
 let rows, pactRing,pactMax,pactUsed, charges,day;
 dialog(t('調整法術位／次數'),t('套用調整'),(form,actions)=>{
  form.append(element('small','',t('上限空白代表自動計算，填 0 可關閉該環。已用次數會保留；要補滿請將已用次數設為 0。')));
  const wrap=element('div','table-wrap');
  const table=element('table');
  const heading=element('tr');
  for(const label of [t('環位'),t('計算上限'),t('手動上限'),t('已用次數')]) heading.append(element('th','',t(label)));
  table.append(heading);
  rows=c.override.map((v,i)=>{
   const row=element('tr');
   row.append(element('th','',t(RINGS[i+1])),element('td','',String(p.base[i])));
   const max=number(v), used=number(c.used[i],0,999);
   max.placeholder=t('自動');
   max.setAttribute('aria-label',t('{0}手動上限',t(RINGS[i+1])));
   used.setAttribute('aria-label',t('{0}已用次數',t(RINGS[i+1])));
   const a=element('td'), b=element('td');
   a.append(max); b.append(used); row.append(a,b);
   table.append(row);
   return {max,used};
  });
  wrap.append(table);
  form.append(wrap);
  const pact=section(t('契約法術位'));
  const controls=group();
  pactRing=number(c.pactRing,1,9);
  pactMax=number(c.pactMax);
  pactUsed=number(c.pactUsed,0,999);
  pactRing.placeholder=p.basePact.ring?t(RINGS[p.basePact.ring]):t('自動');
  pactMax.placeholder=String(p.basePact.max);
  controls.append(field(t('契約環位'),pactRing),field(t('手動上限'),pactMax),field(t('已用次數'),pactUsed));
  pact.append(controls);
  form.append(pact);
  const special=section(t('獨立法術次數'));
  const spells=allSpells(c).filter(limited);
  charges=spells.map(s=>{
   const control=number(c.spellUsed[s.id]||0,0,999);
   special.append(field(t('{0}（上限 {1}）已用次數',s.name,s.count),control));
   return [s.id,control];
  });
  if(spells.length) form.append(special);
  if(c.rules.arc14&&classLevel(c,'wizard')) {
   const [row,box]=check(t('2014 奧術恢復：今日已使用'),c.features.arc14);
   day=box;
   form.append(row);
  }
  actions.append(btn(t('補滿次數'),()=>{
   [...rows.map(r=>r.used),pactUsed,...charges.map(([,e])=>e)].forEach(e=>e.value=0);
   if(day) day.checked=false;
  },'push'));
  actions.append(btn(t('上限改回自動'),()=>[...rows.map(r=>r.max),pactRing,pactMax].forEach(e=>e.value='')));
 },()=>{
  const optional=e=>e.value===''?null:+e.value;
  const max=optional(pactMax)??p.basePact.max;
  if(max>0&&!(optional(pactRing)??p.basePact.ring)) return t('請設定契約環位。');
  c.override=rows.map(r=>optional(r.max));
  c.used=rows.map(r=>+r.used.value);
  c.pactRing=optional(pactRing);c.pactMax=optional(pactMax);c.pactUsed=+pactUsed.value;
  for(const [key,control] of charges) c.spellUsed[key]=+control.value;
  if(day) c.features.arc14=day.checked;
  undo.delete(c.id);
  update(c,t('手動調整法術位與使用次數'));
 });
}
function allowDrop(el,handle) {
 el.ondragover=e=>{
  if(!Array.from(e.dataTransfer.types).includes('Files')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect='copy';
  el.classList.add('drag');
 };
 el.ondragleave=e=>{
  if(!el.contains(e.relatedTarget)) el.classList.remove('drag');
 };
 el.ondrop=e=>{
  if(!e.dataTransfer.files.length) return;
  e.preventDefault();
  e.stopPropagation();
  el.classList.remove('drag');
  handle([...e.dataTransfer.files]);
 };
}
function readImage(file) {
 const types={png:'png',jpg:'jpeg',jpeg:'jpeg',webp:'webp',gif:'gif'};
 const kind=types[file.name.split('.').pop().toLowerCase()];
 if(!kind||file.size>16*1024*1024) return Promise.reject(new Error(t('請選擇 16 MB 以內的 PNG、JPG、WebP 或 GIF 圖片。')));
 return new Promise((resolve,reject)=>{
  const reader=new FileReader();
  reader.onerror=()=>reject(new Error(t('圖片讀取失敗。')));
  reader.onload=()=>{
   const value='data:image/'+kind+';base64,'+reader.result.split(',')[1];
   const sample=new Image();
   sample.onload=()=>resolve(value);
   sample.onerror=()=>reject(new Error(t('圖片無法顯示，請確認檔案格式。')));
   sample.src=value;
  };
  reader.readAsDataURL(file);
 });
}
function spellEditor(original,key=1,incoming=[]) {
 const c=cNow();
 const s=original||{id:id(),name:'',ring:key==='innate'?1:key,area:key==='innate'?'innate':'',
  origin:'primary',mode:key==='innate'?'long':key===0?'free':'slot',count:1};
 const pics={front:s.front||'',back:s.back||''};
 let name,notes,source,ring,mode,castTime,charge,alternate,formReady;
 const setters={};
 function imageField(label,key,report) {
  const drop=element('div','drop');
  const preview=element('img');
  preview.alt=t(label);
  const pick=input('file');
  pick.accept='.png,.jpg,.jpeg,.webp,.gif';
  pick.setAttribute('aria-label',t('{0}圖片',label));
  const sync=()=>{
   preview.hidden=!pics[key];
   if(pics[key]) preview.src=pics[key];
   else preview.removeAttribute('src');
  };
  const set=async file=>{
   if(!file) return;
   try {
    report('');
    pics[key]=await readImage(file);
    sync();
    if(!name.value&&key==='front') name.value=file.name.replace(/\.[^.]+$/,'').slice(0,110);
   } catch(error) {report(error.message);}
  };
  setters[key]=file=>{
   formReady=Promise.all([formReady,set(file)]);
  };
  pick.onchange=()=>{setters[key](pick.files[0]);pick.value='';};
  allowDrop(drop,files=>setters[key](files[0]));
  const bar=element('div','actions');
  bar.append(element('b','',t(label)),btn(t('移除圖片'),()=>{pics[key]='';sync();},'tiny'));
  drop.append(bar,preview,pick,element('small','',t('可拖曳圖片到此')));
  sync();
  return drop;
 }
 dialog(original?t('編輯法術'):t('新增法術'),t('儲存法術'),(form,actions,report)=>{
  const fields=group();
  name=input('text',s.name);
  name.required=true;
  name.maxLength=110;
  source=select(Object.entries(SOURCES),origin(c,s));
  ring=select(RINGS.map((v,i)=>[i,v]),s.ring);
  notes=element('textarea');
  notes.value=s.notes||'';
  notes.maxLength=10000;
  notes.placeholder=t('施放條件、來源、效果或團規');
  mode=select(Object.entries(TYPES),s.mode);
  castTime=select(Object.entries(CAST_TIMES),s.castTime||'action');
  charge=number(s.count||1,1,99);
  const [altLabel,box]=check(t('也允許消耗法術位施放'),s.also);
  alternate=box;
  const counter=field(t('獨立次數上限'),charge);
  const sync= e=>{
   if(e?.target===ring&&+ring.value===0&&mode.value.startsWith('slot')) mode.value='free';
   if(e?.target===ring&&+ring.value>0&&s.ring===0&&mode.value==='free') mode.value='slot';
   counter.hidden=!limited({mode:mode.value});
   altLabel.hidden=+ring.value===0||!limited({mode:mode.value})||needsSlot({mode:mode.value});
  };
  ring.onchange=mode.onchange=sync;
  if(s.preset) {
   source.disabled=ring.disabled=mode.disabled=charge.disabled=alternate.disabled=true;
  }
  fields.append(field(t('法術名稱'),name),field(t('取得來源'),source),field(t('基礎環位'),ring),field(t('施放動作'),castTime),field(t('施放方式'),mode),counter);
  sync();
  form.append(fields,altLabel,field(t('法術文字'),notes));
  if(s.preset) form.append(element('small','',t('此法術的環位與計次由角色的規則範本控制。')));
  const art=group();
  art.append(imageField(t('正面'),'front',report),imageField(t('反面'),'back',report));
  form.append(art);
  if(original&&!s.preset) {
   actions.append(btn(t('刪除法術'),()=>{
    if(!confirm(t('刪除「{0}」？',s.name))) return;
    c.spells=c.spells.filter(item=>item.id!==s.id);
    delete c.spellUsed[s.id];
    undo.delete(c.id);
    mark();
    render();
    editor.close();
   },'danger push'));
  }
 },async ()=>{
  await formReady;
  const n=name.value.trim();
  if(!n) return t('請輸入法術名稱。');
  if(!s.preset&&+ring.value===0&&needsSlot({mode:mode.value})) return t('戲法不消耗環位法術位，請調整施放方式。');
  const text={name:n,notes:notes.value.trim(),castTime:castTime.value,...pics};
  if(s.preset) {
   const baseName=autoCards({...c,presets:{}}).find(item=>item.id===s.id)?.name;
   if(!c.presets[s.id]?.name&&n===t(baseName)) delete text.name;
   c.presets[s.id]=text;
  }
  else {
   const changed={id:s.id,...text,origin:source.value,area:source.value==='innate'?'innate':'',
    ring:+ring.value,mode:mode.value,count:+charge.value,also:!alternate.parentElement.hidden&&alternate.checked};
   if(original) c.spells=c.spells.map(item=>item.id===s.id?changed:item);
   else c.spells.push(changed);
  }
  undo.delete(c.id);
  mark();
  const oldColumns=$('board').childElementCount;
  render();
  if(!original && $('board').childElementCount>oldColumns && +ring.value) {
   $('board').children[+ring.value-1]?.scrollIntoView({block:'nearest',inline:'nearest'});
  }
 });
 if(incoming[0]) setters.front(incoming[0]);
 if(incoming[1]) setters.back(incoming[1]);
}
function view(s) {
 let back=!s.front;
 const toggle=$('backSide');
 const flip=()=>{
  $('viewImage').src=back?s.back:s.front;
  $('viewTitle').textContent=s.name+'｜'+(back?t('反面'):t('正面'));
  toggle.textContent=back?t('顯示正面'):t('顯示反面');
 };
 toggle.hidden=!(s.front&&s.back);
 toggle.onclick=()=>{back=!back;flip();};
 flip();
 viewer.showModal();
}
function recover(long) {
 const c=cNow(), p=pools(c);
 const restoreOptions=[];
 function getRecovery(key,label,level) {
  if(level) restoreOptions.push({key,label,budget:Math.ceil(level/2),available:!c.features[key]});
 }
 if(c.rules.arc14||c.rules.arc24) getRecovery(c.rules.arc14?'arc14':'arc24',t('奧術恢復'),classLevel(c,'wizard'));
 const druid=classLevel(c,'druid',true);
 if((c.rules.land14&&druid>=2)||(c.rules.land24&&druid>=6)) getRecovery('land',t('自然恢復'),druid);
 let day;
 dialog(long?t('長休'):t('短休'),long?t('完成長休'):t('完成短休'),form=>{
  const items=[];
  if(long&&c.rules.longSlots) items.push(t('一般法術位'));
  if(c.rules[long?'pactLong':'pactShort']&&p.pact.max) items.push(t('契約法術位'));
  const spells=allSpells(c);
  if(spells.some(s=>/short/i.test(s.mode)||(long&&/long/i.test(s.mode)))) items.push(t('符合休息條件的獨立法術次數'));
  form.append(element('p','',items.length?t('恢復：{0}。',new Intl.ListFormat(locale).format(items)):t('這次休息不會自動恢復目前角色的法術資源。')));
  if(long&&c.rules.arc14&&classLevel(c,'wizard')) {
   const [row,box]=check(t('團內已進入新的一天，重置 2014 奧術恢復'),false);
   day=box;
   form.append(row);
  }
  if(long) return;
  for(const recovery of restoreOptions) {
   const block=section(recovery.label);
   if(!recovery.available) {
    block.append(element('small','',recovery.key==='arc14'?t('已使用，待團內換日。'):t('已使用，待長休。')));
   } else {
    block.append(element('small','',t('可恢復合計 {0} 環的已用法術位，限一至五環。',recovery.budget)));
    const grid=group();
    recovery.rows=[];
    for(let i=0;i<5;i++) {
     if(!(p.slots[i]&&c.used[i])) continue;
     const value=number(0,0,Math.min(c.used[i],p.slots[i]));
     recovery.rows.push([i,value]);
     grid.append(field(t('{0}恢復幾格',t(RINGS[i+1])),value));
    }
    if(recovery.rows.length) block.append(grid);
    else block.append(element('p','muted',t('目前沒有可恢復的法術位。')));
   }
   form.append(block);
  }
 },()=>{
  const restore=arr9(0);
  const paid=[];
  const extra=[];
  if(!long) for(const {key,label,budget,rows} of restoreOptions) {
   if(!rows) continue;
   const sum=rows.reduce((total,[i,e])=>total+(i+1)*(+e.value),0);
   if(!sum) continue;
   if(sum>budget) return t('{0}超過 {1} 環的上限。',label,budget);
   for(const [i,e] of rows) restore[i]+=+e.value;
   paid.push(key);
   extra.push(label+' '+rows.filter(([,e])=>+e.value).map(([i,e])=>t(RINGS[i+1])+'×'+e.value).join('、'));
  }
  if(restore.some((n,i)=>n>Math.min(c.used[i],p.slots[i]))) return t('恢復的格數超過可恢復的已用法術位。');
  undoPoint(c);
  if(long&&c.rules.longSlots) c.used=arr9(0);
  if(c.rules[long?'pactLong':'pactShort']) c.pactUsed=0;
  const current=new Map(allSpells(c).map(s=>[s.id,s.mode]));
  for(const key of Object.keys(c.spellUsed)) {
   const mode=current.get(key)||(key.startsWith('signature:')?'short':
    /^(innate:|arcanum:|hunter$|land-circle$)/.test(key)?'long':'manual');
   if(/short/i.test(mode)||(long&&/long/i.test(mode))) c.spellUsed[key]=0;
  }
  if(long) {
   const todayUsed=c.features.arc14&&!day?.checked;
   c.features=todayUsed?{arc14:true}:{};
  } else {
   c.used=c.used.map((value,i)=>value-restore[i]);
   for(const key of paid) c.features[key]=true;
  }
  c.turn=emptyTurn(c.turn.number);
  update(c,(long?t('長休'):t('短休'))+(extra.length?'（'+extra.join('；')+'）':''));
 });
}
function cunning() {
 const c=cNow(), p=pools(c);
 if(!c.rules.cunning24||p.war<2||c.features.cunning) return;
 const count=Math.min(c.pactUsed,Math.ceil(p.pact.max/2));
 if(!count) return;
 undoPoint(c);
 c.pactUsed-=count;
 c.features.cunning=true;
 update(c,t('使用魔法巧計，恢復 {0} 格契約法術位',count));
}
function note() {
 const c=cNow();
 let content;
 dialog(t('新增戰鬥備註'),t('加入紀錄'),form=>{
  content=element('textarea');
  content.required=true;
  content.maxLength=4000;
  form.append(field(t('備註內容'),content));
 },()=>{
  if(!content.value.trim()) return t('請輸入備註。');
  update(c,t('備註 · {0}',content.value.trim()));
 });
}
function unpack(raw) {
 const obj=v=>v&&typeof v==='object'&&!Array.isArray(v);
 const strict=(v,msg)=>{if(!v) throw new Error(msg);};
 strict(obj(raw)&&raw.version===1&&Array.isArray(raw.characters)&&raw.characters.length,t('這不是可辨識的法術整備存檔。'));
 const characterIds=new Set();
 const characters=raw.characters.map((item,index)=>{
  const msg=t('角色 {0} 的資料不完整。',index+1);
  strict(obj(item)&&Array.isArray(item.jobs)&&item.jobs.length&&Array.isArray(item.spells)&&Array.isArray(item.log),msg);
  const c=newCharacter();
  if(/^[A-Za-z0-9-]{1,80}$/.test(item.id)&&!characterIds.has(item.id)) c.id=item.id;
  characterIds.add(c.id);
  c.name=str(item.name,80);
  c.species=own(SPECIES,item.species)?item.species:'human';
  c.speciesName=str(item.speciesName,50);
  c.jobs=item.jobs.map(row=>{
   strict(obj(row)&&own(CLASSES,row.job)&&Number.isInteger(row.level)&&row.level>0&&row.level<=20,msg);
   return {job:row.job,level:row.level,sub:!!row.sub&&own(SUBS,row.job),name:str(row.name,50),specialty:str(row.specialty,50)};
  });
  strict(c.jobs.reduce((n,r)=>n+r.level,0)<=20,msg);
  strict(new Set(c.jobs.map(r=>r.job==='custom'?r.job+':'+r.name.toLowerCase():r.job)).size===c.jobs.length,msg);
  const r=obj(item.rules)?item.rules:{};
  for(const key of Object.keys(c.rules)) if(typeof r[key]==='boolean') c.rules[key]=r[key];
  for(const [old,next] of PAIRS) if(c.rules[old]&&c.rules[next]) c.rules[old]=false;
  c.override=c.override.map((_,i)=>item.override?.[i]==null?null:num(item.override[i]));
  c.used=c.used.map((_,i)=>num(item.used?.[i],999));
  c.pactRing=item.pactRing==null?null:Math.max(1,num(item.pactRing,9));
  c.pactMax=item.pactMax==null?null:num(item.pactMax);
  c.pactUsed=num(item.pactUsed,999);
  if(pools(c).pact.max&&!pools(c).pact.ring) c.pactRing=1;
  for(const key of ['arc14','arc24','land','cunning']) c.features[key]=!!item.features?.[key];
  const keys=new Set();
  const validKey=key=>/^[A-Za-z0-9:-]{1,90}$/.test(key)&&!['constructor','prototype','toString','valueOf'].includes(key);
  const presetKey=key=>/^(innate:(?:14|24):[a-z]+:\d|arcanum:[0-3]|signature:[01]|hunter|land-circle)$/.test(key);
  const text=s=>({name:str(s.name,110),notes:str(s.notes,10000),front:img(s.front),back:img(s.back),
   ...(own(CAST_TIMES,s.castTime)?{castTime:s.castTime}:{})});
  c.spells=item.spells.map(s=>{
   strict(obj(s)&&validKey(s.id)&&!presetKey(s.id)&&!keys.has(s.id)&&own(TYPES,s.mode),msg);
   keys.add(s.id);
   const origin=own(SOURCES,s.origin)?s.origin:s.area==='innate'?'innate':'other';
   const ring=num(s.ring,9);
   return {id:s.id,...text(s),ring,mode:!ring&&needsSlot(s)?'free':s.mode,
    count:Math.max(1,num(s.count)),also:ring>0&&!!s.also,area:origin==='innate'?'innate':'',origin};
  });
  if(obj(item.presets)) for(const [key,s] of Object.entries(item.presets)) {
   if(!presetKey(key)||!obj(s)) continue;
   const preset=text(s);
   if(!preset.name) delete preset.name;
   c.presets[key]=preset;
  }
  if(obj(item.spellUsed)) for(const [key,v] of Object.entries(item.spellUsed)) {
   if(keys.has(key)||presetKey(key)) c.spellUsed[key]=num(v,999);
  }
  if(obj(item.turn)) {
   c.turn=emptyTurn(num(item.turn.number,Number.MAX_SAFE_INTEGER)||1);
   for(const key of ['slot','bonus','other','reaction']) c.turn[key]=item.turn[key]===true;
  }
  c.log=item.log.filter(line=>typeof line==='string'&&!/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] 更新角色設定（(?:保留|重設)已用次數）$/.test(line));
  return c;
 });
 return {version:1,active:characters.some(c=>c.id===raw.active)?raw.active:characters[0].id,characters};
}
const fileType = () => ({description:t('D&D 法術整備存檔'),accept:{'application/json':['.dndprep','.json']}});
const saveTitle = ()=>(cNow().name||t('法術整備')).replace(/[<>:"/\\|?*\u0000-\u001F]/g,'_');
function download(text,name,type) {
 const url=URL.createObjectURL(new Blob([text],{type}));
 const a=element('a');
 a.href=url;
 a.download=name;
 document.body.append(a);
 a.click();
 a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),30000);
}
function markSaved() {
 dirty=false;
 renderFile();
}
function projectText() {
 const data=JSON.stringify(project);
 if(new Blob([data]).size>200*1024*1024) throw new Error(t('存檔超過 200 MB，請縮小法術卡圖片。'));
 return data;
}
async function save(as=false) {
 if(fileBusy) return;
 fileBusy=true;
 try {
  if(window.showSaveFilePicker) {
   try {
    let destination=fileHandle;
    if(as||!destination) {
     destination=await window.showSaveFilePicker({suggestedName:saveTitle()+'.dndprep',types:[fileType()]});
    }
    const version=revision;
    const contents=projectText();
    const writable=await destination.createWritable();
    try {
     await writable.write(contents);
     await writable.close();
    } catch(error) {
     await writable.abort().catch(()=>{});
     throw error;
    }
    fileHandle=destination;
    fileName=destination.name;
    if(version===revision) markSaved();
    else renderFile();
    toast(t('已存檔｜{0}',fileName));
    return;
   } catch(error) {
    if(error.name==='AbortError') return;
    if(!['SecurityError','NotAllowedError','NotSupportedError'].includes(error.name)) throw error;
   }
  }
  fileName=saveTitle()+'.dndprep';
  download(projectText(),fileName,'application/json');
  markSaved();
  toast('已交給瀏覽器下載存檔。');
 } catch(error) {toast(t('存檔失敗｜{0}',error.message));}
 finally {fileBusy=false;}
}
async function load(file,handle=null) {
 if(!file) return;
 try {
  if(file.size>200*1024*1024) throw new Error(t('存檔超過 200 MB。'));
  const loaded=unpack(JSON.parse(await file.text()));
  project=loaded;
  fileName=file.name;
  fileHandle=handle;
  undo.clear();
  markSaved();
  render();
  $('board').scrollLeft=0;
  toast(t('已開啟｜{0}',fileName));
 } catch(error) {
  toast(error instanceof SyntaxError?t('存檔格式無法讀取。'):t('開啟失敗｜{0}',error.message));
 }
}
async function openFile() {
 if(fileBusy||dirty&&!confirm(t('目前有未存變更。仍要開啟另一份存檔？'))) return;
 if(window.showOpenFilePicker) {
  fileBusy=true;
  try {
   const [handle]=await window.showOpenFilePicker({types:[fileType()],multiple:false});
   await load(await handle.getFile(),handle);
   return;
  } catch(error) {
   if(error.name==='AbortError') return;
   if(!['SecurityError','NotAllowedError','NotSupportedError'].includes(error.name)) {
    toast(t('開啟失敗｜{0}',error.message));
    return;
   }
  } finally {fileBusy=false;}
 }
 $('openFallback').click();
}
$('openFallback').onchange=async e=>{
 const chooser=e.target;
 if(fileBusy) return;
 fileBusy=true;
 try {await load(chooser.files[0]);}
 finally {fileBusy=false;chooser.value='';}
};
async function copyLog() {
 const box=$('log');
 box.focus();
 box.select();
 try {
  if(!document.execCommand('copy')) await navigator.clipboard.writeText(box.value);
  toast('已複製戰鬥紀錄');
 } catch {toast('已全選，可按 Ctrl+C 複製。');}
}
$('open').onclick=openFile;
$('save').onclick=()=>save();
$('saveAs').onclick=()=>save(true);
$('character').onclick=()=>character();
$('rules').onclick=rules;
$('counts').onclick=counts;
$('addSpell').onclick=()=>spellEditor(null,1);
$('short').onclick=()=>recover(false);
$('long').onclick=()=>recover(true);
$('cunning').onclick=cunning;
$('undo').onclick=()=>{
 const c=cNow(),previous=undo.get(c.id);
 if(!previous) return;
 const {last,turn,...state}=previous;
 Object.assign(c,state);
 if(c.turn.number===turn.number) c.turn=turn;
 undo.delete(c.id);
 const original=c.log[last]?.replace(/^\[[^\]]+\] /,'')||t('上一筆操作');
 update(c,t('復原 · {0}',original));
};
$('nextTurn').onclick=()=>{
 const c=cNow();
 if(!tracksTurns(c.rules)) return;
 c.turn=emptyTurn(c.turn.number+1);
 mark();
 render();
};
$('logNote').onclick=note;
$('resetLog').onclick=()=>{
 const c=cNow();
 if(!c.log.length) return;
 dialog(t('重置戰鬥紀錄'),t('確認重置'),form=>{
  form.append(element('p','',t('重置後，「{0}」的 {1} 筆戰鬥紀錄將歸零，無法復原。法術位與使用次數會保留。',title(c),c.log.length)));
 },()=>{
  c.log=[];
  undo.delete(c.id);
  mark();
  render();
  toast('已重置戰鬥紀錄');
 },true);
};
$('copy').onclick=copyLog;
$('log').ondblclick=e=>e.currentTarget.select();
$('exportTxt').onclick=()=>download('\uFEFF'+$('log').value.replace(/\r?\n/g,'\r\n'),saveTitle()+'_'+t('戰鬥紀錄')+'.txt','text/plain;charset=utf-8');
$('closeEditor').onclick=()=>editor.close();
$('closeViewer').onclick=()=>viewer.close();
$('scrollLeft').onclick=()=>$('board').scrollBy({left:-246,behavior:'smooth'});
$('scrollRight').onclick=()=>$('board').scrollBy({left:246,behavior:'smooth'});
viewer.onclick=e=>{if(e.target===viewer) viewer.close();};
$('language').value=locale;
$('language').onchange=()=>{
 setLocale($('language').value);
 localizePage();
 render();
};
localizePage();
window.addEventListener('keydown',e=>{
 if(e.ctrlKey&&e.key.toLowerCase()==='s'){e.preventDefault();if(!editor.open) save(e.shiftKey);}
 if(e.ctrlKey&&e.key.toLowerCase()==='o'){e.preventDefault();if(!editor.open) openFile();}
});
window.addEventListener('beforeunload',e=>{
 if(dirty){e.preventDefault();e.returnValue='';}
});
window.addEventListener('dragover',e=>{
 if(Array.from(e.dataTransfer.types).includes('Files')) e.preventDefault();
});
window.addEventListener('drop',e=>{
 if(e.dataTransfer.files.length) e.preventDefault();
});
render();
