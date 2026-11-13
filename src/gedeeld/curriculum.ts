import ruwCurriculum from 'virtual:curriculum';
import ruweSleutels from 'virtual:publieke-sleutels';
import type { PubliekeSleutel } from '../bewijscode/controleren';
import { alleOpdrachten, type Curriculum } from '../curriculum/schema';

/** Bij de build gecontroleerd tegen het schema (zie vite.config.ts). */
export const curriculum = ruwCurriculum as Curriculum;
export const publiekeSleutels = ruweSleutels as PubliekeSleutel[];

export const opdrachtOpNr = new Map(alleOpdrachten(curriculum).map((o) => [o.nr, o]));
export const opdrachtOpId = new Map(alleOpdrachten(curriculum).map((o) => [o.id, o]));

/** "2026-11-13" of een ISO-tijdstip -> "13 november 2026". */
export function leesbareDatum(datum: string): string {
  const d = datum.length === 10 ? new Date(`${datum}T12:00:00Z`) : new Date(datum);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}

export function vandaag(nu = new Date()): string {
  return nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // JJJJ-MM-DD
}
