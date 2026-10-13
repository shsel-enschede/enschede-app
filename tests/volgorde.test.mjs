import assert from 'node:assert/strict';
// Test van js/volgorde.js. Draaien: node tests/volgorde.test.mjs (Node 18 of nieuwer, geen npm nodig).
const v = await import(new URL('../js/volgorde.js', import.meta.url));

const opties = ['Iemand die groenten verbouwt', 'Een leerling van Jezus', 'Een voetballer', 'Een boer met een stropdas'];
const isPermutatie = (rij) => [...rij].sort().join() === '0,1,2,3';

// Altijd elke optie precies één keer
for (let z = 0; z < 200; z++) assert.ok(isPermutatie(v.schud(opties, 'plek-a', z)));

// Zelfde toestel (zaad) en plek: altijd dezelfde volgorde (ook bij opnieuw openen en in "Mijn antwoorden")
assert.deepEqual(v.schud(opties, 'plek-a', 42), v.schud(opties, 'plek-a', 42));

// Over veel toestellen staat het goede antwoord (optie 1) ongeveer even vaak op A, B, C en D
const telling = [0, 0, 0, 0];
for (let z = 0; z < 4000; z++) telling[v.schud(opties, 'plek-a', z).indexOf(1)]++;
for (const n of telling) assert.ok(n > 850 && n < 1150, `ongelijk verdeeld: ${telling}`);

// Per toestel verschilt de volgorde tussen vragen (niet overal hetzelfde patroon)
const patronen = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => v.schud(opties, id, 7).join()));
assert.ok(patronen.size > 1);

// Reeksen blijven op volgorde: oplopend of aflopend, beide komen voor
assert.ok(v.isReeks(['1932', '1933', '1934', '1935']));
assert.ok(v.isReeks(['De 1e parochie', 'De 2e parochie', 'De 3e parochie', 'De 4e parochie']));
assert.ok(!v.isReeks(['In 1900', 'Rond 1950', 'Na de oorlog', 'In 1862']));
assert.ok(!v.isReeks(opties));
const jaren = ['1932', '1933', '1934', '1935'];
const reeksen = new Set();
for (let z = 0; z < 50; z++) reeksen.add(v.schud(jaren, 'plek-b', z).join());
assert.deepEqual([...reeksen].sort(), ['0,1,2,3', '3,2,1,0']);

// Werkt ook met twee of drie opties
assert.ok([...v.schud(['ja', 'nee'], 'x', 1)].sort().join() === '0,1');

// Zonder browser (geen localStorage): volgordeVan werkt, en een nieuwe volgorde maken crasht niet
const loc = { id: 'plek-a', opties };
assert.deepEqual(v.volgordeVan(loc), v.volgordeVan(loc));
v.nieuweVolgorde();
assert.ok(isPermutatie(v.volgordeVan(loc)));

console.log('✓ volgorde: alle tests geslaagd');
