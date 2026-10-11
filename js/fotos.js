// Foto's bij een plek: klein bij elkaar (mozaïek), groot in een fotovenster.
//
// Waarom zo (okt 2026): drie foto's onder elkaar namen meer dan een heel scherm in; verhaal en vraag
// begonnen pas op scherm 2. In het mozaïek staan alle foto's in ca. 200 px: de eerste groot (herkennen
// ter plekke), de rest klein ernaast. Tik op een foto: groot, met bijschrift en bron, vegen naar de volgende.
// Geen automatisch draaien. Het fotovenster is een <dialog>: focus blijft erin, Escape sluit, en de
// terugknop van de telefoon sluit het ook (via een eigen stap in de geschiedenis).

import { maak, scrolGedrag } from './hulp.js';

const MAX_TEGELS = 3; // hoofdfoto + 2 klein; bij meer staat "+N" op de laatste

const $ = (id) => document.getElementById(id);
let huidige = []; // foto's van de plek die nu open is
let open = false;

/** Vul `houder` met de foto's. `toegankelijk` false = nog niet ter plekke: één wazige foto, niet te vergroten. */
export function toonFotos(houder, fotos, { toegankelijk }) {
  const zichtbaar = toegankelijk ? fotos : fotos.slice(0, 1);
  huidige = zichtbaar;
  houder.replaceChildren();
  houder.hidden = !zichtbaar.length;
  houder.classList.toggle('fotos--wazig', !toegankelijk);
  if (!zichtbaar.length) return;

  const tegels = zichtbaar.slice(0, MAX_TEGELS);
  const mozaiek = maak('div', `mozaiek mozaiek--${tegels.length}`);
  tegels.forEach((foto, i) => {
    const img = maak('img');
    img.src = foto.src;
    img.alt = '';
    img.decoding = 'async';
    if (i > 0) img.loading = 'lazy';
    // Een foto die niet laadt (ontbreekt in de map): opnieuw opbouwen zonder die foto, geen kapot plaatje.
    img.addEventListener('error', () => {
      toonFotos(houder, fotos.filter((f) => f !== foto), { toegankelijk });
    }, { once: true });

    if (!toegankelijk) {
      const vak = maak('div', 'mozaiek__tegel');
      vak.append(img);
      mozaiek.append(vak);
      return;
    }
    const knop = maak('button', 'mozaiek__tegel');
    knop.type = 'button';
    knop.append(img);
    const rest = zichtbaar.length - MAX_TEGELS;
    const label = `Foto ${i + 1} van ${zichtbaar.length} vergroten${foto.alt ? `: ${foto.alt}` : ''}`;
    if (i === tegels.length - 1 && rest > 0) {
      knop.append(maak('span', 'mozaiek__meer', `+${rest}`));
      knop.setAttribute('aria-label', `${label}. Nog ${rest} foto's.`);
    } else {
      knop.setAttribute('aria-label', label);
    }
    knop.addEventListener('click', () => openVenster(i));
    mozaiek.append(knop);
  });
  houder.append(mozaiek);

  if (zichtbaar.some((f) => f.proef)) houder.append(maak('span', 'foto__proef', 'Proef: rechten nog niet bevestigd'));

  // Eén regel onder het mozaïek: hoeveel foto's, van wie, en dat je kunt vergroten (wegwijzer).
  if (toegankelijk) {
    const bronnen = [...new Set(zichtbaar.map((f) => f.maker).filter(Boolean))];
    const delen = [zichtbaar.length === 1 ? '1 foto' : `${zichtbaar.length} foto's`];
    if (bronnen.length) delen.push(`bron: ${bronnen.join(', ')}`);
    delen.push('tik om te vergroten');
    houder.append(maak('p', 'fotos__onder', delen.join(' · ')));
  }
}

// ---------- Fotovenster ----------

function openVenster(start) {
  const venster = $('fotovenster');
  const rij = $('fotovenster-rij');
  rij.replaceChildren(...huidige.map((foto, i) => {
    const figuur = maak('figure', 'fotovenster__foto');
    const img = maak('img');
    img.src = foto.src;
    img.alt = foto.alt ?? '';
    img.decoding = 'async';
    if (Math.abs(i - start) > 1) img.loading = 'lazy';
    figuur.append(img);
    if (foto.proef) figuur.append(maak('span', 'foto__proef', 'Proef: rechten nog niet bevestigd'));
    const onder = maak('figcaption', '', foto.bijschrift ?? '');
    if (foto.bron) onder.append(maak('span', 'foto__bron', `Bron: ${foto.bron}`));
    figuur.append(onder);
    return figuur;
  }));
  const meer = huidige.length > 1;
  $('fotovenster-vorige').hidden = !meer;
  $('fotovenster-volgende').hidden = !meer;
  $('fotovenster-teller').hidden = !meer;

  venster.showModal();
  open = true;
  history.pushState({ fotovenster: true }, ''); // terugknop sluit het venster, niet de plek
  rij.scrollTo({ left: start * rij.clientWidth, behavior: 'auto' });
  werkTellerBij(start);
}

function index() {
  const rij = $('fotovenster-rij');
  return Math.round(rij.scrollLeft / Math.max(1, rij.clientWidth));
}

function werkTellerBij(i = index()) {
  $('fotovenster-teller').textContent = `${i + 1} / ${huidige.length}`;
  $('fotovenster-vorige').disabled = i <= 0;
  $('fotovenster-volgende').disabled = i >= huidige.length - 1;
}

function ganaar(stap) {
  const rij = $('fotovenster-rij');
  const doel = Math.min(huidige.length - 1, Math.max(0, index() + stap));
  rij.scrollTo({ left: doel * rij.clientWidth, behavior: scrolGedrag() });
}

/** Eenmalig bij het starten van de app. */
export function zetFotovensterKlaar() {
  const venster = $('fotovenster');
  const rij = $('fotovenster-rij');
  let wacht = false;
  rij.addEventListener('scroll', () => {
    if (wacht) return;
    wacht = true;
    requestAnimationFrame(() => { wacht = false; werkTellerBij(); });
  }, { passive: true });
  $('fotovenster-vorige').addEventListener('click', () => ganaar(-1));
  $('fotovenster-volgende').addEventListener('click', () => ganaar(1));
  $('fotovenster-sluit').addEventListener('click', () => venster.close());
  venster.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); ganaar(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); ganaar(1); }
  });
  // Tik naast de foto (op de donkere achtergrond van het venster zelf) sluit ook.
  venster.addEventListener('click', (e) => { if (e.target === venster) venster.close(); });
  // Gesloten met ✕ of Escape: de eigen stap in de geschiedenis weer weghalen.
  venster.addEventListener('close', () => {
    if (!open) return;
    open = false;
    if (history.state?.fotovenster) history.back();
  });
  // Gesloten met de terugknop van de telefoon.
  addEventListener('popstate', () => {
    if (!open) return;
    open = false;
    venster.close();
  });
}

/** Sluiten zonder de geschiedenis aan te raken (bijv. bij een schermwissel). */
export function sluitFotovenster() {
  if (!open) return;
  open = false;
  $('fotovenster').close();
}
