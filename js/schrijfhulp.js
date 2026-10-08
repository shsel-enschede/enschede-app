// Schrijfhulp voor de editor: tips bij verhaal en meerkeuzevraag, volgens de afspraken in CLAUDE.md
// (doelgroep 9-14 jaar, taalniveau B1, Haladyna-richtlijnen voor meerkeuzevragen).
// Alleen adviezen: ze houden versturen nooit tegen. Zonder scherm, los te testen (tests/schrijfhulp.test.mjs).

export const MAX_WOORDEN_PER_ZIN = 15;
const LETTERS = ['A', 'B', 'C', 'D'];

/** Splits tekst in zinnen (grof: na . ! ? gevolgd door een spatie of het einde). */
export function zinnen(tekst) {
  return String(tekst ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((z) => z.trim())
    .filter(Boolean);
}

export function woorden(tekst) {
  return String(tekst ?? '').trim().split(/\s+/).filter(Boolean).length;
}

function begin(zin) {
  const w = zin.split(/\s+/);
  return w.length > 6 ? `${w.slice(0, 6).join(' ')} …` : zin;
}

function langeZinnen(tekst, veld) {
  return zinnen(tekst)
    .filter((z) => woorden(z) > MAX_WOORDEN_PER_ZIN)
    .map((z) => ({ veld, tekst: `Lange zin (${woorden(z)} woorden): "${begin(z)}". Richtlijn: hooguit ongeveer ${MAX_WOORDEN_PER_ZIN}.` }));
}

/**
 * Tips bij één plek. Geeft een lijst van { veld, tekst }.
 * veld: 'tekst' | 'vraag' | 'opties' | 'uitleg'
 */
export function schrijfadvies({ tekst = '', vraag = '', opties = [], uitleg = '', juist = null } = {}) {
  const tips = [];

  tips.push(...langeZinnen(tekst, 'tekst'));

  const v = String(vraag).trim();
  if (v && woorden(v) > MAX_WOORDEN_PER_ZIN + 5) tips.push({ veld: 'vraag', tekst: `De vraag is lang (${woorden(v)} woorden). Een korte vraag is beter te lezen.` });
  if (/\b(niet|geen|nooit)\b/i.test(v)) tips.push({ veld: 'vraag', tekst: 'Ontkennende vraag ("niet", "geen")? Liever positief vragen: dat is minder verwarrend.' });

  const o = opties.map((x) => String(x ?? '').trim());
  const gevuld = o.filter(Boolean);
  if (gevuld.length && gevuld.length < 4) tips.push({ veld: 'opties', tekst: `Er zijn ${gevuld.length} antwoorden ingevuld. De afspraak is vier (A tot en met D).` });
  const dubbel = gevuld.filter((x, i) => gevuld.findIndex((y) => y.toLowerCase() === x.toLowerCase()) !== i);
  if (dubbel.length) tips.push({ veld: 'opties', tekst: `Twee antwoorden zijn gelijk: "${dubbel[0]}".` });
  for (const [i, x] of o.entries()) {
    if (/niet te zien|alle(\s+\w+)?\s+(antwoorden|bovenstaande)|geen van (de|deze|bovenstaande)/i.test(x)) {
      tips.push({ veld: 'opties', tekst: `Antwoord ${LETTERS[i]} ("${x}") liever vermijden: kies een echt antwoord.` });
    }
  }
  if (Number.isInteger(juist) && o[juist] && gevuld.length >= 3) {
    const anderen = o.filter((x, i) => i !== juist && x);
    const gemiddeld = anderen.reduce((s, x) => s + x.length, 0) / anderen.length;
    if (o[juist].length > gemiddeld * 1.5 && o[juist].length - gemiddeld > 15) {
      tips.push({ veld: 'opties', tekst: `Het goede antwoord (${LETTERS[juist]}) is veel langer dan de andere. Dan is het te raden: maak de antwoorden ongeveer even lang.` });
    }
  }

  const u = String(uitleg).trim();
  if (!u) tips.push({ veld: 'uitleg', tekst: 'Nog geen uitleg. Eén korte zin na het antwoord helpt om het te onthouden.' });
  tips.push(...langeZinnen(u, 'uitleg'));
  if (u && zinnen(u).length > 2) tips.push({ veld: 'uitleg', tekst: 'De uitleg is meer dan twee zinnen. De afspraak is één korte zin.' });

  return tips;
}
