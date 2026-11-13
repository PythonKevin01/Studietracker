import * as ed from '@noble/ed25519';
import { beforeAll, describe, expect, it } from 'vitest';
import { naarTekst, vanTekst } from '../bewijscode/formaat';
import { maakSleutelpaar, type Sleutelpaar } from '../bewijscode/ondertekenen';
import { leesCsv } from '../gedeeld/csv';
import { maakExport, nieuweGegevens, ontvangCode, zetZelfGemeld } from '../student/gegevens';
import { kleinCurriculum as c } from '../testdata/klein-curriculum';
import { codesCsv, maakCodes } from './codes';
import { leesKlaslijst, voorbeeldKlaslijst } from './klaslijst';
import { klasoverzicht, leesRapporten, overzichtCsv } from './rapporten';

let sleutel: Sleutelpaar;
const sleutels = () => [{ nummer: 7, sleutel: ed.etc.bytesToHex(sleutel.publiekeSleutel) }];
const BASIS = 'https://voorbeeld.example/student/';

beforeAll(async () => {
  sleutel = await maakSleutelpaar();
});

describe('klaslijst', () => {
  it('leest het voorbeeld (fictieve studenten)', () => {
    const k = leesKlaslijst(voorbeeldKlaslijst());
    expect(k.fouten).toEqual([]);
    expect(k.studenten.map((s) => s.studentnummer)).toEqual(['D100001', 'D100002', 'D100003', 'D100004']);
  });
  it('meldt ongeldige en dubbele nummers en gaat door met de rest', () => {
    const k = leesKlaslijst('Studentnummer;Naam\nd100001;Fenna\nD100001;Dubbel\nab-12;Fout\nD100002;Sem\n');
    expect(k.studenten.map((s) => s.naam)).toEqual(['Fenna', 'Sem']);
    expect(k.fouten).toHaveLength(2);
  });
  it('weigert een bestand zonder kolom studentnummer', () => {
    expect(leesKlaslijst('naam\nFenna\n').fouten[0]).toMatch(/studentnummer/);
  });
});

async function ronde() {
  const studenten = leesKlaslijst(voorbeeldKlaslijst()).studenten.slice(0, 3);
  const codes = await maakCodes({
    curriculum: c,
    cursusId: 'b',
    studenten,
    beoordelingen: {
      D100001: { b2: 'voldaan', b3: 'voldaan' },
      D100002: { b2: 'niet_voldaan' },
      // D100003 niet beoordeeld: krijgt geen code
    },
    datum: '2026-11-13',
    sleutel: { sleutelnummer: 7, priveSleutel: sleutel.priveSleutel },
    basisUrl: BASIS,
  });
  return { studenten, codes };
}

describe('codes per cursus', () => {
  it('maakt één bundelcode per beoordeelde student, met link', async () => {
    const { codes } = await ronde();
    expect(codes.map((x) => [x.student.studentnummer, x.regels.map((r) => `${r.opdrachtId}:${r.resultaat}`)])).toEqual([
      ['D100001', ['b2:voldaan', 'b3:voldaan']],
      ['D100002', ['b2:niet_voldaan']],
    ]);
    expect(codes[0]!.link).toBe(`${BASIS}#code=${codes[0]!.code}`);
  });

  it('de student kan de code invoeren en het leerdoel is behaald', async () => {
    const { codes } = await ronde();
    const r = await ontvangCode(nieuweGegevens('D100001'), codes[0]!.link, { curriculum: c, publiekeSleutels: sleutels() }, new Date());
    expect(r.controle.ok).toBe(true);
  });

  it('CSV bevat per student een regel met de link', async () => {
    const { codes } = await ronde();
    const rijen = leesCsv(codesCsv(codes, 'Cursus B'));
    expect(rijen[0]).toEqual(['studentnummer', 'naam', 'cursus', 'opdrachten', 'link']);
    expect(rijen[2]).toEqual(['D100002', 'Sem Verzonnen', 'Cursus B', 'Test b2: nog niet voldaan', codes[1]!.link]);
  });
});

describe('rapporten inlezen', () => {
  const ctx = () => ({ curriculum: c, publiekeSleutels: sleutels() });

  it('controleert codes, voegt bestanden van dezelfde student samen en maakt een klasoverzicht', async () => {
    const { codes, studenten } = await ronde();
    let g1 = (await ontvangCode(nieuweGegevens('D100001'), codes[0]!.code, ctx(), new Date('2026-11-13T10:00:00Z'))).gegevens;
    g1 = zetZelfGemeld(g1, 'c1', true, new Date());
    const g2 = (await ontvangCode(nieuweGegevens('D100002'), codes[1]!.code, ctx(), new Date('2026-11-13T10:00:00Z'))).gegevens;
    const bestand = (g: typeof g1) => JSON.stringify(maakExport(g, new Date('2026-11-14T10:00:00Z')));

    const r = await leesRapporten(
      [
        { naam: 'a.json', tekst: bestand(g1) },
        { naam: 'a-kopie.json', tekst: bestand(g1) },
        { naam: 'b.json', tekst: bestand(g2) },
        { naam: 'kapot.json', tekst: '{"x":1}' },
      ],
      ctx(),
    );
    expect(r.onleesbaar.map((o) => o.bestand)).toEqual(['kapot.json']);
    expect(r.rapporten.map((x) => [x.studentnummer, x.bestanden.length, x.geldig, x.geweigerd.length])).toEqual([
      ['D100001', 2, 1, 0],
      ['D100002', 1, 1, 0],
    ]);

    const rijen = klasoverzicht(r.rapporten, studenten, c);
    expect(rijen[0]).toMatchObject({ naam: 'Fenna Fictief', bevestigd: 2, zelfGemeld: 1, leerdoelenBehaald: 2, versterkt: 0 });
    expect(rijen[1]).toMatchObject({ naam: 'Sem Verzonnen', bevestigd: 0, leerdoelenBehaald: 0 });
    const csv = leesCsv(overzichtCsv(rijen, c));
    expect(csv[0]!.slice(0, 3)).toEqual(['studentnummer', 'naam', 'geldige codes']);
    expect(csv[1]![0]).toBe('D100001');
  });

  it('weigert in een rapport een vervalste code en een code van een andere student', async () => {
    const { codes } = await ronde();
    const bytes = vanTekst(codes[1]!.code);
    bytes[bytes.length - 65] = 1; // niet voldaan -> voldaan
    const nep = {
      ...maakExport(nieuweGegevens('D100002'), new Date()),
      codes: [
        { code: naarTekst(bytes), ontvangen: '2026-11-13T10:00:00.000Z' },
        { code: codes[0]!.code, ontvangen: '2026-11-13T10:00:00.000Z' }, // code van D100001
      ],
    };
    const r = await leesRapporten([{ naam: 'nep.json', tekst: JSON.stringify(nep) }], ctx());
    expect(r.rapporten[0]!.geldig).toBe(0);
    expect(r.rapporten[0]!.geweigerd.map((w) => w.reden)).toEqual(['ongeldige_handtekening', 'andere_student']);
  });
});
