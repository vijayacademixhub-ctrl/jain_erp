import { renderToString } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { AppRoutes } from './App';

/**
 * Build-time render of a route to static HTML (used for the landing page),
 * so the first paint never waits for JavaScript. The browser then hydrates it.
 */
export function render(url: string): string {
  return renderToString(
    <StaticRouter location={url}>
      <AppRoutes />
    </StaticRouter>,
  );
}
