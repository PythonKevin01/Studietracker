import { useEffect, useRef, type ReactNode } from 'react';
import type { Niveau } from '../curriculum/schema';
import { LEERDOEL_LABEL, NIVEAU_LABEL, OPDRACHT_LABEL, type LeerdoelStatus, type OpdrachtStatus } from '../rekenregels';
import { Fout, Half, Leeg, Let, Zegel, ZelfGemeld } from './iconen';

const STATUSVORM = 'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-sm font-medium whitespace-nowrap';

const OPDRACHT_STIJL: Record<OpdrachtStatus, { klasse: string; Icoon: typeof Leeg }> = {
  open: { klasse: 'border-stone-500 bg-white text-stone-700', Icoon: Leeg },
  zelf_gemeld: { klasse: 'border-sky-700 bg-sky-50 text-sky-900', Icoon: ZelfGemeld },
  bevestigd: { klasse: 'border-emerald-700 bg-emerald-50 text-emerald-900', Icoon: Zegel },
};

const LEERDOEL_STIJL: Record<LeerdoelStatus, { klasse: string; Icoon: typeof Leeg }> = {
  nog_niet_gestart: { klasse: 'border-stone-500 bg-white text-stone-700', Icoon: Leeg },
  bezig: { klasse: 'border-amber-700 bg-amber-50 text-amber-900', Icoon: Half },
  behaald: { klasse: 'border-emerald-700 bg-emerald-50 text-emerald-900', Icoon: Zegel },
};

export function OpdrachtStatusLabel({ status, stempel = false }: { status: OpdrachtStatus; stempel?: boolean }) {
  const { klasse, Icoon } = OPDRACHT_STIJL[status];
  return (
    <span className={`${STATUSVORM} ${klasse}`}>
      <Icoon className={stempel ? 'stempel' : undefined} />
      {OPDRACHT_LABEL[status]}
    </span>
  );
}

export function LeerdoelStatusLabel({ status, aantal }: { status: LeerdoelStatus; aantal?: number }) {
  const { klasse, Icoon } = LEERDOEL_STIJL[status];
  return (
    <span className={`${STATUSVORM} ${klasse}`}>
      <Icoon />
      {aantal !== undefined && <span className="tabular-nums">{aantal}</span>}
      {LEERDOEL_LABEL[status].replace(/^./, (l) => (aantal !== undefined ? l.toLowerCase() : l))}
    </span>
  );
}

export function NiveauLabel({ niveau }: { niveau: Niveau }) {
  return (
    <span className="inline-flex items-center rounded border border-stone-500 px-1.5 text-xs font-semibold text-stone-700" title={NIVEAU_LABEL[niveau]}>
      <span aria-hidden="true">{niveau}</span>
      <span className="sr-only">niveau {NIVEAU_LABEL[niveau]}</span>
    </span>
  );
}

/** Uitklapbare onderbouwing van een status. */
export function Waarom({ regels, over }: { regels: readonly string[]; over: string }) {
  return (
    <details className="group mt-2 text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer items-center gap-1 font-medium text-blue-800 underline underline-offset-2 print:hidden">
        Waarom?<span className="sr-only"> (uitleg bij {over})</span>
      </summary>
      <ul className="mt-1 list-disc space-y-1 rounded-lg bg-stone-100 py-2 pr-3 pl-7 text-stone-800">
        {regels.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
    </details>
  );
}

export function Melding({ soort, titel, children }: { soort: 'let' | 'fout' | 'goed'; titel: string; children?: ReactNode }) {
  const stijl = {
    let: { klasse: 'border-amber-700 bg-amber-50 text-amber-950', Icoon: Let },
    fout: { klasse: 'border-rose-700 bg-rose-50 text-rose-950', Icoon: Fout },
    goed: { klasse: 'border-emerald-700 bg-emerald-50 text-emerald-950', Icoon: Zegel },
  }[soort];
  return (
    <div className={`flex gap-3 rounded-xl border-l-4 p-3 ${stijl.klasse}`}>
      <stijl.Icoon className="mt-0.5 shrink-0" width={22} height={22} />
      <div>
        <p className="font-semibold">{titel}</p>
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
    </div>
  );
}

let eersteScherm = true;

/** Schermkop: klein label met de schermnaam en de hoofdvraag als kop. Krijgt focus bij wisselen van scherm. */
export function Kop({ label, vraag, children }: { label: string; vraag: string; children?: ReactNode }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    document.title = `${label} · Studietracker (DEMO)`;
    if (!eersteScherm) ref.current?.focus();
    eersteScherm = false;
  }, [label, vraag]);
  return (
    <header className="mb-5">
      <p className="text-sm font-semibold tracking-wide text-stone-600 uppercase">{label}</p>
      <h1 ref={ref} tabIndex={-1} className="mt-1 text-2xl leading-tight font-bold text-balance outline-none sm:text-3xl">
        {vraag}
      </h1>
      {children && <div className="mt-2 text-stone-700">{children}</div>}
    </header>
  );
}

export function Kaart({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`kaart rounded-2xl border border-stone-300 bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export const knop =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-50';
export const hoofdknop = `${knop} bg-stone-900 text-white hover:bg-stone-700`;
export const tweedeKnop = `${knop} border-2 border-stone-800 bg-white text-stone-900 hover:bg-stone-100`;

export function DemoLabel() {
  return (
    <span className="rounded-md border-2 border-dashed border-rose-800 px-1.5 py-0.5 text-xs font-bold tracking-widest text-rose-800">DEMO</span>
  );
}

export function Voettekst() {
  return (
    <footer className="mx-auto mt-10 max-w-xl px-4 pb-6 text-sm text-stone-700 print-breed">
      <p className="font-semibold">Dit is een ontwikkeloverzicht, geen examinering.</p>
      <p className="mt-1">
        <DemoLabel /> Proefversie met verzonnen opdrachten en koppelingen. Geen officieel onderwijsprogramma.
      </p>
    </footer>
  );
}
