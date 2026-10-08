import assert from 'node:assert/strict';
// Test van js/instellingen.js. Draaien: node tests/instellingen.test.mjs (Node 18 of nieuwer, geen npm nodig).
// Zonder browser is er geen localStorage: de module valt dan terug op het geheugen.
const s = await import(new URL('../js/instellingen.js', import.meta.url));

const standaard = { openen: null, doel: null, antwoorden: 'direct', taal: 'nl' };

// Leeg, kapot of vreemd: altijd de standaard
assert.deepEqual(s.controleer(undefined), standaard);
assert.deepEqual(s.controleer('tekst'), standaard);
assert.deepEqual(s.controleer({ openen: 'overal', doel: 24, antwoorden: 'eind', taal: 'nl' }),
  { openen: 'overal', doel: 24, antwoorden: 'eind', taal: 'nl' });

// Ongeldige waarden worden genegeerd
assert.equal(s.controleer({ openen: 'altijd' }).openen, null);
assert.equal(s.controleer({ doel: 0 }).doel, null);
assert.equal(s.controleer({ doel: 2.5 }).doel, null);
assert.equal(s.controleer({ doel: '24' }).doel, null);
assert.equal(s.controleer({ doel: 1000 }).doel, null);
assert.equal(s.controleer({ antwoorden: 'nooit' }).antwoorden, 'direct');
// Talen die er nog niet zijn: Nederlands
assert.equal(s.controleer({ taal: 'en' }).taal, 'nl');
// Geen extra velden overnemen (bijv. iets wat iemand zelf in de opslag zet)
assert.deepEqual(Object.keys(s.controleer({ ...standaard, extra: '<script>' })).sort(), Object.keys(standaard).sort());

// Wijzigen
s.zetInstelling('doel', 12);
assert.equal(s.instellingen().doel, 12);
s.zetInstelling('doel', null);
assert.equal(s.instellingen().doel, null);
s.zetInstelling('onbekend', 1);
assert.equal(Object.hasOwn(s.instellingen(), 'onbekend'), false);

console.log('instellingen.test: alles goed');
