/**
 * Binair formaat van een bewijscode (versie 1). Getallen zijn big-endian.
 *
 *   1 byte   versie (= 1)
 *   1 byte   sleutelnummer
 *   2 bytes  datum: dagen sinds 2020-01-01
 *   1 byte   lengte van het studentnummer (1 t/m 16)
 *   n bytes  studentnummer, leesbaar (cijfers en letters)
 *   1 byte   aantal opdrachten (1 t/m 50)
 *   per opdracht 3 bytes: opdrachtnummer (2) en resultaat (1)
 *   64 bytes Ed25519-handtekening over alles hiervoor
 *
 * Het studentnummer staat er leesbaar in. Dat is een bewuste keuze: de code is
 * persoonlijk, en een verhaspeld nummer zou hier alleen schijnveiligheid geven.
 */

export const VERSIE = 1;
export const HANDTEKENING_LENGTE = 64;
export const MAX_OPDRACHTEN = 50;
const MAX_STUDENTNUMMER = 16;
/** Kop (5) + studentnummer (1) + aantal (1) + één opdracht (3) + handtekening. */
export const MIN_LENGTE = 5 + 1 + 1 + 3 + HANDTEKENING_LENGTE;
const EPOCH_MS = Date.UTC(2020, 0, 1);
const DAG_MS = 86_400_000;

export type Resultaat = 'voldaan' | 'niet_voldaan';
const RESULTAAT_BYTE: Record<Resultaat, number> = { niet_voldaan: 0, voldaan: 1 };

export interface BewijsRegel {
  opdrachtNr: number;
  resultaat: Resultaat;
}

export interface BewijsInhoud {
  sleutelnummer: number;
  /** Datum van bevestigen, JJJJ-MM-DD. */
  datum: string;
  studentnummer: string;
  regels: BewijsRegel[];
}

export class FormaatFout extends Error {}

/** Studentnummers worden overal op dezelfde manier vergeleken: zonder spaties, hoofdletters. */
export function normaliseerStudentnummer(invoer: string): string {
  return invoer.replace(/\s+/g, '').toUpperCase();
}

export function isGeldigStudentnummer(genormaliseerd: string): boolean {
  return new RegExp(`^[A-Z0-9]{1,${MAX_STUDENTNUMMER}}$`).test(genormaliseerd);
}

function datumNaarDagen(datum: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datum);
  if (!m) throw new FormaatFout(`Ongeldige datum: ${datum}`);
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dagen = Math.round((ms - EPOCH_MS) / DAG_MS);
  if (dagen < 0 || dagen > 0xffff || dagenNaarDatum(dagen) !== datum) throw new FormaatFout(`Ongeldige datum: ${datum}`);
  return dagen;
}

function dagenNaarDatum(dagen: number): string {
  return new Date(EPOCH_MS + dagen * DAG_MS).toISOString().slice(0, 10);
}

/** Bouwt de bytes waarover de handtekening wordt gezet. */
export function codeerInhoud(inhoud: BewijsInhoud): Uint8Array {
  const nummer = normaliseerStudentnummer(inhoud.studentnummer);
  if (!isGeldigStudentnummer(nummer)) throw new FormaatFout('Ongeldig studentnummer');
  if (!Number.isInteger(inhoud.sleutelnummer) || inhoud.sleutelnummer < 0 || inhoud.sleutelnummer > 255) {
    throw new FormaatFout('Sleutelnummer moet tussen 0 en 255 liggen');
  }
  if (inhoud.regels.length < 1 || inhoud.regels.length > MAX_OPDRACHTEN) {
    throw new FormaatFout(`Een code bevat 1 t/m ${MAX_OPDRACHTEN} opdrachten`);
  }
  if (new Set(inhoud.regels.map((r) => r.opdrachtNr)).size !== inhoud.regels.length) {
    throw new FormaatFout('Een opdracht mag maar één keer in een code staan');
  }
  const dagen = datumNaarDagen(inhoud.datum);

  const bytes = new Uint8Array(5 + nummer.length + 1 + inhoud.regels.length * 3);
  let p = 0;
  bytes[p++] = VERSIE;
  bytes[p++] = inhoud.sleutelnummer;
  bytes[p++] = dagen >> 8;
  bytes[p++] = dagen & 0xff;
  bytes[p++] = nummer.length;
  for (const teken of nummer) bytes[p++] = teken.charCodeAt(0);
  bytes[p++] = inhoud.regels.length;
  for (const r of inhoud.regels) {
    if (!Number.isInteger(r.opdrachtNr) || r.opdrachtNr < 1 || r.opdrachtNr > 0xffff) {
      throw new FormaatFout(`Ongeldig opdrachtnummer: ${r.opdrachtNr}`);
    }
    bytes[p++] = r.opdrachtNr >> 8;
    bytes[p++] = r.opdrachtNr & 0xff;
    bytes[p++] = RESULTAAT_BYTE[r.resultaat];
  }
  return bytes;
}

export interface GelezenCode {
  versie: number;
  inhoud: BewijsInhoud;
  /** De ondertekende bytes (alles behalve de handtekening). */
  bericht: Uint8Array;
  handtekening: Uint8Array;
}

/** Leest alleen de versie, zodat een onbekende versie een eigen melding kan krijgen. */
export function leesVersie(code: Uint8Array): number | undefined {
  return code[0];
}

/** Ontleedt een volledige code. Controleert de vorm, niet de handtekening. */
export function ontleedCode(code: Uint8Array): GelezenCode {
  const fout = () => new FormaatFout('De code is onvolledig of beschadigd');
  if (code.length < MIN_LENGTE) throw fout();
  const bericht = code.subarray(0, code.length - HANDTEKENING_LENGTE);
  const handtekening = code.subarray(code.length - HANDTEKENING_LENGTE);

  let p = 0;
  const lees = (): number => {
    const b = bericht[p++];
    if (b === undefined) throw fout();
    return b;
  };
  const versie = lees();
  if (versie !== VERSIE) throw new FormaatFout(`Onbekende versie: ${versie}`);
  const sleutelnummer = lees();
  const dagen = (lees() << 8) | lees();
  const lengte = lees();
  if (lengte < 1 || lengte > MAX_STUDENTNUMMER) throw fout();
  let studentnummer = '';
  for (let i = 0; i < lengte; i++) studentnummer += String.fromCharCode(lees());
  if (!isGeldigStudentnummer(studentnummer)) throw fout();
  const aantal = lees();
  if (aantal < 1 || aantal > MAX_OPDRACHTEN) throw fout();
  const regels: BewijsRegel[] = [];
  for (let i = 0; i < aantal; i++) {
    const opdrachtNr = (lees() << 8) | lees();
    const r = lees();
    if (r !== 0 && r !== 1) throw fout();
    regels.push({ opdrachtNr, resultaat: r === 1 ? 'voldaan' : 'niet_voldaan' });
  }
  if (p !== bericht.length) throw fout();

  return { versie, inhoud: { sleutelnummer, datum: dagenNaarDatum(dagen), studentnummer, regels }, bericht, handtekening };
}

// --- Tekstvorm: base64url zonder opvulling -------------------------------

export function naarTekst(bytes: Uint8Array): string {
  let binair = '';
  for (const b of bytes) binair += String.fromCharCode(b);
  return btoa(binair).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function vanTekst(tekst: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]+$/.test(tekst)) throw new FormaatFout('De code bevat ongeldige tekens');
  let binair: string;
  try {
    binair = atob(tekst.replace(/-/g, '+').replace(/_/g, '/'));
  } catch {
    throw new FormaatFout('De code is onvolledig of beschadigd');
  }
  return Uint8Array.from(binair, (t) => t.charCodeAt(0));
}

/**
 * Haalt de code uit wat de student scant, opent of plakt: een volledige link
 * (…/student#code=…), alleen het stuk "code=…" of de kale code.
 */
export function haalCodeUitInvoer(invoer: string): string {
  const schoon = invoer.trim();
  const m = /[#&?]code=([A-Za-z0-9_-]+)/.exec(schoon) ?? /^code=([A-Za-z0-9_-]+)$/.exec(schoon);
  return m?.[1] ?? schoon.replace(/\s+/g, '');
}

export function maakLink(basisUrl: string, codeTekst: string): string {
  return `${basisUrl.replace(/#.*$/, '')}#code=${codeTekst}`;
}
