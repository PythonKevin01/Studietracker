import { useState } from 'react';
import { NIVEAUS } from '../../curriculum/schema';
import { curriculum, leesbareDatum, opdrachtOpId, volledigeOpdrachtNaam } from '../../gedeeld/curriculum';
import { Kaart, Kop, LeerdoelStatusLabel, Melding, hoofdknop, tweedeKnop } from '../../gedeeld/onderdelen';
import { NIVEAU_LABEL, kerntaakUitkomst, leerdoelTotaal } from '../../rekenregels';
import type { SchermProps } from '../App';
import { backupNodig, exportBestandsnaam, maakExport, oordelen, voortgangVan } from '../gegevens';
import { wisAlles } from '../opslag';
import { Terugzetten } from './Terugzetten';

export function RapportScherm({ gegevens, bijwerken, wis }: SchermProps & { wis: () => Promise<void> }) {
  const [gedownload, zetGedownload] = useState(false);

  const exporteer = async () => {
    const nu = new Date();
    const blob = new Blob([JSON.stringify(maakExport(gegevens, nu), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = exportBestandsnaam(gegevens, nu);
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
    await bijwerken({ ...gegevens, laatsteExport: nu.toISOString() });
    zetGedownload(true);
  };

  const wissen = async () => {
    if (!confirm('Alle gegevens op dit apparaat wissen? Zonder back-up ben je je bevestigingen kwijt.')) return;
    await wisAlles();
    await wis();
  };

  return (
    <>
      <Kop label="Rapport" vraag="Wil je je voortgang delen of bewaren?" />

      <div className="niet-printen space-y-4">
        <Kaart>
          <h2 className="font-bold">Exportbestand</h2>
          <p className="mt-1 text-sm text-stone-700">
            Eén bestand met al je bewijscodes en zelf gemelde opdrachten. Lever het in bij je docent, of bewaar het als back-up.
          </p>
          {backupNodig(gegevens) && !gedownload && (
            <p className="mt-2 text-sm font-semibold text-amber-900">Je hebt nieuwe codes sinds je laatste back-up.</p>
          )}
          <button type="button" onClick={() => void exporteer()} className={`${hoofdknop} mt-3 w-full`}>
            Exportbestand downloaden
          </button>
          {gedownload && (
            <div className="mt-3" aria-live="polite">
              <Melding soort="goed" titel="Exportbestand gedownload">
                Bewaar het op een plek buiten deze telefoon, bijvoorbeeld in je schoolmail of cloudmap.
              </Melding>
            </div>
          )}
          <Terugzetten huidig={gegevens} klaar={bijwerken} />
        </Kaart>

        <Kaart>
          <h2 className="font-bold">Afdrukken</h2>
          <p className="mt-1 text-sm text-stone-700">Druk het overzicht hieronder af, of bewaar het als pdf.</p>
          <button type="button" onClick={() => print()} className={`${tweedeKnop} mt-3 w-full`}>
            Afdrukken
          </button>
        </Kaart>
      </div>

      <Overzicht gegevens={gegevens} />

      <div className="niet-printen mt-8 border-t border-stone-300 pt-4">
        <button type="button" onClick={() => void wissen()} className="min-h-11 font-semibold text-rose-800 underline">
          Alle gegevens van dit apparaat wissen
        </button>
      </div>
    </>
  );
}

function Overzicht({ gegevens }: Pick<SchermProps, 'gegevens'>) {
  const voortgang = voortgangVan(curriculum, gegevens);
  const oordeel = oordelen(curriculum, gegevens);
  const bevestigd = [...oordeel.values()].filter((o) => o.resultaat === 'voldaan');
  const cel = 'border border-stone-300 px-2 py-1.5 text-left align-top';

  return (
    <section aria-labelledby="overzicht" className="mt-8">
      <h2 id="overzicht" className="text-xl font-bold">
        Voortgangsoverzicht
      </h2>
      <p className="mt-1 text-sm text-stone-700">
        {curriculum.opleiding.naam} (crebo {curriculum.opleiding.crebo}, dossier {curriculum.opleiding.dossier}) · studentnummer{' '}
        {gegevens.studentnummer} · gemaakt op {leesbareDatum(new Date().toISOString())} · DEMO
      </p>

      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel; schuif opzij voor meer kolommen">
        <table className="w-full border-collapse bg-white text-sm">
          <caption className="pb-1 text-left font-semibold">Leerdoelen</caption>
          <thead>
            <tr>
              <th scope="col" className={cel}>Leerdoel</th>
              <th scope="col" className={cel}>Status</th>
              <th scope="col" className={cel}>Behaald in</th>
            </tr>
          </thead>
          <tbody>
            {curriculum.leerdoelen.map((ld) => {
              const t = leerdoelTotaal(curriculum, ld.id, voortgang);
              return (
                <tr key={ld.id}>
                  <th scope="row" className={`${cel} font-normal`}>{ld.id} {ld.titel}</th>
                  <td className={cel}><LeerdoelStatusLabel status={t.status} behaaldIn={t.behaaldIn} /></td>
                  <td className={`${cel} tabular-nums whitespace-nowrap`}>{t.behaaldIn} van {t.perCursus.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 overflow-x-auto" tabIndex={0} role="region" aria-label="Tabel; schuif opzij voor meer kolommen">
        <table className="w-full border-collapse bg-white text-sm">
          <caption className="pb-1 text-left font-semibold">Werkprocessen (via het eigen leerdoel): bevestigd / zelf gemeld / totaal per niveau</caption>
          <thead>
            <tr>
              <th scope="col" className={cel}>Werkproces</th>
              {NIVEAUS.map((n) => (
                <th key={n} scope="col" className={cel}>
                  <abbr title={NIVEAU_LABEL[n]}>{n}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {curriculum.kerntaken.flatMap((kt) =>
              kerntaakUitkomst(curriculum, kt.id, voortgang).werkprocessen.map((wp) => (
                <tr key={wp.werkprocesId}>
                  <th scope="row" className={`${cel} font-normal`}>{wp.werkprocesId} {wp.titel}</th>
                  {NIVEAUS.map((n) => {
                    const t = wp.tellers[n];
                    return <td key={n} className={`${cel} tabular-nums whitespace-nowrap`}>{t.bevestigd} / {t.zelfGemeld} / {t.totaal}</td>;
                  })}
                </tr>
              )),
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mt-4 font-semibold">Bevestigde opdrachten</h3>
      {bevestigd.length === 0 ? (
        <p className="text-sm text-stone-700">Nog geen opdrachten bevestigd.</p>
      ) : (
        <ul className="mt-1 list-disc pl-5 text-sm">
          {bevestigd.map((o) => (
            <li key={o.opdrachtId}>
              {volledigeOpdrachtNaam(opdrachtOpId.get(o.opdrachtId)!)}: bevestigd op {leesbareDatum(o.datum)} (sleutel {o.sleutelnummer})
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-stone-700">Ontvangen bewijscodes: {gegevens.codes.length}. Deze staan in het exportbestand en zijn daar te controleren.</p>
    </section>
  );
}
