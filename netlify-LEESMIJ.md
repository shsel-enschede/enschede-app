# Testomgeving op Netlify

Voor beheerders. Wat de testomgeving is, hoe je hem gebruikt en hoe hij is ingericht.

## Test en productie

| | Waar | Wanneer bijgewerkt |
| --- | --- | --- |
| **Productie** (de echte app) | https://shsel-enschede.github.io/enschede-app/ | Zodra een beheerder een pull request samenvoegt in `main` |
| **Test** | Netlify: één eigen testlink per pull request | Bij elk voorstel en elke aanpassing daarvan |

Samenvoegen is publiceren. Daarom bekijk je een wijziging eerst op de testlink, en voeg je pas daarna samen.

Netlify is alleen voor testen. Zoekmachines nemen de testlinks niet op (`netlify.toml`).

## Zo test je een voorstel

1. Open de pull request op GitHub.
2. Wacht tot Netlify klaar is (meestal binnen een minuut). In de pull request verschijnt dan een bericht van Netlify met **Deploy Preview** en een link, zoals `https://deploy-preview-81--enschede-app-test.netlify.app`.
3. Open die link op je **telefoon**. Loop na wat in de pull request onder *Zo test je het* staat.
4. Klopt het: voeg samen. Klopt het niet: zet een opmerking in de pull request.

Een voorstel uit de editor krijgt ook een testlink. Zo zie je een nieuwe tekst of foto in de app zelf, voordat hij live gaat.

Let op: de testlink heeft een eigen adres, dus ook een eigen voortgang en instellingen op je telefoon. Wat je op de testlink beantwoordt, zie je niet terug in de echte app.

## Hoe het is ingericht (eenmalig, door een beheerder)

1. **Account op naam van SHSEL.** Maak op netlify.com een gratis account met een e-mailadres van de SHSEL (geen persoonlijk adres), zodat het overdraagbaar is. Zet tweestapsverificatie aan. Nodig de tweede beheerder uit als lid.
2. **Project koppelen.** *Add new project* → *Import an existing project* → *GitHub*. Geef Netlify alleen toegang tot de repository `enschede-app` (*Only select repositories*), niet tot de hele organisatie.
3. **Instellingen bij het koppelen.** Alles staat al in `netlify.toml`; laat *Build command* leeg en *Publish directory* `.`. Projectnaam: `enschede-app-test`.
4. **Deploy Previews** staan standaard aan. Controleer onder *Project configuration → Build & deploy → Continuous deployment*:
   - *Deploy Previews*: aan voor pull requests naar `main`.
   - *Branch deploys*: alleen de productiebranch (geen andere takken).
   - Pull requests van buitenstaanders (forks): als Netlify de keuze biedt, eerst goedkeuring vragen. De repository is openbaar; zo kan niemand anders zomaar een pagina op ons Netlify-adres zetten.
5. **Netlify Drawer** (de werkbalk op testlinks) uitzetten, onder *Project configuration → Build & deploy → Collaboration*. Die laadt extra scripts; de test moet zo dicht mogelijk bij de echte app blijven.

## Kosten

Gratis abonnement. Alleen publicaties naar productie kosten tegoed; testlinks zijn gratis. Netlify publiceert `main` niet (`[context.production] ignore` in `netlify.toml`), dus het tegoed blijft onaangeroerd. Productie staat op GitHub Pages, ook omdat dat geen tegoed kost bij veel bezoekers tegelijk.

## Als het niet werkt

- **Geen bericht van Netlify in de pull request:** kijk in Netlify bij *Deploys* of er een fout staat. Werkt Netlify niet, dan kun je nog steeds lokaal testen met `start-lokaal.bat`. De echte app hangt niet van Netlify af.
- **Netlify stopt of verandert zijn voorwaarden:** koppel het project los. Er verandert niets aan de echte app. Alternatief: een tweede repository met GitHub Pages als testsite.
