// GPS: de positie van de gebruiker, alleen in het geheugen van deze pagina.
// - Wordt pas gestart na een tik op "Zet locatie aan" (zie CLAUDE.md), nooit bij het openen.
// - De positie wordt nooit opgeslagen of verstuurd. Alleen de keuze "locatie aan" wordt onthouden,
//   zodat de app bij een volgend bezoek niet opnieuw hoeft te vragen als de browser al toestemming heeft.
// - Pauzeert als de app op de achtergrond staat, om de batterij te sparen.

const KEUZE_SLEUTEL = 'enschede-app:locatie-aan:v1';

let wachter = null;
let laatste = null;          // { lat, lng, nauwkeurigheid, tijd }
let status = 'uit';          // 'uit' | 'zoeken' | 'aan' | 'geweigerd' | 'niet-beschikbaar' | 'fout'
const luisteraars = new Set();

function meld() {
  for (const f of luisteraars) {
    try { f(laatste, status); } catch (fout) { console.error(fout); }
  }
}

function onthoudKeuze(aan) {
  try {
    if (aan) localStorage.setItem(KEUZE_SLEUTEL, '1');
    else localStorage.removeItem(KEUZE_SLEUTEL);
  } catch { /* geen opslag: dan vragen we het volgende keer opnieuw */ }
}

function keuzeWasAan() {
  try { return localStorage.getItem(KEUZE_SLEUTEL) === '1'; } catch { return false; }
}

export const gpsMogelijk = 'geolocation' in navigator && window.isSecureContext;

function begin() {
  if (wachter !== null || !gpsMogelijk) return;
  if (status !== 'aan') status = 'zoeken';
  meld();
  wachter = navigator.geolocation.watchPosition(
    (p) => {
      laatste = {
        lat: p.coords.latitude,
        lng: p.coords.longitude,
        nauwkeurigheid: Number.isFinite(p.coords.accuracy) ? p.coords.accuracy : Infinity,
        tijd: p.timestamp,
      };
      status = 'aan';
      meld();
    },
    (fout) => {
      if (fout.code === fout.PERMISSION_DENIED) {
        status = 'geweigerd';
        onthoudKeuze(false);
        stopWachter();
      } else if (fout.code === fout.POSITION_UNAVAILABLE) {
        status = 'niet-beschikbaar';
      } else {
        status = laatste ? 'aan' : 'fout'; // time-out: blijven proberen
      }
      meld();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
  );
}

function stopWachter() {
  if (wachter !== null) navigator.geolocation.clearWatch(wachter);
  wachter = null;
}

/** Na een tik van de gebruiker: GPS aanzetten (de browser vraagt eenmalig toestemming). */
export function zetAan() {
  onthoudKeuze(true);
  begin();
}

/** GPS uitzetten en de positie vergeten. */
export function zetUit() {
  onthoudKeuze(false);
  stopWachter();
  laatste = null;
  status = 'uit';
  meld();
}

export function positie() { return laatste; }
export function gpsStatus() { return status; }

/** f(positie, status) wordt aangeroepen bij elke nieuwe meting of statuswijziging. Geeft een afmeld-functie terug. */
export function volg(f) {
  luisteraars.add(f);
  return () => luisteraars.delete(f);
}

// Bij een volgend bezoek alleen automatisch hervatten als de gebruiker dat eerder koos
// én de browser al toestemming heeft. Dan verschijnt er geen nieuwe vraag.
export async function hervatAlsToegestaan() {
  if (!gpsMogelijk || !keuzeWasAan()) return;
  try {
    const toestemming = await navigator.permissions?.query({ name: 'geolocation' });
    if (toestemming?.state === 'granted') begin();
  } catch { /* Permissions API niet beschikbaar: wachten op een tik */ }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopWachter();
  } else if (status === 'aan' || status === 'zoeken') {
    begin();
  }
});
