// Laadt en controleert de inhoud uit content/locaties.json.
// De inhoud wordt behandeld als onbetrouwbare data: alleen geldige locaties komen in de app.

import { ID_PATROON, heeftHuisnummer, vertaalbron, vingerafdruk } from './hulp.js';

function isTekst(waarde, max = 5000) {
  return typeof waarde === 'string' && waarde.trim().length > 0 && waarde.length <= max;
}

function isGetal(waarde, min, max) {
  return typeof waarde === 'number' && Number.isFinite(waarde) && waarde >= min && waarde <= max;
}

export function controleerLocatie(loc, taal) {
  const fouten = [];
  if (!loc || typeof loc !== 'object') return ['geen object'];
  if (!ID_PATROON.test(loc.id ?? '')) fouten.push('ongeldige id');
  if (!isGetal(loc.nummer, 1, 999)) fouten.push('ongeldig nummer');
  if (!isTekst(loc.titel?.[taal], 120)) fouten.push('titel ontbreekt');
  if (!isTekst(loc.tekst?.[taal])) fouten.push('tekst ontbreekt');
  const p = loc.positie;
  if (!p || !isGetal(p.lat, 52.1, 52.35) || !isGetal(p.lng, 6.7, 7.05)) fouten.push('positie ligt niet in Enschede');
  const v = loc.vraag?.[taal];
  if (!isTekst(v?.tekst, 500)) fouten.push('vraag ontbreekt');
  if (!Array.isArray(v?.opties) || v.opties.length < 2 || v.opties.length > 4 || !v.opties.every((o) => isTekst(o, 200))) {
    fouten.push('opties ongeldig (2 tot 4 nodig)');
  }
  if (!Number.isInteger(loc.juist) || loc.juist < 0 || loc.juist >= (v?.opties?.length ?? 0)) fouten.push('juist antwoord ongeldig');
  return fouten;
}

// Gebouwen worden op de kaart ingekleurd. 'adres' moet een huisnummer hebben (voor het Kadaster);
// 'vorm' is optioneel: een eigen omtrek als lijst van [lat, lng].
function leesVorm(vorm) {
  if (!Array.isArray(vorm) || vorm.length < 3 || vorm.length > 500) return null;
  const ok = vorm.every((p) => Array.isArray(p) && p.length === 2 && isGetal(p[0], 52.1, 52.35) && isGetal(p[1], 6.7, 7.05));
  return ok ? vorm.map(([lat, lng]) => [lat, lng]) : null;
}

// Waar de naam van een gebouw op de kaart mag staan (zie ontwar() in kaart.js).
const NAAMPLEKKEN = ['midden', 'boven', 'onder', 'rechts', 'links'];

// Vertaalde naam van een gebouw voor de kaart (optioneel): naamVertaald = { en, de, bron }.
// 'bron' is de vingerafdruk van de Nederlandse naam. Verandert die naam (bijv. in de editor), dan klopt 'bron'
// niet meer en toont de app de Nederlandse naam tot de vertaling is bijgewerkt. Eigennamen hebben geen vertaling.
function vertaaldeNaam(g, taal) {
  const v = g.naamVertaald;
  if (taal === 'nl' || !v || v.bron !== vingerafdruk(g.naam) || !isTekst(v[taal], 80)) return g.naam;
  return v[taal];
}

function leesGebouwen(lijst, taal) {
  const gebouwen = new Map();
  for (const g of Array.isArray(lijst) ? lijst : []) {
    if (!ID_PATROON.test(g?.id ?? '') || !isTekst(g?.naam, 80)) {
      console.warn(`Gebouw "${g?.id}" overgeslagen: id of naam ongeldig`);
      continue;
    }
    const adres = isTekst(g.adres, 120) && heeftHuisnummer(g.adres) ? g.adres : null;
    const vorm = leesVorm(g.vorm);
    if (g.vorm !== undefined && !vorm) console.warn(`Gebouw "${g.id}": vorm ongeldig, wordt genegeerd`);
    const naamPlek = NAAMPLEKKEN.includes(g.naamPlek) ? g.naamPlek : null;
    if (g.naamPlek !== undefined && !naamPlek) console.warn(`Gebouw "${g.id}": naamPlek ongeldig, wordt genegeerd`);
    gebouwen.set(g.id, { id: g.id, naam: vertaaldeNaam(g, taal), adres, vorm, naamPlek });
  }
  return gebouwen;
}

// Instellingen die de SHSEL beheert. Bij twijfel de veilige standaard.
//   ontgrendelen: "overal" (testfase: vragen overal te beantwoorden) of "ter-plekke" (alleen in de buurt, met GPS)
//   straal: binnen hoeveel meter van het gebouw "ter plekke" telt (30 tot 40 m afgesproken; toegestaan 20 tot 60)
function leesInstellingen(i) {
  const instellingen = { ontgrendelen: 'ter-plekke', straal: 35 };
  if (i?.ontgrendelen === 'overal' || i?.ontgrendelen === 'ter-plekke') instellingen.ontgrendelen = i.ontgrendelen;
  else if (i?.ontgrendelen !== undefined) console.warn('Instelling "ontgrendelen" ongeldig, standaard "ter-plekke" gebruikt');
  if (isGetal(i?.straal, 20, 60)) instellingen.straal = i.straal;
  else if (i?.straal !== undefined) console.warn('Instelling "straal" ongeldig (20 tot 60), standaard 35 gebruikt');
  return instellingen;
}

// Foto's uit content/fotos.json. Alleen foto's met een bestand én geregelde rechten komen in de app.
const BESTAND_PATROON = /^[a-z0-9][a-z0-9-]{0,80}\.(webp|jpg|jpeg)$/;

// Lokale proefversie: alleen op je eigen computer (localhost) toont de app ook foto's waarvan de
// rechten nog niet geregeld zijn. Die staan in de map 'fotos-lokaal/'. Die map staat in .gitignore:
// hij komt nooit op GitHub en dus nooit op de live site. Zie fotos-lokaal-LEESMIJ.md.
export const LOKAAL = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

export function geldigBestand(naam) {
  return typeof naam === 'string' && BESTAND_PATROON.test(naam);
}

async function laadFotos(taal) {
  const fotos = new Map();
  try {
    const antwoord = await fetch('content/fotos.json', { cache: 'no-cache' });
    if (!antwoord.ok) return fotos;
    const data = await antwoord.json();
    for (const f of Array.isArray(data.fotos) ? data.fotos : []) {
      if (!ID_PATROON.test(f?.id ?? '')) continue;
      let src = null;
      let proef = false;
      if (f.rechten_geregeld === true && geldigBestand(f.bestand)) {
        src = `fotos/${f.bestand}`;
      } else if (LOKAAL) {
        const naam = geldigBestand(f.bestand) ? f.bestand : f.bestand_klaar;
        if (geldigBestand(naam)) {
          src = `fotos-lokaal/${naam}`;
          proef = true;
        }
      }
      if (!src) continue;
      fotos.set(f.id, {
        id: f.id,
        src,
        proef,
        // Nog niet vertaald: de Nederlandse tekst (beter dan geen beschrijving).
        alt: [taal, 'nl'].map((t) => f.alt?.[t]).find((x) => isTekst(x, 300)) ?? '',
        bijschrift: [taal, 'nl'].map((t) => f.bijschrift?.[t]).find((x) => isTekst(x, 300)) ?? '',
        bron: [f.bron, f.documentnummer].filter((x) => isTekst(x, 100)).join(', '),
        maker: isTekst(f.bron, 100) ? f.bron : '', // alleen de bron zelf (bijv. SHSEL), voor de regel onder het mozaïek
      });
    }
  } catch (fout) {
    console.warn('Foto-lijst niet geladen:', fout); // de app werkt ook zonder foto's
  }
  return fotos;
}

// Vertaalde tekst, of de Nederlandse als die in deze taal ontbreekt. Geeft { tekst, taal }.
// 'taal' in het antwoord zegt in welke taal de tekst echt is (voor lang="nl" en de melding "nog niet vertaald").
function vertaald(veld, taal, max) {
  if (taal !== 'nl' && isTekst(veld?.[taal], max)) return { tekst: veld[taal], taal };
  return { tekst: veld.nl, taal: 'nl' };
}

// De vraag in deze taal: alleen als vraagtekst én alle opties vertaald zijn, het aantal opties gelijk is
// aan het Nederlands ('juist' geldt voor alle talen), en de vertaling bij de huidige Nederlandse vraag hoort.
// Anders de Nederlandse vraag: een half vertaalde of verouderde vraag kan een fout antwoord opleveren
// (CLAUDE.md, Meertaligheid). Verouderd = de vingerafdruk in 'vertaling' klopt niet meer met het Nederlands.
function vertaaldeVraag(loc, taal, bron) {
  const vraag = loc.vraag;
  const v = vraag?.[taal];
  const actueel = loc.vertaling?.[taal]?.vraag === bron.vraag;
  const ok = taal !== 'nl' && actueel && isTekst(v?.tekst, 500) && Array.isArray(v?.opties)
    && v.opties.length === vraag.nl.opties.length && v.opties.every((o) => isTekst(o, 200));
  if (taal !== 'nl' && v && !ok) console.info(`Vraag van "${loc.id}" (${taal}) niet vertaald of verouderd: Nederlands getoond`);
  return ok ? { ...v, taal } : { ...vraag.nl, taal: 'nl' };
}

export async function laadInhoud(taal = 'nl') {
  const antwoord = await fetch('content/locaties.json', { cache: 'no-cache' });
  if (!antwoord.ok) throw new Error(`Inhoud niet gevonden (${antwoord.status})`);
  const data = await antwoord.json();
  const fotos = await laadFotos(taal);

  const locaties = new Map();
  let concepten = 0;
  for (const loc of Array.isArray(data.locaties) ? data.locaties : []) {
    // Een concept (nog zonder verhaal of vraag) staat alleen in de beheerpagina, niet in de app.
    if (loc?.concept === true) { concepten += 1; continue; }
    // Nederlands is de brontaal en altijd nodig; Engels en Duits vallen terug op Nederlands.
    const fouten = controleerLocatie(loc, 'nl');
    if (fouten.length) {
      console.warn(`Locatie "${loc?.id}" overgeslagen:`, fouten.join(', '));
      continue;
    }
    const titel = vertaald(loc.titel, taal, 120);
    const tekst = vertaald(loc.tekst, taal, 5000);
    const vraag = vertaaldeVraag(loc, taal, vertaalbron(loc));
    locaties.set(loc.id, {
      id: loc.id,
      nummer: loc.nummer,
      titel: titel.tekst,
      titelTaal: titel.taal,
      adres: typeof loc.adres === 'string' ? loc.adres.slice(0, 120) : '',
      positie: { lat: loc.positie.lat, lng: loc.positie.lng },
      tekst: tekst.tekst,
      tekstTaal: tekst.taal,
      vraag: vraag.tekst,
      opties: vraag.opties.slice(),
      uitleg: isTekst(vraag.uitleg, 500) ? vraag.uitleg : '',
      vraagTaal: vraag.taal,
      juist: loc.juist,
      gebouw: typeof loc.gebouw === 'string' && ID_PATROON.test(loc.gebouw) ? loc.gebouw : null,
      fotos: (Array.isArray(loc.fotos) ? loc.fotos : []).map((id) => fotos.get(id)).filter(Boolean),
    });
  }

  if (concepten) console.info(`${concepten} plekken zijn nog concept en staan niet in de app.`);

  // Alleen gebouwen van plekken die in de app staan. Zo zoekt de app geen omtrekken op in het Kadaster
  // voor gebouwen die niemand ziet (scheelt verzoeken aan PDOK bij veel gelijktijdige gebruikers).
  const inGebruik = new Set([...locaties.values()].map((l) => l.gebouw).filter(Boolean));
  const gebouwen = leesGebouwen((Array.isArray(data.gebouwen) ? data.gebouwen : []).filter((g) => inGebruik.has(g?.id)), taal);

  // 'routes' in de inhoud wordt nu niet gebruikt (vrij ontdekken, zie CLAUDE.md). Komen thema- of buurtroutes
  // terug, lees ze dan hier in; de oude code staat in de geschiedenis van dit bestand op GitHub.
  return { locaties, gebouwen, instellingen: leesInstellingen(data.instellingen) };
}
