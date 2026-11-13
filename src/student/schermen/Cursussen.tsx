import { curriculum } from '../../gedeeld/curriculum';
import { Pijl } from '../../gedeeld/iconen';
import { CursusStatusLabel, Kop } from '../../gedeeld/onderdelen';
import { opleidingUitkomst, type CursusUitkomst } from '../../rekenregels';
import type { SchermProps } from '../App';
import { voortgangVan } from '../gegevens';

export function CursussenScherm({ gegevens }: SchermProps) {
  const u = opleidingUitkomst(curriculum, voortgangVan(curriculum, gegevens));

  return (
    <div className="mx-auto max-w-3xl">
      <Kop label="Cursussen" vraag="Welke cursussen heb je gehad?">
        <p>Alle cursussen van de opleiding, per jaar en periode. Kies een cursus om opdrachten af te vinken.</p>
      </Kop>
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
    </div>
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
