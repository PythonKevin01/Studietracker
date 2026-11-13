/**
 * Voor de schermtests: maakt een vers testsleutelpaar in test-uitvoer/ (buiten
 * git). De publieke sleutel gaat via STUDIETRACKER_SLEUTELS in de testbuild;
 * de privésleutel staat er ook als versleuteld sleutelbestand voor de docentpagina.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import * as ed from '@noble/ed25519';
import { maakSleutelpaar } from '../src/bewijscode/ondertekenen';
import { versleutelSleutel } from '../src/bewijscode/sleutelbestand';

export const E2E_NUMMER = 250; // los van echte sleutels (1-199) en de demo-sleutel (200)
export const E2E_WACHTWOORDZIN = 'alleen voor de schermtests';

const paar = await maakSleutelpaar();
mkdirSync('test-uitvoer', { recursive: true });
const publiek = ed.etc.bytesToHex(paar.publiekeSleutel);
writeFileSync('test-uitvoer/e2e-publiek.json', JSON.stringify([{ nummer: E2E_NUMMER, sleutel: publiek }]));
writeFileSync('test-uitvoer/e2e-sleutel.json', JSON.stringify({ prive: ed.etc.bytesToHex(paar.priveSleutel), publiek }));
// Weinig rondes: alleen om de schermtests snel te houden.
const bestand = await versleutelSleutel(paar.priveSleutel, E2E_NUMMER, E2E_WACHTWOORDZIN, { rondes: 1000 });
writeFileSync('test-uitvoer/e2e-docent.sleutel.json', JSON.stringify(bestand));
