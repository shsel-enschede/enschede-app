// Enschede app — schermen en navigatie.
// Uitgangspunt: wandelen zonder vaste volgorde. De wandelaar kiest zelf (zie CLAUDE.md, "Vrij ontdekken").
// Navigatie via het adres (#/kaart, #/plek/...) zodat de terugknop van de telefoon werkt.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { laadInhoud } from './inhoud.js';
import { t, zetTeksten, zetTaal, huidigeTaal, toestelTaal, vergelijk } from './taal.js';
import { antwoordVan, bewaarAntwoord, wisAntwoorden } from './voortgang.js';
import { toonKaart, toonPositie, centreer, markeerPlekken } from './kaart.js';
import { volgende, meldingTekst, voorleestekst } from './langs.js';
import { vormVan, bekendeVorm } from './gebouwen.js';
import { afstandTot, indicatie } from './afstand.js';
import { gpsMogelijk, zetAan, zetUit, positie, gpsStatus, volg, hervatAlsToegestaan } from './locatie.js';
import { maak, scrolGedrag } from './hulp.js';
import { instellingen, zetInstelling } from './instellingen.js';
import { toonFotos, zetFotovensterKlaar, sluitFotovenster } from './fotos.js';
import { volgordeVan, nieuweVolgorde } from './volgorde.js';

const LETTERS = ['A', 'B', 'C', 'D'];

// De antwoorden staan per toestel in een eigen volgorde (zie js/volgorde.js).
// i is altijd het nummer uit de inhoud; de letter hoort bij de plek waar de optie op dit toestel staat.
function letterVan(loc, i) {
  return LETTERS[volgordeVan(loc).indexOf(i)];
}
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
    eind: $('scherm-eind'),
  },
};

// Grens voor de groep "Dichtbij" in de lijst: ca. 5 minuten lopen.
const DICHTBIJ = 400; // meter
// Na een antwoord: zoveel keuzes "Ook in de buurt". Weinig opties = snel kiezen (wet van Hick).
const KEUZES_NA_ANTWOORD = 3;

let inhoud = null;
let allePlekken = []; // alle geldige plekken (objecten uit inhoud.js), in de volgorde van de inhoud
let kaartVerzameling = null; // dezelfde plekken voor kaart.js: { id, locaties: [ids] } (later kan ook een thema of buurt)
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
  const totaal = allePlekken.length;
  return Math.min(instellingen().doel ?? totaal, totaal);
}

function heeftDoel() {
  return instellingen().doel !== null && doelAantal() < allePlekken.length;
}

function doelGehaald() {
  return aantalOntdekt() >= doelAantal();
}

// Goede antwoorden direct tonen, of pas aan het eind (doel gehaald of alles ontdekt).
function antwoordZichtbaar() {
  return instellingen().antwoorden === 'direct' || doelGehaald();
}

/** Ontdekt = de vraag is beantwoord, goed of fout. */
function isOntdekt(loc) {
  return antwoordVan(loc.id) !== null;
}

function isOpen(loc) {
  return !terPlekkeModus() || isOntdekt(loc) || ontgrendeld.has(loc.id);
}

function werkIndicatiesBij() {
  const p = positie();
  if (!p || !inhoud) return;
  for (const loc of allePlekken) {
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
    paneel.append(maak('p', 'gps__tekst', t('gps.geenToestel')));
    return;
  }
  paneel.hidden = false;
  const st = gpsStatus();
  const teksten = {
    uit: t(terPlekkeModus() ? 'gps.uitTerPlekke' : 'gps.uit'),
    zoeken: t('gps.zoeken'),
    aan: t('gps.aan'),
    geweigerd: t('gps.geweigerd'),
    'niet-beschikbaar': t('gps.nietBeschikbaar'),
    fout: t('gps.fout'),
  };
  paneel.append(maak('p', 'gps__tekst', teksten[st] ?? teksten.uit));
  const knop = maak('button', st === 'aan' ? 'gps__knop gps__knop--stil' : 'gps__knop');
  knop.type = 'button';
  if (st === 'aan') {
    knop.textContent = t('gps.knopUit');
    knop.addEventListener('click', () => { zetUit(); toonPositie(null); });
  } else if (st === 'zoeken') {
    return;
  } else {
    knop.textContent = st === 'uit' ? t('gps.knopAan') : t('gps.opnieuw');
    knop.addEventListener('click', zetAan);
  }
  paneel.append(knop);
}

// ---------- Taal ----------
// Zie js/taal.js en CLAUDE.md ("Taal"). Vaste teksten staan in content/teksten.json; in index.html
// wijst data-t (tekst), data-t-label (aria-label) of data-t-alt (alt) naar een tekst daar.

/** Zet alle vaste teksten in de pagina in de huidige taal. */
function vertaalPagina() {
  document.documentElement.lang = huidigeTaal();
  for (const e of document.querySelectorAll('[data-t]')) e.textContent = t(e.dataset.t);
  for (const e of document.querySelectorAll('[data-t-label]')) e.setAttribute('aria-label', t(e.dataset.tLabel));
  for (const e of document.querySelectorAll('[data-t-alt]')) e.alt = t(e.dataset.tAlt);
  $('kop-test').title = t('app.testTitel');
  werkTestUitlegBij();
  werkTaalknoppenBij();
}

/** Tekst die (nog) in een andere taal staat dan de app krijgt lang="..", zodat een schermlezer hem goed uitspreekt (WCAG 3.1.2). */
function zetTaalVan(element, taal) {
  if (taal && taal !== huidigeTaal()) element.lang = taal;
  else element.removeAttribute('lang');
  return element;
}

/** Korte melding boven een verhaal of vraag die nog niet vertaald is. */
function toonVertaalmelding(element, sleutel) {
  element.hidden = !sleutel;
  element.textContent = sleutel ? t(sleutel) : '';
}

function werkTaalknoppenBij() {
  for (const knop of document.querySelectorAll('#talen-start [data-taal]')) {
    knop.setAttribute('aria-pressed', String(knop.dataset.taal === huidigeTaal()));
  }
}

// De gekozen taal, anders die van het toestel.
function gewensteTaal() {
  return instellingen().taal ?? toestelTaal(navigator.languages ?? [navigator.language]);
}

// Wissel van taal: teksten en inhoud opnieuw, en hetzelfde scherm opnieuw opbouwen.
// Voortgang hangt aan plek-id's, niet aan tekst: die blijft gewoon staan.
async function kiesTaal(nieuw) {
  zetInstelling('taal', nieuw);
  if (gewensteTaal() === huidigeTaal()) return werkTaalknoppenBij();
  zetTaal(gewensteTaal());
  vertaalPagina();
  if (!inhoud) return startScherm();
  const terug = { y: scrollY, focus: document.activeElement };
  try {
    zetInhoud(await laadInhoud(huidigeTaal()));
  } catch (fout) {
    console.error(fout); // de oude inhoud blijft staan; de vaste teksten zijn al vertaald
  }
  langsGroepen = [];
  $('langs').hidden = true;
  navigeer();
  // Blijf waar je was (menu of startscherm), met de focus op de taal die je net koos.
  scrollTo(0, terug.y);
  if (terug.focus?.isConnected) terug.focus.focus({ preventScroll: true });
}

for (const knop of document.querySelectorAll('#talen-start [data-taal]')) {
  knop.addEventListener('click', () => kiesTaal(knop.dataset.taal));
}

function toonScherm(naam, titel, { terug = true } = {}) {
  sluitFotovenster();
  for (const [n, s] of Object.entries(el.schermen)) s.hidden = n !== naam;
  el.titel.textContent = titel;
  document.title = naam === 'start' ? t('app.naam') : `${titel} · ${t('app.naam')}`;
  el.terug.hidden = !terug;
  const opMenu = naam === 'menu';
  $('menuknop').classList.toggle('kop__menu--actief', opMenu);
  $('menuknop').setAttribute('aria-label', opMenu ? t('menu.knopSluiten') : t('menu.knop'));
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

const naarKaart = () => ga('#/kaart');

// ---------- Schermen ----------

function startScherm() {
  toonScherm('start', t('app.naam'), { terug: false });
  huidig = { scherm: 'start', loc: null };
  zetHoofdknop(t('start.knop'), naarKaart);
  werkTaalknoppenBij();
}

function aantalOntdekt() {
  return allePlekken.filter(isOntdekt).length;
}

function kaartScherm() {
  toonScherm('kaart', t('kaart.titel'));
  huidig = { scherm: 'kaart', loc: null };
  gpsPaneelOpen = false;
  vulKaartGps();

  const totaal = allePlekken.length;
  const klaar = aantalOntdekt();
  const balk = $('voortgang');
  // Met een doel loopt de balk naar het doel, anders naar alle plekken.
  const delen = balkDelen(klaar);
  balk.setAttribute('aria-valuemax', String(delen));
  balk.setAttribute('aria-valuenow', String(Math.min(klaar, delen)));
  balk.setAttribute('aria-label', t(heeftDoel() ? 'kaart.balkDoel' : 'kaart.balk'));
  // Eén schuin segment per plek, zoals de rode balk onderaan het briefpapier
  balk.replaceChildren(...balkSegmenten(delen, klaar));
  toonOntdekt(klaar, totaal);
  $('antwoorden-link').hidden = klaar === 0;

  vulPlekken();
  zetHoofdknop(null); // op de kaart kiest de wandelaar zelf; bij een plek verschijnt "Je loopt langs …"
  werkLangsBij();

  $('gebouwkeuze').hidden = true;
  if (wachtendeKeuze) { toonKeuze(wachtendeKeuze.titel, wachtendeKeuze.items); wachtendeKeuze = null; }
  $('lijstgreep-tekst').textContent = t('kaart.lijstgreep', { n: totaal });
  toonKaart($('wijkkaart'), kaartVerzameling, inhoud, {
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
  return heeftDoel() ? Math.max(doelAantal(), klaar) : allePlekken.length;
}

// Segmenten van de voortgangsbalk. 'nieuw': het laatste ontdekte segment loopt vol (mijlpaal na een antwoord).
function balkSegmenten(delen, klaar, { nieuw = false } = {}) {
  return Array.from({ length: delen }, (_, i) => {
    let klasse = 'voortgang__deel';
    if (i < klaar) klasse += ' voortgang__deel--klaar';
    if (nieuw && i === klaar - 1) klasse += ' voortgang__deel--nieuw';
    return maak('span', klasse);
  });
}

// Voortgang als verzameling: tel wat je ontdekt hebt, niet wat je nog "moet".
// Een zelfgekozen doel (menu) mag wel: "3 van 24 plekken ontdekt".
// Goed of fout antwoorden maakt niet uit: een plek is ontdekt zodra je de vraag hebt beantwoord.
// Er is bewust geen score (lage drempel, ook voor kinderen; leren gaat voor punten).
function toonOntdekt(klaar, totaal) {
  const tal = $('voortgang-tekst');
  const doel = heeftDoel() ? doelAantal() : null;
  if (klaar === totaal) tal.textContent = t('kaart.allesOntdekt', { n: totaal });
  else if (doel && klaar >= doel) tal.textContent = t('kaart.doelGehaald', { n: klaar });
  else if (doel) tal.textContent = t('kaart.vanDoel', { klaar, doel });
  else if (klaar === 0) tal.textContent = t('kaart.nogNiets');
  else tal.textContent = t('kaart.ontdekt', { n: klaar });
  $('voortgang-totaal').textContent = klaar === totaal ? t('kaart.knap') : t('kaart.inDeStad', { n: totaal });

  // Verzameling van gebouwen waar je iets ontdekt hebt (geen lege vakjes: alleen wat je al hebt).
  const lijst = $('ontdekt-gebouwen');
  const items = gebouwTellingen()
    .filter((g) => g.klaar > 0)
    .sort((x, y) => (y.klaar === y.totaal) - (x.klaar === x.totaal) || vergelijk(x.naam, y.naam))
    .map((g) => {
      const af = g.klaar === g.totaal;
      const li = maak('li', af ? 'ontdekt__gebouw ontdekt__gebouw--af' : 'ontdekt__gebouw',
        `${af ? '✓ ' : ''}${g.naam}${g.totaal > 1 && !af ? ` ${g.klaar}/${g.totaal}` : ''}`);
      if (!af) li.setAttribute('aria-label', t('kaart.gebouwTelling', { naam: g.naam, klaar: g.klaar, totaal: g.totaal }));
      return li;
    });
  lijst.replaceChildren(...items);
  lijst.hidden = !items.length;
}

// Per gebouw (of losse plek): naam, aantal verhalen en aantal ontdekt.
function gebouwTellingen() {
  const map = new Map();
  for (const loc of allePlekken) {
    const sleutel = loc.gebouw ?? `p:${loc.id}`;
    const naam = (loc.gebouw && inhoud.gebouwen.get(loc.gebouw)?.naam) || loc.titel;
    if (!map.has(sleutel)) map.set(sleutel, { sleutel, naam, totaal: 0, klaar: 0 });
    const t = map.get(sleutel);
    t.totaal += 1;
    if (isOntdekt(loc)) t.klaar += 1;
  }
  return [...map.values()];
}

// Eén plek als knop in een lijst. Geen nummers: die suggereren een volgorde.
function plekKnop(loc, vasteSub = null) {
  const bezocht = isOntdekt(loc);
  const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
  knop.type = 'button';
  knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : ''));
  const tekst = maak('span', 'kaart__tekst');
  const titel = maak('span', 'kaart__titel', loc.titel);
  zetTaalVan(titel, loc.titelTaal);
  tekst.append(titel);
  const sub = maak('span', 'kaart__sub', bezocht ? t('lijst.ontdekt') : vasteSub ?? afstandTekst(loc) ?? loc.adres);
  if (!bezocht && !vasteSub) sub.dataset.afstand = loc.id;
  tekst.append(sub);
  knop.append(tekst);
  knop.setAttribute('aria-label', bezocht ? t('lijst.ontdektLabel', { titel: loc.titel }) : loc.titel);
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
  const open = allePlekken.filter((loc) => !isOntdekt(loc));
  const bezocht = allePlekken.filter(isOntdekt);
  const opNaam = (x, y) => vergelijk(x.titel, y.titel);
  const meters = (loc) => indicaties.get(loc.id)?.meters;
  lijstMetAfstand = Boolean(positie()) && open.some((loc) => Number.isFinite(meters(loc)) && indicaties.get(loc.id).soort !== 'onzeker');

  const blokken = [];
  if (lijstMetAfstand) {
    open.sort((x, y) => (meters(x) ?? Infinity) - (meters(y) ?? Infinity));
    blokken.push(...lijstBlok(t('lijst.dichtbij'), open.filter((loc) => meters(loc) <= DICHTBIJ)));
    blokken.push(...lijstBlok(t('lijst.verderWeg'), open.filter((loc) => !(meters(loc) <= DICHTBIJ))));
  } else {
    blokken.push(...lijstBlok(t('lijst.alle'), open.sort(opNaam)));
  }
  blokken.push(...lijstBlok(t('lijst.alOntdekt'), bezocht.sort(opNaam)));
  $('plekken').replaceChildren(...blokken);
}

// ---------- "Je loopt langs …" ----------
// Kom je (met GPS) bij plekken die je nog niet ontdekt hebt, dan verschijnt onderin een rustige melding met
// alleen de knop Bekijk. Liggen er meer plekken binnen de straal (Grote Kerk, zonnewijzer, brandmonument),
// dan staan ze samen in één melding en kies je zelf. Onder het lopen kunnen plekken erbij komen of afvallen;
// de regels daarvoor staan in js/langs.js. Doorlopen hoeft geen keuze te zijn: buiten de straal (plus de marge
// uit afstand.js) verdwijnt een plek vanzelf. Geen knop "Verder lopen" (besluit René, okt 2026).
// Niets wordt bewaard of verstuurd (zie CLAUDE.md, Veiligheid).

let langsGroepen = []; // groepen in de melding, in vaste volgorde: { sleutel, kaartId, naam, verhalen, meters, locaties }
let wachtendeKeuze = null; // keuzelijst die opengaat zodra de kaart in beeld is (Bekijk vanaf een ander scherm)

function sleutelVan(loc) {
  return loc.gebouw ? `g:${loc.gebouw}` : `p:${loc.id}`;
}

// Alle onontdekte plekken waar je nu bent, per gebouw samengenomen.
function groepenBinnenStraal() {
  // Niet storen tijdens het lezen: op een open, nog niet beantwoorde plek geen melding.
  const aanHetLezen = huidig.scherm === 'locatie' && isOpen(huidig.loc) && !isOntdekt(huidig.loc);
  if (!positie() || aanHetLezen || (huidig.scherm !== 'kaart' && huidig.scherm !== 'locatie')) return [];
  const hier = huidig.loc ? sleutelVan(huidig.loc) : null;
  const per = new Map();
  for (const loc of allePlekken) {
    const ind = indicaties.get(loc.id);
    if (isOntdekt(loc) || ind?.soort !== 'er' || sleutelVan(loc) === hier) continue;
    const sleutel = sleutelVan(loc);
    if (!per.has(sleutel)) {
      const gebouw = loc.gebouw ? inhoud.gebouwen.get(loc.gebouw) : null;
      per.set(sleutel, {
        sleutel,
        naam: gebouw?.naam ?? loc.titel,
        // Zelfde sleutel als kaart.js gebruikt (groepeer): het gebouw, of 'los-<id>' voor een plek zonder bekend gebouw.
        kaartId: gebouw ? gebouw.id : `los-${loc.id}`,
        meters: ind.meters,
        locaties: [],
      });
    }
    const g = per.get(sleutel);
    g.locaties.push(loc);
    g.meters = Math.min(g.meters, ind.meters);
  }
  return [...per.values()].map((g) => ({ ...g, verhalen: g.locaties.length }));
}

function werkLangsBij() {
  const vak = $('langs');
  const vorigeAantal = vak.hidden ? 0 : langsGroepen.length;
  const { groepen, erbij } = volgende(vak.hidden ? [] : langsGroepen, groepenBinnenStraal());
  langsGroepen = groepen;
  // Op de kaart: alle plekken uit de melding rood; alleen een nieuwe plek licht even op (zie kaart.js).
  markeerPlekken(groepen.map((g) => g.kaartId));
  if (!groepen.length) {
    vak.hidden = true;
    kondigAan('');
    werkVoetBij();
    return;
  }
  const m = meldingTekst(groepen);
  $('langs-label').textContent = m.label;
  $('langs-naam').textContent = m.naam;
  $('langs-vraag').textContent = m.vraag;
  vak.hidden = false;
  const zeg = voorleestekst(vorigeAantal, groepen, erbij); // alleen bij iets nieuws; afvallen is stil
  if (zeg) kondigAan(zeg);
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

// Bekijk: één verhaal -> direct openen; meer verhalen -> een korte keuzelijst over de kaart.
// De lijst is een momentopname: wat erin staat verandert niet meer, ook niet als je een stap zet.
$('langs-bekijk').addEventListener('click', () => {
  const locaties = langsGroepen.flatMap((g) => g.locaties);
  if (!locaties.length) return;
  $('langs').hidden = true;
  markeerPlekken([]);
  kondigAan('');
  werkVoetBij();
  if (locaties.length === 1) return ga(`#/plek/${locaties[0].id}`);
  const titel = langsGroepen.length === 1
    ? t('lijst.verhalenBij', { naam: langsGroepen[0].naam, n: locaties.length })
    : t('lijst.hierPlekken', { n: langsGroepen.length });
  // Bij een gebouw met meer verhalen staat de naam van het gebouw onder de titel van het verhaal.
  const items = langsGroepen.flatMap((g) => g.locaties.map((loc) => ({ loc, sub: g.locaties.length > 1 && loc.titel !== g.naam ? g.naam : null })));
  if (huidig.scherm === 'kaart') return toonKeuze(titel, items);
  wachtendeKeuze = { titel, items };
  naarKaart();
});

// Tik op een gebouw: één verhaal -> direct openen; meer verhalen -> kiezen.
function kiesGebouw(groep) {
  if (groep.locaties.length === 1) return ga(`#/plek/${groep.locaties[0].id}`);
  toonKeuze(t('lijst.verhalenBij', { naam: groep.gebouw.naam, n: groep.locaties.length }), groep.locaties.map((loc) => ({ loc, sub: null })));
}

// Keuzelijst onderin over de kaart; items: [{ loc, sub }] (sub: vaste tweede regel, anders de afstand).
function toonKeuze(titel, items) {
  $('gebouwkeuze-titel').textContent = titel;
  const lijst = $('gebouwkeuze-lijst');
  lijst.replaceChildren(...items.map(({ loc, sub }) => plekKnop(loc, sub)));
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
  knop.setAttribute('aria-label', t(gpsStatus() === 'aan' ? 'kaart.mijnLocatieAan' : 'kaart.mijnLocatie'));
  if (!zonderKaart) {
    const sluit = maak('button', 'kaartpaneel__sluit', '×');
    sluit.type = 'button';
    sluit.setAttribute('aria-label', t('app.sluiten'));
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
  toonFotos($('locatie-fotos'), loc.fotos, { toegankelijk: isOpen(loc) }); // mozaïek + fotovenster (js/fotos.js)

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
    zetTaalVan($('slot-teaser'), loc.tekstTaal);
    $('slot-afstand').textContent = afstandTekst(loc) ?? '';
    vulGpsPaneel($('gps-locatie'));
    $('feedback').hidden = true;
    zetHoofdknop(t('plek.terugKaart'), naarKaart);
    return;
  }
  $('locatie-tekst').textContent = loc.tekst;
  zetTaalVan($('locatie-tekst'), loc.tekstTaal);
  toonVertaalmelding($('tekst-vertaling'), loc.tekstTaal !== huidigeTaal() && 'plek.nietVertaald');
  $('vraag-tekst').textContent = loc.vraag;
  // De vraag met opties en uitleg is één geheel: helemaal vertaald, of helemaal Nederlands (zie inhoud.js).
  zetTaalVan($('vraag'), loc.vraagTaal);
  zetTaalVan($('feedback'), loc.vraagTaal);
  toonVertaalmelding($('vraag-vertaling'), loc.vraagTaal !== huidigeTaal() && 'plek.vraagNietVertaald');

  const opties = $('vraag-opties');
  opties.replaceChildren();
  // knoppen[i] hoort bij optie i uit de inhoud; op het scherm staan ze in de volgorde van dit toestel.
  const knoppen = [];
  volgordeVan(loc).forEach((i, plek) => {
    const knop = maak('button', 'optie');
    knop.type = 'button';
    knop.append(maak('span', 'optie__letter', LETTERS[plek]), maak('span', '', loc.opties[i]));
    knop.addEventListener('click', () => beantwoord(loc, i, knoppen));
    opties.append(knop);
    knoppen[i] = knop;
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

function beantwoord(loc, keuze, knoppen) {
  if (antwoordVan(loc.id) !== null) return;
  bewaarAntwoord(loc.id, keuze); // automatisch opslaan, geen aparte knop nodig
  toonUitslag(loc, keuze, knoppen, true);
}

// Een antwoordknop na het antwoorden: kleur, icoon (nooit alleen kleur) en een label voor schermlezers.
function markeerOptie(knop, loc, i, soort, icoon, toelichting) {
  knop.classList.add(`optie--${soort}`);
  knop.append(maak('span', 'optie__icoon', icoon));
  knop.setAttribute('aria-label', `${letterVan(loc, i)}: ${loc.opties[i]}, ${toelichting}`);
}

// Ruimte tussen kop- en voetbalk, om te bepalen wat na een antwoord in beeld kan blijven.
function zichtbaarDeel() {
  return {
    kop: el.kop.getBoundingClientRect().bottom,
    voet: el.voet.hidden ? innerHeight : el.voet.getBoundingClientRect().top,
  };
}

function toonUitslag(loc, keuze, knoppen, net) {
  if (!antwoordZichtbaar()) return toonBewaard(loc, keuze, knoppen, net);
  const goed = keuze === loc.juist;
  knoppen.forEach((knop, i) => {
    knop.disabled = true;
    if (i === loc.juist) markeerOptie(knop, loc, i, 'goed', '✓', t('antwoord.labelJuist'));
    else if (i === keuze) markeerOptie(knop, loc, i, 'fout', '✗', t('antwoord.labelFout'));
  });

  // Feedback: bij een fout antwoord het hele goede antwoord noemen, niet alleen de letter
  // (dan hoef je niet terug te scrollen om te zien wat "B" was). Daarna één zin uitleg.
  const fb = $('feedback');
  fb.className = `feedback ${goed ? 'feedback--goed' : 'feedback--fout'}`;
  const delen = [maak('strong', 'feedback__kop', goed ? t('antwoord.goed') : t('antwoord.fout'))];
  if (!goed) {
    const juist = maak('span', 'feedback__juist', t('antwoord.juistIs'));
    juist.append(maak('strong', '', `${letterVan(loc, loc.juist)}: ${loc.opties[loc.juist]}`));
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
    const volgorde = volgordeVan(loc);
    const bovenste = knoppen[volgorde.indexOf(keuze) < volgorde.indexOf(loc.juist) ? keuze : loc.juist];
    const mijlpaal = $('mijlpaal');
    const vervolg = !mijlpaal.hidden && mijlpaal.querySelector('.mijlpaal__lijst');
    requestAnimationFrame(() => {
      const { kop, voet } = zichtbaarDeel();
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
  eindKeuze(net);
}

// Hoofdknop na een antwoord. Net je doel gehaald (of alles ontdekt)? Dan het eindscherm als keuze.
// Niet automatisch erheen: eerst lees je de uitleg bij deze vraag, en "Ook in de buurt" blijft staan
// voor wie verder wil (autonomie). Bij een later bezoek aan deze plek gewoon terug naar de kaart.
function eindKeuze(net) {
  const klaar = aantalOntdekt();
  const netAf = net && (klaar === allePlekken.length || (heeftDoel() && klaar === doelAantal()));
  if (netAf) zetHoofdknop(t('plek.naarEind'), () => ga('#/eind'));
  else zetHoofdknop(t('plek.terugKaart'), naarKaart);
}

// Antwoorden aan het eind (menu): alleen laten zien welk antwoord je koos, niet of het goed is.
// Zo valt er onderweg niets over te nemen; de uitleg volgt in "Mijn antwoorden" (uitgestelde feedback).
function toonBewaard(loc, keuze, knoppen, net) {
  knoppen.forEach((knop, i) => {
    knop.disabled = true;
    if (i === keuze) markeerOptie(knop, loc, i, 'gekozen', '●', t('antwoord.labelGekozen'));
  });
  const fb = $('feedback');
  fb.className = 'feedback feedback--bewaard';
  const wanneer = heeftDoel()
    ? t('antwoord.bewaardDoel', { n: doelAantal() })
    : t('antwoord.bewaardAlles', { n: allePlekken.length });
  fb.replaceChildren(
    maak('strong', 'feedback__kop', t('antwoord.bewaard')),
    maak('span', 'feedback__uitleg', wanneer),
  );
  fb.hidden = false;
  if (net) toonMijlpaal(loc);
  toonDichtbij(loc, net);
  if (net) {
    // In beeld: je keuze, de melding en de mijlpaal. Past dat niet, dan de melding bovenaan.
    requestAnimationFrame(() => {
      const { kop, voet } = zichtbaarDeel();
      const onder = ($('mijlpaal').hidden ? fb : $('mijlpaal')).getBoundingClientRect().bottom;
      const boven = knoppen[keuze].getBoundingClientRect().top;
      (onder - boven <= voet - kop - 24 ? knoppen[keuze] : fb).scrollIntoView({ behavior: scrolGedrag(), block: 'start' });
    });
  }
  werkLangsBij();
  eindKeuze(net);
}

// Direct na een antwoord: wat dit toevoegt aan je verzameling (ook bij een fout antwoord telt de plek).
// Bij een gebouw met meer verhalen: hoeveel je er nu hebt, of dat het gebouw compleet is.
function toonMijlpaal(loc) {
  const p = $('mijlpaal');
  const g = loc.gebouw ? gebouwTellingen().find((x) => x.sleutel === loc.gebouw) : null;
  const klaar = aantalOntdekt();
  const doel = heeftDoel() ? doelAantal() : null;
  const doelNetGehaald = doel !== null && klaar === doel;
  const allesOntdekt = klaar === allePlekken.length;
  let tekst;
  // Altijd een beloning (✓): elke ontdekte plek telt, ook bij een fout antwoord (verzamelen, geen score).
  if (allesOntdekt) tekst = t('mijlpaal.alles', { n: klaar });
  else if (doelNetGehaald) tekst = t('mijlpaal.doel', { n: doel });
  else if (g && g.totaal > 1 && g.klaar === g.totaal) tekst = t('mijlpaal.gebouwAf', { n: g.totaal, naam: g.naam });
  else if (g && g.totaal > 1) tekst = t('mijlpaal.gebouw', { naam: g.naam, klaar: g.klaar, totaal: g.totaal });
  else if (doel && klaar < doel) tekst = t('mijlpaal.vanDoel', { klaar, doel });
  else tekst = t('mijlpaal.ontdekt', { n: klaar });
  const balk = maak('div', 'voortgang mijlpaal__balk');
  balk.setAttribute('aria-hidden', 'true');
  balk.append(...balkSegmenten(balkDelen(klaar), klaar, { nieuw: true }));
  const extra = [];
  // Doel gehaald of alles ontdekt: de hoofdknop wordt "Naar je eindscherm" (zie eindKeuze()).
  if (doelNetGehaald || allesOntdekt) {
    extra.push(maak('p', 'mijlpaal__eind', t('mijlpaal.eind')));
  }
  p.replaceChildren(maak('p', 'mijlpaal__tekst', tekst), balk, ...extra, ...overigeVerhalen(loc));
  p.classList.toggle('mijlpaal--af', allesOntdekt || doelNetGehaald || (g && g.totaal > 1 && g.klaar === g.totaal));
  p.hidden = false;
}

// Nog niet beantwoorde verhalen bij hetzelfde gebouw, direct onder de mijlpaal ("1 van 2 verhalen"),
// zodat je het tweede verhaal niet over het hoofd ziet (en het onaf-gevoel meteen een uitweg heeft).
function overigeVerhalen(loc) {
  if (!loc.gebouw) return [];
  const overig = allePlekken.filter((ander) => ander !== loc && !isOntdekt(ander) && ander.gebouw === loc.gebouw);
  if (!overig.length) return [];
  const naam = inhoud.gebouwen.get(loc.gebouw)?.naam ?? '';
  const lijst = maak('ul', 'lijst mijlpaal__lijst');
  lijst.append(...overig.map((ander) => plekKnop(ander, t('plek.ookGebouw'))));
  return [maak('p', 'mijlpaal__vervolg', t('mijlpaal.nogVerhalen', { n: overig.length, naam })), lijst];
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
  const kandidaten = allePlekken
    .filter((ander) => ander !== loc && !isOntdekt(ander))
    .map((ander) => {
      const zelfdeGebouw = Boolean(loc.gebouw) && ander.gebouw === loc.gebouw;
      const meters = metGps
        ? indicaties.get(ander.id)?.meters ?? Infinity
        : afstandTussen(loc, ander);
      return { ander, zelfdeGebouw, meters };
    })
    .filter(({ zelfdeGebouw }) => !inMijlpaal || !zelfdeGebouw) // die staan al in de mijlpaal
    .sort((x, y) => (y.zelfdeGebouw - x.zelfdeGebouw) || (x.meters - y.meters))
    // Echte keuze in richting: van elk ander gebouw maar één plek.
    .filter(({ ander, zelfdeGebouw }, _, lijst) => zelfdeGebouw || !ander.gebouw
      || lijst.find((k) => !k.zelfdeGebouw && k.ander.gebouw === ander.gebouw).ander === ander)
    .slice(0, KEUZES_NA_ANTWOORD);

  if (!kandidaten.length) {
    // Alleen nog verhalen bij dit gebouw over? Die staan al in de mijlpaal.
    if (allePlekken.some((ander) => !isOntdekt(ander))) { vak.hidden = true; return; }
    vak.replaceChildren(maak('p', 'dichtbij__klaar', t('dichtbij.alles')));
    vak.hidden = false;
    return;
  }
  const lijst = maak('ul', 'lijst');
  for (const { ander, zelfdeGebouw, meters } of kandidaten) {
    let sub;
    if (zelfdeGebouw) sub = t('plek.ookGebouw');
    else if (metGps) sub = afstandTekst(ander) ?? ander.adres;
    else sub = Number.isFinite(meters) && meters >= 1 ? t('afstand.vanafHier', { afstand: indicatie(meters, 0, 0).tekst }) : t('afstand.vlakbij');
    lijst.append(plekKnop(ander, sub));
  }
  vak.replaceChildren(maak('h2', 'tussenkop', t('dichtbij.kop')), lijst);
  vak.hidden = false;
}

// ---------- Menu ----------
// Keuzes gelden direct (zoals de instellingen van een telefoon) en blijven op dit toestel.

const menuForm = $('menu-form');

function menuScherm() {
  toonScherm('menu', t('menu.titel'));
  huidig = { scherm: 'menu', loc: null };
  zetHoofdknop(t('menu.klaar'), sluitMenu);
  const i = instellingen();
  const totaal = allePlekken.length;
  const standaard = inhoud.instellingen.ontgrendelen;
  menuForm.elements.openen.value = openenModus();
  for (const s of document.querySelectorAll('[data-standaard]')) s.hidden = s.dataset.standaard !== standaard;
  menuForm.elements.doel.value = i.doel === null ? 'geen' : 'eigen';
  $('doel-aantal').max = String(totaal);
  $('doel-aantal').value = String(i.doel === null ? Math.min(10, totaal) : Math.min(i.doel, totaal));
  $('doel-bereik').textContent = t('menu.bereik', { n: totaal });
  $('doel-aantal-vak').hidden = i.doel === null;
  menuForm.elements.antwoorden.value = i.antwoorden;
  menuForm.elements.taal.value = huidigeTaal();
  $('info-aantal').textContent = t('menu.aantalNu', { n: totaal });
  $('info-vertaling').hidden = !t('menu.vertaling');

  // Opnieuw beginnen: alleen zichtbaar als er iets te wissen is; bevestiging in de pagina zelf.
  const klaar = aantalOntdekt();
  $('menu-eind').hidden = klaar === 0;
  $('opnieuw').hidden = klaar === 0;
  $('opnieuw-uitleg').textContent = t('menu.opnieuwUitleg', { n: klaar });
  $('opnieuw-vraag').hidden = true;
  $('opnieuw-knop').setAttribute('aria-expanded', 'false');
  $('opnieuw-klaar').hidden = true;
}

function sluitMenu() {
  // Terug naar waar je was; geopend via een link (geen geschiedenis): naar de kaart.
  if (history.length > 1 && huidig.scherm === 'menu') history.back();
  else naarKaart();
}

function bewaarDoel() {
  const totaal = allePlekken.length;
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
  } else if (veld.name === 'antwoorden') {
    zetInstelling(veld.name, veld.value);
  } else if (veld.name === 'taal') {
    kiesTaal(veld.value);
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
  uitleg.replaceChildren(maak('strong', '', t('start.testVet')), t('start.testRest'));
}

// ---------- Mijn antwoorden ----------

function antwoordenScherm() {
  toonScherm('antwoorden', t('antwoorden.titel'));
  huidig = { scherm: 'antwoorden', loc: null };
  zetHoofdknop(t('plek.terugKaart'), naarKaart);
  const ontdekt = allePlekken
    .filter(isOntdekt)
    .sort((x, y) => vergelijk(x.titel, y.titel));
  const zichtbaar = antwoordZichtbaar();
  const intro = $('antwoorden-intro');
  if (!ontdekt.length) intro.textContent = t('antwoorden.geen');
  else if (!zichtbaar) {
    intro.textContent = t(heeftDoel() ? 'antwoorden.wachtDoel' : 'antwoorden.wachtAlles', { klaar: ontdekt.length, doel: doelAantal() });
  } else intro.textContent = t('antwoorden.intro', { n: ontdekt.length });

  $('antwoorden-lijst').replaceChildren(...ontdekt.map((loc) => {
    const keuze = antwoordVan(loc.id);
    const goed = keuze === loc.juist;
    const li = maak('li', zichtbaar ? `antwoord ${goed ? 'antwoord--goed' : 'antwoord--fout'}` : 'antwoord');
    const titel = maak('a', 'antwoord__titel', loc.titel);
    titel.href = `#/plek/${loc.id}`;
    zetTaalVan(titel, loc.titelTaal);
    const vraag = maak('p', 'antwoord__vraag', loc.vraag);
    zetTaalVan(vraag, loc.vraagTaal);
    li.append(maak('h2', 'antwoord__kop'), vraag);
    li.firstChild.append(titel);
    const jouw = maak('p', 'antwoord__jouw');
    if (zichtbaar) jouw.append(maak('strong', 'antwoord__icoon', goed ? t('antwoorden.goed') : t('antwoorden.jouwFout')));
    else jouw.append(maak('strong', '', t('antwoorden.jouw')));
    jouw.append(`${letterVan(loc, keuze)}: ${loc.opties[keuze]}`);
    li.append(jouw);
    if (zichtbaar && !goed) {
      const juist = maak('p', 'antwoord__juist');
      juist.append(maak('strong', '', t('antwoorden.juist')), `${letterVan(loc, loc.juist)}: ${loc.opties[loc.juist]}`);
      li.append(juist);
    }
    if (zichtbaar && loc.uitleg) li.append(maak('p', 'antwoord__uitleg', loc.uitleg));
    // Antwoorden en uitleg in de taal van de vraag (lang="nl" als de vraag nog niet vertaald is).
    for (const regel of li.querySelectorAll('.antwoord__jouw, .antwoord__juist, .antwoord__uitleg')) zetTaalVan(regel, loc.vraagTaal);
    return li;
  }));
}

// ---------- Eindscherm ----------
// Samenvatting om positief af te sluiten (piek-eindregel): wat je ontdekt hebt, een bedankje,
// de SHSEL voor wie meer wil weten, en de keuze om verder te gaan.
// Het aantal goede antwoorden staat er alleen als de antwoorden al zichtbaar mogen zijn
// (bij "Aan het eind" pas als het doel gehaald is), zodat er onderweg niets over te nemen valt.
// Elders in de app bewust geen score: dit is het enige moment, en dan als resultaat om te laten zien.

function eindScherm() {
  toonScherm('eind', t('eind.titel'));
  huidig = { scherm: 'eind', loc: null };
  const totaal = allePlekken.length;
  const ontdekt = allePlekken.filter(isOntdekt).sort((x, y) => vergelijk(x.titel, y.titel));
  const klaar = ontdekt.length;
  const doel = heeftDoel() ? doelAantal() : null;
  const af = klaar === totaal;
  const doelGehaald = doel !== null && klaar >= doel;

  let kop;
  let tal;
  if (af) {
    kop = t('eind.allesKop');
    tal = t('eind.alles', { n: totaal });
  } else if (doelGehaald) {
    kop = t('eind.doelKop');
    tal = klaar > doel ? t('eind.meerDanDoel', { n: klaar, doel }) : t('eind.ontdekt', { n: klaar });
  } else if (klaar === 0) {
    kop = t('eind.wandelingKop');
    tal = t('eind.niets');
  } else {
    kop = t('eind.totNuKop');
    tal = doel ? t('eind.vanDoel', { klaar, doel }) : t('eind.vanTotaal', { n: klaar, totaal });
  }
  $('eind-kop').textContent = kop;
  $('eind-tal').textContent = tal;
  $('eind-vak').classList.toggle('eind__vak--af', af || doelGehaald);
  $('eind-balk').replaceChildren(...balkSegmenten(balkDelen(klaar), klaar));
  $('eind-balk').hidden = klaar === 0;

  // Aantal goede antwoorden: alleen als de antwoorden zichtbaar mogen zijn.
  const score = $('eind-score');
  score.hidden = !(klaar > 0 && antwoordZichtbaar());
  if (!score.hidden) {
    const goed = ontdekt.filter((loc) => antwoordVan(loc.id) === loc.juist).length;
    // Positief geformuleerd: wat je wist, niet wat fout ging. De uitleg bij elke vraag staat in "Mijn antwoorden".
    score.textContent = goed === klaar ? t('eind.allesGoed', { n: klaar }) : t('eind.score', { goed, n: klaar });
  }

  // Namen van de ontdekte plekken.
  $('eind-lijst-kop').textContent = t('eind.lijstKop', { n: klaar });
  $('eind-lijst-kop').hidden = klaar === 0;
  $('eind-lijst').hidden = klaar === 0;
  $('eind-lijst').replaceChildren(...ontdekt.map((loc) => zetTaalVan(maak('li', 'eind__plek', loc.titel), loc.titelTaal)));
  $('eind-antwoorden-link').parentElement.hidden = klaar === 0;
  $('eind-antwoorden-link').textContent = t(antwoordZichtbaar() ? 'eind.bekijkUitleg' : 'eind.bekijk');

  // Keuze om verder te gaan; bij alles ontdekt is er niets meer te ontdekken.
  zetHoofdknop(t(af ? 'plek.terugKaart' : 'eind.verder'), naarKaart);
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
  if (pagina === 'eind') { eindScherm(); return werkLangsBij(); }
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
  wisAntwoorden(allePlekken.map((loc) => loc.id));
  nieuweVolgorde(); // opnieuw beginnen = ook de antwoorden in een nieuwe volgorde
  ontgrendeld.clear();
  // Blijf in het menu (zoals bij de instellingen van een telefoon) en bevestig op dezelfde plek.
  $('opnieuw').hidden = true;
  $('menu-eind').hidden = true;
  $('opnieuw-klaar').hidden = false;
  $('opnieuw-klaar').focus({ preventScroll: true });
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

// Inhoud van de huidige taal in gebruik nemen.
function zetInhoud(nieuw) {
  if (!nieuw.locaties.size) throw new Error('Geen plekken gevonden');
  inhoud = nieuw;
  // Alle geldige plekken samen; routes uit de inhoud worden (nog) niet gebruikt.
  allePlekken = [...inhoud.locaties.values()];
  // De taal hoort bij de verzameling: na een taalwissel tekent de kaart de namen opnieuw.
  kaartVerzameling = { id: `alles-${huidigeTaal()}`, locaties: allePlekken.map((loc) => loc.id) };
}

async function laadTeksten() {
  const antwoord = await fetch('content/teksten.json', { cache: 'no-cache' });
  if (!antwoord.ok) throw new Error(`Teksten niet gevonden (${antwoord.status})`);
  if (!zetTeksten(await antwoord.json())) throw new Error('Teksten ongeldig');
}

async function start() {
  zetFotovensterKlaar();
  try {
    await laadTeksten();
  } catch (fout) {
    // Zonder teksten kan de app niets zeggen. De Nederlandse teksten in index.html blijven staan.
    console.error(fout);
    toonFout('De app kon niet worden geladen. Controleer je internetverbinding en probeer het opnieuw.');
    $('hoofdknop').hidden = true;
    return;
  }
  zetTaal(gewensteTaal());
  vertaalPagina();
  startScherm();
  try {
    zetInhoud(await laadInhoud(huidigeTaal()));
    // Testfase (SHSEL-instelling "overal"): label "Test" in de kop. De zin op het startscherm volgt
    // de keuze in het menu (niet in de voetbalk: die ruimte is voor knoppen).
    $('kop-test').hidden = inhoud.instellingen.ontgrendelen !== 'overal';
    werkTestUitlegBij();
    navigeer();
    hervatAlsToegestaan();
  } catch (fout) {
    console.error(fout);
    zetHoofdknop(null);
    toonFout(t('app.ladenMislukt'));
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
