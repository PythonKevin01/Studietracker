import { useId, useState, type FormEvent } from 'react';
import { maakSleutelpaar } from '../../bewijscode/ondertekenen';
import { keurWachtwoordzin, ontgrendelSleutel, SleutelFout, versleutelSleutel } from '../../bewijscode/sleutelbestand';
import { publiekeSleutels } from '../../gedeeld/curriculum';
import { downloadBestand } from '../../gedeeld/download';
import { Kaart, Kop, Melding, hoofdknop, tweedeKnop } from '../../gedeeld/onderdelen';
import type { DocentStaat } from '../App';

const invoer = 'mt-1 block w-full rounded-xl border-2 border-stone-700 bg-white px-3 py-2';

export function SleutelScherm({ sleutel, zetSleutel, sleutelBekend }: DocentStaat & { sleutelBekend: boolean }) {
  const [nieuw, zetNieuw] = useState<{ nummer: number; publiek: string } | null>(null);
  return (
    <div className="mx-auto max-w-5xl">
      <Kop label="Stap 1 · Sleutel" vraag="Met welke sleutel onderteken je codes?">
        <p>
          Je <strong>privésleutel</strong> zet een digitale handtekening onder elke code. Studenten kunnen die handtekening
          controleren, maar niet namaken. De sleutel staat versleuteld in een bestand op jouw computer en wordt alleen voor deze
          sessie ontgrendeld. Hij gaat nooit naar een server.
        </p>
      </Kop>

      {sleutel && (
        <div className="mb-6 space-y-3" aria-live="polite">
          <Melding soort="goed" titel={`Sleutel ${sleutel.sleutelnummer} is ontgrendeld voor deze sessie`}>
            Ga verder met <a href="#/klas" className="font-semibold underline">stap 2: klaslijst</a>.{' '}
            <button type="button" className="font-semibold underline" onClick={() => zetSleutel(null)}>
              Vergrendelen
            </button>
          </Melding>
          {!sleutelBekend && (
            <Melding soort="let" titel="De studentenapp kent deze sleutel nog niet">
              Codes met sleutel {sleutel.sleutelnummer} worden geweigerd tot de publieke sleutel in de app staat en de app opnieuw is
              gepubliceerd. Zie hieronder hoe.
            </Melding>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Openen zetSleutel={zetSleutel} />
        <Maken
          klaar={(s, publiek) => {
            zetSleutel(s);
            zetNieuw({ nummer: s.sleutelnummer, publiek });
          }}
        />
      </div>

      {nieuw && <PubliekeSleutelUitleg nummer={nieuw.nummer} publiek={nieuw.publiek} />}

      <Kaart className="mt-6">
        <h2 className="font-bold">Sleutels die de studentenapp nu kent</h2>
        {publiekeSleutels.length === 0 ? (
          <p className="mt-1 text-sm text-stone-700">Geen. Maak een sleutel en zet de publieke sleutel in de app.</p>
        ) : (
          <ul className="mt-1 text-sm">
            {publiekeSleutels.map((s) => (
              <li key={s.nummer}>
                Nummer {s.nummer}: <code className="break-all">{s.sleutel.slice(0, 16)}…</code>
              </li>
            ))}
          </ul>
        )}
      </Kaart>
    </div>
  );
}

function Openen({ zetSleutel }: Pick<DocentStaat, 'zetSleutel'>) {
  const id = useId();
  const [bestand, zetBestand] = useState<File | null>(null);
  const [zin, zetZin] = useState('');
  const [fout, zetFout] = useState<string | null>(null);
  const [bezig, zetBezig] = useState(false);

  const open = async (e: FormEvent) => {
    e.preventDefault();
    if (!bestand) return zetFout('Kies eerst je sleutelbestand.');
    zetBezig(true);
    zetFout(null);
    try {
      zetSleutel(await ontgrendelSleutel(JSON.parse(await bestand.text()), zin));
      zetZin('');
    } catch (err) {
      zetFout(err instanceof SleutelFout ? err.message : 'Dit bestand kon niet worden gelezen.');
    } finally {
      zetBezig(false);
    }
  };

  return (
    <Kaart>
      <h2 className="text-lg font-bold">Ik heb al een sleutelbestand</h2>
      <form onSubmit={open} className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${id}-b`} className="font-semibold">Sleutelbestand</label>
          <input id={`${id}-b`} type="file" accept=".json,application/json" onChange={(e) => zetBestand(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
        </div>
        <div>
          <label htmlFor={`${id}-z`} className="font-semibold">Wachtwoordzin</label>
          <input id={`${id}-z`} type="password" autoComplete="current-password" value={zin} onChange={(e) => zetZin(e.target.value)} className={invoer} />
        </div>
        {fout && <p className="font-medium text-rose-800" role="alert">{fout}</p>}
        <button type="submit" disabled={bezig} className={`${hoofdknop} w-full`}>
          {bezig ? 'Bezig met ontgrendelen…' : 'Ontgrendelen'}
        </button>
      </form>
    </Kaart>
  );
}

function Maken({ klaar }: { klaar: (s: { sleutelnummer: number; publiekeSleutel: string; priveSleutel: Uint8Array }, publiek: string) => void }) {
  const id = useId();
  const vrij = Math.max(0, ...publiekeSleutels.map((s) => s.nummer).filter((n) => n < 200)) + 1;
  const [nummer, zetNummer] = useState(vrij);
  const [zin, zetZin] = useState('');
  const [nogEens, zetNogEens] = useState('');
  const [fout, zetFout] = useState<string | null>(null);
  const [bezig, zetBezig] = useState(false);

  const maak = async (e: FormEvent) => {
    e.preventDefault();
    const keuring = keurWachtwoordzin(zin);
    if (keuring) return zetFout(keuring);
    if (zin !== nogEens) return zetFout('De twee wachtwoordzinnen zijn niet gelijk.');
    if (!Number.isInteger(nummer) || nummer < 1 || nummer > 199) return zetFout('Kies een sleutelnummer van 1 tot en met 199.');
    if (publiekeSleutels.some((s) => s.nummer === nummer)) return zetFout(`Sleutelnummer ${nummer} is al in gebruik.`);
    zetBezig(true);
    zetFout(null);
    try {
      const paar = await maakSleutelpaar();
      const bestand = await versleutelSleutel(paar.priveSleutel, nummer, zin);
      downloadBestand(`docent-${nummer}.sleutel.json`, JSON.stringify(bestand, null, 2), 'application/json');
      klaar({ sleutelnummer: nummer, publiekeSleutel: bestand.publiekeSleutel, priveSleutel: paar.priveSleutel }, bestand.publiekeSleutel);
      zetZin('');
      zetNogEens('');
    } finally {
      zetBezig(false);
    }
  };

  return (
    <Kaart>
      <h2 className="text-lg font-bold">Nieuwe sleutel maken</h2>
      <form onSubmit={maak} className="mt-3 space-y-3">
        <div>
          <label htmlFor={`${id}-n`} className="font-semibold">Sleutelnummer</label>
          <input id={`${id}-n`} type="number" min={1} max={199} value={nummer} onChange={(e) => zetNummer(Number(e.target.value))} className={invoer} />
        </div>
        <div>
          <label htmlFor={`${id}-z`} className="font-semibold">Wachtwoordzin</label>
          <p id={`${id}-zu`} className="text-sm text-stone-700">Minstens 16 tekens, bijvoorbeeld vier losse woorden. Kwijt = sleutel onbruikbaar.</p>
          <input id={`${id}-z`} type="password" autoComplete="new-password" aria-describedby={`${id}-zu`} value={zin} onChange={(e) => zetZin(e.target.value)} className={invoer} />
        </div>
        <div>
          <label htmlFor={`${id}-z2`} className="font-semibold">Wachtwoordzin nog een keer</label>
          <input id={`${id}-z2`} type="password" autoComplete="new-password" value={nogEens} onChange={(e) => zetNogEens(e.target.value)} className={invoer} />
        </div>
        {fout && <p className="font-medium text-rose-800" role="alert">{fout}</p>}
        <button type="submit" disabled={bezig} className={`${tweedeKnop} w-full`}>
          {bezig ? 'Bezig met maken…' : 'Sleutel maken en sleutelbestand opslaan'}
        </button>
      </form>
    </Kaart>
  );
}

function PubliekeSleutelUitleg({ nummer, publiek }: { nummer: number; publiek: string }) {
  const regel = JSON.stringify({ nummer, sleutel: publiek });
  const [gekopieerd, zetGekopieerd] = useState(false);
  return (
    <Kaart className="mt-6 border-2 border-amber-700">
      <h2 className="text-lg font-bold">Nog één stap: de publieke sleutel in de studentenapp zetten</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>Bewaar het gedownloade bestand <code>docent-{nummer}.sleutel.json</code> op een veilige plek, met een reservekopie.</li>
        <li>
          Voeg deze regel toe aan <code>keys/publieke-sleutels.json</code> in de repository:
          <pre className="mt-1 overflow-x-auto rounded-lg bg-stone-100 p-2 text-sm" tabIndex={0}>{regel}</pre>
          <button
            type="button"
            className="mt-1 min-h-11 font-semibold underline"
            onClick={() => void navigator.clipboard?.writeText(regel).then(() => zetGekopieerd(true))}
          >
            {gekopieerd ? 'Gekopieerd' : 'Regel kopiëren'}
          </button>
        </li>
        <li>Commit en push naar main. De app wordt opnieuw gepubliceerd; daarna accepteren studenten codes met sleutel {nummer}.</li>
      </ol>
    </Kaart>
  );
}
