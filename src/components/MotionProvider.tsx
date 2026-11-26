import { LazyMotion, MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

const loadFeatures = () => import('../lib/motion').then((m) => m.default);

/** Animation features load lazily and only inside the screens that animate, never in the entry bundle. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
