/**
 * Sleutels en codes vanaf de opdrachtregel, tot de docentpagina (stap 3) klaar is.
 * Alle privésleutels die dit script schrijft, staan buiten git (*.sleutel.json in
 * .gitignore) en komen niet in de build.
 *
 *   npm run demo:sleutel                  Demo-sleutel voor lokaal testen (vaste demo-wachtwoordzin).
 *   npm run sleutel:nieuw                 Eigen sleutel voor de gepubliceerde app. Vraagt een
 *                                         wachtwoordzin en zet de publieke sleutel in
 *                                         keys/publieke-sleutels.json (die commit je).
 *   npm run code -- <studentnr> <nr>[,<nr>…] [--niet-voldaan] [--sleutel <bestand>]
 *                                         Maakt een bewijscode en drukt code en link af.
 *                                         Link-adres: STUDIETRACKER_URL (standaard localhost).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { maakLink } from '../src/bewijscode/formaat';
import { maakBewijscode, maakSleutelpaar } from '../src/bewijscode/ondertekenen';
import { keurWachtwoordzin, ontgrendelSleutel, versleutelSleutel } from '../src/bewijscode/sleutelbestand';
import { leesPubliekeSleutels } from '../src/bewijscode/sleutels';

const DEMO_WACHTWOORDZIN = 'alleen voor de demo, nooit echt gebruiken';
/** Sleutelnummers: 1-199 echte sleutels, 200 demo, 250 schermtests. */
const DEMO_NUMMER = 200;
const MAX_ECHT = 199;
const DEMO_PRIVE = 'keys/demo-docent.sleutel.json';
const DEMO_PUBLIEK = 'keys/publieke-sleutels.lokaal.json';
const PUBLIEK = 'keys/publieke-sleutels.json';
const BASIS_URL = process.env.STUDIETRACKER_URL ?? 'http://localhost:4173/student/';

/** Vraagt iets zonder het op het scherm te tonen. Zonder terminal: uit WACHTWOORDZIN. */
async function vraagGeheim(vraag: string): Promise<string> {
  if (process.env.WACHTWOORDZIN) return process.env.WACHTWOORDZIN;
  if (!process.stdin.isTTY) throw new Error('Geen terminal: zet de wachtwoordzin in WACHTWOORDZIN.');
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const uit = rl as unknown as { _writeToOutput: (s: string) => void };
  let tonen = true;
  uit._writeToOutput = (s) => {
    if (tonen) process.stdout.write(s);
  };
  return new Promise((klaar) => {
    rl.question(vraag, (antwoord) => {
      rl.close();
      process.stdout.write('\n');
      klaar(antwoord);
    });
    tonen = false;
  });
}

async function demoSleutel(alsNodig: boolean) {
  const huidig = existsSync(DEMO_PUBLIEK) ? (JSON.parse(readFileSync(DEMO_PUBLIEK, 'utf8')) as { nummer: number }[]) : [];
  if (alsNodig && existsSync(DEMO_PRIVE) && huidig.every((s) => s.nummer === DEMO_NUMMER) && huidig.length === 1) {
    console.log(`Demo-sleutel bestaat al (${DEMO_PRIVE}).`);
    return;
  }
  mkdirSync('keys', { recursive: true });
  const paar = await maakSleutelpaar();
  const bestand = await versleutelSleutel(paar.priveSleutel, DEMO_NUMMER, DEMO_WACHTWOORDZIN);
  writeFileSync(DEMO_PRIVE, JSON.stringify(bestand, null, 2) + '\n');
  writeFileSync(DEMO_PUBLIEK, JSON.stringify([{ nummer: DEMO_NUMMER, sleutel: bestand.publiekeSleutel, omschrijving: 'DEMO-sleutel' }], null, 2) + '\n');
  console.log(`Demo-sleutel gemaakt (${DEMO_PRIVE}). Alleen voor lokaal testen; de wachtwoordzin staat in dit script.`);
}

async function nieuweSleutel() {
  const bestaand = existsSync(PUBLIEK) ? (JSON.parse(readFileSync(PUBLIEK, 'utf8')) as { nummer: number; sleutel: string; omschrijving?: string }[]) : [];
  leesPubliekeSleutels(bestaand);
  const nummer = Math.max(0, ...bestaand.map((s) => s.nummer).filter((n) => n <= MAX_ECHT)) + 1;
  if (nummer > MAX_ECHT) throw new Error(`Alle sleutelnummers (1-${MAX_ECHT}) zijn gebruikt.`);

  console.log(`Nieuwe sleutel, nummer ${nummer}.`);
  const zin = await vraagGeheim('Kies een wachtwoordzin (minstens 16 tekens): ');
  const fout = keurWachtwoordzin(zin);
  if (fout) throw new Error(fout);
  if ((await vraagGeheim('Nog een keer: ')) !== zin) throw new Error('De twee wachtwoordzinnen zijn niet gelijk.');

  const paar = await maakSleutelpaar();
  const bestand = await versleutelSleutel(paar.priveSleutel, nummer, zin);
  const prive = `keys/docent-${nummer}.sleutel.json`;
  writeFileSync(prive, JSON.stringify(bestand, null, 2) + '\n');
  writeFileSync(PUBLIEK, JSON.stringify([...bestaand, { nummer, sleutel: bestand.publiekeSleutel }], null, 2) + '\n');
  console.log(`
Klaar.
  Privésleutel (versleuteld, NIET committen): ${prive}
  Publieke sleutel toegevoegd aan:            ${PUBLIEK}  (wel committen)
Bewaar ${prive} ook ergens anders veilig. Kwijt = geen nieuwe codes meer met dit nummer.`);
}

async function code(args: string[], vlaggen: Set<string>, sleutelPad: string) {
  const [studentnummer, nrs] = args;
  if (!studentnummer || !nrs) throw new Error('Gebruik: npm run code -- <studentnummer> <opdrachtnr>[,...] [--niet-voldaan] [--sleutel <bestand>]');
  const zin = sleutelPad === DEMO_PRIVE ? DEMO_WACHTWOORDZIN : await vraagGeheim(`Wachtwoordzin voor ${sleutelPad}: `);
  const s = await ontgrendelSleutel(JSON.parse(readFileSync(sleutelPad, 'utf8')), zin);
  const resultaat = vlaggen.has('--niet-voldaan') ? ('niet_voldaan' as const) : ('voldaan' as const);
  const tekst = await maakBewijscode(
    {
      sleutelnummer: s.sleutelnummer,
      datum: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }),
      studentnummer,
      regels: nrs.split(',').map((n) => ({ opdrachtNr: Number(n), resultaat })),
    },
    s.priveSleutel,
  );
  console.log(`Code:  ${tekst}\nLink:  ${maakLink(BASIS_URL, tekst)}`);
}

const [opdracht, ...rest] = process.argv.slice(2);
const sleutelIndex = rest.indexOf('--sleutel');
const sleutelPad = sleutelIndex >= 0 ? rest.splice(sleutelIndex, 2)[1] ?? '' : DEMO_PRIVE;
const vlaggen = new Set(rest.filter((a) => a.startsWith('--')));
const args = rest.filter((a) => !a.startsWith('--'));
try {
  if (opdracht === 'sleutel') await demoSleutel(vlaggen.has('--als-nodig'));
  else if (opdracht === 'nieuw') await nieuweSleutel();
  else if (opdracht === 'code') await code(args, vlaggen, sleutelPad);
  else throw new Error('Gebruik: tsx scripts/demo.ts sleutel [--als-nodig] | nieuw | code <studentnummer> <opdrachtnr>[,...]');
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
