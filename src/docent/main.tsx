import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../gedeeld/stijl.css';
import { DemoLabel, Kop, Voettekst } from '../gedeeld/onderdelen';

// Stap 3: sleutelbeheer, klaslijst, codes maken en rapporten inlezen.
createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <main className="mx-auto max-w-xl px-4 pt-6">
      <DemoLabel />
      <Kop label="Docent" vraag="De docentpagina volgt in stap 3" />
    </main>
    <Voettekst />
  </StrictMode>,
);
