/**
 * Rekenregels: pure functies zonder opslag of schermcode. Elke functie geeft
 * naast de uitkomst ook `waarom` terug: gewone zinnen die de uitkomst
 * onderbouwen en die de app achter "Waarom?" toont.
 *
 * Keten: opdracht -> leerdoel (binnen een cursus) -> kerntaak. Een werkproces
 * krijgt alleen voortgang via het leerdoel dat dat werkproces zelf is (LD24 =
 * B1-K1-W1 enz.); andere koppelingen tussen leerdoel en werkproces bestaan niet.
 *
 * Bewust is er geen eindstatus voor werkprocessen of kerntaken: dit is een
 * ontwikkeloverzicht, geen examinering.
 */
import { NIVEAUS, type Curriculum, type Cursus, type Leerdoel, type Niveau } from '../curriculum/schema';

export type OpdrachtStatus = 'open' | 'zelf_gemeld' | 'bevestigd';
export type LeerdoelStatus = 'nog_niet_gestart' | 'bezig' | 'behaald';

/** Status per opdracht-id. Een opdracht die ontbreekt is "open". */
export type Voortgang = Readonly<Record<string, OpdrachtStatus>>;

export const OPDRACHT_LABEL: Record<OpdrachtStatus, string> = {
  open: 'Open',
  zelf_gemeld: 'Zelf gemeld',
  bevestigd: 'Bevestigd',
};

export const LEERDOEL_LABEL: Record<LeerdoelStatus, string> = {
  nog_niet_gestart: 'Nog niet gestart',
  bezig: 'Bezig',
  behaald: 'Behaald',
};

export const NIVEAU_LABEL: Record<Niveau, string> = {
  O: 'oriënterend',
  G: 'geoefend',
  B: 'beoordeeld',
};

const NIVEAU_RANG: Record<Niveau, number> = { O: 0, G: 1, B: 2 };

/**
 * Een opdracht is "bevestigd" zodra er een geldige bewijscode met resultaat
 * "voldaan" is ingevoerd, ongeacht of de student hem zelf had afgevinkt.
 */
export function opdrachtStatus(feiten: { zelfGemeld: boolean; bevestigd: boolean }): OpdrachtStatus {
  if (feiten.bevestigd) return 'bevestigd';
  return feiten.zelfGemeld ? 'zelf_gemeld' : 'open';
}

function statusVan(voortgang: Voortgang, opdrachtId: string): OpdrachtStatus {
  return voortgang[opdrachtId] ?? 'open';
}

function vind<T extends { id: string }>(lijst: readonly T[], id: string, soort: string): T {
  const x = lijst.find((i) => i.id === id);
  if (!x) throw new Error(`Onbekend(e) ${soort}: ${id}`);
  return x;
}

export const cursusNaam = (c: Pick<Cursus, 'titel' | 'periode'>) => `${c.titel} (periode ${c.periode})`;

export interface OpdrachtRegel {
  opdrachtId: string;
  titel: string;
  niveau: Niveau;
  status: OpdrachtStatus;
}

function regelTekst(r: OpdrachtRegel): string {
  return `${r.titel} (${r.niveau}, ${NIVEAU_LABEL[r.niveau]}): ${OPDRACHT_LABEL[r.status].toLowerCase()}`;
}

// --- Leerdoel binnen één cursus ------------------------------------------

export interface LeerdoelInCursus {
  cursusId: string;
  leerdoelId: string;
  titel: string;
  status: LeerdoelStatus;
  label: string;
  opdrachten: OpdrachtRegel[];
  waarom: string[];
}

/**
 * Leerdoel in een cursus:
 * - "behaald" als alle B-opdrachten van die cursus voor dit leerdoel bevestigd zijn;
 * - anders "bezig" bij minstens één zelf gemelde of bevestigde opdracht;
 * - anders "nog niet gestart".
 */
export function leerdoelInCursus(c: Curriculum, cursusId: string, leerdoelId: string, voortgang: Voortgang): LeerdoelInCursus {
  const cursus = vind(c.cursussen, cursusId, 'cursus');
  const leerdoel = vind(c.leerdoelen, leerdoelId, 'leerdoel');
  const opdrachten: OpdrachtRegel[] = cursus.opdrachten.flatMap((o) =>
    o.leerdoelen
      .filter((k) => k.leerdoel === leerdoelId)
      .map((k) => ({ opdrachtId: o.id, titel: o.titel, niveau: k.niveau, status: statusVan(voortgang, o.id) })),
  );

  const beoordeeld = opdrachten.filter((o) => o.niveau === 'B');
  const bevestigdB = beoordeeld.filter((o) => o.status === 'bevestigd');
  const gestart = opdrachten.filter((o) => o.status !== 'open');

  let status: LeerdoelStatus;
  const waarom: string[] = [];
  // Het schema eist minstens één B-opdracht; de lengtecontrole voorkomt dat
  // een leerdoel zonder B-opdrachten ooit vanzelf "behaald" wordt.
  if (beoordeeld.length > 0 && bevestigdB.length === beoordeeld.length) {
    status = 'behaald';
    waarom.push(`Behaald in deze cursus: alle ${beoordeeld.length} opdracht(en) op niveau B (beoordeeld) zijn door een docent bevestigd.`);
  } else if (gestart.length > 0) {
    status = 'bezig';
    waarom.push(
      `Bezig: ${gestart.length} van de ${opdrachten.length} opdracht(en) is zelf gemeld of bevestigd.`,
      `Nog niet behaald: ${bevestigdB.length} van de ${beoordeeld.length} opdracht(en) op niveau B (beoordeeld) is bevestigd. Voor "behaald" moeten ze allemaal bevestigd zijn.`,
    );
  } else {
    status = 'nog_niet_gestart';
    waarom.push('Nog niet gestart: geen enkele opdracht voor dit leerdoel in deze cursus is zelf gemeld of bevestigd.');
  }
  for (const o of opdrachten) waarom.push(regelTekst(o));

  return { cursusId, leerdoelId, titel: leerdoel.titel, status, label: LEERDOEL_LABEL[status], opdrachten, waarom };
}

// --- Leerdoel over de hele opleiding --------------------------------------

export interface LeerdoelTotaal {
  leerdoelId: string;
  titel: string;
  leerdoel: Leerdoel;
  status: LeerdoelStatus;
  /** Aantal cursussen waarin het leerdoel is behaald. Vanaf 2 is het "versterkt". */
  behaaldIn: number;
  perCursus: (LeerdoelInCursus & { cursusNaam: string })[];
  waarom: string[];
}

/**
 * Hetzelfde leerdoel kan in meerdere cursussen terugkomen. Het is behaald
 * zodra het in één cursus behaald is; elke volgende cursus waarin het
 * behaald wordt, versterkt het.
 */
export function leerdoelTotaal(c: Curriculum, leerdoelId: string, voortgang: Voortgang): LeerdoelTotaal {
  const leerdoel = vind(c.leerdoelen, leerdoelId, 'leerdoel');
  const perCursus = c.cursussen
    .filter((cu) => cu.leerdoelen.includes(leerdoelId))
    .map((cu) => ({ ...leerdoelInCursus(c, cu.id, leerdoelId, voortgang), cursusNaam: cursusNaam(cu) }));
  const behaald = perCursus.filter((p) => p.status === 'behaald');
  const bezig = perCursus.filter((p) => p.status === 'bezig');
  const status: LeerdoelStatus = behaald.length > 0 ? 'behaald' : bezig.length > 0 ? 'bezig' : 'nog_niet_gestart';

  const waarom: string[] = [`Aangeboden in ${perCursus.length} cursus(sen).`];
  if (status === 'behaald') {
    waarom.push(
      behaald.length > 1
        ? `Behaald en ${behaald.length - 1} keer versterkt: behaald in ${behaald.length} cursussen.`
        : 'Behaald in 1 cursus. Elke volgende cursus waarin je het behaalt, versterkt het.',
    );
  } else if (status === 'bezig') {
    waarom.push('Bezig: in minstens één cursus is een opdracht voor dit leerdoel zelf gemeld of bevestigd, maar het is nog nergens behaald.');
  } else {
    waarom.push('Nog niet gestart: in geen enkele cursus is een opdracht voor dit leerdoel zelf gemeld of bevestigd.');
  }
  for (const p of perCursus) waarom.push(`${p.cursusNaam}: ${p.label.toLowerCase()}`);

  return { leerdoelId, titel: leerdoel.titel, leerdoel, status, behaaldIn: behaald.length, perCursus, waarom };
}

// --- Tellers per niveau ---------------------------------------------------

export interface Teller {
  totaal: number;
  zelfGemeld: number;
  bevestigd: number;
}

export type Tellers = Record<Niveau, Teller>;

function legeTellers(): Tellers {
  return {
    O: { totaal: 0, zelfGemeld: 0, bevestigd: 0 },
    G: { totaal: 0, zelfGemeld: 0, bevestigd: 0 },
    B: { totaal: 0, zelfGemeld: 0, bevestigd: 0 },
  };
}

export interface Bijdrage extends OpdrachtRegel {
  cursusNaam: string;
  viaLeerdoelen: string[];
}

/**
 * Opdrachten die aan minstens één van de gegeven leerdoelen hangen. Elke
 * opdracht telt één keer, op het hoogste niveau waarop hij aan zo'n leerdoel hangt.
 */
function bijdragenVoor(c: Curriculum, leerdoelIds: ReadonlySet<string>, voortgang: Voortgang): Bijdrage[] {
  const uit: Bijdrage[] = [];
  for (const cu of c.cursussen) {
    for (const o of cu.opdrachten) {
      const koppelingen = o.leerdoelen.filter((k) => leerdoelIds.has(k.leerdoel));
      if (koppelingen.length === 0) continue;
      const niveau = koppelingen.reduce<Niveau>((h, k) => (NIVEAU_RANG[k.niveau] > NIVEAU_RANG[h] ? k.niveau : h), 'O');
      uit.push({
        opdrachtId: o.id,
        titel: o.titel,
        niveau,
        status: statusVan(voortgang, o.id),
        cursusNaam: cursusNaam(cu),
        viaLeerdoelen: koppelingen.map((k) => k.leerdoel),
      });
    }
  }
  return uit;
}

function tel(bijdragen: readonly Bijdrage[]): Tellers {
  const t = legeTellers();
  for (const b of bijdragen) {
    t[b.niveau].totaal += 1;
    if (b.status === 'zelf_gemeld') t[b.niveau].zelfGemeld += 1;
    if (b.status === 'bevestigd') t[b.niveau].bevestigd += 1;
  }
  return t;
}

function tellerZinnen(tellers: Tellers): string[] {
  return NIVEAUS.map((n) => {
    const t = tellers[n];
    return `Niveau ${n} (${NIVEAU_LABEL[n]}): ${t.totaal} opdracht(en), waarvan ${t.zelfGemeld} zelf gemeld en ${t.bevestigd} bevestigd.`;
  });
}

// --- Werkproces en kerntaak -----------------------------------------------

export interface WerkprocesUitkomst {
  werkprocesId: string;
  titel: string;
  /** Het leerdoel dat dit werkproces zelf is (bijv. LD24 voor B1-K1-W1), als dat er is. */
  leerdoel: LeerdoelTotaal | null;
  tellers: Tellers;
  waarom: string[];
}

/** Werkproces: tellers per niveau, met zelf gemeld en bevestigd apart, via het eigen leerdoel. */
export function werkprocesUitkomst(c: Curriculum, werkprocesId: string, voortgang: Voortgang): WerkprocesUitkomst {
  const werkproces = vind(c.kerntaken.flatMap((k) => k.werkprocessen), werkprocesId, 'werkproces');
  const eigen = c.leerdoelen.filter((l) => l.werkproces === werkprocesId);
  const bijdragen = bijdragenVoor(c, new Set(eigen.map((l) => l.id)), voortgang);
  const tellers = tel(bijdragen);
  const leerdoel = eigen[0] ? leerdoelTotaal(c, eigen[0].id, voortgang) : null;

  const waarom = eigen.length
    ? [
        `Voortgang komt van leerdoel ${eigen.map((l) => l.id).join(' en ')}: dat leerdoel is dit werkproces. Andere leerdoelen zijn niet vast aan een werkproces gekoppeld.`,
        ...tellerZinnen(tellers),
        ...bijdragen.map((b) => `${b.cursusNaam}, ${regelTekst(b)}`),
      ]
    : ['Er is geen leerdoel dat bij dit werkproces hoort. Daarom is hier geen voortgang te zien.'];

  return { werkprocesId, titel: werkproces.titel, leerdoel, tellers, waarom };
}

export interface KerntaakUitkomst {
  kerntaakId: string;
  titel: string;
  tellers: Tellers;
  werkprocessen: WerkprocesUitkomst[];
  /** Vakkennis en vaardigheden: leerdoelen van deze kerntaak die geen werkproces zijn. */
  leerdoelen: LeerdoelTotaal[];
  aantal: Record<LeerdoelStatus, number> & { versterkt: number };
  waarom: string[];
}

/** Kerntaak: tellers over alle leerdoelen van de kerntaak samen (elke opdracht één keer). */
export function kerntaakUitkomst(c: Curriculum, kerntaakId: string, voortgang: Voortgang): KerntaakUitkomst {
  const kerntaak = vind(c.kerntaken, kerntaakId, 'kerntaak');
  const eigen = c.leerdoelen.filter((l) => l.kerntaken.includes(kerntaakId));
  const tellers = tel(bijdragenVoor(c, new Set(eigen.map((l) => l.id)), voortgang));
  const leerdoelen = eigen.filter((l) => l.werkproces === undefined).map((l) => leerdoelTotaal(c, l.id, voortgang));
  const alle = eigen.map((l) => leerdoelTotaal(c, l.id, voortgang));
  const aantal = { nog_niet_gestart: 0, bezig: 0, behaald: 0, versterkt: 0 };
  for (const l of alle) {
    aantal[l.status] += 1;
    if (l.behaaldIn > 1) aantal.versterkt += 1;
  }
  return {
    kerntaakId,
    titel: kerntaak.titel,
    tellers,
    werkprocessen: kerntaak.werkprocessen.map((w) => werkprocesUitkomst(c, w.id, voortgang)),
    leerdoelen,
    aantal,
    waarom: [
      `Deze kerntaak heeft ${eigen.length} leerdoelen (in het kwalificatiedossier: vakkennis, vaardigheden en de werkprocessen zelf).`,
      `Leerdoelen: ${aantal.behaald} behaald (waarvan ${aantal.versterkt} versterkt), ${aantal.bezig} bezig, ${aantal.nog_niet_gestart} nog niet gestart.`,
      'Een opdracht die aan meer leerdoelen van deze kerntaak hangt, telt hier één keer.',
      ...tellerZinnen(tellers),
    ],
  };
}

// --- Cursus en opleiding --------------------------------------------------

export type CursusStatus = LeerdoelStatus | 'geen_leerdoelen';

export const CURSUS_LABEL: Record<CursusStatus, string> = {
  nog_niet_gestart: 'Nog niet gestart',
  bezig: 'Bezig',
  behaald: 'Leerdoelen behaald',
  geen_leerdoelen: 'Geen leerdoelen',
};

export interface CursusUitkomst {
  cursus: Cursus;
  status: CursusStatus;
  leerdoelen: LeerdoelInCursus[];
  aantalLeerdoelen: Record<LeerdoelStatus, number>;
  aantalOpdrachten: Record<OpdrachtStatus, number>;
  waarom: string[];
}

/** Cursus: telt leerdoelen en opdrachten op. "Leerdoelen behaald" als alle leerdoelen van de cursus behaald zijn. */
export function cursusUitkomst(c: Curriculum, cursusId: string, voortgang: Voortgang): CursusUitkomst {
  const cursus = vind(c.cursussen, cursusId, 'cursus');
  const leerdoelen = cursus.leerdoelen.map((l) => leerdoelInCursus(c, cursusId, l, voortgang));
  const aantalLeerdoelen: Record<LeerdoelStatus, number> = { nog_niet_gestart: 0, bezig: 0, behaald: 0 };
  for (const l of leerdoelen) aantalLeerdoelen[l.status] += 1;
  const aantalOpdrachten: Record<OpdrachtStatus, number> = { open: 0, zelf_gemeld: 0, bevestigd: 0 };
  for (const o of cursus.opdrachten) aantalOpdrachten[statusVan(voortgang, o.id)] += 1;

  let status: CursusStatus;
  if (leerdoelen.length === 0) status = 'geen_leerdoelen';
  else if (aantalLeerdoelen.behaald === leerdoelen.length) status = 'behaald';
  else if (aantalOpdrachten.bevestigd + aantalOpdrachten.zelf_gemeld > 0) status = 'bezig';
  else status = 'nog_niet_gestart';

  const waarom =
    status === 'geen_leerdoelen'
      ? ['Voor deze cursus staan in het cursusoverzicht geen leerdoelen. Er is hier dus geen voortgang bij te houden.']
      : [
          `Leerdoelen in deze cursus: ${aantalLeerdoelen.behaald} behaald, ${aantalLeerdoelen.bezig} bezig, ${aantalLeerdoelen.nog_niet_gestart} nog niet gestart (van ${leerdoelen.length}).`,
          `Opdrachten: ${aantalOpdrachten.bevestigd} bevestigd, ${aantalOpdrachten.zelf_gemeld} zelf gemeld, ${aantalOpdrachten.open} open (van ${cursus.opdrachten.length}).`,
        ];
  return { cursus, status, leerdoelen, aantalLeerdoelen, aantalOpdrachten, waarom };
}

export interface OpleidingUitkomst {
  jaren: { jaar: number; perioden: { periode: number; cursussen: CursusUitkomst[] }[] }[];
  leerdoelen: Record<LeerdoelStatus, number> & { totaal: number; versterkt: number };
  opdrachten: Record<OpdrachtStatus, number>;
  waarom: string[];
}

/** Totaaloverzicht: alle cursussen per jaar en periode, en alle leerdoelen samen. */
export function opleidingUitkomst(c: Curriculum, voortgang: Voortgang): OpleidingUitkomst {
  const uitkomsten = c.cursussen.map((cu) => cursusUitkomst(c, cu.id, voortgang));
  const jaren = [...new Set(c.cursussen.map((cu) => cu.jaar))]
    .sort((a, b) => a - b)
    .map((jaar) => ({
      jaar,
      perioden: [...new Set(c.cursussen.filter((cu) => cu.jaar === jaar).map((cu) => cu.periode))]
        .sort((a, b) => a - b)
        .map((periode) => ({ periode, cursussen: uitkomsten.filter((u) => u.cursus.jaar === jaar && u.cursus.periode === periode) })),
    }));

  const leerdoelen = { nog_niet_gestart: 0, bezig: 0, behaald: 0, totaal: c.leerdoelen.length, versterkt: 0 };
  for (const l of c.leerdoelen) {
    const t = leerdoelTotaal(c, l.id, voortgang);
    leerdoelen[t.status] += 1;
    if (t.behaaldIn > 1) leerdoelen.versterkt += 1;
  }
  const opdrachten: Record<OpdrachtStatus, number> = { open: 0, zelf_gemeld: 0, bevestigd: 0 };
  for (const u of uitkomsten) for (const s of ['open', 'zelf_gemeld', 'bevestigd'] as const) opdrachten[s] += u.aantalOpdrachten[s];

  return {
    jaren,
    leerdoelen,
    opdrachten,
    waarom: [
      `Leerdoelen: ${leerdoelen.behaald} van de ${leerdoelen.totaal} behaald, waarvan ${leerdoelen.versterkt} versterkt (in meer dan één cursus behaald). ${leerdoelen.bezig} bezig, ${leerdoelen.nog_niet_gestart} nog niet gestart.`,
      'Een leerdoel is behaald zodra je het in één cursus hebt behaald. Elke volgende cursus waarin je het behaalt, versterkt het.',
      `Opdrachten: ${opdrachten.bevestigd} bevestigd, ${opdrachten.zelf_gemeld} zelf gemeld, ${opdrachten.open} open.`,
    ],
  };
}

// --- Periode en volgende stap (questlog) ----------------------------------

export function perioden(c: Curriculum): { jaar: number; periode: number }[] {
  const gezien = new Map<number, number>();
  for (const cu of c.cursussen) if (!gezien.has(cu.periode)) gezien.set(cu.periode, cu.jaar);
  return [...gezien].map(([periode, jaar]) => ({ jaar, periode })).sort((a, b) => a.periode - b.periode);
}

/**
 * De periode waar de student mee bezig is, als niets anders gekozen is: de
 * laatste periode met een zelf gemelde of bevestigde opdracht, anders de eerste.
 */
export function actievePeriode(c: Curriculum, voortgang: Voortgang): number {
  let laatste = perioden(c)[0]?.periode ?? 1;
  for (const cu of c.cursussen) {
    if (cu.opdrachten.some((o) => statusVan(voortgang, o.id) !== 'open')) laatste = Math.max(laatste, cu.periode);
  }
  return laatste;
}

export interface PeriodeUitkomst {
  jaar: number;
  periode: number;
  cursussen: CursusUitkomst[];
  /** Cursussen met leerdoelen, en daarvan die waarin alle leerdoelen behaald zijn. */
  metLeerdoelen: number;
  allesBehaald: number;
}

export function periodeUitkomst(c: Curriculum, periode: number, voortgang: Voortgang): PeriodeUitkomst {
  const cursussen = c.cursussen.filter((cu) => cu.periode === periode).map((cu) => cursusUitkomst(c, cu.id, voortgang));
  const met = cursussen.filter((u) => u.status !== 'geen_leerdoelen');
  return {
    jaar: c.cursussen.find((cu) => cu.periode === periode)?.jaar ?? 0,
    periode,
    cursussen,
    metLeerdoelen: met.length,
    allesBehaald: met.filter((u) => u.status === 'behaald').length,
  };
}

export type VolgendeStap =
  | { soort: 'doen'; cursusId: string; opdrachtId: string; tekst: string; levertOp: string[] }
  | { soort: 'docent'; cursusId: string; opdrachtId: string; tekst: string; levertOp: string[] }
  | { soort: 'klaar'; tekst: string; levertOp: string[] };

/**
 * Eén concrete volgende stap in een periode:
 * 1. de eerste open opdracht (in de volgorde van het cursusoverzicht);
 * 2. anders een zelf gemelde opdracht die nog een code van de docent nodig heeft;
 * 3. anders: alles in deze periode is bevestigd.
 */
export function volgendeStap(c: Curriculum, periode: number, voortgang: Voortgang): VolgendeStap {
  const cursussen = c.cursussen.filter((cu) => cu.periode === periode);
  const kort = (ids: string[]) => ids.map((id) => c.leerdoelen.find((l) => l.id === id)?.kort ?? id);
  for (const soort of ['open', 'zelf_gemeld'] as const) {
    for (const cu of cursussen) {
      const o = cu.opdrachten.find((x) => statusVan(voortgang, x.id) === soort);
      if (!o) continue;
      const levertOp = kort(o.leerdoelen.map((k) => k.leerdoel));
      const naam = o.titel.replace(/^DEMO-/, '');
      return soort === 'open'
        ? { soort: 'doen', cursusId: cu.id, opdrachtId: o.id, levertOp, tekst: `Maak de ${naam} van ${cu.titel}.` }
        : { soort: 'docent', cursusId: cu.id, opdrachtId: o.id, levertOp, tekst: `Vraag je docent om een code voor de ${naam} van ${cu.titel}.` };
    }
  }
  return { soort: 'klaar', levertOp: [], tekst: `Alles in periode ${periode} is bevestigd. Kijk vooruit naar de volgende periode.` };
}
