// Kleine hulpfuncties die app en beheerpagina allebei gebruiken.

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
