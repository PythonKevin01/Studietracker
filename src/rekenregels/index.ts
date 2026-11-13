/**
 * Rekenregels: pure functies zonder opslag of schermcode. Elke functie geeft
 * naast de uitkomst ook `waarom` terug: gewone zinnen die de uitkomst
 * onderbouwen en die de app achter "Waarom?" toont.
 *
 * Bewust is er geen eindstatus voor werkprocessen of kerntaken: dit is een
 * ontwikkeloverzicht, geen examinering.
 */
import { NIVEAUS, type Curriculum, type Niveau, type Opdracht, type Vak } from '../curriculum/schema';

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

function vindVakVanLeerdoel(c: Curriculum, leerdoelId: string): Vak {
  const vak = c.vakken.find((v) => v.leerdoelen.some((l) => l.id === leerdoelId));
  if (!vak) throw new Error(`Onbekend leerdoel: ${leerdoelId}`);
  return vak;
}

export interface OpdrachtRegel {
  opdrachtId: string;
  titel: string;
  niveau: Niveau;
  status: OpdrachtStatus;
}

export interface LeerdoelUitkomst {
  leerdoelId: string;
  titel: string;
  status: LeerdoelStatus;
  label: string;
  opdrachten: OpdrachtRegel[];
  waarom: string[];
}

function regelTekst(r: OpdrachtRegel): string {
  return `${r.titel} (${r.niveau}, ${NIVEAU_LABEL[r.niveau]}): ${OPDRACHT_LABEL[r.status].toLowerCase()}`;
}

/**
 * Leerdoel:
 * - "behaald" als alle B-opdrachten bevestigd zijn;
 * - anders "bezig" bij minstens één zelf gemelde of bevestigde opdracht;
 * - anders "nog niet gestart".
 */
export function leerdoelUitkomst(c: Curriculum, leerdoelId: string, voortgang: Voortgang): LeerdoelUitkomst {
  const vak = vindVakVanLeerdoel(c, leerdoelId);
  const leerdoel = vak.leerdoelen.find((l) => l.id === leerdoelId)!;

  const opdrachten: OpdrachtRegel[] = vak.opdrachten.flatMap((o) =>
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
    waarom.push(
      `Behaald: alle ${beoordeeld.length} opdracht(en) op niveau B (beoordeeld) zijn door een docent bevestigd.`,
    );
  } else if (gestart.length > 0) {
    status = 'bezig';
    waarom.push(
      `Bezig: ${gestart.length} van de ${opdrachten.length} opdracht(en) is zelf gemeld of bevestigd.`,
      `Nog niet behaald: ${bevestigdB.length} van de ${beoordeeld.length} opdracht(en) op niveau B (beoordeeld) is bevestigd. Voor "behaald" moeten ze allemaal bevestigd zijn.`,
    );
  } else {
    status = 'nog_niet_gestart';
    waarom.push('Nog niet gestart: geen enkele opdracht bij dit leerdoel is zelf gemeld of bevestigd.');
  }
  for (const o of opdrachten) waarom.push(regelTekst(o));

  return { leerdoelId, titel: leerdoel.titel, status, label: LEERDOEL_LABEL[status], opdrachten, waarom };
}

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

export interface WerkprocesBijdrage extends OpdrachtRegel {
  /** Leerdoelen waarlangs deze opdracht bij het werkproces uitkomt. */
  viaLeerdoelen: string[];
}

export interface WerkprocesUitkomst {
  werkprocesId: string;
  titel: string;
  tellers: Tellers;
  bijdragen: WerkprocesBijdrage[];
  waarom: string[];
}

/**
 * Opdrachten die via een leerdoel bij een van de gegeven werkprocessen
 * uitkomen. Elke opdracht telt één keer, op het hoogste niveau waarop hij
 * aan zo'n leerdoel hangt.
 */
function bijdragenVoor(c: Curriculum, werkprocesIds: ReadonlySet<string>, voortgang: Voortgang): WerkprocesBijdrage[] {
  const bijdragen: WerkprocesBijdrage[] = [];
  for (const vak of c.vakken) {
    const relevant = new Set(
      vak.leerdoelen.filter((l) => l.werkprocessen.some((w) => werkprocesIds.has(w))).map((l) => l.id),
    );
    for (const o of vak.opdrachten) {
      const koppelingen = o.leerdoelen.filter((k) => relevant.has(k.leerdoel));
      if (koppelingen.length === 0) continue;
      const niveau = koppelingen.reduce<Niveau>(
        (hoogste, k) => (NIVEAU_RANG[k.niveau] > NIVEAU_RANG[hoogste] ? k.niveau : hoogste),
        'O',
      );
      bijdragen.push({
        opdrachtId: o.id,
        titel: o.titel,
        niveau,
        status: statusVan(voortgang, o.id),
        viaLeerdoelen: koppelingen.map((k) => k.leerdoel),
      });
    }
  }
  return bijdragen;
}

function tel(bijdragen: readonly WerkprocesBijdrage[]): Tellers {
  const tellers = legeTellers();
  for (const b of bijdragen) {
    const t = tellers[b.niveau];
    t.totaal += 1;
    if (b.status === 'zelf_gemeld') t.zelfGemeld += 1;
    if (b.status === 'bevestigd') t.bevestigd += 1;
  }
  return tellers;
}

function tellerZinnen(tellers: Tellers): string[] {
  return NIVEAUS.map((n) => {
    const t = tellers[n];
    return `Niveau ${n} (${NIVEAU_LABEL[n]}): ${t.totaal} opdracht(en), waarvan ${t.zelfGemeld} zelf gemeld en ${t.bevestigd} bevestigd.`;
  });
}

/** Werkproces: tellers per niveau, met zelf gemeld en bevestigd apart. */
export function werkprocesUitkomst(c: Curriculum, werkprocesId: string, voortgang: Voortgang): WerkprocesUitkomst {
  const werkproces = c.kerntaken.flatMap((k) => k.werkprocessen).find((w) => w.id === werkprocesId);
  if (!werkproces) throw new Error(`Onbekend werkproces: ${werkprocesId}`);

  const bijdragen = bijdragenVoor(c, new Set([werkprocesId]), voortgang);
  const tellers = tel(bijdragen);
  const waarom = [
    'Een opdracht telt mee als hij hoort bij een leerdoel dat aan dit werkproces is gekoppeld. Elke opdracht telt één keer, op zijn hoogste niveau.',
    ...tellerZinnen(tellers),
    ...bijdragen.map((b) => `${regelTekst(b)}, via ${b.viaLeerdoelen.join(' en ')}`),
  ];
  if (bijdragen.length === 0) waarom.push('Er zijn nog geen opdrachten aan dit werkproces gekoppeld.');

  return { werkprocesId, titel: werkproces.titel, tellers, bijdragen, waarom };
}

export interface KerntaakUitkomst {
  kerntaakId: string;
  titel: string;
  tellers: Tellers;
  werkprocessen: WerkprocesUitkomst[];
  waarom: string[];
}

/** Kerntaak: dezelfde tellers, over alle werkprocessen samen (elke opdracht één keer). */
export function kerntaakUitkomst(c: Curriculum, kerntaakId: string, voortgang: Voortgang): KerntaakUitkomst {
  const kerntaak = c.kerntaken.find((k) => k.id === kerntaakId);
  if (!kerntaak) throw new Error(`Onbekende kerntaak: ${kerntaakId}`);

  const ids = new Set(kerntaak.werkprocessen.map((w) => w.id));
  const tellers = tel(bijdragenVoor(c, ids, voortgang));
  return {
    kerntaakId,
    titel: kerntaak.titel,
    tellers,
    werkprocessen: kerntaak.werkprocessen.map((w) => werkprocesUitkomst(c, w.id, voortgang)),
    waarom: [
      `Opgeteld over ${kerntaak.werkprocessen.length} werkprocessen. Een opdracht die bij meer werkprocessen hoort, telt hier één keer.`,
      ...tellerZinnen(tellers),
    ],
  };
}

export interface VakUitkomst {
  vakId: string;
  titel: string;
  leerdoelen: LeerdoelUitkomst[];
  aantalLeerdoelen: Record<LeerdoelStatus, number>;
  aantalOpdrachten: Record<OpdrachtStatus, number>;
  waarom: string[];
}

/** Vak: alleen optellingen van leerdoelen en opdrachten, geen eigen eindstatus. */
export function vakUitkomst(c: Curriculum, vakId: string, voortgang: Voortgang): VakUitkomst {
  const vak = c.vakken.find((v) => v.id === vakId);
  if (!vak) throw new Error(`Onbekend vak: ${vakId}`);

  const leerdoelen = vak.leerdoelen.map((l) => leerdoelUitkomst(c, l.id, voortgang));
  const aantalLeerdoelen: Record<LeerdoelStatus, number> = { nog_niet_gestart: 0, bezig: 0, behaald: 0 };
  for (const l of leerdoelen) aantalLeerdoelen[l.status] += 1;
  const aantalOpdrachten: Record<OpdrachtStatus, number> = { open: 0, zelf_gemeld: 0, bevestigd: 0 };
  for (const o of vak.opdrachten) aantalOpdrachten[statusVan(voortgang, o.id)] += 1;

  return {
    vakId,
    titel: vak.titel,
    leerdoelen,
    aantalLeerdoelen,
    aantalOpdrachten,
    waarom: [
      `Leerdoelen: ${aantalLeerdoelen.behaald} behaald, ${aantalLeerdoelen.bezig} bezig, ${aantalLeerdoelen.nog_niet_gestart} nog niet gestart (van ${leerdoelen.length}).`,
      `Opdrachten: ${aantalOpdrachten.bevestigd} bevestigd, ${aantalOpdrachten.zelf_gemeld} zelf gemeld, ${aantalOpdrachten.open} open (van ${vak.opdrachten.length}).`,
    ],
  };
}

export type { Opdracht };
