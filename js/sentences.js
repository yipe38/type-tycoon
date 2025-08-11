// Satzpools + Auswahl
export const TIERS = {
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

export function chooseTier(level){ return level>=8?3:level>=4?2:1; }

export function pickSentence(level, lastId){
  const tier = chooseTier(level);
  const pool = TIERS[tier];
  let idx;
  do { idx = Math.floor(Math.random()*pool.length); } while(`${tier}-${idx}`===lastId && pool.length>1);
  return { id:`${tier}-${idx}`, text: pool[idx], tier };
}
