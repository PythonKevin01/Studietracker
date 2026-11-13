import { useId, useState } from 'react';
import { curriculum, publiekeSleutels } from '../../gedeeld/curriculum';
import { Melding, tweedeKnop } from '../../gedeeld/onderdelen';
import { ExportFout, leesExport, zetTerug, type StudentGegevens, type TerugzetUitkomst } from '../gegevens';

/** Kiest een exportbestand en voegt het samen met wat er op dit apparaat staat. */
export function Terugzetten({
  huidig,
  klaar,
  knopTekst = 'Back-up terugzetten',
}: {
  huidig: StudentGegevens | null;
  klaar: (g: StudentGegevens) => Promise<void>;
  knopTekst?: string;
}) {
  const id = useId();
  const [uitkomst, zetUitkomst] = useState<TerugzetUitkomst | null>(null);
  const [fout, zetFout] = useState<string | null>(null);

  const kies = async (bestand: File | undefined) => {
    zetFout(null);
    zetUitkomst(null);
    if (!bestand) return;
    try {
      const r = await zetTerug(huidig, leesExport(await bestand.text()), { curriculum, publiekeSleutels });
      zetUitkomst(r);
      await klaar(r.gegevens);
    } catch (e) {
      zetFout(e instanceof ExportFout ? e.message : 'Dit bestand kon niet worden gelezen.');
    }
  };

  return (
    <div className="mt-3">
      <label htmlFor={id} className={`${tweedeKnop} w-full cursor-pointer focus-within:outline-3 focus-within:outline-blue-700`}>
        {knopTekst}
        <input id={id} type="file" accept=".json,application/json" className="sr-only" onChange={(e) => void kies(e.target.files?.[0])} />
      </label>
      <div aria-live="polite" className="mt-3 space-y-2">
        {fout && <Melding soort="fout" titel="Terugzetten lukte niet">{fout}</Melding>}
        {uitkomst && (
          <Melding soort={uitkomst.geweigerd.length ? 'let' : 'goed'} titel="Back-up teruggezet">
            {uitkomst.nieuweCodes} nieuwe code(s) toegevoegd, {uitkomst.alAanwezig} stond(en) er al.
            {uitkomst.geweigerd.length > 0 && (
              <>
                {' '}
                {uitkomst.geweigerd.length} code(s) geweigerd:
                <ul className="mt-1 list-disc pl-5">
                  {uitkomst.geweigerd.map((w) => (
                    <li key={w.code}>{w.melding}</li>
                  ))}
                </ul>
              </>
            )}
          </Melding>
        )}
      </div>
    </div>
  );
}
