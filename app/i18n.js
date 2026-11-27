'use strict';

const LANGUAGES = ['zh-Hant','zh-Hans','en','ja','ko'];
const LOCALE_KEY = 'dnd-spell-prep.language';

function browserLocale(language) {
 if(!language) return 'zh-Hant';
 if(/^zh(?:-|$)/i.test(language)) {
  return /(?:^|-)(Hans|CN|SG)(?:-|$)/i.test(language)?'zh-Hans':'zh-Hant';
 }
 if(/^ja(?:-|$)/i.test(language)) return 'ja';
 if(/^ko(?:-|$)/i.test(language)) return 'ko';
 return 'en';
}

function prefLocale() {
 try {
  const saved=globalThis.localStorage?.getItem(LOCALE_KEY);
  if(LANGUAGES.includes(saved)) return saved;
 } catch {}
 return browserLocale(globalThis.navigator?.language);
}

let locale=prefLocale();

function setLocale(language) {
 if(!LANGUAGES.includes(language)) return;
 locale=language;
 try {globalThis.localStorage?.setItem(LOCALE_KEY,locale);} catch {}
}

function t(key,...values) {
 const message=(locale!=='zh-Hant'&&Object.prototype.hasOwnProperty.call(MESSAGES,key)?MESSAGES[key][LANGUAGES.indexOf(locale)-1]:key)??'';
 return values.length?message.replace(/\{(\d+)\}/g,(match,index)=>values[index]??match):message;
}

const staticLabels=[];
function localizePage() {
 if(!staticLabels.length) {
  for(const el of document.querySelectorAll('[data-i18n]')) {
   staticLabels.push([el,'textContent',el.textContent]);
  }
  // Freeze only the initial markup. Dynamically rendered labels use t() directly.
  for(const name of ['aria-label','alt','placeholder']) {
   for(const el of document.querySelectorAll('['+name+']')) {
    const key=el.getAttribute(name);
    staticLabels.push([el,name,key]);
   }
  }
 }
 document.documentElement.lang=locale;
 for(const [el,property,key] of staticLabels) {
  if(property==='textContent') el.textContent=t(key);
  else el.setAttribute(property,t(key));
 }
}
