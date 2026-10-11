// Draai alle tests in één keer: node tests/alles.mjs (Node 18 of nieuwer, geen npm nodig; werkt ook op Windows).
// Doe dit vóór elke pull request. Bij een fout stopt het met een melding in het Nederlands.
import { readdirSync } from 'node:fs';

const map = new URL('./', import.meta.url);
for (const naam of readdirSync(map).filter((n) => n.endsWith('.test.mjs')).sort()) {
  await import(new URL(naam, map));
}
console.log('\nALLE TESTS GESLAAGD');
