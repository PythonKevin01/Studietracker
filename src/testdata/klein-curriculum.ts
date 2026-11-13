/** Klein vast curriculum voor tests. Verzonnen; los van de echte cursusgegevens. */
import { KERNTAKEN } from '../curriculum/importeer';
import { leesCurriculum } from '../curriculum/schema';

const ld = (id: string, titel: string, kerntaken: string[], werkproces?: string) => ({ id, kort: titel.split(' ').slice(-1)[0], titel, kerntaken, ...(werkproces ? { werkproces } : {}) });
const opdr = (id: string, nr: number, koppel: [string, 'O' | 'G' | 'B'][]) => ({
  id,
  nr,
  titel: `Test ${id}`,
  leerdoelen: koppel.map(([leerdoel, niveau]) => ({ leerdoel, niveau })),
});

/**
 * LD05 wordt aangeboden in cursus A en B (kan dus versterkt worden).
 * LD24 is werkproces B1-K1-W1. LD17 hoort bij beide kerntaken.
 */
export const kleinCurriculum = leesCurriculum({
  versie: 1,
  demo: true,
  opleiding: { naam: 'Test', crebo: '0', dossier: '0' },
  kerntaken: KERNTAKEN,
  leerdoelen: [
    ld('LD05', 'Kennis van software', ['B1-K1']),
    ld('LD17', 'Gesprekken voeren', ['B1-K1', 'B1-K2']),
    ld('LD24', 'Onderzoekt en ontwikkelt een creatief concept', ['B1-K1'], 'B1-K1-W1'),
    ld('LD38', 'Portfolio maken', ['B1-K2']),
  ],
  cursussen: [
    {
      id: 'a', titel: 'Cursus A', jaar: 1, periode: 1, leerdoelen: ['LD05', 'LD24'],
      opdrachten: [opdr('a1', 1, [['LD05', 'O'], ['LD24', 'G']]), opdr('a2', 2, [['LD05', 'B'], ['LD24', 'B']])],
    },
    {
      id: 'b', titel: 'Cursus B', jaar: 1, periode: 2, leerdoelen: ['LD05', 'LD17'],
      opdrachten: [opdr('b1', 3, [['LD05', 'G']]), opdr('b2', 4, [['LD05', 'B']]), opdr('b3', 5, [['LD17', 'B']])],
    },
    { id: 'c', titel: 'Cursus C', jaar: 2, periode: 7, leerdoelen: ['LD38'], opdrachten: [opdr('c1', 6, [['LD38', 'B']])] },
    { id: 'leeg', titel: 'Cursus zonder leerdoelen', jaar: 2, periode: 7, leerdoelen: [], opdrachten: [] },
  ],
});
