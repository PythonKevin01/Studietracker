/**
 * Rapporten (exportbestanden van studenten) inlezen en controleren. Elke code
 * wordt opnieuw gecontroleerd tegen de publieke sleutels en het studentnummer
 * in het bestand. Zelf gemelde opdrachten zijn niet gecontroleerd en worden
 * apart geteld.
 */
import { alleOpdrachten, type Curriculum } from '../curriculum/schema';
import { controleerBewijscode, type PubliekeSleutel, type Weigerreden } from '../bewijscode/controleren';
import { schrijfCsv } from '../gedeeld/csv';
import { leerdoelTotaal } from '../rekenregels';
import { ExportFout, leesExport, nieuweGegevens, voortgangVan, type StudentGegevens } from '../student/gegevens';
import type { Student } from './klaslijst';

export interface IngelezenRapport {
  studentnummer: string;
  bestanden: string[];
  geldig: number;
  geweigerd: { reden: Weigerreden; melding: string }[];
  gegevens: StudentGegevens;
}

export interface Inleesresultaat {
  rapporten: IngelezenRapport[];
  onleesbaar: { bestand: string; melding: string }[];
}

/** Leest meerdere bestanden; bestanden van dezelfde student worden samengevoegd. */
export async function leesRapporten(
  bestanden: readonly { naam: string; tekst: string }[],
  ctx: { curriculum: Curriculum; publiekeSleutels: readonly PubliekeSleutel[] },
): Promise<Inleesresultaat> {
  const perStudent = new Map<string, IngelezenRapport>();
  const onleesbaar: Inleesresultaat['onleesbaar'] = [];
  const nrs = new Set(alleOpdrachten(ctx.curriculum).map((o) => o.nr));
  const bekend = new Set(alleOpdrachten(ctx.curriculum).map((o) => o.id));

  for (const b of bestanden) {
    let exp;
    try {
      exp = leesExport(b.tekst);
    } catch (e) {
      onleesbaar.push({ bestand: b.naam, melding: e instanceof ExportFout ? e.message : 'Onleesbaar bestand.' });
      continue;
    }
    const r = perStudent.get(exp.studentnummer) ?? {
      studentnummer: exp.studentnummer,
      bestanden: [],
      geldig: 0,
      geweigerd: [],
      gegevens: nieuweGegevens(exp.studentnummer),
    };
    r.bestanden.push(b.naam);
    for (const { opdrachtId, sinds } of exp.zelfGemeld) {
      if (bekend.has(opdrachtId) && !(opdrachtId in r.gegevens.zelfGemeld)) r.gegevens.zelfGemeld[opdrachtId] = sinds;
    }
    for (const c of exp.codes) {
      const controle = await controleerBewijscode(c.code, {
        studentnummer: exp.studentnummer,
        publiekeSleutels: ctx.publiekeSleutels,
        bekendeOpdrachtNrs: nrs,
        alIngevoerd: new Set(r.gegevens.codes.map((x) => x.code)),
      });
      if (controle.ok) {
        r.gegevens.codes.push({ code: controle.code, ontvangen: c.ontvangen });
        r.geldig += 1;
      } else if (controle.reden !== 'al_ingevoerd') {
        r.geweigerd.push({ reden: controle.reden, melding: controle.melding });
      }
    }
    perStudent.set(exp.studentnummer, r);
  }
  return { rapporten: [...perStudent.values()].sort((a, b) => a.studentnummer.localeCompare(b.studentnummer)), onleesbaar };
}

export interface OverzichtRij {
  studentnummer: string;
  naam: string;
  geldigeCodes: number;
  geweigerdeCodes: number;
  bevestigd: number;
  zelfGemeld: number;
  leerdoelenBehaald: number;
  versterkt: number;
  /** leerdoel-id -> behaald in hoeveel cursussen */
  perLeerdoel: Record<string, number>;
}

export function klasoverzicht(rapporten: readonly IngelezenRapport[], klaslijst: readonly Student[], c: Curriculum): OverzichtRij[] {
  const namen = new Map(klaslijst.map((s) => [s.studentnummer, s.naam]));
  return rapporten.map((r) => {
    const v = voortgangVan(c, r.gegevens);
    const perLeerdoel = Object.fromEntries(c.leerdoelen.map((l) => [l.id, leerdoelTotaal(c, l.id, v).behaaldIn]));
    const statussen = Object.values(v);
    return {
      studentnummer: r.studentnummer,
      naam: namen.get(r.studentnummer) ?? '',
      geldigeCodes: r.geldig,
      geweigerdeCodes: r.geweigerd.length,
      bevestigd: statussen.filter((s) => s === 'bevestigd').length,
      zelfGemeld: statussen.filter((s) => s === 'zelf_gemeld').length,
      leerdoelenBehaald: Object.values(perLeerdoel).filter((n) => n > 0).length,
      versterkt: Object.values(perLeerdoel).filter((n) => n > 1).length,
      perLeerdoel,
    };
  });
}

export function overzichtCsv(rijen: readonly OverzichtRij[], c: Curriculum): string {
  const ids = c.leerdoelen.map((l) => l.id);
  return schrijfCsv([
    ['studentnummer', 'naam', 'geldige codes', 'geweigerde codes', 'opdrachten bevestigd', 'opdrachten zelf gemeld (niet gecontroleerd)', 'leerdoelen behaald', 'leerdoelen versterkt', ...ids.map((id) => `${id} behaald in`)],
    ...rijen.map((r) => [
      r.studentnummer,
      r.naam,
      String(r.geldigeCodes),
      String(r.geweigerdeCodes),
      String(r.bevestigd),
      String(r.zelfGemeld),
      String(r.leerdoelenBehaald),
      String(r.versterkt),
      ...ids.map((id) => String(r.perLeerdoel[id] ?? 0)),
    ]),
  ]);
}
