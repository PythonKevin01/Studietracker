import { useId, useState } from 'react';
import { curriculum, publiekeSleutels, vandaag } from '../../gedeeld/curriculum';
import { downloadBestand } from '../../gedeeld/download';
import { Kaart, Kop, Melding, hoofdknop } from '../../gedeeld/onderdelen';
import type { DocentStaat } from '../App';
import { klasoverzicht, leesRapporten, overzichtCsv, type Inleesresultaat } from '../rapporten';

export function RapportenScherm({ klas }: DocentStaat) {
  const id = useId();
  const [resultaat, zetResultaat] = useState<Inleesresultaat | null>(null);
  const [bezig, zetBezig] = useState(false);

  const lees = async (lijst: FileList | null) => {
    if (!lijst?.length) return;
    zetBezig(true);
    const bestanden = await Promise.all([...lijst].map(async (f) => ({ naam: f.name, tekst: await f.text() })));
    zetResultaat(await leesRapporten(bestanden, { curriculum, publiekeSleutels }));
    zetBezig(false);
  };

  const rijen = resultaat ? klasoverzicht(resultaat.rapporten, klas, curriculum) : [];
  const metWeigering = resultaat?.rapporten.filter((r) => r.geweigerd.length > 0) ?? [];
  const cel = 'border-b border-stone-200 px-2 py-2 text-left';

  return (
    <div className="mx-auto max-w-6xl">
      <Kop label="Stap 4 · Rapporten" vraag="Hoe staat de klas ervoor?">
        <p>
          Lees de exportbestanden van studenten in. Elke code wordt opnieuw gecontroleerd: aangepaste of nagemaakte codes tellen
          niet mee. Zelf gemelde opdrachten zijn niet gecontroleerd en staan apart. Laad de klaslijst (stap 2) om namen te zien.
        </p>
      </Kop>

      <Kaart>
        <label htmlFor={id} className="font-bold">Exportbestanden van studenten (meerdere tegelijk)</label>
        <input id={id} type="file" multiple accept=".json,application/json" className="mt-2 block w-full text-sm" onChange={(e) => void lees(e.target.files)} />
        {bezig && <p className="mt-2 text-sm">Bezig met controleren…</p>}
      </Kaart>

      {resultaat && (
        <div className="mt-6 space-y-4" aria-live="polite">
          {resultaat.onleesbaar.length > 0 && (
            <Melding soort="fout" titel={`${resultaat.onleesbaar.length} bestand(en) niet gelezen`}>
              <ul className="list-disc pl-5">
                {resultaat.onleesbaar.map((o) => <li key={o.bestand}>{o.bestand}: {o.melding}</li>)}
              </ul>
            </Melding>
          )}
          {metWeigering.length > 0 && (
            <Melding soort="let" titel={`In ${metWeigering.length} rapport(en) staan codes die niet kloppen`}>
              <ul className="list-disc pl-5">
                {metWeigering.map((r) => (
                  <li key={r.studentnummer}>
                    {r.studentnummer}: {r.geweigerd.length} code(s) geweigerd ({[...new Set(r.geweigerd.map((w) => w.melding))].join(' ')})
                  </li>
                ))}
              </ul>
            </Melding>
          )}

          <Kaart>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Klasoverzicht: {rijen.length} student(en)</h2>
              <button type="button" className={hoofdknop} disabled={rijen.length === 0} onClick={() => downloadBestand(`klasoverzicht-${vandaag()}.csv`, overzichtCsv(rijen, curriculum), 'text/csv')}>
                Klasoverzicht als CSV
              </button>
            </div>
            <div className="mt-3 overflow-x-auto" tabIndex={0} role="region" aria-label="Klasoverzicht">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    {['Student', 'Leerdoelen behaald', 'Versterkt', 'Opdrachten bevestigd', 'Zelf gemeld (niet gecontroleerd)', 'Geldige codes', 'Geweigerde codes'].map((k) => (
                      <th key={k} scope="col" className={`${cel} border-b-2 border-stone-300 align-bottom`}>{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rijen.map((r) => (
                    <tr key={r.studentnummer}>
                      <th scope="row" className={`${cel} font-normal`}>
                        <span className="font-semibold">{r.naam || '(niet in klaslijst)'}</span> <span className="font-mono text-stone-600">{r.studentnummer}</span>
                      </th>
                      <td className={`${cel} tabular-nums`}>{r.leerdoelenBehaald} / {curriculum.leerdoelen.length}</td>
                      <td className={`${cel} tabular-nums`}>{r.versterkt}</td>
                      <td className={`${cel} tabular-nums`}>{r.bevestigd}</td>
                      <td className={`${cel} tabular-nums`}>{r.zelfGemeld}</td>
                      <td className={`${cel} tabular-nums`}>{r.geldigeCodes}</td>
                      <td className={`${cel} tabular-nums ${r.geweigerdeCodes ? 'font-bold text-rose-800' : ''}`}>{r.geweigerdeCodes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Kaart>
        </div>
      )}
    </div>
  );
}
