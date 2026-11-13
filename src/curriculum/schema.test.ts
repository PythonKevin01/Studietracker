import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { CurriculumFout, alleOpdrachten, alleWerkprocessen, leesCurriculum } from './schema';

const ruw = (): any => parse(readFileSync('curriculum/demo.yaml', 'utf8'));

describe('demo-curriculum', () => {
  const c = leesCurriculum(ruw());

  it('heeft één vak met 4 leerdoelen en 6 opdrachten', () => {
    expect(c.vakken).toHaveLength(1);
    expect(c.vakken[0]!.leerdoelen).toHaveLength(4);
    expect(c.vakken[0]!.opdrachten).toHaveLength(6);
  });

  it('bevat precies de werkprocessen B1-K1-W1 t/m W5 en B1-K2-W1 t/m W3, en alle zijn gekoppeld', () => {
    const verwacht = ['B1-K1-W1', 'B1-K1-W2', 'B1-K1-W3', 'B1-K1-W4', 'B1-K1-W5', 'B1-K2-W1', 'B1-K2-W2', 'B1-K2-W3'];
    expect(alleWerkprocessen(c).map((w) => w.id)).toEqual(verwacht);
    const gekoppeld = new Set(c.vakken.flatMap((v) => v.leerdoelen.flatMap((l) => l.werkprocessen)));
    expect([...gekoppeld].sort()).toEqual(verwacht);
  });

  it('is gemarkeerd als DEMO', () => {
    expect(c.demo).toBe(true);
    expect(c.vakken.every((v) => v.titel.includes('DEMO'))).toBe(true);
    expect(alleOpdrachten(c).every((o) => o.titel.includes('DEMO'))).toBe(true);
  });
});

describe('schemacontrole weigert', () => {
  const verwachtFout = (wijzig: (r: any) => void, tekst: RegExp) => {
    const r = ruw();
    wijzig(r);
    expect(() => leesCurriculum(r)).toThrowError(CurriculumFout);
    expect(() => leesCurriculum(r)).toThrowError(tekst);
  };

  it('een curriculum zonder demo-markering', () => verwachtFout((r) => (r.demo = false), /demo/));
  it('een onbekend niveau', () => verwachtFout((r) => (r.vakken[0].opdrachten[0].leerdoelen[0].niveau = 'X'), /niveau/));
  it('een onbekend veld', () => verwachtFout((r) => (r.vakken[0].afgerond = true), /afgerond/));
  it('een verwijzing naar een onbekend werkproces', () =>
    verwachtFout((r) => r.vakken[0].leerdoelen[0].werkprocessen.push('B1-K9-W9'), /onbekend werkproces B1-K9-W9/));
  it('een verwijzing naar een onbekend leerdoel', () =>
    verwachtFout((r) => (r.vakken[0].opdrachten[0].leerdoelen[0].leerdoel = 'LD99'), /LD99/));
  it('een dubbel opdrachtnummer', () => verwachtFout((r) => (r.vakken[0].opdrachten[1].nr = 1), /Opdrachtnummer 1 komt dubbel voor/));
  it('een leerdoel zonder B-opdracht', () =>
    verwachtFout((r) => (r.vakken[0].opdrachten[5].leerdoelen[0].niveau = 'G'), /LD38 heeft geen opdracht op niveau B/));
});
