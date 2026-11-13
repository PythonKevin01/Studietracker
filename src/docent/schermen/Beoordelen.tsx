import QRCode from 'qrcode';
import { useEffect, useId, useState } from 'react';
import type { Resultaat } from '../../bewijscode/formaat';
import { curriculum, vandaag } from '../../gedeeld/curriculum';
import { downloadBestand } from '../../gedeeld/download';
import { DemoLabel, Kaart, Kop, Melding, NiveauLabel, hoofdknop, tweedeKnop } from '../../gedeeld/onderdelen';
import { perioden } from '../../rekenregels';
import type { DocentStaat } from '../App';
import { codesCsv, maakCodes, type Beoordelingen, type StudentCode } from '../codes';

const KEUZE: { waarde: '' | Resultaat; tekst: string }[] = [
  { waarde: '', tekst: '— niet beoordeeld' },
  { waarde: 'voldaan', tekst: 'Voldaan' },
  { waarde: 'niet_voldaan', tekst: 'Nog niet voldaan' },
];

export function BeoordelenScherm({ sleutel, klas, sleutelBekend }: DocentStaat & { sleutelBekend: boolean }) {
  const id = useId();
  const metOpdrachten = curriculum.cursussen.filter((c) => c.opdrachten.length > 0);
  const [cursusId, zetCursusId] = useState(metOpdrachten[0]?.id ?? '');
  const [datum, zetDatum] = useState(vandaag());
  const [beoordelingen, zetBeoordelingen] = useState<Beoordelingen>({});
  const [codes, zetCodes] = useState<StudentCode[] | null>(null);
  const cursus = curriculum.cursussen.find((c) => c.id === cursusId);

  if (!sleutel || klas.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <Kop label="Stap 3 · Beoordelen" vraag="Wie heeft welke opdracht voldaan?" />
        <Melding soort="let" titel="Eerst nog iets nodig">
          <ul className="list-disc pl-5">
            {!sleutel && <li><a href="#/sleutel" className="font-semibold underline">Ontgrendel je sleutel</a> (stap 1).</li>}
            {klas.length === 0 && <li><a href="#/klas" className="font-semibold underline">Laad een klaslijst</a> (stap 2).</li>}
          </ul>
        </Melding>
      </div>
    );
  }

  const zet = (nummer: string, opdrachtId: string, waarde: '' | Resultaat) => {
    zetCodes(null);
    zetBeoordelingen((b) => {
      const rij = { ...(b[nummer] ?? {}) };
      if (waarde) rij[opdrachtId] = waarde;
      else delete rij[opdrachtId];
      return { ...b, [nummer]: rij };
    });
  };
  const iedereen = (opdrachtId: string) => klas.forEach((s) => zet(s.studentnummer, opdrachtId, 'voldaan'));
  const aantalBeoordeeld = klas.filter((s) => cursus?.opdrachten.some((o) => beoordelingen[s.studentnummer]?.[o.id])).length;

  const maak = async () => {
    if (!cursus) return;
    zetCodes(
      await maakCodes({
        curriculum,
        cursusId: cursus.id,
        studenten: klas,
        beoordelingen,
        datum,
        sleutel,
        basisUrl: new URL('../student/', location.href).href,
      }),
    );
  };

  return (
    <div>
      <div className="niet-printen">
        <Kop label="Stap 3 · Beoordelen" vraag="Wie heeft welke opdracht voldaan?">
          <p>
            Kies een cursus en vul per student in wat je beoordeeld hebt. Elke student krijgt één code met al zijn resultaten voor
            deze cursus, als QR-code op een printvel en als link in een CSV-bestand.
          </p>
        </Kop>
        {!sleutelBekend && (
          <div className="mb-4">
            <Melding soort="let" titel={`De studentenapp kent sleutel ${sleutel.sleutelnummer} nog niet`}>
              Je kunt codes maken, maar studenten zien ze als ongeldig tot de publieke sleutel in de app staat.
            </Melding>
          </div>
        )}

        <Kaart>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
            <div>
              <label htmlFor={`${id}-c`} className="font-semibold">Cursus</label>
              <select
                id={`${id}-c`}
                value={cursusId}
                onChange={(e) => {
                  zetCursusId(e.target.value);
                  zetCodes(null);
                }}
                className="mt-1 block w-full rounded-xl border-2 border-stone-700 bg-white px-3 py-2"
              >
                {perioden(curriculum).map((p) => (
                  <optgroup key={p.periode} label={`Jaar ${p.jaar}, periode ${p.periode}`}>
                    {metOpdrachten.filter((c) => c.periode === p.periode).map((c) => (
                      <option key={c.id} value={c.id}>{c.titel}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={`${id}-d`} className="font-semibold">Datum van beoordelen</label>
              <input id={`${id}-d`} type="date" value={datum} onChange={(e) => zetDatum(e.target.value)} className="mt-1 block w-full rounded-xl border-2 border-stone-700 bg-white px-3 py-2" />
            </div>
          </div>
        </Kaart>

        {cursus && (
          <Kaart className="mt-4">
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={`Beoordelingen ${cursus.titel}`}>
              <table className="w-full border-collapse text-sm">
                <caption className="pb-2 text-left text-lg font-bold">
                  {cursus.titel} <span className="font-normal text-stone-700">· leerdoelen {cursus.leerdoelen.join(', ')}</span>
                </caption>
                <thead>
                  <tr className="text-left align-bottom">
                    <th scope="col" className="border-b-2 border-stone-300 py-2 pr-3">Student</th>
                    {cursus.opdrachten.map((o) => (
                      <th key={o.id} scope="col" className="border-b-2 border-stone-300 px-2 py-2">
                        <span className="flex items-center gap-1.5">
                          <NiveauLabel niveau={o.leerdoelen[0]!.niveau} /> {o.titel}
                        </span>
                        <button type="button" onClick={() => iedereen(o.id)} className="mt-1 min-h-9 text-xs font-semibold text-blue-800 underline">
                          Iedereen voldaan<span className="sr-only"> voor {o.titel}</span>
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {klas.map((s) => (
                    <tr key={s.studentnummer}>
                      <th scope="row" className="border-b border-stone-200 py-2 pr-3 text-left font-normal">
                        <span className="font-semibold">{s.naam}</span> <span className="font-mono text-stone-600">{s.studentnummer}</span>
                      </th>
                      {cursus.opdrachten.map((o) => {
                        const waarde = beoordelingen[s.studentnummer]?.[o.id] ?? '';
                        return (
                          <td key={o.id} className="border-b border-stone-200 px-2 py-1.5">
                            <select
                              aria-label={`${o.titel} voor ${s.naam}`}
                              value={waarde}
                              onChange={(e) => zet(s.studentnummer, o.id, e.target.value as '' | Resultaat)}
                              className={`min-h-10 w-full rounded-lg border-2 px-2 ${
                                waarde === 'voldaan' ? 'border-emerald-700 bg-emerald-50' : waarde === 'niet_voldaan' ? 'border-amber-700 bg-amber-50' : 'border-stone-400 bg-white'
                              }`}
                            >
                              {KEUZE.map((k) => <option key={k.waarde} value={k.waarde}>{k.tekst}</option>)}
                            </select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={aantalBeoordeeld === 0} onClick={() => void maak()} className={hoofdknop}>
                Codes maken voor {aantalBeoordeeld} student(en)
              </button>
              <span className="text-sm text-stone-700">Studenten zonder beoordeling krijgen geen code.</span>
            </div>
          </Kaart>
        )}
      </div>

      {codes && cursus && <Uitvoer codes={codes} cursusTitel={cursus.titel} cursusId={cursus.id} datum={datum} />}
    </div>
  );
}

function Uitvoer({ codes, cursusTitel, cursusId, datum }: { codes: StudentCode[]; cursusTitel: string; cursusId: string; datum: string }) {
  return (
    <section aria-labelledby="uitvoer" className="mt-6">
      <div className="niet-printen flex flex-wrap items-center gap-3">
        <h2 id="uitvoer" className="text-xl font-bold">{codes.length} code(s) gemaakt</h2>
        <button type="button" className={hoofdknop} onClick={() => print()}>Printvel afdrukken</button>
        <button type="button" className={tweedeKnop} onClick={() => downloadBestand(`codes-${cursusId}-${datum}.csv`, codesCsv(codes, cursusTitel), 'text/csv')}>
          CSV met links downloaden
        </button>
      </div>
      <p className="niet-printen mt-1 text-sm text-stone-700">
        Studenten scannen hun QR-code met de camera van hun telefoon of in de app (Code invoeren). Elke code werkt alleen voor die ene student.
      </p>
      <ul className="printvel mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-0">
        {codes.map((c) => (
          <li key={c.student.studentnummer}>
            <CodeKaart code={c} cursusTitel={cursusTitel} datum={datum} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function CodeKaart({ code: c, cursusTitel, datum }: { code: StudentCode; cursusTitel: string; datum: string }) {
  const [svg, zetSvg] = useState('');
  useEffect(() => {
    void QRCode.toString(c.link, { type: 'svg', errorCorrectionLevel: 'M', margin: 1 }).then(zetSvg);
  }, [c.link]);
  return (
    <article className="kaart flex h-full gap-4 rounded-2xl border border-stone-300 bg-white p-4 print:rounded-none print:border-dashed">
      <div className="w-36 shrink-0" role="img" aria-label={`QR-code voor ${c.student.naam}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="min-w-0 text-sm">
        <p className="text-base font-bold">{c.student.naam}</p>
        <p className="font-mono">{c.student.studentnummer}</p>
        <p className="mt-1">{cursusTitel} · {datum}</p>
        <ul className="mt-1 space-y-0.5">
          {c.regels.map((r) => (
            <li key={r.opdrachtId}>
              {r.titel.replace(/^DEMO-/, '')}: <strong>{r.resultaat === 'voldaan' ? 'voldaan' : 'nog niet voldaan'}</strong>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-stone-700">Scan met de camera van je telefoon, of in de app bij Code invoeren.</p>
        <p className="mt-1"><DemoLabel /></p>
        <details className="niet-printen mt-1">
          <summary className="cursor-pointer text-blue-800 underline">Link</summary>
          <code className="mt-1 block text-xs break-all">{c.link}</code>
        </details>
      </div>
    </article>
  );
}
