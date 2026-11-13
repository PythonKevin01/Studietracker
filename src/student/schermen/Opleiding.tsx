import { curriculum } from '../../gedeeld/curriculum';
import { Pijl } from '../../gedeeld/iconen';
import { DemoLabel, Kaart, Kop, LeerdoelStatusLabel, Melding, Waarom } from '../../gedeeld/onderdelen';
import { vakUitkomst } from '../../rekenregels';
import type { SchermProps } from '../App';
import { backupNodig, voortgangVan } from '../gegevens';

export function OpleidingScherm({ gegevens }: SchermProps) {
  const voortgang = voortgangVan(curriculum, gegevens);
  const { opleiding } = curriculum;

  return (
    <>
      <Kop label="Mijn opleiding" vraag="Hoe ver ben ik?">
        <p>
          {opleiding.naam} · crebo {opleiding.crebo} · studentnummer {gegevens.studentnummer}
        </p>
      </Kop>

      {backupNodig(gegevens) && (
        <div className="mb-4 niet-printen">
          <Melding soort="let" titel="Maak een back-up">
            Je hebt nieuwe bevestigingen. Ze staan alleen op dit apparaat. <a href="#/rapport" className="font-semibold underline">Maak een back-up bij Rapport</a>.
          </Melding>
        </div>
      )}

      <ul className="space-y-4">
        {curriculum.vakken.map((vak) => {
          const u = vakUitkomst(curriculum, vak.id, voortgang);
          const o = u.aantalOpdrachten;
          return (
            <li key={vak.id}>
              <Kaart>
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-bold">{vak.titel}</h2>
                  <DemoLabel />
                </div>
                <p className="mt-1 text-stone-700">
                  {u.aantalLeerdoelen.behaald} van {u.leerdoelen.length} leerdoelen behaald
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <LeerdoelStatusLabel status="behaald" aantal={u.aantalLeerdoelen.behaald} />
                  <LeerdoelStatusLabel status="bezig" aantal={u.aantalLeerdoelen.bezig} />
                  <LeerdoelStatusLabel status="nog_niet_gestart" aantal={u.aantalLeerdoelen.nog_niet_gestart} />
                </div>
                <p className="mt-3 text-sm text-stone-700">
                  Opdrachten: {o.bevestigd} bevestigd, {o.zelf_gemeld} zelf gemeld, {o.open} open
                </p>
                <Waarom regels={u.waarom} over={vak.titel} />
                <a href={`#/vak/${encodeURIComponent(vak.id)}`} className="mt-2 flex min-h-11 items-center justify-between rounded-xl bg-stone-900 px-4 font-semibold text-white">
                  Naar de opdrachten<span className="sr-only"> van {vak.titel}</span>
                  <Pijl />
                </a>
              </Kaart>
            </li>
          );
        })}
      </ul>

      <a href="#/dossier" className="mt-4 flex min-h-11 items-center justify-between rounded-2xl border border-stone-300 bg-white p-4 font-semibold">
        Bekijk mijn kwalificatiedossier
        <Pijl />
      </a>
    </>
  );
}
