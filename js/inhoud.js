// Laadt en controleert de inhoud uit content/locaties.json.
// De inhoud wordt behandeld als onbetrouwbare data: alleen geldige locaties komen in de app.

const ID_PATROON = /^[a-z0-9-]{1,60}$/;

function isTekst(waarde, max = 5000) {
  return typeof waarde === 'string' && waarde.trim().length > 0 && waarde.length <= max;
}

function isGetal(waarde, min, max) {
  return typeof waarde === 'number' && Number.isFinite(waarde) && waarde >= min && waarde <= max;
}

function controleerLocatie(loc, taal) {
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

export async function laadInhoud(taal = 'nl') {
  const antwoord = await fetch('content/locaties.json', { cache: 'no-cache' });
  if (!antwoord.ok) throw new Error(`Inhoud niet gevonden (${antwoord.status})`);
  const data = await antwoord.json();

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

  return { routes, locaties };
}
