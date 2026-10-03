// Enschede app — schermen en navigatie.
// Navigatie via het adres (#/route/...) zodat de terugknop van de telefoon werkt.
// Inhoud wordt alleen met textContent op het scherm gezet, nooit met innerHTML (zie CLAUDE.md).

import { laadInhoud } from './inhoud.js';
import { antwoordVan, bewaarAntwoord } from './voortgang.js';

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
  zetHoofdknop('Begin', () => ga('#/routes'));
}

function routesScherm() {
  toonScherm('routes', 'Kies een route');
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
  $('route-intro').textContent = route.intro;

  const totaal = route.locaties.length;
  const klaar = route.locaties.filter((id) => antwoordVan(id) !== null).length;
  const balk = $('voortgang');
  balk.setAttribute('aria-valuemax', String(totaal));
  balk.setAttribute('aria-valuenow', String(klaar));
  balk.setAttribute('aria-label', 'Voortgang van de route');
  $('voortgang-balk').style.width = `${Math.round((klaar / totaal) * 100)}%`;
  $('voortgang-tekst').textContent =
    klaar === totaal ? `Route voltooid: alle ${totaal} plekken bezocht!` : `${klaar} van ${totaal} plekken bezocht`;

  const lijst = $('locatie-lijst');
  lijst.replaceChildren();
  route.locaties.forEach((id, i) => {
    const loc = inhoud.locaties.get(id);
    const bezocht = antwoordVan(id) !== null;
    const knop = maak('button', bezocht ? 'kaart kaart--bezocht' : 'kaart');
    knop.type = 'button';
    knop.append(maak('span', 'kaart__nr', bezocht ? '✓' : String(i + 1)));
    const tekst = maak('span', 'kaart__tekst');
    tekst.append(maak('span', 'kaart__titel', loc.titel));
    tekst.append(maak('span', 'kaart__sub', bezocht ? 'Bezocht' : loc.adres));
    knop.append(tekst);
    knop.setAttribute('aria-label', `${i + 1}. ${loc.titel}${bezocht ? ', bezocht' : ''}`);
    knop.addEventListener('click', () => ga(`#/route/${route.id}/${id}`));
    const li = maak('li');
    li.append(knop);
    lijst.append(li);
  });

  const volgende = route.locaties.find((id) => antwoordVan(id) === null);
  zetHoofdknop(volgende ? 'Naar de volgende plek' : null, () => ga(`#/route/${route.id}/${volgende}`));
}

function locatieScherm(route, loc) {
  toonScherm('locatie', loc.titel);
  $('locatie-adres').textContent = loc.adres;
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
  const index = route.locaties.indexOf(loc.id);
  const volgendeId = route.locaties.slice(index + 1).concat(route.locaties.slice(0, index))
    .find((id) => antwoordVan(id) === null);
  if (volgendeId) {
    const volgende = inhoud.locaties.get(volgendeId);
    zetHoofdknop(`Volgende: ${volgende.titel}`, () => ga(`#/route/${route.id}/${volgendeId}`));
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
    navigeer();
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
