import assert from 'node:assert/strict';
import fs from 'node:fs';
// Test van js/schrijfhulp.js. Draaien: node tests/schrijfhulp.test.mjs (Node 18 of nieuwer, geen npm nodig).
const s = await import(new URL('../js/schrijfhulp.js', import.meta.url));

// Zinnen en woorden
assert.deepEqual(s.zinnen('Een zin. Nog een! En een vraag? Slot'), ['Een zin.', 'Nog een!', 'En een vraag?', 'Slot']);
assert.equal(s.woorden('  drie losse   woorden '), 3);

const goed = {
  tekst: 'De kerk is ruim 100 jaar oud. Kijk naar de twee koepels.',
  vraag: 'Hoeveel koepels heeft de kerk?',
  opties: ['Eén', 'Twee', 'Drie', 'Vier'],
  uitleg: 'De kerk heeft twee koepels van meer dan 20 meter hoog.',
  juist: 1,
};
// Een goede plek geeft geen tips
assert.deepEqual(s.schrijfadvies(goed), []);

const velden = (tips) => tips.map((t) => t.veld);
// Lange zin in het verhaal
const lang = 'Dit is een hele lange zin met veel te veel woorden voor een kind van tien jaar dat in de stad loopt.';
assert.deepEqual(velden(s.schrijfadvies({ ...goed, tekst: lang })), ['tekst']);
// Ontkennende vraag
assert.deepEqual(velden(s.schrijfadvies({ ...goed, vraag: 'Welke kerk is niet afgebrand?' })), ['vraag']);
// Te weinig en dubbele antwoorden
assert.deepEqual(velden(s.schrijfadvies({ ...goed, opties: ['Eén', 'Twee', '', ''] })), ['opties']);
assert.deepEqual(velden(s.schrijfadvies({ ...goed, opties: ['Eén', 'Twee', 'twee', 'Vier'] })), ['opties']);
// "Niet te zien" en "alle antwoorden"
assert.equal(s.schrijfadvies({ ...goed, opties: ['Eén', 'Twee', 'Dat is niet te zien', 'Vier'] }).length, 1);
assert.equal(s.schrijfadvies({ ...goed, opties: ['Eén', 'Twee', 'Alle antwoorden zijn goed', 'Vier'] }).length, 1);
// Goede antwoord valt op door lengte
const opvallend = s.schrijfadvies({ ...goed, opties: ['Eén', 'Twee grote koepels van meer dan twintig meter', 'Drie', 'Vier'] });
assert.ok(opvallend.some((t) => /langer/.test(t.tekst)));
// Uitleg ontbreekt
assert.deepEqual(velden(s.schrijfadvies({ ...goed, uitleg: '' })), ['uitleg']);

// Echte inhoud: de schrijfhulp mag nergens vastlopen
const inhoud = JSON.parse(fs.readFileSync(new URL('../content/locaties.json', import.meta.url), 'utf8'));
for (const loc of inhoud.locaties) {
  const v = loc.vraag?.nl ?? {};
  assert.ok(Array.isArray(s.schrijfadvies({ tekst: loc.tekst?.nl, vraag: v.tekst, opties: v.opties ?? [], uitleg: v.uitleg, juist: loc.juist })));
}

console.log('ALLE TESTS GESLAAGD');
