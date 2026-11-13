import { curriculum } from '../../gedeeld/curriculum';
import { Pijl } from '../../gedeeld/iconen';
import { CursusStatusLabel, Kaart, Kop, LeerdoelStatusLabel, Melding, VersterktLabel, Waarom } from '../../gedeeld/onderdelen';
import { opleidingUitkomst, type CursusUitkomst } from '../../rekenregels';
import type { SchermProps } from '../App';
import { backupNodig, voortgangVan } from '../gegevens';

export function OpleidingScherm({ gegevens }: SchermProps) {
  const u = opleidingUitkomst(curriculum, voortgangVan(curriculum, gegevens));
  const { opleiding } = curriculum;
  const l = u.leerdoelen;

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
            Je hebt nieuwe bevestigingen. Ze staan alleen op dit apparaat.{' '}
            <a href="#/rapport" className="font-semibold underline">Maak een back-up bij Rapport</a>.
          </Melding>
        </div>
      )}

      <Kaart>
        <h2 className="text-lg font-bold">
          {l.behaald} van de {l.totaal} leerdoelen behaald
        </h2>
        <p className="mt-1 text-sm text-stone-700">
          Een <strong>leerdoel</strong> is iets wat je aan het eind van de opleiding kunt of weet. Hetzelfde leerdoel komt vaak in
          meer cursussen terug. Behaal je het in een tweede cursus, dan heb je het <strong>versterkt</strong>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <LeerdoelStatusLabel status="behaald" aantal={l.behaald} />
          <VersterktLabel aantal={l.versterkt} />
          <LeerdoelStatusLabel status="bezig" aantal={l.bezig} />
          <LeerdoelStatusLabel status="nog_niet_gestart" aantal={l.nog_niet_gestart} />
        </div>
        <p className="mt-3 text-sm text-stone-700">
          Opdrachten: {u.opdrachten.bevestigd} bevestigd, {u.opdrachten.zelf_gemeld} zelf gemeld
        </p>
        <Waarom regels={u.waarom} over="het totaal" />
        <a href="#/dossier" className="mt-1 flex min-h-11 items-center justify-between rounded-xl bg-stone-900 px-4 font-semibold text-white">
          Alle leerdoelen per kerntaak
          <Pijl />
        </a>
      </Kaart>

      <h2 className="mt-8 text-xl font-bold">Cursussen</h2>
      <p className="text-sm text-stone-700">Kies een cursus om opdrachten af te vinken.</p>
      {u.jaren.map((j) => {
        const cursussen = j.perioden.flatMap((p) => p.cursussen);
        const metLeerdoelen = cursussen.filter((c) => c.status !== 'geen_leerdoelen');
        const klaar = metLeerdoelen.filter((c) => c.status === 'behaald').length;
        return (
          <details key={j.jaar} open={j.jaar === u.jaren[0]?.jaar} className="group mt-3 rounded-2xl border border-stone-300 bg-white">
            <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-2 px-4 py-2">
              <span>
                <span className="block text-lg font-bold">Jaar {j.jaar}</span>
                <span className="block text-sm text-stone-700">
                  {cursussen.length} cursussen · bij {klaar} van {metLeerdoelen.length} alle leerdoelen behaald
                </span>
              </span>
              <Pijl className="shrink-0 transition-transform group-open:rotate-90" />
            </summary>
            <div className="border-t border-stone-200 px-4 pb-3">
              {j.perioden.map((p) => (
                <section key={p.periode} aria-labelledby={`periode-${p.periode}`}>
                  <h3 id={`periode-${p.periode}`} className="mt-4 text-sm font-semibold tracking-wide text-stone-600 uppercase">
                    Periode {p.periode}
                  </h3>
                  <ul className="mt-1 divide-y divide-stone-200">
                    {p.cursussen.map((c) => (
                      <CursusRij key={c.cursus.id} u={c} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </details>
        );
      })}
    </>
  );
}

function CursusRij({ u }: { u: CursusUitkomst }) {
  const totaal = u.leerdoelen.length;
  return (
    <li>
      <a href={`#/cursus/${encodeURIComponent(u.cursus.id)}`} className="flex min-h-14 items-center justify-between gap-3 py-2">
        <span className="min-w-0">
          <span className="block font-medium">{u.cursus.titel}</span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-stone-700">
            <CursusStatusLabel status={u.status} />
            {totaal > 0 && (
              <span>
                {u.aantalLeerdoelen.behaald}/{totaal} leerdoelen
              </span>
            )}
          </span>
        </span>
        <Pijl className="shrink-0 text-stone-500" />
      </a>
    </li>
  );
}
