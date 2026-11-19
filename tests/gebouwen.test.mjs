// Gebouw met meer adressen (bijv. een rij huizen): adressen lezen, omtrek als lijst van ringen, afstand tot de dichtstbijzijnde.
// Draaien: node tests/alles.mjs
import assert from 'node:assert/strict';
import { adressenVan, ringenVan, MAX_EXTRA_ADRESSEN } from '../js/hulp.js';
import { afstandTot } from '../js/afstand.js';

// Adressen: eerste adres voorop, zonder dubbele, alleen met huisnummer.
assert.deepEqual(adressenVan({ adres: 'Emmastraat 2' }), ['Emmastraat 2']);
assert.deepEqual(
  adressenVan({ adres: 'Emmastraat 2', extraAdressen: ['Emmastraat 4', ' Emmastraat 6 ', 'Emmastraat 2', 'Emmastraat'] }),
  ['Emmastraat 2', 'Emmastraat 4', 'Emmastraat 6'],
);
assert.deepEqual(adressenVan({ extraAdressen: 'geen lijst' }), []);
assert.ok(MAX_EXTRA_ADRESSEN >= 3);

// Omtrek: één ring of een lijst van ringen; altijd als lijst van ringen terug.
const ringA = [[52.2200, 6.8900], [52.2200, 6.8901], [52.2201, 6.8901], [52.2201, 6.8900]];
const ringB = [[52.2200, 6.8910], [52.2200, 6.8911], [52.2201, 6.8911], [52.2201, 6.8910]];
assert.equal(ringenVan(ringA).length, 1);
assert.equal(ringenVan([ringA, ringB]).length, 2);
assert.deepEqual(ringenVan(null), []);

// Afstand: binnen een van de panden is 0; anders tot het dichtstbijzijnde pand.
assert.equal(afstandTot([52.22005, 6.89105], { vorm: [ringA, ringB] }), 0);
const totB = afstandTot([52.22005, 6.89125], { vorm: ringB });
assert.equal(afstandTot([52.22005, 6.89125], { vorm: [ringA, ringB] }), totB);
assert.ok(totB > 5 && totB < 15, `afstand tot pand B onverwacht: ${totB}`);

// Echte inhoud: elk gebouw met extra adressen heeft een eerste adres en niet te veel extra.
const { readFileSync } = await import('node:fs');
const data = JSON.parse(readFileSync(new URL('../content/locaties.json', import.meta.url), 'utf8'));
for (const g of data.gebouwen) {
  if (g.extraAdressen === undefined) continue;
  assert.ok(Array.isArray(g.extraAdressen), `${g.id}: extraAdressen moet een lijst zijn`);
  assert.ok(/\d/.test(g.adres ?? ''), `${g.id}: extraAdressen zonder eerste adres`);
  assert.ok(g.extraAdressen.length <= MAX_EXTRA_ADRESSEN, `${g.id}: te veel extra adressen`);
  for (const a of g.extraAdressen) assert.ok(/\d/.test(a) && a.length <= 120, `${g.id}: ongeldig adres "${a}"`);
}

console.log('✓ gebouwen met meer adressen');
