# Lokale proefversie met foto's

Zo bekijk je de app op je eigen computer **met** foto's waarvan de rechten nog niet geregeld zijn.
Die foto's komen nooit op GitHub of op de live site.

## Hoe het werkt

- Maak naast `fotos/` een map **`fotos-lokaal/`** en zet daar de foto's in. Beheerders vinden de proeffoto's in de privé-repository `shsel-enschede/enschede-app-intern`, map `fotos-lokaal`: kopieer die map hierheen.
- Die map staat in `.gitignore`. GitHub Desktop toont hem daarom niet bij "Changes" en neemt hem nooit mee.
- De bestandsnaam moet gelijk zijn aan `bestand_klaar` in `content/fotos.json` (bijvoorbeeld `jacobuskerk-nu.webp`).
- Alleen als je de app opent via `localhost` toont hij deze foto's, met het label **"Proef: rechten nog niet bevestigd"**.
- Op de live site bestaat de map niet; daar zie je alleen foto's met `rechten_geregeld: true` uit `fotos/`.

## De app lokaal starten

**Makkelijkst:** dubbelklik op **`start-lokaal.bat`** in de map van de app.
Er opent een zwart venster en je browser toont de app op `http://localhost:8000`.
Klaar? Sluit het zwarte venster.

- Windows kan de eerste keer waarschuwen ("Windows heeft uw pc beschermd"). Klik op **Meer info** en dan **Toch uitvoeren**.
- Zonder het zwarte venster werkt de app niet lokaal. Lijkt hij toch te laden, dan is dat een opgeslagen (oude) versie.
- Oude versie te zien? Druk in de browser op **Ctrl + F5**.

**Met de hand** (als het bestand niet werkt):

1. Open in Verkenner de map van de app (waar `index.html` staat).
2. Klik op een leeg stuk in de adresbalk, typ `cmd` en druk op Enter.
3. Typ `python -m http.server 8000 --bind 127.0.0.1` en druk op Enter. Laat dit venster open.
4. Open in je browser `http://localhost:8000` (let op: `http`, niet `https`).

`--bind 127.0.0.1` zorgt dat alleen jouw computer de app ziet, en niet andere apparaten op hetzelfde wifi-netwerk.
Belangrijk, want de proeffoto's mogen nog niet gedeeld worden.

## Als de rechten geregeld zijn

Verplaats de foto van `fotos-lokaal/` naar `fotos/`, vul in `content/fotos.json` `bestand`, `alt` en `rechten` in,
zet `rechten_geregeld` op `true` en bied de wijziging aan via een pull request.
