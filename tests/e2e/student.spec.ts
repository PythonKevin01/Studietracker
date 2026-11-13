import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import * as ed from '@noble/ed25519';
import { naarTekst, vanTekst, type BewijsRegel } from '../../src/bewijscode/formaat';
import { maakBewijscode } from '../../src/bewijscode/ondertekenen';

// Alleen fictieve studenten.
const STUDENT = 'D100001';
const ANDERE = 'D100002';

const sleutel = () => JSON.parse(readFileSync('test-uitvoer/e2e-sleutel.json', 'utf8')) as { prive: string };
const code = (regels: BewijsRegel[], studentnummer = STUDENT) =>
  maakBewijscode({ sleutelnummer: 1, datum: '2026-11-13', studentnummer, regels }, ed.etc.hexToBytes(sleutel().prive));

async function toegankelijk(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
}

async function begin(page: Page) {
  await page.goto('student/');
  await expect(page.getByRole('heading', { name: 'Wat is je studentnummer?' })).toBeVisible();
  await page.getByLabel('Studentnummer').fill(STUDENT.toLowerCase());
  await page.getByRole('button', { name: 'Beginnen' }).click();
  await expect(page.getByRole('heading', { name: 'Hoe ver ben ik?' })).toBeVisible();
}

async function plak(page: Page, tekst: string) {
  await page.goto('student/#/code');
  await page.getByLabel('Of plak de code of link').fill(tekst);
  await page.getByRole('button', { name: 'Code invoeren' }).click();
}

const leerdoel = (page: Page, id: string) => page.locator('li').filter({ has: page.getByText(id, { exact: true }) }).first();

test('student: van eerste start tot back-up terugzetten', async ({ page }) => {
  await page.goto('student/');
  await toegankelijk(page);
  await begin(page);
  await expect(page.getByText('Dit is een ontwikkeloverzicht, geen examinering.')).toBeVisible();
  await expect(page.getByText(`studentnummer ${STUDENT}`)).toBeVisible();
  await toegankelijk(page);

  // Zelf melden
  await page.getByRole('link', { name: /Naar de opdrachten/ }).click();
  await expect(page.getByRole('heading', { name: 'Welke opdrachten heb je gedaan?' })).toBeVisible();
  const ld15 = leerdoel(page, 'LD15');
  await expect(ld15.getByText('Nog niet gestart', { exact: true })).toBeVisible();
  await ld15.getByRole('checkbox').nth(2).check(); // DEMO-opdracht 3
  await expect(ld15.getByText('Bezig', { exact: true })).toBeVisible();
  await expect(ld15.getByText('Zelf gemeld', { exact: true })).toBeVisible();
  await ld15.getByText('Waarom?').click();
  await expect(ld15.getByText(/0 van de 1 opdracht\(en\) op niveau B/)).toBeVisible();
  await toegankelijk(page);

  // Code invoeren: plakken
  await plak(page, await code([{ opdrachtNr: 3, resultaat: 'voldaan' }]));
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await expect(page.locator('.stempel')).toBeVisible();
  await toegankelijk(page);
  await page.goto('student/#/vak/demo-vak');
  await expect(leerdoel(page, 'LD15').getByText('Behaald', { exact: true })).toBeVisible();

  // Dezelfde code nog een keer
  const eerste = await code([{ opdrachtNr: 1, resultaat: 'voldaan' }]);
  await plak(page, eerste);
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await plak(page, eerste);
  await expect(page.getByText('Deze code heb je al ingevoerd. Hij telt één keer.')).toBeVisible();

  // Code van een andere student
  await plak(page, await code([{ opdrachtNr: 2, resultaat: 'voldaan' }], ANDERE));
  await expect(page.getByText('Deze code is voor een andere student gemaakt en telt niet voor jou.')).toBeVisible();

  // Gewijzigd resultaat
  const bytes = vanTekst(await code([{ opdrachtNr: 4, resultaat: 'niet_voldaan' }]));
  bytes[bytes.length - 65] = 1;
  await plak(page, naarTekst(bytes));
  await expect(page.getByText(/de handtekening van de docent klopt niet/)).toBeVisible();
  await toegankelijk(page);

  // Link openen (zoals na het scannen met de gewone cameraknop van de telefoon)
  await page.goto(`student/#code=${await code([{ opdrachtNr: 5, resultaat: 'voldaan' }, { opdrachtNr: 6, resultaat: 'niet_voldaan' }])}`);
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await expect(page.getByText('Nog niet voldaan')).toBeVisible();
  expect(page.url()).toMatch(/#\/code$/);

  // Dossier
  await page.getByRole('link', { name: 'Dossier' }).click();
  await expect(page.getByRole('heading', { name: 'Aan welke werkprocessen werk ik?' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Hoe ver ben ik?' })).toBeVisible();
  await page.goto('student/#/vak/demo-vak');
  await expect(leerdoel(page, 'LD15').getByText('Behaald', { exact: true })).toBeVisible();

  // Nergens staat dat iets "afgerond" is.
  for (const scherm of ['#/', '#/vak/demo-vak', '#/dossier', '#/code', '#/rapport']) {
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
  await expect(page.getByRole('heading', { name: 'Hoe ver ben ik?' })).toBeVisible();
  await plak(page, await code([{ opdrachtNr: 2, resultaat: 'voldaan' }]));
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
  await context.setOffline(false);
});

test('student: code via een link vóór de eerste start', async ({ page }) => {
  await page.goto(`student/#code=${await code([{ opdrachtNr: 1, resultaat: 'voldaan' }])}`);
  await expect(page.getByText('Je hebt een code van je docent geopend')).toBeVisible();
  await page.getByLabel('Studentnummer').fill(STUDENT);
  await page.getByRole('button', { name: 'Beginnen' }).click();
  await expect(page.getByText('Code ingevoerd')).toBeVisible();
});
