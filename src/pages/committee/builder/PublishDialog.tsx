import { ShieldAlert, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { SeverityBadge } from '../../../components/ui/Badge';
import { SEVERITY_META } from '../../../components/ui/severity';
import { Button } from '../../../components/ui/Button';
import { Dialog } from '../../../components/ui/Dialog';
import { Field, Textarea } from '../../../components/ui/Field';
import { cn } from '../../../lib/util';
import { useData } from '../../../store/data';
import { toast } from '../../../store/toast';
import { useBuilderUi } from './builderUi';

const MIN_REASON = 15;

export function PublishDialog() {
  const open = useBuilderUi((s) => s.publishOpen);
  const override = useBuilderUi((s) => s.overrideMode);
  const set = useBuilderUi((s) => s.set);
  const counts = useData((s) => s.clashCounts);
  const list = useData((s) => s.clashList);
  const snapshots = useData((s) => s.snapshots);
  const publishMaster = useData((s) => s.publishMaster);
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const next = (snapshots[snapshots.length - 1]?.version ?? 0) + 1;
  const blocked = counts.critical > 0;
  const reasonError = override && blocked && reason.trim().length < MIN_REASON ? `Type at least ${MIN_REASON} characters so the audit log explains the override.` : undefined;

  const close = () => {
    set({ publishOpen: false, overrideMode: false });
    setReason('');
    setTouched(false);
  };

  const publish = () => {
    if (blocked && !override) return;
    if (reasonError) {
      setTouched(true);
      return;
    }
    const snap = publishMaster(blocked ? reason.trim() : undefined);
    if (!snap) return;
    toast.success(`Published master v${snap.version}`, `${snap.summary.critical} critical, ${snap.summary.warning} warnings, ${snap.summary.advisory} advisory. Faculty and student views now read v${snap.version}.`);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      icon={override && blocked ? <ShieldAlert /> : <UploadCloud />}
      tone={override && blocked ? 'danger' : 'default'}
      title={override && blocked ? 'Admin override: publish with critical clashes' : `Publish master timetable v${next}`}
      description="Publishing creates an immutable snapshot. Faculty and student views read snapshots only, never the draft."
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant={override && blocked ? 'danger' : 'primary'} onClick={publish} disabled={blocked && !override}>
            {override && blocked ? 'Publish with override' : `Publish v${next}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-line bg-surface-2/60 p-4">
          <p className="text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">Pre-publish summary</p>
          <p className="font-display-tight mt-1 text-[26px] leading-tight text-ink">
            {counts.critical} critical, {counts.warning} warning{counts.warning === 1 ? '' : 's'}, {counts.advisory} advisory
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <SeverityBadge severity="critical" count={counts.critical} />
            <SeverityBadge severity="warning" count={counts.warning} />
            <SeverityBadge severity="advisory" count={counts.advisory} />
          </div>
        </div>

        {list.length > 0 && (
          <ul className="max-h-48 space-y-1.5 overflow-y-auto">
            {list.slice(0, 8).map((c) => {
              const m = SEVERITY_META[c.severity];
              return (
                <li key={c.id} className="flex gap-2 text-[12.5px] text-ink-2">
                  <m.Icon className={cn('mt-0.5 size-3.5 shrink-0', c.severity === 'critical' ? 'text-critical' : c.severity === 'warning' ? 'text-warning-icon' : 'text-advisory')} aria-hidden />
                  <span>
                    <span className="font-semibold text-ink">{c.title}.</span> {c.message}
                  </span>
                </li>
              );
            })}
            {list.length > 8 && <li className="text-[12px] text-muted">and {list.length - 8} more in the clash panel.</li>}
          </ul>
        )}

        {blocked && !override && (
          <p className="rounded-xl border border-critical-line bg-critical-soft px-3 py-2.5 text-[13px] text-critical">
            Publishing is blocked while critical clashes exist. Resolve them in the clash panel, or use an admin override with a written reason.
          </p>
        )}

        {blocked && override && (
          <Field label="Reason for override" hint="Stored in the audit log" error={touched ? reasonError : undefined}>
            {(p) => (
              <Textarea
                {...p}
                data-autofocus
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="e.g. Room 305 clash is resolved by the Facilities team's swap on Monday; publishing so students see the new electives."
              />
            )}
          </Field>
        )}
      </div>
    </Dialog>
  );
}
