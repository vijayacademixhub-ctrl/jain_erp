import { ClipboardList, Mail } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../../components/layout/PageHeader';
import { MailDrawer } from '../../components/mail/MailDrawer';
import { Badge, StatusChip } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/Controls';
import { fmtDate, fmtStamp } from '../../lib/dates';
import { useData } from '../../store/data';
import { useUi } from '../../store/ui';

export default function LeaveHistory() {
  const facultyId = useUi((s) => s.facultyId);
  const leaves = useData((s) => s.leaves);
  const f = useData((s) => s.faculty[facultyId]);
  const [mailFor, setMailFor] = useState<string | null>(null);
  const mine = leaves.filter((l) => l.facultyId === facultyId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return (
    <div>
      <PageHeader eyebrow="My leave history" title="Leave history" docTitle="My Leave History" description={`Every request ${f?.name ?? ''} has made this term, with the decision and the emails sent.`} />
      <Card>
        {mine.length === 0 ? (
          <EmptyState
            icon={<ClipboardList />}
            title="No leave requests yet"
            action={
              <Link to="/faculty/leave" className="inline-flex h-9 items-center rounded-[10px] bg-primary px-3.5 text-sm font-medium text-on-primary hover:bg-primary-hover">
                Apply for leave
              </Link>
            }
          >
            Requests you submit appear here with their status.
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[13px]">
              <caption className="sr-only">Leave requests</caption>
              <thead>
                <tr className="border-b border-line bg-grid-head text-[11.5px] tracking-[0.04em] text-muted uppercase">
                  <th scope="col" className="px-5 py-2.5 font-semibold">
                    Dates
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Reason
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Decision
                  </th>
                  <th scope="col" className="px-5 py-2.5">
                    <span className="sr-only">Emails</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mine.map((l) => (
                  <tr key={l.id} className="border-b border-line last:border-b-0">
                    <td className="px-5 py-3 font-medium text-ink">
                      {l.from === l.to ? fmtDate(l.from, 'EEE d MMM') : `${fmtDate(l.from, 'd MMM')} – ${fmtDate(l.to, 'd MMM')}`}
                      {l.periods.length > 0 && <span className="block text-[11.5px] font-normal text-muted">P{l.periods.join(', P')}</span>}
                    </td>
                    <td className="px-3 py-3">
                      <Badge tone={l.type === 'Planned' ? 'primary' : 'accent'}>{l.type}</Badge>
                    </td>
                    <td className="max-w-[260px] px-3 py-3 text-ink-2">{l.reason}</td>
                    <td className="px-3 py-3">
                      <StatusChip tone={l.status === 'Approved' ? 'success' : l.status === 'Rejected' ? 'critical' : 'accent'} live={l.status === 'Pending'}>
                        {l.status}
                      </StatusChip>
                    </td>
                    <td className="px-3 py-3 text-[12px] text-muted">
                      {l.decidedBy ? (
                        <>
                          {l.decidedBy} · {fmtStamp(l.decidedAt!)}
                          {l.remark && <span className="block text-ink-2">"{l.remark}"</span>}
                        </>
                      ) : (
                        `Submitted ${fmtStamp(l.submittedAt)}`
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="ghost" icon={<Mail />} onClick={() => setMailFor(l.id)}>
                        Emails
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <MailDrawer leaveId={mailFor} onClose={() => setMailFor(null)} />
    </div>
  );
}
