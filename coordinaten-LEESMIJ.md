# Coördinaten: betrouwbaar bepalen en vastleggen

Contentbeheerders weten veel van geschiedenis, maar hoeven niet te weten hoe je goede coördinaten krijgt.
Daarom regelen de **beheerders** (nu René en Gerard) alle coördinaten, met open bronnen van de overheid. Contentbeheerders hebben hier geen rol: zij noemen in hun tekst alleen over welk gebouw of object het gaat.

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
4. **`positie` van een plek = het kijkpunt:** de plek op **openbaar terrein** (stoep of plein) waar de bezoeker staat en ziet waar de vraag over gaat. Niet op de rijbaan, het fietspad of privéterrein. Hoe je het bepaalt: zie **Het kijkpunt bepalen** hieronder.

### Nauwkeurigheid

- `beheer.html` slaat **6 decimalen** op (ongeveer 10 cm). Dat mag, maar reken op een echte nauwkeurigheid van ongeveer 1 meter: beter is de luchtfoto niet. De huidige posities hebben vaak 4 decimalen (ongeveer 10 meter) en staan nog op `"bevestigd": false`.
- Een telefoon heeft in de binnenstad een afwijking van 5–20 meter door weerkaatsing tegen gebouwen. Daarom is de straal 30–40 meter (afgesproken in CLAUDE.md) en zegt de app bij een onzekerheid van meer dan 50 meter "Locatie nog onzeker…".
- **Volgorde:** in `content/` altijd breedte, dan lengte: `{"lat": 52.22, "lng": 6.89}` en `[lat, lng]`. Let op: GeoJSON en sommige websites gebruiken de omgekeerde volgorde (lengte, breedte). Enschede ligt rond breedte **52,2** en lengte **6,9**; staan die getallen omgedraaid, dan ligt het punt in Somalië.

### Wie doet wat

| Wie | Taak |
| --- | --- |
| **Contentbeheerder** | Noemt in de tekst over welk gebouw of object het gaat. Verder niets met coördinaten. |
| **Beheerders** (René, Gerard) | Kiezen het gebouw (Kadaster-adres) of tekenen de vorm, bepalen het kijkpunt op de luchtfoto en controleren het ter plekke. Alleen zij zetten **Positie gecontroleerd** aan. |

## Het kijkpunt bepalen

Bepaal het kijkpunt **eerst op de luchtfoto** en **controleer het daarna één keer ter plekke**. Neem de GPS-waarde van je telefoon niet over: die wijkt in de binnenstad 5–20 meter af, terwijl je op de luchtfoto tot op de stoeptegel nauwkeurig werkt.

### Vooraf: wat moet je zien?

Lees de vraag en het verhaal en bepaal het **kenmerk**: de toren, een gevelsteen, de ingang of het jaartal boven de deur. Het kijkpunt is de plek waar je dat kenmerk goed ziet.

### Stap 1: op de luchtfoto (achter de computer)

1. Open `beheer.html` en kies de plek.
2. Kies bij **Gebouw** het adres en klik op **Zoek op in het Kadaster**. De rode omtrek is de plattegrond van het pand.
3. Klik eventueel op **Gebruik adres als positie**. Let op: dat punt ligt **in** het gebouw. Het is alleen een beginpunt, geen kijkpunt.
4. Klik op **Luchtfoto** en zoom zo ver in dat je stoeptegels, lantaarnpalen en bomen ziet.
5. Sleep de rode speld naar de plek waar de bezoeker staat:
   - op de stoep of het plein, aan de kant van het kenmerk;
   - op 3 tot 10 meter van de gevel. Bij een hoge gevel of toren mag het verder weg, bijvoorbeeld aan de overkant van een plein, zodat je het geheel ziet;
   - niet op de rijbaan, het fietspad of privéterrein, en niet aan de overkant van een drukke weg (denk aan kinderen).
6. **Let op scheve daken.** Een luchtfoto is iets schuin genomen, waardoor daken en torens verschoven lijken ten opzichte van de voet van het gebouw. Gebruik daarom de rode Kadaster-omtrek als muurlijn, niet de dakrand op de foto.
7. Laat **Positie gecontroleerd** nog uit.

### Link naar de luchtfoto

Onder **Positie van de plek** staat een link die precies op dat punt de luchtfoto opent, bijvoorbeeld:

`https://shsel-enschede.github.io/enschede-app/beheer.html#plek=jacobuskerk&lat=52.221900&lng=6.894000`

- Met **Kopieer link** stuur je hem naar de andere beheerder ("klopt dit kijkpunt?") of naar jezelf voor de veldtest.
- Je kunt ook zelf een link maken: vervang `plek`, `lat` (breedte, rond 52,2) en `lng` (lengte, rond 6,9). Gebruik een **punt** als decimaalteken.
- Een link verandert nooit iets. Wijkt het punt uit de link af van de opgeslagen positie, dan zie je een **blauw rondje** naast de rode speld, met de afstand ertussen. Wil je dat punt gebruiken, sleep de speld er dan zelf naartoe.
- De link werkt pas op de live site als deze beheerpagina daar staat (na samenvoegen).

### Stap 2: ter plekke controleren (veldtest)

1. Open de link van de plek op je telefoon en loop naar het punt dat je op de luchtfoto koos.
2. Kijk of je het kenmerk goed ziet en er veilig kunt staan. Is het niet goed, onthoud dan een **vast herkenningspunt** waar het wél goed is, zoals een lantaarnpaal, een boom, een putdeksel of een hoek van de stoep.
3. Schuif de speld thuis op de luchtfoto naar dat herkenningspunt. Dat is nauwkeuriger dan de GPS van je telefoon.
4. Maak een **foto vanaf het kijkpunt**. Die kan later als herkenningsfoto in de app.
5. Zet daarna **Positie gecontroleerd** aan.

Test meteen de straal: zet GPS aan in de app en loop naar het gebouw toe, ook van de andere kanten. Rond 35 meter van de muur hoort "Je bent er!" te verschijnen.

### Bijzondere gevallen

| Geval | Kijkpunt |
| --- | --- |
| **Groot gebouw** (Grote Kerk, fabriek) | Aan de kant van het kenmerk uit de vraag. Gaat de vraag niet over een kenmerk, dan bij de hoofdingang. |
| **Hoekpand** | De kant waar je het kenmerk ziet en het rustigst staat. |
| **Klein object** (zonnewijzer, gedenksteen) | Zo dichtbij dat je het kunt lezen. |
| **Verdwenen gebouw** | Het liefst het **standpunt van de oude foto**: waar de fotograaf toen stond. Dan kan de bezoeker toen en nu vergelijken (*rephotography*, een beproefde methode bij historische wandelingen). |
| **Meerdere verhalen bij één gebouw** | Elk verhaal een eigen kijkpunt bij zijn eigen kenmerk, bijvoorbeeld toren en ingang. |

### Tijd

Achter de computer kost het ongeveer 5 minuten per plek. De veldtest voor de binnenstad kan in één wandeling van ongeveer 2 uur.

## Voorstel, nog niet gebouwd

- Per gebouw en plek vastleggen **waar het coördinaat vandaan komt**: bron (BAG, RCE, OSM, oude kaart, veldmeting) en datum van controle.
- Een **automatische controle** bij elke pull request die meldt als:
  - een punt buiten Enschede/Lonneker valt;
  - breedte en lengte waarschijnlijk zijn omgedraaid;
  - de `positie` van een plek meer dan 75 meter van de rand van het gebouw ligt;
  - een adres niet in de BAG gevonden wordt.

Hierover besluiten de beheerders; daarna kan het in een aparte pull request worden gebouwd.
