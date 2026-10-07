# Coördinaten: betrouwbaar bepalen en vastleggen

Contentbeheerders weten veel van geschiedenis, maar hoeven niet te weten hoe je goede coördinaten krijgt.
Daarom regelen de beheerders de coördinaten, met open bronnen van de overheid. De contentbeheerder levert alleen een **adres** of een **omschrijving** aan, plus een foto van de plek waar je moet staan.

Opgesteld in oktober 2026. Sommige punten zijn al zo gebouwd, andere zijn een voorstel. Dat staat er steeds bij.

## Bronnen, van best naar minst

| Bron | Waarvoor | Licentie |
| --- | --- | --- |
| **BAG via PDOK** (Kadaster) | Elk bestaand adres en gebouw, inclusief de omtrek van het pand. Dit gebruikt de app al. | CC0, vrij te gebruiken zonder sleutel |
| **Rijksmonumentenregister** (RCE) | Monumenten, met een officieel coördinaat per monument | Open data |
| **Wikidata / OpenStreetMap** | Beelden, pleinen, bruggen en andere plekken zonder adres | CC0 / ODbL (bij OSM bronvermelding verplicht) |
| **Topotijdreis.nl, HISGIS, oude kaarten** | Verdwenen gebouwen | Handmatig bepalen |
| Google Maps | Niet gebruiken. De voorwaarden van Google verbieden het opslaan van die gegevens, en de app gebruikt geen Google (zie CLAUDE.md). | – |

## Hoe de app met plaatsen werkt (al gebouwd)

In `content/locaties.json` horen twee dingen bij elkaar:

- **Het gebouw** (`gebouwen`): met `adres` (echt adres met huisnummer) zoekt de app de **omtrek** van het pand op in de BAG. Bij een verdwenen gebouw of een klein object op straat teken je zelf een `vorm` (lijst van `[lat, lng]`).
- **De plek** (`locaties`): het verhaal met de vraag, met een eigen `positie` (`lat`, `lng`, `bevestigd`) en een verwijzing `gebouw`.

De app meet de afstand tot de **rand** van het gebouw, niet tot het midden. Daarmee is het probleem van grote gebouwen al grotendeels opgelost: bij de Grote Kerk ben je er zodra je binnen de straal (`instellingen.straal`, standaard 35 m) van een van de muren staat, aan welke kant ook.

Voor afstanden gebruikt de app de `positie` van een plek alleen als het gebouw geen bekende omtrek heeft.

## Afspraken

### Waar ligt het punt?

1. **Bestaand gebouw met adres:** gebruik `adres` met huisnummer. De BAG geeft de omtrek, verder hoef je niets te meten.
   - Heeft een gebouw meerdere adressen, kies dan het adres van de hoofdingang. De BAG-omtrek is hetzelfde.
2. **Klein object zonder adres** (beeld, zonnewijzer, gedenksteen): teken een kleine `vorm` om het object heen, op de luchtfoto van PDOK in `beheer.html`.
3. **Verdwenen gebouw:** teken de historische omtrek als `vorm`, met Topotijdreis.nl of een oude kaart als bron. Zet de bron in de `toelichting` van het gebouw.
4. **`positie` van een plek** ligt op **openbaar terrein** (stoep, plein, fietspad), op de plek waar je het onderwerp van de vraag ziet: de gevel, de gevelsteen of de ingang. Dus niet midden op een kruispunt of op privéterrein.

### Nauwkeurigheid

- Noteer **5 decimalen** (ongeveer 1 meter). Meer decimalen suggereren een precisie die er niet is. De huidige posities hebben vaak 4 decimalen (ongeveer 10 meter) en staan nog op `"bevestigd": false`.
- Een telefoon heeft in de binnenstad een afwijking van 5–20 meter door weerkaatsing tegen gebouwen. Daarom is de straal 30–40 meter (afgesproken in CLAUDE.md) en zegt de app bij een onzekerheid van meer dan 50 meter "Locatie nog onzeker…".
- **Volgorde:** in `content/` altijd breedte, dan lengte: `{"lat": 52.22, "lng": 6.89}` en `[lat, lng]`. Let op: GeoJSON en sommige websites gebruiken de omgekeerde volgorde (lengte, breedte). Enschede ligt rond breedte **52,2** en lengte **6,9**; staan die getallen omgedraaid, dan ligt het punt in Somalië.

### Wie doet wat

1. **Contentbeheerder:** levert adres of omschrijving en een foto van de plek waar je moet staan.
2. **Beheerder:** kiest in `beheer.html` het gebouw (Kadaster-adres) of tekent de vorm, en zet de `positie` op de luchtfoto.
3. **Veldtest:** één keer ter plekke met de app lopen, met `instellingen.ontgrendelen` op `"ter-plekke"`. Gaat de plek op de goede plek open, dan zet een beheerder `positie.bevestigd` op `true`.

## Voorstel, nog niet gebouwd

- Per gebouw en plek vastleggen **waar het coördinaat vandaan komt**: bron (BAG, RCE, OSM, oude kaart, veldmeting) en datum van controle.
- Een **automatische controle** bij elke pull request die meldt als:
  - een punt buiten Enschede/Lonneker valt;
  - breedte en lengte waarschijnlijk zijn omgedraaid;
  - de `positie` van een plek meer dan 75 meter van de rand van het gebouw ligt;
  - een adres niet in de BAG gevonden wordt.

Hierover besluiten de beheerders; daarna kan het in een aparte pull request worden gebouwd.
