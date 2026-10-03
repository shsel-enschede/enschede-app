// Bewaart antwoorden alleen op dit toestel (localStorage). Er wordt niets verstuurd.
// Werkt ook als opslag geblokkeerd is (privévenster): dan alleen voor deze sessie.

const SLEUTEL = 'enschede-app:voortgang:v1';
let geheugen = { antwoorden: {} };

function lees() {
  try {
    const ruw = localStorage.getItem(SLEUTEL);
    if (!ruw) return;
    const data = JSON.parse(ruw);
    if (data && typeof data.antwoorden === 'object' && data.antwoorden !== null) {
      geheugen = { antwoorden: {} };
      for (const [id, keuze] of Object.entries(data.antwoorden)) {
        if (/^[a-z0-9-]{1,60}$/.test(id) && Number.isInteger(keuze) && keuze >= 0 && keuze < 4) {
          geheugen.antwoorden[id] = keuze;
        }
      }
    }
  } catch {
    /* opslag niet beschikbaar of beschadigd: begin leeg */
  }
}

function schrijf() {
  try {
    localStorage.setItem(SLEUTEL, JSON.stringify(geheugen));
  } catch {
    /* opslag niet beschikbaar: voortgang blijft alleen in deze sessie */
  }
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

export function wisAlles() {
  geheugen = { antwoorden: {} };
  schrijf();
}
