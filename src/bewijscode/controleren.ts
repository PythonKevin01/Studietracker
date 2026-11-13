/**
 * Controleren van een bewijscode. Gebruikt door de studentpagina (bij
 * invoeren) en de docentpagina (bij rapporten inlezen). Bevat geen
 * ondertekencode en heeft geen privésleutel nodig.
 */
import * as ed from '@noble/ed25519';
import {
  FormaatFout,
  MIN_LENGTE,
  VERSIE,
  haalCodeUitInvoer,
  leesVersie,
  normaliseerStudentnummer,
  ontleedCode,
  vanTekst,
  type BewijsInhoud,
} from './formaat';

export interface PubliekeSleutel {
  nummer: number;
  /** 32 bytes, hexadecimaal. */
  sleutel: string;
}

export type Weigerreden =
  | 'onleesbaar'
  | 'onbekende_versie'
  | 'onbekend_sleutelnummer'
  | 'ongeldige_handtekening'
  | 'andere_student'
  | 'onbekende_opdracht'
  | 'al_ingevoerd';

export const WEIGERMELDING: Record<Weigerreden, string> = {
  onleesbaar: 'Deze code is niet leesbaar. Scan of plak de hele code opnieuw.',
  onbekende_versie: 'Deze code is gemaakt voor een nieuwere versie van de app. Werk de app bij en probeer het opnieuw.',
  onbekend_sleutelnummer:
    'Deze code is ondertekend met een sleutel die deze app niet kent. Werk de app bij of vraag je docent om een nieuwe code.',
  ongeldige_handtekening: 'Deze code is niet geldig: de handtekening van de docent klopt niet. Vraag een nieuwe code.',
  andere_student: 'Deze code is voor een andere student gemaakt en telt niet voor jou.',
  onbekende_opdracht: 'Deze code hoort bij een opdracht die deze app niet kent.',
  al_ingevoerd: 'Deze code heb je al ingevoerd. Hij telt één keer.',
};

export interface ControleContext {
  /** Studentnummer van de eigenaar van deze app (of van het rapport). */
  studentnummer: string;
  publiekeSleutels: readonly PubliekeSleutel[];
  /** Opdrachtnummers uit het curriculum. */
  bekendeOpdrachtNrs: ReadonlySet<number>;
  /** Eerder geaccepteerde codes, in tekstvorm. */
  alIngevoerd: ReadonlySet<string>;
}

export type Controle =
  | { ok: true; code: string; inhoud: BewijsInhoud }
  | { ok: false; reden: Weigerreden; melding: string };

function weiger(reden: Weigerreden): Controle {
  return { ok: false, reden, melding: WEIGERMELDING[reden] };
}

/**
 * Volgorde: leesbaar, versie, sleutelnummer, handtekening en pas daarna de
 * inhoud. Zo krijgt een vervalste of aangepaste code altijd de melding
 * "ongeldige handtekening", wat er ook in staat.
 */
export async function controleerBewijscode(invoer: string, context: ControleContext): Promise<Controle> {
  const code = haalCodeUitInvoer(invoer);
  let bytes: Uint8Array;
  try {
    bytes = vanTekst(code);
  } catch {
    return weiger('onleesbaar');
  }
  // Korter dan de kleinst mogelijke code: afgebroken of iets heel anders.
  if (bytes.length < MIN_LENGTE) return weiger('onleesbaar');
  if (leesVersie(bytes) !== VERSIE) return weiger('onbekende_versie');

  let gelezen;
  try {
    gelezen = ontleedCode(bytes);
  } catch (fout) {
    if (fout instanceof FormaatFout) return weiger('onleesbaar');
    throw fout;
  }
  const { inhoud, bericht, handtekening } = gelezen;

  const sleutel = context.publiekeSleutels.find((s) => s.nummer === inhoud.sleutelnummer);
  if (!sleutel) return weiger('onbekend_sleutelnummer');

  let geldig = false;
  try {
    geldig = await ed.verifyAsync(handtekening, bericht, ed.etc.hexToBytes(sleutel.sleutel), { zip215: false });
  } catch {
    geldig = false;
  }
  if (!geldig) return weiger('ongeldige_handtekening');

  if (inhoud.studentnummer !== normaliseerStudentnummer(context.studentnummer)) return weiger('andere_student');
  if (inhoud.regels.some((r) => !context.bekendeOpdrachtNrs.has(r.opdrachtNr))) return weiger('onbekende_opdracht');
  if (context.alIngevoerd.has(code)) return weiger('al_ingevoerd');

  return { ok: true, code, inhoud };
}
