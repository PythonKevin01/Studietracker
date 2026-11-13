import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../gedeeld/stijl.css';
import { App } from './App';

createRoot(document.getElementById('app')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline werken: alleen in de gebouwde app, niet tijdens ontwikkelen.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => {
    void navigator.serviceWorker.register(new URL('../sw.js', location.href)).catch(() => undefined);
  });
}
