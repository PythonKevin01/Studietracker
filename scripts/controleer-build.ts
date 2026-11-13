/**
 * Controleert de gebouwde app (map dist, of de map die je meegeeft) op privésleutels.
 *
 *   npm run controleer-build
 *
 * 1. Geen sleutelbestanden: geen *.sleutel.json, geen JSON met "soort": "studietracker-sleutel".
 * 2. Geen bekende privésleutels: van elke sleutel die hier lokaal te openen is (de demo-sleutel
 *    en de testsleutel) wordt gezocht naar de bytes in hex, base64 en base64url.
 * 3. De studentenpagina bevat geen ondertekencode (dat bewaakt ook de build zelf).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import * as ed from '@noble/ed25519';
import { ontgrendelSleutel } from '../src/bewijscode/sleutelbestand';

const MAP = process.argv[2] ?? 'dist';
const DEMO_WACHTWOORDZIN = 'alleen voor de demo, nooit echt gebruiken';

function bestanden(map: string): string[] {
  return readdirSync(map).flatMap((n) => {
    const p = join(map, n);
    return statSync(p).isDirectory() ? bestanden(p) : [p];
  });
}

if (!existsSync(MAP)) {
  console.error(`Map ${MAP} bestaat niet. Bouw eerst de app (npm run build).`);
  process.exit(1);
}
const alle = bestanden(MAP);
const inhoud = new Map(alle.map((b) => [b, readFileSync(b).toString('latin1')]));
const fouten: string[] = [];

for (const b of alle) if (b.endsWith('.sleutel.json')) fouten.push(`Sleutelbestand in de build: ${b}`);
for (const [b, t] of inhoud) if (/"soort"\s*:\s*"studietracker-sleutel"/.test(t)) fouten.push(`Inhoud van een sleutelbestand in ${b}`);

const sleutels: { naam: string; prive: Uint8Array }[] = [];
if (existsSync('test-uitvoer/e2e-sleutel.json')) {
  sleutels.push({ naam: 'testsleutel', prive: ed.etc.hexToBytes(JSON.parse(readFileSync('test-uitvoer/e2e-sleutel.json', 'utf8')).prive) });
}
if (existsSync('keys/demo-docent.sleutel.json')) {
  const s = await ontgrendelSleutel(JSON.parse(readFileSync('keys/demo-docent.sleutel.json', 'utf8')), DEMO_WACHTWOORDZIN);
  sleutels.push({ naam: 'demo-sleutel', prive: s.priveSleutel });
}
for (const { naam, prive } of sleutels) {
  const vormen = [Buffer.from(prive).toString('hex'), Buffer.from(prive).toString('base64').replace(/=+$/, ''), Buffer.from(prive).toString('base64url')];
  for (const [b, t] of inhoud) {
    if (vormen.some((v) => t.includes(v) || t.includes(v.toUpperCase()))) fouten.push(`Privésleutel (${naam}) gevonden in ${b}`);
  }
}

const studentJs = alle.filter((b) => /student-[^/]*\.js$/.test(b));
for (const b of studentJs) {
  const t = inhoud.get(b)!;
  if (t.includes('studietracker-sleutel/1/') || t.includes('PBKDF2')) fouten.push(`Sleutelbestand-code in de studentenpagina: ${b}`);
}

if (fouten.length) {
  console.error(`FOUT: de build bevat sleutelmateriaal.\n- ${fouten.join('\n- ')}`);
  process.exit(1);
}
console.log(`In orde: ${alle.length} bestanden in ${MAP} doorzocht, ${sleutels.length} bekende privésleutel(s) gecontroleerd (${sleutels.map((s) => s.naam).join(', ') || 'geen'}). Geen sleutelbestanden, geen privésleutels, geen ondertekencode in de studentenpagina.`);
