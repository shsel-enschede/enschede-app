# Hart van Enschede en de Enschede app: combineren

*Losse gedachten en analyse, 8 oktober 2026. Werkdocument, nog geen besluit. Kopie van `claude/hart-van-enschede-en-enschede-app.md` in het claude.ai-project.*

"Hart van Enschede" is hier de werktitel van het wandelprototype (`hart_van_enschede.html`): een wandeling van 1,4 km door het centrum met zeven stops, elk met een verhaal, een spel of puzzel en gespreksvragen.

Let op: "Hart van Enschede" is ook de naam van het huis-aan-huisblad (zie `claude/huisstijl.md`). Daarom is het geen goede naam voor een route in de app.

## Overeenkomsten en verschillen

| | Enschede app | Hart van Enschede |
|---|---|---|
| Doel | Enschedese geschiedenis ontdekken, vooral door scholieren | Een beleefde wandeling met verhalen en spel |
| Opzet | Vrij ontdekken, geen vaste volgorde | Vaste route, 7 stops, 1,4 km |
| Omvang | 64 locaties (oud), uit te breiden | 7 stops |
| Interactie | Eén meerkeuzevraag met uitleg per locatie | Een eigen spel per stop + gespreksvragen |
| Doelgroep | Bovenbouw basisschool, onderbouw voortgezet onderwijs, gezinnen | Breder: gezinnen, volwassenen, groepjes |
| Inhoud | Gescheiden data (`locaties.json`), NL/EN/DE | In één HTML-bestand verwerkt |
| Beheer | Door vrijwilligers, via een editor zonder techniek | Alleen door een ontwikkelaar |
| Huisstijl | SHSEL (briefpapier, logo) | GroenBlauw Enschede (gemeente) |
| Privacy | Er verlaat geen gegeven de telefoon | Live AI-assistent (Claude API) en reviewformulier |

**Overlappende plekken:** vuurwerkmonument, Veldpoort en Ariëns komen in beide voor. De andere stops van Hart van Enschede staan nog niet in de app.

## René, 8 oktober 2026

> De kracht van de Enschede app zit in het ontdekkende karakter. Hart van Enschede kan daar best een onderdeel van zijn, in keuzes als "eigen route – route door het oude centrum – route naar Roombeek". De namen van de routes vind ik nog slecht. Goede namen zetten mensen direct op een goed spoor.
>
> Voor Hart van Enschede is het een voordeel dat de wandeling gevoed wordt door de "zachte" aanwijzingen dat je langs of voor een historisch gebouw of plek loopt of staat. Niet alle locaties in Hart van Enschede komen voor in de Enschede app, sommige wel (vuurwerkmonument, Veldpoort, Ariëns), maar dat kan prima opgevangen worden.
>
> Voor de Enschede app kan het een verrijking zijn: de kern blijft zoals opgezet, maar mensen kunnen andere keuzes maken.

## Eerdere eerste gedachten (Claude)

1. **Route als laag bovenop de vrije kaart.** Vrij ontdekken blijft de standaard. Een route is alleen een lijstje locatie-ID's in vaste volgorde, met een lijn op de kaart. Er komt geen tweede contentbron, dus elke plek wordt op één plek beheerd. Het veld `routes` in `content/locaties.json` bestaat al (nu ongebruikt) en kan hiervoor terugkomen.
2. **Spelvormen alleen als generieke sjablonen** die vrijwilligers met tekst en foto's vullen: *toen en nu / zoek de verschillen* (twee foto's), *galgje* (woord + hint), *memory* (fotoparen). Maatwerk zoals de weefontwerper, het boogschieten en Monty Hall niet overnemen, want dat is niet te onderhouden door vrijwilligers.
3. **Minder overschrijven door scholieren.** Wisselende puzzels en open gespreksvragen (nabespreken in de klas) zijn lastiger door te geven dan één meerkeuzeantwoord. Zo verschuift het van afvinken naar meemaken.
4. **Twee doelgroepen, één app.** De vrije kaart met vragen is voor scholieren en gezinnen, routes voor volwassenen en toeristen. De Stadsgidsen waren in 2019 medefinancier: een mogelijke partner.
5. **Bewust niet meenemen:** de live AI-assistent (API-sleutel in een openbare app leidt tot misbruik en kosten; AI-invoer door kinderen raakt aan de AVG), het reviewformulier (persoonsgegevens, spam) en de GroenBlauw-huisstijl.
6. **Wel overdraagbaar:** de oplossing voor te lange schermen (altijd naam, teaser en vraag of spel; de rest inklapbaar onder "lees meer").

Voorgestelde volgorde: eerst de basis met 64 locaties af, dan de routefunctie, en daarna één spelsjabloon als proef.

## Analyse van Renés reactie

### Routes als keuze, niet als verplichting
Dit sluit aan bij het ontwerpprincipe "vrij ontdekken" in `CLAUDE.md`. Een route is een **suggestie**:
- Ook in een route blijven andere plekken opduiken met "Je loopt langs …". Afwijken mag altijd.
- Er is geen "fout" als je een stop overslaat, en geen volgorde-dwang. "Volgende stop" is een richting, geen poort.
- Wie een route halverwege stopt, houdt alle ontdekte plekken. Die tellen ook mee in de vrije verzameling.

Zo blijft autonomie (zelfbeschikkingstheorie) overeind, en geeft de route alleen structuur aan wie dat prettig vindt.

Let op: `CLAUDE.md` zegt nu "geen routekeuze". Routes invoeren is dus een wijziging van een eerder besluit en hoort eerst langs het bestuur.

### "Zachte aanwijzingen" zijn het verbindende stuk
De melding "Je loopt langs …" bestaat al in de app. In een route kan dezelfde melding twee dingen doen: de eerstvolgende stop aankondigen, en tussendoor plekken buiten de route laten zien. Dat is precies wat Hart van Enschede rijker maakt dan een papieren route. Er hoeft technisch weinig bij te komen.

### Ontbrekende locaties: maak er gewone locaties van
Twee mogelijkheden:
- **A. Elke stop wordt een gewone locatie** in `locaties.json`, met verhaal, foto en vraag. Ze worden dan ook in de vrije modus ontdekt, en beheerd met dezelfde editor.
- **B. Route-only tussenstops** zonder vraag.

Advies: **A**. Eén inhoudsmodel is eenvoudiger voor vrijwilligers en voorkomt dubbel onderhoud. Er ligt al een wensenlijst met ruim 30 nieuwe locaties; de ontbrekende stops passen daar gewoon in.

### Routenamen
Goede namen werken als belofte: ze zeggen in een paar woorden wat je gaat beleven. Vuistregels:
- Kort (2–4 woorden), concreet en beeldend. Begrijpelijk voor een kind van 10 (taalniveau B1).
- Vertel wat je ervaart, niet wat het technisch is ("route", "modus").
- Zet praktische info **onder** de naam, niet erin: afstand, duur, aantal plekken. Dat geeft verwachting en een haalbaar doel.
- Gebruik dezelfde vorm voor alle drie, zodat het één familie is.
- Niet "Hart van Enschede" (krant).

Eerste denkrichtingen, om mee te spelen:

| Nu | Ideeën |
|---|---|
| Eigen route | *Zelf ontdekken* · *Op eigen houtje* · *Struinen* |
| Route oude centrum | *Binnen de oude veste* (sluit aan bij het vestingmotief van het SHSEL-logo) · *Waar Enschede begon* · *Rondje oude stad* |
| Route Roombeek | *Roombeek: van fabriek tot nieuwe wijk* · *Het verhaal van Roombeek* |

Bij Roombeek speelt de vuurwerkramp (2000). Dat vraagt een zorgvuldige toon, zeker voor kinderen en voor mensen die het hebben meegemaakt. Daarom geen naam die de ramp als "attractie" brengt.

Kaartje per keuze, bijvoorbeeld:
> **Binnen de oude veste**
> 1,4 km · ca. 45 min · 7 plekken

### Koppeling met leerkrachten
Een route kan ook via een link of QR-code worden geopend, net als het eerdere idee voor een doel van de leerkracht ("bezoek 24 van de 64"). Een leerkracht kan zo een klas één route geven, zonder login of opslag op een server.

## Open vragen
- Welke stops van Hart van Enschede ontbreken nog in de app, en welke teksten en foto's zijn er?
- Wil SHSEL (bestuur) routes in de app? Dit is een uitbreiding op de vrije opzet.
- Spellen: alleen bij routes, of ook als verdieping bij losse locaties?
- Wie bedenkt en controleert de routenamen? Eventueel even testen met een paar kinderen uit de doelgroep.
