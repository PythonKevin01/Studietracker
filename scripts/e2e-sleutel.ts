/**
 * Voor de schermtests: maakt een vers testsleutelpaar in test-uitvoer/ (buiten
 * git). De publieke sleutel gaat via STUDIETRACKER_SLEUTELS in de testbuild.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as ed from '@noble/ed25519';
import { maakSleutelpaar } from '../src/bewijscode/ondertekenen';

const paar = await maakSleutelpaar();
mkdirSync('test-uitvoer', { recursive: true });
const publiek = ed.etc.bytesToHex(paar.publiekeSleutel);
writeFileSync('test-uitvoer/e2e-publiek.json', JSON.stringify([{ nummer: 1, sleutel: publiek }]));
writeFileSync('test-uitvoer/e2e-sleutel.json', JSON.stringify({ prive: ed.etc.bytesToHex(paar.priveSleutel), publiek }));
