/** Opslag op het eigen apparaat (IndexedDB). Er gaat niets naar een server. */
import { openDB } from 'idb';
import type { StudentGegevens } from './gegevens';

const db = () =>
  openDB('studietracker', 1, {
    upgrade(d) {
      d.createObjectStore('staat');
    },
  });

export async function laad(): Promise<StudentGegevens | null> {
  return ((await (await db()).get('staat', 'gegevens')) as StudentGegevens | undefined) ?? null;
}

export async function bewaar(g: StudentGegevens): Promise<void> {
  await (await db()).put('staat', g, 'gegevens');
}

export async function wisAlles(): Promise<void> {
  await (await db()).delete('staat', 'gegevens');
}

/** Vraagt de browser de gegevens niet zomaar op te ruimen. Niet elke browser doet mee. */
export async function vraagBlijvendeOpslag(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
