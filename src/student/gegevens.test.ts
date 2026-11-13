import * as ed from '@noble/ed25519';
import { beforeAll, describe, expect, it } from 'vitest';
import { kleinCurriculum as curriculum } from '../testdata/klein-curriculum';
import { naarTekst, vanTekst, type BewijsRegel } from '../bewijscode/formaat';
import { maakBewijscode, maakSleutelpaar, type Sleutelpaar } from '../bewijscode/ondertekenen';
import {
  ExportFout,
  backupNodig,
  leesExport,
  maakExport,
  nieuweGegevens,
  oordelen,
  ontvangCode,
  voortgangVan,
  zetTerug,
  zetZelfGemeld,
  type CodeContext,
} from './gegevens';

const STUDENT = 'D100001'; // fictief
let docent: Sleutelpaar;
let ctx: CodeContext;

const code = (regels: BewijsRegel[], datum = '2026-11-13', studentnummer = STUDENT) =>
  maakBewijscode({ sleutelnummer: 1, datum, studentnummer, regels }, docent.priveSleutel);
const nu = (iso: string) => new Date(iso);

beforeAll(async () => {
  docent = await maakSleutelpaar();
  ctx = { curriculum, publiekeSleutels: [{ nummer: 1, sleutel: ed.etc.bytesToHex(docent.publiekeSleutel) }] };
});

describe('studentgegevens', () => {
  it('zelf melden en terugzetten', () => {
    let g = nieuweGegevens(' d100001 ');
    expect(g.studentnummer).toBe(STUDENT);
    g = zetZelfGemeld(g, 'a1', true, nu('2026-11-01T10:00:00Z'));
    expect(voortgangVan(curriculum, g)['a1']).toBe('zelf_gemeld');
    g = zetZelfGemeld(g, 'a1', false, nu('2026-11-02T10:00:00Z'));
    expect(voortgangVan(curriculum, g)['a1']).toBe('open');
  });

  it('een geldige code maakt de opdracht bevestigd, ook zonder zelf melden', async () => {
    const r = await ontvangCode(nieuweGegevens(STUDENT), await code([{ opdrachtNr: 3, resultaat: 'voldaan' }]), ctx, nu('2026-11-13T09:00:00Z'));
    expect(r.controle.ok).toBe(true);
    expect(voortgangVan(curriculum, r.gegevens)['b1']).toBe('bevestigd');
  });

  it('een dubbele code wordt geweigerd en verandert niets', async () => {
    const c = await code([{ opdrachtNr: 3, resultaat: 'voldaan' }]);
    const eerste = await ontvangCode(nieuweGegevens(STUDENT), c, ctx, nu('2026-11-13T09:00:00Z'));
    const tweede = await ontvangCode(eerste.gegevens, c, ctx, nu('2026-11-13T09:05:00Z'));
    expect(tweede.controle.ok).toBe(false);
    expect(tweede.gegevens).toBe(eerste.gegevens);
  });

  it('"niet voldaan" bevestigt niet; een latere "voldaan" wel; het laatste oordeel telt', async () => {
    let g = nieuweGegevens(STUDENT);
    g = (await ontvangCode(g, await code([{ opdrachtNr: 5, resultaat: 'niet_voldaan' }], '2026-10-01'), ctx, nu('2026-10-01T10:00:00Z'))).gegevens;
    expect(voortgangVan(curriculum, g)['b3']).toBe('open');
    expect(oordelen(curriculum, g).get('b3')?.resultaat).toBe('niet_voldaan');
    g = (await ontvangCode(g, await code([{ opdrachtNr: 5, resultaat: 'voldaan' }], '2026-10-08'), ctx, nu('2026-10-08T10:00:00Z'))).gegevens;
    expect(voortgangVan(curriculum, g)['b3']).toBe('bevestigd');
    // Een oudere code die later wordt ingevoerd, verandert het oordeel niet.
    g = (await ontvangCode(g, await code([{ opdrachtNr: 5, resultaat: 'niet_voldaan' }], '2026-09-01'), ctx, nu('2026-11-01T10:00:00Z'))).gegevens;
    expect(voortgangVan(curriculum, g)['b3']).toBe('bevestigd');
  });

  it('herinnert aan een back-up na nieuwe codes', async () => {
    let g = nieuweGegevens(STUDENT);
    expect(backupNodig(g)).toBe(false);
    g = (await ontvangCode(g, await code([{ opdrachtNr: 1, resultaat: 'voldaan' }]), ctx, nu('2026-11-13T09:00:00Z'))).gegevens;
    expect(backupNodig(g)).toBe(true);
    g = { ...g, laatsteExport: '2026-11-13T10:00:00.000Z' };
    expect(backupNodig(g)).toBe(false);
  });
});

describe('exportbestand en terugzetten', () => {
  const metTweeCodes = async () => {
    let g = zetZelfGemeld(nieuweGegevens(STUDENT), 'b2', true, nu('2026-11-01T10:00:00Z'));
    g = (await ontvangCode(g, await code([{ opdrachtNr: 3, resultaat: 'voldaan' }]), ctx, nu('2026-11-13T09:00:00Z'))).gegevens;
    g = (await ontvangCode(g, await code([{ opdrachtNr: 5, resultaat: 'voldaan' }, { opdrachtNr: 6, resultaat: 'voldaan' }]), ctx, nu('2026-11-13T09:01:00Z'))).gegevens;
    return g;
  };

  it('bevat alle codes en is volledig terug te zetten op een leeg apparaat', async () => {
    const g = await metTweeCodes();
    const tekst = JSON.stringify(maakExport(g, nu('2026-11-13T12:00:00Z')));
    const bestand = leesExport(tekst);
    expect(bestand.codes).toHaveLength(2);
    const r = await zetTerug(null, bestand, ctx);
    expect(r).toMatchObject({ nieuweCodes: 2, alAanwezig: 0, geweigerd: [] });
    expect(voortgangVan(curriculum, r.gegevens)).toEqual(voortgangVan(curriculum, g));
  });

  it('voegt samen met wat er al staat', async () => {
    const g = await metTweeCodes();
    const bestand = leesExport(JSON.stringify(maakExport(g, nu('2026-11-13T12:00:00Z'))));
    const deels = { ...g, codes: g.codes.slice(0, 1), zelfGemeld: {} };
    const r = await zetTerug(deels, bestand, ctx);
    expect(r).toMatchObject({ nieuweCodes: 1, alAanwezig: 1 });
    expect(r.gegevens.zelfGemeld).toHaveProperty('b2');
  });

  it('weigert in een aangepast exportbestand een code met gewijzigd resultaat', async () => {
    const g = zetZelfGemeld(nieuweGegevens(STUDENT), 'b1', true, nu('2026-11-01T10:00:00Z'));
    const echt = await code([{ opdrachtNr: 3, resultaat: 'niet_voldaan' }]);
    const bytes = vanTekst(echt);
    bytes[bytes.length - 65] = 1; // resultaat -> voldaan
    const bestand = { ...maakExport(g, nu('2026-11-13T12:00:00Z')), codes: [{ code: naarTekst(bytes), ontvangen: '2026-11-13T09:00:00.000Z' }] };
    const r = await zetTerug(null, leesExport(JSON.stringify(bestand)), ctx);
    expect(r.nieuweCodes).toBe(0);
    expect(r.geweigerd.map((w) => w.reden)).toEqual(['ongeldige_handtekening']);
    expect(voortgangVan(curriculum, r.gegevens)['b1']).toBe('zelf_gemeld');
  });

  it('weigert de back-up van een andere student', async () => {
    const bestand = leesExport(JSON.stringify(maakExport(nieuweGegevens('D100002'), nu('2026-11-13T12:00:00Z'))));
    await expect(zetTerug(nieuweGegevens(STUDENT), bestand, ctx)).rejects.toThrow(ExportFout);
  });

  it('weigert iets wat geen exportbestand is', () => {
    expect(() => leesExport('hallo')).toThrow(ExportFout);
    expect(() => leesExport('{"soort":"iets anders"}')).toThrow(ExportFout);
  });
});
