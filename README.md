# Studietracker Mediavormgever (DEMO)

Proefversie van een studentvolgsysteem voor de mbo-opleiding Mediavormgever (crebo 27110, kwalificatiedossier 23439).

## Waar de gegevens vandaan komen

| Wat | Bron | Echt of DEMO |
| --- | --- | --- |
| Kerntaken en werkprocessen | Kwalificatiedossier Mediavormgeving | echt |
| 43 leerdoelen, met hun kerntaak | Leerdoelenlijst van de opleiding (`curriculum/bron/leerdoelen.yaml`) | echt |
| Cursussen per jaar en periode, met hun leerdoelen | Cursusoverzicht (`curriculum/bron/cursussen.csv`, zonder docentkolom) | echt |
| Opdrachten (per cursus een oefenopdracht G en een eindopdracht B) | verzonnen | DEMO |

`curriculum/demo.yaml` wordt hieruit gemaakt met `npm run curriculum`. Opdrachtnummers blijven daarbij behouden.

**Keten:** opdracht → leerdoel (in een cursus) → kerntaak. Een leerdoel is behaald in een cursus als de B-opdrachten ervoor bevestigd zijn.
Hetzelfde leerdoel komt vaak in meer cursussen terug: behaald in één cursus is *behaald*, in meer cursussen is *versterkt*.
Leerdoelen zijn niet vast aan een werkproces gekoppeld. Een werkproces krijgt alleen voortgang via het leerdoel dat dat werkproces zelf is (LD24 = B1-K1-W1 … LD43 = B1-K2-W3).

**Dit is een ontwikkeloverzicht, geen examinering.**

> Werk in uitvoering. Stap 1 (curriculum, rekenregels, bewijscodes) en stap 2 (studentpagina) zijn klaar.
> Stap 3 (docentpagina, rapporten inlezen, volledige uitleg en bekende beperkingen) volgt.

## Zelf proberen

Je hebt Node.js 22 nodig.

```bash
npm install
```

```bash
npm run demo
```

Dit maakt een demo-sleutel (buiten git), bouwt de app en start hem op <http://localhost:4173/>.
Open de studentpagina, vul een verzonnen studentnummer in (bijvoorbeeld `D100001`) en maak in een tweede terminal een code:

```bash
npm run code -- D100001 3,5
```

Open de link die verschijnt, of plak de code op het scherm **Code**.
Met `--niet-voldaan` maak je een code met resultaat "nog niet voldaan".

## Testen

```bash
npm test
```

```bash
npm run test:e2e
```

De schermtests gebruiken Playwright met Chromium. Op een eigen computer installeer je die browser eenmalig met `npx playwright install chromium`.

## Publiceren op GitHub Pages

De workflow `.github/workflows/pages.yml` test, bouwt en publiceert de app bij elke push naar `main`.
Het adres wordt `https://<gebruikersnaam>.github.io/<repository>/student/` (docent: `…/docent/`).

Eenmalig in GitHub:

1. **Settings → General → Danger Zone → Change visibility → Public.** Pages op een privé-repository kan alleen met een betaald GitHub-abonnement.
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. Maak een branch `main` en zet die bij **Settings → General → Default branch** als standaard.

### Een eigen sleutel voor de gepubliceerde app

De gepubliceerde app accepteert alleen codes van sleutels uit `keys/publieke-sleutels.json`.
Maak op je eigen computer een sleutel:

```bash
npm run sleutel:nieuw
```

Het script vraagt een wachtwoordzin en maakt twee dingen:

- `keys/docent-1.sleutel.json`: je privésleutel, versleuteld. Staat buiten git. Bewaar een kopie op een veilige plek.
- een regel in `keys/publieke-sleutels.json`: die commit en push je, waarna de app opnieuw wordt gepubliceerd.

Een code maken voor de gepubliceerde app:

```bash
STUDIETRACKER_URL=https://<gebruikersnaam>.github.io/<repository>/student/ npm run code -- D100001 3 --sleutel keys/docent-1.sleutel.json
```
