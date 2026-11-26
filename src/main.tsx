import '@fontsource-variable/inter/wght.css';
import '@fontsource/instrument-serif/latin-400.css';
import './index.css';
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root')!;
const app = (
  <StrictMode>
    <App />
  </StrictMode>
);

// The landing page ships pre-rendered HTML: hydrate it. Every other route starts from an empty root.
if (root.firstElementChild) hydrateRoot(root, app);
else createRoot(root).render(app);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}
