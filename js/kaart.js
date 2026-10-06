// Ontdekkaart: de gebouwen van alle plekken worden ingekleurd.
// (De functies accepteren een verzameling { id, locaties }, zodat later ook een thema of buurt kan.)
//   rood, stippelrand  = nog niet (alles) ontdekt
//   groen, met ✓       = alle verhalen bij dit gebouw beantwoord
// Kaartlaag: BRT-Achtergrondkaart (grijs) van PDOK, de geodienst van de overheid. Gratis, zonder sleutel, zonder tracking.
// Gebouwomtrek: zie gebouwen.js.
// Leaflet (vendor/leaflet) wordt pas geladen als de kaart voor het eerst nodig is, zodat de app snel start.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { vormVan } from './gebouwen.js';

const PDOK_TEGELS = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png';
const GRENZEN = [[52.15, 6.75], [52.30, 7.00]]; // ruim rond Enschede

// bubblingMouseEvents: false = een tik op een gebouw telt niet ook als tik op de lege kaart.
const STIJL_OPEN = { color: '#C10422', weight: 2, dashArray: '6 4', fillColor: '#ED1D27', fillOpacity: 0.28, bubblingMouseEvents: false };
const STIJL_KLAAR = { color: '#1E6B3A', weight: 2, dashArray: null, fillColor: '#2E9E5B', fillOpacity: 0.45, bubblingMouseEvents: false };

let leafletLaden = null;
let kaart = null;
let laag = null;
let huidigeRoute = null;
let mijnStip = null;
let mijnCirkel = null;
let laatsteOpties = null;
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
 * opties: { antwoordVan(id), kiesGroep(groep), opLeegTik(), meld(tekst) }
 */
export async function toonKaart(houder, route, inhoud, opties) {
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
    // De kaart vult het scherm; verandert de ruimte (voetbalk, draaien), dan de kaart opnieuw laten passen.
    new ResizeObserver(() => kaart.invalidateSize()).observe(houder);
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
      vorm = groep.gebouw.adres || groep.gebouw.vorm ? await vormVan(groep.gebouw) : null;
    } catch (fout) {
      mislukt += 1;
      console.warn(fout);
    }
    if (huidigeRoute === route.id) teken(L, groep, vorm, opties);
  }));

  const vlakken = [...getekend.values()].map((g) => g.vlak);
  if (vlakken.length) kaart.fitBounds(L.featureGroup(vlakken).getBounds(), {
    paddingTopLeft: [32, 96], // ruimte voor de teller linksboven
    paddingBottomRight: [72, 40], // ruimte voor de locatieknop
    maxZoom: 18,
  });
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

/** Schuif de kaart naar je positie, maar alleen als die binnen het kaartgebied (Enschede) ligt. */
export function centreer(positie) {
  const L = window.L;
  if (!L || !kaart || !positie) return;
  const ll = L.latLng(positie.lat, positie.lng);
  if (!L.latLngBounds(GRENZEN).contains(ll)) return;
  const zacht = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  kaart.setView(ll, Math.max(kaart.getZoom(), 17), { animate: zacht });
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
