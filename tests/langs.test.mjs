import assert from 'node:assert/strict';
// Test van js/langs.js ("Je loopt langs …"). Draaien: node tests/langs.test.mjs (Node 18 of nieuwer, geen npm nodig).
const l = await import(new URL('../js/langs.js', import.meta.url));

const kerk = { sleutel: 'g:grote-kerk', naam: 'Grote Kerk', verhalen: 2, meters: 5 };
const zon = { sleutel: 'g:zonnewijzer', naam: 'Zonnewijzer', verhalen: 1, meters: 12 };
const brand = { sleutel: 'g:brandmonument', naam: 'Brandmonument', verhalen: 1, meters: 8 };
const sleutels = (gs) => gs.map((g) => g.sleutel);

// Eerste keer: dichtstbijzijnde eerst
let r = l.volgende([], [zon, kerk, brand]);
assert.deepEqual(sleutels(r.groepen), ['g:grote-kerk', 'g:brandmonument', 'g:zonnewijzer']);
assert.equal(r.erbij.length, 3);
assert.deepEqual(r.eraf, []);

// GPS-ruis: zonnewijzer lijkt nu het dichtst bij. Volgorde blijft, niets erbij of eraf.
r = l.volgende(r.groepen, [{ ...zon, meters: 2 }, { ...kerk, meters: 9 }, brand]);
assert.deepEqual(sleutels(r.groepen), ['g:grote-kerk', 'g:brandmonument', 'g:zonnewijzer']);
assert.deepEqual(r.erbij, []);
assert.deepEqual(r.eraf, []);

// Doorlopen: brandmonument valt af (stil), de rest houdt zijn plaats
r = l.volgende(r.groepen, [kerk, zon]);
assert.deepEqual(sleutels(r.groepen), ['g:grote-kerk', 'g:zonnewijzer']);
assert.deepEqual(r.eraf, ['g:brandmonument']);
assert.equal(l.voorleestekst(3, r.groepen, r.erbij), '', 'afvallen wordt niet voorgelezen');

// Er komt een plek bij: achteraan, en alleen die wordt voorgelezen
const jacobus = { sleutel: 'g:jacobuskerk', naam: 'Jacobuskerk', verhalen: 1, meters: 30 };
const vorigeAantal = r.groepen.length;
r = l.volgende(r.groepen, [jacobus, kerk, zon]);
assert.deepEqual(sleutels(r.groepen), ['g:grote-kerk', 'g:zonnewijzer', 'g:jacobuskerk']);
assert.equal(l.voorleestekst(vorigeAantal, r.groepen, r.erbij), 'Ook vlakbij: Jacobuskerk.');

// Verhaal beantwoord: aantal verhalen in de melding wordt bijgewerkt
r = l.volgende(r.groepen, [{ ...kerk, verhalen: 1 }, zon, jacobus]);
assert.equal(r.groepen[0].verhalen, 1);

// Alles valt af
r = l.volgende(r.groepen, []);
assert.deepEqual(r.groepen, []);
assert.equal(r.eraf.length, 3);

// Namen
assert.equal(l.namen(['A']), 'A');
assert.equal(l.namen(['A', 'B']), 'A en B');
assert.equal(l.namen(['A', 'B', 'C']), 'A, B en C');
assert.equal(l.namen(['A', 'B', 'C', 'D', 'E']), 'A, B, C en nog 2');

// Teksten
assert.deepEqual(l.meldingTekst([zon]), { label: 'Je loopt langs', naam: 'Zonnewijzer', vraag: 'Benieuwd naar het verhaal?' });
assert.equal(l.meldingTekst([kerk]).vraag, 'Benieuwd naar de 2 verhalen?');
assert.deepEqual(l.meldingTekst([kerk, brand, zon]), {
  label: 'Je bent bij 3 plekken', naam: 'Grote Kerk, Brandmonument en nog 1', vraag: 'Benieuwd? Kies zelf waar je begint.',
});
assert.equal(l.voorleestekst(0, [kerk, zon], [kerk, zon]),
  'Je bent bij 2 plekken: Grote Kerk en Zonnewijzer. Benieuwd? Kies zelf waar je begint. Onderin staat de knop Bekijk.');

assert.equal(l.meldingTekst([kerk, zon]).naam, 'Grote Kerk en Zonnewijzer');
assert.equal(l.voorleestekst(0, [kerk, brand, zon], [kerk, brand, zon]),
  'Je bent bij 3 plekken: Grote Kerk, Brandmonument en Zonnewijzer. Benieuwd? Kies zelf waar je begint. Onderin staat de knop Bekijk.');

console.log('langs.js: alle tests geslaagd');
