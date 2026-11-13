import { useEffect, useState } from 'react';

export type Route =
  | { scherm: 'overzicht' }
  | { scherm: 'cursussen' }
  | { scherm: 'cursus'; cursusId: string }
  | { scherm: 'code' }
  | { scherm: 'rapport' };

export function leesRoute(hash: string): Route {
  const delen = hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  switch (delen[0]) {
    case 'cursussen':
      return { scherm: 'cursussen' };
    case 'cursus':
      return delen[1] ? { scherm: 'cursus', cursusId: decodeURIComponent(delen[1]) } : { scherm: 'cursussen' };
    case 'code':
      return { scherm: 'code' };
    case 'rapport':
      return { scherm: 'rapport' };
    default:
      return { scherm: 'overzicht' };
  }
}

/** Een link uit een QR-code of mail ziet eruit als …/student/#code=… */
export function codeUitHash(hash: string): string | null {
  return /^#code=([A-Za-z0-9_-]+)/.exec(hash)?.[1] ?? null;
}

export function ga(hash: string) {
  if (location.hash !== hash) location.hash = hash;
}

export function useRoute(opCode: (code: string) => void): Route {
  const [route, zetRoute] = useState<Route>(() => leesRoute(location.hash));
  useEffect(() => {
    const verwerk = () => {
      const code = codeUitHash(location.hash);
      if (code) {
        // De code niet in de adresbalk of geschiedenis laten staan.
        history.replaceState(null, '', '#/code');
        opCode(code);
      }
      zetRoute(leesRoute(location.hash));
    };
    verwerk();
    addEventListener('hashchange', verwerk);
    return () => removeEventListener('hashchange', verwerk);
  }, [opCode]);
  return route;
}
