/**
 * Maakt curriculum/demo.yaml uit de bronbestanden in curriculum/bron/.
 *
 *   npm run curriculum
 *
 * Opdrachtnummers uit de bestaande demo.yaml blijven behouden.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
import { importeer, type BronLeerdoel } from '../src/curriculum/importeer';
import { leesCurriculum } from '../src/curriculum/schema';

const DOEL = 'curriculum/demo.yaml';

const bestaand = new Map<string, number>();
if (existsSync(DOEL)) {
  const oud = parse(readFileSync(DOEL, 'utf8')) as { cursussen?: { opdrachten?: { id: string; nr: number }[] }[] };
  for (const c of oud.cursussen ?? []) for (const o of c.opdrachten ?? []) bestaand.set(o.id, o.nr);
}

const { curriculum, verslag } = importeer(
  readFileSync('curriculum/bron/cursussen.csv', 'utf8'),
  parse(readFileSync('curriculum/bron/leerdoelen.yaml', 'utf8')) as BronLeerdoel[],
  bestaand,
);
leesCurriculum(curriculum);

const kop = `# GEGENEREERD door scripts/importeer-curriculum.ts (npm run curriculum). Niet met de hand wijzigen.
#
# Echt (aangeleverd door de opleiding): kerntaken en werkprocessen (kwalificatiedossier),
# de leerdoelen en welke cursus welke leerdoelen aanbiedt.
# DEMO (verzonnen voor de proef): de opdrachten en hun niveaus.
# Opdrachtnummers staan in uitgegeven bewijscodes: nooit wijzigen of hergebruiken.
`;
writeFileSync(DOEL, kop + stringify(curriculum, { lineWidth: 0, flowCollectionPadding: false }));
console.log(`${DOEL}: ${curriculum.cursussen.length} cursussen, ${curriculum.leerdoelen.length} leerdoelen, ${curriculum.cursussen.reduce((n, c) => n + c.opdrachten.length, 0)} opdrachten.`);
if (verslag.samengevoegd.length) console.log(`Samengevoegd (stond meer dan eens in het overzicht): ${verslag.samengevoegd.join('; ')}`);
if (verslag.zonderLeerdoelen.length) console.log(`Zonder leerdoelen: ${verslag.zonderLeerdoelen.join('; ')}`);
