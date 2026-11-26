import { m } from 'framer-motion';
import { Check, Clock3, Mail, MailCheck, Send, Sparkles, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader, SimulatedNote } from '../../components/layout/PageHeader';
import { MailDrawer } from '../../components/mail/MailDrawer';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Field, Input, Textarea } from '../../components/ui/Field';
import { ALL_PERIODS, APPROVERS } from '../../domain/constants';
import { leaveCovers, UNPLANNED_CUTOFF_LABEL, validateLeave, type LeaveInput } from '../../domain/leave';
import type { LeaveRequest, LeaveType, Period } from '../../domain/types';
import { addDaysISO, fmtDate, fmtTimeIST, minutesIST } from '../../lib/dates';
import { cn } from '../../lib/util';
import { dayEntries, sectionShort, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { useUi } from '../../store/ui';

export default function ApplyLeave() {
  const facultyId = useUi((s) => s.facultyId);
  const today = useData((s) => s.today);
  const submitLeave = useData((s) => s.submitLeave);
  const lookup = useLookup();
  const f = lookup.faculty[facultyId];
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [form, setForm] = useState<LeaveInput>({ type: 'Planned', from: addDaysISO(today, 1), to: addDaysISO(today, 1), periods: [], reason: '' });
  const [touched, setTouched] = useState(false);
  const errors = validateLeave(form, today, minutesIST());
  const ok = Object.keys(errors).length === 0;

  useEffect(() => setSubmittedId(null), [facultyId]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!ok || !f) return;
    const leave = submitLeave({ facultyId: f.id, ...form, reason: form.reason.trim() });
    setSubmittedId(leave.id);
    toast.success('Leave request submitted', `Emailed to ${APPROVERS.map((a) => a.name).join(', ')} (simulated).`);
  };

  if (!f) return null;
  return (
    <div>
      <PageHeader
        eyebrow="Apply for leave"
        title="Request leave"
        docTitle="Apply for Leave"
        description="Planned leave goes in at least a day ahead. Unplanned leave can be sent until the morning of the day. Only approved leave changes the timetable."
        actions={<SimulatedNote>Mail flow is simulated</SimulatedNote>}
      />
      {submittedId ? (
        <Submitted leaveId={submittedId} onAnother={() => setSubmittedId(null)} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <form onSubmit={submit} noValidate>
              <CardBody className="space-y-5 pt-5">
                <fieldset>
                  <legend className="mb-2 text-[13px] font-medium text-ink-2">Leave type</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['Planned', 'Apply 1 to 2 days ahead. Starts tomorrow or later.'],
                        ['Unplanned', `Same day until ${UNPLANNED_CUTOFF_LABEL}, or for tomorrow.`],
                      ] as [LeaveType, string][]
                    ).map(([t, hint]) => (
                      <label key={t} className={cn('flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors', form.type === t ? 'border-primary-ink bg-primary-soft' : 'border-line hover:border-line-strong')}>
                        <input
                          type="radio"
                          name="ltype"
                          className="mt-1 accent-[var(--primary)]"
                          checked={form.type === t}
                          onChange={() => setForm((x) => ({ ...x, type: t, ...(t === 'Unplanned' ? { from: today, to: today } : { from: addDaysISO(today, 1), to: addDaysISO(today, 1) }) }))}
                        />
                        <span>
                          <span className="block text-[14px] font-semibold text-ink">{t}</span>
                          <span className="block text-[12px] text-muted">{hint}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="From" error={touched ? errors.from : undefined}>
                    {(p) => <Input {...p} type="date" min={today} value={form.from} onChange={(e) => setForm((x) => ({ ...x, from: e.target.value, to: x.to < e.target.value ? e.target.value : x.to }))} />}
                  </Field>
                  <Field label="To" error={touched ? errors.to : undefined}>
                    {(p) => <Input {...p} type="date" min={form.from} value={form.to} onChange={(e) => setForm((x) => ({ ...x, to: e.target.value }))} />}
                  </Field>
                </div>
                {form.from === form.to && (
                  <fieldset>
                    <legend className="mb-2 text-[13px] font-medium text-ink-2">
                      Periods <span className="font-normal text-muted">(leave empty for the full day)</span>
                    </legend>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_PERIODS.filter((p) => p >= f.window[0] && p <= f.window[1]).map((p) => {
                        const on = form.periods.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            aria-pressed={on}
                            onClick={() => setForm((x) => ({ ...x, periods: on ? x.periods.filter((q) => q !== p) : ([...x.periods, p].sort() as Period[]) }))}
                            className={cn('h-8 w-11 rounded-lg border text-[12.5px] font-semibold transition-colors', on ? 'border-primary-ink bg-primary-soft text-primary-ink' : 'border-line text-ink-2 hover:border-line-strong')}
                          >
                            P{p}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
                <Field label="Reason" hint="Visible to the committee" error={touched ? errors.reason : undefined}>
                  {(p) => <Textarea {...p} rows={3} value={form.reason} onChange={(e) => setForm((x) => ({ ...x, reason: e.target.value }))} placeholder="e.g. Presenting a paper at a national conference." />}
                </Field>
              </CardBody>
              <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3.5">
                <p className="text-[12px] text-muted">Goes to {APPROVERS.map((a) => a.name).join(', ').replace(/, ([^,]*)$/, ' and $1')}.</p>
                <Button type="submit" variant="primary" icon={<Send />} className="ml-auto">
                  Submit request
                </Button>
              </div>
            </form>
          </Card>
          <AffectedPreview facultyId={f.id} input={form} />
        </div>
      )}
    </div>
  );
}

function AffectedPreview({ facultyId, input }: { facultyId: string; input: LeaveInput }) {
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const lookup = useLookup();
  const list = useMemo(() => {
    if (!input.from || !input.to || input.to < input.from) return [];
    const probe: LeaveRequest = { id: 'probe', facultyId, ...input, status: 'Approved', submittedAt: '' };
    const out: { date: string; label: string; period: number }[] = [];
    for (let d = input.from; d <= input.to && out.length < 30; d = addDaysISO(d, 1)) {
      for (const e of dayEntries({ snapshots, changes }, d, false)) {
        if (e.facultyId === facultyId && e.status !== 'cancelled' && leaveCovers(probe, d, e.period)) {
          out.push({ date: d, period: e.period, label: `${lookup.subjects[e.subjectId ?? '']?.code ?? e.label} · ${sectionShort(lookup, e.sectionIds)}` });
        }
      }
    }
    return out;
  }, [facultyId, input, snapshots, changes, lookup]);
  return (
    <Card className="self-start">
      <CardHeader title="Classes this would affect" description="From the published timetable" />
      <CardBody>
        {list.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-3 text-[12.5px] text-muted">No classes in this window. The committee will still be notified.</p>
        ) : (
          <ul className="space-y-1.5">
            {list.map((x, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-[12.5px]">
                <span className="tabular font-semibold text-ink">
                  {fmtDate(x.date, 'EEE')} P{x.period}
                </span>
                <span className="truncate text-ink-2">{x.label}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11.5px] text-muted">The committee will cover these with ranked substitutes once your leave is approved.</p>
      </CardBody>
    </Card>
  );
}

/** Animated mail-flow timeline: Submitted → Emailed → Pending → decision. */
function Submitted({ leaveId, onAnother }: { leaveId: string; onAnother: () => void }) {
  const leave = useData((s) => s.leaves.find((l) => l.id === leaveId));
  const [stage, setStage] = useState(0);
  const [mailOpen, setMailOpen] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setStage(3);
      return;
    }
    const timers = [setTimeout(() => setStage(1), 350), setTimeout(() => setStage(2), 1050), setTimeout(() => setStage(3), 1700)];
    return () => timers.forEach(clearTimeout);
  }, []);
  if (!leave) return null;
  const decided = leave.status !== 'Pending';
  const steps = [
    { title: 'Submitted', body: `${fmtTimeIST(leave.submittedAt)} IST · ${leave.type} leave, ${fmtDate(leave.from, 'EEE d MMM')}${leave.to !== leave.from ? ` to ${fmtDate(leave.to, 'EEE d MMM')}` : ''}`, Icon: Check },
    { title: 'Emailed to Chaitra, Krishna Koppa and Jai Shree', body: 'Each approver received an email with Approve and Reject buttons. You got a receipt.', Icon: MailCheck },
    decided
      ? { title: leave.status, body: `By ${leave.decidedBy} · ${fmtTimeIST(leave.decidedAt!)} IST${leave.remark ? ` · "${leave.remark}"` : ''}`, Icon: leave.status === 'Approved' ? Check : XCircle }
      : { title: 'Pending approval', body: 'Open the mail preview and approve as one of the approvers to see the rest of the flow.', Icon: Clock3 },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardBody className="pt-6">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-accent" aria-hidden />
            <p className="text-[13px] font-semibold text-accent-ink">Request {leave.id.toUpperCase().slice(0, 9)}</p>
            <Badge tone={leave.status === 'Approved' ? 'success' : leave.status === 'Rejected' ? 'critical' : 'accent'} className="ml-auto">
              {leave.status}
            </Badge>
          </div>
          <ol className="mt-5" aria-live="polite">
            {steps.map((s, i) => {
              const visible = stage > i || (i === 2 && stage >= 3);
              const isLast = i === steps.length - 1;
              const tone = i === 2 && decided ? (leave.status === 'Approved' ? 'bg-success text-white' : 'bg-critical text-white') : i === 2 ? 'bg-accent-soft text-accent-ink' : 'bg-primary text-on-primary';
              return (
                <m.li
                  key={s.title}
                  initial={{ opacity: 0, y: 8 }}
                  animate={visible ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="relative flex gap-4 pb-6 last:pb-0"
                >
                  {!isLast && <span aria-hidden className="absolute top-9 bottom-1 left-[17px] w-px bg-line-strong" />}
                  <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-full shadow-1', tone)}>
                    <s.Icon className="size-4" aria-hidden />
                    {i === 2 && !decided && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-accent/30" />}
                  </span>
                  <span className="pt-1">
                    <span className="block text-[14.5px] font-semibold text-ink">{s.title}</span>
                    <span className="mt-0.5 block text-[13px] text-ink-2">{s.body}</span>
                  </span>
                </m.li>
              );
            })}
          </ol>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="primary" icon={<Mail />} onClick={() => setMailOpen(true)}>
              Open mail preview
            </Button>
            <Button variant="secondary" onClick={onAnother}>
              Apply for another
            </Button>
            <Link to="/faculty/history" className="ml-auto inline-flex h-9 items-center text-[13px] font-semibold text-primary-ink hover:underline">
              My leave history
            </Link>
          </div>
        </CardBody>
      </Card>
      <Card className="self-start">
        <CardHeader title="What happens next" />
        <CardBody>
          <ul className="space-y-2.5 text-[13px] text-ink-2">
            <li>1. Any one approver decides from their email or the committee console.</li>
            <li>2. You get an approval or rejection email, plus a WhatsApp alert.</li>
            <li>3. Approved leave appears in the Planned Leave column, and the committee assigns substitutes.</li>
          </ul>
        </CardBody>
      </Card>
      <MailDrawer leaveId={mailOpen ? leave.id : null} onClose={() => setMailOpen(false)} />
    </div>
  );
}
