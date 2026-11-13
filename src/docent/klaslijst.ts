/**
 * Klaslijst uit CSV: kolommen studentnummer en naam (kopregel verplicht;
 * komma of puntkomma). Blijft alleen in het geheugen van de browser.
 */
import { isGeldigStudentnummer, normaliseerStudentnummer } from '../bewijscode/formaat';
import { leesCsvObjecten, schrijfCsv } from '../gedeeld/csv';

export interface Student {
  studentnummer: string;
  naam: string;
}

export interface Klaslijst {
  studenten: Student[];
  fouten: string[];
}

const NUMMER_KOPPEN = ['studentnummer', 'nummer', 'student', 'studentnr'];
const NAAM_KOPPEN = ['naam', 'name', 'roepnaam', 'volledige naam'];

export function leesKlaslijst(tekst: string): Klaslijst {
  const rijen = leesCsvObjecten(tekst);
  if (rijen.length === 0) return { studenten: [], fouten: ['Het bestand is leeg of heeft geen kopregel.'] };
  const kolommen = Object.keys(rijen[0]!);
  const nummerKolom = kolommen.find((k) => NUMMER_KOPPEN.includes(k));
  const naamKolom = kolommen.find((k) => NAAM_KOPPEN.includes(k));
  if (!nummerKolom) return { studenten: [], fouten: ['Geen kolom "studentnummer" gevonden in de kopregel.'] };

  const studenten: Student[] = [];
  const fouten: string[] = [];
  const gezien = new Set<string>();
  rijen.forEach((r, i) => {
    const regel = i + 2;
    const nummer = normaliseerStudentnummer(r[nummerKolom] ?? '');
    if (!isGeldigStudentnummer(nummer)) {
      fouten.push(`Regel ${regel}: "${r[nummerKolom]}" is geen geldig studentnummer.`);
      return;
    }
    if (gezien.has(nummer)) {
      fouten.push(`Regel ${regel}: studentnummer ${nummer} staat er dubbel in.`);
      return;
    }
    gezien.add(nummer);
    studenten.push({ studentnummer: nummer, naam: (naamKolom ? r[naamKolom] : '') || nummer });
  });
  return { studenten, fouten };
}

/** Voorbeeldbestand met fictieve studenten. */
export function voorbeeldKlaslijst(): string {
  return schrijfCsv([
    ['studentnummer', 'naam'],
    ['D100001', 'Fenna Fictief'],
    ['D100002', 'Sem Verzonnen'],
    ['D100003', 'Noor Voorbeeld'],
    ['D100004', 'Daan Denkbeeldig'],
  ]);
}
