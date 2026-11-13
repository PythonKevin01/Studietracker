import { describe, expect, it } from 'vitest';
import { leesCsv, leesCsvObjecten, schrijfCsv } from './csv';

describe('csv', () => {
  it('leest velden met komma, aanhalingstekens en regeleinden', () => {
    expect(leesCsv('a,"b, c","d ""e"""\r\n1,"x\ny",3\n')).toEqual([
      ['a', 'b, c', 'd "e"'],
      ['1', 'x\ny', '3'],
    ]);
  });
  it('herkent puntkomma als scheidingsteken (Nederlandse Excel) en negeert BOM en lege regels', () => {
    expect(leesCsv('﻿studentnummer;naam\n\nD100001;Fictief, Fenna\n')).toEqual([
      ['studentnummer', 'naam'],
      ['D100001', 'Fictief, Fenna'],
    ]);
  });
  it('schrijft wat het leest', () => {
    const rijen = [['a', 'b, c', 'd "e"'], ['1', '', ' x']];
    expect(leesCsv(schrijfCsv(rijen))).toEqual(rijen);
  });
  it('maakt objecten op kolomnaam', () => {
    expect(leesCsvObjecten('Studentnummer, Naam\nD100001, Fenna\n')).toEqual([{ studentnummer: 'D100001', naam: 'Fenna' }]);
  });
});
