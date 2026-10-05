# Projectafspraken Enschede app

Dit bestand leest Claude bij elke sessie. Het legt vast hoe deze app gebouwd en onderhouden wordt. Mensen mogen het ook lezen en aanpassen.

## Wat dit is

De Enschede app van de Stichting Historische Sociëteit Enschede-Lonneker (SHSEL): een GPS-wandelquiz langs historische locaties in Enschede, gebouwd als Progressive Web App (PWA). Opvolger van de app uit 2019 voor Enschede 700.

**Dit is geen prototype.** De app wordt echt gebruikt, door publiek, ook door kinderen. Kwaliteit, veiligheid en onderhoudbaarheid gaan boven snelheid.

## Communicatie

- Antwoorden aan René in het Nederlands, kort en direct.
- Code-commentaar en commitberichten in het Nederlands.
- René is nieuw met GitHub: leg GitHub-handelingen stap voor stap uit.

## Architectuur (niet zonder overleg wijzigen)

- **Statisch:** alleen HTML, CSS en JavaScript, gehost op GitHub Pages. Geen server, geen database, geen login, geen build-stap.
- **Geen frameworks of npm-afhankelijkheden in de app.** Gewone JavaScript (ES-modules). Reden: vrijwilligers moeten het over tien jaar nog kunnen onderhouden.
  - Enige uitzondering: **Leaflet 1.9.4** voor de kaart, als vast bestand in `vendor/leaflet/` (BSD-licentie). Wordt pas geladen als de kaart nodig is. Niet bijwerken zonder overleg.
- **Inhoud gescheiden van code:** alle teksten, vragen, antwoorden en coördinaten staan in `content/`. Een vrijwilliger moet inhoud kunnen aanpassen zonder JavaScript te lezen.
- **Offline eerst:** de service worker (`sw.js`) slaat de app-schil en de inhoud op. Na het eerste bezoek moet een route zonder bereik te lopen zijn.
- **Voortgang alleen op het toestel** (`localStorage`). Er verlaat geen gebruikersgegeven het toestel.

## Veiligheid (verplicht bij elke wijziging)

- **Geen externe bronnen**: geen CDN's, webfonts, analytics, advertenties of tracking. Alles wordt vanaf het eigen domein geladen. Uitzondering alleen na expliciete toestemming (bijv. kaarttegels), en dan vastgelegd in de Content-Security-Policy.
  - Goedgekeurd (René, okt 2026): **PDOK**, de geodienst van de overheid. Kaarttegels van `service.pdok.nl` (BRT-Achtergrondkaart, grijs) en adres- en gebouwgegevens van `api.pdok.nl` (Locatieserver en BAG). Geen sleutel, geen tracking. **Geen Google Maps** (sleutel met betaalrekening, en IP-adressen naar Google).
- **Content-Security-Policy** staat als `<meta>` in `index.html`. Niet versoepelen zonder reden in de pull request.
- **Geen inline scripts of `onclick`-attributen**, zodat de CSP streng kan blijven.
- **Nooit `innerHTML` met inhoud uit `content/`**. Gebruik `textContent` en `createElement`. Inhoud wordt behandeld als onbetrouwbare data, ook al schrijven we hem zelf.
- **Valideer `content/*.json` bij het laden**; ongeldige locaties overslaan en melden in de console, niet de hele app laten crashen.
- **Locatie (GPS):** alleen vragen na een uitleg en een tik van de gebruiker, nooit bij het openen. Coördinaten nooit opslaan of versturen.
- **Geen geheimen** (wachtwoorden, API-sleutels) in de repository. De repository is openbaar.
- **Beeldmateriaal:** alleen toevoegen als de rechten geregeld zijn; bron en rechten vastleggen in `content/`.

## Schaal

Doel: tot circa 1000 gelijktijdige gebruikers, bijvoorbeeld bij een evenement. Omdat alles statisch is en via het CDN van GitHub Pages komt, is de server geen knelpunt. Let op:

- Houd de eerste download klein (doel: app-schil onder 200 kB, zonder foto's).
- Foto's: WebP, maximaal 1200 px breed, maximaal circa 150 kB per foto, `loading="lazy"`.
- Wijzigt een bestand in de app-schil, verhoog dan `VERSIE` in `sw.js`, anders zien gebruikers de oude versie.

## Huisstijl

Gebaseerd op het SHSEL-logo en het officiële briefpapier (267SHSEL17). Uitgebreide toelichting: `claude/huisstijl.md` in het claude.ai-project.

| Rol | Kleur | Gebruik |
| --- | --- | --- |
| Merkrood | `#ED1D27` | Schild, voortgangsbalk, vlakken. Niet voor kleine tekst (wit erop 4,4:1) |
| Actierood | `#C10422` | Knoppen en links (wit erop 6,4:1) |
| Tekst | `#3E4049` | Hoofdtekst |
| Grijs | `#707480` | Secundaire tekst, lijnen (kleur van de logotekst) |
| Lijn | `#E4E4E7` | Randen, lege voortgang |
| Wit | `#FFFFFF` | Achtergrond, zoals het briefpapier |
| Groen | `#1E6B3A` | Goed antwoord en "bezocht", altijd met ✓ |

- **Letters:** koppen in Sorts Mill Goudy (vrije variant van Goudy Old Style uit het briefpapier, zelf gehost in `fonts/`, OFL-licentie). Lopende tekst en knoppen in de systeemletter.
- **Vormtaal:** het vestingmotief linksonder op het startscherm (`img/vesting-motief.svg`) en de voortgangsbalk met schuine segmenten, beide uit het briefpapier.
- **Logo en iconen:** rechtstreeks uit het vectorbestand van het briefpapier. App-icoon = alleen het schild (de vestinglijnen lopen op icoonformaat dicht).
- Toegankelijkheid WCAG 2.2 AA: contrast lopende tekst minimaal 4,5:1, lopende tekst minimaal 16px.
- Quizfeedback goed/fout altijd met icoon **en** tekst, nooit alleen kleur (rood leest ook als "fout").
- Tikdoelen minimaal 44×44 px; belangrijke knoppen onderin, binnen duimbereik.
- Respecteer `prefers-reduced-motion`.
- Naam: werknaam "Enschede app"; SHSEL als afzender, niet in de naam. Vermijd "Hart van Enschede".

## Inhoud en didactiek

- **Juiste antwoorden en uitleg** staan in `content/locaties.json`: `juist` (0 = A … 3 = D), `vraag.<taal>.uitleg` (één zin na het antwoord) en `bevestigd`. De brondocumenten bevatten geen antwoorden; een overzicht voor SHSEL staat in het claude.ai-project (`claude/antwoorden-en-uitleg.md`).
- **Kaart:** elke locatie verwijst met `gebouw` naar een gebouw in `gebouwen`. Meerdere verhalen kunnen bij één gebouw horen. Het gebouw heeft een echt `adres` met huisnummer (voor de BAG-omtrek) of een eigen `vorm` (lijst van [lat, lng]) voor verdwenen gebouwen. Op de kaart: rood met stippelrand = nog niet bezocht, groen met ✓ = alle verhalen bij dat gebouw beantwoord.
- **Ontgrendelen (besluit René, okt 2026):** instelling `instellingen.ontgrendelen` in `content/locaties.json`.
  - `"overal"`: testfase, alle vragen zijn open ("vanaf de bank"). De voettekst meldt dat het een testversie is.
  - `"ter-plekke"`: definitief. Verhaal en vraag gaan pas open binnen `instellingen.straal` meter (afgesproken 30–40 m, standaard 35) van de **rand** van het gebouw. Eenmaal open blijft een plek open. GPS is hulpmiddel, geen controle: de app is statisch, valsspelen is niet te voorkomen en dat is acceptabel.
- **Afstanden altijd grof, nooit in meters** (geen schijnnauwkeurigheid): "Je bent er!", "Vlakbij" (tot 100 m), "ca. 2/3/5/10/15 min lopen" (tot 1 km, 4,5 km/u), "ca. 1,5 km" (halve km). Bij GPS-onzekerheid boven 50 m: "Locatie nog onzeker…" en er gaat niets open. Een marge van 10 m voorkomt heen-en-weer springen. Code: `js/afstand.js`.
- **Beheerpagina** (`beheer.html`, niet gelinkt vanuit de app): vrijwilligers kiezen per plek de positie (Kadaster-adres, kaart of luchtfoto), het gebouw (of tekenen een omtrek voor verdwenen gebouwen) en de foto's. De pagina schrijft niets naar de website; hij maakt een nieuw `content/locaties.json` dat via een pull request op GitHub komt. Zo blijft GitHub de enige plek waar iets verandert en is er geen login of server nodig.
- **Foto's:** catalogus in `content/fotos.json` (bron, documentnummer, bij welke plek-nummers ze passen, bestand, alt, bijschrift, rechten). Een plek kiest foto's met `"fotos": ["sa-012131", …]`, de eerste is de hoofdfoto. De app toont een foto alleen als `bestand` bestaat én `rechten_geregeld` true is. Nog niet ter plekke: alleen de hoofdfoto, wazig.
- **Lokale proefversie:** alleen op `localhost` toont de app ook foto's zonder geregelde rechten, uit `fotos-lokaal/` (staat in `.gitignore`, komt nooit op GitHub), met het label "Proef: rechten nog niet bevestigd". Starten met `start-lokaal.bat` (server alleen op 127.0.0.1). Uitleg: `fotos-lokaal-LEESMIJ.md`.
- Doelgroep: jeugd en gezinnen, ook volwassenen. Moeilijke woorden uitleggen, zoals in de bronteksten.
- Meerkeuzevragen (Haladyna-richtlijnen): vier opties, plausibele afleiders, hooguit één grappige optie, geen "dat is niet te zien", geen ontkennende vraag. Kijkvragen ter plekke hebben de voorkeur.
- Direct feedback na het antwoord, met één zin uitleg (testing effect).
- **Historische feiten en juiste antwoorden worden bevestigd door SHSEL**, niet door Claude. Onbevestigde antwoorden krijgen `"bevestigd": false`.
- Motivatie: korte routes van 6–10 locaties, zichtbare voortgang, teaser van de volgende locatie, beloning bij afronden.

## Werkwijze

- Werk altijd in een aparte branch en bied wijzigingen aan via een pull request. René kijkt en voegt samen. Nooit direct naar `main`.
- Kleine stappen: één onderwerp per pull request.
- Beschrijf in elke pull request in gewone taal: wat is veranderd, hoe René het kan testen, en wat er nog niet werkt.
- Test op een smal (mobiel) scherm voordat je een pull request aanbiedt.

## Bronnen

De oorspronkelijke teksten (NL, EN, DE), de lijst met Stadsarchief-foto's en de huisstijl staan in het claude.ai-project "SHSEL app/ website", niet in deze repository.
