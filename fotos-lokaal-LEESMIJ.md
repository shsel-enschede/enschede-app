# Lokale proefversie met foto's

Zo bekijk je de app op je eigen computer **met** foto's waarvan de rechten nog niet geregeld zijn.
Die foto's komen nooit op GitHub of op de live site.

## Hoe het werkt

- Maak naast `fotos/` een map **`fotos-lokaal/`** en zet daar de foto's in.
- Die map staat in `.gitignore`. GitHub Desktop toont hem daarom niet bij "Changes" en neemt hem nooit mee.
- De bestandsnaam moet gelijk zijn aan `bestand_klaar` in `content/fotos.json` (bijvoorbeeld `jacobuskerk-nu.webp`).
- Alleen als je de app opent via `localhost` toont hij deze foto's, met het label **"Proef: rechten nog niet bevestigd"**.
- Op de live site bestaat de map niet; daar zie je alleen foto's met `rechten_geregeld: true` uit `fotos/`.

## De app lokaal starten

1. Open in Verkenner de map van de app (waar `index.html` staat).
2. Klik in de adresbalk, typ `cmd` en druk op Enter.
3. Typ `python -m http.server 8000` en druk op Enter. Laat dit venster open.
4. Open in je browser `http://localhost:8000`.
5. Klaar? Sluit het zwarte venster.

## Als de rechten geregeld zijn

Verplaats de foto van `fotos-lokaal/` naar `fotos/`, vul in `content/fotos.json` `bestand`, `alt` en `rechten` in,
zet `rechten_geregeld` op `true` en bied de wijziging aan via een pull request.
