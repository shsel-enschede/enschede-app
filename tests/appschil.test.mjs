import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, normalize } from 'node:path';
// Vangnet voor offline werken. Draaien: node tests/appschil.test.mjs (Node 18 of nieuwer, geen npm nodig).
//
// De service worker (sw.js) bewaart bij installatie alle bestanden uit APP_SCHIL. Twee fouten maken
// offline werken stuk zonder dat je het direct merkt:
//   1. een nieuw JavaScript-bestand dat de app gebruikt, staat niet in APP_SCHIL (offline: lege app);
//   2. een bestand in APP_SCHIL bestaat niet (meer): dan mislukt de hele installatie.

const wortel = join(dirname(fileURLToPath(import.meta.url)), '..');
const lees = (pad) => readFileSync(join(wortel, pad), 'utf8');

const sw = lees('sw.js');
const lijst = /const APP_SCHIL = \[([\s\S]*?)\];/.exec(sw);
assert.ok(lijst, 'APP_SCHIL niet gevonden in sw.js');
const appSchil = new Set([...lijst[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

// 2. Elk bestand in APP_SCHIL bestaat.
for (const pad of appSchil) {
  if (pad === './') continue;
  assert.ok(existsSync(join(wortel, pad)), `sw.js noemt ${pad}, maar dat bestand bestaat niet`);
}

// 1. Alle modules die de app (index.html → js/app.js) laadt, ook indirect, staan in APP_SCHIL.
const gezien = new Set();
function volg(pad) {
  if (gezien.has(pad)) return;
  gezien.add(pad);
  for (const [, doel] of lees(pad).matchAll(/^\s*import\s[^'"]*['"](\.{1,2}\/[^'"]+)['"]/gm)) {
    volg(normalize(join(dirname(pad), doel)).replaceAll('\\', '/'));
  }
}
volg('js/app.js');
for (const pad of gezien) assert.ok(appSchil.has(pad), `${pad} wordt door de app geladen, maar staat niet in APP_SCHIL in sw.js`);

// De pagina zelf en wat index.html direct laadt.
for (const [, pad] of lees('index.html').matchAll(/(?:src|href)="((?:css|js|icons|fonts|img)\/[^"]+)"/g)) {
  assert.ok(appSchil.has(pad), `index.html laadt ${pad}, maar dat staat niet in APP_SCHIL in sw.js`);
}

console.log(`appschil: alle tests geslaagd (${gezien.size} modules, ${appSchil.size} bestanden)`);
