// Bewaart antwoorden en gelezen verhalen alleen op dit toestel (localStorage). Er wordt niets verstuurd.
// Werkt ook als opslag geblokkeerd is (privévenster): dan alleen voor deze sessie.
//
//   antwoorden: { plek-id: nummer van de gekozen optie (0 = A … 3 = D) }   (wandelen met vragen)
//   gelezen:    [plek-id, …]                                                (wandelen zonder vragen)
//
// Een plek is ontdekt als hij beantwoord óf gelezen is (zie isOntdekt in js/app.js).
// 'gelezen' is later toegevoegd; oudere opgeslagen voortgang heeft het nog niet en blijft gewoon werken.

import { ID_PATROON } from './hulp.js';
import { leesJson, schrijfJson } from './opslag.js';

const SLEUTEL = 'enschede-app:voortgang:v1';
const geheugen = { antwoorden: {}, gelezen: new Set() };

// Opgeslagen data komt uit de browser: alleen geldige waarden overnemen. Beschadigd of leeg: begin leeg.
function lees() {
  const data = leesJson(SLEUTEL);
  if (!data || typeof data !== 'object') return;
  if (data.antwoorden && typeof data.antwoorden === 'object') {
    for (const [id, keuze] of Object.entries(data.antwoorden)) {
      if (ID_PATROON.test(id) && Number.isInteger(keuze) && keuze >= 0 && keuze < 4) {
        geheugen.antwoorden[id] = keuze;
      }
    }
  }
  if (Array.isArray(data.gelezen)) {
    // Hooguit 1000: er zijn nooit meer plekken; een opgeblazen lijst uit de opslag wordt afgekapt.
    for (const id of data.gelezen.slice(0, 1000)) if (typeof id === 'string' && ID_PATROON.test(id)) geheugen.gelezen.add(id);
  }
}

function schrijf() {
  // lukt dat niet, dan blijft de voortgang alleen in deze sessie
  schrijfJson(SLEUTEL, { antwoorden: geheugen.antwoorden, gelezen: [...geheugen.gelezen] });
}

lees();

export function antwoordVan(locatieId) {
  return Object.hasOwn(geheugen.antwoorden, locatieId) ? geheugen.antwoorden[locatieId] : null;
}

export function bewaarAntwoord(locatieId, keuze) {
  if (antwoordVan(locatieId) !== null) return; // één antwoord per locatie
  geheugen.antwoorden[locatieId] = keuze;
  schrijf();
}

/** Is het verhaal van deze plek gelezen (wandelen zonder vragen)? */
export function isGelezen(locatieId) {
  return geheugen.gelezen.has(locatieId);
}

export function bewaarGelezen(locatieId) {
  if (!ID_PATROON.test(locatieId) || geheugen.gelezen.has(locatieId)) return;
  geheugen.gelezen.add(locatieId);
  schrijf();
}

/** Wis antwoorden én gelezen van de gegeven plekken ("Alles opnieuw beginnen"). */
export function wisAntwoorden(locatieIds) {
  for (const id of locatieIds) {
    delete geheugen.antwoorden[id];
    geheugen.gelezen.delete(id);
  }
  schrijf();
}
