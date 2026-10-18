// Kleine hulpfuncties die app en beheerpagina allebei gebruiken.

/** Geldig id van een plek, gebouw of foto: kleine letters, cijfers en streepjes (bijv. "grote-kerk"). */
export const ID_PATROON = /^[a-z0-9-]{1,60}$/;

/** Heeft het adres een huisnummer? Alleen dan kan het Kadaster er een gebouw bij vinden. */
export function heeftHuisnummer(adres) {
  return typeof adres === 'string' && /\d/.test(adres);
}

/** Maak een element; tekst gaat altijd via textContent, nooit via innerHTML (zie CLAUDE.md). */
export function maak(tag, klasse, tekst) {
  const e = document.createElement(tag);
  if (klasse) e.className = klasse;
  if (tekst !== undefined) e.textContent = tekst;
  return e;
}

/** 'smooth', of 'auto' als de gebruiker minder beweging wil (prefers-reduced-motion). */
export function scrolGedrag() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

/**
 * Ligt punt (x, y) binnen de ring (lijst van [x, y])? Ray-casting; x en y in dezelfde volgorde als de ring.
 * Gebruikt voor "sta je in het gebouw" (afstand.js) en "welk Kadaster-pand hoort bij dit adres" (gebouwen.js).
 */
export function puntInRing(x, y, ring) {
  let binnen = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen;
  }
  return binnen;
}

/**
 * Korte vingerafdruk (8 tekens) van een waarde, om te zien of een tekst veranderd is.
 * Gebruikt voor vertalingen: bij elke vertaling staat de vingerafdruk van de Nederlandse tekst waarop hij
 * gebaseerd is. Verandert het Nederlands daarna, dan klopt de vingerafdruk niet meer en is de vertaling verouderd.
 * FNV-1a (32 bit): snel en zonder browser-API. Geen beveiliging, alleen veranderingen opmerken.
 */
export function vingerafdruk(waarde) {
  const tekst = JSON.stringify(waarde) ?? '';
  let h = 0x811c9dc5;
  for (let i = 0; i < tekst.length; i += 1) {
    h ^= tekst.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** De Nederlandse delen van een plek die samen vertaald worden: het verhaal (titel en tekst) en de vraag. */
export function vertaalbron(loc) {
  const v = loc?.vraag?.nl ?? {};
  return {
    verhaal: vingerafdruk([loc?.titel?.nl ?? '', loc?.tekst?.nl ?? '']),
    // 'juist' hoort bij de vraag: wijzigt het goede antwoord, dan moet de vertaling opnieuw bekeken worden.
    vraag: vingerafdruk([v.tekst ?? '', v.opties ?? [], v.uitleg ?? '', loc?.juist ?? null]),
  };
}
