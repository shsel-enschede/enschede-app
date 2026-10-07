// Gebouwomtrekken voor kaart en afstand.
// Bron: 'vorm' in de inhoud, anders het Kadaster (BAG) via PDOK op basis van het adres.
// Een opgezochte omtrek wordt op dit toestel bewaard (geen persoonsgegevens: alleen de vorm van het gebouw).

import { puntInRing } from './hulp.js';

const PDOK_ZOEK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_BAG = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const VORM_SLEUTEL = 'enschede-app:vormen:v1';
const geheugen = new Map(); // gebouw-id -> Promise<vorm|null>
const bekend = new Map();   // gebouw-id -> vorm (direct beschikbaar)

function leesBewaard() {
  try {
    const alles = JSON.parse(localStorage.getItem(VORM_SLEUTEL));
    return alles && typeof alles === 'object' && !Array.isArray(alles) ? alles : {};
  } catch { return {}; }
}

// Een bewaarde omtrek komt uit de browser en wordt net zo gecontroleerd als de inhoud.
function geldigeVorm(vorm) {
  return Array.isArray(vorm) && vorm.length >= 3 && vorm.length <= 500
    && vorm.every((p) => Array.isArray(p) && p.length === 2 && isGetal(p[0]) && isGetal(p[1]));
}
function bewaar(sleutel, vorm) {
  const alles = leesBewaard();
  alles[sleutel] = vorm;
  try { localStorage.setItem(VORM_SLEUTEL, JSON.stringify(alles)); } catch { /* geen opslag: volgende keer opnieuw opzoeken */ }
}

async function haalJson(url) {
  const antwoord = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
  if (!antwoord.ok) throw new Error(`PDOK antwoordt ${antwoord.status}`);
  return antwoord.json();
}

function isGetal(w) { return typeof w === 'number' && Number.isFinite(w); }

/** Adres in Enschede -> { lat, lng } van het adres (PDOK Locatieserver). */
export async function zoekAdres(adres) {
  const q = encodeURIComponent(`${adres} Enschede`);
  const zoek = await haalJson(`${PDOK_ZOEK}?q=${q}&fq=type:adres&fq=woonplaatsnaam:Enschede&rows=1&fl=weergavenaam,centroide_ll`);
  const doc = zoek?.response?.docs?.[0];
  const punt = /^POINT\(([\d.]+) ([\d.]+)\)$/.exec(doc?.centroide_ll ?? '');
  if (!punt) throw new Error(`Adres niet gevonden: ${adres}`);
  return { lat: Number(punt[2]), lng: Number(punt[1]), naam: typeof doc.weergavenaam === 'string' ? doc.weergavenaam.slice(0, 120) : adres };
}

/** Omtrek (lijst van [lat, lng]) van het pand waarin het punt ligt (BAG), of null. */
export async function zoekPand(lat, lng) {
  const d = 0.0002;
  const bag = await haalJson(`${PDOK_BAG}?f=json&limit=25&bbox=${lng - d},${lat - d},${lng + d},${lat + d}`);
  const pand = (bag?.features ?? []).find((f) => f?.geometry?.type === 'Polygon'
    && Array.isArray(f.geometry.coordinates?.[0]) && puntInRing(lng, lat, f.geometry.coordinates[0]));
  if (!pand) return null;
  // Alleen de buitenrand, afgerond op ~1 cm; controleer elk punt voordat het wordt gebruikt.
  const vorm = pand.geometry.coordinates[0]
    .filter((p) => Array.isArray(p) && isGetal(p[0]) && isGetal(p[1]))
    .map(([x, y]) => [Math.round(y * 1e7) / 1e7, Math.round(x * 1e7) / 1e7]);
  return vorm.length >= 3 ? vorm : null;
}

async function zoek(gebouw) {
  if (gebouw.vorm) return gebouw.vorm;
  if (!gebouw.adres) return null;
  const sleutel = `${gebouw.id}|${gebouw.adres}`;
  const bewaard = leesBewaard()[sleutel];
  if (geldigeVorm(bewaard)) return bewaard;

  const { lat, lng } = await zoekAdres(gebouw.adres);
  const vorm = await zoekPand(lat, lng);
  if (!vorm) throw new Error(`Geen gebouw gevonden bij ${gebouw.adres}`);
  bewaar(sleutel, vorm);
  return vorm;
}

/** Omtrek van een gebouw (lijst van [lat, lng]) of null. Eén opzoekactie per gebouw per sessie. */
export function vormVan(gebouw) {
  if (!gebouw) return Promise.resolve(null);
  if (!geheugen.has(gebouw.id)) {
    geheugen.set(gebouw.id, zoek(gebouw)
      .then((vorm) => { if (vorm) bekend.set(gebouw.id, vorm); return vorm; })
      .catch((fout) => { geheugen.delete(gebouw.id); throw fout; }));
  }
  return geheugen.get(gebouw.id);
}

/** Omtrek als die al bekend is, zonder te wachten. */
export function bekendeVorm(gebouwId) {
  return bekend.get(gebouwId) ?? null;
}
