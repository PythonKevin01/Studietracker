import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { CurriculumFout, alleOpdrachten, alleWerkprocessen, leesCurriculum } from './schema';

const ruw = (): any => parse(readFileSync('curriculum/demo.yaml', 'utf8'));

describe('curriculum/demo.yaml', () => {
  const c = leesCurriculum(ruw());

  it('bevat de kerntaken en werkprocessen uit het kwalificatiedossier', () => {
    expect(c.kerntaken.map((k) => `${k.id} ${k.titel}`)).toEqual(['B1-K1 Ontwerpt mediavormgeving', 'B1-K2 Positioneert zich in de markt']);
    expect(alleWerkprocessen(c).map((w) => w.id)).toEqual(['B1-K1-W1', 'B1-K1-W2', 'B1-K1-W3', 'B1-K1-W4', 'B1-K1-W5', 'B1-K2-W1', 'B1-K2-W2', 'B1-K2-W3']);
  });

  it('bevat alle 43 leerdoelen; alleen LD24-28 en LD41-43 zijn een werkproces', () => {
    expect(c.leerdoelen).toHaveLength(43);
    expect(Object.fromEntries(c.leerdoelen.filter((l) => l.werkproces).map((l) => [l.id, l.werkproces]))).toEqual({
      LD24: 'B1-K1-W1', LD25: 'B1-K1-W2', LD26: 'B1-K1-W3', LD27: 'B1-K1-W4', LD28: 'B1-K1-W5',
      LD41: 'B1-K2-W1', LD42: 'B1-K2-W2', LD43: 'B1-K2-W3',
    });
    expect(c.leerdoelen.find((l) => l.id === 'LD17')?.kerntaken).toEqual(['B1-K1', 'B1-K2']);
  });

  it('bevat alle cursussen uit het overzicht, met DEMO-opdrachten', () => {
    expect(c.cursussen).toHaveLength(69);
    expect(alleOpdrachten(c).every((o) => o.titel.includes('DEMO'))).toBe(true);
    expect(c.demo).toBe(true);
  });

  it('bevat geen docentgegevens', () => {
    const tekst = readFileSync('curriculum/demo.yaml', 'utf8') + readFileSync('curriculum/bron/cursussen.csv', 'utf8');
    expect(tekst).not.toMatch(/docent/i);
    expect(tekst).not.toMatch(/\b(WIJNL|BERGP|VEENN|HELDH|VEGTW|SARKM|MULDK)\b/);
  });
});

describe('schemacontrole weigert', () => {
  const verwachtFout = (wijzig: (r: any) => void, tekst: RegExp) => {
    const r = ruw();
    wijzig(r);
    expect(() => leesCurriculum(r)).toThrowError(CurriculumFout);
    expect(() => leesCurriculum(r)).toThrowError(tekst);
  };
  const eerste = (r: any) => r.cursussen.find((c: any) => c.opdrachten.length > 0);

  it('een curriculum zonder demo-markering', () => verwachtFout((r) => (r.demo = false), /demo/));
  it('een onbekend niveau', () => verwachtFout((r) => (eerste(r).opdrachten[0].leerdoelen[0].niveau = 'X'), /niveau/));
  it('een onbekend veld', () => verwachtFout((r) => (eerste(r).afgerond = true), /afgerond/));
  it('een leerdoel met een onbekend werkproces', () => verwachtFout((r) => (r.leerdoelen[0].werkproces = 'B1-K9-W9'), /onbekend werkproces B1-K9-W9/));
  it('een werkproces bij de verkeerde kerntaak', () => verwachtFout((r) => (r.leerdoelen.find((l: any) => l.id === 'LD24').werkproces = 'B1-K2-W1'), /hoort niet bij zijn kerntaak/));
  it('een cursus met een onbekend leerdoel', () => verwachtFout((r) => eerste(r).leerdoelen.push('LD99'), /onbekend leerdoel LD99/));
  it('een opdracht voor een leerdoel dat de cursus niet aanbiedt', () =>
    verwachtFout((r) => (eerste(r).opdrachten[0].leerdoelen[0].leerdoel = 'LD43'), /niet aanbiedt/));
  it('een dubbel opdrachtnummer', () => verwachtFout((r) => (r.cursussen[1].opdrachten[0].nr = eerste(r).opdrachten[0].nr), /Opdrachtnummer \d+ komt dubbel voor/));
  it('een leerdoel zonder B-opdracht in een cursus', () =>
    verwachtFout((r) => eerste(r).opdrachten.pop(), /heeft geen opdracht op niveau B/));
});
