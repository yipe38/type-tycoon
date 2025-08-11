// Save + globaler State + Daten + Helper
export const KEY = 'tt_setup_save_v1';

export const S = {
  version: 1,
  points: 0,
  xp: 0,
  level: 1,
  streak: 0,
  multCap: 0.50,      // 50% Start-Cap
  grace: 6,           // Sekunden bis Abzug startet
  speedFactor: 4,     // Geschwindigkeitsbonus-Faktor
  basePointsAdd: 0,   // Upgrade-Effekt
  antiTilt: false,    // Upgrade-Effekt
  upgrades: {},       // id -> level
  owned: {},          // setup item id -> true  (auch: ch_* für Challenges)
  lastSentenceId: null,
  stats: { total:0, bestStreak:0, fastestS:null, timePlayedS:0 }
};

try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch {}

export function save(){ localStorage.setItem(KEY, JSON.stringify(S)); }
export function reset(){ localStorage.removeItem(KEY); location.reload(); }

// Upgrades
export const UPGRADES = [
  { id:'basePointsPlus', name:'Basispunkte+', desc:'Mehr Basispunkte pro Satz.', base:100, growth:1.35 },
  { id:'multCapPlus',    name:'Multiplikator-Cap+', desc:'Erhöht das Maximum des Serien-Multiplikators.', base:150, growth:1.40, gate:3 },
  { id:'gracePlus',      name:'Grace-Zeit+', desc:'Mehr Zeit bis Punktabzug startet.', base:120, growth:1.35 },
  { id:'speedBonusPlus', name:'Speed-Bonus+', desc:'Stärkerer Geschwindigkeitsbonus.', base:180, growth:1.45, gate:4 },
  { id:'antiTilt',       name:'Anti-Tilt', desc:'Fehlersatz senkt Serie nur um 1 Stufe (einmalig).', base:250, growth:2.0, gate:5, max:1 }
];

// Setup-Items
export const ITEMS = [
  { id:'mon_basic',   name:'Monitor (Basic)',   slot:'monitor',  rarity:'basic', price:200, gate:1, sets:['gamer'] },
  { id:'kbd_mech',    name:'Mechanische Tastatur', slot:'keyboard', rarity:'pro',   price:220, gate:3, sets:['gamer'] },
  { id:'mouse_pro',   name:'Maus (Pro)',        slot:'mouse',    rarity:'pro',   price:150, gate:2, sets:['gamer'] },
  { id:'lamp_warm',   name:'Schreibtischlampe', slot:'lamp',     rarity:'basic', price:120, gate:2, sets:['focus'] },
  { id:'pc_tower',    name:'PC Tower',          slot:'pc',       rarity:'pro',   price:300, gate:4, sets:['gamer'] },
  { id:'plant_small', name:'Pflanze',           slot:'plant',    rarity:'basic', price:90,  gate:1, sets:['focus'] },
  { id:'poster_grid', name:'Poster',            slot:'poster',   rarity:'basic', price:80,  gate:1, sets:['focus'] }
];

export function synergyBonus(){
  const has = id => !!S.owned[id];
  const gamer = has('mon_basic') && has('kbd_mech') && has('mouse_pro') && has('pc_tower');
  const focus = has('lamp_warm') && has('plant_small') && has('poster_grid');
  let bonus = 0;
  if (gamer) bonus += 0.05;
  if (focus) bonus += 0.05;
  return bonus; // 0..0.10
}

export function needXP(level){ return 100 + (level-1)*60; }

// DEV: schneller testen (Konsole: cheat(500))
window.cheat = (n=500)=>{ S.points+=n; save(); };
