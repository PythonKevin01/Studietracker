import { useId, useState, type FormEvent } from 'react';
import { isGeldigStudentnummer, normaliseerStudentnummer } from '../../bewijscode/formaat';
import { curriculum } from '../../gedeeld/curriculum';
import { Kaart, Kop, Melding, hoofdknop } from '../../gedeeld/onderdelen';
import { nieuweGegevens, type StudentGegevens } from '../gegevens';
import { vraagBlijvendeOpslag } from '../opslag';
import { Terugzetten } from './Terugzetten';

export function StartScherm({ wachtendeCode, klaar }: { wachtendeCode: string | null; klaar: (g: StudentGegevens) => Promise<void> }) {
  const [invoer, zetInvoer] = useState('');
  const [fout, zetFout] = useState<string | null>(null);
  const id = useId();
  const nummer = normaliseerStudentnummer(invoer);

  const start = async (e: FormEvent) => {
    e.preventDefault();
    if (!isGeldigStudentnummer(nummer)) {
      zetFout('Vul je studentnummer in: alleen cijfers en letters, maximaal 16 tekens.');
      return;
    }
    await vraagBlijvendeOpslag();
    await klaar(nieuweGegevens(nummer));
  };

  return (
    <>
      <Kop label="Welkom" vraag="Wat is je studentnummer?">
        <p>
          Met deze app houd je zelf bij hoe ver je bent met de opleiding {curriculum.opleiding.naam}. Je studentnummer vul je één
          keer in. Het zorgt ervoor dat codes van je docent alleen voor jou werken.
        </p>
      </Kop>

      {wachtendeCode && (
        <div className="mb-4">
          <Melding soort="let" titel="Je hebt een code van je docent geopend">
            Vul eerst je studentnummer in. Daarna voert de app de code meteen in.
          </Melding>
        </div>
      )}

      <Kaart>
        <form onSubmit={start} noValidate>
          <label htmlFor={id} className="block font-semibold">
            Studentnummer
          </label>
          <p id={`${id}-uitleg`} className="text-sm text-stone-700">
            Dit is een proef: gebruik een verzonnen nummer, bijvoorbeeld D100001.
          </p>
          <input
            id={id}
            value={invoer}
            onChange={(e) => {
              zetInvoer(e.target.value);
              zetFout(null);
            }}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            aria-invalid={fout ? true : undefined}
            aria-describedby={`${id}-uitleg${fout ? ` ${id}-fout` : ''}`}
            className="mt-2 block w-full rounded-xl border-2 border-stone-700 bg-white px-3 py-2.5 text-lg tracking-wider uppercase"
          />
          {fout && (
            <p id={`${id}-fout`} className="mt-2 font-medium text-rose-800">
              {fout}
            </p>
          )}
          <button type="submit" className={`${hoofdknop} mt-4 w-full`}>
            Beginnen
          </button>
        </form>
      </Kaart>

      <Kaart className="mt-4">
        <h2 className="font-semibold">Waar blijven je gegevens?</h2>
        <p className="mt-1 text-sm text-stone-700">
          Alleen op dit apparaat. Er is geen account en geen server. Maak daarom af en toe een back-up via Rapport. Met die back-up
          zet je alles terug op een nieuwe telefoon.
        </p>
        <Terugzetten huidig={null} klaar={klaar} knopTekst="Ik heb al een back-up" />
      </Kaart>
    </>
  );
}
