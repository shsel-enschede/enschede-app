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
- **Inhoud gescheiden van code:** alle teksten, vragen, antwoorden en coördinaten staan in `content/`. Een vrijwilliger moet inhoud kunnen aanpassen zonder JavaScript te lezen.
- **Offline eerst:** de service worker (`sw.js`) slaat de app-schil en de inhoud op. Na het eerste bezoek moet een route zonder bereik te lopen zijn.
- **Voortgang alleen op het toestel** (`localStorage`). Er verlaat geen gebruikersgegeven het toestel.

## Veiligheid (verplicht bij elke wijziging)

- **Geen externe bronnen**: geen CDN's, webfonts, analytics, advertenties of tracking. Alles wordt vanaf het eigen domein geladen. Uitzondering alleen na expliciete toestemming (bijv. kaarttegels), en dan vastgelegd in de Content-Security-Policy.
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

Gebaseerd op het SHSEL-logo. Kleuren:

| Rol | Kleur | Gebruik |
| --- | --- | --- |
| Rood (stadswapen) | `#E00102` | Knoppen, voortgang, "bezocht". Accent, geen vlakvulling |
| Crème | `#F3EBDE` | Achtergrond |
| Taupe | `#8D827A` | Lijnen, secundaire tekst, iconen |
| Donker bruinrood | `#6C2F2B` | Koppen en hoofdtekst |

- Toegankelijkheid WCAG 2.2 AA: lopende tekst minimaal 16px; rood op crème alleen voor grote koppen.
- Quizfeedback goed/fout altijd met icoon **en** tekst, nooit alleen kleur (rood leest ook als "fout").
- Tikdoelen minimaal 44×44 px; belangrijke knoppen onderin, binnen duimbereik.
- Respecteer `prefers-reduced-motion`.
- Naam: werknaam "Enschede app"; SHSEL als afzender, niet in de naam. Vermijd "Hart van Enschede".

## Inhoud en didactiek

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
