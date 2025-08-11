/* === Save/State === */
const KEY = 'tt_setup_save_v1';
const S = {
  version: 1,
  points: 0,
  xp: 0,
  level: 1,
  streak: 0,
  multCap: 0.50,           // 50% Start-Cap
  grace: 6,                // Sekunden bis Abzug startet
  speedFactor: 4,          // Geschwindigkeitsbonus-Faktor
  basePointsAdd: 0,        // durch Upgrade
  antiTilt: false,         // Upgrade
  upgrades: {},            // id -> level
  owned: {},               // setup item id -> true  (auch: ch_* für Challenges)
  lastSentenceId: null,
  stats: { total:0, bestStreak:0, fastestS:null, timePlayedS:0 }
};
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}
save();

/* === Data: Sätze (Tiers 1–3; erweiterbar) === */
const TIERS = {
  1: [
    "Heute ist ein guter Tag.",
    "Bitte speichere regelmäßig.",
    "Tippen macht Spaß und schnell.",
    "Der Kaffee steht bereit.",
    "Ich liebe kurze Sätze.",
    "Linux oder Windows, Hauptsache läuft.",
    "Die Lampe leuchtet warm.",
    "Das ist nur ein Test.",
    "Kurze Pause hilft oft.",
    "Dieser Satz ist simpel."
  ],
  2: [
    "Manchmal sorgt ein tiefer Atemzug für Klarheit im Kopf.",
    "Der Schreibtisch war anfangs leer, doch bald wächst das Setup.",
    "Ein konzentrierter Flow entsteht, wenn Benachrichtigungen aus sind.",
    "Die Tastatur klackt, während Gedanken Form annehmen.",
    "Wer tippt, gewinnt an Tempo und Präzision.",
    "Mit Routine wird aus Anstrengung mühelose Bewegung."
  ],
  3: [
    "Mit steigender Stufe erscheinen längere Sätze mit Kommas, Zahlen 123 und kleinen Stolpersteinen.",
    "Konsequentes Üben führt zu messbaren Fortschritten, selbst wenn es anfangs zäh wirkt.",
    "Wer Fehler sofort korrigiert, baut eine stabile Serie auf und hält den Multiplikator oben."
  ]
};
function chooseTier(level){ return level>=8?3:level>=4?2:1; }
function pickSentence(level, lastId){
  const tier = chooseTier(level);
  const pool = TIERS[tier];
  let idx;
  do { idx = Math.floor(Math.random()*pool.length); } while(`${tier}-${idx}`===lastId && pool.length>1);
  return { id:`${tier}-${idx}`, text: pool[idx], tier };
}

/* === Data: Upgrades === */
const UPGRADES = [
  { id:'basePointsPlus', name:'Basispunkte+', desc:'Mehr Basispunkte pro Satz.', base:100, growth:1.35 },
  { id:'multCapPlus',    name:'Multiplikator-Cap+', desc:'Erhöht das Maximum des Serien-Multiplikators.', base:150, growth:1.40, gate:3 },
  { id:'gracePlus',      name:'Grace-Zeit+', desc:'Mehr Zeit bis Punktabzug startet.', base:120, growth:1.35 },
  { id:'speedBonusPlus', name:'Speed-Bonus+', desc:'Stärkerer Geschwindigkeitsbonus.', base:180, growth:1.45, gate:4 },
  { id:'antiTilt',       name:'Anti-Tilt', desc:'Fehlersatz senkt Serie nur um 1 Stufe (einmalig).', base:250, growth:2.0, gate:5, max:1 }
];

/* === Data: Setup-Items (feste Slots; mit einfachen Set-Boni) === */
const ITEMS = [
  { id:'mon_basic',   name:'Monitor (Basic)',   slot:'monitor',  rarity:'basic', price:200, gate:1, sets:['gamer'] },
  { id:'kbd_mech',    name:'Mechanische Tastatur', slot:'keyboard', rarity:'pro',   price:220, gate:3, sets:['gamer'] },
  { id:'mouse_pro',   name:'Maus (Pro)',        slot:'mouse',    rarity:'pro',   price:150, gate:2, sets:['gamer'] },
  { id:'lamp_warm',   name:'Schreibtischlampe', slot:'lamp',     rarity:'basic', price:120, gate:2, sets:['focus'] },
  { id:'pc_tower',    name:'PC Tower',          slot:'pc',       rarity:'pro',   price:300, gate:4, sets:['gamer'] },
  { id:'plant_small', name:'Pflanze',           slot:'plant',    rarity:'basic', price:90,  gate:1, sets:['focus'] },
  { id:'poster_grid', name:'Poster',            slot:'poster',   rarity:'basic', price:80,  gate:1, sets:['focus'] }
];
function synergyBonus(){
  const has = id => !!S.owned[id];
  const gamer = has('mon_basic') && has('kbd_mech') && has('mouse_pro') && has('pc_tower');
  const focus = has('lamp_warm') && has('plant_small') && has('poster_grid');
  let bonus = 0;
  if (gamer) bonus += 0.05;
  if (focus) bonus += 0.05;
  return bonus; // 0..0.10
}

/* === DOM Refs === */
const el = {
  target: qs('#target'),
  input: qs('#input'),
  wpm: qs('#hud-wpm'),
  acc: qs('#hud-acc'),
  streak: qs('#hud-streak'),
  mult: qs('#hud-mult'),
  pts: qs('#hud-pts'),
  lvl: qs('#hud-level'),
  shop: qs('#shop'),
  tabUp: qs('#tab-upgrades'),
  tabSet: qs('#tab-setup'),
  stats: qs('#stats'),
  chall: qs('#challenges'),
  setup: qs('#setupView'),
  reset: qs('#resetBtn'),
};
function qs(s){ return document.querySelector(s); }

/* === Typing Engine === */
let current = null;
let typedHistory = [];   // 'ok' | 'err' | 'fixed' | undefined
let startedAt = 0;       // performance.now()
let tick = null;         // deduction timer
let lastWpm = 0;

boot();

function boot(){
  renderChallenges();
  renderStats();
  bindUI();
  nextSentence(true);
  renderShopUpgrades();
  renderSetupView();
}

function bindUI(){
  el.input.addEventListener('input', onInput);
  el.tabUp.addEventListener('click', renderShopUpgrades);
  el.tabSet.addEventListener('click', renderShopSetup);
  el.reset.addEventListener('click', ()=>{
    if (confirm('Speicherstand wirklich löschen?')) { localStorage.removeItem(KEY); location.reload(); }
  });
}

function nextSentence(initial=false){
  current = pickSentence(S.level, S.lastSentenceId);
  S.lastSentenceId = current.id;
  typedHistory = new Array(current.text.length);
  renderTarget(current.text, "");
  el.input.value = "";
  startedAt = performance.now();
  clearInterval(tick);
  tick = setInterval(()=>deductTick(), 250);
  if (!initial) save();
}

function deductTick(){
  const elapsed = (performance.now()-startedAt)/1000;
  if (elapsed > S.grace) {
    S.points = Math.max(0, S.points - 0.5); // -2/s
    updateHUD();
    save();
  }
}

function onInput(){
  const val = el.input.value;
  // Zeichenweise prüfen
  for (let i=0;i<current.text.length;i++){
    const exp = current.text[i];
    const got = val[i] ?? null;
    if (got === null) typedHistory[i] = undefined;
    else if (got === exp) typedHistory[i] = (typedHistory[i]==='err') ? 'fixed' : 'ok';
    else typedHistory[i] = 'err';
  }
  renderTarget(current.text, val);

  // fertig?
  if (val === current.text) {
    clearInterval(tick);
    const elapsed = (performance.now()-startedAt)/1000;
    scoreSentence(current.text, elapsed);
    S.stats.total++;
    if (S.streak > S.stats.bestStreak) S.stats.bestStreak = S.streak;
    renderStats();
    save();
    nextSentence();
  }
}

function renderTarget(targetText, _typed){
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
  // live HUD (Accuracy)
  updateHUD();
}

function esc(s){ return s.replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }

/* === Scoring / Progression === */
function scoreSentence(text, elapsedS){
  const chars = [...text].length;
  const base = 0.6 * chars + 4 + S.basePointsAdd;
  const speedBonus = Math.ceil(Math.max(0, (S.grace - elapsedS) * S.speedFactor));
  const hadErr = typedHistory.some(s=>s==='err' || s==='fixed');
  const perfect = !hadErr;

  // WPM (standard: 5 chars = 1 Wort)
  lastWpm = Math.round((chars/5) / (elapsedS/60));

  // Serie / Multiplikator
  if (perfect) S.streak++;
  else S.streak = S.antiTilt ? Math.max(0, S.streak-1) : 0;

  const mult = 1 + Math.min(S.streak*0.05, S.multCap) + synergyBonus();

  let gained = (base + speedBonus + (perfect?10:0)) * mult;
  gained = Math.max(0, Math.round(gained));

  S.points += gained;
  S.xp     += Math.floor(gained/2);

  // Level-Up
  while (S.xp >= needXP(S.level)) {
    S.xp -= needXP(S.level);
    S.level++;
  }
  updateHUD(true);
}

function needXP(level){ return 100 + (level-1)*60; }

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

/* === Challenges (simple) === */
const CHALL = [
  { id:'warmup',   name:'Warm-up',    need:10,  reward:100, check:()=>S.stats.total>=10 },
  { id:'perfect3', name:'Fehlerfrei ×3', need:3, reward:150, check:()=>S.streak>=3 },
  { id:'marathon', name:'100 Sätze',  need:100, reward:500, check:()=>S.stats.total>=100 }
];
function renderChallenges(){
  el.chall.innerHTML = CHALL.map(c=>{
    const done = S.owned[`ch_${c.id}`];
    const can = c.check() && !done;
    return `<li class="p-2 rounded bg-neutral-800 flex items-center justify-between">
      <div><b>${c.name}</b><div class="opacity-70 text-xs">Belohnung: ${c.reward} Punkte</div></div>
      <button data-c="${c.id}" ${can?'':'disabled'} class="px-3 py-1 rounded ${can?'bg-emerald-600':'bg-neutral-700'}">${done?'Eingesammelt':'Einsammeln'}</button>
    </li>`;
  }).join('');
  el.chall.querySelectorAll('button[data-c]').forEach(b=>{
    b.addEventListener('click',()=>{
      const id=b.dataset.c, c=CHALL.find(x=>x.id===id);
      if (c && c.check() && !S.owned[`ch_${id}`]) {
        S.points += c.reward; S.owned[`ch_${id}`]=true; save(); renderChallenges(); updateHUD();
      }
    });
  });
}

/* === Stats === */
function renderStats(){
  const need = needXP(S.level);
  el.stats.innerHTML = `
    <div>Gesamt-Sätze: ${S.stats.total}</div>
    <div>Beste Serie: ${S.stats.bestStreak}</div>
    <div>XP: ${S.xp} / ${need}</div>
  `;
}

/* === Shop: Upgrades === */
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

  // Effekte
  if (id==='basePointsPlus') S.basePointsAdd += 2;
  if (id==='multCapPlus')   S.multCap = Math.min(1.0, S.multCap+0.05);
  if (id==='gracePlus')     S.grace = Math.min(10, S.grace+0.5);
  if (id==='speedBonusPlus')S.speedFactor += 0.5;
  if (id==='antiTilt')      S.antiTilt = true;

  save(); renderShopUpgrades(); updateHUD();
}

/* === Shop: Setup === */
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
  renderShopSetup();
  renderSetupView();
  updateHUD();
}

/* === Setup Render === */
function renderSetupView(){
  document.querySelectorAll('#setupView .slot').forEach(s=>s.innerHTML='');
  for (const it of ITEMS){
    if (S.owned[it.id]){
      const slot = qs('#slot-'+it.slot); if(!slot) continue;
      slot.innerHTML = `<div class="item ${it.rarity}">${it.name}</div>`;
    }
  }
}

/* === Helper: Persist === */
function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
