/**
 * Hoofdscherm, opgezet zoals voortgang in rollenspellen wordt getoond:
 * - karakterblad (links): hoe sta ik ervoor per kerntaak;
 * - vaardighedenboom (midden): alle leerdoelen als tegels, met bolletjes voor
 *   "behaald in x van y cursussen" en een gouden rand als het versterkt is;
 * - questlog (rechts): alleen de cursussen van één periode, met de volgende stap;
 * - reis (onder de boom): alle periodes, om een periode te kiezen.
 */
import { useEffect, useRef, useState } from 'react';
import { curriculum } from '../../gedeeld/curriculum';
import { Pijl } from '../../gedeeld/iconen';
import { CursusStatusLabel, Kop, LeerdoelStatusLabel, Melding, NiveauLabel, OpdrachtStatusLabel, VersterktLabel } from '../../gedeeld/onderdelen';
import type { Leerdoel } from '../../curriculum/schema';
import {
  actievePeriode,
  leerdoelTotaal,
  perioden,
  periodeUitkomst,
  volgendeStap,
  type LeerdoelStatus,
  type LeerdoelTotaal,
  type Voortgang,
} from '../../rekenregels';
import type { SchermProps } from '../App';
import { backupNodig, voortgangVan } from '../gegevens';

type Stand = LeerdoelStatus | 'versterkt';
const stand = (t: LeerdoelTotaal): Stand => (t.status === 'behaald' && t.behaaldIn > 1 ? 'versterkt' : t.status);
const STAND_TEKST: Record<Stand, string> = { nog_niet_gestart: 'nog niet gestart', bezig: 'bezig', behaald: 'behaald', versterkt: 'versterkt' };

export function OverzichtScherm({ gegevens, bijwerken }: SchermProps) {
  const voortgang = voortgangVan(curriculum, gegevens);
  const totalen = new Map(curriculum.leerdoelen.map((l) => [l.id, leerdoelTotaal(curriculum, l.id, voortgang)]));
  const nu = actievePeriode(curriculum, voortgang);
  const periode = gegevens.periode ?? nu;
  const [gekozen, zetGekozen] = useState<string | null>(null);
  const zijKop = useRef<HTMLHeadingElement>(null);
  const laatsteTegel = useRef<string | null>(null);
  const eerste = useRef(true);

  // Na kiezen van een leerdoel (of terug): focus naar het zijpaneel of terug naar de tegel.
  useEffect(() => {
    if (eerste.current) {
      eerste.current = false;
      return;
    }
    if (gekozen) {
      zijKop.current?.focus();
      if (!matchMedia('(min-width: 1280px)').matches) zijKop.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    } else if (laatsteTegel.current) {
      document.querySelector<HTMLButtonElement>(`[data-leerdoel="${laatsteTegel.current}"]`)?.focus();
    }
  }, [gekozen]);

  const kies = (id: string | null) => {
    if (id) laatsteTegel.current = id;
    zetGekozen((huidig) => (huidig === id ? null : id));
  };

  return (
    <div className="grid gap-5 [grid-template-areas:'profiel'_'zij'_'boom'] lg:grid-cols-[minmax(0,1fr)_360px] lg:[grid-template-areas:'profiel_profiel'_'boom_zij'] xl:grid-cols-[280px_minmax(0,1fr)_380px] xl:[grid-template-areas:'profiel_boom_zij']">
      <div className="[grid-area:profiel]">
        <Profiel gegevens={gegevens} totalen={totalen} voortgang={voortgang} periode={periode} />
      </div>

      <aside aria-label="Periode en details" className="[grid-area:zij] xl:sticky xl:top-4 xl:self-start">
        {gekozen ? (
          <Inspecteur totaal={totalen.get(gekozen)!} kopRef={zijKop} terug={() => kies(null)} periode={periode} />
        ) : (
          <Questlog periode={periode} voortgang={voortgang} totalen={totalen} kopRef={zijKop} kies={kies} />
        )}
      </aside>

      <div className="min-w-0 [grid-area:boom]">
        <section className="rounded-2xl border border-stone-300 bg-white p-4">
          <Kop label="Overzicht" vraag="Wat kan ik al?">
            <p>Je vaardigheden per kerntaak. Kies een leerdoel voor details.</p>
          </Kop>
          <div className="-mt-2 flex flex-wrap gap-2" aria-hidden="true">
            <LeerdoelStatusLabel status="nog_niet_gestart" />
            <LeerdoelStatusLabel status="bezig" />
            <LeerdoelStatusLabel status="behaald" />
            <LeerdoelStatusLabel status="behaald" behaaldIn={2} />
          </div>
          <div className="mt-4 space-y-4">
            {curriculum.kerntaken.map((kt) => {
              const lds = curriculum.leerdoelen.filter((l) => l.kerntaken.includes(kt.id));
              return (
                <section key={kt.id} aria-labelledby={`cluster-${kt.id}`} className="rounded-xl bg-[#1e1b2e] p-4 text-white">
                  <h2 id={`cluster-${kt.id}`} className="font-bold">
                    <span className="block text-xs font-semibold tracking-wider text-violet-300 uppercase">{kt.id}</span>
                    {kt.titel}
                  </h2>
                  <Tegels titel="Werkprocessen" lds={lds.filter((l) => l.werkproces)} totalen={totalen} gekozen={gekozen} kies={kies} groot />
                  <Tegels titel="Vakkennis en vaardigheden" lds={lds.filter((l) => !l.werkproces)} totalen={totalen} gekozen={gekozen} kies={kies} />
                </section>
              );
            })}
          </div>
        </section>
        <Reis voortgang={voortgang} gekozen={periode} nu={nu} kies={(p) => void bijwerken({ ...gegevens, periode: p })} />
      </div>
    </div>
  );
}

// --- Karakterblad -----------------------------------------------------------

function Profiel({ gegevens, totalen, voortgang, periode }: { gegevens: SchermProps['gegevens']; totalen: Map<string, LeerdoelTotaal>; voortgang: Voortgang; periode: number }) {
  const alle = [...totalen.values()];
  const behaald = alle.filter((t) => t.status === 'behaald').length;
  const versterkt = alle.filter((t) => stand(t) === 'versterkt').length;
  const opdrachten = Object.values(voortgang);
  const jaar = perioden(curriculum).find((p) => p.periode === periode)?.jaar;

  return (
    <div className="space-y-4">
      <section aria-labelledby="profiel-kop" className="rounded-2xl border border-stone-300 bg-white p-4">
        <div className="flex items-center gap-3">
          <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-[#1e1b2e] text-xl font-extrabold text-emerald-300" aria-hidden="true">MV</div>
          <div>
            <h2 id="profiel-kop" className="text-xl font-bold"><span className="sr-only">Studentnummer </span>{gegevens.studentnummer}</h2>
            <p className="text-sm text-stone-700">
              {curriculum.opleiding.naam} · jaar {jaar}, periode {periode}
            </p>
          </div>
        </div>
        <p className="mt-4 font-semibold">
          {behaald} van de {alle.length} leerdoelen behaald
        </p>
        <div className="mt-1 grid gap-4 lg:grid-cols-2 xl:grid-cols-1">
          {curriculum.kerntaken.map((kt) => {
            const lds = alle.filter((t) => t.leerdoel.kerntaken.includes(kt.id));
            const v = lds.filter((t) => stand(t) === 'versterkt').length;
            const b = lds.filter((t) => stand(t) === 'behaald').length;
            const z = lds.filter((t) => t.status === 'bezig').length;
            const pct = (n: number) => `${(100 * n) / lds.length}%`;
            return (
              <div key={kt.id}>
                <div className="flex justify-between gap-2 text-sm font-semibold">
                  <span>{kt.titel}</span>
                  <span className="tabular-nums">
                    {b + v}/{lds.length}
                  </span>
                </div>
                <div className="mt-1.5 flex h-3 overflow-hidden rounded-full border border-stone-400 bg-stone-200" aria-hidden="true">
                  <i className="block bg-amber-600" style={{ width: pct(v) }} />
                  <i className="block bg-emerald-700" style={{ width: pct(b) }} />
                  <i className="gearceerd block text-amber-500" style={{ width: pct(z) }} />
                </div>
                <p className="mt-1 text-xs text-stone-700">
                  {b + v} behaald (waarvan {v} versterkt), {z} bezig
                </p>
              </div>
            );
          })}
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4 xl:grid-cols-2">
          {(
            [
              [`${behaald}/${alle.length}`, 'leerdoelen behaald'],
              [versterkt, 'versterkt'],
              [opdrachten.filter((s) => s === 'bevestigd').length, 'opdrachten bevestigd'],
              [opdrachten.filter((s) => s === 'zelf_gemeld').length, 'wachten op docent'],
            ] as const
          ).map(([n, t]) => (
            <div key={t} className="flex flex-col-reverse rounded-xl bg-stone-100 p-2.5">
              <dt className="text-xs text-stone-700">{t}</dt>
              <dd className="text-2xl font-bold tabular-nums">{n}</dd>
            </div>
          ))}
        </dl>
      </section>

      {backupNodig(gegevens) && (
        <div className="niet-printen">
          <Melding soort="let" titel="Maak een back-up">
            Nieuwe bevestigingen staan alleen op dit apparaat. <a href="#/rapport" className="font-semibold underline">Maak een back-up</a>.
          </Melding>
        </div>
      )}

      <section aria-labelledby="uitleg" className="rounded-2xl border border-stone-300 bg-white p-4 text-sm">
        <h2 id="uitleg" className="text-xs font-bold tracking-wider text-stone-600 uppercase">Hoe lees je dit?</h2>
        <p className="mt-1">
          Elke tegel is een <strong>leerdoel</strong>: iets wat je aan het eind van de opleiding kunt of weet. Een leerdoel komt in
          meer cursussen terug. De bolletjes laten zien in hoeveel cursussen je het al behaald hebt, van alle kansen die je krijgt.
          Twee of meer: <strong>versterkt</strong>.
        </p>
      </section>
    </div>
  );
}

// --- Vaardighedenboom -------------------------------------------------------

const TEGEL_STIJL: Record<Stand, string> = {
  nog_niet_gestart: 'border-dashed border-[#6b6790] bg-[#2b2740] text-[#e4e2f0]',
  bezig: 'border-amber-400 bg-[#3b2f1c] text-amber-100',
  behaald: 'border-emerald-400 bg-emerald-900 text-emerald-50',
  versterkt: 'border-amber-300 bg-emerald-900 text-amber-50 shadow-[0_0_0_2px_rgb(252_211_77/0.35),0_0_14px_rgb(252_211_77/0.4)]',
};

function TegelIcoon({ s }: { s: Stand }) {
  const p = { width: 15, height: 15, viewBox: '0 0 24 24', 'aria-hidden': true as const, className: 'shrink-0' };
  if (s === 'versterkt') return <svg {...p}><path fill="currentColor" d="M12 1.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 15l-5.4 3 1.2-6-4.5-4.2 6.1-.7z" /></svg>;
  if (s === 'behaald')
    return (
      <svg {...p}>
        <circle cx="12" cy="12" r="10" fill="currentColor" />
        <path d="m7.5 12.3 3 3 6-6.3" fill="none" stroke="#064e3b" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (s === 'bezig')
    return (
      <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" stroke="none" />
      </svg>
    );
  return <svg {...p} fill="none" stroke="currentColor" strokeWidth="2.4"><circle cx="12" cy="12" r="8" /></svg>;
}

function Bolletjes({ t, groot = false }: { t: LeerdoelTotaal; groot?: boolean }) {
  const maat = groot ? 'size-4 border-2' : 'size-2.5 border-[1.5px]';
  return (
    <span className="flex flex-wrap gap-1" aria-hidden="true">
      {t.perCursus.map((p, i) => (
        <i key={p.cursusId} className={`block rounded-full border-current ${maat} ${i < t.behaaldIn ? 'bg-current' : ''}`} />
      ))}
    </span>
  );
}

function Tegels({
  titel,
  lds,
  totalen,
  gekozen,
  kies,
  groot = false,
}: {
  titel: string;
  lds: Leerdoel[];
  totalen: Map<string, LeerdoelTotaal>;
  gekozen: string | null;
  kies: (id: string) => void;
  groot?: boolean;
}) {
  return (
    <>
      <h3 className="mt-3 mb-1.5 text-xs font-bold tracking-wider text-violet-300 uppercase">{titel}</h3>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(112px,1fr))] gap-2">
        {lds.map((l) => {
          const t = totalen.get(l.id)!;
          const s = stand(t);
          return (
            <li key={l.id}>
              <button
                type="button"
                data-leerdoel={l.id}
                aria-pressed={gekozen === l.id}
                onClick={() => kies(l.id)}
                className={`flex h-full w-full flex-col gap-1 rounded-lg border-2 p-2 text-left ${groot ? 'min-h-21' : 'min-h-19'} ${TEGEL_STIJL[s]} aria-pressed:outline-3 aria-pressed:outline-offset-2 aria-pressed:outline-white`}
              >
                <span className="flex items-center justify-between text-[11px] font-semibold opacity-85">
                  <span>{l.werkproces ? l.werkproces.replace('B1-', '') : l.id}</span>
                  <TegelIcoon s={s} />
                </span>{' '}
                <span lang="nl" className={`leading-tight font-bold [overflow-wrap:anywhere] hyphens-auto ${groot ? 'text-sm' : 'text-[13px]'}`}>
                  {l.kort}
                </span>
                <span className="sr-only">
                  : {STAND_TEKST[s]}, behaald in {t.behaaldIn} van {t.perCursus.length} cursussen
                </span>
                <span className="mt-auto">
                  <Bolletjes t={t} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

// --- Reis -------------------------------------------------------------------

function Reis({ voortgang, gekozen, nu, kies }: { voortgang: Voortgang; gekozen: number; nu: number; kies: (p: number) => void }) {
  const lijst = perioden(curriculum).map((p) => periodeUitkomst(curriculum, p.periode, voortgang));
  const jaren = [...new Set(lijst.map((p) => p.jaar))];
  return (
    <section aria-labelledby="reis" className="mt-5 rounded-2xl border border-stone-300 bg-white p-4">
      <h2 id="reis" className="text-lg font-bold">Je reis door de opleiding</h2>
      <p className="text-sm text-stone-700">Per periode: in hoeveel cursussen je alle leerdoelen hebt behaald. Kies een periode om die rechts te bekijken.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {jaren.map((j) => (
          <div key={j} className="rounded-xl border border-stone-300 p-2.5">
            <h3 className="text-sm font-bold">Jaar {j}</h3>
            <ul className="mt-2 grid grid-cols-4 gap-1.5">
              {lijst
                .filter((p) => p.jaar === j)
                .map((p) => (
                  <li key={p.periode}>
                    <button
                      type="button"
                      aria-pressed={p.periode === gekozen}
                      onClick={() => kies(p.periode)}
                      className="flex min-h-16 w-full flex-col items-center rounded-lg border-2 border-transparent bg-stone-100 p-1.5 text-xs aria-pressed:border-blue-700 aria-pressed:bg-blue-50"
                    >
                      <span className="text-sm font-bold">P{p.periode}</span>
                      <span className="tabular-nums">
                        {p.allesBehaald}/{p.metLeerdoelen}
                        <span className="sr-only"> cursussen met alle leerdoelen behaald</span>
                      </span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-stone-300" aria-hidden="true">
                        <i className="block h-full bg-emerald-700" style={{ width: `${p.metLeerdoelen ? (100 * p.allesBehaald) / p.metLeerdoelen : 0}%` }} />
                      </span>
                      {p.periode === nu && <span className="mt-0.5 text-[10px] font-bold text-blue-800">nu bezig</span>}
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- Questlog en inspecteur -------------------------------------------------

function Questlog({
  periode,
  voortgang,
  totalen,
  kopRef,
  kies,
}: {
  periode: number;
  voortgang: Voortgang;
  totalen: Map<string, LeerdoelTotaal>;
  kopRef: React.RefObject<HTMLHeadingElement | null>;
  kies: (id: string) => void;
}) {
  const p = periodeUitkomst(curriculum, periode, voortgang);
  const stap = volgendeStap(curriculum, periode, voortgang);
  return (
    <section aria-labelledby="questlog" className="rounded-2xl border border-stone-300 bg-white p-4">
      <p className="text-xs font-bold tracking-wider text-stone-600 uppercase">Jaar {p.jaar}</p>
      <h2 id="questlog" ref={kopRef} tabIndex={-1} className="text-xl font-bold outline-none">
        Periode {periode}: {p.cursussen.length} cursussen
      </h2>

      <div className="mt-3 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm">
        <p>
          <strong className="text-blue-900">Volgende stap:</strong> {stap.tekst}
        </p>
        {stap.levertOp.length > 0 && <p className="mt-1 text-stone-700">Levert op: {stap.levertOp.join(', ')}.</p>}
        {stap.soort !== 'klaar' && (
          <a href={stap.soort === 'docent' ? '#/code' : `#/cursus/${encodeURIComponent(stap.cursusId)}`} className="mt-1 inline-flex min-h-11 items-center gap-1 font-semibold text-blue-900 underline">
            {stap.soort === 'docent' ? 'Code invoeren' : 'Naar de opdracht'}
            <Pijl width={16} height={16} />
          </a>
        )}
      </div>

      <ul className="mt-3 space-y-3">
        {p.cursussen.map((u) => (
          <li key={u.cursus.id} className="rounded-xl border border-stone-300 p-3">
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-bold">
                <a href={`#/cursus/${encodeURIComponent(u.cursus.id)}`} className="underline decoration-stone-400 underline-offset-2 hover:decoration-stone-900">
                  {u.cursus.titel}
                </a>
              </h3>
              <CursusStatusLabel status={u.status} />
            </div>
            {u.cursus.opdrachten.length > 0 ? (
              <>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {u.cursus.opdrachten.map((o) => (
                    <li key={o.id} className="flex items-center gap-2">
                      <NiveauLabel niveau={o.leerdoelen[0]!.niveau} />
                      <span>{o.titel.replace(/^DEMO-/, '')}</span>
                      <span className="ml-auto">
                        <OpdrachtStatusLabel status={voortgang[o.id] ?? 'open'} />
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-stone-700">Levert op:</span>
                  {u.cursus.leerdoelen.map((id) => {
                    const t = totalen.get(id)!;
                    const s = stand(t);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => kies(id)}
                        className={`min-h-8 rounded-full border px-2 font-medium ${s === 'behaald' || s === 'versterkt' ? 'border-emerald-700 bg-emerald-50 text-emerald-950' : 'border-stone-400 bg-stone-50'}`}
                      >
                        {t.leerdoel.kort} {t.behaaldIn}/{t.perCursus.length}
                        <span className="sr-only"> (behaald in {t.behaaldIn} van {t.perCursus.length} cursussen; toon details)</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="mt-1 text-sm text-stone-700">Geen leerdoelen in het cursusoverzicht.</p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Inspecteur({
  totaal: t,
  kopRef,
  terug,
  periode,
}: {
  totaal: LeerdoelTotaal;
  kopRef: React.RefObject<HTMLHeadingElement | null>;
  terug: () => void;
  periode: number;
}) {
  const s = stand(t);
  const volgende = t.perCursus.find((p) => p.status !== 'behaald');
  return (
    <section aria-labelledby="inspecteur" className="rounded-2xl border border-stone-300 bg-white p-4">
      <button type="button" onClick={terug} className="min-h-11 font-medium text-blue-800 underline">
        ← Terug naar periode {periode}
      </button>
      <p className="text-xs font-bold tracking-wider text-stone-600 uppercase">
        {t.leerdoelId}
        {t.leerdoel.werkproces && ` · werkproces ${t.leerdoel.werkproces}`}
      </p>
      <h2 id="inspecteur" ref={kopRef} tabIndex={-1} className="mt-0.5 text-xl font-bold outline-none">
        {t.titel}
      </h2>
      <div className="mt-2">
        {s === 'versterkt' ? <VersterktLabel aantal={t.behaaldIn} /> : <LeerdoelStatusLabel status={t.status} />}
      </div>
      <div className="my-2 text-emerald-800">
        <Bolletjes t={t} groot />
      </div>
      <p className="text-sm">
        Behaald in <strong>{t.behaaldIn}</strong> van de <strong>{t.perCursus.length}</strong> cursussen waarin dit leerdoel terugkomt.{' '}
        {t.behaaldIn === 0 && volgende
          ? `Je eerste kans: ${volgende.cursusNaam}.`
          : t.behaaldIn === 1
            ? 'Behaal je het nog een keer, dan versterk je het.'
            : t.behaaldIn > 1
              ? 'Versterkt: je hebt dit vaker laten zien.'
              : ''}
      </p>
      <ul className="mt-3 divide-y divide-stone-200 border-t border-stone-200 text-sm">
        {t.perCursus.map((p) => (
          <li key={p.cursusId} className="flex items-center justify-between gap-2 py-2">
            <a href={`#/cursus/${encodeURIComponent(p.cursusId)}`} className="underline decoration-stone-400 underline-offset-2">
              {p.cursusNaam}
            </a>
            <LeerdoelStatusLabel status={p.status} />
          </li>
        ))}
      </ul>
    </section>
  );
}
