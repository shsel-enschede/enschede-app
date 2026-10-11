# Projectafspraken Enschede app

Dit bestand leest Claude bij elke sessie. Het legt vast hoe deze app gebouwd en onderhouden wordt. Mensen mogen het ook lezen en aanpassen.

## Wat dit is

De Enschede app van de Stichting Historische Sociëteit Enschede-Lonneker (SHSEL): een GPS-wandelquiz langs historische locaties in Enschede, gebouwd als Progressive Web App (PWA). Opvolger van de app uit 2019 voor Enschede 700.

**Dit is geen prototype.** De app wordt echt gebruikt, door publiek, ook door kinderen. Kwaliteit, veiligheid en onderhoudbaarheid gaan boven snelheid.

## Communicatie

- Antwoorden aan de beheerders (nu René) in het Nederlands, kort en direct.
- Code-commentaar en commitberichten in het Nederlands.
- Beheerders zijn vrijwilligers die GitHub nog leren: leg GitHub-handelingen stap voor stap uit.

## Rollen (voorstel René, okt 2026; benoeming door het bestuur van SHSEL)

- **Bestuur SHSEL:** besluit over veranderingen en varianten van de app; benoemt beheerders en contentbeheerders.
- **Beheerders (twee):** vrijwilligers van SHSEL, verantwoordelijk voor het functioneren van de Enschede app. Taken:
  1. inhoudelijke wijzigingen (tekst en beeldmateriaal) verwerken: voorstellen beoordelen en samenvoegen, of een vraag terugsturen;
  2. storingen en fouten in de app verhelpen;
  3. veranderingen en varianten analyseren, voorbereiden en voorleggen aan het bestuur.
  Daarnaast: sleutels van contentbeheerders aanmaken en intrekken, de beveiliging van `main` en de GitHub-organisatie beheren. Beide beheerders staan in `CODEOWNERS` en keuren elkaars technische wijzigingen goed.
- **Contentbeheerders (team):** schrijven kort, aansprekend en historisch verantwoord over gebouwen en locaties; kiezen passende foto's van goede kwaliteit met een onderschrift; laten tekst en beeld controleren door een collega-contentbeheerder; dienen wijzigingen in via de editor. Geen technische kennis nodig.
- Claude werkt in opdracht van een beheerder. Architectuurkeuzes legt Claude voor als voorstel; het bestuur besluit, de beheerders bereiden voor.

## Architectuur (niet zonder overleg wijzigen)

- **Statisch:** alleen HTML, CSS en JavaScript, gehost op GitHub Pages. Geen server, geen database, geen login, geen build-stap.
- **Geen frameworks of npm-afhankelijkheden in de app.** Gewone JavaScript (ES-modules). Reden: vrijwilligers moeten het over tien jaar nog kunnen onderhouden.
  - Enige uitzondering: **Leaflet 1.9.4** voor de kaart, als vast bestand in `vendor/leaflet/` (BSD-licentie). Wordt pas geladen als de kaart nodig is. Niet bijwerken zonder overleg.
- **Inhoud gescheiden van code:** alle teksten, vragen, antwoorden en coördinaten staan in `content/`. Een vrijwilliger moet inhoud kunnen aanpassen zonder JavaScript te lezen.
- **Offline eerst:** de service worker (`sw.js`) slaat de app-schil en de inhoud op. Na het eerste bezoek moet een route zonder bereik te lopen zijn.
  - **Updates:** de service worker haalt bij een nieuwe `VERSIE` alle bestanden vers op (niet uit de browsercache). De app kijkt bij openen en bij terugkeren uit de achtergrond of er een nieuwe versie is, en laadt die bij de volgende schermwissel. Een gebruiker ziet een wijziging dus uiterlijk na één schermwissel nadat GitHub Pages hem heeft gepubliceerd (meestal binnen enkele minuten na samenvoegen).
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
- **Openbaar of privé:** alles in deze repository, ook pull requests, reviews en de geschiedenis, is voor iedereen te lezen. Wat waar hoort: zie **Documenten: wat staat waar** onderaan.
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
| Groen | `#1E6B3A` | Goed antwoord en "ontdekt", altijd met ✓ |

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
- **Kaart:** elke plek verwijst met `gebouw` naar een gebouw in `gebouwen`. Meerdere verhalen kunnen bij één gebouw horen. Het gebouw heeft een echt `adres` met huisnummer (voor de BAG-omtrek) of een eigen `vorm` (lijst van [lat, lng]) voor verdwenen gebouwen. Op de kaart: rood met stippelrand = nog niet ontdekt, groen met ✓ = alle verhalen bij dat gebouw beantwoord. Namen van gebouwen overlappen nooit. Een naam probeert eerst een paar plaatsen rond het object (midden, onder, boven, rechts, links; bij kleine objecten boven, onder, rechts, links); past geen enkele, dan wordt hij verborgen tot je inzoomt. Met `naamPlek` bij een gebouw (`boven`, `onder`, `links`, `rechts`, `midden`) kies je de eerste plek, bijv. de straatkant van een klein object (zonnewijzer: onder, brandmonument: boven). Voorrang: nog niet ontdekte gebouwen, dan kleine objecten, dan de meeste verhalen. Kleine objecten (zoals de zonnewijzer) houden altijd een zichtbare stip, ook als hun naam verborgen is; een naam valt nooit over zo'n stip.
- **Coördinaten (besluit René, okt 2026):** één punt per plek op de luchtfoto in `beheer.html` is genoeg; geen kijkpunt, geen veldtest. Gebouwen met huisnummer krijgen hun omtrek uit het Kadaster; straten, pleinen en parken krijgen een getekende omtrek (één punt met 35 m straal is daar te klein). Taak van de beheerders, niet van contentbeheerders. Uitleg: `coordinaten-LEESMIJ.md`.
- **Concepten:** een plek met `"concept": true` (nog zonder verhaal of vraag) staat alleen in de beheerpagina. De app slaat hem over, en zoekt alleen omtrekken op van gebouwen bij plekken die in de app staan (minder verzoeken aan PDOK).
- **Ontgrendelen (besluit René, okt 2026):** instelling `instellingen.ontgrendelen` in `content/locaties.json`.
  - `"overal"`: testfase, alle vragen zijn open ("vanaf de bank"). Een label "Test" in de kop en één zin op het startscherm melden dat het een testversie is (niet in de voetbalk: die ruimte is voor knoppen).
  - `"ter-plekke"`: definitief. Verhaal en vraag gaan pas open binnen `instellingen.straal` meter (afgesproken 30–40 m, standaard 35) van de **rand** van het gebouw. Eenmaal open blijft een plek open. GPS is hulpmiddel, geen controle: de app is statisch, valsspelen is niet te voorkomen en dat is acceptabel.
  - Wat de SHSEL hier zet, is de **standaard**. In het menu kan een gebruiker dit per toestel wijzigen (zie **Menu**).
- **Menu (René, okt 2026):** knop rechtsboven in de kop, op **elk** scherm op dezelfde plek (consistente navigatie, WCAG 3.2.3): een "i" in een tandwiel (informatie en instellingen). Opent het scherm `#/menu`; de terugknop van de telefoon en de knop *Klaar* sluiten het.
  - Keuzes gelden direct en staan alleen op het toestel (`js/instellingen.js`, `localStorage`). Ongeldige opgeslagen waarden vallen terug op de standaard.
  - **Wanneer gaan de plekken open:** *Overal* of *Alleen ter plekke*. Kiest de gebruiker de SHSEL-standaard, dan wordt niets vastgezet: wijzigt de SHSEL later de standaard, dan volgt het toestel mee.
  - **Doel:** geen doel, of een aantal plekken. Met een doel lopen teller en voortgangsbalk naar het doel ("3 van 24 plekken ontdekt") en volgt een mijlpaal "Doel gehaald!". Zelfgekozen, dus geen dwang.
  - **Antwoorden:** *Direct na elke vraag* (standaard) of *Aan het eind*: dan zie je alleen "✓ Antwoord bewaard" en je eigen keuze; goed/fout en uitleg pas in **Mijn antwoorden** (`#/antwoorden`) als het doel gehaald is of alles ontdekt (uitgestelde feedback, Butler e.a. 2007).
  - **Mijn antwoorden:** per ontdekte plek de vraag, je antwoord en (als zichtbaar) het goede antwoord met uitleg. Bewust geen totaalscore.
  - **Taal:** alleen Nederlands; English en Deutsch staan er uitgeschakeld bij, in hun eigen taal, zonder vlaggen (zie plan-taalkeuze).
  - **Over de Enschede app:** wat de app is, wie hem maakt (SHSEL, link naar https://www.shsel.nl/), privacy in gewone taal (ook dat kaartbeelden van PDOK komen).
  - Nog niet: een opdracht van een docent via link of QR-code die deze keuzes vastzet, vragen uit, terugblik. Dat is het voorstel schoolmodus; besluit door het bestuur.
- **Afstanden altijd grof, nooit in meters** (geen schijnnauwkeurigheid): "Je bent er!", "Vlakbij" (tot 100 m), "ca. 2/3/5/10/15 min lopen" (tot 1 km, 4,5 km/u), "ca. 1,5 km" (halve km). Bij GPS-onzekerheid boven 50 m: "Locatie nog onzeker…" en er gaat niets open. Een marge van 10 m voorkomt heen-en-weer springen. Code: `js/afstand.js`.
- **Editor** (`beheer.html`, niet gelinkt vanuit de app): per plek de positie (Kadaster-adres, kaart of luchtfoto), het gebouw (of een eigen omtrek voor verdwenen gebouwen) en de foto's kiezen, en die met één knop als voorstel naar GitHub sturen. Zie **Editor voor vrijwilligers** hieronder.
- **Foto's:** catalogus in `content/fotos.json` (bron, documentnummer, bij welke plek-nummers ze passen, bestand, alt, bijschrift, rechten). Een plek kiest foto's met `"fotos": ["sa-012131", …]`, de eerste is de hoofdfoto. De app toont een foto alleen als `bestand` bestaat én `rechten_geregeld` true is. Nog niet ter plekke: alleen de hoofdfoto, wazig.
- **Lokale proefversie:** alleen op `localhost` toont de app ook foto's zonder geregelde rechten, uit `fotos-lokaal/` (staat in `.gitignore`, komt nooit op GitHub), met het label "Proef: rechten nog niet bevestigd". Starten met `start-lokaal.bat` (server alleen op 127.0.0.1). Uitleg: `fotos-lokaal-LEESMIJ.md`.
- **Doelgroep (René, okt 2026):**
  - **Hoofddoelgroep: scholieren van ca. 9–14 jaar**: bovenbouw basisschool (groep 6–8) en onderbouw voortgezet onderwijs (klas 1–2). Taalgebruik en meerkeuzevragen zijn op hen gericht.
  - **Ook geschikt voor gezinnen en families** met kinderen in die leeftijd: samen wandelen, samen kiezen, samen antwoorden.
  - Volwassenen kunnen de app ook gebruiken; de tekst is dan eenvoudig, maar niet kinderachtig.
- **Taal voor deze doelgroep** (taalniveau B1, referentieniveau 1F–2F):
  - Korte zinnen (richtlijn: hooguit ca. 15 woorden), actieve vorm, één gedachte per zin. Spreek de lezer aan met "je".
  - Concreet en zichtbaar: verwijs naar wat je ter plekke ziet ("Kijk naar de toren …"). Jaartallen liever met een houvast ("ruim 100 jaar geleden, in 1910").
  - Moeilijke of ouderwetse woorden uitleggen in de tekst zelf, zoals in de bronteksten ("een apostel, een leerling van Jezus").
  - Niet kinderachtig of betuttelend: kinderen van 12–14 haken af op "kinderpraat", en ouders lezen mee.
- **Meerkeuzevragen voor deze doelgroep** (aanvulling op de Haladyna-richtlijnen hieronder):
  - Eén duidelijke vraag per scherm, zonder dubbele ontkenning of strikvraag.
  - Opties ongeveer even lang en in dezelfde vorm; het goede antwoord valt niet op door lengte of detail.
  - Afleiders zijn plausibel voor een kind van 10: begrijpelijk, maar niet te raden zonder kijken of lezen.
  - Geen voorkennis vereisen die niet in de tekst of ter plekke te vinden is (geen schoolstof die groep 6 nog niet heeft gehad).
  - Kijkvragen werken voor gezinnen extra goed: samen zoeken en overleggen.
  - Uitleg na het antwoord in één korte zin die de lezer iets nieuws leert, niet alleen herhaalt.
- Meerkeuzevragen (Haladyna-richtlijnen): vier opties, plausibele afleiders, hooguit één grappige optie, geen "dat is niet te zien", geen ontkennende vraag. Kijkvragen ter plekke hebben de voorkeur.
- Direct feedback na het antwoord, met één zin uitleg (testing effect). Bij een fout antwoord noemt de feedback het hele goede antwoord ("Het goede antwoord is B: …"), niet alleen de letter. Na het antwoord blijven je keuze, het goede antwoord en de uitleg samen in beeld als dat past.
- **Beloningsmoment (piek-eindregel):** na elk antwoord een groen vak "✓ Plek ontdekt!" met de voortgangsbalk, waarin het nieuwe segment volloopt. Ook bij een fout antwoord: ontdekken telt, niet de score.
- **Plekscherm:** zolang de vraag nog niet beantwoord is, staat er geen knop in de voetbalk (lezen en antwoorden is de taak; terug via de pijl in de kop). Na het antwoord verschijnt "Terug naar de kaart". De vraag staat apart onder een lijn, met het label "Vraag" en in de kopletter.
- **Historische feiten en juiste antwoorden worden bevestigd door SHSEL**, niet door Claude. Onbevestigde antwoorden krijgen `"bevestigd": false`.
- **Vrij ontdekken (besluit René, okt 2026):** de app is een wandeling zonder vaste volgorde. Wie toevallig langs een historische plek loopt, kan die bekijken of gewoon doorlopen.
  - De kaart met alle plekken is het hoofdscherm. Geen routekeuze, geen nummers en geen knop "Volgende" die een volgorde voorschrijft.
  - De lijst onder de kaart (ook het toegankelijke alternatief voor de kaart): met GPS "Dichtbij" (tot ca. 5 min lopen) en "Verder weg", zonder GPS op naam; ontdekte plekken onderaan ("Al ontdekt"). De volgorde verspringt niet tijdens het kijken.
  - Na een antwoord: nog niet beantwoorde verhalen bij hetzelfde gebouw staan direct in het groene mijlpaalvak ("Nog 1 verhaal bij Grote Kerk:"), en de app scrolt zo dat dat vak boven de voetbalk staat (anders zie je het tweede verhaal over het hoofd). Daaronder maximaal 3 keuzes "Ook in de buurt" bij andere gebouwen (de dichtstbijzijnde onbezochte plekken, één per gebouw; met GPS vanaf je positie, anders van rand tot rand van de gebouwen, en alleen zonder bekende omtrek vanaf het coördinaat van de plek) en de knop "Terug naar de kaart". Nooit één voorgeschreven "volgende".
  - **"Je loopt langs …"**: met GPS aan verschijnt bij onontdekte plekken binnen de straal een rustige melding in de voetbalk met alleen de knop *Bekijk*. Niet tijdens het lezen van een nog niet beantwoorde plek. Geen pop-up, geen trilling, geen pushmelding; de focus wordt niet verplaatst. Doorlopen is geen keuze die je hoeft te maken: loop je verder, dan verdwijnt de melding vanzelf (buiten de straal plus 10 m marge). Daarom geen knop "Verder lopen" (besluit René, okt 2026). Loop je later opnieuw langs, dan verschijnt de melding weer. Dit wordt nergens bewaard.
    - Uitnodigend, niet opdragend: "Je loopt langs **Grote Kerk**. Benieuwd naar het verhaal?" (bij meer verhalen: "Benieuwd naar de 2 verhalen?").
    - **Meer plekken tegelijk** (bijv. Grote Kerk, zonnewijzer, brandmonument): één melding, per gebouw, zonder voorkeur van de app: "Je bent bij 3 plekken: **Grote Kerk, Brandmonument en nog 1**. Benieuwd? Kies zelf waar je begint." (hooguit twee namen, zodat de melding laag blijft). *Bekijk* opent dan een keuzelijst over de kaart (vanaf een plekscherm eerst naar de kaart); bij één verhaal gaat *Bekijk* direct naar de plek.
    - **Onder het lopen:** komt er een plek bij, dan komt hij achteraan en wordt alleen die gemeld ("Ook vlakbij: Jacobuskerk.") en licht alleen die op. Valt er een plek af, dan verdwijnt hij stil. De volgorde verspringt nooit, ook niet als door GPS-ruis een andere plek dichterbij lijkt. Een geopende keuzelijst verandert niet meer. Code: `js/langs.js`, test: `tests/langs.test.mjs`.
    - Op de kaart licht een plek die in de melding komt twee keer zacht op. Zolang hij in de melding staat, heeft de naam een rood vlak met witte letters (zoals de knop *Bekijk*) en een doorgetrokken rand, en ligt hij bovenop de andere namen; gewone namen wijken. Alleen als twee rode namen elkaar zouden bedekken, wijkt de latere tot je inzoomt (de rand blijft rood). Zo valt hij in één oogopslag op tussen de rode stippellijnen van de andere plekken. Met 'minder beweging' (`prefers-reduced-motion`) zonder het oplichten.
    - Schermlezers: de zin gaat naar een live regio (`#langs-aankondiging`) die altijd in de pagina staat; een regio die pas verschijnt, wordt vaak niet voorgelezen.
    - Bewust geen trilling (besluit René, okt 2026): werkt niet op iPhone, niet met het scherm uit (een PWA volgt de locatie niet op de achtergrond) en voelt als een opdracht in plaats van een uitnodiging.
  - **Voortgang als verzameling:** we tellen wat je ontdekt hebt ("3 plekken ontdekt"), niet wat je nog moet. Een plek is ontdekt zodra de vraag beantwoord is, goed of fout. Bewust geen score. Op de kaart een rij met ontdekte gebouwen (alleen wat je al hebt, geen lege vakjes). Na een antwoord een mijlpaal: "Grote Kerk: 2 van 4 verhalen ontdekt" of "Alle 4 verhalen bij Grote Kerk ontdekt!".
  - In teksten voor de gebruiker: "ontdekt", niet "bezocht".
  - `routes` in `content/locaties.json` wordt nu niet gebruikt; kan later terugkomen als optioneel thema- of buurtfilter.
- Motivatie zonder dwang (zelfdeterminatietheorie: autonomie): zelf kiezen, zichtbare voortgang als verzameling ("plekken ontdekt"), nieuwsgierigheid via de teaser op een plek die nog dicht is. Geen pushmeldingen, trillingen of aftellers.

## Editor voor vrijwilligers (besluit René, okt 2026)

Uitgebreid ontwerp: document "Ontwerp contenteditor Enschede app" in het claude.ai-project. Hieronder de vaste afspraken.

- **Doel:** vrijwilligers onderhouden gebouwen, verhalen, vragen en foto's zonder iets van GitHub te merken. Woorden als branch, commit of pull request komen in de editor niet voor.
- **Git-based CMS, geen server:** de editor (`beheer.html`) praat vanuit de browser met de GitHub-API. De knop **Wijziging voorstellen** maakt een branch vanaf de nieuwste `main`, slaat de gewijzigde bestanden op en opent een pull request met een beschrijving in gewone taal. Na akkoord van een collega-contentbeheerder voegt een beheerder samen; pas dan is het live. Geen Decap, Pages CMS of andere externe CMS.
- **Toestanden voor de contentbeheerder:** Concept (in eigen browser), Wacht op collega, Bij beheerder, Live.
- **Collegiale controle:** een collega-contentbeheerder beoordeelt het voorstel in de editor (*Akkoord* of *Opmerking*); de editor zet dat als review op de pull request.
- **Veiligheid:**
  - Ruleset op `main`: alleen via pull request met goedkeuring van een beheerder (Code Owner). Dit is het vangnet; ook een uitgelekte sleutel kan de live app niet direct veranderen.
  - Elke vrijwilliger een eigen *fine-grained token*: alleen deze repository, alleen *Contents* en *Pull requests* schrijven, verloopt na 1 jaar. Nooit een gedeelde sleutel.
  - CSP van `beheer.html`: alleen `https://api.github.com` erbij in `connect-src`. De app zelf (`index.html`) praat nooit met GitHub.
  - Uitloggen-knop wist de sleutel. Validatie vóór versturen: versturen kan pas als alles klopt.
  - Een foto gaat alleen mee naar GitHub als `rechten_geregeld` aan staat.
- **Meertaligheid:** Nederlands is de brontaal. Vertaaleenheden met elk een eigen status per taal (EN, DE): titel, verhaaltekst, vraag (vraagtekst + opties samen, want `juist` geldt voor alle talen), uitleg, en per foto bijschrift en alt-tekst.
  - Statussen: *Ontbreekt*, *Verouderd*, *Controleren*, *Bijgewerkt* (naar XLIFF/Weblate).
  - *Verouderd* gaat automatisch: bij elke vertaling bewaart de editor een hash van de Nederlandse tekst waarop hij gebaseerd is. Vorige Nederlandse teksten staan in `content/vertaalbasis.json` (niet geladen door de app), zodat de vertaler het verschil ziet.
  - Inhoudelijke wijziging in EN of DE: de andere talen krijgen *Controleren*.
  - De app toont een verouderde **vraag of uitleg niet** (kans op fout antwoord), wel een verouderd verhaal, titel of bijschrift. Terugvaltaal: nog te besluiten.
- **Foto's:** elke foto krijgt een `rol` (bijv. herkenning, hoofd, detail, toen/nu). Welke rollen SHSEL wil, is nog open. De editor verkleint naar WebP (max. 1200 px, ca. 150 kB) en vraagt bron, aanleverder, periode en rechten.
- **Gebouwd (okt 2026, fase 2 van het ontwerp):**
  - Code: `js/github.js` (alleen de GitHub-API, foutmeldingen in gewone taal) en `js/voorstel.js` (verschillen beschrijven, samenvoegen, toestand; zonder scherm, los te testen). `beheer.js` verbindt die met het scherm.
  - Voorstel = tak `inhoud/<onderwerp>-<datum>-<tijd>` vanaf de nieuwste `main`, met één commit (Git Data API: eerst de commit, dan pas de tak; mislukt iets, dan blijft er niets half achter) en een pull request met beschrijving in gewone taal en link naar de nieuwe positie op de luchtfoto.
  - Samenvoegen gebeurt per plek, per gebouw en per onderdeel van het bestand (driewegs, zoals git per regel). Hebben twee mensen dezelfde plek veranderd, dan kiest de contentbeheerder in de editor welke versie blijft. Bij openen wordt een bewaard concept op de nieuwste `main` gezet als dat zonder botsing kan.
  - *Aanpassen* van een eigen voorstel: nieuwe commit op dezelfde tak, nooit forceren. Loopt `main` voor, dan wordt het een samenvoeg-commit met `main`, zodat de beheerder geen botsing ziet.
  - Toestand komt uit de beoordelingen op de **huidige** versie van het voorstel: na een aanpassing moet een collega opnieuw kijken. Opmerking = *request changes*, Akkoord = *approve*.
  - Sleutel: alleen `github_pat_…` (oude sleutels met te veel rechten worden geweigerd). Standaard alleen in `sessionStorage`; in `localStorage` alleen als de gebruiker "Onthoud mij" aanvinkt. De editor laadt na inloggen de inhoud rechtstreeks van `main` (GitHub Pages loopt een paar minuten achter).
  - Nodig bij de beheerders (eenmalig): team contentbeheerders met *Write*, ruleset op `main` met Code Owner-goedkeuring en "oude goedkeuringen vervallen bij een nieuwe push", sleutelbeleid in de organisatie, `CODEOWNERS`.
- **Verhaal en vraag (okt 2026):** blok *3. Verhaal en vraag* in de editor: titel, verhaal, vraag, vier antwoorden met het goede antwoord, uitleg en "bevestigd door SHSEL", voorlopig alleen Nederlands. Verandert de vraag, een antwoord of het goede antwoord, dan gaat "bevestigd" vanzelf uit. Schrijftips uit `js/schrijfhulp.js` (lange zinnen, ontkennende vraag, opvallend lang goed antwoord, ontbrekende uitleg) zijn alleen advies en houden versturen niet tegen; test: `tests/schrijfhulp.test.mjs`.
- **Nieuwe plek en opmerkingen (okt 2026):**
  - *+ Nieuwe plek toevoegen*: alleen een titel; de editor maakt `id` (uit de titel) en het volgende `nummer`, en de plek begint als `concept`. Een nieuwe plek die nog niet op GitHub staat kan weer weg (met een gebouw dat alleen voor die plek gemaakt is). Bestaande plekken worden nooit verwijderd, alleen uit de app gehaald.
  - Voegen twee mensen tegelijk een plek of gebouw toe met hetzelfde `id` of `nummer`, dan krijgt bij versturen de nieuwe van de verstuurder een vrij id of nummer (`maakNieuwUniek` in `js/voorstel.js`); de editor meldt dat.
  - Opmerkingen: `opmerking` bij een plek en `toelichting` bij een gebouw. Niet zichtbaar in de app, wel openbaar op GitHub: geen persoonsgegevens (AVG).
  - Een nieuwe plek heeft alleen Nederlands; in EN en DE verschijnt hij pas na vertaling (fase 3).
- **Nog open:** inhoud splitsen in één bestand per locatie; terugvaltaal; fotogebruik; wie mag `bevestigd` aanzetten; zijn vertalers ook contentbeheerders.

## Werkwijze

- Werk altijd in een aparte branch en bied wijzigingen aan via een pull request. Een beheerder kijkt en voegt samen. Nooit direct naar `main`.
- Kleine stappen: één onderwerp per pull request.
- Beschrijf in elke pull request in gewone taal: wat is veranderd, hoe een beheerder het kan testen, en wat er nog niet werkt.
- Test op een smal (mobiel) scherm voordat je een pull request aanbiedt.

## Documenten: wat staat waar

**Let op: deze repository is openbaar.** Iedereen op internet kan alles lezen, ook oude versies. Wat er eenmaal op staat, krijg je er praktisch niet meer af. Twijfel je, zet het dan (nog) niet op GitHub.

| Wat | Waar |
| --- | --- |
| Afspraken en vastgestelde besluiten | `CLAUDE.md` (dit bestand) |
| Uitleg voor beheerders bij een onderdeel (hoe doe je …) | `*-LEESMIJ.md` naast de code |
| Ideeën en voorstellen waarover nog niet besloten is | `ideeen/` |
| Vastgestelde ontwerpen (wat de app doet en waarom) | `docs/` |
| Werkstukken, concepten voor één persoon, gespreksnotities, agenda's | claude.ai-project "SHSEL app/ website", niet op GitHub |
| Oorspronkelijke teksten (NL, EN, DE), Stadsarchief-lijst, huisstijl, voorwaarden | claude.ai-project |
| Proeffoto's zonder geregelde rechten, lesmateriaal met antwoorden, interne contactgegevens (wie bel je bij een storing), bestanden die beheerders samen gebruiken | privé-repository `shsel-enschede/enschede-app-intern` (alleen team beheerders), niet in deze repository |

- **Geen persoonsgegevens op GitHub:** geen namen van vrijwilligers, docenten of scholen, geen e-mailadressen of telefoonnummers, tenzij de persoon akkoord heeft gegeven. Schrijf in openbare stukken over rollen ("een docent", "een beheerder").
- **Geen interne overwegingen** die SHSEL of anderen kunnen schaden (bijvoorbeeld over personen, geld of onderhandelingen), en geen beschrijving van zwakke plekken in de beveiliging die nog niet zijn opgelost.
- **Van project naar GitHub:** een stuk uit het claude.ai-project gaat pas naar `ideeen/` of `docs/` als een algemene versie zonder namen. Vermeld bovenin dat het een kopie is en van welk projectdocument.
- **Wordt een idee een besluit:** verplaats het van `ideeen/` naar `docs/` en zet de kernafspraak in `CLAUDE.md`.
- Ook hier: elke wijziging via een eigen branch en pull request.
