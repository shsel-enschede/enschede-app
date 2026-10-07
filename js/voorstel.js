// Rekenwerk voor voorstellen uit de editor, zonder scherm en zonder netwerk (los te testen).
// - beschrijf(): wat is er veranderd, in gewone taal, per plek en per gebouw.
// - voegSamen(): jouw wijzigingen samenvoegen met wat intussen op GitHub is veranderd (per plek en per gebouw).
// - toestand(): in welke stap een voorstel zit (Wacht op collega, Opmerking, Bij beheerder, Live).

const LETTERS = ['A', 'B', 'C', 'D'];
const TALEN = { nl: 'NL', en: 'EN', de: 'DE' };

/** JSON met gesorteerde sleutels: twee objecten met dezelfde inhoud in een andere volgorde zijn gelijk. */
export function vast(waarde) {
  if (Array.isArray(waarde)) return `[${waarde.map(vast).join(',')}]`;
  if (waarde && typeof waarde === 'object') {
    return `{${Object.keys(waarde).filter((k) => waarde[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${vast(waarde[k])}`).join(',')}}`;
  }
  return JSON.stringify(waarde ?? null);
}
const gelijk = (a, b) => vast(a) === vast(b);

function meters(a, b) {
  const r = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(h));
}

const perId = (lijst) => new Map((Array.isArray(lijst) ? lijst : []).filter((x) => x?.id).map((x) => [x.id, x]));

function plekNaam(loc) { return `Plek ${loc?.nummer ?? '?'} · ${loc?.titel?.nl ?? loc?.id ?? 'zonder naam'}`; }
function gebouwNaam(g) { return `Gebouw ${g?.naam || g?.id || 'zonder naam'}`; }

function tekstVelden(oud, nieuw, veld, label, regels) {
  for (const taal of Object.keys(TALEN)) {
    if (!gelijk(oud?.[veld]?.[taal], nieuw?.[veld]?.[taal])) {
      regels.push(`${label} (${TALEN[taal]}) ${oud?.[veld]?.[taal] ? (nieuw?.[veld]?.[taal] ? 'gewijzigd' : 'verwijderd') : 'toegevoegd'}`);
    }
  }
}

function beschrijfPlek(oud, nieuw, gebouwen, fotoNaam) {
  const regels = [];
  const pOud = oud.positie ?? {};
  const pNieuw = nieuw.positie ?? {};
  if (pOud.lat !== pNieuw.lat || pOud.lng !== pNieuw.lng) {
    const m = Number.isFinite(pOud.lat) && Number.isFinite(pNieuw.lat) ? Math.round(meters(pOud, pNieuw)) : null;
    regels.push(m === null ? 'positie gekozen' : `positie verschoven (ca. ${m} m)`);
  }
  if (Boolean(pOud.bevestigd) !== Boolean(pNieuw.bevestigd)) {
    regels.push(pNieuw.bevestigd ? 'positie ter plekke gecontroleerd' : 'positie niet meer als gecontroleerd gemarkeerd');
  }
  if (oud.gebouw !== nieuw.gebouw) {
    const naam = (id) => (id ? (gebouwen.get(id)?.naam || id) : 'geen gebouw');
    regels.push(`hoort nu bij ${naam(nieuw.gebouw)} (was: ${naam(oud.gebouw)})`);
  }
  const fOud = Array.isArray(oud.fotos) ? oud.fotos : [];
  const fNieuw = Array.isArray(nieuw.fotos) ? nieuw.fotos : [];
  for (const id of fNieuw.filter((x) => !fOud.includes(x))) regels.push(`foto toegevoegd: ${fotoNaam(id)}`);
  for (const id of fOud.filter((x) => !fNieuw.includes(x))) regels.push(`foto weggehaald: ${fotoNaam(id)}`);
  if (fNieuw[0] && fNieuw[0] !== fOud[0]) regels.push(`hoofdfoto is nu: ${fotoNaam(fNieuw[0])}`);
  else if (fNieuw.length && !fNieuw.some((x) => !fOud.includes(x)) && !gelijk(fOud.filter((x) => fNieuw.includes(x)), fNieuw)) {
    regels.push('volgorde van de foto\'s gewijzigd');
  }
  tekstVelden(oud, nieuw, 'titel', 'titel', regels);
  tekstVelden(oud, nieuw, 'tekst', 'verhaal', regels);
  for (const taal of Object.keys(TALEN)) {
    const a = oud.vraag?.[taal] ?? {};
    const b = nieuw.vraag?.[taal] ?? {};
    if (!gelijk(a.tekst, b.tekst) || !gelijk(a.opties, b.opties)) regels.push(`vraag of antwoordkeuzes (${TALEN[taal]}) gewijzigd`);
    if (!gelijk(a.uitleg, b.uitleg)) regels.push(`uitleg na het antwoord (${TALEN[taal]}) gewijzigd`);
  }
  if (oud.juist !== nieuw.juist) regels.push(`goede antwoord is nu ${LETTERS[nieuw.juist] ?? '?'} (was ${LETTERS[oud.juist] ?? '?'})`);
  if (Boolean(oud.bevestigd) !== Boolean(nieuw.bevestigd)) {
    regels.push(nieuw.bevestigd ? 'antwoord bevestigd door SHSEL' : 'antwoord niet meer als bevestigd gemarkeerd');
  }
  const bekend = new Set(['id', 'positie', 'gebouw', 'fotos', 'titel', 'tekst', 'vraag', 'juist', 'bevestigd']);
  for (const k of new Set([...Object.keys(oud), ...Object.keys(nieuw)])) {
    if (!bekend.has(k) && !gelijk(oud[k], nieuw[k])) regels.push(`${k} gewijzigd`);
  }
  return regels;
}

function beschrijfGebouw(oud, nieuw) {
  const regels = [];
  if (oud.naam !== nieuw.naam) regels.push(`naam op de kaart: ${nieuw.naam ?? '–'} (was: ${oud.naam ?? '–'})`);
  if (oud.adres !== nieuw.adres) regels.push(nieuw.adres ? `adres: ${nieuw.adres}${oud.adres ? ` (was: ${oud.adres})` : ''}` : 'adres weggehaald');
  if (!gelijk(oud.vorm, nieuw.vorm)) regels.push(!nieuw.vorm ? 'eigen omtrek gewist' : (oud.vorm ? 'eigen omtrek aangepast' : 'eigen omtrek getekend'));
  for (const k of new Set([...Object.keys(oud), ...Object.keys(nieuw)])) {
    if (!['id', 'naam', 'adres', 'vorm'].includes(k) && !gelijk(oud[k], nieuw[k])) regels.push(`${k} gewijzigd`);
  }
  return regels;
}

/**
 * Wat is er veranderd tussen twee versies van locaties.json?
 * Geeft een lijst van { sleutel, naam, regels, punt } met punt = nieuwe positie (voor een link naar de luchtfoto).
 */
export function beschrijf(oud, nieuw, fotoNaam = (id) => id) {
  const uit = [];
  const gebouwen = new Map([...perId(oud?.gebouwen), ...perId(nieuw?.gebouwen)]);
  const oudL = perId(oud?.locaties);
  const nieuwL = perId(nieuw?.locaties);
  for (const [id, loc] of nieuwL) {
    const vorige = oudL.get(id);
    if (!vorige) { uit.push({ sleutel: `plek:${id}`, naam: plekNaam(loc), regels: ['nieuwe plek'] }); continue; }
    if (gelijk(vorige, loc)) continue;
    const regels = beschrijfPlek(vorige, loc, gebouwen, fotoNaam);
    if (regels.length) {
      const p = loc.positie;
      const verschoven = p && (p.lat !== vorige.positie?.lat || p.lng !== vorige.positie?.lng);
      uit.push({ sleutel: `plek:${id}`, id, naam: plekNaam(loc), regels, punt: verschoven ? { lat: p.lat, lng: p.lng } : null });
    }
  }
  for (const [id, loc] of oudL) if (!nieuwL.has(id)) uit.push({ sleutel: `plek:${id}`, naam: plekNaam(loc), regels: ['plek verwijderd'] });

  const oudG = perId(oud?.gebouwen);
  const nieuwG = perId(nieuw?.gebouwen);
  for (const [id, g] of nieuwG) {
    const vorige = oudG.get(id);
    if (!vorige) uit.push({ sleutel: `gebouw:${id}`, naam: gebouwNaam(g), regels: [`nieuw gebouw${g.adres ? ` (${g.adres})` : ''}`] });
    else if (!gelijk(vorige, g)) {
      const regels = beschrijfGebouw(vorige, g);
      if (regels.length) uit.push({ sleutel: `gebouw:${id}`, naam: gebouwNaam(g), regels });
    }
  }
  for (const [id, g] of oudG) if (!nieuwG.has(id)) uit.push({ sleutel: `gebouw:${id}`, naam: gebouwNaam(g), regels: ['gebouw verwijderd'] });

  for (const k of new Set([...Object.keys(oud ?? {}), ...Object.keys(nieuw ?? {})])) {
    if (['locaties', 'gebouwen'].includes(k) || gelijk(oud?.[k], nieuw?.[k])) continue;
    const regels = k === 'instellingen'
      ? Object.keys({ ...oud?.instellingen, ...nieuw?.instellingen })
        .filter((s) => !gelijk(oud?.instellingen?.[s], nieuw?.instellingen?.[s]))
        .map((s) => `${s}: ${JSON.stringify(nieuw?.instellingen?.[s] ?? null)} (was: ${JSON.stringify(oud?.instellingen?.[s] ?? null)})`)
      : [`${k} gewijzigd`];
    uit.push({ sleutel: `algemeen:${k}`, naam: k === 'instellingen' ? 'Instellingen' : `Algemeen: ${k}`, regels });
  }
  return uit;
}

// ---------- Samenvoegen ----------

// Driewegsamenvoeging per eenheid (plek, gebouw of ander onderdeel van het bestand), zoals git dat per regel doet.
// basis = de versie waarop je begon, mijn = jouw versie, hun = de nieuwste versie op GitHub.
// Hebben jij en een ander dezelfde eenheid verschillend veranderd, dan is dat een botsing en kiest de gebruiker.
function voegLijstSamen(basis, mijn, hun, soort, naamVan, keuzes, botsingen) {
  const b = perId(basis);
  const m = perId(mijn);
  const h = perId(hun);
  const kies = (id) => {
    const inB = b.has(id); const inM = m.has(id); const inH = h.has(id);
    const mijnVeranderd = inB ? (!inM || !gelijk(b.get(id), m.get(id))) : inM;
    const hunVeranderd = inB ? (!inH || !gelijk(b.get(id), h.get(id))) : inH;
    if (!mijnVeranderd) return inH ? h.get(id) : undefined;
    if (!hunVeranderd || gelijk(m.get(id), h.get(id))) return inM ? m.get(id) : undefined;
    const sleutel = `${soort}:${id}`;
    const keuze = keuzes[sleutel];
    if (keuze === 'mijn') return inM ? m.get(id) : undefined;
    if (keuze === 'hun') return inH ? h.get(id) : undefined;
    botsingen.push({ sleutel, naam: naamVan(m.get(id) ?? h.get(id) ?? b.get(id)) });
    return inM ? m.get(id) : undefined;
  };
  const uit = [];
  const gehad = new Set();
  for (const item of Array.isArray(hun) ? hun : []) {
    if (!item?.id) { uit.push(item); continue; }
    gehad.add(item.id);
    const keuze = kies(item.id);
    if (keuze !== undefined) uit.push(keuze);
  }
  for (const item of Array.isArray(mijn) ? mijn : []) {
    if (!item?.id || gehad.has(item.id)) continue;
    gehad.add(item.id);
    const keuze = kies(item.id);
    if (keuze !== undefined) uit.push(keuze);
  }
  return uit;
}

/**
 * Voeg jouw wijzigingen samen met de nieuwste versie.
 * keuzes: { 'plek:<id>': 'mijn' | 'hun', ... } voor eerder opgeloste botsingen.
 * Geeft { resultaat, botsingen }. Zijn er botsingen, dan is resultaat nog niet bruikbaar.
 */
export function voegSamen(basis, mijn, hun, keuzes = {}) {
  const botsingen = [];
  const resultaat = {};
  const sleutels = [...new Set([...Object.keys(hun ?? {}), ...Object.keys(mijn ?? {})])];
  for (const k of sleutels) {
    if (k === 'locaties') resultaat.locaties = voegLijstSamen(basis?.locaties, mijn?.locaties, hun?.locaties, 'plek', plekNaam, keuzes, botsingen);
    else if (k === 'gebouwen') resultaat.gebouwen = voegLijstSamen(basis?.gebouwen, mijn?.gebouwen, hun?.gebouwen, 'gebouw', gebouwNaam, keuzes, botsingen);
    else {
      const mijnVeranderd = !gelijk(basis?.[k], mijn?.[k]);
      const hunVeranderd = !gelijk(basis?.[k], hun?.[k]);
      let waarde = hun?.[k];
      if (mijnVeranderd && (!hunVeranderd || gelijk(mijn?.[k], hun?.[k]))) waarde = mijn?.[k];
      else if (mijnVeranderd) {
        const keuze = keuzes[`algemeen:${k}`];
        if (keuze === 'mijn') waarde = mijn?.[k];
        else if (keuze !== 'hun') { botsingen.push({ sleutel: `algemeen:${k}`, naam: k === 'instellingen' ? 'Instellingen' : `Algemeen: ${k}` }); waarde = mijn?.[k]; }
      }
      if (waarde !== undefined) resultaat[k] = waarde;
    }
  }
  return { resultaat, botsingen };
}

// ---------- Toestand van een voorstel ----------

/**
 * In welke stap zit een voorstel? Alleen beoordelingen van de huidige versie tellen:
 * past de indiener het voorstel aan, dan moet een collega opnieuw kijken.
 * Geeft { code, label, opmerking, door }.
 *   code: 'wacht' | 'opmerking' | 'beheerder' | 'live' | 'gesloten'
 */
export function toestand(voorstel, lijst = []) {
  if (voorstel.live) return { code: 'live', label: 'Live' };
  if (!voorstel.open) return { code: 'gesloten', label: 'Niet doorgegaan' };
  const laatste = new Map();
  for (const r of [...lijst].sort((a, b) => a.moment.localeCompare(b.moment))) {
    if (r.door === voorstel.auteur || r.commit !== voorstel.kop) continue;
    if (r.oordeel === 'APPROVED' || r.oordeel === 'CHANGES_REQUESTED' || r.oordeel === 'DISMISSED') laatste.set(r.door, r);
  }
  const oordelen = [...laatste.values()];
  const opmerking = oordelen.filter((r) => r.oordeel === 'CHANGES_REQUESTED').at(-1);
  if (opmerking) return { code: 'opmerking', label: 'Opmerking', opmerking: opmerking.tekst, door: opmerking.door };
  if (oordelen.some((r) => r.oordeel === 'APPROVED')) return { code: 'beheerder', label: 'Bij beheerder' };
  return { code: 'wacht', label: 'Wacht op collega' };
}

// ---------- Teksten voor het voorstel ----------

/** Neutraliseer opmaaktekens, zodat een titel of toelichting geen links, koppen of HTML wordt op GitHub. */
export function zonderOpmaak(tekst) {
  return String(tekst ?? '').replace(/[\\`*_[\]<>#|!@~]/g, (t) => `\\${t}`);
}

export function titelVoor(wijzigingen) {
  const namen = wijzigingen.map((w) => w.naam.replace(/^(Plek \d+ · |Gebouw )/, ''));
  if (!namen.length) return 'Inhoud bijgewerkt';
  const rest = namen.length - 1;
  return `Inhoud: ${namen[0].slice(0, 60)}${rest ? ` en ${rest} ${rest === 1 ? 'ander onderdeel' : 'andere onderdelen'}` : ''}`;
}

/** De tekst die de beheerder bij het voorstel ziet: wat, waarom, wie, en de volgende stap. */
export function omschrijving({ wijzigingen, toelichting, naam, login, luchtfotoLink }) {
  const r = [`**Voorstel van ${zonderOpmaak(naam)}** (gebruiker ${zonderOpmaak(login)}), verstuurd met de editor.`, '', '### Wat verandert er'];
  for (const w of wijzigingen) {
    r.push(`- **${zonderOpmaak(w.naam)}**`);
    for (const regel of w.regels) r.push(`  - ${zonderOpmaak(regel)}`);
    if (w.punt && w.id) r.push(`  - [Nieuwe positie op de luchtfoto](${luchtfotoLink(w.id, w.punt)})`);
  }
  const t = String(toelichting ?? '').trim();
  if (t) r.push('', '### Toelichting', ...t.slice(0, 1500).split('\n').map((regel) => `> ${zonderOpmaak(regel)}`));
  r.push('', '### Controle',
    '- ✓ De automatische controle van de editor is geslaagd.',
    '- Volgende stap: een collega-contentbeheerder kijkt in de editor en kiest *Akkoord* of *Opmerking*. Daarna voegt een beheerder het samen; pas dan is het live.',
    '', '<!-- enschede-editor:v1 -->');
  return r.join('\n');
}

/** Naam voor de tak: inhoud/<onderwerp>-<datum>-<tijd>. Alleen kleine letters, cijfers en streepjes. */
export function takNaam(wijzigingen, nu = new Date()) {
  const eerste = wijzigingen[0]?.naam.replace(/^(Plek \d+ · |Gebouw )/, '') ?? 'inhoud';
  const onderwerp = eerste.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/, '') || 'inhoud';
  const p = (n) => String(n).padStart(2, '0');
  const stempel = `${nu.getFullYear()}${p(nu.getMonth() + 1)}${p(nu.getDate())}-${p(nu.getHours())}${p(nu.getMinutes())}${p(nu.getSeconds())}`;
  return `inhoud/${onderwerp}-${stempel}`;
}
