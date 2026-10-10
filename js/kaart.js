// Ontdekkaart: de gebouwen van alle plekken worden ingekleurd.
// (De functies accepteren een verzameling { id, locaties }, zodat later ook een thema of buurt kan.)
//   rood, stippelrand  = nog niet (alles) ontdekt
//   groen, met ✓       = alle verhalen bij dit gebouw beantwoord
// Kaartlaag: BRT-Achtergrondkaart (grijs) van PDOK, de geodienst van de overheid. Gratis, zonder sleutel, zonder tracking.
// Gebouwomtrek: zie gebouwen.js.
// Leaflet (vendor/leaflet) wordt pas geladen als de kaart voor het eerst nodig is, zodat de app snel start.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { vormVan } from './gebouwen.js';
import { scrolGedrag } from './hulp.js';

const PDOK_TEGELS = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png';
const GRENZEN = [[52.15, 6.75], [52.30, 7.00]]; // ruim rond Enschede
const KLEIN_OBJECT = 10; // meter: een vorm kleiner dan dit krijgt een groter tikvlak

// bubblingMouseEvents: false = een tik op een gebouw telt niet ook als tik op de lege kaart.
const STIJL_OPEN = { color: '#C10422', weight: 2, dashArray: '6 4', fillColor: '#ED1D27', fillOpacity: 0.28, bubblingMouseEvents: false };
const STIJL_KLAAR = { color: '#1E6B3A', weight: 2, dashArray: null, fillColor: '#2E9E5B', fillOpacity: 0.45, bubblingMouseEvents: false };
// Stip voor kleine objecten: blijft altijd zichtbaar, ook als de naam moet wijken (zie ontwar()).
const STIP = { radius: 7, color: '#fff', weight: 2, fillOpacity: 1, bubblingMouseEvents: false };
const stipStijl = (af) => ({ ...STIP, fillColor: af ? '#1E6B3A' : '#C10422' });
// Plaatsen waar een naam mag staan, in volgorde van voorkeur (klassieke regel uit de kaartkunde:
// eerst een andere plek rond het object proberen, pas daarna de naam verbergen).
const POSITIES_KLEIN = ['boven', 'onder', 'rechts', 'links'];
const POSITIES_GROOT = ['midden', 'onder', 'boven', 'rechts', 'links'];
// Volgorde voor dit gebouw: eerst de 'naamPlek' uit de inhoud (als die er is), dan de standaardvolgorde.
function posities(groep) {
  const standaard = groep.klein ? POSITIES_KLEIN : POSITIES_GROOT;
  const voorkeur = groep.gebouw.naamPlek;
  return voorkeur ? [voorkeur, ...standaard.filter((p) => p !== voorkeur)] : standaard;
}
const POSITIE_KLASSEN = ['midden', 'boven', 'onder', 'rechts', 'links'].map((p) => `wijkkaart__label--${p}`);

let leafletLaden = null;
let kaart = null;
let laag = null;
let huidigeVerzameling = null; // id van de getekende verzameling (nu altijd 'alles')
let mijnStip = null;
let mijnCirkel = null;
let laatsteOpties = null;
const getekend = new Map(); // gebouw-id -> { vlak, label, gebouw, locaties }
let gemarkeerd = null; // gebouw-id van de plek waar je nu langs loopt (zie markeerPlek)

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

// ---------- Tekenen ----------

function telling(groep, antwoordVan) {
  const klaar = groep.locaties.filter((loc) => antwoordVan(loc.id) !== null).length;
  return { klaar, totaal: groep.locaties.length, af: klaar === groep.locaties.length };
}

function labelElement(groep, antwoordVan) {
  const t = telling(groep, antwoordVan);
  const span = document.createElement('span');
  span.className = t.af ? 'wijkkaart__label wijkkaart__label--klaar' : 'wijkkaart__label';
  span.classList.add(`wijkkaart__label--${groep.positie || posities(groep)[0]}`);
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
  // Kleine objecten (zoals het brandmonument of de zonnewijzer, enkele meters groot) zijn op de kaart
  // maar een paar pixels. Ze krijgen een stip die altijd zichtbaar blijft, een onzichtbaar groter
  // tikvlak (min. 44 px) en de naam ernaast (bij voorkeur erboven).
  if (vorm) {
    const b = vlak.getBounds();
    groep.klein = b.getNorthWest().distanceTo(b.getSouthEast()) < KLEIN_OBJECT;
  }
  const label = L.marker(midden, {
    icon: labelIcoon(L, groep, antwoordVan),
    keyboard: true,
    title: groep.gebouw.naam,
    alt: groep.gebouw.naam,
  }).addTo(laag);
  const kies = () => kiesGroep(groep);
  vlak.on('click', kies);
  label.on('click', kies);
  let stip = null;
  if (groep.klein) {
    stip = L.circleMarker(midden, stipStijl(t.af)).addTo(laag).on('click', kies);
    L.circleMarker(midden, { radius: 22, stroke: false, fill: true, fillOpacity: 0, bubblingMouseEvents: false })
      .addTo(laag).on('click', kies);
  }
  // Een stip die altijd zichtbaar blijft: een naam mag er niet overheen vallen (ook niet een losse plek zonder omtrek).
  const punt = groep.klein ? { latLng: midden, straal: STIP.radius } : (vorm ? null : { latLng: midden, straal: 14 });
  getekend.set(groep.gebouw.id, { vlak, label, stip, punt, ...groep });
  if (gemarkeerd === groep.gebouw.id) zetMarkering(getekend.get(groep.gebouw.id), true, false);
}

// ---------- "Je loopt langs …" op de kaart ----------
// De plek waar je langs loopt, licht twee keer zacht op en blijft daarna iets dikker omrand.
// Rustig en in de rand van je aandacht (calm technology): geen pop-up, geen trilling.
// Met 'minder beweging' (prefers-reduced-motion) blijft alleen de dikkere rand; zie css/app.css.

function elementenVan(g) {
  return [g.vlak.getElement?.(), g.stip?.getElement?.(), g.label.getElement()?.firstElementChild].filter(Boolean);
}

function zetMarkering(g, aan, puls) {
  for (const e of elementenVan(g)) {
    e.classList.toggle('wijkkaart--langs', aan);
    e.classList.remove('wijkkaart--puls');
    if (aan && puls) {
      void e.getBoundingClientRect(); // animatie opnieuw laten beginnen
      e.classList.add('wijkkaart--puls');
      e.addEventListener('animationend', () => e.classList.remove('wijkkaart--puls'), { once: true });
    }
  }
}

/** Markeer het gebouw (id zoals in groepeer) waar je langs loopt, of haal de markering weg met null. */
export function markeerPlek(id) {
  if (id === gemarkeerd) return;
  const oud = gemarkeerd && getekend.get(gemarkeerd);
  if (oud) zetMarkering(oud, false, false);
  gemarkeerd = id;
  const nieuw = id && getekend.get(id);
  if (nieuw) zetMarkering(nieuw, true, true);
}

// Groepeer de locaties van een verzameling per gebouw.
// Een locatie zonder (bekend) gebouw krijgt een eigen stip op haar positie.
function groepeer(verzameling, inhoud) {
  const groepen = new Map();
  for (const id of verzameling.locaties) {
    const loc = inhoud.locaties.get(id);
    const gebouw = (loc.gebouw && inhoud.gebouwen.get(loc.gebouw)) || { id: `los-${loc.id}`, naam: loc.titel, adres: null, vorm: null };
    if (!groepen.has(gebouw.id)) groepen.set(gebouw.id, { gebouw, locaties: [] });
    groepen.get(gebouw.id).locaties.push(loc);
  }
  return [...groepen.values()];
}

// ---------- Openbaar ----------

/**
 * Toont de kaart van een verzameling plekken ({ id, locaties }) in 'houder'.
 * opties: { antwoordVan(id), kiesGroep(groep), opLeegTik(), meld(tekst) }
 */
export async function toonKaart(houder, verzameling, inhoud, opties) {
  const L = await laadLeaflet();
  laatsteOpties = opties;

  if (!kaart) {
    // Op een aanraakscherm geen zoomknoppen: knijpen werkt, en de knoppen nemen ruimte in.
    const aanraak = matchMedia('(pointer: coarse)').matches;
    kaart = L.map(houder, {
      zoomControl: false,
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
    if (!aanraak) L.control.zoom({ position: 'topright' }).addTo(kaart); // linksboven staat de teller
    kaart.on('click', () => laatsteOpties?.opLeegTik?.());
    kaart.on('zoomend', ontwar);
    // De kaart vult het scherm; verandert de ruimte (voetbalk, draaien), dan de kaart opnieuw laten passen.
    new ResizeObserver(() => kaart.invalidateSize()).observe(houder);
  }
  // De kaart stond mogelijk in een verborgen scherm: grootte opnieuw bepalen.
  kaart.invalidateSize();

  if (huidigeVerzameling === verzameling.id) {
    ververs(opties.antwoordVan);
    return;
  }
  huidigeVerzameling = verzameling.id;
  laag.clearLayers();
  getekend.clear();

  const groepen = groepeer(verzameling, inhoud);
  let mislukt = 0;
  await Promise.all(groepen.map(async (groep) => {
    let vorm = null;
    try {
      vorm = groep.gebouw.adres || groep.gebouw.vorm ? await vormVan(groep.gebouw) : null;
    } catch (fout) {
      mislukt += 1;
      console.warn(fout);
    }
    if (huidigeVerzameling === verzameling.id) teken(L, groep, vorm, opties);
  }));

  ontwar();

  const vlakken = [...getekend.values()].map((g) => g.vlak);
  if (vlakken.length) kaart.fitBounds(L.featureGroup(vlakken).getBounds(), {
    paddingTopLeft: [32, 96], // ruimte voor de teller linksboven
    paddingBottomRight: [72, 40], // ruimte voor de locatieknop
    maxZoom: 18,
  });
  if (mislukt) opties.meld?.('Niet alle gebouwen konden worden opgezocht. Ze staan als stip op de kaart.');
}

// Namen mogen elkaar niet overlappen. Bij elke zoomstap: plaats de namen één voor één.
// Volgorde: eerst gebouwen die nog niet ontdekt zijn (die wil je vinden), dan kleine objecten
// (een groot gebouw herken je ook zonder naam aan zijn vorm, een zonnewijzer niet), dan de meeste verhalen.
// Elke naam probeert een paar plaatsen rond het object, te beginnen bij 'naamPlek' uit de inhoud
// (bijv. de straatkant van de zonnewijzer). Past geen enkele, dan wordt de naam verborgen;
// het gebouw zelf (of de stip van een klein object) blijft zichtbaar en aantikbaar, en inzoomen maakt
// de naam weer zichtbaar. Wie de kaart niet kan of wil gebruiken, heeft de lijst onder de kaart.
function ontwar() {
  if (!kaart) return;
  const MARGE = 4; // px lucht tussen twee namen
  const antwoordVan = laatsteOpties?.antwoordVan || (() => null);
  const kader = kaart.getContainer().getBoundingClientRect();
  const alle = [...getekend.values()];

  // Stippen van kleine objecten en losse plekken: daar mag geen naam overheen.
  const stippen = alle.filter((g) => g.punt).map((g) => {
    const p = kaart.latLngToContainerPoint(g.punt.latLng);
    const x = kader.left + p.x;
    const y = kader.top + p.y;
    const s = g.punt.straal + 2;
    return { eigenaar: g, left: x - s, right: x + s, top: y - s, bottom: y + s };
  });
  const botst = (r, rechthoeken, marge) => rechthoeken.some((p) => r.left < p.right + marge
    && r.right > p.left - marge && r.top < p.bottom + marge && r.bottom > p.top - marge);

  const open = (g) => (telling(g, antwoordVan).af ? 1 : 0);
  const groepen = alle.sort((x, y) => open(x) - open(y)
    || Number(Boolean(y.klein)) - Number(Boolean(x.klein))
    || y.locaties.length - x.locaties.length
    || x.gebouw.naam.localeCompare(y.gebouw.naam, 'nl'));

  const geplaatst = [];
  for (const groep of groepen) {
    const icoon = groep.label.getElement();
    const span = icoon?.firstElementChild;
    if (!span) continue;
    icoon.classList.remove('wijkkaart__anker--verborgen');
    const anderen = stippen.filter((s) => s.eigenaar !== groep);
    let gevonden = null;
    for (const positie of posities(groep)) {
      span.classList.remove(...POSITIE_KLASSEN);
      span.classList.add(`wijkkaart__label--${positie}`);
      const r = span.getBoundingClientRect();
      if (!r.width) break; // kaart (nog) niet zichtbaar
      if (!botst(r, geplaatst, MARGE) && !botst(r, anderen, 0)) { gevonden = { positie, r }; break; }
    }
    if (gevonden) {
      groep.positie = gevonden.positie;
      geplaatst.push(gevonden.r);
    } else {
      // Niets past: terug naar de voorkeursplaats en verbergen tot je inzoomt.
      groep.positie = null;
      span.classList.remove(...POSITIE_KLASSEN);
      span.classList.add(`wijkkaart__label--${posities(groep)[0]}`);
      icoon.classList.add('wijkkaart__anker--verborgen');
    }
  }
}

/** Kleuren en tellers bijwerken na een antwoord. */
function ververs(antwoordVan) {
  const L = window.L;
  if (!L) return;
  for (const groep of getekend.values()) {
    const t = telling(groep, antwoordVan);
    groep.vlak.setStyle(t.af ? STIJL_KLAAR : STIJL_OPEN);
    groep.stip?.setStyle(stipStijl(t.af));
    groep.label.setIcon(labelIcoon(L, groep, antwoordVan));
    if (gemarkeerd === groep.gebouw.id) zetMarkering(groep, true, false); // nieuw label: markering terug, zonder puls
  }
  ontwar(); // nieuwe tekst kan breder zijn
}

/** Schuif de kaart naar je positie, maar alleen als die binnen het kaartgebied (Enschede) ligt. */
export function centreer(positie) {
  const L = window.L;
  if (!L || !kaart || !positie) return;
  const ll = L.latLng(positie.lat, positie.lng);
  if (!L.latLngBounds(GRENZEN).contains(ll)) return;
  kaart.setView(ll, Math.max(kaart.getZoom(), 17), { animate: scrolGedrag() === 'smooth' });
}

/** Toon (of verberg, met null) de eigen positie als blauwe stip met een cirkel voor de onzekerheid. */
export function toonPositie(positie) {
  const L = window.L;
  if (!L || !kaart) return;
  if (!positie) {
    mijnStip?.remove(); mijnCirkel?.remove();
    mijnStip = null; mijnCirkel = null;
    return;
  }
  const ll = [positie.lat, positie.lng];
  if (!mijnStip) {
    mijnCirkel = L.circle(ll, { radius: positie.nauwkeurigheid, color: '#1A73E8', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(kaart);
    mijnStip = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 3, fillColor: '#1A73E8', fillOpacity: 1, interactive: false }).addTo(kaart);
  } else {
    mijnCirkel.setLatLng(ll).setRadius(positie.nauwkeurigheid);
    mijnStip.setLatLng(ll);
  }
}
