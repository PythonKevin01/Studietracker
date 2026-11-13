/** Pictogrammen. Altijd decoratief (aria-hidden): de tekst ernaast draagt de betekenis. */
import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const basis = (p: P): P => ({ width: 20, height: 20, viewBox: '0 0 24 24', 'aria-hidden': true, focusable: false, ...p });

export const Leeg = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8.5" /></svg>
);
export const Half = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none" />
  </svg>
);
export const ZelfGemeld = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.4" />
    <path d="m8 12.3 2.7 2.7L16.2 9.5" />
  </svg>
);
/** Zegel: rozet met vinkje. */
export const Zegel = (p: P) => (
  <svg {...basis(p)}>
    <path
      fill="currentColor"
      d="M12 1.8l2.1 1.6 2.6-.3 1 2.4 2.4 1-.3 2.6 1.6 2.1-1.6 2.1.3 2.6-2.4 1-1 2.4-2.6-.3L12 20.6l-2.1-1.6-2.6.3-1-2.4-2.4-1 .3-2.6L2.6 11.2l1.6-2.1-.3-2.6 2.4-1 1-2.4 2.6.3z"
    />
    <path d="m8.1 11.4 2.7 2.7 5.1-5.2" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
export const Let = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 3 2.5 20h19z" strokeLinejoin="round" />
    <path d="M12 9.5v4.5M12 17v.01" />
  </svg>
);
export const Fout = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="8.5" />
    <path d="m9 9 6 6m0-6-6 6" />
  </svg>
);
export const Huis = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M3.5 11 12 4l8.5 7v9h-5.5v-5.5h-6V20H3.5z" /></svg>
);
export const Dossier = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M3.5 6.5h6l2 2h9v11h-17z" />
    <path d="M7.5 13h9M7.5 16h6" strokeLinecap="round" />
  </svg>
);
export const Scan = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
    <path d="M8 12h8" />
  </svg>
);
export const Rapport = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
    <path d="M6 3.5h8.5L19 8v12.5H6z" />
    <path d="M14 3.5V8h5M9 12.5h7M9 16h7" strokeLinecap="round" />
  </svg>
);
export const Pijl = (p: P) => (
  <svg {...basis(p)} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 5 7 7-7 7" /></svg>
);
