# Studietracker Mediavormgever (DEMO)

Proefversie van een studentvolgsysteem voor de mbo-opleiding Mediavormgever (crebo 27110, kwalificatiedossier 23439).
Studenten zien hoe hun opdrachten optellen tot leerdoelen en kerntaken. Docenten bevestigen resultaten met een ondertekende code.

**Dit is een ontwikkeloverzicht, geen examinering.** De opdrachten zijn verzonnen (DEMO). Cursussen en leerdoelen komen uit het cursusoverzicht van de opleiding.

- Studenten: `…/student/`
- Docenten: `…/docent/`

## Hoe het werkt

### Voor studenten

1. Open de app en vul één keer je studentnummer in. Op een telefoon kun je hem op je beginscherm zetten; daarna werkt hij ook zonder internet.
2. **Overzicht** laat in één scherm zien wat je al kunt:
   - links je profiel, per kerntaak;
   - in het midden alle 43 leerdoelen als tegels;
   - rechts de cursussen van deze periode, met de volgende stap;
   - onderaan je reis door alle periodes.
3. Bij een cursus vink je opdrachten af die je gedaan hebt (**zelf gemeld**).
4. Je docent geeft je een code, als QR-code of link. Scan of open hem: de opdracht wordt **bevestigd**.
5. Bij **Rapport** druk je je voortgang af of download je een exportbestand. Dat bestand lever je in bij je docent, en het is ook je back-up.

### Voor docenten

1. **Sleutel.** Maak eenmalig een sleutel of open je sleutelbestand. Je ontgrendelt hem met je wachtwoordzin; hij blijft alleen in deze browser.
2. **Klas.** Laad een CSV met de kolommen `studentnummer` en `naam`. Die wordt niet opgeslagen.
3. **Beoordelen.** Kies een cursus en vul per student in: voldaan of nog niet voldaan. Elke student krijgt één code met al zijn resultaten voor die cursus. Je krijgt die codes als printvel met QR-codes en als CSV met links, bijvoorbeeld voor een mailing.
4. **Rapporten.** Lees de exportbestanden van studenten in. Elke code wordt opnieuw gecontroleerd. Het klasoverzicht download je als CSV.

### Waarom codes, en geen gewone database?

Er is geen server en er worden nergens centraal studentgegevens bewaard. Alles staat op het apparaat van de student. Een resultaat van de docent komt daarom via een code bij de student.

Zo'n code bevat:
- het studentnummer;
- de opdracht(en);
- het resultaat;
- de datum;
- een digitale handtekening van de docent (Ed25519).

De app controleert die handtekening met de **publieke sleutel** van de docent, die in de app zit. Alleen wie de **privésleutel** heeft, kan een geldige code maken. Verandert iemand ook maar één teken, bijvoorbeeld "nog niet voldaan" in "voldaan", dan klopt de handtekening niet meer.

De app weigert, elk met een eigen melding:
- een vervalste code;
- een code voor een andere student;
- een onbekende opdracht;
- een onbekend sleutelnummer;
- een code die al is ingevoerd.

## Rekenregels

- **Opdracht:** open, zelf gemeld of bevestigd. Bevestigd wordt hij door een code met "voldaan"; bij meer codes voor dezelfde opdracht telt die met de nieuwste datum.
- **Leerdoel in een cursus:**
  - *behaald* als alle B-opdrachten (beoordeeld) van die cursus bevestigd zijn;
  - *bezig* als er iets gemeld of bevestigd is;
  - anders *nog niet gestart*.
- **Leerdoel over de opleiding:** behaald in één cursus is *behaald*; behaald in twee of meer cursussen is *versterkt*. De bolletjes op een tegel tonen in hoeveel cursussen het behaald is, van alle cursussen waarin het terugkomt.
- **Werkproces:** krijgt alleen voortgang via het leerdoel dat dat werkproces zelf is (LD24 = B1-K1-W1 … LD43 = B1-K2-W3). Andere leerdoelen zijn niet vast aan een werkproces gekoppeld.
- **Kerntaak:** telt de leerdoelen van die kerntaak, zoals in het kwalificatiedossier.
- Elke status heeft een "Waarom?"-uitleg. Een werkproces wordt nooit "afgerond": dit is een ontwikkeloverzicht.

## Waar de gegevens vandaan komen

| Wat | Bron | Echt of DEMO |
| --- | --- | --- |
| Kerntaken en werkprocessen | Kwalificatiedossier Mediavormgeving | echt |
| 43 leerdoelen, met hun kerntaak en korte naam | `curriculum/bron/leerdoelen.yaml` | echt |
| Cursussen per jaar en periode, met hun leerdoelen | `curriculum/bron/cursussen.csv` (zonder docentkolom) | echt |
| Opdrachten: per cursus een oefenopdracht (G) en een eindopdracht (B) | verzonnen | DEMO |

`curriculum/demo.yaml` wordt hieruit gemaakt met `npm run curriculum` en bij elke build tegen een schema gecontroleerd. Opdrachtnummers blijven daarbij behouden, want ze staan in uitgegeven codes.

## Privacy

| Gegeven | Waar het staat |
| --- | --- |
| Voortgang en codes van een student | Alleen op het apparaat van de student (IndexedDB), en in het exportbestand als de student dat maakt |
| Klaslijst | Alleen in het geheugen van de docentbrowser, tot de pagina sluit |
| Privésleutel | Versleuteld (PBKDF2 met 600.000 rondes, AES-GCM) in een bestand bij de docent; ontgrendeld alleen in het geheugen |
| Repository en website | Code, curriculum en publieke sleutels; geen studentgegevens |

Bij elke build controleert `npm run build` twee dingen:
- de studentenpagina bevat geen ondertekencode (anders faalt de build);
- er staat geen privésleutel of sleutelbestand in de gebouwde bestanden (`scripts/controleer-build.ts`).

## Zelf proberen

Je hebt Node.js 22 nodig.

```bash
npm install
```

```bash
npm run demo
```

Dit maakt een demo-sleutel (nummer 200, buiten git), bouwt de app en start hem op <http://localhost:4173/>. Open de docentpagina en kies "Ik heb al een sleutelbestand": het bestand is `keys/demo-docent.sleutel.json` en de wachtwoordzin is `alleen voor de demo, nooit echt gebruiken`.

## Testen

```bash
npm test
```

```bash
npm run test:e2e
```

De schermtests lopen een volledige ronde door:
1. sleutel openen;
2. klaslijst laden;
3. codes maken;
4. als student de link openen;
5. exporteren;
6. als docent inlezen, met een vervalst rapport ertussen.

Elk scherm wordt ook automatisch gecontroleerd op WCAG 2.1 AA. Op een eigen computer installeer je de testbrowser eenmalig met `npx playwright install chromium`.

## Publiceren op GitHub Pages

De workflow `.github/workflows/pages.yml` test, bouwt en publiceert de app bij elke push naar `main`.

Eenmalig in GitHub:
1. Maak de repository openbaar. Pages op een privé-repository kan alleen met een betaald abonnement.
2. Settings → Pages → Source: **GitHub Actions**.
3. Settings → Environments → github-pages: sta branch `main` toe.

### Een eigen sleutel

1. Maak op de docentpagina bij stap 1 een nieuwe sleutel. Je browser slaat `docent-<nummer>.sleutel.json` op; bewaar dat bestand met een reservekopie.
2. De pagina toont een regel met de publieke sleutel. Zet die in `keys/publieke-sleutels.json`, commit en push naar `main`.
3. Na de nieuwe publicatie accepteert de studentenapp codes met die sleutel.

Sleutelnummers 1–199 zijn voor echte sleutels, 200 voor de demo en 250 voor de schermtests.
Wil je liever de opdrachtregel gebruiken: `npm run sleutel:nieuw` en `npm run code`.

## Bekende beperkingen

1. **Codes moeten bij de student komen.** Zonder server ziet een student een resultaat pas na het scannen of openen van zijn code. Dat is de prijs van "geen centrale opslag".
2. **Het studentnummer staat leesbaar in de code.** Wie een code ziet, ziet ook het nummer. Deel QR-codes en links dus per student uit, niet in een groepskanaal.
3. **Een nieuwe sleutel vraagt een nieuwe publicatie** van de app, en intrekken ook. Haal je een uitgelekte sleutel weg, dan worden alle codes met die sleutel ongeldig, ook de echte.
4. **Een student kan codes achterhouden**, bijvoorbeeld een nieuwere "nog niet voldaan". De app toont wat de student invoert, en het rapport wat de student inlevert.
5. **De docent kiest de datum** in een code. Er is geen bescherming tegen terug- of vooruitdateren.
6. **Zelf gemelde opdrachten zijn niet gecontroleerd.** Het klasoverzicht telt ze apart.
7. **Gegevens staan alleen op het apparaat.** Telefoon kwijt zonder back-up is voortgang kwijt; de docent kan de codes wel opnieuw maken. Safari kan opslag van een niet-geïnstalleerde site na ongeveer een week zonder gebruik wissen. De app vraagt blijvende opslag aan en herinnert aan de back-up.
8. **Op iPhone opent een link uit mail of Teams in Safari**, niet in de geïnstalleerde app, en die twee delen hun opslag niet. Scan de QR-code daarom in de app (Code invoeren) of gebruik de app in Safari.
9. **Camera-scannen is niet automatisch getest.** De testomgeving heeft geen camera. Plakken en links zijn wel getest.
10. **De opdrachten zijn DEMO**: twee per cursus. Voor echt gebruik vervang je ze in de bronbestanden. Acht cursussen hebben in het cursusoverzicht geen leerdoelen.
11. **De huidige periode is een schatting** (de laatste met activiteit); de student kan een andere periode kiezen.
12. **Een zwakke wachtwoordzin blijft een risico** als het sleutelbestand uitlekt. De app eist minstens 16 tekens.
