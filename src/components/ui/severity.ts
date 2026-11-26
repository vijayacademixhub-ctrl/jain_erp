import { AlertOctagon, AlertTriangle, Info } from 'lucide-react';
import type { Severity } from '../../domain/types';

export type Tone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'critical' | 'advisory';

/** Severity always pairs a colour with an icon and a text label (never colour alone). */
export const SEVERITY_META: Record<Severity, { label: string; tone: Tone; Icon: typeof Info }> = {
  critical: { label: 'Critical', tone: 'critical', Icon: AlertOctagon },
  warning: { label: 'Warning', tone: 'warning', Icon: AlertTriangle },
  advisory: { label: 'Advisory', tone: 'advisory', Icon: Info },
};
