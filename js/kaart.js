// Kaart van een route: de gebouwen van de locaties worden ingekleurd.
//   rood, stippelrand  = nog niet (alles) bezocht
//   groen, met ✓       = alle verhalen bij dit gebouw beantwoord
// Kaartlaag: BRT-Achtergrondkaart (grijs) van PDOK, de geodienst van de overheid. Gratis, zonder sleutel, zonder tracking.
// Gebouwomtrek: uit 'vorm' in de inhoud, anders opgezocht in het Kadaster (BAG) via het adres en daarna op dit toestel bewaard.
// Leaflet (vendor/leaflet) wordt pas geladen als de kaart voor het eerst nodig is, zodat de app snel start.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

const PDOK_TEGELS = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png';
const PDOK_ZOEK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
const PDOK_BAG = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';
const VORM_SLEUTEL = 'enschede-app:vormen:v1';
const GRENZEN = [[52.15, 6.75], [52.30, 7.00]]; // ruim rond Enschede

const STIJL_OPEN = { color: '#C10422', weight: 2, dashArray: '6 4', fillColor: '#ED1D27', fillOpacity: 0.28 };
const STIJL_KLAAR = { color: '#1E6B3A', weight: 2, dashArray: null, fillColor: '#2E9E5B', fillOpacity: 0.45 };

let leafletLaden = null;
let kaart = null;
let laag = null;
let huidigeRoute = null;
const getekend = new Map(); // gebouw-id -> { vlak, label, gebouw, locaties }

// ---------- Leaflet op aanvraag laden ----------

function laadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (leafletLaden) return leafletLaden;
  leafletLaden = new Promise((klaar, mislukt) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'vendor/leaflet/leaflet.css';
    document.head.append(css);
    const js = document.createElement('script');
    js.src = 'vendor/leaflet/leaflet.js';
    js.onload = () => klaar(window.L);
    js.onerror = () => { leafletLaden = null; mislukt(new Error('Kaartbibliotheek niet geladen')); };
    document.head.append(js);
  });
  return leafletLaden;
}

// ---------- Gebouwomtrek opzoeken en bewaren ----------

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

async function zoekVorm(gebouw) {
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

// ---------- Tekenen ----------

function telling(groep, antwoordVan) {
  const klaar = groep.locaties.filter((loc) => antwoordVan(loc.id) !== null).length;
  return { klaar, totaal: groep.locaties.length, af: klaar === groep.locaties.length };
}

function labelElement(groep, antwoordVan) {
  const t = telling(groep, antwoordVan);
  const span = document.createElement('span');
  span.className = t.af ? 'wijkkaart__label wijkkaart__label--klaar' : 'wijkkaart__label';
  span.textContent = `${t.af ? '✓ ' : ''}${groep.gebouw.naam}${t.totaal > 1 ? ` ${t.klaar}/${t.totaal}` : ''}`;
  return span;
}

function labelIcoon(L, groep, antwoordVan) {
  return L.divIcon({ className: 'wijkkaart__anker', html: labelElement(groep, antwoordVan), iconSize: null });
}

function teken(L, groep, vorm, opties) {
  const { antwoordVan, kiesGroep } = opties;
  const t = telling(groep, antwoordVan);
  const vlak = vorm
    ? L.polygon(vorm, t.af ? STIJL_KLAAR : STIJL_OPEN)
    : L.circleMarker(groep.locaties[0].positie, { ...(t.af ? STIJL_KLAAR : STIJL_OPEN), radius: 14 });
  vlak.addTo(laag);
  const midden = vorm ? vlak.getBounds().getCenter() : vlak.getLatLng();
  const label = L.marker(midden, {
    icon: labelIcoon(L, groep, antwoordVan),
    keyboard: true,
    title: groep.gebouw.naam,
    alt: groep.gebouw.naam,
  }).addTo(laag);
  const kies = () => kiesGroep(groep);
  vlak.on('click', kies);
  label.on('click', kies);
  getekend.set(groep.gebouw.id, { vlak, label, ...groep });
}

// Groepeer de locaties van een route per gebouw, in route-volgorde.
// Een locatie zonder (bekend) gebouw krijgt een eigen stip op haar positie.
function groepeer(route, inhoud) {
  const groepen = new Map();
  for (const id of route.locaties) {
    const loc = inhoud.locaties.get(id);
    const gebouw = (loc.gebouw && inhoud.gebouwen.get(loc.gebouw)) || { id: `los-${loc.id}`, naam: loc.titel, adres: null, vorm: null };
    if (!groepen.has(gebouw.id)) groepen.set(gebouw.id, { gebouw, locaties: [] });
    groepen.get(gebouw.id).locaties.push(loc);
  }
  return [...groepen.values()];
}

// ---------- Openbaar ----------

/**
 * Toont de kaart van een route in 'houder'.
 * opties: { antwoordVan(id), kiesGroep(groep), meld(tekst) }
 */
export async function toonKaart(houder, route, inhoud, opties) {
  const L = await laadLeaflet();

  if (!kaart) {
    kaart = L.map(houder, {
      zoomControl: true,
      minZoom: 14,
      maxZoom: 20,
      maxBounds: GRENZEN,
      maxBoundsViscosity: 0.8,
      attributionControl: true,
    }).setView([52.2218, 6.8935], 17);
    kaart.attributionControl.setPrefix(false);
    L.tileLayer(PDOK_TEGELS, {
      maxNativeZoom: 19,
      maxZoom: 20,
      attribution: 'Kaart: PDOK / Kadaster',
    }).addTo(kaart);
    laag = L.layerGroup().addTo(kaart);
  }
  // De kaart stond mogelijk in een verborgen scherm: grootte opnieuw bepalen.
  kaart.invalidateSize();

  if (huidigeRoute === route.id) {
    ververs(opties.antwoordVan);
    return;
  }
  huidigeRoute = route.id;
  laag.clearLayers();
  getekend.clear();

  const groepen = groepeer(route, inhoud);
  let mislukt = 0;
  await Promise.all(groepen.map(async (groep) => {
    let vorm = null;
    try {
      vorm = await zoekVorm(groep.gebouw);
    } catch (fout) {
      mislukt += 1;
      console.warn(fout);
    }
    if (huidigeRoute === route.id) teken(L, groep, vorm, opties);
  }));

  const vlakken = [...getekend.values()].map((g) => g.vlak);
  if (vlakken.length) kaart.fitBounds(L.featureGroup(vlakken).getBounds(), { padding: [32, 32], maxZoom: 18 });
  if (mislukt) opties.meld?.('Niet alle gebouwen konden worden opgezocht. Ze staan als stip op de kaart.');
}

/** Kleuren en tellers bijwerken na een antwoord. */
export function ververs(antwoordVan) {
  const L = window.L;
  if (!L) return;
  for (const groep of getekend.values()) {
    const t = telling(groep, antwoordVan);
    groep.vlak.setStyle(t.af ? STIJL_KLAAR : STIJL_OPEN);
    groep.label.setIcon(labelIcoon(L, groep, antwoordVan));
  }
}
