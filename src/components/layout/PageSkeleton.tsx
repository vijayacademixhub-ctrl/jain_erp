import { useDelayedFlag } from '../../lib/hooks';
import { Skeleton } from '../ui/Skeleton';

/** Route-level placeholder. Appears only if loading takes longer than ~120 ms. */
export function PageSkeleton() {
  const show = useDelayedFlag(true, 120);
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-8 sm:px-6" aria-busy="true" aria-label="Loading">
      {show && (
        <div className="animate-fade">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-3 h-9 w-72 max-w-full" />
          <Skeleton className="mt-2 h-4 w-96 max-w-full" />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="mt-4 h-80" />
        </div>
      )}
    </div>
  );
}
