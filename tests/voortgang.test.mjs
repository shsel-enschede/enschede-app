import assert from 'node:assert/strict';
// Test van js/voortgang.js: antwoorden (met vragen) en gelezen verhalen (zonder vragen).
// Draaien: node tests/voortgang.test.mjs (Node 18 of nieuwer, geen npm nodig).
// Zonder browser maken we een nep-localStorage, zodat ook het lezen van opgeslagen (en kapotte) data getest wordt.

const SLEUTEL = 'enschede-app:voortgang:v1';
const opslag = new Map();
globalThis.localStorage = {
  getItem: (k) => (opslag.has(k) ? opslag.get(k) : null),
  setItem: (k, v) => { opslag.set(k, String(v)); },
};

// Oude, deels kapotte opslag: geldige waarden blijven, de rest wordt genegeerd.
opslag.set(SLEUTEL, JSON.stringify({
  antwoorden: { 'grote-kerk': 1, 'kapot': 7, 'Geen Id': 0 },
  gelezen: ['stadhuis', '<script>', 42, 'stadhuis'],
}));
const v = await import(new URL('../js/voortgang.js', import.meta.url));

assert.equal(v.antwoordVan('grote-kerk'), 1);
assert.equal(v.antwoordVan('kapot'), null);
assert.equal(v.isGelezen('stadhuis'), true);
assert.equal(v.isGelezen('<script>'), false);

// Gelezen bewaren: alleen geldige id's, en één keer
v.bewaarGelezen('villa-scholten');
v.bewaarGelezen('villa-scholten');
v.bewaarGelezen('../kwaad');
assert.equal(v.isGelezen('villa-scholten'), true);
assert.equal(v.isGelezen('../kwaad'), false);
const bewaard = JSON.parse(opslag.get(SLEUTEL));
assert.deepEqual(bewaard.gelezen.sort(), ['stadhuis', 'villa-scholten']);
assert.deepEqual(bewaard.antwoorden, { 'grote-kerk': 1 });

// Gelezen en beantwoord gaan samen: een antwoord blijft mogelijk
v.bewaarAntwoord('stadhuis', 2);
assert.equal(v.antwoordVan('stadhuis'), 2);
assert.equal(v.isGelezen('stadhuis'), true);

// Opnieuw beginnen wist beide
v.wisAntwoorden(['grote-kerk', 'stadhuis', 'villa-scholten']);
assert.equal(v.antwoordVan('grote-kerk'), null);
assert.equal(v.isGelezen('stadhuis'), false);
assert.equal(v.isGelezen('villa-scholten'), false);
assert.deepEqual(JSON.parse(opslag.get(SLEUTEL)), { antwoorden: {}, gelezen: [] });

delete globalThis.localStorage;
console.log('voortgang.test: alles goed');
