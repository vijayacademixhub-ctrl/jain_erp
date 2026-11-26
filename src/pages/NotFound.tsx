import { Compass } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';

export function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · CMS Timetable Platform';
  }, []);
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center px-6 py-24 text-center">
      <div className="grid size-14 place-items-center rounded-2xl border border-line bg-surface text-primary-ink shadow-1">
        <Compass className="size-6" aria-hidden />
      </div>
      <h1 className="font-display-tight mt-6 text-4xl text-ink">This page isn't on the timetable</h1>
      <p className="mt-3 text-[15px] text-ink-2">The link may be old, or the page may have moved. Head back and pick a starting point.</p>
      <Link to="/" className="mt-6 inline-flex h-10 items-center rounded-[10px] bg-primary px-4 text-sm font-medium text-on-primary hover:bg-primary-hover">
        Back to home
      </Link>
    </div>
  );
}
