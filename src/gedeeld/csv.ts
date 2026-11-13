/**
 * Leest CSV (RFC 4180): velden tussen dubbele aanhalingstekens mogen komma's,
 * puntkomma's, regeleinden en "" bevatten. Het scheidingsteken wordt bepaald
 * uit de eerste regel (komma of puntkomma; Excel in het Nederlands gebruikt ;).
 */
export function leesCsv(tekst: string): string[][] {
  const schoon = tekst.replace(/^﻿/, '');
  const eersteRegel = schoon.split(/\r?\n/, 1)[0] ?? '';
  const scheiding = (eersteRegel.match(/;/g)?.length ?? 0) > (eersteRegel.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rijen: string[][] = [];
  let rij: string[] = [];
  let veld = '';
  let geciteerd = false;
  for (let i = 0; i < schoon.length; i++) {
    const t = schoon[i]!;
    if (geciteerd) {
      if (t === '"' && schoon[i + 1] === '"') {
        veld += '"';
        i++;
      } else if (t === '"') geciteerd = false;
      else veld += t;
    } else if (t === '"') geciteerd = true;
    else if (t === scheiding) {
      rij.push(veld);
      veld = '';
    } else if (t === '\n' || t === '\r') {
      if (t === '\r' && schoon[i + 1] === '\n') i++;
      rij.push(veld);
      rijen.push(rij);
      rij = [];
      veld = '';
    } else veld += t;
  }
  if (veld !== '' || rij.length > 0) {
    rij.push(veld);
    rijen.push(rij);
  }
  return rijen.filter((r) => r.some((v) => v.trim() !== ''));
}

/** Zet rijen om naar CSV met komma's, met aanhalingstekens waar nodig. */
export function schrijfCsv(rijen: readonly (readonly string[])[]): string {
  const veld = (v: string) => (/[",;\r\n]/.test(v) || /^\s|\s$/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return rijen.map((r) => r.map(veld).join(',')).join('\r\n') + '\r\n';
}

/** Rijen met kop -> objecten op kolomnaam (kop zonder hoofdlettergevoeligheid en witruimte). */
export function leesCsvObjecten(tekst: string): Record<string, string>[] {
  const [kop, ...rest] = leesCsv(tekst);
  if (!kop) return [];
  const namen = kop.map((k) => k.trim().toLowerCase());
  return rest.map((r) => Object.fromEntries(namen.map((n, i) => [n, (r[i] ?? '').trim()])));
}
