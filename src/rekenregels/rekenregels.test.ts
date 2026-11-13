import { describe, expect, it } from 'vitest';
import { kleinCurriculum as c } from '../testdata/klein-curriculum';
import {
  cursusUitkomst,
  kerntaakUitkomst,
  leerdoelInCursus,
  leerdoelTotaal,
  opdrachtStatus,
  opleidingUitkomst,
  werkprocesUitkomst,
} from './index';

describe('opdracht', () => {
  it('kent drie statussen; bevestigd gaat voor zelf gemeld', () => {
    expect(opdrachtStatus({ zelfGemeld: false, bevestigd: false })).toBe('open');
    expect(opdrachtStatus({ zelfGemeld: true, bevestigd: false })).toBe('zelf_gemeld');
    expect(opdrachtStatus({ zelfGemeld: true, bevestigd: true })).toBe('bevestigd');
    expect(opdrachtStatus({ zelfGemeld: false, bevestigd: true })).toBe('bevestigd');
  });
});

describe('leerdoel in een cursus', () => {
  // Cursus A, LD05: a1 (O), a2 (B)
  it('is "nog niet gestart" zonder gemelde opdrachten', () => {
    const u = leerdoelInCursus(c, 'a', 'LD05', {});
    expect(u.status).toBe('nog_niet_gestart');
    expect(u.waarom[0]).toMatch(/geen enkele opdracht/);
  });
  it('is "bezig" bij één zelf gemelde opdracht', () => {
    expect(leerdoelInCursus(c, 'a', 'LD05', { a1: 'zelf_gemeld' }).status).toBe('bezig');
  });
  it('is "bezig", niet "behaald", als de B-opdracht alleen zelf gemeld is', () => {
    const u = leerdoelInCursus(c, 'a', 'LD05', { a1: 'bevestigd', a2: 'zelf_gemeld' });
    expect(u.status).toBe('bezig');
    expect(u.waarom.join('\n')).toMatch(/0 van de 1 opdracht\(en\) op niveau B/);
  });
  it('is "behaald" zodra alle B-opdrachten bevestigd zijn, ook als O en G nog open staan', () => {
    expect(leerdoelInCursus(c, 'a', 'LD05', { a2: 'bevestigd' }).status).toBe('behaald');
  });
  it('telt alleen opdrachten uit die cursus mee', () => {
    // b2 is een B-opdracht voor LD05, maar in cursus B.
    expect(leerdoelInCursus(c, 'a', 'LD05', { b2: 'bevestigd' }).status).toBe('nog_niet_gestart');
  });
});

describe('leerdoel over de hele opleiding', () => {
  it('is behaald na één cursus en versterkt na een tweede', () => {
    expect(leerdoelTotaal(c, 'LD05', {}).status).toBe('nog_niet_gestart');
    const een = leerdoelTotaal(c, 'LD05', { a2: 'bevestigd' });
    expect([een.status, een.behaaldIn]).toEqual(['behaald', 1]);
    const twee = leerdoelTotaal(c, 'LD05', { a2: 'bevestigd', b2: 'bevestigd' });
    expect([twee.status, twee.behaaldIn]).toEqual(['behaald', 2]);
    expect(twee.waarom.join('\n')).toMatch(/1 keer versterkt/);
    expect(twee.waarom).toContain('Aangeboden in 2 cursus(sen).');
  });
  it('is "bezig" als het nergens behaald is maar wel ergens gestart', () => {
    expect(leerdoelTotaal(c, 'LD05', { b1: 'zelf_gemeld' }).status).toBe('bezig');
  });
});

describe('werkproces', () => {
  it('krijgt alleen voortgang via het leerdoel dat het werkproces zelf is', () => {
    // B1-K1-W1 <- LD24 <- a1 (G), a2 (B). LD05 telt niet mee.
    const u = werkprocesUitkomst(c, 'B1-K1-W1', { a1: 'bevestigd', a2: 'zelf_gemeld', b2: 'bevestigd' });
    expect(u.tellers).toEqual({
      O: { totaal: 0, zelfGemeld: 0, bevestigd: 0 },
      G: { totaal: 1, zelfGemeld: 0, bevestigd: 1 },
      B: { totaal: 1, zelfGemeld: 1, bevestigd: 0 },
    });
    expect(u.leerdoel?.leerdoelId).toBe('LD24');
    expect(u.waarom[0]).toMatch(/leerdoel LD24/);
  });
  it('zonder eigen leerdoel: geen voortgang en een uitleg waarom', () => {
    const u = werkprocesUitkomst(c, 'B1-K2-W3', {});
    expect(u.leerdoel).toBeNull();
    expect(u.waarom[0]).toMatch(/geen leerdoel/);
  });
  it('kent geen eindstatus en gebruikt het woord "afgerond" nergens', () => {
    const u = werkprocesUitkomst(c, 'B1-K1-W1', { a1: 'bevestigd', a2: 'bevestigd' });
    expect(u).not.toHaveProperty('status');
    expect(JSON.stringify(u).toLowerCase()).not.toContain('afgerond');
  });
});

describe('kerntaak', () => {
  it('telt alle leerdoelen van de kerntaak, een opdracht één keer op zijn hoogste niveau', () => {
    // K1: LD05, LD17, LD24 -> a1 (G via LD24), a2 (B), b1 (G), b2 (B), b3 (B)
    const u = kerntaakUitkomst(c, 'B1-K1', {});
    expect([u.tellers.O.totaal, u.tellers.G.totaal, u.tellers.B.totaal]).toEqual([0, 2, 3]);
    expect(u.werkprocessen).toHaveLength(5);
    // vakkennis en vaardigheden: zonder het werkproces-leerdoel LD24
    expect(u.leerdoelen.map((l) => l.leerdoelId)).toEqual(['LD05', 'LD17']);
  });
  it('telt behaalde en versterkte leerdoelen', () => {
    const u = kerntaakUitkomst(c, 'B1-K1', { a2: 'bevestigd', b2: 'bevestigd' });
    expect(u.aantal).toEqual({ behaald: 2, versterkt: 1, bezig: 0, nog_niet_gestart: 1 });
  });
  it('een leerdoel van twee kerntaken telt bij allebei', () => {
    expect(kerntaakUitkomst(c, 'B1-K2', { b3: 'bevestigd' }).aantal.behaald).toBe(1);
    expect(kerntaakUitkomst(c, 'B1-K1', { b3: 'bevestigd' }).aantal.behaald).toBe(1);
  });
});

describe('cursus en opleiding', () => {
  it('cursus telt leerdoelen en opdrachten op', () => {
    const u = cursusUitkomst(c, 'b', { b2: 'bevestigd', b3: 'zelf_gemeld' });
    expect(u.status).toBe('bezig');
    expect(u.aantalLeerdoelen).toEqual({ behaald: 1, bezig: 1, nog_niet_gestart: 0 });
    expect(u.aantalOpdrachten).toEqual({ bevestigd: 1, zelf_gemeld: 1, open: 1 });
    expect(cursusUitkomst(c, 'b', { b2: 'bevestigd', b3: 'bevestigd' }).status).toBe('behaald');
    expect(cursusUitkomst(c, 'leeg', {}).status).toBe('geen_leerdoelen');
  });
  it('opleiding groepeert per jaar en periode en telt alle leerdoelen', () => {
    const u = opleidingUitkomst(c, { a2: 'bevestigd', b2: 'bevestigd' });
    expect(u.jaren.map((j) => [j.jaar, j.perioden.map((p) => [p.periode, p.cursussen.length])])).toEqual([
      [1, [[1, 1], [2, 1]]],
      [2, [[7, 2]]],
    ]);
    expect(u.leerdoelen).toEqual({ totaal: 4, behaald: 2, versterkt: 1, bezig: 0, nog_niet_gestart: 2 });
  });
});

describe('periode en volgende stap', () => {
  it('actieve periode is de laatste met activiteit, anders de eerste', async () => {
    const { actievePeriode, perioden } = await import('./index');
    expect(perioden(c)).toEqual([{ jaar: 1, periode: 1 }, { jaar: 1, periode: 2 }, { jaar: 2, periode: 7 }]);
    expect(actievePeriode(c, {})).toBe(1);
    expect(actievePeriode(c, { a1: 'bevestigd', b1: 'zelf_gemeld' })).toBe(2);
  });

  it('periode telt cursussen waarin alle leerdoelen behaald zijn', async () => {
    const { periodeUitkomst } = await import('./index');
    const p = periodeUitkomst(c, 7, { c1: 'bevestigd' });
    expect([p.jaar, p.metLeerdoelen, p.allesBehaald, p.cursussen.length]).toEqual([2, 1, 1, 2]);
  });

  it('volgende stap: eerst open opdrachten, dan wachten op de docent, dan klaar', async () => {
    const { volgendeStap } = await import('./index');
    expect(volgendeStap(c, 1, {})).toMatchObject({ soort: 'doen', opdrachtId: 'a1', levertOp: ['software', 'concept'] });
    expect(volgendeStap(c, 1, { a1: 'bevestigd', a2: 'zelf_gemeld' })).toMatchObject({ soort: 'docent', opdrachtId: 'a2' });
    expect(volgendeStap(c, 1, { a1: 'bevestigd', a2: 'bevestigd' }).soort).toBe('klaar');
  });
});
