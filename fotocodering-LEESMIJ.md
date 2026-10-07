# Fotocodering van de oude app

De foto's van de oude app (2019) staan in de SHSEL-map **Afbeeldingen**, met namen als `33a Zonnewijzer 2 PS.jpg`.
Hier lees je hoe zo'n naam is opgebouwd en waar je kunt zien welke foto's de oude app per locatie gebruikte.

Uitgezocht in oktober 2026: de foto's in de beschrijvingen (Nederlands, Engels, Duits) zijn beeldvergelijkend gekoppeld aan de bestanden in de map.
Elke foto in de beschrijvingen vond zo zijn bestand.

## Opbouw van een bestandsnaam

`NN[a] Onderwerp [volgnummer] [jaartal] [bw] [initialen]`

| Deel | Betekenis |
| --- | --- |
| `NN` | Locatienummer 01–64, hetzelfde nummer als in de beschrijvingen en in `nummer` in `content/locaties.json`. |
| `a` | Gekozen voor de oude app. Let op: dat is niet bijgehouden. 169 van de 189 gebruikte foto's hebben een `a`, 20 gebruikte foto's niet, en 23 `a`-foto's zijn nergens gebruikt. Kijk daarom in de koppeltabel, niet naar de `a`. |
| volgnummer (`2`, `3` …) | Variant binnen dezelfde aanleverder. Zegt niets over de volgorde in de app. |
| jaartal (`1915`, `ca.1955`) | Datering van de foto. |
| `bw` | Waarschijnlijk "bewerkt" (uitsnede of opgeschoond). Niet "zwart-wit": niet alle `bw`-bestanden zijn grijs, en ook een foto uit 2018 heeft `bw`. |
| `PS`, `JB`, `FN`, `Dirk` | Wie de foto aanleverde (bestuursleden). `PS` en `JB`: vooral historische foto's en prentbriefkaarten. `FN`: eigen kleurenfoto's van nu. `Dirk`: luchtfoto's. |
| `86`–`99`, `501`, `600` | Komen in geen enkele beschrijving voor. Waarschijnlijk kandidaatfoto's voor nieuwe locaties. |

## Welke foto's de oude app gebruikte

Zie **`content/oude-app-fotos.json`**: per locatienummer de foto's in de volgorde van de oude app.
De app zelf laadt dit bestand niet; het is naslag voor wie foto's kiest.

- De **eerste foto** is de hoofdfoto: links in de beschrijvingen, de eerste van de fotocarrousel en de ronde miniatuur in de locatielijst.
- In de oude app waren ver van een locatie alle foto's wazig (volgens de handleiding). De nieuwe app toont dan alleen de hoofdfoto, wazig.
- Welke foto de hoofdfoto is, volgt **niet** uit de bestandsnaam.

## Let op bij het kiezen

- **Zelfde foto, andere scan.** Soms staat dezelfde foto er twee keer in, in een andere kwaliteit. Kies de grootste. Voorbeelden:
  - `30 Grote Kerk JB` (scherp) en `30a Grote Kerk 5 PS` (klein);
  - `30 Oude markt 1862 JB` (scherp) en `31a 1862 PS` (klein).
- **Identieke bestanden** onder twee namen:
  - `30 Grote Kerk 3 PS` = `33a Zonnewijzer 3 PS`;
  - `42a Incassobank 5 PS` = `43 SLO PS`;
  - `64 Postkantoor Haaksbergerstr 2 PS` = `64a Postkantoor Haaksbergerstraat PS`;
  - `02 RK Ziekenhuis Dirk1` = `09 Koningshuizen Dirk`.
- De **kaart van 1862** staat bij 11, 31 en 48 (twee uitsneden: `11a Kaart 1862 na de brand 2` en `31a Kaart 1862 na de brand`).
- `19a Beltstraat 2/3/4` en `45a Jannink Beltstraat 3/5` lijken sterk op elkaar (dezelfde fabriek).
- Foto's zonder nummer (bijvoorbeeld `Jacobuskerk ca.1920`, `BATO-complex`) zaten niet in de oude app.
- **Rechten:** dat een foto in de oude app stond, betekent niet dat de rechten voor de nieuwe app geregeld zijn. Zie `fotos/LEESMIJ.md`.
