import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import * as ed from '@noble/ed25519';
import { naarTekst, vanTekst, type BewijsRegel } from '../../src/bewijscode/formaat';
import { maakBewijscode } from '../../src/bewijscode/ondertekenen';
import { parse } from 'yaml';

// Opdrachtnummers uit het gegenereerde curriculum.
const curriculum = parse(readFileSync('curriculum/demo.yaml', 'utf8')) as { cursussen: { opdrachten: { id: string; nr: number }[] }[] };
const NR = Object.fromEntries(curriculum.cursussen.flatMap((c) => c.opdrachten.map((o) => [o.id, o.nr]))) as Record<string, number>;
// LD03 zit in Photoshop-01 en Computervaardigheden (beide periode 1): zo is "versterkt" te testen.
const PS_EIND = NR['p1-photoshop-01-eindopdracht']!;
const PS_OEFEN = NR['p1-photoshop-01-oefenen']!;
const CV_EIND = NR['p1-computervaardigheden-eindopdracht']!;
const CV_OEFEN = NR['p1-computervaardigheden-oefenen']!;
const IL_EIND = NR['p1-illustratie-01-eindopdracht']!;

// Alleen fictieve studenten.
const STUDENT = 'D100001';
const ANDERE = 'D100002';

const sleutel = () => JSON.parse(readFileSync('test-uitvoer/e2e-sleutel.json', 'utf8')) as { prive: string };
const code = (regels: BewijsRegel[], studentnummer = STUDENT) =>
  maakBewijscode({ sleutelnummer: 250, datum: '2026-11-13', studentnummer, regels }, ed.etc.hexToBytes(sleutel().prive));

async function toegankelijk(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function begin(page: Page) {
  await page.goto('student/');
  await expect(page.getByRole('heading', { name: 'Wat is je studentnummer?' })).toBeVisible();
  await page.getByLabel('Studentnummer').fill(STUDENT.toLowerCase());
  await page.getByRole('button', { name: 'Beginnen' }).click();
  await expect(page.getByRole('heading', { name: 'Wat kan ik al?' })).toBeVisible();
}

async function plak(page: Page, tekst: string) {
  await page.goto('student/#/code');
  await page.getByLabel('Of plak de code of link').fill(tekst);
  await page.getByRole('button', { name: 'Code invoeren' }).click();
}

const leerdoelKaart = (page: Page, id: string) => page.locator('#leerdoelen ~ ul > li').filter({ has: page.getByText(id, { exact: true }) }).first();

test('student: van eerste start tot back-up terugzetten', async ({ page }) => {
  await page.goto('student/');
  await toegankelijk(page);
  await begin(page);
  await expect(page.getByText('Dit is een ontwikkeloverzicht, geen examinering.')).toBeVisible();
  await expect(page.getByRole('heading', { name: `Studentnummer ${STUDENT}` })).toBeVisible();
  await expect(page.getByText('0 van de 43 leerdoelen behaald')).toBeVisible();
  await toegankelijk(page);

  // Overzicht: vaardighedenboom, questlog van periode 1 en de reis door alle jaren
  await expect(page.getByRole('button', { name: /^LD03 Auteursrecht ?: nog niet gestart, behaald in 0 van 2 cursussen$/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Periode 1: 9 cursussen' })).toBeVisible();
  await expect(page.getByText('Jaar 3', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /^LD03 Auteursrecht/ }).click();
  await expect(page.getByRole('heading', { name: 'Heeft kennis van auteursrecht, licenties en ethische richtlijnen' })).toBeFocused();
  await page.getByRole('button', { name: /Terug naar periode 1/ }).click();
  await expect(page.getByRole('button', { name: /^LD03 Auteursrecht/ })).toBeFocused();

  // Zelf melden in een cursus
  await page.getByRole('link', { name: /Photoshop-01/ }).click();
  await expect(page.getByRole('heading', { name: 'Welke opdrachten heb je gedaan?' })).toBeVisible();
  await expect(leerdoelKaart(page, 'LD03').getByText('Nog niet gestart', { exact: true }).first()).toBeVisible();
  await page.locator('#p1-photoshop-01-eindopdracht').check();
  await expect(leerdoelKaart(page, 'LD03').getByText('Bezig', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Zelf gemeld', { exact: true })).toBeVisible();
  await leerdoelKaart(page, 'LD03').getByText('Waarom?').first().click();
  await expect(leerdoelKaart(page, 'LD03').getByText(/0 van de 1 opdracht\(en\) op niveau B/)).toBeVisible();
  await toegankelijk(page);

  // Code invoeren: plakken
  await plak(page, await code([{ opdrachtNr: PS_EIND, resultaat: 'voldaan' }]));
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await expect(page.getByText('Photoshop-01 (periode 1): DEMO-eindopdracht')).toBeVisible();
  await expect(page.locator('.stempel')).toBeVisible();
  await toegankelijk(page);
  await page.goto('student/#/cursus/p1-photoshop-01');
  await expect(leerdoelKaart(page, 'LD03').getByText('Behaald', { exact: true }).first()).toBeVisible();

  // Dezelfde code nog een keer
  const eerste = await code([{ opdrachtNr: PS_OEFEN, resultaat: 'voldaan' }]);
  await plak(page, eerste);
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await plak(page, eerste);
  await expect(page.getByText('Deze code heb je al ingevoerd. Hij telt één keer.')).toBeVisible();

  // Code van een andere student
  await plak(page, await code([{ opdrachtNr: IL_EIND, resultaat: 'voldaan' }], ANDERE));
  await expect(page.getByText('Deze code is voor een andere student gemaakt en telt niet voor jou.')).toBeVisible();

  // Gewijzigd resultaat
  const bytes = vanTekst(await code([{ opdrachtNr: IL_EIND, resultaat: 'niet_voldaan' }]));
  bytes[bytes.length - 65] = 1;
  await plak(page, naarTekst(bytes));
  await expect(page.getByText(/de handtekening van de docent klopt niet/)).toBeVisible();
  await toegankelijk(page);

  // Link openen (bundelcode): tweede cursus met LD03 -> versterkt
  await page.goto(`student/#code=${await code([{ opdrachtNr: CV_EIND, resultaat: 'voldaan' }, { opdrachtNr: CV_OEFEN, resultaat: 'niet_voldaan' }])}`);
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await expect(page.getByText('Nog niet voldaan')).toBeVisible();
  expect(page.url()).toMatch(/#\/code$/);

  // Opleiding en dossier tonen versterkt
  await page.goto('student/#/');
  await expect(page.getByText('3 van de 43 leerdoelen behaald')).toBeVisible();
  await expect(page.getByRole('button', { name: /^LD03 Auteursrecht ?: versterkt, behaald in 2 van 2 cursussen$/ })).toBeVisible();
  // Een andere periode kiezen in de reis
  await page.getByRole('button', { name: /^P2/ }).click();
  await expect(page.getByRole('heading', { name: 'Periode 2: 9 cursussen' })).toBeVisible();
  await page.getByRole('link', { name: 'Cursussen' }).click();
  await expect(page.getByRole('heading', { name: 'Welke cursussen heb je gehad?' })).toBeVisible();
  await toegankelijk(page);

  // Rapport: exporteren
  await page.getByRole('link', { name: 'Rapport' }).click();
  await expect(page.getByRole('heading', { name: 'Wil je je voortgang delen of bewaren?' })).toBeVisible();
  await toegankelijk(page);
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Exportbestand downloaden' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^studietracker-D100001-\d{4}-\d{2}-\d{2}\.json$/);
  const pad = test.info().outputPath('export.json');
  await download.saveAs(pad);
  const bestand = JSON.parse(readFileSync(pad, 'utf8'));
  expect(bestand).toMatchObject({ soort: 'studietracker-rapport', studentnummer: STUDENT, demo: true });
  expect(bestand.codes).toHaveLength(3);
  expect(JSON.stringify(bestand)).not.toMatch(/naam/i);

  // Alles wissen en de back-up terugzetten
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Alle gegevens van dit apparaat wissen' }).click();
  await expect(page.getByRole('heading', { name: 'Wat is je studentnummer?' })).toBeVisible();
  await page.getByLabel('Ik heb al een back-up').setInputFiles(pad);
  await expect(page.getByRole('heading', { name: 'Wat kan ik al?' })).toBeVisible();
  await expect(page.getByText('3 van de 43 leerdoelen behaald')).toBeVisible();

  // Nergens staat dat iets "afgerond" is.
  for (const scherm of ['#/', '#/cursussen', '#/cursus/p1-photoshop-01', '#/code', '#/rapport']) {
    await page.goto(`student/${scherm}`);
    await expect(page.locator('main')).toBeVisible();
    expect((await page.locator('body').innerText()).toLowerCase()).not.toContain('afgerond');
  }
});

test('student: werkt zonder internet na het eerste bezoek', async ({ page, context }) => {
  await begin(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Wat kan ik al?' })).toBeVisible();
  await plak(page, await code([{ opdrachtNr: PS_OEFEN, resultaat: 'voldaan' }]));
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await context.setOffline(false);
});

test('student: code via een link vóór de eerste start', async ({ page }) => {
  await page.goto(`student/#code=${await code([{ opdrachtNr: PS_EIND, resultaat: 'voldaan' }])}`);
  await expect(page.getByText('Je hebt een code van je docent geopend')).toBeVisible();
  await page.getByLabel('Studentnummer').fill(STUDENT);
  await page.getByRole('button', { name: 'Beginnen' }).click();
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
});
