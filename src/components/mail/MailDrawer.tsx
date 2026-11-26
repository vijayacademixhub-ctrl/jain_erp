import { CheckCheck, CheckCircle2, Mail, MessageCircle, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { APPROVERS } from '../../domain/constants';
import type { LeaveRequest, MockMail } from '../../domain/types';
import { fmtDate, fmtStamp, fmtTimeIST } from '../../lib/dates';
import { useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { Badge, StatusChip } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Controls';
import { Drawer } from '../ui/Dialog';
import { Input } from '../ui/Field';

function LeaveFacts({ leave }: { leave: LeaveRequest }) {
  const lookup = useLookup();
  const f = lookup.faculty[leave.facultyId];
  const rows: [string, string][] = [
    ['Faculty', `${f?.name} (${f?.area})`],
    ['Type', leave.type],
    ['Dates', leave.from === leave.to ? fmtDate(leave.from) : `${fmtDate(leave.from)} to ${fmtDate(leave.to)}`],
    ['Periods', leave.periods.length ? leave.periods.map((p) => `P${p}`).join(', ') : 'Full day'],
    ['Reason', leave.reason],
  ];
  return (
    <table className="my-3 w-full border-collapse overflow-hidden rounded-lg text-[13px]">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k} className="border-b border-line last:border-b-0">
            <th scope="row" className="w-24 bg-surface-2 px-3 py-1.5 text-left font-medium text-muted">
              {k}
            </th>
            <td className="px-3 py-1.5 text-ink">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** One simulated email, rendered like a mail client would show it. */
export function MailPreview({ mail, leave }: { mail: MockMail; leave: LeaveRequest }) {
  const decideLeave = useData((s) => s.decideLeave);
  const lookup = useLookup();
  const [rejecting, setRejecting] = useState(false);
  const [remark, setRemark] = useState('');
  const f = lookup.faculty[leave.facultyId];
  const first = f?.name.replace(/^(Dr|Prof|Mr|Ms|CA|Adv)\.?\s+/, '').split(' ')[0];

  let body: React.ReactNode;
  if (mail.kind === 'leave-request') {
    const pending = leave.status === 'Pending';
    body = (
      <>
        <p>Dear {mail.toName},</p>
        <p className="mt-2">A leave request needs your decision. Approved leave flows into the Planned Leave column and the clash engine automatically.</p>
        <LeaveFacts leave={leave} />
        {pending ? (
          rejecting ? (
            <div className="space-y-2">
              <label className="block text-[12.5px] font-medium text-ink-2" htmlFor={`rej-${mail.id}`}>
                Reason for rejection
              </label>
              <Input id={`rej-${mail.id}`} value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Unit test week; please reschedule." />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  disabled={remark.trim().length < 4}
                  onClick={() => {
                    decideLeave(leave.id, 'Rejected', mail.toName, remark.trim(), 'email');
                    toast.info(`Rejected by ${mail.toName}`, 'The faculty member has been emailed the decision (simulated).');
                  }}
                >
                  Confirm reject
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>
                  Back
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="primary"
                icon={<CheckCircle2 />}
                onClick={() => {
                  decideLeave(leave.id, 'Approved', mail.toName, 'Approved via email.', 'email');
                  toast.success(`Approved by ${mail.toName}`, `${f?.name} has been sent the approval email (simulated). The leave now shows in the Planned Leave column.`);
                }}
              >
                Approve
              </Button>
              <Button size="sm" variant="secondary" icon={<XCircle />} onClick={() => setRejecting(true)}>
                Reject
              </Button>
            </div>
          )
        ) : (
          <p className="rounded-lg bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            This request was {leave.status.toLowerCase()} by {leave.decidedBy} on {fmtStamp(leave.decidedAt!)}. The buttons in this email no longer work.
          </p>
        )}
      </>
    );
  } else if (mail.kind === 'leave-receipt') {
    body = (
      <>
        <p>Dear {first},</p>
        <p className="mt-2">We have received your leave request. It has been emailed to {APPROVERS.map((a) => a.name).join(', ').replace(/, ([^,]*)$/, ' and $1')} for approval. You will get another email when a decision is made.</p>
        <LeaveFacts leave={leave} />
        <p className="text-[12.5px] text-muted">Track it any time under Faculty Portal → My leave history.</p>
      </>
    );
  } else {
    const ok = mail.kind === 'leave-approved';
    body = (
      <>
        <p>Dear {first},</p>
        <p className="mt-2">
          Your leave request has been <strong className={ok ? 'text-success' : 'text-critical'}>{ok ? 'approved' : 'rejected'}</strong> by {leave.decidedBy}.
        </p>
        {leave.remark && <p className="mt-2 rounded-lg border-l-2 border-line-strong bg-surface-2 px-3 py-2 text-ink-2">"{leave.remark}"</p>}
        <LeaveFacts leave={leave} />
        {ok && <p className="text-[12.5px] text-muted">The Timetable Committee will arrange substitutes for your classes and publish the change.</p>}
      </>
    );
  }

  return (
    <article className="animate-fade-up overflow-hidden rounded-xl border border-line bg-surface shadow-1">
      <header className="border-b border-line bg-surface-2/70 px-4 py-3 text-[12.5px]">
        <p className="text-[14px] font-semibold text-ink">{mail.subject}</p>
        <dl className="mt-1.5 grid grid-cols-[52px_1fr] gap-y-0.5 text-ink-2">
          <dt className="text-muted">From</dt>
          <dd>CMS Timetable Platform &lt;{mail.from}&gt;</dd>
          <dt className="text-muted">To</dt>
          <dd>
            {mail.toName} &lt;{mail.to}&gt;
          </dd>
          <dt className="text-muted">Date</dt>
          <dd>{fmtStamp(mail.at)}</dd>
        </dl>
      </header>
      <div className="px-4 py-3 text-[13.5px] leading-relaxed text-ink">{body}</div>
      <footer className="border-t border-line px-4 py-2 text-[11px] text-muted">Simulated email. Nothing was sent.</footer>
    </article>
  );
}

function WhatsAppPreview({ leave }: { leave: LeaveRequest }) {
  const lookup = useLookup();
  const f = lookup.faculty[leave.facultyId];
  const text =
    leave.status === 'Pending'
      ? `CMS Timetable: your ${leave.type.toLowerCase()} leave for ${fmtDate(leave.from, 'd MMM')} is with the committee. We'll message you once it's decided.`
      : `CMS Timetable: your leave for ${fmtDate(leave.from, 'd MMM')} was ${leave.status.toLowerCase()} by ${leave.decidedBy}.`;
  return (
    <div className="rounded-xl border border-line bg-[#e7ddd3] p-3 dark:bg-[#0b141a]">
      <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#3b4a54] dark:text-[#aebac1]">
        <MessageCircle className="size-3.5" aria-hidden /> WhatsApp alert to {f?.name} (simulated)
      </p>
      <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-[13px] text-[#111b21] shadow-1 dark:bg-[#005c4b] dark:text-[#e9edef]">
        {text}
        <span className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-[#667781] dark:text-[#8fa3ad]">
          {fmtTimeIST(leave.decidedAt ?? leave.submittedAt)} <CheckCheck className="size-3.5 text-[#53bdeb]" aria-hidden />
        </span>
      </div>
    </div>
  );
}

/** Mail Preview drawer: what each approver and the faculty member receive for one leave request. */
export function MailDrawer({ leaveId, onClose }: { leaveId: string | null; onClose: () => void }) {
  const leave = useData((s) => s.leaves.find((l) => l.id === leaveId));
  const mails = useData((s) => s.mails);
  const lookup = useLookup();
  const [tab, setTab] = useState<string>('Chaitra');

  const forLeave = useMemo(() => mails.filter((m) => m.leaveId === leaveId), [mails, leaveId]);
  const tabs = [...APPROVERS.map((a) => ({ id: a.name, label: a.name.split(' ')[0] })), { id: 'faculty', label: 'Faculty' }];
  const facultyMails = forLeave.filter((m) => m.kind !== 'leave-request').sort((a, b) => b.at.localeCompare(a.at));
  const approverMail = forLeave.find((m) => m.kind === 'leave-request' && m.toName === tab);

  return (
    <Drawer
      open={!!leave}
      onClose={onClose}
      title="Mail preview"
      description={leave ? `${lookup.faculty[leave.facultyId]?.name} · ${leave.type} leave · ${fmtDate(leave.from, 'd MMM')}` : undefined}
      icon={<Mail />}
      width="sm:max-w-[560px]"
    >
      {leave && (
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusChip tone={leave.status === 'Approved' ? 'success' : leave.status === 'Rejected' ? 'critical' : 'accent'} live={leave.status === 'Pending'}>
              {leave.status}
            </StatusChip>
            <span className="text-[12px] text-muted">Each approver gets their own copy. Approve or reject straight from the email.</span>
          </div>
          <Tabs label="Recipients" value={tab} onChange={setTab} items={tabs} size="sm" />
          {tab === 'faculty' ? (
            <div className="space-y-3">
              {facultyMails.map((m) => (
                <MailPreview key={m.id} mail={m} leave={leave} />
              ))}
              <WhatsAppPreview leave={leave} />
            </div>
          ) : approverMail ? (
            <MailPreview mail={approverMail} leave={leave} />
          ) : (
            <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-[13px] text-muted">
              This request was decided before mail tracking began, so there is no copy for {tab}.
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {forLeave.map((m) => (
              <Badge key={m.id} tone="neutral">
                {m.toName}: {m.kind.replace('leave-', '')}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Drawer>
  );
}
