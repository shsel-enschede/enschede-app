import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
// Test van js/taal.js en content/teksten.json. Draaien: node tests/taal.test.mjs (Node 18 of nieuwer, geen npm nodig).
// Vangt vooral vergissingen bij het vertalen: een ontbrekende taal, een vergeten {invulplek}, een tekst
// die de app gebruikt maar niet bestaat.
const taal = await import(new URL('../js/taal.js', import.meta.url));
const lees = (pad) => readFileSync(new URL(`../${pad}`, import.meta.url), 'utf8');
const data = JSON.parse(lees('content/teksten.json'));

// ---------- Taal van het toestel ----------
assert.equal(taal.toestelTaal(['nl-NL']), 'nl');
assert.equal(taal.toestelTaal(['en-GB', 'nl-NL']), 'nl', 'Nederlands ergens in de lijst: Nederlands');
assert.equal(taal.toestelTaal(['de-DE', 'en']), 'de');
assert.equal(taal.toestelTaal(['en-US']), 'en');
assert.equal(taal.toestelTaal(['tr-TR']), 'nl', 'onbekende taal: Nederlands');
assert.equal(taal.toestelTaal(['fr-FR', 'de-AT']), 'de');
assert.equal(taal.toestelTaal(undefined), 'nl');
assert.equal(taal.toestelTaal([42, null]), 'nl');

// ---------- Het bestand content/teksten.json ----------
const invulplekken = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
const vormen = (w) => (typeof w === 'string' ? [w] : [w.one, w.other]);
for (const [sleutel, per] of Object.entries(data)) {
  if (sleutel.startsWith('_')) continue;
  for (const t of taal.TALEN) {
    assert.ok(per[t] !== undefined, `teksten.json: "${sleutel}" mist ${t}`);
    assert.equal(typeof per[t], typeof per.nl, `teksten.json: "${sleutel}" (${t}) heeft een andere vorm dan het Nederlands`);
    if (sleutel !== 'menu.vertaling') assert.ok(vormen(per[t]).every((s) => s.length > 0), `teksten.json: "${sleutel}" (${t}) is leeg`);
  }
  // Elke taal gebruikt dezelfde invulplekken (vergeten of verkeerd gespelde {naam} valt zo op).
  // Enkelvoud mag een getal uitschrijven ("Nog 1 verhaal"), daarom alleen het meervoud.
  const plekken = (w) => invulplekken(typeof w === 'string' ? w : w.other);
  for (const t of ['en', 'de']) {
    assert.equal(plekken(per[t]), plekken(per.nl), `teksten.json: "${sleutel}" (${t}) heeft andere {invulplekken} dan het Nederlands`);
  }
}
assert.equal(taal.zetTeksten(data), Object.keys(data).filter((k) => !k.startsWith('_')).length, 'alle teksten geldig');

// Elke tekst die de app gebruikt, bestaat (in js/ en in index.html).
const gebruikt = new Set();
for (const naam of readdirSync(new URL('../js/', import.meta.url))) {
  for (const m of lees(`js/${naam}`).matchAll(/\bt\('([a-z][\w.]+)'/g)) gebruikt.add(m[1]);
}
for (const m of lees('index.html').matchAll(/data-t(?:-label|-alt)?="([\w.]+)"/g)) gebruikt.add(m[1]);
for (const sleutel of gebruikt) assert.ok(data[sleutel], `De app gebruikt tekst "${sleutel}", maar die staat niet in content/teksten.json`);

// ---------- t() ----------
taal.zetTaal('nl');
assert.equal(taal.t('kaart.lijstgreep', { n: 12 }), 'Alle 12 plekken als lijst');
assert.equal(taal.t('kaart.ontdekt', { n: 1 }), '1 plek ontdekt');
assert.equal(taal.t('kaart.ontdekt', { n: 3 }), '3 plekken ontdekt');
assert.equal(taal.t('bestaat.niet'), 'bestaat.niet', 'onbekende tekst: de sleutel');
assert.equal(taal.t('menu.vertaling'), '', 'lege Nederlandse tekst blijft leeg');
taal.zetTaal('en');
assert.equal(taal.t('kaart.ontdekt', { n: 1 }), '1 place discovered');
assert.equal(taal.getal(1.5), '1.5');
taal.zetTaal('de');
assert.equal(taal.t('kaart.ontdekt', { n: 2 }), '2 Orte entdeckt');
assert.equal(taal.getal(1.5), '1,5');
assert.equal(taal.zetTaal('fr'), 'nl', 'onbekende taal: Nederlands');

// Terugval op Nederlands als een vertaling ontbreekt of ongeldig is
taal.zetTeksten({ 'a.b': { nl: 'Hallo', en: '' }, 'a.c': { nl: 'Doei', de: 12 }, 'zonder.nl': { en: 'x' }, 'Fout sleutel': { nl: 'x' } });
taal.zetTaal('en');
assert.equal(taal.t('a.b'), 'Hallo');
taal.zetTaal('de');
assert.equal(taal.t('a.c'), 'Doei');
assert.equal(taal.t('zonder.nl'), 'zonder.nl');
// Invulwaarden zijn gewone tekst; er wordt niets als code uitgevoerd (de app zet tekst altijd met textContent).
assert.equal(taal.t('a.b', { naam: '<script>' }), 'Hallo');

// Terug naar de echte teksten voor de volgende tests
taal.zetTeksten(data);
taal.zetTaal('nl');
console.log('taal.test: alles goed');
