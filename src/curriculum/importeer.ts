/**
 * Maakt het curriculum uit de bronnen van de opleiding:
 * - het kwalificatiedossier (kerntaken en werkprocessen, hier vastgelegd),
 * - de leerdoelenlijst (curriculum/bron/leerdoelen.yaml),
 * - het cursusoverzicht (curriculum/bron/cursussen.csv, zonder docentkolom).
 *
 * De opdrachten zijn DEMO: per cursus een oefenopdracht (G) en een
 * eindopdracht (B) voor alle leerdoelen van die cursus. Bestaande
 * opdrachtnummers blijven behouden, zodat uitgegeven bewijscodes geldig blijven.
 */
import { leesCsvObjecten } from '../gedeeld/csv';
import type { Curriculum, Cursus, Kerntaak, Leerdoel } from './schema';

export const KERNTAKEN: Kerntaak[] = [
  {
    id: 'B1-K1',
    titel: 'Ontwerpt mediavormgeving',
    werkprocessen: [
      { id: 'B1-K1-W1', titel: 'Onderzoekt en ontwikkelt een creatief concept' },
      { id: 'B1-K1-W2', titel: 'Presenteert en onderbouwt het creatief concept' },
      { id: 'B1-K1-W3', titel: 'Experimenteert met en ontwikkelt de vormgeving' },
      { id: 'B1-K1-W4', titel: 'Test en evalueert prototypes' },
      { id: 'B1-K1-W5', titel: 'Realiseert en levert de vormgeving op' },
    ],
  },
  {
    id: 'B1-K2',
    titel: 'Positioneert zich in de markt',
    werkprocessen: [
      { id: 'B1-K2-W1', titel: 'Stemt projectvoortgang rond opdrachten af' },
      { id: 'B1-K2-W2', titel: 'Ontwikkelt en onderhoudt de eigen professionaliteit' },
      { id: 'B1-K2-W3', titel: 'Profileert zich als mediavormgever' },
    ],
  },
];

/** Eerste opdrachtnummer. 1-6 waren in gebruik in de eerste demo; die komen niet terug. */
const EERSTE_NR = 101;

export interface BronLeerdoel {
  id: string;
  kerntaak: string[];
  titel: string;
}

export interface ImportVerslag {
  samengevoegd: string[];
  zonderLeerdoelen: string[];
}

/** "heeft kennis van X" -> "Heeft kennis van X"; "K1-W1 Onderzoekt …" -> werkproces B1-K1-W1. */
function maakLeerdoel(b: BronLeerdoel): Leerdoel {
  const kerntaken = b.kerntaak.map((k) => `B1-${k}`);
  const wp = /^(K\d+-W\d+)\s+(.*)$/.exec(b.titel);
  const titel = (wp?.[2] ?? b.titel).trim();
  return {
    id: b.id,
    titel: titel.charAt(0).toUpperCase() + titel.slice(1),
    kerntaken,
    ...(wp ? { werkproces: `B1-${wp[1]}` } : {}),
  };
}

export function maakId(tekst: string): string {
  return tekst
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' en ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function importeer(
  cursussenCsv: string,
  bronLeerdoelen: BronLeerdoel[],
  bestaandeNummers: ReadonlyMap<string, number> = new Map(),
): { curriculum: Curriculum; verslag: ImportVerslag } {
  const leerdoelen = bronLeerdoelen.map(maakLeerdoel);
  const bekend = new Set(leerdoelen.map((l) => l.id));
  const verslag: ImportVerslag = { samengevoegd: [], zonderLeerdoelen: [] };

  // Cursussen op volgorde van het overzicht; dezelfde naam in dezelfde periode wordt één cursus.
  const opId = new Map<string, Omit<Cursus, 'opdrachten'>>();
  for (const rij of leesCsvObjecten(cursussenCsv)) {
    const titel = rij['cursus'] ?? '';
    const periode = Number(rij['periode']);
    const jaar = Number(rij['jaar']);
    if (!titel || !Number.isInteger(periode) || !Number.isInteger(jaar)) throw new Error(`Onleesbare regel in cursusoverzicht: ${JSON.stringify(rij)}`);
    const lds = [rij['leerdoel 1'], rij['leerdoel 2']]
      .map((v) => /^(LD\d+)\b/.exec(v ?? '')?.[1])
      .filter((v): v is string => v !== undefined);
    for (const l of lds) if (!bekend.has(l)) throw new Error(`Cursus ${titel}: onbekend leerdoel ${l}`);

    const id = `p${periode}-${maakId(titel)}`;
    const bestaand = opId.get(id);
    if (bestaand) {
      verslag.samengevoegd.push(`${titel} (periode ${periode})`);
      for (const l of lds) if (!bestaand.leerdoelen.includes(l)) bestaand.leerdoelen.push(l);
    } else {
      opId.set(id, { id, titel, jaar, periode, leerdoelen: [...new Set(lds)] });
    }
  }

  let volgende = Math.max(EERSTE_NR - 1, ...bestaandeNummers.values()) + 1;
  const nummer = (opdrachtId: string) => bestaandeNummers.get(opdrachtId) ?? volgende++;

  const cursussen: Cursus[] = [...opId.values()].map((c) => {
    if (c.leerdoelen.length === 0) {
      verslag.zonderLeerdoelen.push(`${c.titel} (periode ${c.periode})`);
      return { ...c, opdrachten: [] };
    }
    const opdrachten = [
      { id: `${c.id}-oefenen`, titel: 'DEMO-oefenopdracht', niveau: 'G' as const },
      { id: `${c.id}-eindopdracht`, titel: 'DEMO-eindopdracht', niveau: 'B' as const },
    ].map((o) => ({ id: o.id, nr: nummer(o.id), titel: o.titel, leerdoelen: c.leerdoelen.map((leerdoel) => ({ leerdoel, niveau: o.niveau })) }));
    return { ...c, opdrachten };
  });

  return {
    curriculum: {
      versie: 2,
      demo: true,
      opleiding: { naam: 'Mediavormgever', crebo: '27110', dossier: '23439' },
      kerntaken: KERNTAKEN,
      leerdoelen,
      cursussen,
    },
    verslag,
  };
}
