import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import type { Controle } from '../../bewijscode/controleren';
import { curriculum, leesbareDatum, opdrachtOpNr, publiekeSleutels, volledigeOpdrachtNaam } from '../../gedeeld/curriculum';
import { Scan, Zegel } from '../../gedeeld/iconen';
import { Kaart, Kop, Melding, OpdrachtStatusLabel, hoofdknop, tweedeKnop } from '../../gedeeld/onderdelen';
import type { SchermProps } from '../App';
import { ontvangCode } from '../gegevens';
import { Scanner } from './Scanner';

export function CodeScherm({
  gegevens,
  bijwerken,
  wachtendeCode,
  wisWachtendeCode,
}: SchermProps & { wachtendeCode: string | null; wisWachtendeCode: () => void }) {
  const [invoer, zetInvoer] = useState('');
  const [scannen, zetScannen] = useState(false);
  const [uitkomst, zetUitkomst] = useState<Controle | null>(null);
  const [bezig, zetBezig] = useState(false);
  const uitkomstRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const verwerk = async (tekst: string) => {
    zetBezig(true);
    zetScannen(false);
    try {
      const r = await ontvangCode(gegevens, tekst, { curriculum, publiekeSleutels }, new Date());
      if (r.controle.ok) {
        await bijwerken(r.gegevens);
        zetInvoer('');
      }
      zetUitkomst(r.controle);
      requestAnimationFrame(() => uitkomstRef.current?.focus());
    } finally {
      zetBezig(false);
    }
  };

  // Een code die via een link binnenkwam (…/student/#code=…) meteen verwerken.
  useEffect(() => {
    if (!wachtendeCode) return;
    wisWachtendeCode();
    void verwerk(wachtendeCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wachtendeCode]);

  const plakken = (e: FormEvent) => {
    e.preventDefault();
    if (invoer.trim()) void verwerk(invoer);
  };

  return (
    <>
      <Kop label="Code invoeren" vraag="Heb je een code van je docent?">
        <p>
          Een <strong>bewijscode</strong> is een bevestiging van je docent dat je een opdracht hebt gedaan. De docent zet er een
          digitale handtekening onder, zodat niemand hem kan namaken of aanpassen. Je krijgt hem als QR-code, als link of als tekst.
        </p>
      </Kop>

      <div ref={uitkomstRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {uitkomst && <Uitkomst controle={uitkomst} />}
      </div>

      <Kaart className="mt-4">
        <h2 className="font-bold">QR-code scannen</h2>
        {scannen ? (
          <Scanner opCode={(tekst) => void verwerk(tekst)} stop={() => zetScannen(false)} />
        ) : (
          <button type="button" className={`${hoofdknop} mt-3 w-full`} onClick={() => { zetUitkomst(null); zetScannen(true); }}>
            <Scan /> Camera openen
          </button>
        )}
      </Kaart>

      <Kaart className="mt-4">
        <form onSubmit={plakken}>
          <label htmlFor={id} className="font-bold">
            Of plak de code of link
          </label>
          <textarea
            id={id}
            value={invoer}
            onChange={(e) => zetInvoer(e.target.value)}
            rows={3}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            className="mt-2 block w-full rounded-xl border-2 border-stone-700 bg-white p-2 font-mono text-sm break-all"
          />
          <button type="submit" disabled={bezig || !invoer.trim()} className={`${tweedeKnop} mt-3 w-full`}>
            Code invoeren
          </button>
        </form>
      </Kaart>
    </>
  );
}

function Uitkomst({ controle }: { controle: Controle }) {
  if (!controle.ok) {
    return (
      <Melding soort="fout" titel="Deze code is niet ingevoerd">
        {controle.melding}
      </Melding>
    );
  }
  const { inhoud } = controle;
  return (
    <Kaart className="border-2 border-emerald-700">
      <p className="flex items-center gap-2 text-lg font-bold">
        <Zegel width={26} height={26} className="text-emerald-800" /> Code ingevoerd
      </p>
      <p className="text-sm text-stone-700">Ondertekend door je docent op {leesbareDatum(inhoud.datum)}.</p>
      <ul className="mt-3 space-y-3">
        {inhoud.regels.map((r) => {
          const opdracht = opdrachtOpNr.get(r.opdrachtNr)!;
          return (
            <li key={r.opdrachtNr} className="rounded-xl bg-stone-50 p-3">
              <p className="font-medium">{volledigeOpdrachtNaam(opdracht)}</p>
              <div className="mt-2">
                {r.resultaat === 'voldaan' ? (
                  <OpdrachtStatusLabel status="bevestigd" stempel />
                ) : (
                  <Melding soort="let" titel="Nog niet voldaan">
                    Je docent heeft deze opdracht bekeken. Er is nog iets nodig: bespreek met je docent wat.
                  </Melding>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <a href="#/" className="mt-3 inline-flex min-h-11 items-center font-semibold underline">
        Bekijk je voortgang
      </a>
    </Kaart>
  );
}
