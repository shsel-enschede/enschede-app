// Wisselende volgorde van de antwoorden bij een vraag.
// Doel: in een schoolklas staat het goede antwoord niet bij iedereen onder dezelfde letter.
// Wie "B" van een ander overneemt, heeft daar niets aan: je moet het antwoord zelf lezen.
//
// - Elk toestel krijgt één willekeurig getal (het "zaad"). Daaruit volgt per vraag een vaste volgorde.
//   Zo blijft de volgorde gelijk als je een plek opnieuw opent of in "Mijn antwoorden" kijkt.
// - "Alles opnieuw beginnen" maakt een nieuw zaad: dan krijg je een nieuwe volgorde.
// - Het zaad is geen persoonsgegeven, staat alleen op dit toestel en wordt nergens heen gestuurd.
// - Een reeks (bijv. jaartallen 1932–1935) blijft op volgorde (Haladyna: logische volgorde),
//   maar staat willekeurig oplopend of aflopend, zodat de letter toch wisselt.
// - Bewaarde antwoorden blijven het nummer uit content/locaties.json (0 = eerste optie daar),
//   dus `juist` en eerder gegeven antwoorden kloppen altijd.

import { leesJson, schrijfJson } from './opslag.js';

const SLEUTEL = 'enschede-app:volgorde:v1';
let zaad = null;

function nieuwZaad() {
  try {
    const a = new Uint32Array(1);
    crypto.getRandomValues(a);
    return a[0];
  } catch {
    return Math.floor(Math.random() * 0x100000000); // geen crypto (oude browser of test): goed genoeg hiervoor
  }
}

// Wat uit de opslag komt is onbetrouwbaar: alleen een geheel getal van 32 bits accepteren.
function isZaad(w) {
  return Number.isInteger(w) && w >= 0 && w <= 0xffffffff;
}

function huidigZaad() {
  if (zaad === null) {
    const bewaard = leesJson(SLEUTEL);
    zaad = isZaad(bewaard) ? bewaard : nieuwZaad();
    if (!isZaad(bewaard)) schrijfJson(SLEUTEL, zaad); // lukt dat niet, dan geldt de volgorde alleen deze sessie
  }
  return zaad;
}

/** Nieuwe volgorde voor alle vragen (bij "Alles opnieuw beginnen"). */
export function nieuweVolgorde() {
  zaad = nieuwZaad();
  schrijfJson(SLEUTEL, zaad);
}

// FNV-1a: tekst -> getal van 32 bits.
function hash(tekst, start) {
  let h = (0x811c9dc5 ^ start) >>> 0;
  for (let i = 0; i < tekst.length; i++) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

// Mulberry32: kleine, voorspelbare toevalsgenerator (zelfde zaad = zelfde reeks).
function generator(a) {
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Een reeks: alle opties hebben een getal en verschillen alleen in dat getal ("1932", "De 2e parochie"). */
export function isReeks(opties) {
  return opties.length > 1
    && opties.every((o) => /\d/.test(o))
    && new Set(opties.map((o) => o.replace(/\d+/g, '#'))).size === 1;
}

/**
 * Volgorde waarin de opties getoond worden: lijst met de nummers uit de inhoud.
 * Voorbeeld: [2, 0, 3, 1] = eerst optie 2 (als A), dan optie 0 (als B), enz.
 */
export function schud(opties, sleutel, z) {
  const rij = opties.map((_, i) => i);
  const toeval = generator(hash(sleutel, z));
  if (isReeks(opties)) return toeval() < 0.5 ? rij : rij.reverse();
  for (let i = rij.length - 1; i > 0; i--) { // Fisher-Yates
    const j = Math.floor(toeval() * (i + 1));
    [rij[i], rij[j]] = [rij[j], rij[i]];
  }
  return rij;
}

/** Volgorde voor een plek op dit toestel. */
export function volgordeVan(loc) {
  return schud(loc.opties, loc.id, huidigZaad());
}
