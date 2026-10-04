// Gebouwomtrekken voor kaart en afstand.
// Bron: 'vorm' in de inhoud, anders het Kadaster (BAG) via PDOK op basis van het adres.
// Een opgezochte omtrek wordt op dit toestel bewaard (geen persoonsgegevens: alleen de vorm van het gebouw).

const PDOK_ZOEK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_BAG = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const VORM_SLEUTEL = 'enschede-app:vormen:v1';
const geheugen = new Map(); // gebouw-id -> Promise<vorm|null>
const bekend = new Map();   // gebouw-id -> vorm (direct beschikbaar)

function leesBewaard() {
  try { return JSON.parse(localStorage.getItem(VORM_SLEUTEL)) || {}; } catch { return {}; }
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

function puntInRing(x, y, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen;
  }
  return binnen;
}

function isGetal(w) { return typeof w === 'number' && Number.isFinite(w); }

async function zoek(gebouw) {
  if (gebouw.vorm) return gebouw.vorm;
  if (!gebouw.adres) return null;
  const sleutel = `${gebouw.id}|${gebouw.adres}`;
  const bewaard = leesBewaard()[sleutel];
  if (Array.isArray(bewaard)) return bewaard;

  // 1. Adres -> punt (PDOK Locatieserver)
  const q = encodeURIComponent(`${gebouw.adres} Enschede`);
  const zoek = await haalJson(`${PDOK_ZOEK}?q=${q}&fq=type:adres&fq=woonplaatsnaam:Enschede&rows=1&fl=centroide_ll`);
  const punt = /^POINT\(([\d.]+) ([\d.]+)\)$/.exec(zoek?.response?.docs?.[0]?.centroide_ll ?? '');
  if (!punt) throw new Error(`Adres niet gevonden: ${gebouw.adres}`);
  const lng = Number(punt[1]);
  const lat = Number(punt[2]);

  // 2. Punt -> pand waarin het adres ligt (BAG)
  const d = 0.0002;
  const bag = await haalJson(`${PDOK_BAG}?f=json&limit=25&bbox=${lng - d},${lat - d},${lng + d},${lat + d}`);
  const pand = (bag?.features ?? []).find((f) => f?.geometry?.type === 'Polygon'
    && Array.isArray(f.geometry.coordinates?.[0]) && puntInRing(lng, lat, f.geometry.coordinates[0]));
  if (!pand) throw new Error(`Geen gebouw gevonden bij ${gebouw.adres}`);

  // Alleen de buitenrand, afgerond op ~1 cm; controleer elk punt voordat het wordt gebruikt.
  const vorm = pand.geometry.coordinates[0]
    .filter((p) => Array.isArray(p) && isGetal(p[0]) && isGetal(p[1]))
    .map(([x, y]) => [Math.round(y * 1e7) / 1e7, Math.round(x * 1e7) / 1e7]);
  if (vorm.length < 3) throw new Error(`Ongeldige omtrek voor ${gebouw.adres}`);
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
