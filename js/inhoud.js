// Laadt en controleert de inhoud uit content/locaties.json.
// De inhoud wordt behandeld als onbetrouwbare data: alleen geldige locaties komen in de app.

const ID_PATROON = /^[a-z0-9-]{1,60}$/;

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

function leesGebouwen(lijst) {
  const gebouwen = new Map();
  for (const g of Array.isArray(lijst) ? lijst : []) {
    if (!ID_PATROON.test(g?.id ?? '') || !isTekst(g?.naam, 80)) {
      console.warn(`Gebouw "${g?.id}" overgeslagen: id of naam ongeldig`);
      continue;
    }
    const adres = isTekst(g.adres, 120) && /\d/.test(g.adres) ? g.adres : null;
    const vorm = leesVorm(g.vorm);
    if (g.vorm !== undefined && !vorm) console.warn(`Gebouw "${g.id}": vorm ongeldig, wordt genegeerd`);
    const naamPlek = NAAMPLEKKEN.includes(g.naamPlek) ? g.naamPlek : null;
    if (g.naamPlek !== undefined && !naamPlek) console.warn(`Gebouw "${g.id}": naamPlek ongeldig, wordt genegeerd`);
    gebouwen.set(g.id, { id: g.id, naam: g.naam, adres, vorm, naamPlek });
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
        alt: isTekst(f.alt?.[taal], 300) ? f.alt[taal] : '',
        bijschrift: isTekst(f.bijschrift?.[taal], 300) ? f.bijschrift[taal] : '',
        bron: [f.bron, f.documentnummer].filter((x) => isTekst(x, 100)).join(', '),
      });
    }
  } catch (fout) {
    console.warn('Foto-lijst niet geladen:', fout); // de app werkt ook zonder foto's
  }
  return fotos;
}

export async function laadInhoud(taal = 'nl') {
  const antwoord = await fetch('content/locaties.json', { cache: 'no-cache' });
  if (!antwoord.ok) throw new Error(`Inhoud niet gevonden (${antwoord.status})`);
  const data = await antwoord.json();
  const fotos = await laadFotos(taal);

  const locaties = new Map();
  for (const loc of Array.isArray(data.locaties) ? data.locaties : []) {
    const fouten = controleerLocatie(loc, taal);
    if (fouten.length) {
      console.warn(`Locatie "${loc?.id}" overgeslagen:`, fouten.join(', '));
      continue;
    }
    locaties.set(loc.id, {
      id: loc.id,
      nummer: loc.nummer,
      titel: loc.titel[taal],
      adres: typeof loc.adres === 'string' ? loc.adres.slice(0, 120) : '',
      positie: { lat: loc.positie.lat, lng: loc.positie.lng },
      tekst: loc.tekst[taal],
      vraag: loc.vraag[taal].tekst,
      opties: loc.vraag[taal].opties.slice(),
      uitleg: isTekst(loc.vraag[taal].uitleg, 500) ? loc.vraag[taal].uitleg : '',
      juist: loc.juist,
      gebouw: typeof loc.gebouw === 'string' && ID_PATROON.test(loc.gebouw) ? loc.gebouw : null,
      fotos: (Array.isArray(loc.fotos) ? loc.fotos : []).map((id) => fotos.get(id)).filter(Boolean),
    });
  }

  const routes = new Map();
  for (const r of Array.isArray(data.routes) ? data.routes : []) {
    if (!ID_PATROON.test(r?.id ?? '') || !isTekst(r?.titel?.[taal], 120) || !Array.isArray(r.locaties)) {
      console.warn(`Route "${r?.id}" overgeslagen`);
      continue;
    }
    const ids = r.locaties.filter((id) => locaties.has(id));
    if (!ids.length) continue;
    routes.set(r.id, {
      id: r.id,
      titel: r.titel[taal],
      intro: isTekst(r.intro?.[taal], 500) ? r.intro[taal] : '',
      locaties: ids,
    });
  }

  return { routes, locaties, gebouwen: leesGebouwen(data.gebouwen), instellingen: leesInstellingen(data.instellingen) };
}
