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
