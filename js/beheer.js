// Editor voor contentbeheerders (beheer.html).
// Je kiest per plek de positie, het gebouw en de foto's. Met de knop "Wijziging voorstellen" gaat je
// gecontroleerde wijziging naar GitHub als voorstel. Een collega-contentbeheerder kijkt mee (Akkoord of
// Opmerking) en een beheerder voegt het samen; pas dan is het live. GitHub zelf zie je niet.
// Alle teksten uit de inhoud en van GitHub gaan via textContent op het scherm, nooit via innerHTML (zie CLAUDE.md).

import { controleerLocatie, geldigBestand, LOKAAL } from './inhoud.js';
import { maak } from './hulp.js';
import { zoekAdres, zoekPand } from './gebouwen.js';
import * as gh from './github.js';
import { beschrijf, voegSamen, toestand, titelVoor, omschrijving, takNaam } from './voorstel.js';

const CONCEPT_SLEUTEL = 'enschede-app:beheer-concept:v2';
const OUD_CONCEPT = 'enschede-app:beheer-concept:v1';
const PAD = 'content/locaties.json';
const LIVE_EDITOR = 'https://shsel-enschede.github.io/enschede-app/beheer.html';
const TEGELS = {
  kaart: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
  luchtfoto: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
};
const ID_PATROON = /^[a-z0-9-]{1,60}$/;
const $ = (id) => document.getElementById(id);

let origineel = '';      // de versie van locaties.json waarop je werk gebaseerd is
let data = null;         // de inhoud waaraan we werken
let fotoLijst = [];      // uit content/fotos.json
let plek = null;         // de gekozen locatie (object binnen data.locaties)
let tekenen = false;
let kadasterPunt = null; // laatst opgezochte adrespunt

let gebruiker = null;    // { login, naam } na inloggen
let voorstel = null;     // { nummer, tak, titel, tekst } als je een eigen voorstel aanpast
let keuzes = {};         // gekozen versies bij een botsing: { 'plek:<id>': 'mijn' | 'hun' }
let bezig = false;

let kaart;
let lagen;
let speld;
const overlay = { anderen: null, gebouw: null, tekening: null, linkpunt: null };

// Grenzen van de kaart (zie maakKaart). Een link met een punt daarbuiten wordt genegeerd.
const GRENS = { latMin: 52.15, latMax: 52.3, lngMin: 6.75, lngMax: 7.0 };
const MIDDEN = [52.2219, 6.894]; // Oude Markt: beginbeeld als een plek nog geen positie heeft

// ---------- Hulpjes ----------

function rond(x) { return Math.round(x * 1e6) / 1e6; } // ~10 cm, ruim voldoende

function meld(tekst) {
  $('melding').textContent = tekst;
  $('melding').hidden = !tekst;
}

function gebouwVan(id, d = data) { return (d.gebouwen ?? []).find((g) => g.id === id) ?? null; }

function alsTekst(d) {
  // Coördinaatparen op één regel houden, dan blijft het bestand leesbaar voor vrijwilligers.
  return `${JSON.stringify(d, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')}\n`;
}

function fotoNaam(id) {
  const f = fotoLijst.find((x) => x.id === id);
  return (f ? `${f.bron ?? ''} ${f.documentnummer ?? ''}`.trim() : '') || id;
}

function luchtfotoLink(id, punt) {
  return `${LIVE_EDITOR}#${new URLSearchParams({ plek: id, lat: punt.lat.toFixed(6), lng: punt.lng.toFixed(6) })}`;
}

function bewaarConcept() {
  const tekst = alsTekst(data);
  try {
    if (tekst === origineel && !voorstel) localStorage.removeItem(CONCEPT_SLEUTEL);
    else localStorage.setItem(CONCEPT_SLEUTEL, JSON.stringify({ origineel, tekst, voorstel }));
  } catch { /* geen opslag: werk alleen in deze sessie */ }
}

function wisConcept() {
  try { localStorage.removeItem(CONCEPT_SLEUTEL); localStorage.removeItem(OUD_CONCEPT); } catch { /* niets */ }
}

let bewaarTimer;
function gewijzigd() {
  clearTimeout(bewaarTimer);
  bewaarTimer = setTimeout(() => {
    bewaarConcept();
    werkUitvoerBij();
  }, 300);
}

// ---------- Laden ----------

/** Nieuwste inhoud: na inloggen rechtstreeks uit GitHub (main), anders van de website. */
async function haalNieuwste() {
  if (gebruiker) {
    try {
      const kop = await gh.takSha(gh.HOOFDTAK);
      const [l, f] = await Promise.all([gh.leesBestand(PAD, kop), gh.leesBestand('content/fotos.json', kop).catch(() => null)]);
      return { locaties: JSON.parse(l), fotos: f ? JSON.parse(f) : null };
    } catch (fout) {
      console.warn('GitHub niet bereikbaar, inhoud van de website gebruikt', fout);
    }
  }
  const [l, f] = await Promise.all([
    fetch(PAD, { cache: 'no-cache' }),
    fetch('content/fotos.json', { cache: 'no-cache' }),
  ]);
  if (!l.ok) throw new Error('content/locaties.json niet gevonden');
  return { locaties: await l.json(), fotos: f.ok ? await f.json() : null };
}

function leesConcept() {
  try {
    const c = JSON.parse(localStorage.getItem(CONCEPT_SLEUTEL) ?? localStorage.getItem(OUD_CONCEPT));
    if (typeof c?.tekst !== 'string' || typeof c?.origineel !== 'string') return null;
    const v = c.voorstel;
    const voorstelOk = v && Number.isInteger(v.nummer) && gh.TAK_PATROON.test(v.tak ?? '') && typeof v.tekst === 'string';
    return { origineel: c.origineel, tekst: c.tekst, voorstel: voorstelOk ? { nummer: v.nummer, tak: v.tak, titel: String(v.titel ?? ''), tekst: v.tekst } : null };
  } catch { return null; }
}

/**
 * Zet je werk op de nieuwste versie: wat anderen intussen veranderden komt erbij, jouw wijzigingen blijven.
 * Lukt dat niet zonder botsing, dan blijft alles zoals het is; bij versturen kies je dan zelf.
 */
function zetOpNieuwste(nieuwste) {
  const vers = alsTekst(nieuwste);
  if (vers === origineel) return;
  const { resultaat, botsingen } = voegSamen(JSON.parse(origineel), data, nieuwste);
  if (botsingen.length) return;
  origineel = vers;
  data = resultaat;
  data.gebouwen ??= [];
}

async function laad() {
  const { locaties, fotos } = await haalNieuwste();
  fotoLijst = ((fotos?.fotos) ?? []).filter((x) => ID_PATROON.test(x?.id ?? ''));
  const concept = leesConcept();
  if (concept) {
    origineel = concept.origineel;
    data = JSON.parse(concept.tekst);
    voorstel = concept.voorstel;
    zetOpNieuwste(locaties);
    meld(voorstel
      ? 'Je was je voorstel aan het aanpassen. Dat werk is teruggezet.'
      : 'Je eerdere, nog niet verstuurde werk is teruggezet. Wil je opnieuw beginnen? Kies onderaan "Wijzigingen weggooien".');
  } else {
    origineel = alsTekst(locaties);
    data = JSON.parse(origineel);
  }
  data.gebouwen ??= [];
}

// ---------- Plek kiezen ----------

function vulPlekken() {
  const keuze = $('plek');
  keuze.replaceChildren();
  const lijst = [...data.locaties].sort((a, b) => (a.nummer ?? 0) - (b.nummer ?? 0));
  for (const loc of lijst) {
    const zonder = loc.positie ? '' : ' — nog geen positie';
    const optie = maak('option', '', `${loc.nummer} · ${loc.titel?.nl ?? loc.id}${loc.concept ? ' (concept)' : ''}${zonder}`);
    optie.value = loc.id;
    keuze.append(optie);
  }
  if (plek) keuze.value = plek.id;
  const met = data.locaties.filter((l) => l.positie).length;
  $('posities-telling').textContent = `${met} van de ${data.locaties.length} plekken hebben een positie.`;
}

function kiesPlek(id) {
  plek = data.locaties.find((l) => l.id === id);
  if (!plek) return;
  stopTekenen();
  kadasterPunt = null;
  $('adres-naar-positie').disabled = true;
  $('kadaster-status').textContent = '';
  toonPositie();
  overlay.linkpunt?.remove();
  overlay.linkpunt = null;
  vulGebouwKeuze();
  toonGebouw();
  toonFotos();
  toonAnderen();
  const g = gebouwVan(plek.gebouw);
  if (plek.positie) kaart.setView([plek.positie.lat, plek.positie.lng], 18);
  else if (Array.isArray(g?.vorm) && g.vorm.length >= 3) kaart.fitBounds(g.vorm, { maxZoom: 19, padding: [40, 40] });
  else kaart.setView(MIDDEN, 16);
}

function plekStatus() {
  const delen = [];
  delen.push(!plek.positie ? '○ nog geen positie' : (plek.positie.bevestigd ? '✓ positie gecontroleerd' : '○ positie nog niet gecontroleerd'));
  if (plek.concept) delen.push('concept: nog niet in de app');
  const g = gebouwVan(plek.gebouw);
  delen.push(g ? `gebouw: ${g.naam}` : 'geen gebouw');
  delen.push(`${(plek.fotos ?? []).length} foto('s) gekozen`);
  delen.push(plek.bevestigd ? '✓ antwoord bevestigd' : '○ antwoord nog niet bevestigd');
  $('plek-status').textContent = delen.join(' · ');
}

// ---------- Kaart ----------

function maakKaart() {
  const L = window.L;
  kaart = L.map('kaart', { maxZoom: 21, maxBounds: [[GRENS.latMin, GRENS.lngMin], [GRENS.latMax, GRENS.lngMax]] }).setView([52.2219, 6.894], 17);
  kaart.attributionControl.setPrefix(false);
  lagen = {
    kaart: L.tileLayer(TEGELS.kaart, { maxNativeZoom: 19, maxZoom: 21, attribution: 'Kaart: PDOK / Kadaster' }),
    luchtfoto: L.tileLayer(TEGELS.luchtfoto, { maxNativeZoom: 19, maxZoom: 21, attribution: 'Luchtfoto: PDOK / Beeldmateriaal Nederland' }),
  };
  lagen.kaart.addTo(kaart);

  const icoon = L.divIcon({ className: 'speld', iconSize: [28, 28], iconAnchor: [14, 28] });
  speld = L.marker([52.2219, 6.894], { draggable: true, icon: icoon, keyboard: true, title: 'Positie van de plek', alt: 'Positie van de plek' }).addTo(kaart);
  speld.on('dragend', () => zetPositie(speld.getLatLng()));

  kaart.on('click', (e) => {
    if (tekenen) voegPuntToe(e.latlng);
    else zetPositie(e.latlng);
  });

  for (const naam of ['kaart', 'luchtfoto']) {
    $(`laag-${naam}`).addEventListener('click', () => kiesLaag(naam));
  }
}

function kiesLaag(naam) {
  for (const [n, laag] of Object.entries(lagen)) {
    if (n === naam) laag.addTo(kaart); else laag.remove();
    $(`laag-${n}`).setAttribute('aria-pressed', String(n === naam));
  }
}

// ---------- Link naar een positie op de luchtfoto ----------
// Vorm: beheer.html#plek=<id>&lat=<breedte>&lng=<lengte>
// Openen kiest die plek, zet de luchtfoto aan en zoomt in op het punt uit de link.
// Een link verandert nooit iets aan de inhoud: wijkt het punt af van de opgeslagen positie,
// dan verschijnt het als blauw rondje en kun je de speld er zelf naartoe slepen.

function maakLink() {
  if (!plek.positie) return null;
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ plek: plek.id, lat: plek.positie.lat.toFixed(6), lng: plek.positie.lng.toFixed(6) }).toString();
  return url.toString();
}

function toonLink() {
  const url = maakLink();
  $('luchtfoto-link').href = url ?? '#';
  $('luchtfoto-link').textContent = url ?? '';
  $('kopieer-link').disabled = !url;
  $('link-status').textContent = url ? '' : 'Nog geen positie: tik op de kaart om er een te kiezen.';
}

async function kopieerLink() {
  try {
    const url = maakLink();
    if (!url) return;
    await navigator.clipboard.writeText(url);
    $('link-status').textContent = '✓ Link gekopieerd.';
  } catch {
    $('link-status').textContent = 'Kopiëren lukte niet automatisch. Houd de link hierboven ingedrukt (of klik met rechts) en kies "Link kopiëren".';
  }
}

function leesLink() {
  const p = new URLSearchParams(location.hash.slice(1));
  const id = p.get('plek');
  const lat = Number(p.get('lat'));
  const lng = Number(p.get('lng'));
  const plekOk = id !== null && ID_PATROON.test(id) && data.locaties.some((l) => l.id === id);
  const puntOk = Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= GRENS.latMin && lat <= GRENS.latMax && lng >= GRENS.lngMin && lng <= GRENS.lngMax;
  return { id: plekOk ? id : null, punt: puntOk ? { lat, lng } : null };
}

function volgLink() {
  const { id, punt } = leesLink();
  if (!id && !punt) return false;
  if (id) {
    $('plek').value = id;
    kiesPlek(id);
  } else if (!plek) {
    kiesPlek($('plek').value);
  }
  kiesLaag('luchtfoto');
  overlay.linkpunt?.remove();
  overlay.linkpunt = null;
  if (punt) {
    const verschil = plek.positie ? kaart.distance([punt.lat, punt.lng], [plek.positie.lat, plek.positie.lng]) : Infinity;
    if (!plek.positie) {
      overlay.linkpunt = window.L.circleMarker([punt.lat, punt.lng], { radius: 9, color: '#1d4ed8', weight: 3, fillOpacity: 0.25 }).addTo(kaart);
      $('link-status').textContent = 'Het blauwe rondje is het punt uit de link. Deze plek heeft nog geen positie: tik op het rondje om het over te nemen.';
    } else if (verschil > 1) {
      overlay.linkpunt = window.L.circleMarker([punt.lat, punt.lng], { radius: 9, color: '#1d4ed8', weight: 3, fillOpacity: 0.25 }).addTo(kaart);
      $('link-status').textContent = `Het blauwe rondje is het punt uit de link. Het ligt ${Math.round(verschil)} m van de opgeslagen positie (rode speld).`;
    }
    kaart.setView([punt.lat, punt.lng], 20);
  }
  return true;
}

function zetPositie({ lat, lng }) {
  const nieuw = !plek.positie;
  plek.positie = { lat: rond(lat), lng: rond(lng), bevestigd: plek.positie?.bevestigd === true };
  if (nieuw) vulPlekken(); // label "nog geen positie" in de keuzelijst bijwerken
  toonPositie();
  gewijzigd();
}

function toonPositie() {
  const p = plek.positie;
  if (p) {
    speld.setLatLng([p.lat, p.lng]);
    if (!kaart.hasLayer(speld)) speld.addTo(kaart);
  } else {
    speld.remove(); // geen speld zolang er geen positie is; tik op de kaart om er een te zetten
  }
  $('lat').textContent = p ? p.lat.toFixed(6) : 'nog niet gekozen';
  $('lng').textContent = p ? p.lng.toFixed(6) : '–';
  $('positie-ok').checked = p?.bevestigd === true;
  $('positie-ok').disabled = !p;
  plekStatus();
  toonLink();
}

// Andere plekken als grijze stipjes, zodat je ziet wat er al in de buurt staat.
function toonAnderen() {
  const L = window.L;
  overlay.anderen?.remove();
  overlay.anderen = L.layerGroup(data.locaties
    .filter((l) => l !== plek && l.positie)
    .map((l) => L.circleMarker([l.positie.lat, l.positie.lng], { radius: 5, color: '#707480', weight: 1, fillOpacity: 0.6, interactive: false })))
    .addTo(kaart);
}

// ---------- Gebouw ----------

function vulGebouwKeuze() {
  const keuze = $('gebouw');
  keuze.replaceChildren();
  const geen = maak('option', '', '— geen gebouw (alleen een stip) —');
  geen.value = '';
  keuze.append(geen);
  for (const g of data.gebouwen) {
    const optie = maak('option', '', g.adres ? `${g.naam} (${g.adres})` : g.naam);
    optie.value = g.id;
    keuze.append(optie);
  }
  const nieuw = maak('option', '', '+ Nieuw gebouw');
  nieuw.value = '__nieuw';
  keuze.append(nieuw);
  keuze.value = gebouwVan(plek.gebouw) ? plek.gebouw : '';
}

function nieuwGebouwId() {
  let i = 1;
  while (gebouwVan(`gebouw-${plek.nummer}${i > 1 ? `-${i}` : ''}`)) i += 1;
  return `gebouw-${plek.nummer}${i > 1 ? `-${i}` : ''}`;
}

function toonGebouw() {
  const g = gebouwVan(plek.gebouw);
  $('gebouw-velden').hidden = !g;
  overlay.gebouw?.remove();
  overlay.gebouw = null;
  if (!g) { plekStatus(); return; }
  $('gebouw-naam').value = g.naam ?? '';
  $('gebouw-adres').value = g.adres ?? '';
  $('teken-wis').disabled = !g.vorm;
  const ook = data.locaties.filter((l) => l !== plek && l.gebouw === g.id).map((l) => l.titel?.nl ?? l.id);
  $('kadaster-status').textContent = ook.length ? `Dit gebouw hoort ook bij: ${ook.join(', ')}. Wijzigingen gelden voor allemaal.` : '';
  tekenOmtrek(g);
  plekStatus();
}

function tekenOmtrek(g) {
  const L = window.L;
  overlay.gebouw?.remove();
  if (Array.isArray(g.vorm) && g.vorm.length >= 2) {
    overlay.gebouw = (g.vorm.length >= 3 ? L.polygon(g.vorm) : L.polyline(g.vorm))
      .setStyle({ color: '#C10422', weight: 2, fillColor: '#ED1D27', fillOpacity: 0.25, interactive: false }).addTo(kaart);
  }
}

async function zoekInKadaster() {
  const g = gebouwVan(plek.gebouw);
  if (!g?.adres || !/\d/.test(g.adres)) {
    $('kadaster-status').textContent = 'Vul eerst een adres met huisnummer in.';
    return;
  }
  $('kadaster-status').textContent = 'Bezig met opzoeken…';
  try {
    kadasterPunt = await zoekAdres(g.adres);
    const vorm = await zoekPand(kadasterPunt.lat, kadasterPunt.lng);
    $('adres-naar-positie').disabled = false;
    if (!g.vorm) {
      overlay.gebouw?.remove();
      if (vorm) {
        overlay.gebouw = window.L.polygon(vorm, { color: '#C10422', weight: 2, dashArray: '6 4', fillColor: '#ED1D27', fillOpacity: 0.2, interactive: false }).addTo(kaart);
        kaart.fitBounds(overlay.gebouw.getBounds(), { maxZoom: 19, padding: [40, 40] });
      }
    }
    $('kadaster-status').textContent = vorm
      ? `Gevonden: ${kadasterPunt.naam}. De gestippelde omtrek komt uit het Kadaster; de app gebruikt die automatisch.`
      : `Adres gevonden (${kadasterPunt.naam}), maar geen gebouw in het Kadaster. Teken de omtrek zelf.`;
  } catch (fout) {
    console.warn(fout);
    $('kadaster-status').textContent = 'Niet gevonden. Controleer straat en huisnummer, of de internetverbinding.';
  }
}

// ---------- Alle adressen in één keer ----------
// Alleen plekken zonder positie, waarvan het gebouw een adres met huisnummer heeft. Bestaande posities blijven staan.
// Eén verzoek tegelijk, met een korte pauze: netjes tegenover PDOK.

async function zoekAlleAdressen() {
  const knop = $('zoek-alle');
  const status = $('zoek-alle-status');
  const perGebouw = new Map();
  for (const loc of data.locaties) {
    const g = gebouwVan(loc.gebouw);
    if (loc.positie || !g?.adres || !/\d/.test(g.adres)) continue;
    if (!perGebouw.has(g.id)) perGebouw.set(g.id, { g, plekken: [] });
    perGebouw.get(g.id).plekken.push(loc);
  }
  if (!perGebouw.size) {
    status.textContent = 'Er zijn geen plekken zonder positie met een adres met huisnummer.';
    return;
  }
  knop.disabled = true;
  const gevonden = [];
  const nietGevonden = [];
  const zonderPand = [];
  let i = 0;
  for (const { g, plekken } of perGebouw.values()) {
    i += 1;
    status.textContent = `Bezig: ${i} van ${perGebouw.size} adressen (${g.adres})…`;
    try {
      const punt = await zoekAdres(g.adres);
      for (const loc of plekken) loc.positie = { lat: rond(punt.lat), lng: rond(punt.lng), bevestigd: false };
      gevonden.push(...plekken.map((l) => l.nummer));
      try {
        if (!(await zoekPand(punt.lat, punt.lng))) zonderPand.push(`${g.naam} (${g.adres})`);
      } catch { /* de omtrek is alleen een extra controle */ }
    } catch (fout) {
      console.warn(fout);
      nietGevonden.push(`${g.naam} (${g.adres})`);
    }
    await new Promise((klaar) => { setTimeout(klaar, 200); });
  }
  knop.disabled = false;
  const delen = [`✓ ${gevonden.length} plekken hebben nu de positie van hun adres.`];
  if (nietGevonden.length) delen.push(`Niet gevonden: ${nietGevonden.join('; ')}. Controleer het adres, of zet de positie zelf.`);
  if (zonderPand.length) delen.push(`Adres gevonden, maar geen gebouw in het Kadaster: ${zonderPand.join('; ')}. Teken daar de omtrek zelf.`);
  delen.push('Controleer de posities op de luchtfoto voordat je ze voorstelt.');
  status.textContent = delen.join(' ');
  vulPlekken();
  toonPositie();
  toonAnderen();
  gewijzigd();
}

// ---------- Omtrek tekenen ----------

function startTekenen() {
  const g = gebouwVan(plek.gebouw);
  if (!g) return;
  tekenen = true;
  g.vorm = Array.isArray(g.vorm) ? g.vorm : [];
  $('teken').setAttribute('aria-pressed', 'true');
  $('teken').textContent = 'Klaar met tekenen';
  $('teken-terug').disabled = !g.vorm.length;
  $('modus-hint').textContent = 'Tekenen: tik de hoeken van het gebouw één voor één aan. Minimaal drie punten.';
  kaart.getContainer().classList.add('beheerkaart--tekenen');
}

function stopTekenen() {
  tekenen = false;
  $('teken').setAttribute('aria-pressed', 'false');
  $('teken').textContent = 'Omtrek tekenen';
  $('teken-terug').disabled = true;
  $('modus-hint').textContent = 'Tik op de kaart of versleep de rode speld naar het kijkpunt: de plek op de stoep of het plein waar je ziet waar de vraag over gaat. Zie coordinaten-LEESMIJ.md.';
  kaart?.getContainer().classList.remove('beheerkaart--tekenen');
  const g = plek && gebouwVan(plek.gebouw);
  if (g && Array.isArray(g.vorm) && g.vorm.length < 3) {
    delete g.vorm; // onaf: geen halve omtrek bewaren
    toonGebouw();
    gewijzigd();
  }
}

function voegPuntToe({ lat, lng }) {
  const g = gebouwVan(plek.gebouw);
  g.vorm.push([rond(lat), rond(lng)]);
  $('teken-terug').disabled = false;
  $('teken-wis').disabled = false;
  tekenOmtrek(g);
  gewijzigd();
}

// ---------- Foto's ----------

function toonFotos() {
  const lijst = $('fotolijst');
  lijst.replaceChildren();
  // Alleen lezen; plek.fotos wordt pas aangemaakt als er echt een foto gekozen wordt.
  const ids = Array.isArray(plek.fotos) ? plek.fotos : [];
  const alle = $('alle-fotos').checked;
  const gekozen = ids.map((id) => fotoLijst.find((f) => f.id === id)).filter(Boolean);
  const overig = fotoLijst.filter((f) => !ids.includes(f.id) && (alle || (f.locaties ?? []).includes(plek.nummer)));

  if (!gekozen.length && !overig.length) {
    lijst.append(maak('li', 'hint', 'Er staan nog geen foto\'s voor deze plek in content/fotos.json.'));
  }
  for (const f of [...gekozen, ...overig]) {
    const index = ids.indexOf(f.id);
    const li = maak('li', index >= 0 ? 'foto-item foto-item--gekozen' : 'foto-item');
    const label = maak('label', 'vink');
    const vak = maak('input');
    vak.type = 'checkbox';
    vak.checked = index >= 0;
    vak.addEventListener('change', () => {
      if (vak.checked) (plek.fotos ??= []).push(f.id);
      else plek.fotos = ids.filter((id) => id !== f.id);
      if (!plek.fotos.length) delete plek.fotos;
      toonFotos();
      gewijzigd();
    });
    label.append(vak, ` ${f.bron ?? 'Onbekende bron'} ${f.documentnummer ?? ''}`.trimEnd());
    if (index === 0) label.append(maak('strong', 'label-hoofd', ' · hoofdfoto'));
    li.append(label);

    const status = [];
    if (!f.bestand) status.push('bestand ontbreekt nog');
    if (f.rechten_geregeld !== true) status.push('rechten nog regelen');
    if (!f.alt?.nl) status.push('beschrijving (alt) ontbreekt');
    li.append(maak('span', 'foto-item__status', status.length ? status.join(' · ') : '✓ klaar voor de app'));
    // Op je eigen computer (localhost) ook een voorbeeld uit 'fotos-lokaal/' (zie fotos-lokaal-LEESMIJ.md).
    const echt = f.rechten_geregeld === true || !LOKAAL;
    const naam = echt ? f.bestand : (f.bestand || f.bestand_klaar);
    if (geldigBestand(naam)) {
      const img = maak('img', 'foto-item__duim');
      img.src = echt ? `fotos/${naam}` : `fotos-lokaal/${naam}`;
      img.addEventListener('error', () => img.remove(), { once: true });
      img.alt = '';
      img.loading = 'lazy';
      li.prepend(img);
    }
    if (index >= 0 && ids.length > 1) {
      const rij = maak('span', 'knoppenrij');
      for (const [tekst, stap, label2] of [['↑', -1, 'Hoger'], ['↓', 1, 'Lager']]) {
        const knop = maak('button', 'knop-mini', tekst);
        knop.type = 'button';
        knop.setAttribute('aria-label', `${label2}: ${f.documentnummer ?? f.id}`);
        knop.disabled = index + stap < 0 || index + stap >= ids.length;
        knop.addEventListener('click', () => {
          [plek.fotos[index], plek.fotos[index + stap]] = [plek.fotos[index + stap], plek.fotos[index]];
          toonFotos();
          gewijzigd();
        });
        rij.append(knop);
      }
      li.append(rij);
    }
    lijst.append(li);
  }
  plekStatus();
}

// ---------- Controle en overzicht ----------

function controleer(d = data) {
  const fouten = [];
  for (const loc of d.locaties ?? []) {
    // Een concept staat niet in de app: verhaal, vraag en positie mogen nog ontbreken (maar een positie moet wel kloppen).
    const alle = controleerLocatie(loc, 'nl');
    const f = loc.concept
      ? alle.filter((fout) => /id|nummer|titel/.test(fout) || (loc.positie && fout.startsWith('positie')))
      : alle;
    if (f.length) fouten.push(`${loc.nummer} ${loc.titel?.nl ?? loc.id}: ${f.join(', ')}`);
    if (loc.gebouw && !gebouwVan(loc.gebouw, d)) fouten.push(`${loc.nummer}: gebouw "${loc.gebouw}" bestaat niet`);
  }
  // Adres of omtrek is pas nodig als het gebouw bij een plek hoort die in de app staat.
  const inApp = new Set((d.locaties ?? []).filter((l) => !l.concept).map((l) => l.gebouw));
  for (const g of d.gebouwen ?? []) {
    if (!g.naam) fouten.push(`Gebouw ${g.id}: naam ontbreekt`);
    const heeftVorm = Array.isArray(g.vorm) && g.vorm.length >= 3;
    if (inApp.has(g.id) && !heeftVorm && !(g.adres && /\d/.test(g.adres))) fouten.push(`Gebouw ${g.naam || g.id}: adres met huisnummer of eigen omtrek nodig`);
  }
  return fouten;
}

function toonWijzigingen(lijst, wijzigingen, leeg) {
  lijst.replaceChildren();
  if (!wijzigingen.length) { lijst.append(maak('li', 'hint', leeg)); return; }
  for (const w of wijzigingen) {
    const li = maak('li');
    li.append(maak('strong', '', w.naam));
    const ul = maak('ul');
    for (const regel of w.regels) ul.append(maak('li', '', regel));
    if (w.punt && w.id) {
      const a = maak('a', '', 'Bekijk de nieuwe positie op de luchtfoto');
      a.href = luchtfotoLink(w.id, w.punt).replace(LIVE_EDITOR, new URL('beheer.html', location.href).href);
      const r = maak('li');
      r.append(a);
      ul.append(r);
    }
    li.append(ul);
    lijst.append(li);
  }
}

function heeftWijziging() {
  const tekst = alsTekst(data);
  return voorstel ? tekst !== voorstel.tekst : tekst !== origineel;
}

function werkUitvoerBij() {
  const tekst = alsTekst(data);
  $('uitvoer').value = tekst;
  const wijzigingen = beschrijf(JSON.parse(origineel), data, fotoNaam);
  toonWijzigingen($('wijzigingen'), wijzigingen, 'Nog niets gewijzigd.');

  const fouten = controleer();
  $('controle').replaceChildren(...(fouten.length
    ? fouten.map((f) => maak('li', 'controle__fout', `✗ ${f}`))
    : [maak('li', 'controle__goed', '✓ Alles in orde.')]));

  const anders = heeftWijziging();
  $('voorstellen').textContent = voorstel ? 'Aanpassing versturen' : 'Wijziging voorstellen';
  $('voorstellen').disabled = bezig || !anders || !!fouten.length;
  $('download').disabled = !!fouten.length || tekst === origineel;
  if (!bezig && !$('opslaan-status').dataset.vast) {
    $('opslaan-status').textContent = !anders ? ''
      : fouten.length ? 'Los eerst de punten onder Controle op.'
        : gebruiker ? '' : 'Log eerst in (bovenaan de pagina) om je wijziging voor te stellen.';
  }

  $('aanpassen-melding').hidden = !voorstel;
  if (voorstel) $('aanpassen-tekst').textContent = `Je past je voorstel "${voorstel.titel}" aan. Klik onderaan op "Aanpassing versturen" als je klaar bent.`;

  const balk = $('verstuurbalk');
  balk.hidden = !anders || versturenInBeeld;
  $('verstuurbalk-tekst').textContent = wijzigingen.length === 1 ? 'Je hebt 1 onderdeel gewijzigd' : `Je hebt ${wijzigingen.length} onderdelen gewijzigd`;
}

function download() {
  const blob = new Blob([$('uitvoer').value], { type: 'application/json' });
  const link = maak('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'locaties.json';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

// ---------- Inloggen ----------

function toonAccount() {
  $('blok-inloggen').hidden = !!gebruiker;
  $('blok-voorstellen').hidden = !gebruiker;
  if (gebruiker) $('ingelogd-als').textContent = `Ingelogd als ${gebruiker.naam}`;
}

async function inloggen() {
  const tekst = $('sleutel').value.trim();
  const probleem = gh.controleerSleutel(tekst);
  if (probleem) { $('inlog-status').textContent = probleem; return; }
  $('inloggen').disabled = true;
  $('inlog-status').textContent = 'Bezig met controleren…';
  gh.zetSleutel(tekst, $('onthouden').checked);
  try {
    gebruiker = await gh.wieBenIk();
  } catch (fout) {
    gh.wisSleutel();
    $('inlog-status').textContent = gewoneTaalInlog(fout);
    return;
  } finally {
    $('inloggen').disabled = false;
  }
  $('sleutel').value = '';
  $('inlog-status').textContent = '';
  toonAccount();
  // Werk bijwerken naar de nieuwste versie op GitHub (de website kan een paar minuten achterlopen).
  try {
    const { locaties } = await haalNieuwste();
    const id = plek?.id;
    zetOpNieuwste(locaties);
    herteken(id);
  } catch { /* dan blijft het zoals het is */ }
  werkUitvoerBij();
  verversLijsten();
}

function gewoneTaalInlog(fout) {
  if (fout instanceof gh.GitHubFout && fout.status === 401) return 'Deze sleutel wordt niet herkend. Controleer of je hem helemaal hebt gekopieerd, of maak een nieuwe.';
  if (fout instanceof gh.GitHubFout && fout.status === 403) return 'Je sleutel werkt, maar je mag nog geen voorstellen doen. Vraag een beheerder om je in het team van contentbeheerders te zetten.';
  return gh.gewoneTaal(fout);
}

function uitloggen() {
  gh.wisSleutel();
  gebruiker = null;
  toonAccount();
  werkUitvoerBij();
  $('sleutel').focus();
}

// ---------- Versturen ----------

function toonBotsingen(botsingen, basis, mijn, hun) {
  const vak = $('botsing-keuzes');
  vak.replaceChildren();
  const mijnW = beschrijf(basis, mijn, fotoNaam);
  const hunW = beschrijf(basis, hun, fotoNaam);
  for (const b of botsingen) {
    const groep = maak('fieldset', 'botsing__groep');
    groep.append(maak('legend', '', b.naam));
    for (const [waarde, label, lijst] of [['mijn', 'Mijn versie', mijnW], ['hun', 'Versie van de ander', hunW]]) {
      const regels = lijst.find((w) => w.sleutel === b.sleutel)?.regels ?? ['verwijderd'];
      const optie = maak('label', 'vink vink--boven');
      const rondje = maak('input');
      rondje.type = 'radio';
      rondje.name = `botsing-${b.sleutel}`;
      rondje.value = waarde;
      rondje.checked = keuzes[b.sleutel] === waarde;
      rondje.addEventListener('change', () => { keuzes[b.sleutel] = waarde; });
      const uitleg = maak('span');
      uitleg.append(maak('strong', '', label), maak('span', 'hint', `: ${regels.join('; ')}`));
      optie.append(rondje, uitleg);
      groep.append(optie);
    }
    vak.append(groep);
  }
  $('botsing').hidden = false;
}

function zetStatus(tekst, vast = false) {
  $('opslaan-status').textContent = tekst;
  if (vast) $('opslaan-status').dataset.vast = '1';
  else delete $('opslaan-status').dataset.vast;
}

async function verstuur() {
  if (!gebruiker) {
    zetStatus('Log eerst in om je wijziging voor te stellen.');
    $('blok-inloggen').scrollIntoView({ block: 'start' });
    $('sleutel').focus();
    return;
  }
  if (controleer().length || bezig) return;
  bezig = true;
  werkUitvoerBij();
  zetStatus('Bezig met versturen…', true);
  let nieuweTak = null;
  try {
    const mainKop = await gh.takSha(gh.HOOFDTAK);
    const hunTekst = await gh.leesBestand(PAD, mainKop);
    const hun = JSON.parse(hunTekst);
    const basis = JSON.parse(origineel);
    const { resultaat, botsingen } = voegSamen(basis, data, hun, keuzes);
    if (botsingen.length) {
      toonBotsingen(botsingen, basis, data, hun);
      zetStatus('Iemand anders heeft intussen hetzelfde aangepast. Kies hierboven welke versie blijft en klik dan opnieuw.', true);
      $('botsing').scrollIntoView({ block: 'start' });
      return;
    }
    $('botsing').hidden = true;
    const wijzigingen = beschrijf(hun, resultaat, fotoNaam);
    if (!wijzigingen.length && !voorstel) {
      zetStatus('Je wijzigingen staan al in de app. Er hoeft niets verstuurd te worden.', true);
      wisConcept();
      origineel = alsTekst(hun);
      data = JSON.parse(origineel);
      herteken(plek?.id);
      return;
    }
    const fouten = controleer(resultaat);
    if (fouten.length) {
      zetStatus(`Samen met de nieuwste versie klopt er iets niet: ${fouten[0]}. Vraag een beheerder om hulp.`, true);
      return;
    }
    const tekst = alsTekst(resultaat);
    const titel = titelVoor(wijzigingen);
    const beschrijving = omschrijving({ wijzigingen, toelichting: $('toelichting').value, naam: gebruiker.naam, login: gebruiker.login, luchtfotoLink });
    const bericht = `${titel}\n\nVoorgesteld door ${gebruiker.naam} met de editor.`;

    if (voorstel) {
      // Eigen voorstel aanpassen. Loopt main intussen voor, dan nemen we die mee (samenvoeg-commit),
      // zodat de beheerder geen botsing te zien krijgt.
      const [takKop, verschil] = await Promise.all([gh.takSha(voorstel.tak), gh.vergelijk(voorstel.tak)]);
      const meeMetMain = verschil.achter > 0;
      const commit = await gh.maakCommit({
        ouders: meeMetMain ? [takKop, mainKop] : [takKop],
        boomVanCommit: meeMetMain ? mainKop : takKop,
        bestanden: [{ pad: PAD, tekst }],
        bericht: `${bericht}\n\n(aangepaste versie)`,
      });
      await gh.verplaatsTak(voorstel.tak, commit);
      await gh.werkVoorstelBij(voorstel.nummer, { titel, tekst: beschrijving });
      zetStatus(`✓ Je aanpassing is verstuurd. Een collega kijkt er opnieuw naar ("Wacht op collega").`, true);
    } else {
      const commit = await gh.maakCommit({ ouders: [mainKop], boomVanCommit: mainKop, bestanden: [{ pad: PAD, tekst }], bericht });
      nieuweTak = takNaam(wijzigingen);
      try {
        await gh.maakTak(nieuweTak, commit);
      } catch (fout) {
        if (!(fout instanceof gh.GitHubFout && fout.status === 422)) throw fout;
        nieuweTak = `${nieuweTak}-${Math.floor(Math.random() * 1000)}`;
        await gh.maakTak(nieuweTak, commit);
      }
      await gh.openVoorstel({ titel, tekst: beschrijving, tak: nieuweTak });
      nieuweTak = null;
      zetStatus('✓ Je voorstel is verstuurd. Het staat nu bij "Mijn voorstellen" als "Wacht op collega". Hieronder zie je weer de huidige versie van de app.', true);
    }

    // Opnieuw beginnen vanaf de huidige versie van de app.
    wisConcept();
    voorstel = null;
    keuzes = {};
    $('toelichting').value = '';
    origineel = alsTekst(hun);
    data = JSON.parse(origineel);
    data.gebouwen ??= [];
    herteken(plek?.id);
    verversLijsten();
  } catch (fout) {
    console.warn(fout);
    if (nieuweTak) gh.verwijderTak(nieuweTak).catch(() => {}); // geen losse tak achterlaten
    zetStatus(gh.gewoneTaal(fout), true);
  } finally {
    bezig = false;
    werkUitvoerBij();
  }
}

/** Scherm opnieuw opbouwen na het wisselen van inhoud; blijf bij dezelfde plek als die er nog is. */
function herteken(plekId) {
  vulPlekken();
  const id = data.locaties.some((l) => l.id === plekId) ? plekId : $('plek').value;
  $('plek').value = id;
  kiesPlek(id);
  werkUitvoerBij();
}

// ---------- Voorstellen: overzicht, aanpassen, beoordelen ----------

const DATUM = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const ICOON = { wacht: '◷', opmerking: '!', beheerder: '→', live: '✓', gesloten: '–' };
let laatstVerversd = 0;

function toestandLabel(t, vanMij) {
  const tekst = t.code === 'opmerking' && vanMij ? 'Opmerking: terug bij jou' : t.label;
  const span = maak('span', `toestand toestand--${t.code}`);
  span.append(maak('span', 'toestand__icoon', ICOON[t.code] ?? ''), ` ${tekst}`);
  return span;
}

function datum(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : DATUM.format(d);
}

async function verversLijsten() {
  if (!gebruiker) return;
  laatstVerversd = Date.now();
  $('lijst-status').textContent = 'Bezig met ophalen…';
  try {
    const alle = await gh.voorstellen();
    const mijn = alle.filter((v) => v.auteur === gebruiker.login);
    const getoond = [...mijn.filter((v) => v.open), ...mijn.filter((v) => !v.open).slice(0, 5)];
    const collegas = alle.filter((v) => v.open && v.auteur !== gebruiker.login);
    const metOordeel = async (v) => {
      const oordelen = v.open ? await gh.beoordelingen(v.nummer) : [];
      return { ...v, t: toestand(v, oordelen), oordelen };
    };
    const [m, c] = await Promise.all([Promise.all(getoond.map(metOordeel)), Promise.all(collegas.map(metOordeel))]);
    toonMijn(m);
    toonCollegas(c);
    $('lijst-status').textContent = '';
  } catch (fout) {
    console.warn(fout);
    $('lijst-status').textContent = gh.gewoneTaal(fout);
  }
}

function toonMijn(lijst) {
  const ul = $('lijst-mijn');
  ul.replaceChildren();
  if (!lijst.length) { ul.append(maak('li', 'hint', 'Je hebt nog geen voorstellen gedaan.')); return; }
  for (const v of lijst) {
    const li = maak('li', `voorstel voorstel--${v.t.code}`);
    const kop = maak('p', 'voorstel__kop');
    kop.append(maak('strong', '', v.titel), ' ', toestandLabel(v.t, true));
    li.append(kop, maak('p', 'hint', `Bijgewerkt ${datum(v.bijgewerkt)}`));
    if (v.t.code === 'opmerking') {
      const citaat = maak('blockquote', 'opmerking');
      citaat.append(maak('strong', '', `Opmerking van ${v.t.door}: `), v.t.opmerking || '(geen tekst)');
      li.append(citaat);
    }
    if (v.t.code === 'live') li.append(maak('p', 'hint', 'Binnen enkele minuten na samenvoegen zichtbaar in de app.'));
    if (v.open) {
      const rij = maak('div', 'knoppenrij');
      const aanpassen = maak('button', 'knop-klein', voorstel?.nummer === v.nummer ? 'Je past dit nu aan' : 'Aanpassen');
      aanpassen.type = 'button';
      aanpassen.disabled = voorstel?.nummer === v.nummer;
      aanpassen.addEventListener('click', () => pasAan(v));
      const intrekken = maak('button', 'knop-klein', 'Intrekken');
      intrekken.type = 'button';
      intrekken.addEventListener('click', () => trekIn(v));
      rij.append(aanpassen, intrekken);
      li.append(rij);
    }
    ul.append(li);
  }
}

function toonCollegas(lijst) {
  const ul = $('lijst-collegas');
  ul.replaceChildren();
  const teDoen = lijst.filter((v) => !mijnOordeel(v)).length;
  $('kop-collegas').textContent = teDoen ? `Voorstellen van collega's (${teDoen} wacht${teDoen === 1 ? '' : 'en'} op jou)` : 'Voorstellen van collega\'s';
  if (!lijst.length) { ul.append(maak('li', 'hint', 'Er wachten geen voorstellen van collega\'s.')); return; }
  for (const v of lijst) {
    const li = maak('li', `voorstel voorstel--${v.t.code}`);
    const kop = maak('p', 'voorstel__kop');
    kop.append(maak('strong', '', v.titel), ' ', toestandLabel(v.t, false));
    li.append(kop, maak('p', 'hint', `Van ${v.auteur} · bijgewerkt ${datum(v.bijgewerkt)}`));
    const eigen = mijnOordeel(v);
    if (eigen) li.append(maak('p', 'hint', eigen.oordeel === 'APPROVED' ? '✓ Jij gaf Akkoord op deze versie.' : '! Jij maakte een opmerking bij deze versie.'));

    const details = maak('div', 'voorstel__details');
    details.hidden = true;
    const bekijk = maak('button', 'knop-klein', 'Bekijken');
    bekijk.type = 'button';
    bekijk.setAttribute('aria-expanded', 'false');
    bekijk.addEventListener('click', async () => {
      const open = details.hidden;
      details.hidden = !open;
      bekijk.setAttribute('aria-expanded', String(open));
      bekijk.textContent = open ? 'Verbergen' : 'Bekijken';
      if (open && !details.childElementCount) await toonVoorstelDetails(v, details);
    });
    const rij = maak('div', 'knoppenrij');
    rij.append(bekijk);
    li.append(rij, details);
    ul.append(li);
  }
}

function mijnOordeel(v) {
  return v.oordelen.filter((r) => r.door === gebruiker.login && r.commit === v.kop && ['APPROVED', 'CHANGES_REQUESTED'].includes(r.oordeel)).at(-1);
}

async function toonVoorstelDetails(v, vak) {
  vak.append(maak('p', 'hint', 'Bezig met ophalen…'));
  try {
    const { basis } = await gh.vergelijk(v.tak);
    const [oud, nieuw] = await Promise.all([gh.leesBestand(PAD, basis), gh.leesBestand(PAD, v.kop)]);
    vak.replaceChildren();
    const lijst = maak('ul', 'wijzigingen');
    toonWijzigingen(lijst, beschrijf(JSON.parse(oud), JSON.parse(nieuw), fotoNaam), 'Geen wijzigingen in de inhoud gevonden.');
    vak.append(maak('h4', '', 'Wat verandert er'), lijst);
  } catch (fout) {
    console.warn(fout);
    vak.replaceChildren(maak('p', 'status', gh.gewoneTaal(fout)));
    return;
  }

  // Beoordelen: Akkoord, of Opmerking met uitleg.
  const veld = maak('label', 'veld veld--breed');
  const opmerking = maak('textarea');
  opmerking.rows = 3;
  opmerking.maxLength = 1500;
  veld.append(maak('span', '', 'Opmerking (alleen nodig bij "Opmerking")'), opmerking);
  const rij = maak('div', 'knoppenrij');
  const akkoord = maak('button', 'knop', '✓ Akkoord');
  akkoord.type = 'button';
  const nietAkkoord = maak('button', 'knop-klein', '! Opmerking');
  nietAkkoord.type = 'button';
  const status = maak('p', 'status');
  status.setAttribute('role', 'status');
  rij.append(akkoord, nietAkkoord);
  vak.append(maak('p', 'hint', 'Klopt het historisch, staat de positie op het goede gebouw of object en passen de foto\'s? Kijk zo nodig op de luchtfoto.'), veld, rij, status);

  const stuur = async (isAkkoord) => {
    const tekst = opmerking.value.trim();
    if (!isAkkoord && tekst.length < 5) {
      status.textContent = 'Schrijf kort wat er beter kan, zodat je collega weet wat te doen.';
      opmerking.focus();
      return;
    }
    akkoord.disabled = true;
    nietAkkoord.disabled = true;
    status.textContent = 'Bezig met versturen…';
    try {
      await gh.beoordeel(v.nummer, v.kop, isAkkoord, isAkkoord ? (tekst || 'Akkoord, via de editor.') : tekst);
      status.textContent = isAkkoord ? '✓ Akkoord verstuurd. Het voorstel gaat nu naar een beheerder.' : '✓ Opmerking verstuurd. Je collega ziet hem in de editor.';
      setTimeout(verversLijsten, 1500);
    } catch (fout) {
      console.warn(fout);
      status.textContent = fout instanceof gh.GitHubFout && fout.status === 422
        ? 'Dit voorstel is intussen aangepast. Ververs de lijst en bekijk het opnieuw.'
        : gh.gewoneTaal(fout);
      akkoord.disabled = false;
      nietAkkoord.disabled = false;
    }
  };
  akkoord.addEventListener('click', () => stuur(true));
  nietAkkoord.addEventListener('click', () => stuur(false));
}

async function pasAan(v) {
  if (heeftWijziging() && !window.confirm('Je huidige, nog niet verstuurde wijzigingen vervallen. Doorgaan?')) return;
  $('lijst-status').textContent = 'Bezig met openen…';
  try {
    const { basis } = await gh.vergelijk(v.tak);
    const [oud, nieuw] = await Promise.all([gh.leesBestand(PAD, basis), gh.leesBestand(PAD, v.kop)]);
    origineel = alsTekst(JSON.parse(oud));
    data = JSON.parse(nieuw);
    data.gebouwen ??= [];
    voorstel = { nummer: v.nummer, tak: v.tak, titel: v.titel, tekst: alsTekst(data) };
    keuzes = {};
    $('botsing').hidden = true;
    zetStatus('');
    const eerste = beschrijf(JSON.parse(origineel), data).find((w) => w.id);
    herteken(eerste?.id ?? plek?.id);
    bewaarConcept();
    $('lijst-status').textContent = '';
    verversLijsten();
    $('aanpassen-melding').scrollIntoView({ block: 'start' });
  } catch (fout) {
    console.warn(fout);
    $('lijst-status').textContent = gh.gewoneTaal(fout);
  }
}

async function trekIn(v) {
  if (!window.confirm(`Voorstel "${v.titel}" intrekken? Het gaat dan niet door.`)) return;
  $('lijst-status').textContent = 'Bezig met intrekken…';
  try {
    await gh.sluitVoorstel(v.nummer);
    await gh.verwijderTak(v.tak).catch(() => {});
    if (voorstel?.nummer === v.nummer) stopAanpassen(true);
    verversLijsten();
  } catch (fout) {
    console.warn(fout);
    $('lijst-status').textContent = gh.gewoneTaal(fout);
  }
}

function stopAanpassen(zonderVragen = false) {
  if (!zonderVragen && heeftWijziging() && !window.confirm('Je aanpassingen aan dit voorstel zijn nog niet verstuurd en vervallen. Stoppen?')) return;
  wisConcept();
  location.reload();
}

// ---------- Opstarten ----------

let versturenInBeeld = false;

function koppel() {
  $('plek').addEventListener('change', (e) => kiesPlek(e.target.value));
  $('kopieer-link').addEventListener('click', kopieerLink);
  window.addEventListener('hashchange', volgLink);
  $('positie-ok').addEventListener('change', (e) => { if (!plek.positie) return; plek.positie.bevestigd = e.target.checked; plekStatus(); gewijzigd(); });
  $('zoek-alle').addEventListener('click', zoekAlleAdressen);

  $('gebouw').addEventListener('change', (e) => {
    stopTekenen();
    if (e.target.value === '__nieuw') {
      const g = { id: nieuwGebouwId(), naam: plek.titel?.nl?.slice(0, 80) ?? 'Nieuw gebouw', adres: '' };
      data.gebouwen.push(g);
      plek.gebouw = g.id;
      vulGebouwKeuze();
    } else if (e.target.value) {
      plek.gebouw = e.target.value;
    } else {
      delete plek.gebouw;
    }
    toonGebouw();
    gewijzigd();
  });
  $('gebouw-naam').addEventListener('input', (e) => { gebouwVan(plek.gebouw).naam = e.target.value.trim(); gewijzigd(); });
  $('gebouw-naam').addEventListener('change', vulGebouwKeuze);
  $('gebouw-adres').addEventListener('input', (e) => {
    const g = gebouwVan(plek.gebouw);
    g.adres = e.target.value.trim();
    if (!g.adres) delete g.adres;
    $('adres-naar-positie').disabled = true;
    gewijzigd();
  });
  $('gebouw-adres').addEventListener('change', vulGebouwKeuze);
  $('zoek-adres').addEventListener('click', zoekInKadaster);
  $('adres-naar-positie').addEventListener('click', () => { if (kadasterPunt) zetPositie(kadasterPunt); });

  $('teken').addEventListener('click', () => (tekenen ? stopTekenen() : startTekenen()));
  $('teken-terug').addEventListener('click', () => {
    const g = gebouwVan(plek.gebouw);
    g.vorm.pop();
    $('teken-terug').disabled = !g.vorm.length;
    tekenOmtrek(g);
    gewijzigd();
  });
  $('teken-wis').addEventListener('click', () => {
    const g = gebouwVan(plek.gebouw);
    delete g.vorm;
    stopTekenen();
    toonGebouw();
    gewijzigd();
  });

  $('alle-fotos').addEventListener('change', toonFotos);
  $('download').addEventListener('click', download);
  $('voorstellen').addEventListener('click', verstuur);
  $('herstel').addEventListener('click', () => {
    // Weggooien kan niet ongedaan worden gemaakt: eerst vragen.
    if (heeftWijziging() && !window.confirm('Al je wijzigingen op deze pagina weggooien? Dit kun je niet ongedaan maken.')) return;
    wisConcept();
    location.reload();
  });
  $('stop-aanpassen').addEventListener('click', () => stopAanpassen());

  $('sleutel-link').href = gh.sleutelLink();
  $('inloggen').addEventListener('click', inloggen);
  $('sleutel').addEventListener('keydown', (e) => { if (e.key === 'Enter') inloggen(); });
  $('uitloggen').addEventListener('click', uitloggen);
  $('ververs').addEventListener('click', verversLijsten);
  // Terug naar de editor (bijv. na een mail van GitHub): lijst bijwerken, hooguit één keer per minuut.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && Date.now() - laatstVerversd > 60000) verversLijsten();
  });

  $('naar-versturen').addEventListener('click', () => {
    $('blok-versturen').scrollIntoView({ block: 'start' });
    $('blok-versturen').focus({ preventScroll: true });
  });
  new IntersectionObserver(([e]) => {
    versturenInBeeld = e.isIntersecting;
    $('verstuurbalk').hidden = versturenInBeeld || !heeftWijziging();
  }).observe($('blok-versturen'));

  window.addEventListener('beforeunload', (e) => {
    if (data && heeftWijziging()) e.preventDefault(); // het concept staat ook in de browser bewaard
  });
}

async function start() {
  if (gh.leesBewaardeSleutel()) {
    try {
      gebruiker = await gh.wieBenIk();
    } catch (fout) {
      console.warn(fout);
      if (fout instanceof gh.GitHubFout && [401, 403, 404].includes(fout.status)) gh.wisSleutel();
      meld(gh.gewoneTaal(fout));
    }
  }
  toonAccount();
  try {
    await laad();
  } catch (fout) {
    console.error(fout);
    meld('De inhoud kon niet worden geladen. Controleer de internetverbinding.');
    return;
  }
  if (!window.L) {
    meld('De kaart kon niet worden geladen. Ververs de pagina.');
    return;
  }
  maakKaart();
  koppel();
  vulPlekken();
  if (!volgLink()) kiesPlek($('plek').value);
  werkUitvoerBij();
  verversLijsten();
}

start();
