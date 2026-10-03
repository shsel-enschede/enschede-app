# Enschede app

Een GPS-wandelquiz langs historische plekken in Enschede, van de Stichting Historische Sociëteit Enschede-Lonneker (SHSEL). Opvolger van de app voor Enschede 700.

**De app:** https://shsel-enschede.github.io/enschede-app/

Openen op je telefoon en via het menu van de browser kiezen voor *Zet op beginscherm* (iPhone: deelknop → *Zet op beginscherm*).

## Hoe zit de app in elkaar?

| Map of bestand | Wat staat erin | Wie past het aan |
| --- | --- | --- |
| `content/locaties.json` | Alle teksten, vragen, antwoorden, routes en coördinaten | Vrijwilligers |
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

## Als het fout gaat

- **De app laadt niet of toont een melding:** waarschijnlijk is `content/locaties.json` beschadigd (bijvoorbeeld een vergeten komma). Ga naar *Commits*, open de laatste wijziging en kies *Revert*. Daarmee zet je de vorige werkende versie terug.
- **Een locatie ontbreekt:** de locatie is overgeslagen omdat er iets ontbreekt (titel, tekst, vraag, vier opties of een geldige positie).
- **Gebruikers zien een wijziging niet:** de app ververst de inhoud vanzelf; soms pas bij de tweede keer openen.

## Licentie en rechten

De teksten zijn van de SHSEL. Beeldmateriaal wordt alleen opgenomen als de rechten geregeld zijn. Contact: secr.shshel@gmail.com.
