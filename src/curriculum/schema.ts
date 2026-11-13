import { z } from 'zod';

/** O = oriënterend, G = geoefend, B = beoordeeld. */
export const NIVEAUS = ['O', 'G', 'B'] as const;
export type Niveau = (typeof NIVEAUS)[number];

const tekst = z.string().trim().min(1);

const werkprocesSchema = z.strictObject({
  id: z.string().regex(/^B\d+-K\d+-W\d+$/, 'Werkproces-id moet de vorm B1-K1-W1 hebben'),
  titel: tekst,
});

const kerntaakSchema = z.strictObject({
  id: z.string().regex(/^B\d+-K\d+$/, 'Kerntaak-id moet de vorm B1-K1 hebben'),
  titel: tekst,
  werkprocessen: z.array(werkprocesSchema).min(1),
});

const leerdoelSchema = z.strictObject({
  id: tekst,
  titel: tekst,
  werkprocessen: z.array(tekst).min(1),
});

const koppelingSchema = z.strictObject({
  leerdoel: tekst,
  niveau: z.enum(NIVEAUS),
});

const opdrachtSchema = z.strictObject({
  id: tekst,
  /** Vast nummer dat in de bewijscode staat (2 bytes). Nooit hergebruiken. */
  nr: z.number().int().min(1).max(65535),
  titel: tekst,
  leerdoelen: z.array(koppelingSchema).min(1),
});

const vakSchema = z.strictObject({
  id: tekst,
  titel: tekst,
  leerdoelen: z.array(leerdoelSchema).min(1),
  opdrachten: z.array(opdrachtSchema).min(1),
});

const curriculumSchema = z.strictObject({
  versie: z.number().int().min(1),
  /** De proef werkt alleen met demo-gegevens; de interface toont dit overal. */
  demo: z.literal(true),
  opleiding: z.strictObject({ naam: tekst, crebo: tekst, dossier: tekst }),
  kerntaken: z.array(kerntaakSchema).min(1),
  vakken: z.array(vakSchema).min(1),
});

export type Curriculum = z.infer<typeof curriculumSchema>;
export type Kerntaak = z.infer<typeof kerntaakSchema>;
export type Werkproces = z.infer<typeof werkprocesSchema>;
export type Vak = z.infer<typeof vakSchema>;
export type Leerdoel = z.infer<typeof leerdoelSchema>;
export type Opdracht = z.infer<typeof opdrachtSchema>;

export class CurriculumFout extends Error {
  constructor(readonly problemen: string[]) {
    super(`Curriculum is ongeldig:\n- ${problemen.join('\n- ')}`);
    this.name = 'CurriculumFout';
  }
}

function dubbelen(waarden: readonly (string | number)[]): (string | number)[] {
  const gezien = new Set<string | number>();
  const dubbel = new Set<string | number>();
  for (const w of waarden) (gezien.has(w) ? dubbel : gezien).add(w);
  return [...dubbel];
}

/**
 * Controleert ruwe (uit YAML gelezen) gegevens: eerst de vorm, daarna de
 * verwijzingen. Gooit een CurriculumFout met alle gevonden problemen.
 */
export function leesCurriculum(ruw: unknown): Curriculum {
  const resultaat = curriculumSchema.safeParse(ruw);
  if (!resultaat.success) {
    throw new CurriculumFout(
      resultaat.error.issues.map((i) => `${i.path.join('.') || '(hoofdniveau)'}: ${i.message}`),
    );
  }
  const c = resultaat.data;
  const problemen: string[] = [];

  const werkprocesIds = c.kerntaken.flatMap((k) => k.werkprocessen.map((w) => w.id));
  for (const d of dubbelen(c.kerntaken.map((k) => k.id))) problemen.push(`Kerntaak ${d} komt dubbel voor`);
  for (const d of dubbelen(werkprocesIds)) problemen.push(`Werkproces ${d} komt dubbel voor`);
  for (const k of c.kerntaken) {
    for (const w of k.werkprocessen) {
      if (!w.id.startsWith(`${k.id}-`)) problemen.push(`Werkproces ${w.id} hoort niet bij kerntaak ${k.id}`);
    }
  }

  const alleOpdrachten = c.vakken.flatMap((v) => v.opdrachten);
  for (const d of dubbelen(c.vakken.map((v) => v.id))) problemen.push(`Vak ${d} komt dubbel voor`);
  for (const d of dubbelen(c.vakken.flatMap((v) => v.leerdoelen.map((l) => l.id)))) {
    problemen.push(`Leerdoel ${d} komt dubbel voor`);
  }
  for (const d of dubbelen(alleOpdrachten.map((o) => o.id))) problemen.push(`Opdracht ${d} komt dubbel voor`);
  for (const d of dubbelen(alleOpdrachten.map((o) => o.nr))) problemen.push(`Opdrachtnummer ${d} komt dubbel voor`);

  const bekendeWerkprocessen = new Set(werkprocesIds);
  for (const vak of c.vakken) {
    const leerdoelIds = new Set(vak.leerdoelen.map((l) => l.id));
    for (const l of vak.leerdoelen) {
      for (const w of l.werkprocessen) {
        if (!bekendeWerkprocessen.has(w)) problemen.push(`Leerdoel ${l.id} verwijst naar onbekend werkproces ${w}`);
      }
      for (const d of dubbelen(l.werkprocessen)) problemen.push(`Leerdoel ${l.id} noemt werkproces ${d} dubbel`);
      // Zonder B-opdracht zou een leerdoel direct "behaald" zijn.
      const heeftB = vak.opdrachten.some((o) => o.leerdoelen.some((k) => k.leerdoel === l.id && k.niveau === 'B'));
      if (!heeftB) problemen.push(`Leerdoel ${l.id} heeft geen opdracht op niveau B (beoordeeld)`);
    }
    for (const o of vak.opdrachten) {
      for (const k of o.leerdoelen) {
        if (!leerdoelIds.has(k.leerdoel)) {
          problemen.push(`Opdracht ${o.id} verwijst naar leerdoel ${k.leerdoel} dat niet in vak ${vak.id} staat`);
        }
      }
      for (const d of dubbelen(o.leerdoelen.map((k) => k.leerdoel))) {
        problemen.push(`Opdracht ${o.id} noemt leerdoel ${d} dubbel`);
      }
    }
  }

  if (problemen.length > 0) throw new CurriculumFout(problemen);
  return c;
}

export function alleOpdrachten(c: Curriculum): Opdracht[] {
  return c.vakken.flatMap((v) => v.opdrachten);
}

export function alleWerkprocessen(c: Curriculum): Werkproces[] {
  return c.kerntaken.flatMap((k) => k.werkprocessen);
}
