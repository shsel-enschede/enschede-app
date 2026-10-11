// Vaste kaartgegevens op één plek: de adressen van PDOK en het kaartgebied rond Enschede.
// Verandert PDOK een adres (dat gebeurt af en toe bij een nieuwe versie van een dienst), dan pas je het
// alleen hier aan. Let op: de Content-Security-Policy in index.html en beheer.html moet de domeinen
// (service.pdok.nl, api.pdok.nl) blijven toestaan, en verhoog VERSIE in sw.js.

// Kaartlaag: BRT-Achtergrondkaart (grijs) van PDOK, de geodienst van de overheid. Gratis, zonder sleutel, zonder tracking.
export const PDOK_KAART = 'https://service.pdok.nl/brt/achtergrondkaart/wmts/v2_0/grijs/EPSG:3857/{z}/{x}/{y}.png';
// Luchtfoto (alleen in de editor): om te controleren of een positie op het goede gebouw staat.
export const PDOK_LUCHTFOTO = 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg';
// Adres zoeken (Locatieserver) en gebouwomtrekken (BAG, Kadaster).
export const PDOK_ZOEK = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1/free';
export const PDOK_BAG = 'https://api.pdok.nl/kadaster/bag/ogc/v2/collections/pand/items';

// Kaartgebied: ruim rond Enschede. Verder schuiven kan niet; een link met een punt daarbuiten wordt genegeerd.
export const GRENZEN = [[52.15, 6.75], [52.30, 7.00]]; // [[zuid, west], [noord, oost]]
export const MIDDEN = [52.2219, 6.894]; // Oude Markt: beginbeeld

/** Ligt het punt binnen het kaartgebied? */
export function binnenKaart(lat, lng) {
  const [[zuid, west], [noord, oost]] = GRENZEN;
  return lat >= zuid && lat <= noord && lng >= west && lng <= oost;
}
