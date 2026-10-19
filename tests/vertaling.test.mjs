import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
// Test van de vertalingen in content/locaties.json. Draaien: node tests/vertaling.test.mjs (Node 18 of nieuwer).
// Zie CLAUDE.md (Taal, Meertaligheid): een vraag in het Engels of Duits wordt alleen getoond als hij compleet is
// en bij de huidige Nederlandse vraag hoort (vingerafdruk in 'vertaling').
const { vingerafdruk, vertaalbron } = await import(new URL('../js/hulp.js', import.meta.url));
const data = JSON.parse(readFileSync(new URL('../content/locaties.json', import.meta.url), 'utf8'));

// Vingerafdruk: vast, kort, en anders bij elke wijziging
assert.equal(vingerafdruk('Grote Kerk'), vingerafdruk('Grote Kerk'));
assert.match(vingerafdruk({ a: 1 }), /^[0-9a-f]{8}$/);
assert.notEqual(vingerafdruk('Grote Kerk'), vingerafdruk('Grote kerk'));
const plek = { titel: { nl: 'A' }, tekst: { nl: 'B' }, vraag: { nl: { tekst: 'C?', opties: ['1', '2'], uitleg: 'D' } }, juist: 0 };
const voor = vertaalbron(plek);
assert.equal(vertaalbron({ ...plek, juist: 1 }).verhaal, voor.verhaal, 'ander goed antwoord: verhaal blijft actueel');
assert.notEqual(vertaalbron({ ...plek, juist: 1 }).vraag, voor.vraag, 'ander goed antwoord: vraag verouderd');
assert.notEqual(vertaalbron({ ...plek, tekst: { nl: 'B!' } }).verhaal, voor.verhaal);

// De inhoud zelf
const STATUSSEN = ['controleren', 'bijgewerkt'];
const verouderd = [];
for (const loc of data.locaties.filter((l) => !l.concept)) {
  const bron = vertaalbron(loc);
  for (const t of ['en', 'de']) {
    const v = loc.vraag?.[t];
    if (!v) continue; // nog niet vertaald: de app toont Nederlands
    const waar = `${loc.id} (${t})`;
    assert.equal(v.opties?.length, loc.vraag.nl.opties.length, `${waar}: ander aantal antwoorden dan het Nederlands`);
    assert.ok([v.tekst, v.uitleg, ...v.opties].every((s) => typeof s === 'string' && s.trim()), `${waar}: lege vraag, uitleg of optie`);
    assert.ok(loc.titel?.[t]?.trim() && loc.tekst?.[t]?.trim(), `${waar}: titel of verhaal ontbreekt`);
    const st = loc.vertaling?.[t];
    assert.ok(st && STATUSSEN.includes(st.status), `${waar}: 'vertaling' met status ${STATUSSEN.join(' of ')} ontbreekt`);
    if (st.vraag !== bron.vraag) verouderd.push(`${waar}: vraag`);
    if (st.verhaal !== bron.verhaal) verouderd.push(`${waar}: verhaal`);
  }
}
// Vertaalde gebouwnamen (kaart): beide talen, kort genoeg, en bij de huidige Nederlandse naam
for (const g of data.gebouwen ?? []) {
  const v = g.naamVertaald;
  if (!v) continue; // eigennaam: overal Nederlands
  for (const t of ['en', 'de']) {
    assert.ok(typeof v[t] === 'string' && v[t].trim() && v[t].length <= 80, `gebouw ${g.id}: naam (${t}) ontbreekt of is langer dan 80 tekens`);
  }
  if (v.bron !== vingerafdruk(g.naam)) verouderd.push(`gebouw ${g.id}: naam op de kaart`);
}

// Verouderd is geen fout (de app toont dan de Nederlandse vraag), maar wel goed om te weten.
if (verouderd.length) console.info(`Verouderde vertalingen (Nederlands gewijzigd na het vertalen):\n  ${verouderd.join('\n  ')}`);
console.log('vertaling.test: alles goed');
