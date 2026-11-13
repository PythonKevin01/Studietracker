import { curriculum, leesbareDatum } from '../../gedeeld/curriculum';
import { Kaart, Kop, LeerdoelStatusLabel, Melding, NiveauLabel, OpdrachtStatusLabel, Waarom } from '../../gedeeld/onderdelen';
import { leerdoelUitkomst, type OpdrachtRegel } from '../../rekenregels';
import type { SchermProps } from '../App';
import { oordelen, voortgangVan, zetZelfGemeld, type Oordeel } from '../gegevens';

export function VakScherm({ gegevens, bijwerken, vakId }: SchermProps & { vakId: string }) {
  const vak = curriculum.vakken.find((v) => v.id === vakId);
  if (!vak) {
    return (
      <>
        <Kop label="Vak" vraag="Dit vak bestaat niet" />
        <a href="#/" className="font-semibold underline">Terug naar Mijn opleiding</a>
      </>
    );
  }
  const voortgang = voortgangVan(curriculum, gegevens);
  const oordeel = oordelen(curriculum, gegevens);

  const melden = (opdrachtId: string, gedaan: boolean) => bijwerken(zetZelfGemeld(gegevens, opdrachtId, gedaan, new Date()));

  return (
    <>
      <Kop label={vak.titel} vraag="Welke opdrachten heb je gedaan?">
        <p>
          Een <strong>leerdoel</strong> is iets wat je aan het eind kunt of weet. Je werkt eraan met opdrachten. Vink een opdracht aan
          als je hem gedaan hebt: dan is hij <strong>zelf gemeld</strong>. Je docent maakt hem <strong>bevestigd</strong> met een
          bewijscode.
        </p>
        <p className="mt-2">
          Elke opdracht heeft een <strong>niveau</strong>: <strong>O</strong> oriënterend (kennismaken), <strong>G</strong> geoefend,{' '}
          <strong>B</strong> beoordeeld. Een leerdoel is behaald als al zijn B-opdrachten bevestigd zijn.
        </p>
      </Kop>

      <ul className="space-y-4">
        {vak.leerdoelen.map((ld) => {
          const u = leerdoelUitkomst(curriculum, ld.id, voortgang);
          return (
            <li key={ld.id}>
              <Kaart>
                <p className="text-sm font-semibold text-stone-600">{ld.id}</p>
                <h2 className="text-lg font-bold">{ld.titel}</h2>
                <div className="mt-2">
                  <LeerdoelStatusLabel status={u.status} />
                </div>
                <Waarom regels={u.waarom} over={`leerdoel ${ld.id}`} />
                <ul className="mt-2 divide-y divide-stone-200 border-t border-stone-200">
                  {u.opdrachten.map((o) => (
                    <OpdrachtRij key={o.opdrachtId} leerdoelId={ld.id} opdracht={o} oordeel={oordeel.get(o.opdrachtId)} melden={melden} />
                  ))}
                </ul>
              </Kaart>
            </li>
          );
        })}
      </ul>
    </>
  );
}

function OpdrachtRij({
  leerdoelId,
  opdracht: o,
  oordeel,
  melden,
}: {
  leerdoelId: string;
  opdracht: OpdrachtRegel;
  oordeel: Oordeel | undefined;
  melden: (id: string, gedaan: boolean) => Promise<void>;
}) {
  const id = `${leerdoelId}-${o.opdrachtId}`;
  const bevestigd = o.status === 'bevestigd';
  return (
    <li className="py-3">
      <div className="flex items-start gap-2">
        <NiveauLabel niveau={o.niveau} />
        <span className="font-medium">{o.titel}</span>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <OpdrachtStatusLabel status={o.status} />
        {bevestigd ? (
          <span className="text-sm text-stone-700">op {leesbareDatum(oordeel!.datum)}</span>
        ) : (
          <label htmlFor={id} className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium niet-printen">
            <input
              id={id}
              type="checkbox"
              className="size-6 accent-sky-800"
              checked={o.status === 'zelf_gemeld'}
              onChange={(e) => void melden(o.opdrachtId, e.target.checked)}
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
    </li>
  );
}
