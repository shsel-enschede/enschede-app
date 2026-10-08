// Instellingen uit het menu (tandwiel rechtsboven). Alleen op dit toestel (localStorage); er wordt niets verstuurd.
// Werkt ook als opslag geblokkeerd is (privévenster): dan alleen voor deze sessie.
//
//   openen:     null = volg de SHSEL (content/locaties.json), of 'overal' / 'ter-plekke'
//   doel:       null = geen doel, of een aantal plekken (1 tot 999; de app begrenst op het aantal plekken)
//   antwoorden: 'direct' (na elke vraag) of 'eind' (pas als het doel gehaald is, of alles ontdekt)
//   taal:       'nl' (Engels en Duits volgen later, zie plan-taalkeuze in het claude.ai-project)
//
// Later kan een opdracht van een docent (link of QR-code) deze keuzes vastzetten. Dat is nog een
// voorstel voor het bestuur (schoolmodus) en zit hier nog niet in.

const SLEUTEL = 'enschede-app:instellingen:v1';

export const TALEN = ['nl', 'en', 'de'];
export const BESCHIKBARE_TALEN = ['nl'];

const STANDAARD = Object.freeze({ openen: null, doel: null, antwoorden: 'direct', taal: 'nl' });

/** Maak van willekeurige (opgeslagen) data geldige instellingen. Onbekend of ongeldig = standaard. */
export function controleer(ruw) {
  const i = { ...STANDAARD };
  if (!ruw || typeof ruw !== 'object') return i;
  if (ruw.openen === 'overal' || ruw.openen === 'ter-plekke') i.openen = ruw.openen;
  if (Number.isInteger(ruw.doel) && ruw.doel >= 1 && ruw.doel <= 999) i.doel = ruw.doel;
  if (ruw.antwoorden === 'eind') i.antwoorden = 'eind';
  if (BESCHIKBARE_TALEN.includes(ruw.taal)) i.taal = ruw.taal;
  return i;
}

let huidig = { ...STANDAARD };

function lees() {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    if (ruw) huidig = controleer(JSON.parse(ruw));
  } catch {
    /* opslag niet beschikbaar of beschadigd: standaard */
  }
}

function schrijf() {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(huidig));
  } catch {
    /* opslag niet beschikbaar: keuze geldt alleen deze sessie */
  }
}

lees();

/** Alle instellingen (kopie). */
export function instellingen() {
  return { ...huidig };
}

/** Wijzig één instelling. De waarde wordt eerst gecontroleerd; ongeldig = standaard. */
export function zetInstelling(naam, waarde) {
  if (!Object.hasOwn(STANDAARD, naam)) return;
  huidig = controleer({ ...huidig, [naam]: waarde });
  schrijf();
}
