import assert from 'node:assert/strict';
// Test van de SHSEL-standaard "met of zonder vragen" (instellingen.vragen in content/locaties.json).
// Draaien: node tests/vragenkeuze.test.mjs (Node 18 of nieuwer, geen npm nodig).
import { readFileSync } from 'node:fs';

globalThis.location ??= { hostname: 'test' }; // js/inhoud.js kijkt bij het laden naar het adres
const stil = console.warn;
console.warn = () => {}; // ongeldige waarden geven een waarschuwing; die verwachten we hier
const { leesInstellingen, VRAGEN_STANDAARD } = await import(new URL('../js/inhoud.js', import.meta.url));

// Richting van het bestuur (25 nov 2026): Nederlands met vragen, Engels en Duits voorlopig zonder.
assert.deepEqual({ ...VRAGEN_STANDAARD }, { nl: 'met', en: 'zonder', de: 'zonder' });
assert.deepEqual(leesInstellingen({}).vragen, VRAGEN_STANDAARD);
assert.deepEqual(leesInstellingen({ vragen: { en: 'met' } }).vragen, { nl: 'met', en: 'met', de: 'zonder' });
// Ongeldig: per taal terug naar de standaard
assert.deepEqual(leesInstellingen({ vragen: { nl: 'misschien', de: 'met' } }).vragen, { nl: 'met', en: 'zonder', de: 'met' });
assert.deepEqual(leesInstellingen({ vragen: 'zonder' }).vragen, VRAGEN_STANDAARD);

// De inhoud zelf is geldig en volgt de richting van het bestuur
const inhoud = JSON.parse(readFileSync(new URL('../content/locaties.json', import.meta.url), 'utf8'));
assert.deepEqual(leesInstellingen(inhoud.instellingen).vragen, { nl: 'met', en: 'zonder', de: 'zonder' });

console.warn = stil;
console.log('vragenkeuze.test: alles goed');
