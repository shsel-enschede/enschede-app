// Koppeling tussen de editor (beheer.html) en GitHub.
// De editor praat rechtstreeks vanuit de browser met de GitHub-API; er is geen eigen server.
// De contentbeheerder merkt hier niets van: alle meldingen zijn in gewone taal (zie gewoneTaal()).
//
// Veiligheid (zie CLAUDE.md, "Editor voor vrijwilligers"):
// - Elke contentbeheerder heeft een eigen fine-grained sleutel: alleen deze repository,
//   alleen Contents en Pull requests schrijven, verloopt na een jaar.
// - De sleutel gaat alleen naar https://api.github.com (afgedwongen door de CSP van beheer.html).
// - Alles wat van GitHub terugkomt is onbetrouwbare data; het scherm gebruikt alleen textContent.
// - main is beschermd: een voorstel wordt pas live als een beheerder het samenvoegt.

export const EIGENAAR = 'shsel-enschede';
export const REPO = 'enschede-app';
export const HOOFDTAK = 'main';
export const VOORSTEL_PREFIX = 'inhoud/';
const API = 'https://api.github.com';
const BASIS = `${API}/repos/${EIGENAAR}/${REPO}`;

const SLEUTEL_OPSLAG = 'enschede-app:beheer-sleutel';
const SLEUTEL_PATROON = /^github_pat_[A-Za-z0-9_]{20,255}$/;
const OUDE_SLEUTEL = /^(ghp|gho|ghu|ghs|ghr)_/;
export const TAK_PATROON = /^inhoud\/[a-z0-9-]{1,100}$/;
const SHA_PATROON = /^[0-9a-f]{40}$/;

let sleutel = null;

// ---------- Sleutel ----------

/** Controleer de vorm van een sleutel. Geeft een melding in gewone taal, of null als hij goed lijkt. */
export function controleerSleutel(tekst) {
  if (!tekst) return 'Plak eerst je sleutel in het vak.';
  if (OUDE_SLEUTEL.test(tekst)) {
    return 'Dit is een oude soort sleutel met te veel rechten. Vraag een beheerder om een nieuwe, persoonlijke sleutel (die begint met github_pat_).';
  }
  if (!SLEUTEL_PATROON.test(tekst)) return 'Dit lijkt geen geldige sleutel. Een sleutel begint met github_pat_ en heeft geen spaties.';
  return null;
}

export function zetSleutel(tekst, onthouden) {
  sleutel = tekst;
  try {
    sessionStorage.removeItem(SLEUTEL_OPSLAG);
    localStorage.removeItem(SLEUTEL_OPSLAG);
    (onthouden ? localStorage : sessionStorage).setItem(SLEUTEL_OPSLAG, tekst);
  } catch { /* geen opslag: de sleutel geldt alleen zolang de pagina open is */ }
}

export function leesBewaardeSleutel() {
  try {
    const s = sessionStorage.getItem(SLEUTEL_OPSLAG) ?? localStorage.getItem(SLEUTEL_OPSLAG);
    if (s && !controleerSleutel(s)) { sleutel = s; return true; }
  } catch { /* geen opslag */ }
  return false;
}

/** Uitloggen: de sleutel verdwijnt uit het geheugen en uit de browser. */
export function wisSleutel() {
  sleutel = null;
  try {
    sessionStorage.removeItem(SLEUTEL_OPSLAG);
    localStorage.removeItem(SLEUTEL_OPSLAG);
  } catch { /* niets */ }
}

export const heeftSleutel = () => sleutel !== null;

/** Link om een sleutel aan te maken met de juiste rechten al ingevuld (GitHub, template-URL). */
export function sleutelLink() {
  const p = new URLSearchParams({
    name: 'Editor Enschede app',
    description: 'Persoonlijke sleutel voor de editor van de Enschede app (SHSEL).',
    target_name: EIGENAAR,
    expires_in: '365',
    contents: 'write',
    pull_requests: 'write',
  });
  return `https://github.com/settings/personal-access-tokens/new?${p}`;
}

// ---------- Fouten in gewone taal ----------

export class GitHubFout extends Error {
  constructor(status, bericht, details) {
    super(bericht);
    this.status = status;
    this.details = details;
  }
}

/** Zet een fout om in een zin voor een vrijwilliger. Nooit "409 Conflict". */
export function gewoneTaal(fout) {
  if (!(fout instanceof GitHubFout)) {
    return 'Er is geen verbinding met GitHub. Controleer je internetverbinding en probeer het opnieuw. Je werk blijft bewaard in deze browser.';
  }
  switch (fout.status) {
    case 401:
      return 'Je sleutel werkt niet meer: hij is verlopen of ingetrokken. Vraag een beheerder om een nieuwe sleutel. Je werk blijft bewaard in deze browser.';
    case 403:
    case 429:
      if (/rate limit/i.test(fout.message)) return 'GitHub vraagt even pauze. Wacht een paar minuten en probeer het opnieuw. Je werk blijft bewaard.';
      return 'Je sleutel heeft niet genoeg rechten voor deze stap. Vraag een beheerder om je sleutel te controleren.';
    case 404:
      return 'De Enschede app is met deze sleutel niet te vinden. Vraag een beheerder of je sleutel toegang heeft tot de Enschede app.';
    case 409:
    case 422:
      return 'Iemand anders heeft dit net aangepast. Ververs de lijst en probeer het opnieuw.';
    default:
      return 'GitHub geeft nu een fout. Probeer het over een paar minuten opnieuw. Je werk blijft bewaard in deze browser.';
  }
}

// ---------- Basis ----------

async function vraag(pad, { methode = 'GET', body, raw = false } = {}) {
  if (!sleutel) throw new GitHubFout(401, 'Geen sleutel');
  const antwoord = await fetch(pad.startsWith('http') ? pad : `${BASIS}${pad}`, {
    method: methode,
    cache: 'no-store',
    referrerPolicy: 'no-referrer',
    headers: {
      Accept: raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      Authorization: `Bearer ${sleutel}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!antwoord.ok) {
    let details = null;
    try { details = await antwoord.json(); } catch { /* geen json */ }
    throw new GitHubFout(antwoord.status, details?.message ?? antwoord.statusText, details);
  }
  if (antwoord.status === 204) return null;
  return raw ? antwoord.text() : antwoord.json();
}

function sha(waarde) {
  if (typeof waarde !== 'string' || !SHA_PATROON.test(waarde)) throw new GitHubFout(500, 'Onverwacht antwoord van GitHub');
  return waarde;
}

// ---------- Wie ben ik ----------

/** Controleer de sleutel bij GitHub. Geeft { login, naam }. */
export async function wieBenIk() {
  const [gebruiker, repo] = await Promise.all([vraag(`${API}/user`), vraag('')]);
  if (repo?.permissions && repo.permissions.push !== true) {
    throw new GitHubFout(403, 'Geen schrijfrechten op de repository');
  }
  const login = String(gebruiker?.login ?? '');
  if (!/^[A-Za-z0-9-]{1,39}$/.test(login)) throw new GitHubFout(500, 'Onverwacht antwoord van GitHub');
  const naam = typeof gebruiker.name === 'string' && gebruiker.name.trim() ? gebruiker.name.trim().slice(0, 80) : login;
  return { login, naam };
}

// ---------- Lezen ----------

export async function takSha(tak) {
  const ref = await vraag(`/git/ref/heads/${tak}`);
  return sha(ref?.object?.sha);
}

/** De tekst van een bestand op een tak of commit. */
export function leesBestand(pad, ref) {
  return vraag(`/contents/${pad}?ref=${encodeURIComponent(ref)}`, { raw: true });
}

/** Vergelijk een voorstel met main: gemeenschappelijke basis en hoeveel main intussen verder is. */
export async function vergelijk(tak) {
  const v = await vraag(`/compare/${HOOFDTAK}...${tak}`);
  return { basis: sha(v?.merge_base_commit?.sha), achter: Number(v?.behind_by) || 0 };
}

async function boomVan(commit) {
  const c = await vraag(`/git/commits/${sha(commit)}`);
  return sha(c?.tree?.sha);
}

// ---------- Schrijven ----------

/**
 * Maak één commit met de gegeven bestanden. Dit gebeurt in één keer: lukt een stap niet,
 * dan verandert er niets op GitHub (de tak wordt pas daarna verplaatst of aangemaakt).
 */
export async function maakCommit({ ouders, boomVanCommit, bestanden, bericht }) {
  const basisBoom = await boomVan(boomVanCommit);
  const boom = await vraag('/git/trees', {
    methode: 'POST',
    body: {
      base_tree: basisBoom,
      tree: bestanden.map(({ pad, tekst }) => ({ path: pad, mode: '100644', type: 'blob', content: tekst })),
    },
  });
  const commit = await vraag('/git/commits', {
    methode: 'POST',
    body: { message: bericht, tree: sha(boom?.sha), parents: ouders.map(sha) },
  });
  return sha(commit?.sha);
}

export async function maakTak(tak, commit) {
  if (!TAK_PATROON.test(tak)) throw new GitHubFout(422, 'Ongeldige naam');
  await vraag('/git/refs', { methode: 'POST', body: { ref: `refs/heads/${tak}`, sha: sha(commit) } });
}

/** Verplaats een tak naar een nieuwe commit. Nooit forceren: is de tak intussen veranderd, dan faalt dit. */
export async function verplaatsTak(tak, commit) {
  if (!TAK_PATROON.test(tak)) throw new GitHubFout(422, 'Ongeldige naam');
  await vraag(`/git/refs/heads/${tak}`, { methode: 'PATCH', body: { sha: sha(commit), force: false } });
}

export async function verwijderTak(tak) {
  if (!TAK_PATROON.test(tak)) return;
  await vraag(`/git/refs/heads/${tak}`, { methode: 'DELETE' });
}

// ---------- Voorstellen (pull requests) ----------

function leesVoorstel(pr) {
  const tak = pr?.head?.ref;
  const vanHier = pr?.head?.repo?.full_name === `${EIGENAAR}/${REPO}` && pr?.base?.ref === HOOFDTAK;
  if (!vanHier || typeof tak !== 'string' || !TAK_PATROON.test(tak) || !Number.isInteger(pr.number)) return null;
  return {
    nummer: pr.number,
    titel: String(pr.title ?? '').slice(0, 200),
    tak,
    kop: sha(pr.head.sha),
    auteur: String(pr.user?.login ?? ''),
    open: pr.state === 'open',
    live: Boolean(pr.merged_at),
    bijgewerkt: String(pr.updated_at ?? ''),
  };
}

export async function openVoorstel({ titel, tekst, tak }) {
  await vraag('/pulls', { methode: 'POST', body: { title: titel, body: tekst, head: tak, base: HOOFDTAK } });
}

export async function werkVoorstelBij(nummer, { titel, tekst }) {
  await vraag(`/pulls/${Number(nummer)}`, { methode: 'PATCH', body: { title: titel, body: tekst } });
}

export async function sluitVoorstel(nummer) {
  await vraag(`/pulls/${Number(nummer)}`, { methode: 'PATCH', body: { state: 'closed' } });
}

/** Alle voorstellen uit de editor (takken die met inhoud/ beginnen), nieuwste eerst. */
export async function voorstellen() {
  const lijst = await vraag('/pulls?state=all&sort=updated&direction=desc&per_page=50');
  return (Array.isArray(lijst) ? lijst : []).map((pr) => {
    try { return leesVoorstel(pr); } catch { return null; }
  }).filter(Boolean);
}

export async function beoordelingen(nummer) {
  const lijst = await vraag(`/pulls/${Number(nummer)}/reviews?per_page=100`);
  return (Array.isArray(lijst) ? lijst : []).map((r) => ({
    door: String(r?.user?.login ?? ''),
    oordeel: String(r?.state ?? ''),
    tekst: typeof r?.body === 'string' ? r.body.slice(0, 2000) : '',
    commit: String(r?.commit_id ?? ''),
    moment: String(r?.submitted_at ?? ''),
  }));
}

/** Akkoord (APPROVE) of Opmerking (REQUEST_CHANGES) op precies de versie die de collega heeft bekeken. */
export async function beoordeel(nummer, kop, akkoord, tekst) {
  await vraag(`/pulls/${Number(nummer)}/reviews`, {
    methode: 'POST',
    body: { commit_id: sha(kop), event: akkoord ? 'APPROVE' : 'REQUEST_CHANGES', body: tekst },
  });
}
