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

/**
 * Leerdoel uit de lijst van de opleiding. Hangt aan één of meer kerntaken
 * (zoals in het kwalificatiedossier). Een paar leerdoelen zijn een werkproces
 * zelf; alleen die hebben `werkproces`.
 */
const leerdoelSchema = z.strictObject({
  id: z.string().regex(/^LD\d+$/, 'Leerdoel-id moet de vorm LD01 hebben'),
  titel: tekst,
  kerntaken: z.array(tekst).min(1),
  werkproces: tekst.optional(),
});

const koppelingSchema = z.strictObject({
  leerdoel: tekst,
  niveau: z.enum(NIVEAUS),
});

const opdrachtSchema = z.strictObject({
  id: tekst,
  /** Vast nummer dat in de bewijscode staat (2 bytes). Nooit wijzigen of hergebruiken. */
  nr: z.number().int().min(1).max(65535),
  titel: tekst,
  leerdoelen: z.array(koppelingSchema).min(1),
});

const cursusSchema = z.strictObject({
  id: tekst,
  titel: tekst,
  jaar: z.number().int().min(1),
  periode: z.number().int().min(1),
  /** Leerdoelen die in deze cursus worden aangeboden. Mag leeg zijn. */
  leerdoelen: z.array(tekst),
  opdrachten: z.array(opdrachtSchema),
});

const curriculumSchema = z.strictObject({
  versie: z.number().int().min(1),
  /** De proef werkt met demo-opdrachten; de interface toont dit overal. */
  demo: z.literal(true),
  opleiding: z.strictObject({ naam: tekst, crebo: tekst, dossier: tekst }),
  kerntaken: z.array(kerntaakSchema).min(1),
  leerdoelen: z.array(leerdoelSchema).min(1),
  cursussen: z.array(cursusSchema).min(1),
});

export type Curriculum = z.infer<typeof curriculumSchema>;
export type Kerntaak = z.infer<typeof kerntaakSchema>;
export type Werkproces = z.infer<typeof werkprocesSchema>;
export type Leerdoel = z.infer<typeof leerdoelSchema>;
export type Cursus = z.infer<typeof cursusSchema>;
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
    throw new CurriculumFout(resultaat.error.issues.map((i) => `${i.path.join('.') || '(hoofdniveau)'}: ${i.message}`));
  }
  const c = resultaat.data;
  const problemen: string[] = [];

  const kerntaakIds = new Set(c.kerntaken.map((k) => k.id));
  const werkprocesNaarKerntaak = new Map(c.kerntaken.flatMap((k) => k.werkprocessen.map((w) => [w.id, k.id] as const)));
  for (const d of dubbelen(c.kerntaken.map((k) => k.id))) problemen.push(`Kerntaak ${d} komt dubbel voor`);
  for (const d of dubbelen(c.kerntaken.flatMap((k) => k.werkprocessen.map((w) => w.id)))) problemen.push(`Werkproces ${d} komt dubbel voor`);
  for (const k of c.kerntaken) {
    for (const w of k.werkprocessen) {
      if (!w.id.startsWith(`${k.id}-`)) problemen.push(`Werkproces ${w.id} hoort niet bij kerntaak ${k.id}`);
    }
  }

  for (const d of dubbelen(c.leerdoelen.map((l) => l.id))) problemen.push(`Leerdoel ${d} komt dubbel voor`);
  for (const l of c.leerdoelen) {
    for (const k of l.kerntaken) if (!kerntaakIds.has(k)) problemen.push(`Leerdoel ${l.id} verwijst naar onbekende kerntaak ${k}`);
    if (l.werkproces !== undefined) {
      const kt = werkprocesNaarKerntaak.get(l.werkproces);
      if (!kt) problemen.push(`Leerdoel ${l.id} verwijst naar onbekend werkproces ${l.werkproces}`);
      else if (!l.kerntaken.includes(kt)) problemen.push(`Leerdoel ${l.id}: werkproces ${l.werkproces} hoort niet bij zijn kerntaak`);
    }
  }

  const leerdoelIds = new Set(c.leerdoelen.map((l) => l.id));
  const alleOpdrachten = c.cursussen.flatMap((v) => v.opdrachten);
  for (const d of dubbelen(c.cursussen.map((v) => v.id))) problemen.push(`Cursus ${d} komt dubbel voor`);
  for (const d of dubbelen(alleOpdrachten.map((o) => o.id))) problemen.push(`Opdracht ${d} komt dubbel voor`);
  for (const d of dubbelen(alleOpdrachten.map((o) => o.nr))) problemen.push(`Opdrachtnummer ${d} komt dubbel voor`);

  for (const cursus of c.cursussen) {
    for (const d of dubbelen(cursus.leerdoelen)) problemen.push(`Cursus ${cursus.id} noemt leerdoel ${d} dubbel`);
    const aangeboden = new Set(cursus.leerdoelen);
    for (const l of cursus.leerdoelen) {
      if (!leerdoelIds.has(l)) problemen.push(`Cursus ${cursus.id} verwijst naar onbekend leerdoel ${l}`);
      // Zonder B-opdracht zou een leerdoel in deze cursus direct "behaald" zijn.
      const heeftB = cursus.opdrachten.some((o) => o.leerdoelen.some((k) => k.leerdoel === l && k.niveau === 'B'));
      if (!heeftB) problemen.push(`Cursus ${cursus.id}: leerdoel ${l} heeft geen opdracht op niveau B (beoordeeld)`);
    }
    for (const o of cursus.opdrachten) {
      for (const k of o.leerdoelen) {
        if (!aangeboden.has(k.leerdoel)) problemen.push(`Opdracht ${o.id} verwijst naar leerdoel ${k.leerdoel} dat cursus ${cursus.id} niet aanbiedt`);
      }
      for (const d of dubbelen(o.leerdoelen.map((k) => k.leerdoel))) problemen.push(`Opdracht ${o.id} noemt leerdoel ${d} dubbel`);
    }
  }

  if (problemen.length > 0) throw new CurriculumFout(problemen);
  return c;
}

export function alleOpdrachten(c: Curriculum): Opdracht[] {
  return c.cursussen.flatMap((v) => v.opdrachten);
}

export function alleWerkprocessen(c: Curriculum): Werkproces[] {
  return c.kerntaken.flatMap((k) => k.werkprocessen);
}
