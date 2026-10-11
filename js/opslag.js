// Opslag op dit toestel (localStorage), zonder ooit te crashen.
// In een privévenster, met volle opslag of zonder browser (tests) mislukt opslaan stil:
// de app werkt dan gewoon door, alleen onthoudt hij niets na het sluiten.
// Wat hier wordt gelezen, komt uit de browser en is onbetrouwbaar: controleer het altijd na het lezen.

/** Lees en ontleed JSON; null als er niets (geldigs) is. */
export function leesJson(sleutel) {
  try {
    const ruw = localStorage.getItem(sleutel);
    return ruw ? JSON.parse(ruw) : null;
  } catch {
    return null;
  }
}

/** Bewaar een waarde als JSON. Geeft false als dat niet lukte. */
export function schrijfJson(sleutel, waarde) {
  try {
    localStorage.setItem(sleutel, JSON.stringify(waarde));
    return true;
  } catch {
    return false;
  }
}
