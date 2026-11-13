/**
 * Ondertekenen en sleutels aanmaken. ALLEEN voor de docentpagina: de
 * studentpagina mag dit bestand nooit importeren (de buildcontrole in stap 3
 * bewaakt dat).
 */
import * as ed from '@noble/ed25519';
import { codeerInhoud, naarTekst, type BewijsInhoud } from './formaat';

export interface Sleutelpaar {
  priveSleutel: Uint8Array;
  publiekeSleutel: Uint8Array;
}

export async function maakSleutelpaar(): Promise<Sleutelpaar> {
  const { secretKey, publicKey } = await ed.keygenAsync();
  return { priveSleutel: secretKey, publiekeSleutel: publicKey };
}

/** Maakt een ondertekende bewijscode in tekstvorm. Meerdere regels = bundelcode. */
export async function maakBewijscode(inhoud: BewijsInhoud, priveSleutel: Uint8Array): Promise<string> {
  const bericht = codeerInhoud(inhoud);
  const handtekening = await ed.signAsync(bericht, priveSleutel);
  const code = new Uint8Array(bericht.length + handtekening.length);
  code.set(bericht);
  code.set(handtekening, bericht.length);
  return naarTekst(code);
}
