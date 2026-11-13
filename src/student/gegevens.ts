/**
 * Gegevens van één student, zoals ze op het eigen apparaat staan, plus het
 * exportbestand (rapport en back-up). Pure functies: opslag zit in opslag.ts.
 */
import { z } from 'zod';
import { alleOpdrachten, type Curriculum } from '../curriculum/schema';
import { controleerBewijscode, type Controle, type PubliekeSleutel, type Weigerreden } from '../bewijscode/controleren';
import { normaliseerStudentnummer, ontleedCode, vanTekst, type Resultaat } from '../bewijscode/formaat';
import { opdrachtStatus, type Voortgang } from '../rekenregels';

export interface OntvangenCode {
  code: string;
  /** Moment van invoeren, ISO 8601. */
  ontvangen: string;
}

export interface StudentGegevens {
  versie: 1;
  studentnummer: string;
  /** Opdracht-id -> moment van zelf melden. */
  zelfGemeld: Record<string, string>;
  codes: OntvangenCode[];
  /** Moment van de laatste export, of null. */
  laatsteExport: string | null;
  /** Periode die de student in het overzicht heeft gekozen. Zonder keuze rekent de app hem uit. */
  periode?: number;
}

export function nieuweGegevens(studentnummer: string): StudentGegevens {
  return { versie: 1, studentnummer: normaliseerStudentnummer(studentnummer), zelfGemeld: {}, codes: [], laatsteExport: null };
}

export interface Oordeel {
  opdrachtId: string;
  resultaat: Resultaat;
  /** Datum uit de code, JJJJ-MM-DD. */
  datum: string;
  sleutelnummer: number;
}

/**
 * Het geldende oordeel per opdracht: dat met de laatste datum. Bij gelijke
 * datum telt de code die het laatst is ingevoerd. Zo kan een docent een
 * eerder oordeel met een nieuwere code herzien.
 */
export function oordelen(c: Curriculum, g: StudentGegevens): Map<string, Oordeel> {
  const idOpNr = new Map(alleOpdrachten(c).map((o) => [o.nr, o.id]));
  const uit = new Map<string, Oordeel>();
  const opVolgorde = [...g.codes].sort((a, b) => a.ontvangen.localeCompare(b.ontvangen));
  for (const { code } of opVolgorde) {
    const { inhoud } = ontleedCode(vanTekst(code));
    for (const regel of inhoud.regels) {
      const opdrachtId = idOpNr.get(regel.opdrachtNr);
      if (!opdrachtId) continue;
      const vorige = uit.get(opdrachtId);
      if (!vorige || inhoud.datum >= vorige.datum) {
        uit.set(opdrachtId, { opdrachtId, resultaat: regel.resultaat, datum: inhoud.datum, sleutelnummer: inhoud.sleutelnummer });
      }
    }
  }
  return uit;
}

export function voortgangVan(c: Curriculum, g: StudentGegevens): Voortgang {
  const oordeel = oordelen(c, g);
  return Object.fromEntries(
    alleOpdrachten(c).map((o) => [
      o.id,
      opdrachtStatus({ zelfGemeld: o.id in g.zelfGemeld, bevestigd: oordeel.get(o.id)?.resultaat === 'voldaan' }),
    ]),
  );
}

export function zetZelfGemeld(g: StudentGegevens, opdrachtId: string, gedaan: boolean, nu: Date): StudentGegevens {
  const zelfGemeld = { ...g.zelfGemeld };
  if (gedaan) zelfGemeld[opdrachtId] ??= nu.toISOString();
  else delete zelfGemeld[opdrachtId];
  return { ...g, zelfGemeld };
}

export interface CodeContext {
  curriculum: Curriculum;
  publiekeSleutels: readonly PubliekeSleutel[];
}

function controleContext(ctx: CodeContext, studentnummer: string, codes: readonly OntvangenCode[]) {
  return {
    studentnummer,
    publiekeSleutels: ctx.publiekeSleutels,
    bekendeOpdrachtNrs: new Set(alleOpdrachten(ctx.curriculum).map((o) => o.nr)),
    alIngevoerd: new Set(codes.map((c) => c.code)),
  };
}

/** Controleert een gescande, geopende of geplakte code en voegt hem toe als hij geldig is. */
export async function ontvangCode(
  g: StudentGegevens,
  invoer: string,
  ctx: CodeContext,
  nu: Date,
): Promise<{ controle: Controle; gegevens: StudentGegevens }> {
  const controle = await controleerBewijscode(invoer, controleContext(ctx, g.studentnummer, g.codes));
  if (!controle.ok) return { controle, gegevens: g };
  return { controle, gegevens: { ...g, codes: [...g.codes, { code: controle.code, ontvangen: nu.toISOString() }] } };
}

// --- Exportbestand ------------------------------------------------------

const exportSchema = z.strictObject({
  soort: z.literal('studietracker-rapport'),
  versie: z.literal(1),
  demo: z.literal(true),
  studentnummer: z.string(),
  gemaakt: z.string(),
  zelfGemeld: z.array(z.strictObject({ opdrachtId: z.string(), sinds: z.string() })),
  codes: z.array(z.strictObject({ code: z.string(), ontvangen: z.string() })),
});

export type ExportBestand = z.infer<typeof exportSchema>;

export class ExportFout extends Error {}

export function maakExport(g: StudentGegevens, nu: Date): ExportBestand {
  return {
    soort: 'studietracker-rapport',
    versie: 1,
    demo: true,
    studentnummer: g.studentnummer,
    gemaakt: nu.toISOString(),
    zelfGemeld: Object.entries(g.zelfGemeld).map(([opdrachtId, sinds]) => ({ opdrachtId, sinds })),
    codes: g.codes,
  };
}

export function exportBestandsnaam(g: StudentGegevens, nu: Date): string {
  return `studietracker-${g.studentnummer}-${nu.toISOString().slice(0, 10)}.json`;
}

export function leesExport(tekst: string): ExportBestand {
  let ruw: unknown;
  try {
    ruw = JSON.parse(tekst);
  } catch {
    throw new ExportFout('Dit bestand is geen exportbestand van de studietracker.');
  }
  const r = exportSchema.safeParse(ruw);
  if (!r.success) throw new ExportFout('Dit bestand is geen exportbestand van de studietracker, of het is beschadigd.');
  return { ...r.data, studentnummer: normaliseerStudentnummer(r.data.studentnummer) };
}

export interface Weigering {
  code: string;
  reden: Weigerreden;
  melding: string;
}

export interface TerugzetUitkomst {
  gegevens: StudentGegevens;
  nieuweCodes: number;
  alAanwezig: number;
  geweigerd: Weigering[];
}

/**
 * Zet een back-up terug. Voegt samen met wat er al staat, zodat er nooit iets
 * verloren gaat. Elke code wordt opnieuw gecontroleerd: een aangepast
 * exportbestand levert geen bevestigingen op.
 */
export async function zetTerug(huidig: StudentGegevens | null, bestand: ExportBestand, ctx: CodeContext): Promise<TerugzetUitkomst> {
  if (huidig && huidig.studentnummer !== bestand.studentnummer) {
    throw new ExportFout(
      `Dit bestand is van studentnummer ${bestand.studentnummer}. Deze app hoort bij ${huidig.studentnummer}. Je kunt alleen je eigen back-up terugzetten.`,
    );
  }
  let g = huidig ?? nieuweGegevens(bestand.studentnummer);
  const bekend = new Set(alleOpdrachten(ctx.curriculum).map((o) => o.id));
  const zelfGemeld = { ...g.zelfGemeld };
  for (const { opdrachtId, sinds } of bestand.zelfGemeld) {
    if (bekend.has(opdrachtId) && !(opdrachtId in zelfGemeld)) zelfGemeld[opdrachtId] = sinds;
  }
  g = { ...g, zelfGemeld };

  let nieuweCodes = 0;
  let alAanwezig = 0;
  const geweigerd: Weigering[] = [];
  for (const ontvangen of bestand.codes) {
    const controle = await controleerBewijscode(ontvangen.code, controleContext(ctx, g.studentnummer, g.codes));
    if (controle.ok) {
      g = { ...g, codes: [...g.codes, { code: controle.code, ontvangen: ontvangen.ontvangen }] };
      nieuweCodes += 1;
    } else if (controle.reden === 'al_ingevoerd') {
      alAanwezig += 1;
    } else {
      geweigerd.push({ code: ontvangen.code, reden: controle.reden, melding: controle.melding });
    }
  }
  return { gegevens: g, nieuweCodes, alAanwezig, geweigerd };
}

/** True als er codes zijn binnengekomen na de laatste export. */
export function backupNodig(g: StudentGegevens): boolean {
  if (g.codes.length === 0) return false;
  if (!g.laatsteExport) return true;
  return g.codes.some((c) => c.ontvangen > g.laatsteExport!);
}
