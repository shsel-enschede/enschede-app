// Enschede app — schermen en navigatie.
// Uitgangspunt: wandelen zonder vaste volgorde. De wandelaar kiest zelf (zie CLAUDE.md, "Vrij ontdekken").
// Navigatie via het adres (#/kaart, #/plek/...) zodat de terugknop van de telefoon werkt.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { laadInhoud } from './inhoud.js';
import { antwoordVan, bewaarAntwoord, wisAntwoorden } from './voortgang.js';
import { toonKaart, toonPositie, centreer, markeerPlek } from './kaart.js';
import { vormVan, bekendeVorm } from './gebouwen.js';
import { afstandTot, indicatie } from './afstand.js';
import { gpsMogelijk, zetAan, zetUit, positie, gpsStatus, volg, hervatAlsToegestaan } from './locatie.js';
import { maak, scrolGedrag } from './hulp.js';
import { instellingen, zetInstelling } from './instellingen.js';

const LETTERS = ['A', 'B', 'C', 'D'];
const $ = (id) => document.getElementById(id);

const el = {
  titel: $('kop-titel'),
  terug: $('terug'),
  hoofd: $('hoofd'),
  hoofdknop: $('hoofdknop'),
  kop: document.querySelector('.kop'),
  voet: document.querySelector('.voet'),
  melding: $('melding'),
  schermen: {
    start: $('scherm-start'),
    kaart: $('scherm-kaart'),
    locatie: $('scherm-locatie'),
    menu: $('scherm-menu'),
    antwoorden: $('scherm-antwoorden'),
  },
};

// Grens voor de groep "Dichtbij" in de lijst: ca. 5 minuten lopen.
const DICHTBIJ = 400; // meter
// Na een antwoord: zoveel keuzes "Ook in de buurt". Weinig opties = snel kiezen (wet van Hick).
const KEUZES_NA_ANTWOORD = 3;

let inhoud = null;
let alles = null; // alle plekken als één verzameling: { id, locaties: [ids] } (kaart.js kan later ook een thema of buurt tonen)
let hoofdknopActie = null;
let huidig = { scherm: 'start', loc: null };
let lijstMetAfstand = false; // is de lijst al op afstand gesorteerd?

// ---------- Afstand en ontgrendelen ----------
// Zie CLAUDE.md: in de testfase ("overal") is elke vraag open; daarna ("ter-plekke") alleen binnen de straal.

const indicaties = new Map(); // locatie-id -> laatste grove afstandsindicatie
const ontgrendeld = new Set(); // plekken waar je deze sessie bent geweest (blijven open, ook als je even wegloopt)

// De keuze in het menu gaat voor; anders geldt wat de SHSEL in content/locaties.json heeft gezet.
function openenModus() {
  return instellingen().openen ?? inhoud?.instellingen.ontgrendelen ?? 'ter-plekke';
}

function terPlekkeModus() {
  return openenModus() === 'ter-plekke';
}

// ---------- Doel en antwoorden (menu) ----------

// Het doel uit het menu, nooit meer dan er plekken zijn. Zonder doel: alle plekken.
function doelAantal() {
  const totaal = alles.locaties.length;
  return Math.min(instellingen().doel ?? totaal, totaal);
}

function heeftDoel() {
  return instellingen().doel !== null && doelAantal() < alles.locaties.length;
}

function doelGehaald() {
  return aantalOntdekt() >= doelAantal();
}

// Goede antwoorden direct tonen, of pas aan het eind (doel gehaald of alles ontdekt).
function antwoordZichtbaar() {
  return instellingen().antwoorden === 'direct' || doelGehaald();
}

const plekken = (n) => `${n} ${n === 1 ? 'plek' : 'plekken'}`;

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
    paneel.append(maak('p', 'gps__tekst', 'Dit toestel kan je locatie niet bepalen. Kies in het menu (rechtsboven) voor "Overal", dan zijn alle vragen open.'));
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

function toonScherm(naam, titel, { terug = true } = {}) {
  for (const [n, s] of Object.entries(el.schermen)) s.hidden = n !== naam;
  el.titel.textContent = titel;
  document.title = naam === 'start' ? 'Enschede app' : `${titel} · Enschede app`;
  el.terug.hidden = !terug;
  const opMenu = naam === 'menu';
  $('menuknop').classList.toggle('kop__menu--actief', opMenu);
  $('menuknop').setAttribute('aria-label', opMenu ? 'Menu sluiten' : 'Menu: instellingen en informatie');
  if (opMenu) $('menuknop').setAttribute('aria-current', 'page');
  else $('menuknop').removeAttribute('aria-current');
  el.melding.hidden = true;
  window.scrollTo(0, 0);
  el.hoofd.focus({ preventScroll: true });
}

function zetHoofdknop(tekst, actie) {
  el.hoofdknop.hidden = !tekst;
  el.hoofdknop.textContent = tekst || '';
  hoofdknopActie = actie || null;
  werkVoetBij();
}

// Geen lege balk onderin.
function werkVoetBij() {
  el.voet.hidden = el.hoofdknop.hidden && $('langs').hidden;
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

function aantalOntdekt() {
  return alles.locaties.filter((id) => antwoordVan(id) !== null).length;
}

function kaartScherm() {
  toonScherm('kaart', 'Kaart');
  huidig = { scherm: 'kaart', loc: null };
  gpsPaneelOpen = false;
  vulKaartGps();

  const totaal = alles.locaties.length;
  const klaar = aantalOntdekt();
  const balk = $('voortgang');
  // Met een doel loopt de balk naar het doel, anders naar alle plekken.
  const delen = balkDelen(klaar);
  balk.setAttribute('aria-valuemax', String(delen));
  balk.setAttribute('aria-valuenow', String(Math.min(klaar, delen)));
  balk.setAttribute('aria-label', heeftDoel() ? 'Ontdekte plekken, op weg naar je doel' : 'Ontdekte plekken');
  // Eén schuin segment per plek, zoals de rode balk onderaan het briefpapier
  balk.replaceChildren(...Array.from({ length: delen }, (_, i) => maak('span', i < klaar ? 'voortgang__deel voortgang__deel--klaar' : 'voortgang__deel')));
  toonOntdekt(klaar, totaal);
  $('antwoorden-link').hidden = klaar === 0;

  vulPlekken();
  zetHoofdknop(null); // op de kaart kiest de wandelaar zelf; bij een plek verschijnt "Je loopt langs …"
  werkLangsBij();

  // Opnieuw beginnen: alleen zichtbaar als er iets te wissen is; bevestiging in de pagina zelf.
  $('opnieuw').hidden = klaar === 0;
  $('opnieuw-vraag').hidden = true;
  $('opnieuw-knop').setAttribute('aria-expanded', 'false');

  $('gebouwkeuze').hidden = true;
  $('lijstgreep-tekst').textContent = `Alle ${totaal} plekken als lijst`;
  toonKaart($('wijkkaart'), alles, inhoud, {
    antwoordVan,
    kiesGroep: kiesGebouw,
    opLeegTik: sluitKaartpanelen,
    meld: toonFout,
  }).then(() => toonPositie(positie())).catch((fout) => {
    console.warn(fout);
    // Zonder kaart blijft de lijst gewoon werken; teller en locatie-uitleg staan dan boven de lijst.
    $('kaartvak').classList.add('kaartvak--zonder');
    vulKaartGps();
  });
}

// Aantal segmenten in de voortgangsbalk: het doel, of alle plekken. Voorbij het doel groeit de balk mee.
function balkDelen(klaar) {
  return heeftDoel() ? Math.max(doelAantal(), klaar) : alles.locaties.length;
}

// Voortgang als verzameling: tel wat je ontdekt hebt, niet wat je nog "moet".
// Een zelfgekozen doel (menu) mag wel: "3 van 24 plekken ontdekt".
// Goed of fout antwoorden maakt niet uit: een plek is ontdekt zodra je de vraag hebt beantwoord.
// Er is bewust geen score (lage drempel, ook voor kinderen; leren gaat voor punten).
function toonOntdekt(klaar, totaal) {
  const tal = $('voortgang-tekst');
  const doel = heeftDoel() ? doelAantal() : null;
  if (klaar === totaal) tal.textContent = `Alles ontdekt: alle ${totaal} plekken!`;
  else if (doel && klaar >= doel) tal.textContent = `Doel gehaald: ${plekken(klaar)} ontdekt!`;
  else if (doel) tal.textContent = `${klaar} van ${doel} plekken ontdekt`;
  else if (klaar === 0) tal.textContent = 'Nog niets ontdekt. Begin waar je wilt.';
  else tal.textContent = `${plekken(klaar)} ontdekt`;
  $('voortgang-totaal').textContent = klaar === totaal ? 'Knap gedaan!' : `In de stad zijn ${totaal} plekken met een verhaal.`;

  // Verzameling van gebouwen waar je iets ontdekt hebt (geen lege vakjes: alleen wat je al hebt).
  const lijst = $('ontdekt-gebouwen');
  const items = gebouwTellingen()
    .filter((t) => t.klaar > 0)
    .sort((x, y) => (y.klaar === y.totaal) - (x.klaar === x.totaal) || x.naam.localeCompare(y.naam, 'nl'))
    .map((t) => {
      const af = t.klaar === t.totaal;
      const li = maak('li', af ? 'ontdekt__gebouw ontdekt__gebouw--af' : 'ontdekt__gebouw',
        `${af ? '✓ ' : ''}${t.naam}${t.totaal > 1 && !af ? ` ${t.klaar}/${t.totaal}` : ''}`);
      if (!af) li.setAttribute('aria-label', `${t.naam}: ${t.klaar} van ${t.totaal} verhalen ontdekt`);
      return li;
    });
  lijst.replaceChildren(...items);
  lijst.hidden = !items.length;
}

// Per gebouw (of losse plek): naam, aantal verhalen en aantal ontdekt.
function gebouwTellingen() {
  const map = new Map();
  for (const id of alles.locaties) {
    const loc = inhoud.locaties.get(id);
    const sleutel = loc.gebouw ?? `p:${loc.id}`;
    const naam = (loc.gebouw && inhoud.gebouwen.get(loc.gebouw)?.naam) || loc.titel;
    if (!map.has(sleutel)) map.set(sleutel, { sleutel, naam, totaal: 0, klaar: 0 });
    const t = map.get(sleutel);
    t.totaal += 1;
    if (antwoordVan(id) !== null) t.klaar += 1;
  }
  return [...map.values()];
}

// Eén plek als knop in een lijst. Geen nummers: die suggereren een volgorde.
function plekKnop(loc, vasteSub = null) {
  const bezocht = antwoordVan(loc.id) !== null;
  const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
  knop.type = 'button';
  knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : ''));
  const tekst = maak('span', 'kaart__tekst');
  tekst.append(maak('span', 'kaart__titel', loc.titel));
  const sub = maak('span', 'kaart__sub', bezocht ? 'Ontdekt' : vasteSub ?? afstandTekst(loc) ?? loc.adres);
  if (!bezocht && !vasteSub) sub.dataset.afstand = loc.id;
  tekst.append(sub);
  knop.append(tekst);
  knop.setAttribute('aria-label', `${loc.titel}${bezocht ? ', ontdekt' : ''}`);
  knop.addEventListener('click', () => ga(`#/plek/${loc.id}`));
  const li = maak('li');
  li.append(knop);
  return li;
}

function lijstBlok(kop, locaties) {
  if (!locaties.length) return [];
  const lijst = maak('ul', 'lijst');
  lijst.append(...locaties.map((loc) => plekKnop(loc)));
  return [maak('h2', 'tussenkop', kop), lijst];
}

// Lijst onder de kaart (ook het toegankelijke alternatief voor de kaart).
// Met GPS: "Dichtbij" en "Verder weg" als gelijkwaardige keuzes; zonder GPS op naam.
// Ontdekte plekken onderaan. De volgorde ligt vast tot het scherm opnieuw opent (rustig beeld).
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
  blokken.push(...lijstBlok('Al ontdekt', bezocht.sort(opNaam)));
  $('plekken').replaceChildren(...blokken);
}

// ---------- "Je loopt langs …" ----------
// Kom je (met GPS) toevallig bij een plek die je nog niet bezocht hebt, dan verschijnt onderin een rustige melding:
// Bekijk of Verder lopen. Verder lopen telt als gewone keuze: die plek meldt zich deze sessie niet opnieuw.
// Niets wordt bewaard of verstuurd (zie CLAUDE.md, Veiligheid).

const weggetikt = new Set(); // gebouw- of plek-sleutels, alleen in het geheugen
let langsSleutel = null;
let langsDoel = null;

function sleutelVan(loc) {
  return loc.gebouw ? `g:${loc.gebouw}` : `p:${loc.id}`;
}

function werkLangsBij() {
  const vak = $('langs');
  let doel = null;
  // Niet storen tijdens het lezen: op een open, nog niet beantwoorde plek geen melding.
  const aanHetLezen = huidig.scherm === 'locatie' && isOpen(huidig.loc) && antwoordVan(huidig.loc.id) === null;
  if (positie() && !aanHetLezen && (huidig.scherm === 'kaart' || huidig.scherm === 'locatie')) {
    const hier = huidig.loc ? sleutelVan(huidig.loc) : null;
    // Alle onbezochte plekken waar je nu bent, per gebouw samengenomen.
    const ter = alles.locaties
      .map((id) => inhoud.locaties.get(id))
      .filter((loc) => antwoordVan(loc.id) === null && indicaties.get(loc.id)?.soort === 'er')
      .filter((loc) => sleutelVan(loc) !== hier && !weggetikt.has(sleutelVan(loc)))
      .sort((x, y) => indicaties.get(x.id).meters - indicaties.get(y.id).meters); // dichtstbijzijnde eerst
    if (ter.length) {
      const eerste = ter[0];
      const zelfde = ter.filter((loc) => sleutelVan(loc) === sleutelVan(eerste));
      const gebouw = eerste.gebouw ? inhoud.gebouwen.get(eerste.gebouw) : null;
      doel = {
        sleutel: sleutelVan(eerste),
        id: eerste.id,
        naam: gebouw?.naam ?? eerste.titel,
        // Uitnodigen, niet opdragen: een vraag wekt nieuwsgierigheid en laat de keuze bij de wandelaar.
        vraag: zelfde.length > 1 ? `Benieuwd naar de ${zelfde.length} verhalen?` : 'Benieuwd naar het verhaal?',
        // Zelfde sleutel als kaart.js gebruikt (groepeer): het gebouw, of 'los-<id>' voor een plek zonder bekend gebouw.
        kaartId: gebouw ? gebouw.id : `los-${eerste.id}`,
      };
    }
  }
  if (!doel) {
    langsSleutel = null;
    langsDoel = null;
    vak.hidden = true;
    markeerPlek(null);
    kondigAan('');
    werkVoetBij();
    return;
  }
  langsDoel = doel;
  if (doel.sleutel === langsSleutel && !vak.hidden) return; // niets veranderd: niet opnieuw voorlezen of laten oplichten
  langsSleutel = doel.sleutel;
  $('langs-naam').textContent = doel.naam;
  $('langs-vraag').textContent = doel.vraag;
  vak.hidden = false;
  markeerPlek(doel.kaartId); // de plek licht op de kaart kort op en blijft daarna iets dikker omrand
  kondigAan(`Je loopt langs ${doel.naam}. ${doel.vraag} Onderin staan de knoppen Bekijk en Verder lopen.`);
  werkVoetBij();
}

// Schermlezers: de tekst gaat naar een live regio die altijd in de pagina staat (index.html).
// Eerst leegmaken en pas daarna vullen, zodat dezelfde zin bij een volgende plek opnieuw wordt voorgelezen.
// De focus wordt niet verplaatst: de wandelaar wordt niet uit zijn bezigheid gehaald.
let aankondigTimer = null;
function kondigAan(tekst) {
  const regio = $('langs-aankondiging');
  clearTimeout(aankondigTimer);
  regio.textContent = '';
  if (tekst) aankondigTimer = setTimeout(() => { regio.textContent = tekst; }, 150);
}

$('langs-bekijk').addEventListener('click', () => {
  if (!langsDoel) return;
  const id = langsDoel.id;
  $('langs').hidden = true;
  markeerPlek(null);
  kondigAan('');
  werkVoetBij();
  ga(`#/plek/${id}`);
});
$('langs-verder').addEventListener('click', () => {
  if (langsDoel) weggetikt.add(langsDoel.sleutel);
  werkLangsBij(); // eventueel meldt zich een andere plek waar je ook bent
  el.hoofdknop.focus({ preventScroll: true });
});

// Tik op een gebouw: één verhaal -> direct openen; meer verhalen -> kiezen.
function kiesGebouw(groep) {
  if (groep.locaties.length === 1) return ga(`#/plek/${groep.locaties[0].id}`);
  $('gebouwkeuze-titel').textContent = `${groep.gebouw.naam}: ${groep.locaties.length} verhalen`;
  const lijst = $('gebouwkeuze-lijst');
  lijst.replaceChildren(...groep.locaties.map((loc) => plekKnop(loc)));
  // Paneel onderin over de kaart (zoals een kaart-app): de kaart blijft zichtbaar.
  gpsPaneelOpen = false;
  vulKaartGps();
  $('gebouwkeuze').hidden = false;
  $('gebouwkeuze-titel').focus({ preventScroll: true });
}

// ---------- Panelen en knoppen op de kaart ----------

let gpsPaneelOpen = false;

// Locatie-uitleg op de kaart: pas zichtbaar na een tik op de locatieknop (eerst uitleg, dan pas toestemming vragen).
function vulKaartGps() {
  const paneel = $('gps-kaart');
  const knop = $('locatieknop');
  const zonderKaart = $('kaartvak').classList.contains('kaartvak--zonder');
  vulGpsPaneel(paneel);
  const kanIets = !paneel.hidden; // vulGpsPaneel verbergt het paneel als er niets te melden is
  knop.hidden = !kanIets;
  knop.classList.toggle('locatieknop--aan', gpsStatus() === 'aan');
  knop.setAttribute('aria-label', gpsStatus() === 'aan' ? 'Mijn locatie (staat aan)' : 'Mijn locatie');
  if (!zonderKaart) {
    const sluit = maak('button', 'kaartpaneel__sluit', '×');
    sluit.type = 'button';
    sluit.setAttribute('aria-label', 'Sluiten');
    sluit.addEventListener('click', () => { gpsPaneelOpen = false; vulKaartGps(); knop.focus(); });
    const kop = maak('div', 'kaartpaneel__kop');
    kop.append(paneel.firstChild, sluit); // eerste regel tekst naast de sluitknop
    paneel.prepend(kop);
    paneel.hidden = !kanIets || !gpsPaneelOpen;
  }
  knop.setAttribute('aria-expanded', String(!paneel.hidden));
}

function sluitKaartpanelen() {
  $('gebouwkeuze').hidden = true;
  if (gpsPaneelOpen) { gpsPaneelOpen = false; vulKaartGps(); }
}

$('locatieknop').addEventListener('click', () => {
  $('gebouwkeuze').hidden = true;
  if (gpsStatus() === 'aan' && positie()) centreer(positie());
  gpsPaneelOpen = !gpsPaneelOpen;
  vulKaartGps();
});
$('gebouwkeuze-sluit').addEventListener('click', () => {
  $('gebouwkeuze').hidden = true;
  $('wijkkaart').focus?.();
});
$('kaartvak').addEventListener('keydown', (e) => {
  if (e.key === 'Escape') sluitKaartpanelen();
});
$('lijstgreep').addEventListener('click', () => {
  $('lijstdeel').scrollIntoView({ behavior: scrolGedrag(), block: 'start' });
  $('lijstdeel').focus({ preventScroll: true });
});

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
  $('dichtbij').hidden = true;
  $('mijlpaal').hidden = true;
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
    // Lezen en antwoorden is nu de taak: geen rode knop die de aandacht trekt.
    // Terug kan altijd met de pijl in de kopbalk (of de terugknop van de telefoon).
    // Na het antwoord verschijnt "Terug naar de kaart" wel (zie toonUitslag).
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
  if (!antwoordZichtbaar()) return toonBewaard(loc, keuze, knoppen, net);
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

  // Feedback: bij een fout antwoord het hele goede antwoord noemen, niet alleen de letter
  // (dan hoef je niet terug te scrollen om te zien wat "B" was). Daarna één zin uitleg.
  const fb = $('feedback');
  fb.className = `feedback ${goed ? 'feedback--goed' : 'feedback--fout'}`;
  const delen = [maak('strong', 'feedback__kop', goed ? '✓ Goed!' : '✗ Helaas, dat is niet goed.')];
  if (!goed) {
    const juist = maak('span', 'feedback__juist', 'Het goede antwoord is ');
    juist.append(maak('strong', '', `${LETTERS[loc.juist]}: ${loc.opties[loc.juist]}`));
    delen.push(juist);
  }
  delen.push(maak('span', 'feedback__uitleg', loc.uitleg));
  fb.replaceChildren(...delen);
  fb.hidden = false;
  if (net) toonMijlpaal(loc);
  toonDichtbij(loc, net);
  if (net) {
    // In beeld houden: je eigen keuze, het goede antwoord én de uitleg.
    // Past dat niet op het scherm, dan gaat de uitleg voor.
    // Is er nog een verhaal bij hetzelfde gebouw, dan moet ook die knop (in de mijlpaal) boven de voetbalk
    // staan, anders zie je hem over het hoofd. Volgorde: alles in beeld; anders uitleg + mijlpaal; anders de uitleg.
    const bovenste = knoppen[Math.min(keuze, loc.juist)];
    const mijlpaal = $('mijlpaal');
    const vervolg = !mijlpaal.hidden && mijlpaal.querySelector('.mijlpaal__lijst');
    requestAnimationFrame(() => {
      const kop = el.kop.getBoundingClientRect().bottom;
      const voet = el.voet.hidden ? innerHeight : el.voet.getBoundingClientRect().top;
      const ruimte = voet - kop - 24;
      const onderkant = (vervolg ? mijlpaal : fb).getBoundingClientRect().bottom;
      if (onderkant - bovenste.getBoundingClientRect().top <= ruimte) {
        bovenste.scrollIntoView({ behavior: scrolGedrag(), block: 'start' });
      } else if (vervolg && onderkant - fb.getBoundingClientRect().top <= ruimte) {
        scrollBy({ top: onderkant - (voet - 12), behavior: scrolGedrag() }); // mijlpaal net boven de voetbalk
      } else {
        fb.scrollIntoView({ behavior: scrolGedrag(), block: 'start' });
      }
    });
  }

  werkLangsBij();

  // Geen voorgeschreven volgende plek: de wandelaar kiest zelf uit "Ook in de buurt" of de kaart.
  const klaar = aantalOntdekt();
  zetHoofdknop(klaar === alles.locaties.length ? 'Alles ontdekt! Bekijk de kaart' : 'Terug naar de kaart', () => ga('#/kaart'));
}

// Antwoorden aan het eind (menu): alleen laten zien welk antwoord je koos, niet of het goed is.
// Zo valt er onderweg niets over te nemen; de uitleg volgt in "Mijn antwoorden" (uitgestelde feedback).
function toonBewaard(loc, keuze, knoppen, net) {
  knoppen.forEach((knop, i) => {
    knop.disabled = true;
    if (i === keuze) {
      knop.classList.add('optie--gekozen');
      knop.append(maak('span', 'optie__icoon', '●'));
      knop.setAttribute('aria-label', `${LETTERS[i]}: ${loc.opties[i]}, jouw antwoord`);
    }
  });
  const fb = $('feedback');
  fb.className = 'feedback feedback--bewaard';
  const wanneer = heeftDoel()
    ? `als je ${plekken(doelAantal())} hebt ontdekt`
    : `als je alle ${alles.locaties.length} plekken hebt ontdekt`;
  fb.replaceChildren(
    maak('strong', 'feedback__kop', '✓ Antwoord bewaard'),
    maak('span', 'feedback__uitleg', `Of het goed is, zie je in "Mijn antwoorden" ${wanneer}.`),
  );
  fb.hidden = false;
  if (net) toonMijlpaal(loc);
  toonDichtbij(loc, net);
  if (net) {
    // In beeld: je keuze, de melding en de mijlpaal. Past dat niet, dan de melding bovenaan.
    requestAnimationFrame(() => {
      const kop = el.kop.getBoundingClientRect().bottom;
      const voet = el.voet.hidden ? innerHeight : el.voet.getBoundingClientRect().top;
      const onder = ($('mijlpaal').hidden ? fb : $('mijlpaal')).getBoundingClientRect().bottom;
      const boven = knoppen[keuze].getBoundingClientRect().top;
      (onder - boven <= voet - kop - 24 ? knoppen[keuze] : fb).scrollIntoView({ behavior: scrolGedrag(), block: 'start' });
    });
  }
  werkLangsBij();
  zetHoofdknop('Terug naar de kaart', () => ga('#/kaart'));
}

// Direct na een antwoord: wat dit toevoegt aan je verzameling (ook bij een fout antwoord telt de plek).
// Bij een gebouw met meer verhalen: hoeveel je er nu hebt, of dat het gebouw compleet is.
function toonMijlpaal(loc) {
  const p = $('mijlpaal');
  const t = loc.gebouw ? gebouwTellingen().find((g) => g.sleutel === loc.gebouw) : null;
  const klaar = aantalOntdekt();
  const doel = heeftDoel() ? doelAantal() : null;
  const doelNetGehaald = doel !== null && klaar === doel;
  let tekst;
  if (klaar === alles.locaties.length) tekst = `✓ Je hebt alle ${klaar} plekken ontdekt!`;
  else if (doelNetGehaald) tekst = `✓ Doel gehaald! Je hebt ${plekken(doel)} ontdekt.`;
  else if (t && t.totaal > 1 && t.klaar === t.totaal) tekst = `✓ Alle ${t.totaal} verhalen bij ${t.naam} ontdekt!`;
  else if (t && t.totaal > 1) tekst = `${t.naam}: ${t.klaar} van ${t.totaal} verhalen ontdekt.`;
  else if (doel && klaar < doel) tekst = `Plek ontdekt! ${klaar} van ${doel}.`;
  else tekst = `Plek ontdekt! Je hebt er nu ${klaar}.`;
  // Altijd een beloning: elke ontdekte plek telt, ook bij een fout antwoord (verzamelen, geen score).
  if (!tekst.startsWith('✓')) tekst = `✓ ${tekst}`;
  const balk = maak('div', 'voortgang mijlpaal__balk');
  balk.setAttribute('aria-hidden', 'true');
  balk.append(...Array.from({ length: balkDelen(klaar) }, (_, i) => maak('span',
    i < klaar - 1 ? 'voortgang__deel voortgang__deel--klaar'
      : i === klaar - 1 ? 'voortgang__deel voortgang__deel--klaar voortgang__deel--nieuw' : 'voortgang__deel')));
  const extra = [];
  // Antwoorden aan het eind: nu het doel gehaald is, kun je ze allemaal bekijken.
  if (instellingen().antwoorden === 'eind' && (doelNetGehaald || klaar === alles.locaties.length)) {
    const link = maak('a', 'mijlpaal__knop', 'Bekijk al je antwoorden');
    link.href = '#/antwoorden';
    extra.push(link);
  }
  p.replaceChildren(maak('p', 'mijlpaal__tekst', tekst), balk, ...extra, ...overigeVerhalen(loc));
  p.classList.toggle('mijlpaal--af', klaar === alles.locaties.length || doelNetGehaald || (t && t.totaal > 1 && t.klaar === t.totaal));
  p.hidden = false;
}

// Nog niet beantwoorde verhalen bij hetzelfde gebouw, direct onder de mijlpaal ("1 van 2 verhalen"),
// zodat je het tweede verhaal niet over het hoofd ziet (en het onaf-gevoel meteen een uitweg heeft).
function overigeVerhalen(loc) {
  if (!loc.gebouw) return [];
  const overig = alles.locaties
    .filter((id) => id !== loc.id && antwoordVan(id) === null)
    .map((id) => inhoud.locaties.get(id))
    .filter((ander) => ander.gebouw === loc.gebouw);
  if (!overig.length) return [];
  const naam = inhoud.gebouwen.get(loc.gebouw)?.naam ?? '';
  const lijst = maak('ul', 'lijst mijlpaal__lijst');
  lijst.append(...overig.map((ander) => plekKnop(ander, 'Ook bij dit gebouw')));
  return [maak('p', 'mijlpaal__vervolg', overig.length === 1 ? `Nog 1 verhaal bij ${naam}:` : `Nog ${overig.length} verhalen bij ${naam}:`), lijst];
}

// Afstand tussen twee plekken zonder GPS: van de rand van het ene gebouw tot de rand van het andere.
// De omtrek (Kadaster of eigen 'vorm') is betrouwbaarder dan het coördinaat van een plek, dat nog
// voorlopig kan zijn. Zonder bekende omtrek valt de app terug op het coördinaat.
function afstandTussen(a, b) {
  const vormA = a.gebouw ? bekendeVorm(a.gebouw) : null;
  const vormB = b.gebouw ? bekendeVorm(b.gebouw) : null;
  const puntA = [a.positie.lat, a.positie.lng];
  const puntB = [b.positie.lat, b.positie.lng];
  if (vormA && vormB) {
    // Kleinste afstand tussen twee omtrekken: van elke hoek van de één tot de rand van de ander, en andersom.
    let kleinste = Infinity;
    for (const p of vormA) kleinste = Math.min(kleinste, afstandTot(p, { vorm: vormB }));
    for (const p of vormB) kleinste = Math.min(kleinste, afstandTot(p, { vorm: vormA }));
    return kleinste;
  }
  if (vormB) return afstandTot(puntA, { vorm: vormB });
  if (vormA) return afstandTot(puntB, { vorm: vormA });
  return afstandTot(puntA, { punt: puntB });
}

// Na een antwoord een paar onbezochte plekken bij andere gebouwen als keuze aanbieden, plus de kaart (hoofdknop).
// Direct na het antwoord staan andere verhalen bij hetzelfde gebouw al in de mijlpaal (zie overigeVerhalen());
// kom je later terug op deze plek (geen mijlpaal), dan staan ze hier bovenaan.
// Daarna de dichtstbijzijnde plekken:
//   met GPS: gemeten vanaf je eigen positie;  zonder GPS: van gebouw tot gebouw (zie afstandTussen).
async function toonDichtbij(loc, inMijlpaal) {
  const vak = $('dichtbij');
  const metGps = Boolean(positie());
  if (!metGps) {
    // Omtrekken nodig voor afstandTussen(). Meestal al bekend (kaart of eerder bezoek, bewaard op het toestel);
    // anders even wachten op het Kadaster, maar nooit langer dan anderhalve seconde.
    const nodig = [...inhoud.gebouwen.values()].filter((g) => !bekendeVorm(g.id) && (g.adres || g.vorm));
    if (nodig.length) {
      await Promise.race([
        Promise.allSettled(nodig.map((g) => vormVan(g))),
        new Promise((klaar) => { setTimeout(klaar, 1500); }),
      ]);
      if (huidig.loc !== loc) return; // inmiddels naar een ander scherm
    }
  }
  const kandidaten = alles.locaties
    .filter((id) => id !== loc.id && antwoordVan(id) === null)
    .filter((id) => !inMijlpaal || !loc.gebouw || inhoud.locaties.get(id).gebouw !== loc.gebouw)
    .map((id) => {
      const ander = inhoud.locaties.get(id);
      const zelfdeGebouw = Boolean(loc.gebouw) && ander.gebouw === loc.gebouw;
      const meters = metGps
        ? indicaties.get(id)?.meters ?? Infinity
        : afstandTussen(loc, ander);
      return { ander, zelfdeGebouw, meters };
    })
    .sort((x, y) => (y.zelfdeGebouw - x.zelfdeGebouw) || (x.meters - y.meters))
    // Echte keuze in richting: van elk ander gebouw maar één plek.
    .filter(({ ander, zelfdeGebouw }, _, lijst) => zelfdeGebouw || !ander.gebouw
      || lijst.find((k) => !k.zelfdeGebouw && k.ander.gebouw === ander.gebouw).ander === ander)
    .slice(0, KEUZES_NA_ANTWOORD);

  if (!kandidaten.length) {
    // Alleen nog verhalen bij dit gebouw over? Die staan al in de mijlpaal.
    if (alles.locaties.some((id) => antwoordVan(id) === null)) { vak.hidden = true; return; }
    vak.replaceChildren(maak('p', 'dichtbij__klaar', 'Je hebt alle plekken ontdekt. Knap gedaan!'));
    vak.hidden = false;
    return;
  }
  const lijst = maak('ul', 'lijst');
  for (const { ander, zelfdeGebouw, meters } of kandidaten) {
    let sub;
    if (zelfdeGebouw) sub = 'Ook bij dit gebouw';
    else if (metGps) sub = afstandTekst(ander) ?? ander.adres;
    else sub = Number.isFinite(meters) && meters >= 1 ? `${indicatie(meters, 0, 0).tekst} vanaf hier` : 'Vlakbij';
    lijst.append(plekKnop(ander, sub));
  }
  vak.replaceChildren(maak('h2', 'tussenkop', 'Ook in de buurt'), lijst);
  vak.hidden = false;
}

// ---------- Menu ----------
// Keuzes gelden direct (zoals de instellingen van een telefoon) en blijven op dit toestel.

const menuForm = $('menu-form');

function menuScherm() {
  toonScherm('menu', 'Menu');
  huidig = { scherm: 'menu', loc: null };
  zetHoofdknop('Klaar', sluitMenu);
  const i = instellingen();
  const totaal = alles.locaties.length;
  const standaard = inhoud.instellingen.ontgrendelen;
  menuForm.elements.openen.value = openenModus();
  for (const s of document.querySelectorAll('[data-standaard]')) s.hidden = s.dataset.standaard !== standaard;
  menuForm.elements.doel.value = i.doel === null ? 'geen' : 'eigen';
  $('doel-aantal').max = String(totaal);
  $('doel-aantal').value = String(i.doel === null ? Math.min(10, totaal) : Math.min(i.doel, totaal));
  $('doel-bereik').textContent = `(1 tot ${totaal})`;
  $('doel-aantal-vak').hidden = i.doel === null;
  menuForm.elements.antwoorden.value = i.antwoorden;
  menuForm.elements.taal.value = i.taal;
  $('info-aantal').textContent = `Er zijn nu ${totaal} plekken met een verhaal.`;
}

function sluitMenu() {
  // Terug naar waar je was; geopend via een link (geen geschiedenis): naar de kaart.
  if (history.length > 1 && huidig.scherm === 'menu') history.back();
  else ga('#/kaart');
}

function bewaarDoel() {
  const totaal = alles.locaties.length;
  const getal = Math.round(Number($('doel-aantal').value));
  const doel = Number.isFinite(getal) ? Math.min(Math.max(getal, 1), totaal) : Math.min(10, totaal);
  $('doel-aantal').value = String(doel);
  // Doel = alle plekken is hetzelfde als geen doel, maar we bewaren wat de gebruiker koos.
  zetInstelling('doel', doel);
}

menuForm.addEventListener('change', (e) => {
  const veld = e.target;
  if (veld.name === 'openen') {
    // Gelijk aan de SHSEL-standaard: niets vastzetten, dan volgt dit toestel de SHSEL als die later wijzigt.
    zetInstelling('openen', veld.value === inhoud.instellingen.ontgrendelen ? null : veld.value);
    werkTestUitlegBij();
  } else if (veld.name === 'doel') {
    $('doel-aantal-vak').hidden = veld.value !== 'eigen';
    if (veld.value === 'eigen') bewaarDoel();
    else zetInstelling('doel', null);
  } else if (veld.id === 'doel-aantal') {
    bewaarDoel();
  } else if (veld.name === 'antwoorden' || veld.name === 'taal') {
    zetInstelling(veld.name, veld.value);
  }
});
menuForm.addEventListener('submit', (e) => e.preventDefault()); // Enter in het getalveld

// De menuknop is een gewone link naar #/menu. Op het menu zelf sluit hij het menu.
$('menuknop').addEventListener('click', (e) => {
  if (huidig.scherm !== 'menu') return;
  e.preventDefault();
  sluitMenu();
});

// Testfase en "Overal": één zin op het startscherm (het label "Test" in de kop volgt de SHSEL).
function werkTestUitlegBij() {
  const uitleg = $('test-uitleg');
  uitleg.hidden = terPlekkeModus();
  uitleg.replaceChildren(maak('strong', '', 'Alle vragen zijn open,'), ' ook als je niet ter plekke bent. Dit kun je wijzigen in het menu rechtsboven.');
}

// ---------- Mijn antwoorden ----------

function antwoordenScherm() {
  toonScherm('antwoorden', 'Mijn antwoorden');
  huidig = { scherm: 'antwoorden', loc: null };
  zetHoofdknop('Terug naar de kaart', () => ga('#/kaart'));
  const ontdekt = alles.locaties
    .map((id) => inhoud.locaties.get(id))
    .filter((loc) => antwoordVan(loc.id) !== null)
    .sort((x, y) => x.titel.localeCompare(y.titel, 'nl'));
  const zichtbaar = antwoordZichtbaar();
  const intro = $('antwoorden-intro');
  if (!ontdekt.length) intro.textContent = 'Je hebt nog geen vragen beantwoord. Kies een plek op de kaart.';
  else if (!zichtbaar) {
    const doel = doelAantal();
    intro.textContent = `Je hebt ${ontdekt.length} van de ${doel} plekken ontdekt. `
      + `De goede antwoorden en de uitleg zie je hier als je ${heeftDoel() ? 'je doel hebt gehaald' : 'alle plekken hebt ontdekt'}.`;
  } else intro.textContent = `Je hebt ${plekken(ontdekt.length)} ontdekt. Hieronder staan je antwoorden met uitleg.`;

  $('antwoorden-lijst').replaceChildren(...ontdekt.map((loc) => {
    const keuze = antwoordVan(loc.id);
    const goed = keuze === loc.juist;
    const li = maak('li', zichtbaar ? `antwoord ${goed ? 'antwoord--goed' : 'antwoord--fout'}` : 'antwoord');
    const titel = maak('a', 'antwoord__titel', loc.titel);
    titel.href = `#/plek/${loc.id}`;
    li.append(maak('h2', 'antwoord__kop'), maak('p', 'antwoord__vraag', loc.vraag));
    li.firstChild.append(titel);
    const jouw = maak('p', 'antwoord__jouw');
    if (zichtbaar) jouw.append(maak('strong', 'antwoord__icoon', goed ? '✓ Goed: ' : '✗ Jouw antwoord: '));
    else jouw.append(maak('strong', '', 'Jouw antwoord: '));
    jouw.append(`${LETTERS[keuze]}: ${loc.opties[keuze]}`);
    li.append(jouw);
    if (zichtbaar && !goed) {
      const juist = maak('p', 'antwoord__juist');
      juist.append(maak('strong', '', 'Goed antwoord: '), `${LETTERS[loc.juist]}: ${loc.opties[loc.juist]}`);
      li.append(juist);
    }
    if (zichtbaar && loc.uitleg) li.append(maak('p', 'antwoord__uitleg', loc.uitleg));
    return li;
  }));
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

  if (pagina === 'kaart') return kaartScherm(); // roept zelf werkLangsBij aan
  if (pagina === 'menu') { menuScherm(); return werkLangsBij(); }
  if (pagina === 'antwoorden') { antwoordenScherm(); return werkLangsBij(); }
  if (pagina === 'plek') {
    const loc = inhoud.locaties.get(id);
    if (!loc) return location.replace('#/kaart');
    locatieScherm(loc);
    return werkLangsBij();
  }
  startScherm();
  return werkLangsBij();
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
    if (statusAnders) {
      // Locatie net gevonden: paneel dicht en de kaart naar je toe (alleen als je in Enschede bent).
      if (gpsStatus() === 'aan' && p) { gpsPaneelOpen = false; centreer(p); }
      vulKaartGps();
    }
    if (!lijstMetAfstand || !positie()) {
      vulPlekken(); // eerste bruikbare meting (of locatie uit): één keer opnieuw indelen
    } else {
      for (const sub of document.querySelectorAll('#plekken [data-afstand]')) {
        const loc = inhoud.locaties.get(sub.dataset.afstand);
        if (loc) sub.textContent = afstandTekst(loc) ?? loc.adres;
      }
    }
    toonPositie(p);
  } else if (huidig.scherm === 'locatie' && $('slot').hidden === false) {
    if (isOpen(huidig.loc)) {
      locatieScherm(huidig.loc, { netOpen: true });
    } else {
      $('slot-afstand').textContent = afstandTekst(huidig.loc) ?? '';
      if (statusAnders) vulGpsPaneel($('gps-locatie'));
    }
  }
  werkLangsBij();
});

$('opnieuw-knop').addEventListener('click', () => {
  const open = $('opnieuw-vraag').hidden;
  $('opnieuw-vraag').hidden = !open;
  $('opnieuw-knop').setAttribute('aria-expanded', String(open));
  if (open) {
    // Zorg dat de vraag boven de vaste voetbalk staat.
    const onder = $('opnieuw-vraag').getBoundingClientRect().bottom;
    const voet = el.voet.getBoundingClientRect().top;
    if (onder > voet - 12) window.scrollBy({ top: onder - voet + 12, behavior: scrolGedrag() });
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

// Hoogte van kop- en voetbalk doorgeven aan de CSS, zodat de kaart precies het scherm ertussen vult.
// De voetbalk verandert van hoogte (bijv. "Je loopt langs …"), daarom meten we doorlopend.
const balkMeter = new ResizeObserver(() => {
  const stijl = document.documentElement.style;
  stijl.setProperty('--kop-h', `${el.kop.offsetHeight}px`);
  stijl.setProperty('--voet-h', `${el.voet.hidden ? 0 : el.voet.offsetHeight}px`);
});
balkMeter.observe(el.kop);
balkMeter.observe(el.voet);

async function start() {
  startScherm();
  try {
    inhoud = await laadInhoud('nl');
    if (!inhoud.locaties.size) throw new Error('Geen plekken gevonden');
    // Alle geldige plekken samen; routes uit de inhoud worden (nog) niet gebruikt.
    alles = { id: 'alles', locaties: [...inhoud.locaties.keys()] };
    // Testfase (SHSEL-instelling "overal"): label "Test" in de kop. De zin op het startscherm volgt
    // de keuze in het menu (niet in de voetbalk: die ruimte is voor knoppen).
    const testfase = inhoud.instellingen.ontgrendelen === 'overal';
    $('kop-test').hidden = !testfase;
    if (testfase) $('kop-test').title = 'Testversie van de Enschede app';
    werkTestUitlegBij();
    navigeer();
    hervatAlsToegestaan();
  } catch (fout) {
    console.error(fout);
    zetHoofdknop(null);
    toonFout('De inhoud kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.');
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // Een app op de telefoon wordt vaak uit de achtergrond hervat zonder te herladen.
      // Kijk dan of er een nieuwe versie is.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') reg.update().catch(() => {});
      });
    }).catch((fout) => console.warn('Offline werken niet beschikbaar:', fout));
    // Nieuwe versie actief? Niet midden in het lezen herladen, maar bij de volgende schermwissel.
    // (Voortgang staat in localStorage en het scherm in de URL, dus er gaat niets verloren.)
    const hadVersie = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadVersie) return; // eerste bezoek: er draait al de nieuwste code
      addEventListener('hashchange', () => location.reload(), { once: true });
    });
  }
}

start();
