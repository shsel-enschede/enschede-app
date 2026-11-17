import assert from 'node:assert/strict';
// Test van de proeffoto-paden in js/github.js. Draaien: node tests/proeffotos.test.mjs
// Een bestandsnaam uit content/fotos.json mag nooit buiten de map met proeffoto's wijzen.
const gh = await import(new URL('../js/github.js', import.meta.url));

const basis = `https://api.github.com/repos/shsel-enschede/${gh.PROEF_REPO}/contents/${gh.PROEF_MAP}/`;
assert.equal(gh.proeffotoPad('jacobuskerk-nu.webp'), `${basis}jacobuskerk-nu.webp`);
assert.equal(gh.proeffotoPad('villa-1900.jpg'), `${basis}villa-1900.jpg`);
for (const fout of ['../geheim.webp', 'map/foto.webp', 'Foto.webp', 'foto.svg', 'foto.webp?x=1', '', null, 42, '-foto.webp', 'foto%2e.webp']) {
  assert.equal(gh.proeffotoPad(fout), null, `moet geweigerd worden: ${fout}`);
}
// Zonder sleutel wordt niets opgehaald.
assert.equal(await gh.haalProeffoto('jacobuskerk-nu.webp'), null);
console.log('proeffotos: geslaagd');
