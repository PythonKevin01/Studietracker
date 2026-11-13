import { z } from 'zod';
import type { PubliekeSleutel } from './controleren';

const lijstSchema = z.array(
  z.strictObject({
    nummer: z.number().int().min(0).max(255),
    sleutel: z.string().regex(/^[0-9a-f]{64}$/, 'Een publieke sleutel is 64 hexadecimale tekens'),
    omschrijving: z.string().optional(),
  }),
);

/**
 * Leest en combineert lijsten met publieke sleutels. Hetzelfde sleutelnummer
 * met een andere sleutel is een fout: dan zou een code twee betekenissen hebben.
 */
export function leesPubliekeSleutels(...lijsten: unknown[]): PubliekeSleutel[] {
  const uit = new Map<number, string>();
  for (const ruw of lijsten) {
    const lijst = lijstSchema.safeParse(ruw);
    if (!lijst.success) {
      throw new Error(`Lijst met publieke sleutels is ongeldig: ${lijst.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    for (const { nummer, sleutel } of lijst.data) {
      const bestaand = uit.get(nummer);
      if (bestaand !== undefined && bestaand !== sleutel) throw new Error(`Sleutelnummer ${nummer} komt voor met twee verschillende sleutels`);
      uit.set(nummer, sleutel);
    }
  }
  return [...uit].map(([nummer, sleutel]) => ({ nummer, sleutel })).sort((a, b) => a.nummer - b.nummer);
}
