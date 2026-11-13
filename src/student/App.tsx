import { useCallback, useEffect, useState } from 'react';
import { DemoLabel, Melding, Voettekst } from '../gedeeld/onderdelen';
import { Dossier, Huis, Rapport, Scan } from '../gedeeld/iconen';
import type { StudentGegevens } from './gegevens';
import { bewaar, laad } from './opslag';
import { ga, useRoute, type Route } from './route';
import { CodeScherm } from './schermen/Code';
import { DossierScherm } from './schermen/Dossier';
import { OpleidingScherm } from './schermen/Opleiding';
import { RapportScherm } from './schermen/Rapport';
import { StartScherm } from './schermen/Start';
import { VakScherm } from './schermen/Vak';

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
    case 'opleiding':
      return <OpleidingScherm {...p} />;
    case 'vak':
      return <VakScherm {...p} vakId={p.route.vakId} />;
    case 'dossier':
      return <DossierScherm {...p} />;
    case 'code':
      return <CodeScherm {...p} wachtendeCode={p.wachtendeCode} wisWachtendeCode={p.wisWachtendeCode} />;
    case 'rapport':
      return <RapportScherm {...p} wis={p.wis} />;
  }
}

const MENU = [
  { hash: '#/', label: 'Opleiding', schermen: ['opleiding', 'vak'], Icoon: Huis },
  { hash: '#/dossier', label: 'Dossier', schermen: ['dossier'], Icoon: Dossier },
  { hash: '#/code', label: 'Code', schermen: ['code'], Icoon: Scan },
  { hash: '#/rapport', label: 'Rapport', schermen: ['rapport'], Icoon: Rapport },
] as const;

function Omlijsting({ route, children }: { route?: Route; children: React.ReactNode }) {
  return (
    <>
      <a href="#hoofdinhoud" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:p-2 niet-printen">
        Naar de inhoud
      </a>
      <div className="border-b border-stone-300 bg-white">
        <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3 print-breed">
          <span className="font-bold">Studietracker</span>
          <DemoLabel />
        </div>
      </div>
      <main id="hoofdinhoud" className="mx-auto max-w-xl px-4 pt-5 print-breed">
        {children}
      </main>
      <Voettekst />
      {/* Ruimte zodat het vaste menu de voettekst niet afdekt. */}
      {route && <div className="niet-printen h-16 pb-[env(safe-area-inset-bottom)]" aria-hidden="true" />}
      {route && (
        <nav aria-label="Hoofdmenu" className="niet-printen fixed inset-x-0 bottom-0 z-10 border-t border-stone-300 bg-white pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid max-w-xl grid-cols-4">
            {MENU.map(({ hash, label, schermen, Icoon }) => {
              const actief = (schermen as readonly string[]).includes(route.scherm);
              return (
                <li key={hash}>
                  <a
                    href={hash}
                    aria-current={actief ? 'page' : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                      actief ? 'text-stone-950 [&_svg]:stroke-[2.6]' : 'text-stone-600'
                    }`}
                  >
                    <Icoon width={22} height={22} />
                    <span className={actief ? 'underline decoration-2 underline-offset-4' : ''}>{label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </>
  );
}
