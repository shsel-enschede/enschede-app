// Talen van de app: Nederlands (brontaal), Engels en Duits.
// Vaste teksten staan in content/teksten.json (per tekst de drie talen naast elkaar), zodat vrijwilligers
// ze zonder JavaScript kunnen aanpassen. Uitleg: teksten-LEESMIJ.md.
//
// Afspraken (CLAUDE.md, "Taal"):
// - Eerste bezoek: de taal van het toestel (navigator.languages); staat daar ergens Nederlands, dan Nederlands.
//   Geen van de drie talen: Nederlands. Wie zelf een taal kiest, houdt die (js/instellingen.js).
// - Taalnamen in hun eigen taal (Nederlands · English · Deutsch), geen vlaggen: een vlag staat voor een land.
// - Ontbreekt een tekst in de gekozen taal, dan de Nederlandse.
// Zonder scherm (geen document of fetch), zodat de functies los te testen zijn: tests/taal.test.mjs.

export const TALEN = ['nl', 'en', 'de'];
export const BRONTAAL = 'nl';
export const TAALNAMEN = { nl: 'Nederlands', en: 'English', de: 'Deutsch' };

const SLEUTEL_PATROON = /^[a-z][a-zA-Z0-9]*\.[a-zA-Z0-9.]+$/;
const MAX_LENGTE = 600;
const VORMEN = ['one', 'other'];

let teksten = new Map(); // sleutel -> { nl, en, de } (elk een tekst of { one, other })
let taal = BRONTAAL;
const meervoud = new Map(); // taal -> Intl.PluralRules

/** Taal van het toestel uit navigator.languages (of een lijst zoals ['de-DE', 'en']). */
export function toestelTaal(lijst) {
  const codes = (Array.isArray(lijst) ? lijst : [])
    .filter((c) => typeof c === 'string')
    .map((c) => c.toLowerCase().split('-')[0]);
  // Nederlands staat ergens in de lijst: Nederlands. Veel Nederlanders hebben hun telefoon in het Engels
  // staan, met Nederlands als tweede taal; de hoofddoelgroep (scholieren uit Enschede) leest Nederlands.
  if (codes.includes('nl')) return 'nl';
  // Anders de eerste taal die de app kent. Niets bekends (bijv. Turks of Frans): Nederlands; op het
  // startscherm staan English en Deutsch zichtbaar om te kiezen.
  return codes.find((c) => TALEN.includes(c)) ?? BRONTAAL;
}

function geldigeWaarde(w) {
  if (typeof w === 'string') return w.length <= MAX_LENGTE;
  return Boolean(w) && typeof w === 'object' && !Array.isArray(w)
    && VORMEN.every((v) => typeof w[v] === 'string' && w[v].length <= MAX_LENGTE)
    && Object.keys(w).every((k) => VORMEN.includes(k));
}

/**
 * Lees de teksten (de inhoud van content/teksten.json). Onbetrouwbare data: ongeldige teksten worden
 * overgeslagen en gemeld; zonder Nederlandse tekst telt een sleutel niet mee.
 * Geeft het aantal geldige teksten.
 */
export function zetTeksten(data) {
  const nieuw = new Map();
  if (!data || typeof data !== 'object') return 0;
  for (const [sleutel, talen] of Object.entries(data)) {
    if (sleutel.startsWith('_')) continue; // uitleg in het bestand
    if (!SLEUTEL_PATROON.test(sleutel) || !talen || typeof talen !== 'object') {
      console.warn(`Tekst "${sleutel}" overgeslagen: ongeldig`);
      continue;
    }
    const per = {};
    for (const t of TALEN) {
      if (talen[t] === undefined) continue;
      if (geldigeWaarde(talen[t])) per[t] = talen[t];
      else console.warn(`Tekst "${sleutel}" (${t}) overgeslagen: ongeldig of te lang`);
    }
    if (per[BRONTAAL] === undefined) {
      console.warn(`Tekst "${sleutel}" overgeslagen: Nederlandse tekst ontbreekt`);
      continue;
    }
    nieuw.set(sleutel, per);
  }
  teksten = nieuw;
  return nieuw.size;
}

/** Zet de taal van de app. Onbekend = Nederlands. */
export function zetTaal(nieuw) {
  taal = TALEN.includes(nieuw) ? nieuw : BRONTAAL;
  return taal;
}

/** De taal van de app nu. */
export function huidigeTaal() {
  return taal;
}

function vorm(n) {
  if (!meervoud.has(taal)) meervoud.set(taal, new Intl.PluralRules(taal));
  return meervoud.get(taal).select(n) === 'one' ? 'one' : 'other';
}

/**
 * Tekst in de huidige taal, met invulplekken: t('kaart.lijstgreep', { n: 12 }).
 * Teksten met enkelvoud en meervoud kiezen op 'n'. Ontbreekt de tekst in deze taal (of is hij leeg
 * terwijl het Nederlands dat niet is), dan de Nederlandse; ontbreekt hij helemaal, dan de sleutel zelf
 * (zo valt een vergeten tekst op, zonder dat de app stopt).
 */
export function t(sleutel, waarden = {}) {
  const per = teksten.get(sleutel);
  if (!per) return sleutel;
  let w = per[taal];
  if (w === undefined || (w === '' && per[BRONTAAL] !== '')) w = per[BRONTAAL];
  if (typeof w === 'object') w = w[vorm(Number(waarden.n))];
  return w.replace(/\{(\w+)\}/g, (heel, naam) => (Object.hasOwn(waarden, naam) ? String(waarden[naam]) : heel));
}

/** Getal in de schrijfwijze van de taal: 1,5 (nl, de) of 1.5 (en). */
export function getal(n) {
  return new Intl.NumberFormat(taal, { maximumFractionDigits: 1 }).format(n);
}

/** "A", "A en B", "A, B en C" (nl) / "A, B, and C" (en) / "A, B und C" (de). */
export function lijstTekst(namen) {
  return new Intl.ListFormat(taal, { type: 'conjunction' }).format(namen);
}

/** Sorteren op naam volgens de regels van de taal. */
export function vergelijk(a, b) {
  return a.localeCompare(b, taal);
}
