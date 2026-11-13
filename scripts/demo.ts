/**
 * Hulpmiddel voor de demo. Alle bestanden die dit script schrijft, staan
 * buiten git (zie .gitignore) en komen niet in de build.
 *
 *   npx tsx scripts/demo.ts sleutel [--als-nodig]
 *       Maakt een demo-sleutelpaar (sleutelnummer 1):
 *       - keys/publieke-sleutels.lokaal.json  publieke sleutel, wordt in de app gebouwd
 *       - keys/demo-docent.sleutel.json       privésleutel, versleuteld met de demo-wachtwoordzin
 *
 *   npx tsx scripts/demo.ts code <studentnummer> <opdrachtnr>[,...] [--niet-voldaan]
 *       Maakt een bewijscode en drukt de link af.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { maakLink } from '../src/bewijscode/formaat';
import { maakBewijscode, maakSleutelpaar } from '../src/bewijscode/ondertekenen';
import { ontgrendelSleutel, versleutelSleutel } from '../src/bewijscode/sleutelbestand';

export const DEMO_WACHTWOORDZIN = 'alleen voor de demo, nooit echt gebruiken';
const PUBLIEK = 'keys/publieke-sleutels.lokaal.json';
const PRIVE = 'keys/demo-docent.sleutel.json';
const BASIS_URL = process.env.DEMO_URL ?? 'http://localhost:4173/student/';

async function sleutel(alsNodig: boolean) {
  if (alsNodig && existsSync(PUBLIEK) && existsSync(PRIVE)) {
    console.log(`Demo-sleutel bestaat al (${PRIVE}).`);
    return;
  }
  mkdirSync('keys', { recursive: true });
  const paar = await maakSleutelpaar();
  const bestand = await versleutelSleutel(paar.priveSleutel, 1, DEMO_WACHTWOORDZIN);
  writeFileSync(PRIVE, JSON.stringify(bestand, null, 2) + '\n');
  writeFileSync(PUBLIEK, JSON.stringify([{ nummer: 1, sleutel: bestand.publiekeSleutel, omschrijving: 'DEMO-sleutel' }], null, 2) + '\n');
  console.log(`Demo-sleutel gemaakt.\n  Publiek: ${PUBLIEK}\n  Privé (versleuteld): ${PRIVE}\n  Wachtwoordzin: "${DEMO_WACHTWOORDZIN}"`);
  console.log('Bouw de app opnieuw, zodat hij de nieuwe publieke sleutel kent.');
}

async function code(studentnummer: string | undefined, nrs: string | undefined, nietVoldaan: boolean) {
  if (!studentnummer || !nrs) throw new Error('Gebruik: code <studentnummer> <opdrachtnr>[,...] [--niet-voldaan]');
  const s = await ontgrendelSleutel(JSON.parse(readFileSync(PRIVE, 'utf8')), DEMO_WACHTWOORDZIN);
  const tekst = await maakBewijscode(
    {
      sleutelnummer: s.sleutelnummer,
      datum: new Date().toISOString().slice(0, 10),
      studentnummer,
      regels: nrs.split(',').map((n) => ({ opdrachtNr: Number(n), resultaat: nietVoldaan ? ('niet_voldaan' as const) : ('voldaan' as const) })),
    },
    s.priveSleutel,
  );
  console.log(`Code:  ${tekst}\nLink:  ${maakLink(BASIS_URL, tekst)}`);
}

const [opdracht, ...rest] = process.argv.slice(2);
const vlaggen = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));
if (opdracht === 'sleutel') await sleutel(vlaggen.has('--als-nodig'));
else if (opdracht === 'code') await code(args[0], args[1], vlaggen.has('--niet-voldaan'));
else {
  console.error('Gebruik: tsx scripts/demo.ts sleutel [--als-nodig] | code <studentnummer> <opdrachtnr>[,...] [--niet-voldaan]');
  process.exit(1);
}
