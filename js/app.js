// Enschede app — schermen en navigatie.
// Uitgangspunt: wandelen zonder vaste volgorde. De wandelaar kiest zelf (zie CLAUDE.md, "Vrij ontdekken").
// Navigatie via het adres (#/kaart, #/plek/...) zodat de terugknop van de telefoon werkt.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { laadInhoud } from './inhoud.js';
import { antwoordVan, bewaarAntwoord, wisAntwoorden } from './voortgang.js';
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
  voet: document.querySelector('.voet'),
  voetInfo: $('voet-info'),
  melding: $('melding'),
  schermen: {
    start: $('scherm-start'),
    kaart: $('scherm-kaart'),
    locatie: $('scherm-locatie'),
  },
};

// Grens voor de groep "Dichtbij" in de lijst: ca. 5 minuten lopen.
const DICHTBIJ = 400; // meter

let inhoud = null;
let alles = null; // alle plekken als één verzameling: { id, locaties: [ids] }
let hoofdknopActie = null;
let huidig = { scherm: 'start', loc: null };
let lijstMetAfstand = false; // is de lijst al op afstand gesorteerd?

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
  el.voet.hidden = !tekst && el.voetInfo.hidden; // geen lege balk onderin
}

function ga(pad) {
  location.hash = pad;
}

// ---------- Schermen ----------

function startScherm() {
  toonScherm('start', 'Enschede app', { terug: false });
  huidig = { scherm: 'start', loc: null };
  zetHoofdknop('Bekijk de kaart', () => ga('#/kaart'));
}

function aantalBezocht() {
  return alles.locaties.filter((id) => antwoordVan(id) !== null).length;
}

function kaartScherm() {
  toonScherm('kaart', 'Kaart');
  huidig = { scherm: 'kaart', loc: null };
  vulGpsPaneel($('gps-kaart'));

  const totaal = alles.locaties.length;
  const klaar = aantalBezocht();
  const balk = $('voortgang');
  balk.setAttribute('aria-valuemax', String(totaal));
  balk.setAttribute('aria-valuenow', String(klaar));
  balk.setAttribute('aria-label', 'Bezochte plekken');
  // Eén schuin segment per plek, zoals de rode balk onderaan het briefpapier
  balk.replaceChildren(...alles.locaties.map((_, i) => maak('span', i < klaar ? 'voortgang__deel voortgang__deel--klaar' : 'voortgang__deel')));
  $('voortgang-tekst').textContent =
    klaar === totaal ? `Alle ${totaal} plekken bezocht!` : `${klaar} van ${totaal} plekken bezocht`;

  vulPlekken();
  werkKaartKnopBij();

  // Opnieuw beginnen: alleen zichtbaar als er iets te wissen is; bevestiging in de pagina zelf.
  $('opnieuw').hidden = klaar === 0;
  $('opnieuw-vraag').hidden = true;
  $('opnieuw-knop').setAttribute('aria-expanded', 'false');

  $('gebouwkeuze').hidden = true;
  toonKaart($('wijkkaart'), alles, inhoud, {
    antwoordVan,
    kiesGroep: kiesGebouw,
    meld: toonFout,
  }).then(() => toonPositie(positie())).catch((fout) => {
    console.warn(fout);
    $('wijkkaart').hidden = true; // zonder kaart blijft de lijst gewoon werken
  });
}

// Eén plek als knop in een lijst. Geen nummers: die suggereren een volgorde.
function plekKnop(loc) {
  const bezocht = antwoordVan(loc.id) !== null;
  const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
  knop.type = 'button';
  knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : ''));
  const tekst = maak('span', 'kaart__tekst');
  tekst.append(maak('span', 'kaart__titel', loc.titel));
  const sub = maak('span', 'kaart__sub', bezocht ? 'Bezocht' : afstandTekst(loc) ?? loc.adres);
  if (!bezocht) sub.dataset.afstand = loc.id;
  tekst.append(sub);
  knop.append(tekst);
  knop.setAttribute('aria-label', `${loc.titel}${bezocht ? ', bezocht' : ''}`);
  knop.addEventListener('click', () => ga(`#/plek/${loc.id}`));
  const li = maak('li');
  li.append(knop);
  return li;
}

function lijstBlok(kop, locaties) {
  if (!locaties.length) return [];
  const lijst = maak('ul', 'lijst');
  lijst.append(...locaties.map(plekKnop));
  return [maak('h2', 'tussenkop', kop), lijst];
}

// Lijst onder de kaart (ook het toegankelijke alternatief voor de kaart).
// Met GPS: "Dichtbij" en "Verder weg" als gelijkwaardige keuzes; zonder GPS op naam.
// Bezochte plekken onderaan. De volgorde ligt vast tot het scherm opnieuw opent (rustig beeld).
function vulPlekken() {
  const locs = alles.locaties.map((id) => inhoud.locaties.get(id));
  const open = locs.filter((loc) => antwoordVan(loc.id) === null);
  const bezocht = locs.filter((loc) => antwoordVan(loc.id) !== null);
  const opNaam = (x, y) => x.titel.localeCompare(y.titel, 'nl');
  const meters = (loc) => indicaties.get(loc.id)?.meters;
  lijstMetAfstand = Boolean(positie()) && open.some((loc) => Number.isFinite(meters(loc)) && indicaties.get(loc.id).soort !== 'onzeker');

  const blokken = [];
  if (lijstMetAfstand) {
    open.sort((x, y) => (meters(x) ?? Infinity) - (meters(y) ?? Infinity));
    blokken.push(...lijstBlok('Dichtbij', open.filter((loc) => meters(loc) <= DICHTBIJ)));
    blokken.push(...lijstBlok('Verder weg', open.filter((loc) => !(meters(loc) <= DICHTBIJ))));
  } else {
    blokken.push(...lijstBlok('Alle plekken', open.sort(opNaam)));
  }
  blokken.push(...lijstBlok('Al bezocht', bezocht.sort(opNaam)));
  $('plekken').replaceChildren(...blokken);
}

// Hoofdknop van de kaart: alleen als je bij een plek staat. Verder kiest de wandelaar zelf.
function werkKaartKnopBij() {
  const hier = positie() && alles.locaties.find((id) => antwoordVan(id) === null && indicaties.get(id)?.soort === 'er');
  if (hier) zetHoofdknop(`Je bent er! Open: ${inhoud.locaties.get(hier).titel}`, () => ga(`#/plek/${hier}`));
  else zetHoofdknop(null);
}

// Tik op een gebouw: één verhaal -> direct openen; meer verhalen -> kiezen.
function kiesGebouw(groep) {
  if (groep.locaties.length === 1) return ga(`#/plek/${groep.locaties[0].id}`);
  $('gebouwkeuze-titel').textContent = `${groep.gebouw.naam}: ${groep.locaties.length} verhalen`;
  const lijst = $('gebouwkeuze-lijst');
  lijst.replaceChildren(...groep.locaties.map(plekKnop));
  const keuze = $('gebouwkeuze');
  keuze.hidden = false;
  keuze.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'nearest' });
}

function locatieScherm(loc, { netOpen = false } = {}) {
  toonScherm('locatie', loc.titel);
  huidig = { scherm: 'locatie', loc };
  $('locatie-adres').textContent = loc.adres;
  toonFotos(loc, isOpen(loc));

  // Nog niet ter plekke: alleen een voorproefje en de afstand (nieuwsgierig maken, niet sturen).
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
    zetHoofdknop('Terug naar de kaart', () => ga('#/kaart'));
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
    knop.addEventListener('click', () => beantwoord(loc, i, knoppen));
    opties.append(knop);
    return knop;
  });

  $('feedback').hidden = true;
  const eerder = antwoordVan(loc.id);
  if (eerder !== null) {
    toonUitslag(loc, eerder, knoppen, false);
  } else {
    zetHoofdknop('Terug naar de kaart', () => ga('#/kaart'));
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
    // Een foto die niet laadt (ontbreekt in de map) verbergen we, in plaats van een kapot plaatje.
    img.addEventListener('error', () => { figuur.hidden = true; }, { once: true });
    figuur.append(img);
    if (foto.proef) figuur.append(maak('span', 'foto__proef', 'Proef: rechten nog niet bevestigd'));
    if (open && (foto.bijschrift || foto.bron)) {
      const onder = maak('figcaption', '', foto.bijschrift);
      if (foto.bron) onder.append(maak('span', 'foto__bron', `Bron: ${foto.bron}`));
      figuur.append(onder);
    }
    houder.append(figuur);
  }
}

function beantwoord(loc, keuze, knoppen) {
  if (antwoordVan(loc.id) !== null) return;
  bewaarAntwoord(loc.id, keuze); // automatisch opslaan, geen aparte knop nodig
  toonUitslag(loc, keuze, knoppen, true);
}

function toonUitslag(loc, keuze, knoppen, net) {
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

  // Geen voorgeschreven volgende plek: terug naar de kaart, de wandelaar kiest zelf.
  const klaar = aantalBezocht();
  zetHoofdknop(klaar === alles.locaties.length ? 'Alle plekken bezocht! Bekijk de kaart' : 'Terug naar de kaart', () => ga('#/kaart'));
}

function toonFout(tekst) {
  el.melding.textContent = tekst;
  el.melding.hidden = false;
}

// ---------- Navigatie ----------

function navigeer() {
  if (!inhoud) return;
  const delen = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  const [pagina, id, oudId] = delen;

  // Oude adressen uit de routeversie (bladwijzers, geïnstalleerde app) blijven werken.
  if (pagina === 'routes' || (pagina === 'route' && !oudId)) return location.replace('#/kaart');
  if (pagina === 'route') return location.replace(`#/plek/${oudId}`);

  if (pagina === 'kaart') return kaartScherm();
  if (pagina === 'plek') {
    const loc = inhoud.locaties.get(id);
    if (!loc) return location.replace('#/kaart');
    return locatieScherm(loc);
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
  if (huidig.scherm === 'kaart') {
    if (statusAnders) vulGpsPaneel($('gps-kaart'));
    if (!lijstMetAfstand || !positie()) {
      vulPlekken(); // eerste bruikbare meting (of locatie uit): één keer opnieuw indelen
    } else {
      for (const sub of document.querySelectorAll('#plekken [data-afstand]')) {
        const loc = inhoud.locaties.get(sub.dataset.afstand);
        if (loc) sub.textContent = afstandTekst(loc) ?? loc.adres;
      }
    }
    werkKaartKnopBij();
    toonPositie(p);
  } else if (huidig.scherm === 'locatie' && $('slot').hidden === false) {
    if (isOpen(huidig.loc)) {
      locatieScherm(huidig.loc, { netOpen: true });
    } else {
      $('slot-afstand').textContent = afstandTekst(huidig.loc) ?? '';
      if (statusAnders) vulGpsPaneel($('gps-locatie'));
    }
  }
});

$('opnieuw-knop').addEventListener('click', () => {
  const open = $('opnieuw-vraag').hidden;
  $('opnieuw-vraag').hidden = !open;
  $('opnieuw-knop').setAttribute('aria-expanded', String(open));
  if (open) {
    // Zorg dat de vraag boven de vaste voetbalk staat.
    const onder = $('opnieuw-vraag').getBoundingClientRect().bottom;
    const voet = document.querySelector('.voet').getBoundingClientRect().top;
    if (onder > voet - 12) window.scrollBy({ top: onder - voet + 12, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    $('opnieuw-nee').focus({ preventScroll: true });
  }
});
$('opnieuw-nee').addEventListener('click', () => {
  $('opnieuw-vraag').hidden = true;
  $('opnieuw-knop').setAttribute('aria-expanded', 'false');
  $('opnieuw-knop').focus();
});
$('opnieuw-ja').addEventListener('click', () => {
  wisAntwoorden(alles.locaties);
  ontgrendeld.clear();
  kaartScherm(); // scrollt naar boven: de lege voortgangsbalk laat direct zien dat het gelukt is
  $('voortgang-tekst').textContent = 'Je antwoorden zijn gewist. Veel plezier met ontdekken!';
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
    if (!inhoud.locaties.size) throw new Error('Geen plekken gevonden');
    // Alle geldige plekken samen; routes uit de inhoud worden (nog) niet gebruikt.
    alles = { id: 'alles', locaties: [...inhoud.locaties.keys()] };
    el.voetInfo.hidden = terPlekkeModus();
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
