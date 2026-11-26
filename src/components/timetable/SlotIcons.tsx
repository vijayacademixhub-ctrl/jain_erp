import { BookOpen, FlaskConical, Layers, Lock, Mic2, Users } from 'lucide-react';
import type { SlotKind } from '../../domain/types';
import { cn } from '../../lib/util';

export function KindIcon({ kind, label, className }: { kind: SlotKind; label?: string; className?: string }) {
  const cls = cn('size-3 shrink-0', className);
  if (kind === 'Combined') return <Users className={cls} aria-hidden />;
  if (kind === 'OE' || kind === 'ME') return <Layers className={cls} aria-hidden />;
  if (kind === 'Test') return <Lock className={cls} aria-hidden />;
  if (kind === 'Fixed' && label === 'Master Talk') return <Mic2 className={cls} aria-hidden />;
  if (kind === 'Fixed') return <BookOpen className={cls} aria-hidden />;
  return null;
}

export function LabIcon({ className }: { className?: string }) {
  return <FlaskConical className={cn('size-3 shrink-0', className)} aria-hidden />;
}
