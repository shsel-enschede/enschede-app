// Beheerpagina: positie, gebouw en foto's per plek kiezen en een nieuw content/locaties.json maken.
// Deze pagina schrijft niets naar de website; de vrijwilliger plaatst het bestand zelf op GitHub.
// Alle teksten uit de inhoud gaan via textContent op het scherm, nooit via innerHTML (zie CLAUDE.md).

import { controleerLocatie, geldigBestand, LOKAAL } from './inhoud.js';
import { maak } from './hulp.js';
import { zoekAdres, zoekPand } from './gebouwen.js';

const CONCEPT_SLEUTEL = 'enschede-app:beheer-concept:v1';
const TEGELS = {
  kaart: 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png',
  luchtfoto: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg',
};
const ID_PATROON = /^[a-z0-9-]{1,60}$/;
const $ = (id) => document.getElementById(id);

let origineel = '';      // de tekst van locaties.json zoals hij op de website staat
let data = null;         // de inhoud waaraan we werken
let fotoLijst = [];      // uit content/fotos.json
let plek = null;         // de gekozen locatie (object binnen data.locaties)
let tekenen = false;
let kadasterPunt = null; // laatst opgezochte adrespunt

let kaart;
let lagen;
let speld;
const overlay = { anderen: null, gebouw: null, tekening: null, linkpunt: null };

// Grenzen van de kaart (zie maakKaart). Een link met een punt daarbuiten wordt genegeerd.
const GRENS = { latMin: 52.15, latMax: 52.3, lngMin: 6.75, lngMax: 7.0 };

// ---------- Hulpjes ----------

function rond(x) { return Math.round(x * 1e6) / 1e6; } // ~10 cm, ruim voldoende

function meld(tekst) {
  $('melding').textContent = tekst;
  $('melding').hidden = !tekst;
}

function gebouwVan(id) { return (data.gebouwen ?? []).find((g) => g.id === id) ?? null; }

function alsTekst(d) {
  // Coördinaatparen op één regel houden, dan blijft het bestand leesbaar voor vrijwilligers.
  return `${JSON.stringify(d, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]')}\n`;
}

let bewaarTimer;
function gewijzigd() {
  clearTimeout(bewaarTimer);
  bewaarTimer = setTimeout(() => {
    const tekst = alsTekst(data);
    try {
      if (tekst === origineel) localStorage.removeItem(CONCEPT_SLEUTEL);
      else localStorage.setItem(CONCEPT_SLEUTEL, JSON.stringify({ origineel, tekst }));
    } catch { /* geen opslag: werk alleen in deze sessie */ }
    werkUitvoerBij();
  }, 300);
}

// ---------- Laden ----------

async function laad() {
  const [l, f] = await Promise.all([
    fetch('content/locaties.json', { cache: 'no-cache' }),
    fetch('content/fotos.json', { cache: 'no-cache' }),
  ]);
  if (!l.ok) throw new Error('content/locaties.json niet gevonden');
  origineel = alsTekst(await l.json());
  fotoLijst = f.ok ? ((await f.json()).fotos ?? []).filter((x) => ID_PATROON.test(x?.id ?? '')) : [];

  let tekst = origineel;
  try {
    const concept = JSON.parse(localStorage.getItem(CONCEPT_SLEUTEL));
    if (concept?.tekst) {
      tekst = concept.tekst;
      meld(concept.origineel === origineel
        ? 'Je eerdere, nog niet geplaatste werk is teruggezet. Wil je opnieuw beginnen? Kies onderaan "Wijzigingen weggooien".'
        : 'Let op: je eerdere werk is teruggezet, maar het bestand op de website is intussen veranderd. Controleer of je geen wijzigingen van iemand anders overschrijft, of kies "Wijzigingen weggooien".');
    }
  } catch { /* geen of beschadigd concept */ }
  data = JSON.parse(tekst);
  data.gebouwen ??= [];
}

// ---------- Plek kiezen ----------

function vulPlekken() {
  const keuze = $('plek');
  keuze.replaceChildren();
  const lijst = [...data.locaties].sort((a, b) => (a.nummer ?? 0) - (b.nummer ?? 0));
  for (const loc of lijst) {
    const optie = maak('option', '', `${loc.nummer} · ${loc.titel?.nl ?? loc.id}`);
    optie.value = loc.id;
    keuze.append(optie);
  }
}

function kiesPlek(id) {
  plek = data.locaties.find((l) => l.id === id);
  if (!plek) return;
  plek.positie ??= { lat: 52.2219, lng: 6.894, bevestigd: false };
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
  kaart.setView([plek.positie.lat, plek.positie.lng], 18);
}

function plekStatus() {
  const delen = [];
  delen.push(plek.positie?.bevestigd ? '✓ positie gecontroleerd' : '○ positie nog niet gecontroleerd');
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
  const url = new URL(location.href);
  url.hash = new URLSearchParams({ plek: plek.id, lat: plek.positie.lat.toFixed(6), lng: plek.positie.lng.toFixed(6) }).toString();
  return url.toString();
}

function toonLink() {
  const url = maakLink();
  $('luchtfoto-link').href = url;
  $('luchtfoto-link').textContent = url;
  $('link-status').textContent = '';
}

async function kopieerLink() {
  try {
    await navigator.clipboard.writeText(maakLink());
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
    const verschil = kaart.distance([punt.lat, punt.lng], [plek.positie.lat, plek.positie.lng]);
    if (verschil > 1) {
      overlay.linkpunt = window.L.circleMarker([punt.lat, punt.lng], { radius: 9, color: '#1d4ed8', weight: 3, fillOpacity: 0.25 }).addTo(kaart);
      $('link-status').textContent = `Het blauwe rondje is het punt uit de link. Het ligt ${Math.round(verschil)} m van de opgeslagen positie (rode speld).`;
    }
    kaart.setView([punt.lat, punt.lng], 20);
  }
  return true;
}

function zetPositie({ lat, lng }) {
  plek.positie = { lat: rond(lat), lng: rond(lng), bevestigd: plek.positie?.bevestigd === true };
  toonPositie();
  gewijzigd();
}

function toonPositie() {
  speld.setLatLng([plek.positie.lat, plek.positie.lng]);
  $('lat').textContent = plek.positie.lat.toFixed(6);
  $('lng').textContent = plek.positie.lng.toFixed(6);
  $('positie-ok').checked = plek.positie.bevestigd === true;
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

// ---------- Controle en uitvoer ----------

function controleer() {
  const fouten = [];
  for (const loc of data.locaties) {
    const f = controleerLocatie(loc, 'nl');
    if (f.length) fouten.push(`${loc.nummer} ${loc.titel?.nl ?? loc.id}: ${f.join(', ')}`);
    if (loc.gebouw && !gebouwVan(loc.gebouw)) fouten.push(`${loc.nummer}: gebouw "${loc.gebouw}" bestaat niet`);
  }
  for (const g of data.gebouwen) {
    if (!g.naam) fouten.push(`Gebouw ${g.id}: naam ontbreekt`);
    const heeftVorm = Array.isArray(g.vorm) && g.vorm.length >= 3;
    if (!heeftVorm && !(g.adres && /\d/.test(g.adres))) fouten.push(`Gebouw ${g.naam || g.id}: adres met huisnummer of eigen omtrek nodig`);
  }
  return fouten;
}

function werkUitvoerBij() {
  const tekst = alsTekst(data);
  $('uitvoer').value = tekst;
  const fouten = controleer();
  const lijst = $('controle');
  lijst.replaceChildren(...(fouten.length
    ? fouten.map((f) => maak('li', 'controle__fout', `✗ ${f}`))
    : [maak('li', 'controle__goed', '✓ Alles in orde. Het bestand kan op GitHub.')]));
  const anders = tekst !== origineel;
  $('kopieer').disabled = !!fouten.length || !anders;
  $('download').disabled = !!fouten.length || !anders;
  $('opslaan-status').textContent = anders ? '' : 'Nog niets gewijzigd.';
}

async function kopieer() {
  const veld = $('uitvoer');
  try {
    await navigator.clipboard.writeText(veld.value);
    $('opslaan-status').textContent = '✓ Gekopieerd. Plak het nu op GitHub (zie de stappen hieronder).';
  } catch {
    veld.focus();
    veld.select();
    $('opslaan-status').textContent = 'Kopiëren lukte niet automatisch. De tekst is geselecteerd: druk op Ctrl+C (Mac: Cmd+C).';
  }
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

// ---------- Opstarten ----------

function koppel() {
  $('plek').addEventListener('change', (e) => kiesPlek(e.target.value));
  $('kopieer-link').addEventListener('click', kopieerLink);
  window.addEventListener('hashchange', volgLink);
  $('positie-ok').addEventListener('change', (e) => { plek.positie.bevestigd = e.target.checked; plekStatus(); gewijzigd(); });

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
  $('kopieer').addEventListener('click', kopieer);
  $('download').addEventListener('click', download);
  $('herstel').addEventListener('click', () => {
    // Weggooien kan niet ongedaan worden gemaakt: eerst vragen.
    if (alsTekst(data) !== origineel && !window.confirm('Al je wijzigingen op deze pagina weggooien? Dit kun je niet ongedaan maken.')) return;
    try { localStorage.removeItem(CONCEPT_SLEUTEL); } catch { /* niets */ }
    location.reload();
  });
  window.addEventListener('beforeunload', (e) => {
    if (data && alsTekst(data) !== origineel) e.preventDefault(); // het concept staat ook in de browser bewaard
  });
}

async function start() {
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
}

start();
