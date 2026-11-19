# Coördinaten: posities van gebouwen en plekken

De **beheerders** (nu René en Gerard) zetten alle posities, met de luchtfoto in `beheer.html`. Contentbeheerders hebben hier geen rol: zij noemen in hun tekst alleen over welk gebouw of object het gaat.

Besluit René, oktober 2026: **één punt per plek op de luchtfoto is genoeg.** Geen kijkpunt, geen veldtest en geen extra controle.

## Waarom een paar meter afwijking geen probleem is

| Factor | Grootte |
| --- | --- |
| Straal waarbinnen een plek opengaat (`instellingen.straal`) | 35 m |
| Afwijking van GPS op een telefoon in de binnenstad | meestal 5–20 m |
| Afwijking van een punt dat je op de luchtfoto zet | 2–5 m |
| Afstanden in de app | grof: "Vlakbij", "ca. 3 min lopen" |

- **Gebouw met adres:** de app meet de afstand tot de **rand** van de omtrek uit het Kadaster (BAG). Hoe precies de positie van de plek ligt, maakt dan niet uit. Bij de Grote Kerk ben je er zodra je binnen 35 m van een van de muren staat, aan welke kant ook.
- **Object zonder omtrek** (beeld, monument): de app meet tot de positie. 35 m straal min 20 m GPS-fout laat nog ruim marge.
- **Uitzondering: straat, plein of park.** Eén punt met 35 m straal is te klein voor bijvoorbeeld de Langestraat (ongeveer 300 m). Teken daar een **omtrek** langs de straat of om het plein, dan gaat de plek over de hele lengte open.

## Hoe je de positie zet

1. Open `beheer.html` en kies de plek. In de keuzelijst staat achter een plek "nog geen positie" als die nog moet.
2. **Bestaand gebouw met huisnummer:** zet bij **Gebouw** het adres en klik op **Zoek op in het Kadaster**, daarna **Gebruik adres als positie**. Klaar: de app haalt de omtrek zelf op.
   - **Gebouw met meer panden** (bijv. een rij huizen, zoals de Koningshuizen aan de Emmastraat 2, 4, 6 en 8): zet het eerste adres bij **Adres met huisnummer** en de andere bij **Meer adressen bij dit gebouw**, één per regel (hooguit 7). **Zoek op in het Kadaster** toont dan alle panden gestippeld en meldt welke adressen niet gevonden zijn. De app kleurt de panden samen in als één gebouw met één naam; "ter plekke" telt bij elk van de panden. De positie van de plek komt van het eerste adres.
3. **Geen huisnummer bekend:** klik op **Luchtfoto**, zoom in en tik op het gebouw of object. Weet je het huisnummer wel, vul het dan in (zie stap 2).
4. **Straat, plein of park:** klik op **Omtrek tekenen** en tik de hoeken aan.
5. **Verdwenen gebouw:** teken de historische omtrek, met Topotijdreis.nl of een oude kaart ernaast. Zet de bron in de toelichting van het gebouw.
6. Staat het goed, vink dan **Positie op de luchtfoto gecontroleerd** aan.

### Alle adressen in één keer

Onder **1. Plek** staat de knop **Zoek alle adressen op in het Kadaster**. Die geeft elke plek **zonder positie** waarvan het gebouw een adres met huisnummer heeft, de positie van dat adres. Bestaande posities blijven staan. Daarna meldt de pagina welke adressen niet gevonden zijn; die zet je zelf.

Het punt van een adres ligt **in** het gebouw. Dat is goed: de app gebruikt toch de omtrek.

### Link naar de luchtfoto

Onder **Positie van de plek** staat een link die precies op dat punt de luchtfoto opent, bijvoorbeeld:

`https://shsel-enschede.github.io/enschede-app/beheer.html#plek=jacobuskerk&lat=52.221900&lng=6.894000`

- Met **Kopieer link** stuur je hem naar de andere beheerder ("klopt dit?").
- Je kunt ook zelf een link maken: vervang `plek`, `lat` (breedte, rond 52,2) en `lng` (lengte, rond 6,9). Gebruik een **punt** als decimaalteken.
- Een link verandert nooit iets. Wijkt het punt uit de link af van de opgeslagen positie, dan zie je een **blauw rondje** naast de rode speld, met de afstand ertussen.

## Concepten

Plekken die nog geen verhaal en vraag hebben, staan in `content/locaties.json` met `"concept": true`. De app slaat ze over; in de beheerpagina kun je er wel al een positie en gebouw voor kiezen. Is de plek compleet (verhaal, vraag met antwoord én positie), dan zet je hem in de app:

- **Eén plek:** vink onder **1. Plek** het vakje **Staat in de app** aan. Mist er nog iets, dan kun je het niet aanvinken en staat eronder wat ontbreekt.
- **Alle complete plekken tegelijk:** knop **Zet alle complete plekken in de app** (onder **Plekken in de app zetten**).

Daarna verstuur je het voorstel zoals altijd. Uit de app halen kan ook: vinkje uit, dan is de plek weer concept.

## Testen vanaf de laptop: doen alsof je ter plekke bent

Zo controleer je zonder naar de stad te gaan of plekken op de goede plaats opengaan. Dit werkt in Chrome, Edge en Brave op een laptop of pc. Op een telefoon kan het niet (op Android alleen met een aparte nep-GPS-app).

1. Open de app en kies in het menu (tandwiel rechtsboven) bij *Wanneer gaan de plekken open?* voor **Alleen ter plekke**. Staat dit op *Overal*, dan is alles al open en test je niets.
2. Druk op **F12** (of Ctrl+Shift+I). Dan opent het venster met ontwikkelaarstools.
3. Klik daarin rechtsboven op **⋮**, dan **More tools** en dan **Sensors**.
4. Klik bij **Location** op **Manage**, dan **Add location**, en vul in:

   | Veld | Waarde |
   | --- | --- |
   | Location name | Oude Markt (bij het brandmonument) |
   | Lat | 52.22080 |
   | Long | 6.89540 |
   | **Accuracy** | **10** |

5. Met *Manage* heb je de locatie alleen opgeslagen, nog niet gekozen. Sluit het instellingenvenster met **✕** (of Esc) en ga terug naar het tabblad **Sensors**.
6. Open de keuzelijst bij **Location** en kies onder *Overrides* je locatie "Oude Markt".
7. Tik in de app op **Zet locatie aan**.

Brandmonument, Grote Kerk en zonnewijzer gaan nu open. In de voetbalk staat "Je bent bij 3 plekken …".

**Vergeet Accuracy niet.** Zonder die waarde rekent de browser met een onzekerheid van 150 m. Boven de 50 m vertrouwt de app de GPS niet (zie `js/afstand.js`). Dan staat er "Locatie nog onzeker…" en gaat er niets open. Dat is goed gedrag van de app, geen fout.

Een andere plek testen? Zoek de positie op met de link onder **Positie van de plek** in `beheer.html` en voeg die locatie op dezelfde manier toe, weer met Accuracy 10.

Let op:

- De nep-locatie werkt alleen zolang de ontwikkelaarstools openstaan, en alleen in dat tabblad.
- Een opgeslagen locatie blijft in de lijst staan. De volgende keer kies je hem met één klik.
- Een plek die open is gegaan, blijft open. Wil je opnieuw testen, kies dan in het menu **Alles opnieuw beginnen**.
- Zet na het testen het menu terug op de SHSEL-standaard.

## Notatie

- **Volgorde:** in `content/` altijd breedte, dan lengte: `{"lat": 52.22, "lng": 6.89}` en `[lat, lng]`. GeoJSON en sommige websites gebruiken de omgekeerde volgorde. Enschede ligt rond breedte **52,2** en lengte **6,9**; omgedraaid ligt het punt in Somalië.
- `beheer.html` slaat 6 decimalen op. Dat is preciezer dan nodig, maar kan geen kwaad.

## Bronnen

| Bron | Waarvoor |
| --- | --- |
| **BAG via PDOK** (Kadaster) | Adressen en omtrekken van bestaande gebouwen. Ingebouwd in de beheerpagina en de app. |
| **Luchtfoto van PDOK** | Posities en omtrekken zelf zetten. Ingebouwd in de beheerpagina. |
| **Topotijdreis.nl, oude kaarten** | Verdwenen gebouwen |
| Google Maps | Niet gebruiken (voorwaarden van Google, en de app gebruikt geen Google; zie CLAUDE.md). |
