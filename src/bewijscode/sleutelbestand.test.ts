import { describe, expect, it } from 'vitest';
import { maakSleutelpaar } from './ondertekenen';
import { SleutelFout, keurWachtwoordzin, ontgrendelSleutel, versleutelSleutel } from './sleutelbestand';
import { leesPubliekeSleutels } from './sleutels';

const ZIN = 'paars konijn fietst zachtjes';

describe('sleutelbestand', () => {
  it('ontgrendelt met de juiste wachtwoordzin en bevat de privésleutel niet leesbaar', async () => {
    const paar = await maakSleutelpaar();
    const bestand = await versleutelSleutel(paar.priveSleutel, 2, ZIN, { rondes: 1000 });
    const tekst = JSON.stringify(bestand);
    expect(tekst).not.toContain(Buffer.from(paar.priveSleutel).toString('hex'));
    expect(tekst).not.toContain(Buffer.from(paar.priveSleutel).toString('base64url'));
    const terug = await ontgrendelSleutel(JSON.parse(tekst), ZIN);
    expect(terug.sleutelnummer).toBe(2);
    expect(terug.priveSleutel).toEqual(paar.priveSleutel);
  });

  it('gebruikt standaard 600.000 rondes', async () => {
    const paar = await maakSleutelpaar();
    expect((await versleutelSleutel(paar.priveSleutel, 1, ZIN)).kdf.rondes).toBe(600_000);
  });

  it('weigert een verkeerde wachtwoordzin', async () => {
    const paar = await maakSleutelpaar();
    const bestand = await versleutelSleutel(paar.priveSleutel, 1, ZIN, { rondes: 1000 });
    await expect(ontgrendelSleutel(bestand, 'verkeerde wachtwoordzin!')).rejects.toThrow(SleutelFout);
  });

  it('weigert een bestand waarin het sleutelnummer is aangepast', async () => {
    const paar = await maakSleutelpaar();
    const bestand = await versleutelSleutel(paar.priveSleutel, 1, ZIN, { rondes: 1000 });
    await expect(ontgrendelSleutel({ ...bestand, sleutelnummer: 7 }, ZIN)).rejects.toThrow(SleutelFout);
  });

  it('keurt korte wachtwoordzinnen af', () => {
    expect(keurWachtwoordzin('kort')).toMatch(/minstens 16/);
    expect(keurWachtwoordzin(ZIN)).toBeNull();
  });
});

describe('publieke sleutels', () => {
  const a = 'a'.repeat(64);
  it('combineert lijsten en sorteert op nummer', () => {
    expect(leesPubliekeSleutels([{ nummer: 2, sleutel: a }], [], [{ nummer: 1, sleutel: a }])).toEqual([
      { nummer: 1, sleutel: a },
      { nummer: 2, sleutel: a },
    ]);
  });
  it('weigert één nummer met twee sleutels', () => {
    expect(() => leesPubliekeSleutels([{ nummer: 1, sleutel: a }], [{ nummer: 1, sleutel: 'b'.repeat(64) }])).toThrow(/twee verschillende/);
  });
  it('weigert iets wat geen publieke sleutel is', () => {
    expect(() => leesPubliekeSleutels([{ nummer: 1, sleutel: 'geheim' }])).toThrow(/ongeldig/);
  });
});
