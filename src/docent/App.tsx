/**
 * Docentpagina. Alles staat alleen in het geheugen van deze browser: de
 * ontgrendelde sleutel en de klaslijst zijn weg zodra je de pagina sluit.
 */
import { useEffect, useState } from 'react';
import type { OntgrendeldeSleutel } from '../bewijscode/sleutelbestand';
import { publiekeSleutels } from '../gedeeld/curriculum';
import { Voettekst } from '../gedeeld/onderdelen';
import { BeoordelenScherm } from './schermen/Beoordelen';
import { KlasScherm } from './schermen/Klas';
import { RapportenScherm } from './schermen/Rapporten';
import { SleutelScherm } from './schermen/Sleutel';
import type { Student } from './klaslijst';

export type DocentRoute = 'sleutel' | 'klas' | 'beoordelen' | 'rapporten';

function leesRoute(): DocentRoute {
  const r = location.hash.replace(/^#\/?/, '');
  return r === 'klas' || r === 'beoordelen' || r === 'rapporten' ? r : 'sleutel';
}

export interface DocentStaat {
  sleutel: OntgrendeldeSleutel | null;
  zetSleutel: (s: OntgrendeldeSleutel | null) => void;
  klas: Student[];
  zetKlas: (k: Student[]) => void;
}

export function DocentApp() {
  const [route, zetRoute] = useState<DocentRoute>(leesRoute);
  const [sleutel, zetSleutel] = useState<OntgrendeldeSleutel | null>(null);
  const [klas, zetKlas] = useState<Student[]>([]);

  useEffect(() => {
    const bij = () => zetRoute(leesRoute());
    addEventListener('hashchange', bij);
    return () => removeEventListener('hashchange', bij);
  }, []);

  // Waarschuwen bij weggaan: de klaslijst en de ontgrendelde sleutel gaan verloren.
  useEffect(() => {
    if (!sleutel && klas.length === 0) return;
    const waarschuw = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener('beforeunload', waarschuw);
    return () => removeEventListener('beforeunload', waarschuw);
  }, [sleutel, klas]);

  const staat: DocentStaat = { sleutel, zetSleutel, klas, zetKlas };
  const sleutelBekend = sleutel ? publiekeSleutels.some((s) => s.nummer === sleutel.sleutelnummer && s.sleutel === sleutel.publiekeSleutel) : false;

  const stappen: { route: DocentRoute; label: string; status: string }[] = [
    { route: 'sleutel', label: '1. Sleutel', status: sleutel ? `nr. ${sleutel.sleutelnummer} ontgrendeld` : 'vergrendeld' },
    { route: 'klas', label: '2. Klas', status: klas.length ? `${klas.length} studenten` : 'geen klaslijst' },
    { route: 'beoordelen', label: '3. Beoordelen', status: 'codes maken' },
    { route: 'rapporten', label: '4. Rapporten', status: 'inlezen' },
  ];

  return (
    <>
      <a href="#hoofdinhoud" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-2">
        Naar de inhoud
      </a>
      <header className="niet-printen bg-[#1e1b2e] text-white">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-2.5 lg:px-6">
          <span className="text-lg font-bold">Studietracker · docent</span>
          <span className="rounded-md border-2 border-dashed border-rose-300 px-1.5 text-xs font-extrabold tracking-widest text-rose-200">DEMO</span>
          <nav aria-label="Stappen" className="w-full md:ml-auto md:w-auto">
            <ul className="grid grid-cols-2 gap-1 sm:grid-cols-4 md:flex">
              {stappen.map((s) => (
                <li key={s.route}>
                  <a
                    href={`#/${s.route}`}
                    aria-current={route === s.route ? 'page' : undefined}
                    className={`flex min-h-11 flex-col justify-center rounded-lg px-3 py-1 text-sm leading-tight ${route === s.route ? 'bg-[#2b2740] text-white' : 'text-stone-200 hover:bg-[#2b2740]'}`}
                  >
                    <span className="font-semibold">{s.label}</span>
                    <span className="text-xs text-stone-300">{s.status}</span>
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      <main id="hoofdinhoud" className="mx-auto w-full max-w-[1500px] px-4 pt-6 lg:px-6 print:p-0">
        {route === 'sleutel' && <SleutelScherm {...staat} sleutelBekend={sleutelBekend} />}
        {route === 'klas' && <KlasScherm {...staat} />}
        {route === 'beoordelen' && <BeoordelenScherm {...staat} sleutelBekend={sleutelBekend} />}
        {route === 'rapporten' && <RapportenScherm {...staat} />}
      </main>
      <div className="niet-printen">
        <Voettekst />
      </div>
    </>
  );
}
