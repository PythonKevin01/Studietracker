import { curriculum, leerdoelOpId, leesbareDatum } from '../../gedeeld/curriculum';
import { Kaart, Kop, LeerdoelStatusLabel, Melding, NiveauLabel, OpdrachtStatusLabel, Waarom } from '../../gedeeld/onderdelen';
import { cursusUitkomst, leerdoelTotaal, type Voortgang } from '../../rekenregels';
import type { Cursus, Opdracht } from '../../curriculum/schema';
import type { SchermProps } from '../App';
import { oordelen, voortgangVan, zetZelfGemeld, type Oordeel } from '../gegevens';

export function CursusScherm({ gegevens, bijwerken, cursusId }: SchermProps & { cursusId: string }) {
  const cursus = curriculum.cursussen.find((v) => v.id === cursusId);
  if (!cursus) {
    return (
      <>
        <Kop label="Cursus" vraag="Deze cursus bestaat niet" />
        <a href="#/" className="font-semibold underline">Terug naar Mijn opleiding</a>
      </>
    );
  }
  const voortgang = voortgangVan(curriculum, gegevens);
  const oordeel = oordelen(curriculum, gegevens);
  const u = cursusUitkomst(curriculum, cursus.id, voortgang);
  const melden = (opdrachtId: string, gedaan: boolean) => bijwerken(zetZelfGemeld(gegevens, opdrachtId, gedaan, new Date()));

  if (cursus.leerdoelen.length === 0) {
    return (
      <>
        <Kop label={`Jaar ${cursus.jaar} · periode ${cursus.periode}`} vraag={cursus.titel} />
        <Melding soort="let" titel="Deze cursus heeft geen leerdoelen">
          In het cursusoverzicht van de opleiding staan voor deze cursus geen leerdoelen. Er is hier dus niets bij te houden.
        </Melding>
      </>
    );
  }

  return (
    <>
      <Kop label={`${cursus.titel} · periode ${cursus.periode}`} vraag="Welke opdrachten heb je gedaan?">
        <p>
          Vink een opdracht aan als je hem gedaan hebt: dan is hij <strong>zelf gemeld</strong>. Je docent maakt hem{' '}
          <strong>bevestigd</strong> met een bewijscode. Elke opdracht heeft een <strong>niveau</strong>: <strong>O</strong>{' '}
          oriënterend (kennismaken), <strong>G</strong> geoefend, <strong>B</strong> beoordeeld. Een leerdoel is in deze cursus
          behaald als de B-opdrachten ervoor bevestigd zijn.
        </p>
      </Kop>

      <section aria-labelledby="opdrachten">
        <h2 id="opdrachten" className="text-xl font-bold">Opdrachten</h2>
        <ul className="mt-2 space-y-3">
          {cursus.opdrachten.map((o) => (
            <OpdrachtKaart key={o.id} opdracht={o} voortgang={voortgang} oordeel={oordeel.get(o.id)} melden={melden} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="leerdoelen" className="mt-8">
        <h2 id="leerdoelen" className="text-xl font-bold">Leerdoelen in deze cursus</h2>
        <Waarom regels={u.waarom} over={cursus.titel} />
        <ul className="mt-2 space-y-3">
          {u.leerdoelen.map((l) => (
            <li key={l.leerdoelId}>
              <LeerdoelKaart cursus={cursus} leerdoelId={l.leerdoelId} voortgang={voortgang} />
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function OpdrachtKaart({
  opdracht: o,
  voortgang,
  oordeel,
  melden,
}: {
  opdracht: Opdracht;
  voortgang: Voortgang;
  oordeel: Oordeel | undefined;
  melden: (id: string, gedaan: boolean) => Promise<void>;
}) {
  const status = voortgang[o.id] ?? 'open';
  const niveau = o.leerdoelen[0]!.niveau;
  return (
    <li>
      <Kaart>
        <div className="flex items-start gap-2">
          <NiveauLabel niveau={niveau} />
          <h3 className="font-semibold">{o.titel}</h3>
        </div>
        <p className="mt-1 text-sm text-stone-700">Voor {o.leerdoelen.map((k) => k.leerdoel).join(', ')}</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <OpdrachtStatusLabel status={status} />
          {status === 'bevestigd' ? (
            <span className="text-sm text-stone-700">op {leesbareDatum(oordeel!.datum)}</span>
          ) : (
            <label htmlFor={o.id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium niet-printen">
              <input
                id={o.id}
                type="checkbox"
                className="size-6 accent-sky-800"
                checked={status === 'zelf_gemeld'}
                onChange={(e) => void melden(o.id, e.target.checked)}
              />
              Ik heb dit gedaan
            </label>
          )}
        </div>
        {oordeel?.resultaat === 'niet_voldaan' && (
          <div className="mt-2">
            <Melding soort="let" titel={`Docent: nog niet voldaan (${leesbareDatum(oordeel.datum)})`}>
              Bespreek met je docent wat er nog nodig is.
            </Melding>
          </div>
        )}
      </Kaart>
    </li>
  );
}

function LeerdoelKaart({ cursus, leerdoelId, voortgang }: { cursus: Cursus; leerdoelId: string; voortgang: Voortgang }) {
  const totaal = leerdoelTotaal(curriculum, leerdoelId, voortgang);
  const hier = totaal.perCursus.find((p) => p.cursusId === cursus.id)!;
  const elders = totaal.perCursus.filter((p) => p.cursusId !== cursus.id);
  return (
    <Kaart>
      <p className="text-sm font-semibold text-stone-600">{leerdoelId}</p>
      <h3 className="font-bold">{leerdoelOpId.get(leerdoelId)?.titel}</h3>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-sm">In deze cursus:</span>
        <LeerdoelStatusLabel status={hier.status} />
      </div>
      <Waarom regels={hier.waarom} over={`${leerdoelId} in deze cursus`} />
      {elders.length > 0 && (
        <div className="mt-1 border-t border-stone-200 pt-2 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span>Over de hele opleiding:</span>
            <LeerdoelStatusLabel status={totaal.status} behaaldIn={totaal.behaaldIn} />
          </div>
          <p className="mt-1 text-stone-700">Komt ook terug in: {elders.map((e) => e.cursusNaam).join(', ')}.</p>
        </div>
      )}
    </Kaart>
  );
}
