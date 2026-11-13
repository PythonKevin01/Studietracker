import * as ed from '@noble/ed25519';
import { beforeAll, describe, expect, it } from 'vitest';
import { controleerBewijscode, type ControleContext } from './controleren';
import { haalCodeUitInvoer, maakLink, naarTekst, ontleedCode, vanTekst, type BewijsInhoud } from './formaat';
import { maakBewijscode, maakSleutelpaar, type Sleutelpaar } from './ondertekenen';

// Alleen fictieve studenten.
const STUDENT = 'D100001';
const ANDERE_STUDENT = 'D100002';

let docent: Sleutelpaar;
let vreemde: Sleutelpaar;
let context: ControleContext;

const inhoud = (extra: Partial<BewijsInhoud> = {}): BewijsInhoud => ({
  sleutelnummer: 1,
  datum: '2026-11-13',
  studentnummer: STUDENT,
  regels: [{ opdrachtNr: 3, resultaat: 'voldaan' }],
  ...extra,
});

beforeAll(async () => {
  docent = await maakSleutelpaar();
  vreemde = await maakSleutelpaar();
  context = {
    studentnummer: STUDENT,
    publiekeSleutels: [{ nummer: 1, sleutel: ed.etc.bytesToHex(docent.publiekeSleutel) }],
    bekendeOpdrachtNrs: new Set([1, 2, 3, 4, 5, 6]),
    alIngevoerd: new Set(),
  };
});

describe('geldige code', () => {
  it('wordt geaccepteerd en geeft de inhoud terug', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    const uit = await controleerBewijscode(code, context);
    expect(uit).toEqual({ ok: true, code, inhoud: inhoud() });
  });

  it('is kort genoeg voor een QR-code', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    expect(code.length).toBeLessThan(120);
  });

  it('werkt als link, als "code=…" en als geplakte tekst met witruimte', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    const link = maakLink('https://voorbeeld.example/student/', code);
    expect(link).toBe(`https://voorbeeld.example/student/#code=${code}`);
    for (const invoer of [link, `code=${code}`, `  ${code.slice(0, 40)}\n${code.slice(40)}  `]) {
      expect(haalCodeUitInvoer(invoer)).toBe(code);
      expect((await controleerBewijscode(invoer, context)).ok).toBe(true);
    }
  });

  it('negeert spaties en hoofdletters in het studentnummer', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    expect((await controleerBewijscode(code, { ...context, studentnummer: ' d100001 ' })).ok).toBe(true);
  });

  it('kan een bundel met meerdere opdrachten voor één student zijn', async () => {
    const regels = [
      { opdrachtNr: 1, resultaat: 'voldaan' as const },
      { opdrachtNr: 2, resultaat: 'niet_voldaan' as const },
      { opdrachtNr: 5, resultaat: 'voldaan' as const },
    ];
    const uit = await controleerBewijscode(await maakBewijscode(inhoud({ regels }), docent.priveSleutel), context);
    expect(uit.ok && uit.inhoud.regels).toEqual(regels);
  });
});

describe('geweigerd met een eigen melding', () => {
  const verwachtWeigering = async (invoer: string, reden: string, ctx = context) => {
    const uit = await controleerBewijscode(invoer, ctx);
    expect(uit.ok).toBe(false);
    if (!uit.ok) {
      expect(uit.reden).toBe(reden);
      expect(uit.melding.length).toBeGreaterThan(20);
    }
  };

  it('vervalste code: ondertekend met een andere sleutel', async () => {
    await verwachtWeigering(await maakBewijscode(inhoud(), vreemde.priveSleutel), 'ongeldige_handtekening');
  });

  it('vervalste code: willekeurige handtekening', async () => {
    const bytes = vanTekst(await maakBewijscode(inhoud(), docent.priveSleutel));
    bytes.fill(7, bytes.length - 64);
    await verwachtWeigering(naarTekst(bytes), 'ongeldige_handtekening');
  });

  it('code met gewijzigd resultaat: niet voldaan omgezet naar voldaan', async () => {
    const code = await maakBewijscode(inhoud({ regels: [{ opdrachtNr: 3, resultaat: 'niet_voldaan' }] }), docent.priveSleutel);
    const bytes = vanTekst(code);
    const plek = bytes.length - 64 - 1; // laatste byte vóór de handtekening = resultaat
    expect(bytes[plek]).toBe(0);
    bytes[plek] = 1;
    expect(ontleedCode(bytes).inhoud.regels[0]!.resultaat).toBe('voldaan');
    await verwachtWeigering(naarTekst(bytes), 'ongeldige_handtekening');
  });

  it('code waarin het studentnummer is aangepast', async () => {
    const bytes = vanTekst(await maakBewijscode(inhoud({ studentnummer: ANDERE_STUDENT }), docent.priveSleutel));
    bytes[5 + STUDENT.length - 1] = '1'.charCodeAt(0); // D100002 -> D100001
    expect(ontleedCode(bytes).inhoud.studentnummer).toBe(STUDENT);
    await verwachtWeigering(naarTekst(bytes), 'ongeldige_handtekening');
  });

  it('code van een andere student', async () => {
    const code = await maakBewijscode(inhoud({ studentnummer: ANDERE_STUDENT }), docent.priveSleutel);
    await verwachtWeigering(code, 'andere_student');
  });

  it('dubbele code', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    const eerste = await controleerBewijscode(code, context);
    expect(eerste.ok).toBe(true);
    await verwachtWeigering(code, 'al_ingevoerd', { ...context, alIngevoerd: new Set([code]) });
    // Ook als dezelfde code daarna als link binnenkomt.
    await verwachtWeigering(maakLink('https://voorbeeld.example/student/', code), 'al_ingevoerd', {
      ...context,
      alIngevoerd: new Set([code]),
    });
  });

  it('onbekende opdracht', async () => {
    const code = await maakBewijscode(inhoud({ regels: [{ opdrachtNr: 999, resultaat: 'voldaan' }] }), docent.priveSleutel);
    await verwachtWeigering(code, 'onbekende_opdracht');
  });

  it('onbekend sleutelnummer', async () => {
    await verwachtWeigering(await maakBewijscode(inhoud({ sleutelnummer: 9 }), docent.priveSleutel), 'onbekend_sleutelnummer');
  });

  it('onbekende versie', async () => {
    const bytes = vanTekst(await maakBewijscode(inhoud(), docent.priveSleutel));
    bytes[0] = 2;
    await verwachtWeigering(naarTekst(bytes), 'onbekende_versie');
  });

  it('onleesbare invoer', async () => {
    const code = await maakBewijscode(inhoud(), docent.priveSleutel);
    for (const invoer of ['', 'hallo!', 'AAAA', code.slice(0, 50)]) await verwachtWeigering(invoer, 'onleesbaar');
  });
});
