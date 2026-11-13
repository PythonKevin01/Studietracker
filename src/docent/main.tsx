import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../gedeeld/stijl.css';
import { DocentApp } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <DocentApp />
  </StrictMode>,
);
