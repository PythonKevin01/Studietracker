import { NIVEAUS } from '../../curriculum/schema';
import { curriculum } from '../../gedeeld/curriculum';
import { Kaart, Kop, Waarom } from '../../gedeeld/onderdelen';
import { NIVEAU_LABEL, kerntaakUitkomst, type Teller, type Tellers } from '../../rekenregels';
import type { SchermProps } from '../App';
import { voortgangVan } from '../gegevens';

export function DossierScherm({ gegevens }: SchermProps) {
  const voortgang = voortgangVan(curriculum, gegevens);
  return (
    <>
      <Kop label="Mijn kwalificatiedossier" vraag="Aan welke werkprocessen werk ik?">
        <p>
          Het <strong>kwalificatiedossier</strong> beschrijft wat een mediavormgever doet. Het bestaat uit <strong>kerntaken</strong>{' '}
          (grote delen van het werk), verdeeld in <strong>werkprocessen</strong> (wat je daarbij concreet doet). Hier zie je hoeveel
          opdrachten je per werkproces hebt gedaan.
        </p>
      </Kop>

      <Legenda />

      {curriculum.kerntaken.map((kt) => {
        const u = kerntaakUitkomst(curriculum, kt.id, voortgang);
        return (
          <section key={kt.id} aria-labelledby={`kt-${kt.id}`} className="mt-6">
            <h2 id={`kt-${kt.id}`} className="text-xl font-bold">
              {kt.id} · {kt.titel}
            </h2>
            <Kaart className="mt-2 bg-stone-50">
              <p className="font-semibold">Alle werkprocessen samen</p>
              <TellerBlok tellers={u.tellers} />
              <Waarom regels={u.waarom} over={kt.id} />
            </Kaart>
            <ul className="mt-3 space-y-3">
              {u.werkprocessen.map((wp) => (
                <li key={wp.werkprocesId}>
                  <Kaart>
                    <p className="text-sm font-semibold text-stone-600">{wp.werkprocesId}</p>
                    <h3 className="font-bold">{wp.titel}</h3>
                    <TellerBlok tellers={wp.tellers} />
                    <Waarom regels={wp.waarom} over={wp.werkprocesId} />
                  </Kaart>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </>
  );
}

function Legenda() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-800" aria-hidden="true">
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

function TellerRij({ niveau, teller: t }: { niveau: string; teller: Teller }) {
  const open = t.totaal - t.bevestigd - t.zelfGemeld;
  return (
    <div className="border-t border-stone-200 pt-1.5 text-sm first:border-t-0 first:pt-0">
      <dt className="flex items-center justify-between gap-2 font-medium">
        {niveau}
        <span className="flex flex-wrap justify-end gap-1" aria-hidden="true">
          {Array.from({ length: t.bevestigd }, (_, i) => <Vakje key={`b${i}`} soort="bevestigd" />)}
          {Array.from({ length: t.zelfGemeld }, (_, i) => <Vakje key={`z${i}`} soort="zelf" />)}
          {Array.from({ length: open }, (_, i) => <Vakje key={`o${i}`} soort="open" />)}
        </span>
      </dt>
      <dd className="text-stone-700">
        {t.totaal === 0 ? 'geen opdrachten' : `${t.bevestigd} bevestigd, ${t.zelfGemeld} zelf gemeld, van ${t.totaal}`}
      </dd>
    </div>
  );
}
