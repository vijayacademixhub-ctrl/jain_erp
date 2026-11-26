import { Suspense, useEffect } from 'react';
import { Outlet } from 'react-router';
import { Pages } from '../../routes';
import { useUi } from '../../store/ui';
import { Toaster } from '../ui/Toaster';
import { Header } from './Header';
import { PageSkeleton } from './PageSkeleton';

export function RootLayout() {
  const paletteOpen = useUi((s) => s.paletteOpen);
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUi.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-[80] rounded-lg bg-primary px-3 py-2 text-sm font-medium text-on-primary focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <Header />
      {/* At least one screen tall, so the footer never sits in view while a route loads (no layout shift). */}
      <main id="main" className="min-h-dvh flex-1">
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="no-print border-t border-line px-4 py-5 text-center text-xs text-muted sm:px-6">
        Front-end demo with simulated data. No real emails, WhatsApp messages or AI calls are made. CMS Business School · Jain (Deemed-to-be) University · Lalbagh Campus
      </footer>
      <Toaster />
      {paletteOpen && (
        <Suspense fallback={null}>
          <Pages.CommandPalette onClose={() => setPaletteOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}
