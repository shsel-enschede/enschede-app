// Enschede app — schermen en navigatie.
// Navigatie via het adres (#/route/...) zodat de terugknop van de telefoon werkt.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { laadInhoud } from './inhoud.js';
import { antwoordVan, bewaarAntwoord } from './voortgang.js';
import { toonKaart, toonPositie } from './kaart.js';
import { vormVan, bekendeVorm } from './gebouwen.js';
import { afstandTot, indicatie } from './afstand.js';
import { gpsMogelijk, zetAan, zetUit, positie, gpsStatus, volg, hervatAlsToegestaan } from './locatie.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const $ = (id) => document.getElementById(id);

const el = {
  titel: $('kop-titel'),
  terug: $('terug'),
  hoofd: $('hoofd'),
  hoofdknop: $('hoofdknop'),
  melding: $('melding'),
  schermen: {
    start: $('scherm-start'),
    routes: $('scherm-routes'),
    route: $('scherm-route'),
    locatie: $('scherm-locatie'),
  },
};

let inhoud = null;
let hoofdknopActie = null;
let huidig = { scherm: 'start', route: null, loc: null };

// ---------- Afstand en ontgrendelen ----------
// Zie CLAUDE.md: in de testfase ("overal") is elke vraag open; daarna ("ter-plekke") alleen binnen de straal.

const indicaties = new Map(); // locatie-id -> laatste grove afstandsindicatie
const ontgrendeld = new Set(); // plekken waar je deze sessie bent geweest (blijven open, ook als je even wegloopt)

function terPlekkeModus() {
  return inhoud?.instellingen.ontgrendelen === 'ter-plekke';
}

function isOpen(loc) {
  return !terPlekkeModus() || antwoordVan(loc.id) !== null || ontgrendeld.has(loc.id);
}

function werkIndicatiesBij() {
  const p = positie();
  if (!p || !inhoud) return;
  for (const loc of inhoud.locaties.values()) {
    const meters = afstandTot([p.lat, p.lng], {
      vorm: loc.gebouw ? bekendeVorm(loc.gebouw) : null,
      punt: [loc.positie.lat, loc.positie.lng],
    });
    const ind = indicatie(meters, p.nauwkeurigheid, inhoud.instellingen.straal, indicaties.get(loc.id));
    indicaties.set(loc.id, ind);
    if (ind.soort === 'er') ontgrendeld.add(loc.id);
  }
}

function afstandTekst(loc) {
  return positie() ? indicaties.get(loc.id)?.tekst ?? null : null;
}

// Volgende plek: met GPS de dichtstbijzijnde onbezochte, anders de volgende in de route.
function volgendePlek(route, vanafId = null) {
  const open = route.locaties.filter((id) => antwoordVan(id) === null && id !== vanafId);
  if (!open.length) return null;
  if (positie()) {
    return open.reduce((beste, id) => ((indicaties.get(id)?.meters ?? Infinity) < (indicaties.get(beste)?.meters ?? Infinity) ? id : beste));
  }
  if (vanafId) {
    const i = route.locaties.indexOf(vanafId);
    const naVolgorde = route.locaties.slice(i + 1).concat(route.locaties.slice(0, i));
    return naVolgorde.find((id) => open.includes(id)) ?? null;
  }
  return open[0];
}

// Paneel met uitleg en de knop om de locatie aan te zetten (alleen na een tik, zie CLAUDE.md).
function vulGpsPaneel(paneel) {
  paneel.replaceChildren();
  if (!gpsMogelijk) {
    paneel.hidden = !terPlekkeModus();
    paneel.append(maak('p', 'gps__tekst', 'Dit toestel kan je locatie niet bepalen. Vraag de organisatie om de vragen vrij te geven.'));
    return;
  }
  paneel.hidden = false;
  const st = gpsStatus();
  const doel = terPlekkeModus() ? 'om te zien hoe ver de plekken zijn en de vragen te openen' : 'om te zien hoe ver de plekken zijn';
  const teksten = {
    uit: `Zet je locatie aan ${doel}. Je locatie blijft op je telefoon en wordt nergens bewaard.`,
    zoeken: 'Je locatie wordt gezocht… Dit kan buiten een halve minuut duren.',
    aan: 'Je locatie staat aan. Hij blijft op je telefoon.',
    geweigerd: 'De app mag je locatie niet gebruiken. Je kunt dit toestaan in de instellingen van je browser, bij deze website.',
    'niet-beschikbaar': 'Je locatie kon niet worden bepaald. Ga naar buiten of zet locatievoorzieningen aan op je telefoon.',
    fout: 'Je locatie kon niet worden bepaald. Probeer het opnieuw.',
  };
  paneel.append(maak('p', 'gps__tekst', teksten[st] ?? teksten.uit));
  const knop = maak('button', st === 'aan' ? 'gps__knop gps__knop--stil' : 'gps__knop');
  knop.type = 'button';
  if (st === 'aan') {
    knop.textContent = 'Zet locatie uit';
    knop.addEventListener('click', () => { zetUit(); toonPositie(null); });
  } else if (st === 'zoeken') {
    return;
  } else {
    knop.textContent = st === 'uit' ? 'Zet locatie aan' : 'Opnieuw proberen';
    knop.addEventListener('click', zetAan);
  }
  paneel.append(knop);
}

function maak(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst !== undefined) e.textContent = tekst;
  return e;
}

function toonScherm(naam, titel, { terug = true } = {}) {
  for (const [n, s] of Object.entries(el.schermen)) s.hidden = n !== naam;
  el.titel.textContent = titel;
  document.title = naam === 'start' ? 'Enschede app' : `${titel} · Enschede app`;
  el.terug.hidden = !terug;
  el.melding.hidden = true;
  window.scrollTo(0, 0);
  el.hoofd.focus({ preventScroll: true });
}

function zetHoofdknop(tekst, actie) {
  el.hoofdknop.hidden = !tekst;
  el.hoofdknop.textContent = tekst || '';
  hoofdknopActie = actie || null;
}

function ga(pad) {
  location.hash = pad;
}

// ---------- Schermen ----------

function startScherm() {
  toonScherm('start', 'Enschede app', { terug: false });
  huidig = { scherm: 'start', route: null, loc: null };
  zetHoofdknop('Begin', () => ga('#/routes'));
}

function routesScherm() {
  toonScherm('routes', 'Kies een route');
  huidig = { scherm: 'routes', route: null, loc: null };
  const lijst = $('route-lijst');
  lijst.replaceChildren();
  for (const route of inhoud.routes.values()) {
    const knop = maak('button', 'kaart');
    knop.type = 'button';
    const tekst = maak('span', 'kaart__tekst');
    tekst.append(maak('span', 'kaart__titel', route.titel));
    const klaar = route.locaties.filter((id) => antwoordVan(id) !== null).length;
    tekst.append(maak('span', 'kaart__sub', `${route.locaties.length} plekken · ${klaar} bezocht`));
    knop.append(tekst);
    knop.addEventListener('click', () => ga(`#/route/${route.id}`));
    const li = maak('li');
    li.append(knop);
    lijst.append(li);
  }
  zetHoofdknop(null);
}

function routeScherm(route) {
  toonScherm('route', route.titel);
  huidig = { scherm: 'route', route, loc: null };
  vulGpsPaneel($('gps-route'));
  $('route-intro').textContent = route.intro;

  const totaal = route.locaties.length;
  const klaar = route.locaties.filter((id) => antwoordVan(id) !== null).length;
  const balk = $('voortgang');
  balk.setAttribute('aria-valuemax', String(totaal));
  balk.setAttribute('aria-valuenow', String(klaar));
  balk.setAttribute('aria-label', 'Voortgang van de route');
  // Eén schuin segment per plek, zoals de rode balk onderaan het briefpapier
  balk.replaceChildren(...route.locaties.map((_, i) => maak('span', i < klaar ? 'voortgang__deel voortgang__deel--klaar' : 'voortgang__deel')));
  $('voortgang-tekst').textContent =
    klaar === totaal ? `Route voltooid: alle ${totaal} plekken bezocht!` : `${klaar} van ${totaal} plekken bezocht`;

  const lijst = $('locatie-lijst');
  lijst.replaceChildren();
  // Met GPS: dichtstbijzijnde onbezochte plek bovenaan, bezochte onderaan. De volgorde ligt vast tot je het scherm opnieuw opent.
  const volgorde = route.locaties.map((id, i) => ({ id, i }));
  if (positie()) {
    const sleutel = ({ id }) => (antwoordVan(id) !== null ? 1e9 : 0) + (indicaties.get(id)?.meters ?? 1e8);
    volgorde.sort((x, y) => sleutel(x) - sleutel(y));
  }
  volgorde.forEach(({ id, i }) => {
    const loc = inhoud.locaties.get(id);
    const bezocht = antwoordVan(id) !== null;
    const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
    knop.type = 'button';
    knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : String(i + 1)));
    const tekst = maak('span', 'kaart__tekst');
    tekst.append(maak('span', 'kaart__titel', loc.titel));
    const sub = maak('span', 'kaart__sub', bezocht ? 'Bezocht' : afstandTekst(loc) ?? loc.adres);
    if (!bezocht) sub.dataset.afstand = id;
    tekst.append(sub);
    knop.append(tekst);
    knop.setAttribute('aria-label', `${i + 1}. ${loc.titel}${bezocht ? ', bezocht' : ''}`);
    knop.addEventListener('click', () => ga(`#/route/${route.id}/${id}`));
    const li = maak('li');
    li.append(knop);
    lijst.append(li);
  });

  werkRouteKnopBij(route);

  $('gebouwkeuze').hidden = true;
  toonKaart($('wijkkaart'), route, inhoud, {
    antwoordVan,
    kiesGroep: (groep) => kiesGebouw(route, groep),
    meld: toonFout,
  }).then(() => toonPositie(positie())).catch((fout) => {
    console.warn(fout);
    $('wijkkaart').hidden = true; // zonder kaart blijft de lijst gewoon werken
  });
}

// Hoofdknop van het routescherm: sta je bij een plek, dan openen; anders naar de dichtstbijzijnde.
function werkRouteKnopBij(route) {
  const hier = route.locaties.find((id) => antwoordVan(id) === null && indicaties.get(id)?.soort === 'er' && positie());
  if (hier) {
    zetHoofdknop(`Je bent er! Open: ${inhoud.locaties.get(hier).titel}`, () => ga(`#/route/${route.id}/${hier}`));
    return;
  }
  const volgende = volgendePlek(route);
  if (!volgende) return zetHoofdknop(null);
  const afstand = afstandTekst(inhoud.locaties.get(volgende));
  zetHoofdknop(afstand ? `Volgende: ${inhoud.locaties.get(volgende).titel} · ${afstand}` : 'Naar de volgende plek',
    () => ga(`#/route/${route.id}/${volgende}`));
}

// Tik op een gebouw: één verhaal -> direct openen; meer verhalen -> kiezen.
function kiesGebouw(route, groep) {
  if (groep.locaties.length === 1) return ga(`#/route/${route.id}/${groep.locaties[0].id}`);
  $('gebouwkeuze-titel').textContent = `${groep.gebouw.naam}: ${groep.locaties.length} verhalen`;
  const lijst = $('gebouwkeuze-lijst');
  lijst.replaceChildren();
  for (const loc of groep.locaties) {
    const bezocht = antwoordVan(loc.id) !== null;
    const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
    knop.type = 'button';
    knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : String(route.locaties.indexOf(loc.id) + 1)));
    const tekst = maak('span', 'kaart__tekst');
    tekst.append(maak('span', 'kaart__titel', loc.titel));
    tekst.append(maak('span', 'kaart__sub', bezocht ? 'Bezocht' : afstandTekst(loc) ?? 'Nog niet bezocht'));
    knop.append(tekst);
    knop.addEventListener('click', () => ga(`#/route/${route.id}/${loc.id}`));
    const li = maak('li');
    li.append(knop);
    lijst.append(li);
  }
  const keuze = $('gebouwkeuze');
  keuze.hidden = false;
  keuze.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function locatieScherm(route, loc, { netOpen = false } = {}) {
  toonScherm('locatie', loc.titel);
  huidig = { scherm: 'locatie', route, loc };
  $('locatie-adres').textContent = loc.adres;
  toonFotos(loc, isOpen(loc));

  // Nog niet ter plekke: alleen een voorproefje en de afstand (nieuwsgierigheid houdt de wandelaar in beweging).
  const open = isOpen(loc);
  $('slot').hidden = open;
  $('locatie-tekst').hidden = !open;
  $('vraag').hidden = !open;
  $('net-open').hidden = !netOpen;
  if (!open) {
    const eersteZin = (loc.tekst.match(/^.*?[.!?](\s|$)/) ?? [loc.tekst])[0].trim();
    $('slot-teaser').textContent = eersteZin;
    $('slot-afstand').textContent = afstandTekst(loc) ?? '';
    vulGpsPaneel($('gps-locatie'));
    $('feedback').hidden = true;
    zetHoofdknop('Bekijk de kaart', () => ga(`#/route/${route.id}`));
    return;
  }
  $('locatie-tekst').textContent = loc.tekst;
  $('vraag-tekst').textContent = loc.vraag;

  const opties = $('vraag-opties');
  opties.replaceChildren();
  const knoppen = loc.opties.map((tekst, i) => {
    const knop = maak('button', 'optie');
    knop.type = 'button';
    knop.append(maak('span', 'optie__letter', LETTERS[i]), maak('span', '', tekst));
    knop.addEventListener('click', () => beantwoord(route, loc, i, knoppen));
    opties.append(knop);
    return knop;
  });

  $('feedback').hidden = true;
  const eerder = antwoordVan(loc.id);
  if (eerder !== null) {
    toonUitslag(route, loc, eerder, knoppen, false);
  } else {
    zetHoofdknop(null);
  }
}

// Foto's bij een plek. Nog niet ter plekke: alleen de eerste, wazig (zoals in de oude app).
function toonFotos(loc, open) {
  const houder = $('locatie-fotos');
  houder.replaceChildren();
  const fotos = open ? loc.fotos : loc.fotos.slice(0, 1);
  houder.hidden = !fotos.length;
  houder.classList.toggle('fotos--wazig', !open);
  for (const foto of fotos) {
    const figuur = maak('figure', 'foto');
    const img = maak('img');
    img.src = foto.src;
    img.alt = open ? foto.alt : '';
    img.loading = 'lazy';
    img.decoding = 'async';
    figuur.append(img);
    if (open && (foto.bijschrift || foto.bron)) {
      const onder = maak('figcaption', '', foto.bijschrift);
      if (foto.bron) onder.append(maak('span', 'foto__bron', `Bron: ${foto.bron}`));
      figuur.append(onder);
    }
    houder.append(figuur);
  }
}

function beantwoord(route, loc, keuze, knoppen) {
  if (antwoordVan(loc.id) !== null) return;
  bewaarAntwoord(loc.id, keuze); // automatisch opslaan, geen aparte knop nodig
  toonUitslag(route, loc, keuze, knoppen, true);
}

function toonUitslag(route, loc, keuze, knoppen, net) {
  const goed = keuze === loc.juist;
  knoppen.forEach((knop, i) => {
    knop.disabled = true;
    if (i === loc.juist) {
      knop.classList.add('optie--goed');
      knop.append(maak('span', 'optie__icoon', '✓'));
      knop.setAttribute('aria-label', `${LETTERS[i]}: ${loc.opties[i]}, juiste antwoord`);
    } else if (i === keuze) {
      knop.classList.add('optie--fout');
      knop.append(maak('span', 'optie__icoon', '✗'));
      knop.setAttribute('aria-label', `${LETTERS[i]}: ${loc.opties[i]}, jouw antwoord, niet juist`);
    }
  });

  const fb = $('feedback');
  fb.className = `feedback ${goed ? 'feedback--goed' : 'feedback--fout'}`;
  fb.replaceChildren(
    maak('strong', 'feedback__kop', goed ? '✓ Goed!' : `✗ Helaas, het is ${LETTERS[loc.juist]}`),
    maak('span', '', loc.uitleg),
  );
  fb.hidden = false;
  if (net) {
    // De uitleg staat onderaan: scroll naar het einde zodat hij volledig boven de knop staat.
    requestAnimationFrame(() => window.scrollTo(0, document.documentElement.scrollHeight));
  }

  // Nieuwsgierig maken naar de volgende plek (open lus houdt de aandacht vast)
  const volgendeId = volgendePlek(route, loc.id);
  if (volgendeId) {
    const volgende = inhoud.locaties.get(volgendeId);
    const afstand = afstandTekst(volgende);
    zetHoofdknop(`Volgende: ${volgende.titel}${afstand ? ` · ${afstand}` : ''}`, () => ga(`#/route/${route.id}/${volgendeId}`));
  } else {
    zetHoofdknop('Route voltooid! Bekijk je resultaat', () => ga(`#/route/${route.id}`));
  }
}

function toonFout(tekst) {
  el.melding.textContent = tekst;
  el.melding.hidden = false;
}

// ---------- Navigatie ----------

function navigeer() {
  if (!inhoud) return;
  const delen = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [pagina, routeId, locId] = delen;

  if (pagina === 'routes') return routesScherm();
  if (pagina === 'route') {
    const route = inhoud.routes.get(routeId);
    if (!route) return ga('#/routes');
    if (!locId) return routeScherm(route);
    if (!route.locaties.includes(locId)) return ga(`#/route/${route.id}`);
    return locatieScherm(route, inhoud.locaties.get(locId));
  }
  return startScherm();
}

// Bij elke GPS-meting alleen de afstanden en knoppen bijwerken, niet het hele scherm (rustig beeld).
let vorigeStatus = null;
let vormenGevraagd = false;
volg((p) => {
  if (!inhoud) return;
  if (!vormenGevraagd && gpsStatus() !== 'uit') {
    vormenGevraagd = true; // omtrekken nodig voor de afstand tot de rand van een gebouw
    for (const g of inhoud.gebouwen.values()) vormVan(g).catch(() => {});
  }
  const statusAnders = gpsStatus() !== vorigeStatus;
  vorigeStatus = gpsStatus();
  werkIndicatiesBij();
  if (huidig.scherm === 'route') {
    if (statusAnders) vulGpsPaneel($('gps-route'));
    for (const sub of document.querySelectorAll('#locatie-lijst [data-afstand]')) {
      const loc = inhoud.locaties.get(sub.dataset.afstand);
      if (loc) sub.textContent = afstandTekst(loc) ?? loc.adres;
    }
    werkRouteKnopBij(huidig.route);
    toonPositie(p);
  } else if (huidig.scherm === 'locatie' && $('slot').hidden === false) {
    if (isOpen(huidig.loc)) {
      locatieScherm(huidig.route, huidig.loc, { netOpen: true });
    } else {
      $('slot-afstand').textContent = afstandTekst(huidig.loc) ?? '';
      if (statusAnders) vulGpsPaneel($('gps-locatie'));
    }
  }
});

el.terug.addEventListener('click', () => {
  if (history.length > 1) history.back();
  else ga('#/');
});
el.hoofdknop.addEventListener('click', () => hoofdknopActie?.());
window.addEventListener('hashchange', navigeer);

async function start() {
  startScherm();
  try {
    inhoud = await laadInhoud('nl');
    if (!inhoud.routes.size) throw new Error('Geen routes gevonden');
    $('voet-info').hidden = terPlekkeModus();
    navigeer();
    hervatAlsToegestaan();
  } catch (fout) {
    console.error(fout);
    zetHoofdknop(null);
    toonFout('De inhoud kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((fout) => console.warn('Offline werken niet beschikbaar:', fout));
  }
}

start();
