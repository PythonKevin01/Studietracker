import { useId, useState } from 'react';
import { downloadBestand } from '../../gedeeld/download';
import { Kaart, Kop, Melding, tweedeKnop } from '../../gedeeld/onderdelen';
import type { DocentStaat } from '../App';
import { leesKlaslijst, voorbeeldKlaslijst } from '../klaslijst';

export function KlasScherm({ klas, zetKlas }: DocentStaat) {
  const id = useId();
  const [fouten, zetFouten] = useState<string[]>([]);

  const lees = (tekst: string) => {
    const k = leesKlaslijst(tekst);
    zetFouten(k.fouten);
    if (k.studenten.length) zetKlas(k.studenten);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <Kop label="Stap 2 · Klas" vraag="Voor welke studenten maak je codes?">
        <p>
          Laad een CSV-bestand met de kolommen <strong>studentnummer</strong> en <strong>naam</strong>. Excel mag met puntkomma's
          opslaan. De klaslijst blijft alleen in het geheugen van deze browser en verdwijnt als je de pagina sluit.
        </p>
      </Kop>

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Kaart>
          <label htmlFor={id} className="font-bold">Klaslijst (CSV)</label>
          <input id={id} type="file" accept=".csv,text/csv" className="mt-2 block w-full text-sm" onChange={(e) => void e.target.files?.[0]?.text().then(lees)} />
          <p className="mt-4 text-sm text-stone-700">Even proberen? Gebruik een lijst met verzonnen studenten.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={tweedeKnop} onClick={() => lees(voorbeeldKlaslijst())}>Voorbeeldklas gebruiken</button>
            <button type="button" className={tweedeKnop} onClick={() => downloadBestand('voorbeeld-klaslijst.csv', voorbeeldKlaslijst(), 'text/csv')}>
              Voorbeeld-CSV downloaden
            </button>
          </div>
        </Kaart>

        <div className="space-y-4" aria-live="polite">
          {fouten.length > 0 && (
            <Melding soort="let" titel={`${fouten.length} regel(s) overgeslagen`}>
              <ul className="list-disc pl-5">
                {fouten.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </Melding>
          )}
          <Kaart>
            <h2 className="font-bold">{klas.length ? `${klas.length} studenten geladen` : 'Nog geen klaslijst'}</h2>
            {klas.length > 0 && (
              <>
                <table className="mt-2 w-full border-collapse text-sm">
                  <thead>
                    <tr className="text-left">
                      <th scope="col" className="border-b border-stone-300 py-1.5">Studentnummer</th>
                      <th scope="col" className="border-b border-stone-300 py-1.5">Naam</th>
                    </tr>
                  </thead>
                  <tbody>
                    {klas.map((s) => (
                      <tr key={s.studentnummer}>
                        <td className="border-b border-stone-200 py-1.5 font-mono">{s.studentnummer}</td>
                        <td className="border-b border-stone-200 py-1.5">{s.naam}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <a href="#/beoordelen" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">Verder naar stap 3: beoordelen</a>
              </>
            )}
          </Kaart>
        </div>
      </div>
    </div>
  );
}
