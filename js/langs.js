// "Je loopt langs …": welke plekken staan in de melding, en wat staat er.
// Zonder scherm, los te testen: tests/langs.test.mjs. app.js verbindt dit met het scherm, kaart.js met de kaart.
// Teksten: content/teksten.json (langs.*).
//
// Afspraken (CLAUDE.md, "Vrij ontdekken"):
// - Alle onontdekte plekken binnen de straal staan samen in één melding, per gebouw. De wandelaar kiest zelf.
// - Komt er onder het lopen een plek bij, dan komt hij achteraan; alleen die plek wordt gemeld.
// - Valt er een plek af (je loopt verder), dan verdwijnt hij stil: niet voorlezen, niet laten oplichten.
// - De volgorde verspringt nooit: plekken die er al stonden, houden hun plaats. Zo wisselt er niets
//   als door GPS-ruis een andere plek een paar meter "dichterbij" lijkt.

import { t, lijstTekst } from './taal.js';

/**
 * Nieuwe toestand van de melding.
 * vorige: groepen die nu in de melding staan, in hun volgorde.
 * nu: groepen die nu binnen de straal liggen, als { sleutel, meters, ... } (meters = afstand tot de dichtstbijzijnde plek).
 * Geeft { groepen, erbij, eraf }: de nieuwe volgorde, de nieuwe groepen en de sleutels die zijn afgevallen.
 */
export function volgende(vorige, nu) {
  const nuPer = new Map(nu.map((g) => [g.sleutel, g]));
  const was = new Set(vorige.map((g) => g.sleutel));
  const blijft = vorige.filter((g) => nuPer.has(g.sleutel)).map((g) => nuPer.get(g.sleutel)); // vers: aantal verhalen kan veranderd zijn
  const erbij = nu.filter((g) => !was.has(g.sleutel)).sort((x, y) => x.meters - y.meters); // nieuwe: dichtstbijzijnde eerst
  const eraf = vorige.filter((g) => !nuPer.has(g.sleutel)).map((g) => g.sleutel);
  return { groepen: [...blijft, ...erbij], erbij, eraf };
}

/** "A", "A en B", "A, B en C", "A, B, C en nog 2" (in de taal van de app). */
export function namen(lijst, max = 3) {
  if (lijst.length <= max) return lijstTekst(lijst);
  return lijstTekst([...lijst.slice(0, max), t('langs.nogMeer', { n: lijst.length - max })]);
}

/**
 * Tekst van de melding voor groepen [{ naam, verhalen }].
 * Geeft { label, naam, vraag } voor het scherm.
 */
export function meldingTekst(groepen) {
  if (groepen.length === 1) {
    const g = groepen[0];
    return {
      label: t('langs.loopt'),
      naam: g.naam,
      // Uitnodigen, niet opdragen: een vraag wekt nieuwsgierigheid en laat de keuze bij de wandelaar.
      vraag: g.verhalen > 1 ? t('langs.verhalen', { n: g.verhalen }) : t('langs.verhaal'),
    };
  }
  return {
    label: t('langs.bijPlekken', { n: groepen.length }),
    // Hooguit twee namen, zodat de melding laag blijft en de kaart ruimte houdt; alle namen staan in de keuzelijst
    // (Bekijk) en rood op de kaart.
    naam: namen(groepen.map((g) => g.naam), 2),
    vraag: t('langs.kies'),
  };
}

/**
 * Wat een schermlezer voorleest, of '' als er niets te melden is.
 * Alleen bij iets nieuws: de eerste keer de hele melding, daarna alleen wat erbij komt. Afvallen is stil.
 */
export function voorleestekst(vorigeAantal, groepen, erbij) {
  if (!erbij.length || !groepen.length) return '';
  if (vorigeAantal === 0 || erbij.length === groepen.length) {
    const m = meldingTekst(groepen);
    const alle = groepen.length > 1 ? namen(groepen.map((g) => g.naam)) : m.naam; // voorlezen: tot drie namen
    return `${m.label}${groepen.length > 1 ? ':' : ''} ${alle}. ${m.vraag} ${t('langs.knopUitleg')}`;
  }
  return t('langs.ookVlakbij', { namen: namen(erbij.map((g) => g.naam)) });
}
