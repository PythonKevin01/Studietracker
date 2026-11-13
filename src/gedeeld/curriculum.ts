import ruwCurriculum from 'virtual:curriculum';
import ruweSleutels from 'virtual:publieke-sleutels';
import type { PubliekeSleutel } from '../bewijscode/controleren';
import type { Curriculum, Cursus, Opdracht } from '../curriculum/schema';
import { cursusNaam } from '../rekenregels';

/** Bij de build gecontroleerd tegen het schema (zie vite.config.ts). */
export const curriculum = ruwCurriculum as Curriculum;
export const publiekeSleutels = ruweSleutels as PubliekeSleutel[];

const metCursus = curriculum.cursussen.flatMap((c) => c.opdrachten.map((o) => [o, c] as const));
export const opdrachtOpNr = new Map<number, Opdracht>(metCursus.map(([o]) => [o.nr, o]));
export const opdrachtOpId = new Map<string, Opdracht>(metCursus.map(([o]) => [o.id, o]));
export const cursusVanOpdracht = new Map<string, Cursus>(metCursus.map(([o, c]) => [o.id, c]));
export const leerdoelOpId = new Map(curriculum.leerdoelen.map((l) => [l.id, l]));

/** "Photoshop-01 (periode 1): DEMO-eindopdracht" */
export function volledigeOpdrachtNaam(o: Opdracht): string {
  const c = cursusVanOpdracht.get(o.id);
  return c ? `${cursusNaam(c)}: ${o.titel}` : o.titel;
}

/** "2026-11-13" of een ISO-tijdstip -> "13 november 2026". */
export function leesbareDatum(datum: string): string {
  const d = datum.length === 10 ? new Date(`${datum}T12:00:00Z`) : new Date(datum);
  return d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' });
}

export function vandaag(nu = new Date()): string {
  return nu.toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // JJJJ-MM-DD
}
