import { readFileSync, writeFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { leesCsv } from '../../src/gedeeld/csv';
import { naarTekst, vanTekst } from '../../src/bewijscode/formaat';

// Laptop: de docentpagina is voor een groot scherm gemaakt.
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

const WACHTWOORDZIN = 'alleen voor de schermtests';

async function toegankelijk(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function opslaan(page: Page, klik: () => Promise<void>, naam: string) {
  const [download] = await Promise.all([page.waitForEvent('download'), klik()]);
  const pad = test.info().outputPath(naam);
  await download.saveAs(pad);
  return { pad, naam: download.suggestedFilename() };
}

test('volledige ronde: sleutel, klas, codes, student, rapport, klasoverzicht', async ({ page, context }) => {
  // 1. Sleutel ontgrendelen (eerst een verkeerde wachtwoordzin)
  await page.goto('docent/');
  await expect(page.getByRole('heading', { name: 'Met welke sleutel onderteken je codes?' })).toBeVisible();
  await toegankelijk(page);
  const open = page.locator('form').first();
  await open.getByLabel('Sleutelbestand').setInputFiles('test-uitvoer/e2e-docent.sleutel.json');
  await open.getByLabel('Wachtwoordzin').fill('verkeerde wachtwoordzin hier');
  await open.getByRole('button', { name: 'Ontgrendelen' }).click();
  await expect(page.getByRole('alert')).toHaveText(/De wachtwoordzin klopt niet/);
  await open.getByLabel('Wachtwoordzin').fill(WACHTWOORDZIN);
  await open.getByRole('button', { name: 'Ontgrendelen' }).click();
  await expect(page.getByText('Sleutel 250 is ontgrendeld voor deze sessie')).toBeVisible();
  await expect(page.getByText('De studentenapp kent deze sleutel nog niet')).toHaveCount(0);

  // 2. Klaslijst (fictieve studenten, puntkomma zoals Excel)
  const klaslijst = test.info().outputPath('klas.csv');
  writeFileSync(klaslijst, 'Studentnummer;Naam\nD100001;Fenna Fictief\nD100002;Sem Verzonnen\nD100003;Noor Voorbeeld\n');
  await page.getByRole('link', { name: /2\. Klas/ }).click();
  await page.getByLabel('Klaslijst (CSV)').setInputFiles(klaslijst);
  await expect(page.getByRole('heading', { name: '3 studenten geladen' })).toBeVisible();
  await toegankelijk(page);

  // 3. Beoordelen en codes maken
  await page.getByRole('link', { name: /3\. Beoordelen/ }).click();
  await page.getByLabel('Cursus').selectOption('p1-photoshop-01');
  await page.getByLabel('Datum van beoordelen').fill('2026-11-13');
  await page.getByLabel('DEMO-oefenopdracht voor Fenna Fictief').selectOption('voldaan');
  await page.getByLabel('DEMO-eindopdracht voor Fenna Fictief').selectOption('voldaan');
  await page.getByLabel('DEMO-eindopdracht voor Sem Verzonnen').selectOption('niet_voldaan');
  await toegankelijk(page);
  await page.getByRole('button', { name: 'Codes maken voor 2 student(en)' }).click();
  await expect(page.getByRole('heading', { name: '2 code(s) gemaakt' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR-code voor Fenna Fictief' }).locator('svg')).toBeVisible();
  await expect(page.getByRole('img', { name: 'QR-code voor Noor Voorbeeld' })).toHaveCount(0);
  await toegankelijk(page);
  // Printvel: alleen de kaarten, zonder menu
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('navigation', { name: 'Stappen' })).toBeHidden();
  await expect(page.locator('.printvel').getByText('Fenna Fictief')).toBeVisible();
  await expect(page.getByRole('table')).toBeHidden();
  await page.emulateMedia({ media: 'screen' });

  const csv = await opslaan(page, () => page.getByRole('button', { name: 'CSV met links downloaden' }).click(), 'codes.csv');
  expect(csv.naam).toBe('codes-p1-photoshop-01-2026-11-13.csv');
  const rijen = leesCsv(readFileSync(csv.pad, 'utf8'));
  expect(rijen.map((r) => r.slice(0, 4))).toEqual([
    ['studentnummer', 'naam', 'cursus', 'opdrachten'],
    ['D100001', 'Fenna Fictief', 'Photoshop-01', 'DEMO-oefenopdracht: voldaan; DEMO-eindopdracht: voldaan'],
    ['D100002', 'Sem Verzonnen', 'Photoshop-01', 'DEMO-eindopdracht: nog niet voldaan'],
  ]);
  const linkFenna = rijen[1]![4]!;
  const linkSem = rijen[2]![4]!;
  expect(linkFenna).toMatch(/\/student\/#code=[A-Za-z0-9_-]+$/);

  // 4. Student opent de link, ziet het resultaat en exporteert
  const student = await context.newPage();
  await student.goto(linkFenna);
  await student.getByLabel('Studentnummer').fill('D100001');
  await student.getByRole('button', { name: 'Beginnen' }).click();
  await expect(student.getByText('Code ingevoerd')).toBeVisible();
  await student.goto('student/#/');
  await expect(student.getByText('2 van de 43 leerdoelen behaald')).toBeVisible();
  // De code van Sem werkt niet bij Fenna
  await student.goto(linkSem);
  await expect(student.getByText('Deze code is voor een andere student gemaakt en telt niet voor jou.')).toBeVisible();
  await student.goto('student/#/rapport');
  const exportFenna = await opslaan(student, () => student.getByRole('button', { name: 'Exportbestand downloaden' }).click(), 'fenna.json');

  // Een tweede, vervalst rapport: Sem zet "nog niet voldaan" om naar "voldaan"
  const semCode = vanTekst(new URL(linkSem).hash.replace('#code=', ''));
  semCode[semCode.length - 65] = 1;
  const vervalst = test.info().outputPath('sem.json');
  writeFileSync(
    vervalst,
    JSON.stringify({ soort: 'studietracker-rapport', versie: 1, demo: true, studentnummer: 'D100002', gemaakt: new Date().toISOString(), zelfGemeld: [], codes: [{ code: naarTekst(semCode), ontvangen: new Date().toISOString() }] }),
  );

  // 5. Docent leest de rapporten in
  await page.getByRole('link', { name: /4\. Rapporten/ }).click();
  await page.getByLabel(/Exportbestanden van studenten/).setInputFiles([exportFenna.pad, vervalst]);
  await expect(page.getByRole('heading', { name: 'Klasoverzicht: 2 student(en)' })).toBeVisible();
  const fenna = page.getByRole('row', { name: /Fenna Fictief/ });
  await expect(fenna.getByRole('cell').first()).toHaveText('2 / 43');
  await expect(page.getByText('In 1 rapport(en) staan codes die niet kloppen')).toBeVisible();
  await expect(page.getByText(/D100002: 1 code\(s\) geweigerd/)).toBeVisible();
  await toegankelijk(page);
  const overzicht = await opslaan(page, () => page.getByRole('button', { name: 'Klasoverzicht als CSV' }).click(), 'overzicht.csv');
  const o = leesCsv(readFileSync(overzicht.pad, 'utf8'));
  expect(o[1]!.slice(0, 8)).toEqual(['D100001', 'Fenna Fictief', '1', '0', '2', '0', '2', '0']);
  expect(o[2]!.slice(0, 8)).toEqual(['D100002', 'Sem Verzonnen', '0', '1', '0', '0', '0', '0']);
});

test('nieuwe sleutel maken: versleuteld bestand en uitleg voor de publieke sleutel', async ({ page }) => {
  await page.goto('docent/');
  const maak = page.locator('form').nth(1);
  await maak.getByLabel('Wachtwoordzin', { exact: true }).fill('te kort');
  await maak.getByLabel('Wachtwoordzin nog een keer').fill('te kort');
  await maak.getByRole('button', { name: /Sleutel maken/ }).click();
  await expect(page.getByRole('alert')).toHaveText(/minstens 16 tekens/);
  await maak.getByLabel('Wachtwoordzin', { exact: true }).fill('paars konijn fietst zachtjes');
  await maak.getByLabel('Wachtwoordzin nog een keer').fill('paars konijn fietst zachtjes');
  const bestand = await opslaan(page, () => maak.getByRole('button', { name: /Sleutel maken/ }).click(), 'nieuw.sleutel.json');
  expect(bestand.naam).toMatch(/^docent-\d+\.sleutel\.json$/);
  const inhoud = JSON.parse(readFileSync(bestand.pad, 'utf8'));
  expect(inhoud).toMatchObject({ soort: 'studietracker-sleutel', kdf: { naam: 'PBKDF2', rondes: 600000 }, versleuteling: { naam: 'AES-GCM' } });
  await expect(page.getByText(/is ontgrendeld voor deze sessie/)).toBeVisible();
  await expect(page.getByText('De studentenapp kent deze sleutel nog niet')).toBeVisible();
  await expect(page.getByText(`{"nummer":${inhoud.sleutelnummer},"sleutel":"${inhoud.publiekeSleutel}"}`)).toBeVisible();
});
