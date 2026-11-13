/**
 * Versleuteld bestand met de privésleutel van een docent. ALLEEN voor de
 * docentpagina en de demo-scripts.
 *
 * Wachtwoordzin -> PBKDF2 (SHA-256, 600.000 rondes, 16 bytes zout) -> AES-GCM-256.
 * Sleutelnummer en publieke sleutel zijn als extra gegevens aan de
 * versleuteling gekoppeld, zodat ze niet ongemerkt te verwisselen zijn.
 */
import * as ed from '@noble/ed25519';
import { z } from 'zod';
import { naarTekst, vanTekst } from './formaat';

export const STANDAARD_RONDES = 600_000;
export const MIN_WACHTWOORDZIN = 16;

const bestandSchema = z.strictObject({
  soort: z.literal('studietracker-sleutel'),
  versie: z.literal(1),
  sleutelnummer: z.number().int().min(0).max(255),
  publiekeSleutel: z.string().regex(/^[0-9a-f]{64}$/),
  aangemaakt: z.string(),
  kdf: z.strictObject({ naam: z.literal('PBKDF2'), hash: z.literal('SHA-256'), rondes: z.number().int().min(1), zout: z.string() }),
  versleuteling: z.strictObject({ naam: z.literal('AES-GCM'), iv: z.string() }),
  geheim: z.string(),
});

export type SleutelBestand = z.infer<typeof bestandSchema>;

export class SleutelFout extends Error {}

export interface OntgrendeldeSleutel {
  sleutelnummer: number;
  publiekeSleutel: string;
  priveSleutel: Uint8Array;
}

const buffer = (u: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(u);

/** Geeft een melding terug als de wachtwoordzin te zwak is, anders null. */
export function keurWachtwoordzin(wachtwoordzin: string): string | null {
  if (wachtwoordzin.trim().length < MIN_WACHTWOORDZIN) {
    return `Kies een wachtwoordzin van minstens ${MIN_WACHTWOORDZIN} tekens, bijvoorbeeld vier losse woorden.`;
  }
  return null;
}

async function afgeleideSleutel(wachtwoordzin: string, zout: Uint8Array, rondes: number): Promise<CryptoKey> {
  const basis = await crypto.subtle.importKey('raw', buffer(new TextEncoder().encode(wachtwoordzin.normalize('NFC'))), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: buffer(zout), iterations: rondes },
    basis,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

const extraGegevens = (sleutelnummer: number, publiekeSleutel: string) =>
  buffer(new TextEncoder().encode(`studietracker-sleutel/1/${sleutelnummer}/${publiekeSleutel}`));

export async function versleutelSleutel(
  priveSleutel: Uint8Array,
  sleutelnummer: number,
  wachtwoordzin: string,
  opties: { rondes?: number; nu?: Date } = {},
): Promise<SleutelBestand> {
  const rondes = opties.rondes ?? STANDAARD_RONDES;
  const publiekeSleutel = ed.etc.bytesToHex(await ed.getPublicKeyAsync(priveSleutel));
  const zout = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sleutel = await afgeleideSleutel(wachtwoordzin, zout, rondes);
  const geheim = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: extraGegevens(sleutelnummer, publiekeSleutel) }, sleutel, buffer(priveSleutel)),
  );
  return {
    soort: 'studietracker-sleutel',
    versie: 1,
    sleutelnummer,
    publiekeSleutel,
    aangemaakt: (opties.nu ?? new Date()).toISOString(),
    kdf: { naam: 'PBKDF2', hash: 'SHA-256', rondes, zout: naarTekst(zout) },
    versleuteling: { naam: 'AES-GCM', iv: naarTekst(iv) },
    geheim: naarTekst(geheim),
  };
}

export function leesSleutelBestand(ruw: unknown): SleutelBestand {
  const r = bestandSchema.safeParse(ruw);
  if (!r.success) throw new SleutelFout('Dit is geen sleutelbestand van de studietracker.');
  return r.data;
}

export async function ontgrendelSleutel(ruw: unknown, wachtwoordzin: string): Promise<OntgrendeldeSleutel> {
  const b = leesSleutelBestand(ruw);
  let prive: Uint8Array;
  try {
    const sleutel = await afgeleideSleutel(wachtwoordzin, vanTekst(b.kdf.zout), b.kdf.rondes);
    prive = new Uint8Array(
      await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: buffer(vanTekst(b.versleuteling.iv)), additionalData: extraGegevens(b.sleutelnummer, b.publiekeSleutel) },
        sleutel,
        buffer(vanTekst(b.geheim)),
      ),
    );
  } catch {
    throw new SleutelFout('De wachtwoordzin klopt niet, of het bestand is beschadigd.');
  }
  if (ed.etc.bytesToHex(await ed.getPublicKeyAsync(prive)) !== b.publiekeSleutel) {
    throw new SleutelFout('Het sleutelbestand is beschadigd: privé- en publieke sleutel horen niet bij elkaar.');
  }
  return { sleutelnummer: b.sleutelnummer, publiekeSleutel: b.publiekeSleutel, priveSleutel: prive };
}
