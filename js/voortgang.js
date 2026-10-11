// Bewaart antwoorden alleen op dit toestel (localStorage). Er wordt niets verstuurd.
// Werkt ook als opslag geblokkeerd is (privévenster): dan alleen voor deze sessie.

import { ID_PATROON } from './hulp.js';
import { leesJson, schrijfJson } from './opslag.js';

const SLEUTEL = 'enschede-app:voortgang:v1';
let geheugen = { antwoorden: {} };

// Opgeslagen data komt uit de browser: alleen geldige antwoorden overnemen. Beschadigd of leeg: begin leeg.
function lees() {
  const data = leesJson(SLEUTEL);
  if (!data || typeof data.antwoorden !== 'object' || data.antwoorden === null) return;
  for (const [id, keuze] of Object.entries(data.antwoorden)) {
    if (ID_PATROON.test(id) && Number.isInteger(keuze) && keuze >= 0 && keuze < 4) {
      geheugen.antwoorden[id] = keuze;
    }
  }
}

function schrijf() {
  schrijfJson(SLEUTEL, geheugen); // lukt dat niet, dan blijft de voortgang alleen in deze sessie
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

/** Wis de antwoorden van de gegeven plekken ("Alles opnieuw beginnen"). */
export function wisAntwoorden(locatieIds) {
  for (const id of locatieIds) delete geheugen.antwoorden[id];
  schrijf();
}
