// Afstand tot een plek en een bewust grove afstandsindicatie (geen schijnnauwkeurigheid zoals "73 m").
// Pure functies zonder schermcode, zodat ze los te testen zijn.
//
//   tot de straal (35 m)   "Je bent er!"       -> de vraag gaat open
//   tot 100 m              "Vlakbij"
//   100 m - 1 km           "ca. 2/3/5/10/15 min lopen"   (4,5 km/u)
//   meer dan 1 km          "ca. 1,5 km"                   (afgerond op halve km)
//   GPS-onzekerheid > 50 m "Locatie nog onzeker"         -> er gaat niets open

export const ONZEKER_BOVEN = 50;      // meter: grotere GPS-onzekerheid vertrouwen we niet
export const VLAKBIJ = 100;           // meter
export const MARGE = 10;              // meter: voorkomt heen-en-weer springen rond een grens
const LOOPSNELHEID = 75;              // meter per minuut (4,5 km/u)
const MINUTEN = [2, 3, 5, 10, 15];

// Platte benadering rond Enschede: op deze schaal (enkele km) nauwkeurig tot op centimeters.
const M_PER_GRAAD_LAT = 111_320;
const M_PER_GRAAD_LNG = 111_320 * Math.cos((52.22 * Math.PI) / 180);

function naarMeters([lat, lng], [lat0, lng0]) {
  return [(lng - lng0) * M_PER_GRAAD_LNG, (lat - lat0) * M_PER_GRAAD_LAT];
}

function afstandTotLijnstuk([px, py], [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const lengte2 = dx * dx + dy * dy;
  const t = lengte2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengte2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function binnen([px, py], ring) {
  let ja = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ja = !ja;
  }
  return ja;
}

/**
 * Afstand in meters van 'positie' [lat, lng] tot een plek.
 * Met een omtrek (lijst van [lat, lng]): afstand tot de rand, 0 als je erin staat.
 * Zonder omtrek: afstand tot het punt 'punt' [lat, lng].
 */
export function afstandTot(positie, { vorm = null, punt = null } = {}) {
  if (Array.isArray(vorm) && vorm.length >= 3) {
    const ring = vorm.map((p) => naarMeters(p, positie));
    const ik = [0, 0];
    if (binnen(ik, ring)) return 0;
    let kleinste = Infinity;
    for (let i = 0; i < ring.length; i += 1) {
      kleinste = Math.min(kleinste, afstandTotLijnstuk(ik, ring[i], ring[(i + 1) % ring.length]));
    }
    return kleinste;
  }
  if (punt) return Math.hypot(...naarMeters(punt, positie));
  return Infinity;
}

function minutenTekst(meters) {
  const min = meters / LOOPSNELHEID;
  const stap = MINUTEN.reduce((beste, m) => (Math.abs(m - min) < Math.abs(beste - min) ? m : beste));
  return `ca. ${stap} min lopen`;
}

function kmTekst(meters) {
  const km = Math.max(1, Math.round(meters / 500) / 2);
  return `ca. ${String(km).replace('.', ',')} km`;
}

/**
 * Grove indicatie voor één afstand.
 * 'vorige' is de indicatie van de vorige meting voor dezelfde plek (of null);
 * daarmee blijft de tekst staan tot de afstand duidelijk (MARGE) veranderd is.
 * Geeft { soort: 'er' | 'vlakbij' | 'lopen' | 'ver' | 'onzeker', tekst, meters }.
 */
export function indicatie(meters, nauwkeurigheid, straal, vorige = null) {
  if (!Number.isFinite(meters)) return { soort: 'onbekend', tekst: 'Afstand onbekend', meters };
  if (!(nauwkeurigheid <= ONZEKER_BOVEN)) return { soort: 'onzeker', tekst: 'Locatie nog onzeker…', meters };

  // Grens met marge: wie er al is, blijft "er" tot straal + MARGE; wie buiten is, moet binnen straal komen.
  const grensEr = vorige?.soort === 'er' ? straal + MARGE : straal;
  if (meters <= grensEr) return { soort: 'er', tekst: 'Je bent er!', meters };

  const grensVlakbij = vorige?.soort === 'vlakbij' || vorige?.soort === 'er' ? VLAKBIJ + MARGE : VLAKBIJ;
  if (meters <= grensVlakbij) return { soort: 'vlakbij', tekst: 'Vlakbij', meters };

  // Verder weg: tekst pas wijzigen als de afstand meer dan de marge veranderd is.
  if (vorige && (vorige.soort === 'lopen' || vorige.soort === 'ver') && Math.abs(vorige.meters - meters) <= MARGE * 2) {
    return vorige;
  }
  if (meters <= 1000) return { soort: 'lopen', tekst: minutenTekst(meters), meters };
  return { soort: 'ver', tekst: kmTekst(meters), meters };
}
