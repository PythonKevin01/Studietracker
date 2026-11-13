import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { leesCurriculum } from '../curriculum/schema';
import { kerntaakUitkomst, leerdoelUitkomst, opdrachtStatus, vakUitkomst, werkprocesUitkomst } from './index';

const c = leesCurriculum(parse(readFileSync('curriculum/demo.yaml', 'utf8')));

describe('opdracht', () => {
  it('kent drie statussen; bevestigd gaat voor zelf gemeld', () => {
    expect(opdrachtStatus({ zelfGemeld: false, bevestigd: false })).toBe('open');
    expect(opdrachtStatus({ zelfGemeld: true, bevestigd: false })).toBe('zelf_gemeld');
    expect(opdrachtStatus({ zelfGemeld: true, bevestigd: true })).toBe('bevestigd');
    expect(opdrachtStatus({ zelfGemeld: false, bevestigd: true })).toBe('bevestigd');
  });
});

describe('leerdoel', () => {
  // LD15: demo-1 (O), demo-2 (G), demo-3 (B)
  it('is "nog niet gestart" zonder gemelde opdrachten', () => {
    const u = leerdoelUitkomst(c, 'LD15', {});
    expect(u.status).toBe('nog_niet_gestart');
    expect(u.label).toBe('Nog niet gestart');
    expect(u.waarom[0]).toMatch(/geen enkele opdracht/);
  });

  it('is "bezig" bij één zelf gemelde opdracht', () => {
    expect(leerdoelUitkomst(c, 'LD15', { 'demo-1': 'zelf_gemeld' }).status).toBe('bezig');
  });

  it('is "bezig", niet "behaald", als de B-opdracht alleen zelf gemeld is', () => {
    const u = leerdoelUitkomst(c, 'LD15', { 'demo-1': 'bevestigd', 'demo-2': 'bevestigd', 'demo-3': 'zelf_gemeld' });
    expect(u.status).toBe('bezig');
    expect(u.waarom.join('\n')).toMatch(/0 van de 1 opdracht\(en\) op niveau B/);
  });

  it('is "behaald" zodra alle B-opdrachten bevestigd zijn, ook als O en G nog open staan', () => {
    const u = leerdoelUitkomst(c, 'LD15', { 'demo-3': 'bevestigd' });
    expect(u.status).toBe('behaald');
    expect(u.waarom[0]).toMatch(/alle 1 opdracht\(en\) op niveau B/);
  });

  it('eist alle B-opdrachten bij een leerdoel met meerdere', () => {
    // LD17: demo-2 (O), demo-3 (G), demo-5 (B) -> één B; LD19: demo-4 (G), demo-5 (B), demo-6 (G)
    expect(leerdoelUitkomst(c, 'LD19', { 'demo-4': 'bevestigd', 'demo-6': 'bevestigd' }).status).toBe('bezig');
    expect(leerdoelUitkomst(c, 'LD19', { 'demo-5': 'bevestigd' }).status).toBe('behaald');
  });

  it('geeft in de onderbouwing elke opdracht met niveau en status', () => {
    const u = leerdoelUitkomst(c, 'LD15', { 'demo-2': 'zelf_gemeld' });
    expect(u.opdrachten.map((o) => [o.opdrachtId, o.niveau, o.status])).toEqual([
      ['demo-1', 'O', 'open'],
      ['demo-2', 'G', 'zelf_gemeld'],
      ['demo-3', 'B', 'open'],
    ]);
    expect(u.waarom.some((z) => z.includes('Mini-onderzoek') && z.includes('zelf gemeld'))).toBe(true);
  });
});

describe('werkproces', () => {
  it('telt per niveau, met zelf gemeld en bevestigd apart', () => {
    // B1-K1-W1 <- LD15 <- demo-1 (O), demo-2 (G), demo-3 (B)
    const u = werkprocesUitkomst(c, 'B1-K1-W1', { 'demo-1': 'bevestigd', 'demo-2': 'zelf_gemeld' });
    expect(u.tellers).toEqual({
      O: { totaal: 1, zelfGemeld: 0, bevestigd: 1 },
      G: { totaal: 1, zelfGemeld: 1, bevestigd: 0 },
      B: { totaal: 1, zelfGemeld: 0, bevestigd: 0 },
    });
  });

  it('telt een opdracht één keer, op het hoogste niveau', () => {
    // B1-K1-W5 <- LD19 <- demo-4 (G), demo-5 (B), demo-6 (G)
    const u = werkprocesUitkomst(c, 'B1-K1-W5', {});
    expect([u.tellers.O.totaal, u.tellers.G.totaal, u.tellers.B.totaal]).toEqual([0, 2, 1]);
  });

  it('kent geen eindstatus en gebruikt het woord "afgerond" nergens', () => {
    const u = werkprocesUitkomst(c, 'B1-K1-W1', { 'demo-1': 'bevestigd', 'demo-2': 'bevestigd', 'demo-3': 'bevestigd' });
    expect(u).not.toHaveProperty('status');
    expect(JSON.stringify(u).toLowerCase()).not.toContain('afgerond');
  });

  it('legt uit via welk leerdoel een opdracht meetelt', () => {
    const u = werkprocesUitkomst(c, 'B1-K2-W1', { 'demo-5': 'bevestigd' });
    expect(u.waarom.some((z) => z.includes('Huisstijl') && z.includes('via LD17'))).toBe(true);
  });
});

describe('kerntaak en vak', () => {
  it('kerntaak telt een opdracht die bij meer werkprocessen hoort één keer', () => {
    const u = kerntaakUitkomst(c, 'B1-K1', {});
    // K1 raakt LD15, LD17, LD19: alle zes opdrachten, elk op hoogste niveau.
    const totaal = u.tellers.O.totaal + u.tellers.G.totaal + u.tellers.B.totaal;
    expect(totaal).toBe(6);
    expect(u.tellers.B.totaal).toBe(2); // demo-3 en demo-5
    expect(u.werkprocessen).toHaveLength(5);
  });

  it('vak telt leerdoelen en opdrachten op', () => {
    const u = vakUitkomst(c, 'demo-vak', { 'demo-3': 'bevestigd', 'demo-4': 'zelf_gemeld' });
    expect(u.aantalLeerdoelen).toEqual({ behaald: 1, bezig: 2, nog_niet_gestart: 1 });
    expect(u.aantalOpdrachten).toEqual({ bevestigd: 1, zelf_gemeld: 1, open: 4 });
    expect(u.waarom).toHaveLength(2);
  });
});
