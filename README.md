# Studietracker Mediavormgever (DEMO)

Proefversie van een studentvolgsysteem voor de mbo-opleiding Mediavormgever (crebo 27110, kwalificatiedossier 23439).
Alle opdrachten en koppelingen zijn verzonnen voor de demo.

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
npm run demo:code -- D100001 3,5
```

Open de link die verschijnt, of plak de code op het scherm **Code**.
Met `--niet-voldaan` achter de opdracht maak je een code met resultaat "nog niet voldaan".

## Testen

```bash
npm test
```

```bash
npm run test:e2e
```

De schermtests gebruiken Playwright met Chromium. Op een eigen computer installeer je die browser eenmalig met `npx playwright install chromium`.
