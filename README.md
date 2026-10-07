# Enschede app

Een GPS-wandelquiz langs historische plekken in Enschede, van de Stichting Historische Sociëteit Enschede-Lonneker (SHSEL). Opvolger van de app voor Enschede 700.

**De app:** https://shsel-enschede.github.io/enschede-app/

Openen op je telefoon en via het menu van de browser kiezen voor *Zet op beginscherm* (iPhone: deelknop → *Zet op beginscherm*).

## Hoe zit de app in elkaar?

| Map of bestand | Wat staat erin | Wie past het aan |
| --- | --- | --- |
| `content/locaties.json` | Alle teksten, vragen, antwoorden, gebouwen en coördinaten | Vrijwilligers |
| `content/fotos.json` | Lijst van foto's met bron, bijschrift en rechten | Vrijwilligers |
| `content/oude-app-fotos.json` | Naslag: welke foto's de oude app (2019) per locatie liet zien. Uitleg in `fotocodering-LEESMIJ.md` | Alleen lezen |
| `index.html`, `css/`, `js/` | De app zelf | Ontwikkelaar of Claude |
| `sw.js` | Zorgt dat de app offline werkt | Ontwikkelaar of Claude |
| `icons/` | App-icoon en logo | Ontwikkelaar |
| `CLAUDE.md` | Projectafspraken: huisstijl, veiligheid, werkwijze | Iedereen, na overleg |

De app is een statische website: er is geen server, database of login. Voortgang wordt alleen op de telefoon van de gebruiker bewaard. Er worden geen gegevens verzameld.

## Een tekst of vraag aanpassen

1. Open `content/locaties.json` op GitHub en klik op het potloodje (*Edit*).
2. Pas de tekst aan tussen de aanhalingstekens. Gebruik binnen een tekst geen gewone aanhalingstekens (`"`); gebruik `'` of „ ” in plaats daarvan.
3. Klik op *Commit changes…*, kies **Create a new branch** en daarna *Propose changes*.
4. Laat iemand meekijken en voeg de wijziging samen (*Merge*).

`juist` is het nummer van het goede antwoord, tellend vanaf 0: 0 = A, 1 = B, 2 = C, 3 = D.
`uitleg` is de korte zin die na het antwoord verschijnt. Zet `bevestigd` op `true` als de SHSEL het antwoord heeft gecontroleerd.

## Testfase of ter plekke

Bovenaan `content/locaties.json` staat:

```json
"instellingen": { "ontgrendelen": "overal", "straal": 35 }
```

- `"overal"`: alle vragen zijn overal te beantwoorden. Handig om te testen.
- `"ter-plekke"`: een verhaal en vraag gaan pas open als je binnen `straal` meter van het gebouw staat. Zet dit aan als de app klaar is voor publiek.
- `straal` mag tussen 20 en 60 meter liggen. Afgesproken is 30 tot 40 meter, omdat GPS in de binnenstad 10 tot 20 meter kan afwijken.

## De beheerpagina

Op https://shsel-enschede.github.io/enschede-app/beheer.html kies je per plek:

- de **positie**: uit het Kadaster (adres), door op de kaart of luchtfoto te tikken, of door de rode speld te verslepen;
- het **gebouw**: bestaand, nieuw, of zelf een omtrek tekenen voor een verdwenen gebouw;
- de **foto's** uit de lijst van beschikbare foto's voor die plek.

De pagina verandert zelf niets aan de app. Onderaan krijg je de nieuwe inhoud van `content/locaties.json`, met de stappen om die op GitHub te plaatsen. Je werk blijft tussentijds bewaard in je browser.

Nieuwe foto's voeg je toe zoals beschreven in `fotos/LEESMIJ.md`.

## Een gebouw op de kaart

Bovenaan `content/locaties.json` staat de lijst `gebouwen`. Voorbeeld:

```json
{ "id": "grote-kerk", "naam": "Grote Kerk", "adres": "Oude Markt 32" }
```

- Een locatie hoort bij een gebouw via `"gebouw": "grote-kerk"`. Meerdere verhalen mogen bij hetzelfde gebouw horen.
- Het `adres` moet een huisnummer hebben. De app zoekt daarmee zelf de omtrek van het gebouw op in het Kadaster.
- Bestaat het gebouw niet meer? Geef dan een eigen omtrek op met `"vorm": [[52.2219, 6.8935], [52.2220, 6.8940], ...]` (minimaal drie punten, breedte- en lengtegraad).

## Als het fout gaat

- **De app laadt niet of toont een melding:** waarschijnlijk is `content/locaties.json` beschadigd (bijvoorbeeld een vergeten komma). Ga naar *Commits*, open de laatste wijziging en kies *Revert*. Daarmee zet je de vorige werkende versie terug.
- **Een locatie ontbreekt:** de locatie is overgeslagen omdat er iets ontbreekt (titel, tekst, vraag, vier opties of een geldige positie).
- **Een gebouw staat als stip in plaats van ingekleurd:** het adres is niet gevonden in het Kadaster. Controleer straat en huisnummer, of geef een eigen `vorm` op.
- **De kaart blijft grijs:** de kaartdienst PDOK is niet bereikbaar of er is geen internet. De lijst met plekken werkt gewoon.
- **Een vraag gaat niet open terwijl je er staat:** de telefoon is onzeker over de locatie (de app toont dan "Locatie nog onzeker…"). Even naar een open plek lopen helpt. Blijft het misgaan, maak `straal` iets groter.
- **Opnieuw testen:** onderaan de lijst met plekken (onder de kaart) staat **Alles opnieuw beginnen**. Dat wist je antwoorden op dit toestel, na een bevestiging.
- **Gebruikers zien een wijziging niet:** de app ververst de inhoud vanzelf; soms pas bij de tweede keer openen.

## Licentie en rechten

De teksten zijn van de SHSEL. Beeldmateriaal wordt alleen opgenomen als de rechten geregeld zijn. Contact: secr.shshel@gmail.com.
