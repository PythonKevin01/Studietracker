import { NIVEAUS } from '../../curriculum/schema';
import { curriculum } from '../../gedeeld/curriculum';
import { Kaart, Kop, LeerdoelStatusLabel, VersterktLabel, Waarom } from '../../gedeeld/onderdelen';
import { NIVEAU_LABEL, kerntaakUitkomst, type LeerdoelTotaal, type Teller, type Tellers } from '../../rekenregels';
import type { SchermProps } from '../App';
import { voortgangVan } from '../gegevens';

export function DossierScherm({ gegevens }: SchermProps) {
  const voortgang = voortgangVan(curriculum, gegevens);
  return (
    <>
      <Kop label="Mijn kwalificatiedossier" vraag="Wat kan ik al als mediavormgever?">
        <p>
          Het <strong>kwalificatiedossier</strong> beschrijft wat een mediavormgever doet. Het bestaat uit twee{' '}
          <strong>kerntaken</strong> (grote delen van het werk). Elke kerntaak heeft <strong>werkprocessen</strong> (wat je daarbij
          concreet doet) en vakkennis en vaardigheden. Die laatste zijn jouw leerdoelen.
        </p>
      </Kop>

      {curriculum.kerntaken.map((kt) => {
        const u = kerntaakUitkomst(curriculum, kt.id, voortgang);
        return (
          <section key={kt.id} aria-labelledby={`kt-${kt.id}`} className="mt-8 first-of-type:mt-0">
            <h2 id={`kt-${kt.id}`} className="text-xl font-bold">
              {kt.id} · {kt.titel}
            </h2>
            <Kaart className="mt-2 bg-stone-50">
              <div className="flex flex-wrap gap-2">
                <LeerdoelStatusLabel status="behaald" aantal={u.aantal.behaald} />
                <VersterktLabel aantal={u.aantal.versterkt} />
                <LeerdoelStatusLabel status="bezig" aantal={u.aantal.bezig} />
                <LeerdoelStatusLabel status="nog_niet_gestart" aantal={u.aantal.nog_niet_gestart} />
              </div>
              <p className="mt-3 text-sm font-semibold">Opdrachten voor deze kerntaak</p>
              <TellerBlok tellers={u.tellers} />
              <Waarom regels={u.waarom} over={kt.id} />
            </Kaart>

            <h3 className="mt-5 text-lg font-bold">Werkprocessen</h3>
            <p className="text-sm text-stone-700">
              Elk werkproces is ook een leerdoel. Alleen dat leerdoel telt hier mee; andere leerdoelen zijn niet vast aan een
              werkproces gekoppeld.
            </p>
            <Legenda />
            <ul className="mt-2 space-y-3">
              {u.werkprocessen.map((wp) => (
                <li key={wp.werkprocesId}>
                  <Kaart>
                    <p className="text-sm font-semibold text-stone-600">
                      {wp.werkprocesId}
                      {wp.leerdoel && ` · leerdoel ${wp.leerdoel.leerdoelId}`}
                    </p>
                    <h4 className="font-bold">{wp.titel}</h4>
                    {wp.leerdoel && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                        <LeerdoelStatusLabel status={wp.leerdoel.status} behaaldIn={wp.leerdoel.behaaldIn} />
                        <span className="text-stone-700">in {wp.leerdoel.perCursus.length} cursus(sen) aangeboden</span>
                      </div>
                    )}
                    <TellerBlok tellers={wp.tellers} />
                    <Waarom regels={[...wp.waarom, ...(wp.leerdoel?.waarom ?? [])]} over={wp.werkprocesId} />
                  </Kaart>
                </li>
              ))}
            </ul>

            <h3 className="mt-5 text-lg font-bold">Vakkennis en vaardigheden</h3>
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-300 bg-white px-4">
              {u.leerdoelen.map((l) => (
                <LeerdoelRij key={l.leerdoelId} l={l} />
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function LeerdoelRij({ l }: { l: LeerdoelTotaal }) {
  return (
    <li className="py-3">
      <p className="text-sm font-semibold text-stone-600">{l.leerdoelId}</p>
      <p className="font-medium">{l.titel}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <LeerdoelStatusLabel status={l.status} behaaldIn={l.behaaldIn} />
        <span className="text-stone-700">in {l.perCursus.length} cursus(sen)</span>
      </div>
      <Waarom regels={l.waarom} over={l.leerdoelId} />
    </li>
  );
}

function Legenda() {
  return (
    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-800" aria-hidden="true">
      <span className="inline-flex items-center gap-1.5"><Vakje soort="bevestigd" /> bevestigd</span>
      <span className="inline-flex items-center gap-1.5"><Vakje soort="zelf" /> zelf gemeld</span>
      <span className="inline-flex items-center gap-1.5"><Vakje soort="open" /> open</span>
    </div>
  );
}

function Vakje({ soort }: { soort: 'bevestigd' | 'zelf' | 'open' }) {
  const klasse = {
    bevestigd: 'border-emerald-800 bg-emerald-700',
    zelf: 'gearceerd border-sky-800 text-sky-700',
    open: 'border-stone-500 bg-white',
  }[soort];
  return <span className={`inline-block size-4 shrink-0 rounded-sm border-2 ${klasse}`} />;
}

function TellerBlok({ tellers }: { tellers: Tellers }) {
  return (
    <dl className="mt-2 space-y-1.5">
      {NIVEAUS.map((n) => (
        <TellerRij key={n} niveau={`${n} · ${NIVEAU_LABEL[n]}`} teller={tellers[n]} />
      ))}
    </dl>
  );
}

const MAX_VAKJES = 24;

function TellerRij({ niveau, teller: t }: { niveau: string; teller: Teller }) {
  const open = t.totaal - t.bevestigd - t.zelfGemeld;
  // Bij veel opdrachten (kerntaak) passen niet alle vakjes; dan alleen de tekst.
  const vakjes = t.totaal <= MAX_VAKJES;
  return (
    <div className="border-t border-stone-200 pt-1.5 text-sm first:border-t-0 first:pt-0">
      <dt className="flex items-center justify-between gap-2 font-medium">
        {niveau}
        {vakjes && (
          <span className="flex flex-wrap justify-end gap-1" aria-hidden="true">
            {Array.from({ length: t.bevestigd }, (_, i) => <Vakje key={`b${i}`} soort="bevestigd" />)}
            {Array.from({ length: t.zelfGemeld }, (_, i) => <Vakje key={`z${i}`} soort="zelf" />)}
            {Array.from({ length: open }, (_, i) => <Vakje key={`o${i}`} soort="open" />)}
          </span>
        )}
      </dt>
      <dd className="text-stone-700">
        {t.totaal === 0 ? 'geen opdrachten' : `${t.bevestigd} bevestigd, ${t.zelfGemeld} zelf gemeld, van ${t.totaal}`}
      </dd>
    </div>
  );
}
