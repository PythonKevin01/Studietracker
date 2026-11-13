/**
 * Codes maken voor één cursus: per student één bundelcode met alle
 * beoordeelde opdrachten van die cursus. Alleen voor de docentpagina.
 */
import type { Curriculum } from '../curriculum/schema';
import type { Resultaat } from '../bewijscode/formaat';
import { maakLink } from '../bewijscode/formaat';
import { maakBewijscode } from '../bewijscode/ondertekenen';
import { schrijfCsv } from '../gedeeld/csv';
import type { Student } from './klaslijst';

/** studentnummer -> opdracht-id -> resultaat. Ontbreekt = niet beoordeeld. */
export type Beoordelingen = Record<string, Record<string, Resultaat>>;

export interface StudentCode {
  student: Student;
  code: string;
  link: string;
  regels: { opdrachtId: string; titel: string; resultaat: Resultaat }[];
}

export async function maakCodes(opties: {
  curriculum: Curriculum;
  cursusId: string;
  studenten: readonly Student[];
  beoordelingen: Beoordelingen;
  datum: string;
  sleutel: { sleutelnummer: number; priveSleutel: Uint8Array };
  basisUrl: string;
}): Promise<StudentCode[]> {
  const cursus = opties.curriculum.cursussen.find((c) => c.id === opties.cursusId);
  if (!cursus) throw new Error(`Onbekende cursus: ${opties.cursusId}`);
  const uit: StudentCode[] = [];
  for (const student of opties.studenten) {
    const b = opties.beoordelingen[student.studentnummer] ?? {};
    const regels = cursus.opdrachten
      .filter((o) => b[o.id] !== undefined)
      .map((o) => ({ opdrachtId: o.id, titel: o.titel, nr: o.nr, resultaat: b[o.id]! }));
    if (regels.length === 0) continue;
    const code = await maakBewijscode(
      {
        sleutelnummer: opties.sleutel.sleutelnummer,
        datum: opties.datum,
        studentnummer: student.studentnummer,
        regels: regels.map((r) => ({ opdrachtNr: r.nr, resultaat: r.resultaat })),
      },
      opties.sleutel.priveSleutel,
    );
    uit.push({ student, code, link: maakLink(opties.basisUrl, code), regels: regels.map(({ nr: _nr, ...r }) => r) });
  }
  return uit;
}

export function codesCsv(codes: readonly StudentCode[], cursusTitel: string): string {
  return schrijfCsv([
    ['studentnummer', 'naam', 'cursus', 'opdrachten', 'link'],
    ...codes.map((c) => [
      c.student.studentnummer,
      c.student.naam,
      cursusTitel,
      c.regels.map((r) => `${r.titel}: ${r.resultaat === 'voldaan' ? 'voldaan' : 'nog niet voldaan'}`).join('; '),
      c.link,
    ]),
  ]);
}
