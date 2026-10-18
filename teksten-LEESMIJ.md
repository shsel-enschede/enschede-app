# Vaste teksten van de app (Nederlands, Engels, Duits)

Alle vaste teksten van de app staan in `content/teksten.json`: knoppen, uitleg in het menu, meldingen. Verhalen, vragen en antwoorden staan **niet** hier, maar in `content/locaties.json`.

## Zo ziet een tekst eruit

```json
"start.knop": { "nl": "Bekijk de kaart", "en": "View the map", "de": "Zur Karte" },
```

- Links staat de **sleutel** (`start.knop`). Die gebruikt de app; nooit wijzigen.
- Rechts staan de drie talen naast elkaar. Pas alleen de tekst tussen de aanhalingstekens aan.
- Een aanhalingsteken in de tekst zelf schrijf je als `\"`.

## Invulplekken

`{n}`, `{naam}`, `{klaar}` en dergelijke vult de app zelf in, bijvoorbeeld:

```json
"kaart.lijstgreep": { "nl": "Alle {n} plekken als lijst", ... }
```

Laat de invulplekken staan, in alle drie de talen. De test (`node tests/alles.mjs`) controleert dat.

## Enkelvoud en meervoud

Sommige teksten hebben twee vormen: `one` (1 plek) en `other` (2 of meer plekken).

```json
"kaart.ontdekt": {
  "nl": { "one": "{n} plek ontdekt", "other": "{n} plekken ontdekt" },
  ...
}
```

## Wat als een vertaling ontbreekt

- Ontbreekt een Engelse of Duitse tekst, dan toont de app de Nederlandse. Er gaat niets stuk.
- Ontbreekt een sleutel helemaal, dan staat de sleutel zelf op het scherm (bijv. `start.knop`). Zo valt het op.

## Na een wijziging

- Draai de tests: `node tests/alles.mjs`.
- Een nieuwe `VERSIE` in `sw.js` is voor dit bestand niet nodig: de app haalt het op de achtergrond opnieuw op.
- Zoals altijd: via een eigen branch en pull request.

## Waarom geen vlaggen bij de taalkeuze

Een vlag staat voor een land, niet voor een taal (W3C-richtlijn). Engels is niet alleen Brits, Duits wordt ook in Oostenrijk en Zwitserland gesproken. Daarom kiest de gebruiker uit **Nederlands · English · Deutsch**, elke taal in de eigen taal geschreven.
