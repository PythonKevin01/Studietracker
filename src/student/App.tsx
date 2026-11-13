import { useCallback, useEffect, useState } from 'react';
import { Melding, Voettekst } from '../gedeeld/onderdelen';
import { Dossier, Huis, Rapport, Scan } from '../gedeeld/iconen';
import type { StudentGegevens } from './gegevens';
import { bewaar, laad } from './opslag';
import { ga, useRoute, type Route } from './route';
import { CodeScherm } from './schermen/Code';
import { CursussenScherm } from './schermen/Cursussen';
import { OverzichtScherm } from './schermen/Overzicht';
import { RapportScherm } from './schermen/Rapport';
import { StartScherm } from './schermen/Start';
import { CursusScherm } from './schermen/Cursus';

export interface SchermProps {
  gegevens: StudentGegevens;
  bijwerken: (g: StudentGegevens) => Promise<void>;
}

export function App() {
  // undefined = nog aan het laden, null = nog geen studentnummer op dit apparaat.
  const [gegevens, zetGegevens] = useState<StudentGegevens | null | undefined>(undefined);
  const [opslagFout, zetOpslagFout] = useState(false);
  const [wachtendeCode, zetWachtendeCode] = useState<string | null>(null);
  const route = useRoute(useCallback((code: string) => zetWachtendeCode(code), []));

  useEffect(() => {
    laad()
      .then(zetGegevens)
      .catch(() => zetOpslagFout(true));
  }, []);

  // Eerst het scherm bijwerken, dan bewaren: zo reageert een vinkje direct.
  const bijwerken = useCallback(async (g: StudentGegevens | null) => {
    zetGegevens(g);
    if (g) await bewaar(g).catch(() => zetOpslagFout(true));
  }, []);

  if (opslagFout) {
    return (
      <Omlijsting>
        <Melding soort="fout" titel="Deze browser kan geen gegevens bewaren">
          Open de app in een gewoon venster (niet privé of incognito) of in een andere browser.
        </Melding>
      </Omlijsting>
    );
  }
  if (gegevens === undefined) return <Omlijsting>{null}</Omlijsting>;
  if (gegevens === null) {
    return (
      <Omlijsting>
        <StartScherm
          wachtendeCode={wachtendeCode}
          klaar={async (g) => {
            await bijwerken(g);
            ga(wachtendeCode ? '#/code' : '#/');
          }}
        />
      </Omlijsting>
    );
  }

  return (
    <Omlijsting route={route}>
      <Scherm
        route={route}
        gegevens={gegevens}
        bijwerken={bijwerken}
        wis={() => bijwerken(null)}
        wachtendeCode={wachtendeCode}
        wisWachtendeCode={() => zetWachtendeCode(null)}
      />
    </Omlijsting>
  );
}

function Scherm(p: SchermProps & { route: Route; wis: () => Promise<void>; wachtendeCode: string | null; wisWachtendeCode: () => void }) {
  switch (p.route.scherm) {
    case 'overzicht':
      return <OverzichtScherm {...p} />;
    case 'cursussen':
      return <CursussenScherm {...p} />;
    case 'cursus':
      return <CursusScherm {...p} cursusId={p.route.cursusId} />;
    case 'code':
      return <CodeScherm {...p} wachtendeCode={p.wachtendeCode} wisWachtendeCode={p.wisWachtendeCode} />;
    case 'rapport':
      return <RapportScherm {...p} wis={p.wis} />;
  }
}

const MENU = [
  { hash: '#/', label: 'Overzicht', schermen: ['overzicht'], Icoon: Huis },
  { hash: '#/cursussen', label: 'Cursussen', schermen: ['cursussen', 'cursus'], Icoon: Dossier },
  { hash: '#/code', label: 'Code invoeren', schermen: ['code'], Icoon: Scan },
  { hash: '#/rapport', label: 'Rapport', schermen: ['rapport'], Icoon: Rapport },
] as const;

/**
 * Schil: donkere balk met het menu bovenaan op laptops; op telefoons staat
 * het menu onderaan in beeld. De inhoud mag de volle breedte gebruiken.
 */
function Omlijsting({ route, children }: { route?: Route; children: React.ReactNode }) {
  return (
    <>
      <a href="#hoofdinhoud" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-2 niet-printen">
        Naar de inhoud
      </a>
      <header className="bg-[#1e1b2e] text-white print:bg-white print:text-black">
        <div className="mx-auto flex max-w-[1680px] items-center gap-3 px-4 py-2.5 lg:px-6">
          <span className="text-lg font-bold">Studietracker</span>
          <span className="rounded-md border-2 border-dashed border-rose-300 px-1.5 text-xs font-extrabold tracking-widest text-rose-200 print:border-rose-800 print:text-rose-800">
            DEMO
          </span>
          {route && (
            <nav
              aria-label="Hoofdmenu"
              className="niet-printen fixed inset-x-0 bottom-0 z-20 border-t border-stone-300 bg-white pb-[env(safe-area-inset-bottom)] md:static md:ml-auto md:border-0 md:bg-transparent md:pb-0"
            >
              <ul className="grid grid-cols-4 md:flex md:gap-1">
                {MENU.map(({ hash, label, schermen, Icoon }) => {
                  const actief = (schermen as readonly string[]).includes(route.scherm);
                  return (
                    <li key={hash}>
                      <a
                        href={hash}
                        aria-current={actief ? 'page' : undefined}
                        className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold md:min-h-10 md:flex-row md:gap-2 md:rounded-lg md:px-3 md:text-[15px] ${
                          actief
                            ? 'text-stone-950 md:bg-[#2b2740] md:text-white [&_svg]:stroke-[2.6]'
                            : 'text-stone-600 md:text-stone-200 md:hover:bg-[#2b2740]'
                        }`}
                      >
                        <Icoon width={22} height={22} className="md:hidden" />
                        <span className={actief ? 'underline decoration-2 underline-offset-4 md:no-underline' : ''}>{label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
        </div>
      </header>
      <main id="hoofdinhoud" className="mx-auto w-full max-w-[1680px] px-4 pt-5 lg:px-6 print:px-0">
        {children}
      </main>
      <Voettekst />
      {/* Ruimte zodat het vaste menu op telefoons de voettekst niet afdekt. */}
      {route && <div className="niet-printen h-16 pb-[env(safe-area-inset-bottom)] md:hidden" aria-hidden="true" />}
    </>
  );
}
