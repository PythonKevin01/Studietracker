import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { importeer, maakId, type BronLeerdoel } from './importeer';
import { leesCurriculum } from './schema';

const bron = parse(readFileSync('curriculum/bron/leerdoelen.yaml', 'utf8')) as BronLeerdoel[];
const csv = readFileSync('curriculum/bron/cursussen.csv', 'utf8');

describe('curriculum inlezen uit het cursusoverzicht', () => {
  const { curriculum: c, verslag } = importeer(csv, bron);

  it('levert een geldig curriculum', () => {
    expect(() => leesCurriculum(c)).not.toThrow();
  });

  it('voegt een cursus die twee keer in dezelfde periode staat samen, met alle leerdoelen', () => {
    const mg = c.cursussen.find((x) => x.id === 'p3-specialisatie-project-mv-01-motion-graphics-en-social-media')!;
    expect(mg.leerdoelen).toEqual(['LD02', 'LD16', 'LD11', 'LD04']);
    const ga = c.cursussen.find((x) => x.id === 'p3-specialisatie-project-mv-01-3d-en-game-art')!;
    expect(ga.leerdoelen).toEqual(['LD28', 'LD20']);
    expect(verslag.samengevoegd).toHaveLength(4);
  });

  it('maakt cursussen met dezelfde naam in verschillende periodes uniek', () => {
    expect(c.cursussen.filter((x) => x.titel === 'Projectweek').map((x) => x.id)).toEqual(['p1-projectweek', 'p2-projectweek', 'p3-projectweek', 'p4-projectweek']);
  });

  it('geeft cursussen zonder leerdoelen geen opdrachten', () => {
    const leeg = c.cursussen.filter((x) => x.leerdoelen.length === 0);
    expect(leeg.map((x) => x.titel)).toContain('Marketing-01');
    expect(leeg.every((x) => x.opdrachten.length === 0)).toBe(true);
    expect(verslag.zonderLeerdoelen).toHaveLength(leeg.length);
  });

  it('geeft elke cursus met leerdoelen een oefenopdracht (G) en een eindopdracht (B) voor al zijn leerdoelen', () => {
    const ps = c.cursussen.find((x) => x.id === 'p1-photoshop-01')!;
    expect(ps.opdrachten.map((o) => [o.titel, o.leerdoelen.map((k) => `${k.leerdoel}:${k.niveau}`)])).toEqual([
      ['DEMO-oefenopdracht', ['LD03:G', 'LD19:G']],
      ['DEMO-eindopdracht', ['LD03:B', 'LD19:B']],
    ]);
  });

  it('houdt bestaande opdrachtnummers vast en geeft nieuwe opdrachten een nieuw nummer', () => {
    const bestaand = new Map([['p1-photoshop-01-eindopdracht', 500], ['p1-photoshop-01-oefenen', 777]]);
    const opnieuw = importeer(csv, bron, bestaand).curriculum;
    const ps = opnieuw.cursussen.find((x) => x.id === 'p1-photoshop-01')!;
    expect(ps.opdrachten.map((o) => o.nr)).toEqual([777, 500]);
    const nrs = opnieuw.cursussen.flatMap((x) => x.opdrachten.map((o) => o.nr));
    expect(new Set(nrs).size).toBe(nrs.length);
    expect(Math.min(...nrs.filter((n) => n !== 500 && n !== 777))).toBe(778);
  });

  it('maakt leesbare id\'s', () => {
    expect(maakId('Animation & Design-01')).toBe('animation-en-design-01');
    expect(maakId('Stage Oriëntatie')).toBe('stage-orientatie');
  });
});
