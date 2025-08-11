import { S, save, reset, UPGRADES, ITEMS, synergyBonus, needXP } from './state.js';
import { pickSentence } from './sentences.js';

/* === DOM === */
const el = {
  target: q('#target'),
  input: q('#input'),
  wpm: q('#hud-wpm'),
  acc: q('#hud-acc'),
  streak: q('#hud-streak'),
  mult: q('#hud-mult'),
  pts: q('#hud-pts'),
  lvl: q('#hud-level'),
  shop: q('#shop'),
  tabUp: q('#tab-upgrades'),
  tabSet: q('#tab-setup'),
  stats: q('#stats'),
  chall: q('#challenges'),
  setup: q('#setupView'),
  reset: q('#resetBtn'),
};
function q(s){ return document.querySelector(s); }
function esc(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* === Engine-Variablen === */
let current = null;
let typedHistory = [];     // 'ok' | 'err' | 'fixed' | undefined
let startedAt = 0;
let tick = null;
let lastWpm = 0;
let penalty = 0;           // Satzbezogene Zeitstrafe (nur vom Gewinn)

/* === Challenges (rotating) === */
const CHALL_POOL = [
  { id:'first',    name:'Erster Satz',     reward:50,  check:()=>S.stats.total>=1 },
  { id:'warmup10', name:'Warm-up (10)',    reward:100, check:()=>S.stats.total>=10 },
  { id:'perfect3', name:'Fehlerfrei ×3',   reward:150, check:()=>S.stats.bestStreak>=3 },
  { id:'streak5',  name:'Serie ×5',        reward:200, check:()=>S.stats.bestStreak>=5 },
  { id:'level3',   name:'Level 3',         reward:120, check:()=>S.level>=3 },
  { id:'level5',   name:'Level 5',         reward:180, check:()=>S.level>=5 },
  { id:'upgrade1', name:'Erstes Upgrade',  reward:80,  check:()=>Object.values(S.upgrades).some(l=>l>0) },
  { id:'item1',    name:'Erstes Item',     reward:80,  check:()=>ITEMS.some(it=>S.owned[it.id]) }
];
const MAX_ACTIVE_CHALLS = 3;

function ensureActiveChalls(){
  if (!Array.isArray(S.activeChalls)) S.activeChalls = [];
  // erledigte raus
  S.activeChalls = S.activeChalls.filter(id => !S.owned[`ch_${id}`]);
  // auffüllen
  const available = CHALL_POOL.filter(c => !S.owned[`ch_${c.id}`] && !S.activeChalls.includes(c.id));
  while (S.activeChalls.length < MAX_ACTIVE_CHALLS && available.length) {
    const i = Math.floor(Math.random()*available.length);
    S.activeChalls.push(available[i].id);
    available.splice(i,1);
  }
  save();
}
function activeChallenges(){ return CHALL_POOL.filter(c => S.activeChalls.includes(c.id)); }

function renderChallenges(){
  ensureActiveChalls();
  const list = activeChallenges();
  if (!list.length){
    el.chall.innerHTML = `<li class="p-2 rounded bg-neutral-800">Alle Challenges erledigt 🎉</li>`;
    return;
  }
  el.chall.innerHTML = list.map(c=>{
    const can = c.check();
    return `<li class="p-2 rounded bg-neutral-800 flex items-center justify-between">
      <div><b>${c.name}</b><div class="opacity-70 text-xs">Belohnung: ${c.reward} Punkte</div></div>
      <button data-c="${c.id}" ${can?'':'disabled'} class="px-3 py-1 rounded ${can?'bg-emerald-600':'bg-neutral-700'}">Einsammeln</button>
    </li>`;
  }).join('');
  el.chall.querySelectorAll('button[data-c]').forEach(b=>{
    b.addEventListener('click',()=>{
      const id=b.dataset.c, c=CHALL_POOL.find(x=>x.id===id);
      if (!c || !c.check()) return;
      S.points += c.reward;
      S.owned[`ch_${id}`] = true;                   // erledigt markieren
      S.activeChalls = S.activeChalls.filter(x=>x!==id);
      save(); updateHUD(); toast(`Challenge: +${c.reward} Punkte`);
      renderChallenges();                           // neue nachrücken
    });
  });
}

/* === Boot === */
boot();
function boot(){
  renderChallenges();
  renderStats();
  bindUI();
  nextSentence(true);
  renderShopUpgrades();
  renderSetupView();
}

/* === UI Bindings === */
function bindUI(){
  el.input.addEventListener('input', onInput);
  el.tabUp.addEventListener('click', renderShopUpgrades);
  el.tabSet.addEventListener('click', renderShopSetup);
  el.reset.addEventListener('click', ()=>{ if (confirm('Speicherstand wirklich löschen?')) reset(); });
}

/* === Engine === */
function nextSentence(initial=false){
  current = pickSentence(S.level, S.lastSentenceId);
  S.lastSentenceId = current.id;
  penalty = 0;                                // reset Strafe
  typedHistory = new Array(current.text.length);
  renderTarget(current.text);
  el.input.value = "";
  startedAt = 0;                               // Timer startet erst beim Tippen
  clearInterval(tick);
  tick = setInterval(()=>deductTick(), 250);
  if (!initial) save();
}

function onInput(){
  if (!startedAt) startedAt = performance.now(); // Start bei erstem Input

  const val = el.input.value;
  for (let i=0;i<current.text.length;i++){
    const exp = current.text[i];
    const got = val[i] ?? null;
    if (got === null) typedHistory[i] = undefined;
    else if (got === exp) typedHistory[i] = (typedHistory[i]==='err') ? 'fixed' : 'ok';
    else typedHistory[i] = 'err';
  }
  renderTarget(current.text);

  if (val === current.text) {
    clearInterval(tick);
    const elapsed = (performance.now()-startedAt)/1000;
    scoreSentence(current.text, elapsed);
    S.stats.total++;
    if (S.streak > S.stats.bestStreak) S.stats.bestStreak = S.streak;
    renderStats(); save();
    renderChallenges();           // ⬅️ nach Abschluss refresh
    nextSentence();
  }
}

function deductTick(){
  if (!startedAt) return;
  const elapsed = (performance.now()-startedAt)/1000;
  if (elapsed > S.grace) {
    penalty += 0.5;               // -2/s (4 Ticks * 0.5), nur auf Satzgewinn
    save();
  }
}

/* === Rendering === */
function renderTarget(targetText){
  const out = [];
  for (let i=0;i<targetText.length;i++){
    const exp = targetText[i];
    const st = typedHistory[i];
    let cls = 'ty pending';
    if (st==='ok') cls='ty ok';
    else if (st==='err') cls='ty err';
    else if (st==='fixed') cls='ty fixed';
    out.push(`<span class="${cls}">${exp===' ' ? '&nbsp;' : esc(exp)}</span>`);
  }
  el.target.innerHTML = out.join('');
  updateHUD();
}

function updateHUD(afterScore=false){
  const total = el.target.querySelectorAll('.ty').length;
  const oks   = el.target.querySelectorAll('.ty.ok').length;
  const acc = total ? Math.round((oks/total)*100) : 100;
  const multNow = 1 + Math.min(S.streak*0.05, S.multCap) + synergyBonus();
  el.wpm.textContent   = `WPM: ${afterScore ? lastWpm : 0}`;
  el.acc.textContent   = `Accuracy: ${acc}%`;
  el.streak.textContent= `Serie: ${S.streak}`;
  el.mult.textContent  = `Multiplikator: ${multNow.toFixed(2)}×`;
  el.pts.textContent   = `Punkte: ${Math.floor(S.points)}`;
  el.lvl.textContent   = `Level: ${S.level}`;
}

function renderStats(){
  const need = needXP(S.level);
  el.stats.innerHTML = `
    <div>Gesamt-Sätze: ${S.stats.total}</div>
    <div>Beste Serie: ${S.stats.bestStreak}</div>
    <div>XP: ${S.xp} / ${need}</div>
  `;
}

/* === Scoring === */
function scoreSentence(text, elapsedS){
  const chars = [...text].length;
  const base = 0.6 * chars + 4 + S.basePointsAdd;
  const speedBonus = Math.ceil(Math.max(0, (S.grace - elapsedS) * S.speedFactor));
  const hadErr = typedHistory.some(s=>s==='err' || s==='fixed');
  const perfect = !hadErr;

  lastWpm = Math.round((chars/5) / (elapsedS/60));

  if (perfect) S.streak++;
  else S.streak = S.antiTilt ? Math.max(0, S.streak-1) : 0;

  const mult = 1 + Math.min(S.streak*0.05, S.multCap) + synergyBonus();

  let gained = (base + speedBonus + (perfect?10:0)) * mult;
  gained = Math.max(0, Math.round(gained - penalty)); // Strafe nur vom Gewinn
  penalty = 0;

  S.points += gained;
  S.xp     += Math.floor(gained/2);

  while (S.xp >= needXP(S.level)) {
    S.xp -= needXP(S.level);
    S.level++;
  }
  updateHUD(true);
}

/* === Shop === */
function renderShopUpgrades(){
  const html = UPGRADES.map(u=>{
    const lvl = S.upgrades[u.id]||0;
    const price = Math.floor(u.base * Math.pow(u.growth, lvl));
    const afford = S.points>=price && S.level>=(u.gate||1) && (u.max? lvl<u.max : true);
    return `<div class="p-3 rounded bg-neutral-800 flex items-start justify-between gap-4">
      <div>
        <div class="font-medium">${u.name}</div>
        <div class="text-neutral-400 text-xs tip" data-tip="${u.desc}">
          Lvl ${lvl} · Preis ${price} · ab Lvl ${u.gate||1}${u.max?` · Max ${u.max}`:''}
        </div>
      </div>
      <button data-up="${u.id}" ${afford?'':'disabled'}
        class="px-3 py-1 rounded ${afford?'bg-indigo-600':'bg-neutral-700'}">Kaufen</button>
    </div>`;
  }).join('');
  el.shop.innerHTML = html;
  el.shop.querySelectorAll('button[data-up]').forEach(btn=>{
    btn.addEventListener('click',()=>buyUpgrade(btn.dataset.up));
  });
}
function buyUpgrade(id){
  const u = UPGRADES.find(x=>x.id===id); if(!u) return;
  const lvl = S.upgrades[id]||0;
  if (u.max && lvl>=u.max) return;
  const price = Math.floor(u.base*Math.pow(u.growth,lvl));
  if (S.points<price || S.level<(u.gate||1)) return;
  S.points -= price; S.upgrades[id]=(lvl+1);

  if (id==='basePointsPlus') S.basePointsAdd += 2;
  if (id==='multCapPlus')   S.multCap = Math.min(1.0, S.multCap+0.05);
  if (id==='gracePlus')     S.grace = Math.min(10, S.grace+0.5);
  if (id==='speedBonusPlus')S.speedFactor += 0.5;
  if (id==='antiTilt')      S.antiTilt = true;

  save(); renderShopUpgrades(); updateHUD();
  toast(`Upgrade gekauft: ${u.name}`);
  renderChallenges();      // falls „Erstes Upgrade“-Challenge aktiv ist
}

function renderShopSetup(){
  const html = ITEMS.map(it=>{
    const owned = !!S.owned[it.id];
    const afford = S.points>=it.price && S.level>=(it.gate||1) && !owned;
    return `<div class="p-3 rounded bg-neutral-800 flex items-start justify-between gap-4">
      <div>
        <div class="font-medium">${it.name} <span class="opacity-60 text-xs">(${it.slot})</span></div>
        <div class="text-neutral-400 text-xs">${it.rarity} · ab Lvl ${it.gate||1} · ${it.price} Punkte</div>
      </div>
      <button data-it="${it.id}" ${afford?'':'disabled'}
        class="px-3 py-1 rounded ${owned?'bg-neutral-700': (afford?'bg-emerald-600':'bg-neutral-700')}">
        ${owned?'Gekauft':'Kaufen'}
      </button>
    </div>`;
  }).join('');
  el.shop.innerHTML = html;
  el.shop.querySelectorAll('button[data-it]').forEach(btn=>{
    btn.addEventListener('click',()=>buyItem(btn.dataset.it));
  });
}
function buyItem(id){
  const it = ITEMS.find(x=>x.id===id); if(!it) return;
  if (S.owned[id]) return;
  if (S.points<it.price || S.level<(it.gate||1)) return;
  S.points -= it.price; S.owned[id]=true; save();
  renderShopSetup(); renderSetupView(); updateHUD();
  toast(`Item gekauft: ${it.name}`);
  renderChallenges();      // falls „Erstes Item“-Challenge aktiv ist
}

/* === Setup-Ansicht === */
function renderSetupView(){
  document.querySelectorAll('#setupView .slot').forEach(s=>s.innerHTML='');
  for (const it of ITEMS){
    if (S.owned[it.id]){
      const slot = q('#slot-'+it.slot); if(!slot) continue;
      slot.innerHTML = `<div class="item ${it.rarity}">${it.name}</div>`;
    }
  }
}

/* === Toast === */
function toast(msg){
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=> t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(), 250); }, 1500);
}
