import assert from 'node:assert/strict';
import fs from 'node:fs';
// Test van js/voorstel.js (verschillen, samenvoegen, toestand). Draaien: node tests/voorstel.test.mjs
// Geen npm nodig; alleen Node 18 of nieuwer.
const v = await import(new URL('../js/voorstel.js', import.meta.url));
const basis = JSON.parse(fs.readFileSync(new URL('../content/locaties.json', import.meta.url), 'utf8'));
const kopie = () => structuredClone(basis);
const [a, b] = basis.locaties;

// 1. Geen wijziging
assert.deepEqual(v.beschrijf(basis, kopie()), []);
// 2. Sleutelvolgorde maakt niet uit
const m0 = kopie(); m0.locaties[0].positie = { bevestigd: a.positie.bevestigd, lng: a.positie.lng, lat: a.positie.lat };
assert.deepEqual(v.beschrijf(basis, m0), []);
// 3. Positie verschoven + foto
const mijn = kopie(); mijn.locaties[0].positie.lat += 0.0001; mijn.locaties[0].fotos = ['x-1', ...(a.fotos ?? [])];
const w = v.beschrijf(basis, mijn);
assert.equal(w.length, 1); assert.match(w[0].regels[0], /verschoven \(ca\. 11 m\)/); assert.ok(w[0].punt);
// 4. Samenvoegen zonder botsing: ander veranderde plek b
const hun = kopie(); hun.locaties[1].juist = (b.juist + 1) % 4;
let r = v.voegSamen(basis, mijn, hun);
assert.equal(r.botsingen.length, 0);
assert.equal(r.resultaat.locaties[0].positie.lat, mijn.locaties[0].positie.lat);
assert.equal(r.resultaat.locaties[1].juist, hun.locaties[1].juist);
assert.equal(r.resultaat.locaties.length, basis.locaties.length);
assert.deepEqual(Object.keys(r.resultaat), Object.keys(basis));
// 5. Botsing op dezelfde plek
const hun2 = kopie(); hun2.locaties[0].positie.lat -= 0.0002;
r = v.voegSamen(basis, mijn, hun2);
assert.equal(r.botsingen.length, 1); assert.equal(r.botsingen[0].sleutel, `plek:${a.id}`);
r = v.voegSamen(basis, mijn, hun2, { [`plek:${a.id}`]: 'hun' });
assert.equal(r.botsingen.length, 0); assert.equal(r.resultaat.locaties[0].positie.lat, hun2.locaties[0].positie.lat);
// 6. Zelfde wijziging aan beide kanten is geen botsing
r = v.voegSamen(basis, mijn, structuredClone(mijn)); assert.equal(r.botsingen.length, 0);
// 7. Nieuw gebouw bij mij, ander verwijderde niets
const m7 = kopie(); m7.gebouwen.push({ id: 'gebouw-99', naam: 'Test', adres: 'Oude Markt 1' }); m7.locaties[0].gebouw = 'gebouw-99';
r = v.voegSamen(basis, m7, hun); assert.equal(r.botsingen.length, 0); assert.ok(r.resultaat.gebouwen.some(g => g.id === 'gebouw-99'));
// 8. Instellingen
const m8 = kopie(); m8.instellingen.ontgrendelen = 'ter-plekke'; const h8 = kopie(); h8.instellingen.straal = 40;
r = v.voegSamen(basis, m8, h8); assert.equal(r.botsingen.length, 1);
// 9. Toestand
const vs = { auteur: 'anna', kop: 'a'.repeat(40), open: true, live: false };
assert.equal(v.toestand(vs, []).code, 'wacht');
assert.equal(v.toestand(vs, [{ door: 'piet', oordeel: 'APPROVED', commit: 'a'.repeat(40), moment: '1' }]).code, 'beheerder');
assert.equal(v.toestand(vs, [{ door: 'piet', oordeel: 'APPROVED', commit: 'b'.repeat(40), moment: '1' }]).code, 'wacht');
assert.equal(v.toestand(vs, [{ door: 'piet', oordeel: 'CHANGES_REQUESTED', commit: 'a'.repeat(40), moment: '1', tekst: 'x' }, { door: 'jan', oordeel: 'APPROVED', commit: 'a'.repeat(40), moment: '2' }]).code, 'opmerking');
assert.equal(v.toestand(vs, [{ door: 'piet', oordeel: 'CHANGES_REQUESTED', commit: 'a'.repeat(40), moment: '1' }, { door: 'piet', oordeel: 'APPROVED', commit: 'a'.repeat(40), moment: '2' }]).code, 'beheerder');
assert.equal(v.toestand({ ...vs, open: false, live: true }).code, 'live');
// 10. Taknaam en titel
const t = v.takNaam([{ naam: 'Plek 3 · Café „De Pauw” & Zn' }], new Date(2026, 9, 7, 13, 5, 9));
assert.match(t, /^inhoud\/[a-z0-9-]+$/);
assert.equal(v.titelVoor(w), 'Inhoud: ' + a.titel.nl);
const tekst = v.omschrijving({ wijzigingen: w, toelichting: 'Ter plekke <b>gecheckt</b>', naam: 'Test', login: 'test', luchtfotoLink: () => 'https://x' });
assert.ok(tekst.includes(String.raw`\<b\>`) && tekst.includes('enschede-editor:v1'));
console.log('ALLE TESTS GESLAAGD');
