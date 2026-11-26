import { Archive, CalendarClock, DatabaseBackup, Download, FileCheck2, ShieldAlert, Trash2, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { PageHeader, SimulatedNote } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Input } from '../../components/ui/Field';
import { fmtDate, fmtStamp } from '../../lib/dates';
import { downloadFile } from '../../lib/util';
import { useData } from '../../store/data';
import { toast } from '../../store/toast';

export default function Backup() {
  const exportBackup = useData((s) => s.exportBackup);
  const term = useData((s) => s.term);
  const today = useData((s) => s.today);
  const termDeletion = useData((s) => s.termDeletion);
  const requestTermDeletion = useData((s) => s.requestTermDeletion);
  const cancelTermDeletion = useData((s) => s.cancelTermDeletion);
  const logAction = useData((s) => s.logAction);
  const counts = useData(useShallow((s) => ({ slots: Object.keys(s.slots).length, leaves: s.leaves.length, changes: s.changes.length, audit: s.audit.length })));
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [recordOpen, setRecordOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const termCode = `DELETE ${term.start.slice(0, 4)}-${term.name.startsWith('Odd') ? 'ODD' : 'EVEN'}`;

  const backup = () => {
    const json = exportBackup();
    downloadFile(`cms-timetable-backup-${today}.json`, json, 'application/json');
    const kb = Math.round(new Blob([json]).size / 1024);
    setLastBackup(new Date().toISOString());
    logAction('Downloaded JSON backup', 'All modules', undefined, `${kb} KB`);
    toast.success('Backup downloaded', `cms-timetable-backup-${today}.json · ${kb} KB of real local state.`);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Backup & Year-End"
        docTitle="Backup & Year-End"
        description="Keep a copy of everything, file the record copy at term end, and clear a finished term safely."
        actions={<SimulatedNote>Record copy and deletion are simulated</SimulatedNote>}
      />

      {termDeletion && (
        <div role="status" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-critical-line bg-critical-soft px-4 py-3 text-[13px] text-critical">
          <CalendarClock className="size-4 shrink-0" aria-hidden />
          <span>
            <strong>{termDeletion.term}</strong> is scheduled for deletion on <strong>{fmtDate(termDeletion.purgeOn)}</strong>. Data stays readable until then.
          </span>
          <Button
            size="sm"
            variant="secondary"
            icon={<Undo2 />}
            className="ml-auto"
            onClick={() => {
              cancelTermDeletion();
              toast.success('Deletion cancelled', 'The term stays as it is.');
            }}
          >
            Cancel deletion
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="JSON backup" description="Real download of the local state" icon={<DatabaseBackup />} />
          <CardBody>
            <ul className="mb-4 space-y-1 text-[13px] text-ink-2">
              <li>{counts.slots} master slots and published snapshots</li>
              <li>{counts.leaves} leave requests, {counts.changes} daily changes</li>
              <li>Bookings, memories, mail log, {counts.audit} session audit entries</li>
            </ul>
            <Button variant="primary" icon={<Download />} onClick={backup}>
              Download JSON backup
            </Button>
            <p className="mt-2 text-[12px] text-muted">{lastBackup ? `Last downloaded ${fmtStamp(lastBackup)}` : 'Not downloaded in this session yet.'}</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Record copy" description="For the University archive" icon={<Archive />} />
          <CardBody>
            <p className="mb-4 text-[13px] text-ink-2">At term end, the final published master, every daily change and the audit log are bundled as a signed record copy.</p>
            <Button variant="secondary" icon={<FileCheck2 />} onClick={() => setRecordOpen(true)}>
              Prepare record copy
            </Button>
          </CardBody>
        </Card>

        <Card className="border-critical-line">
          <CardHeader title="Delete term data" description="Year-end clean-up" icon={<ShieldAlert />} />
          <CardBody>
            <p className="mb-4 text-[13px] text-ink-2">
              Removes {term.name} after a <strong>30-day grace period</strong>. Take a backup and a record copy first.
            </p>
            <Button variant="danger" icon={<Trash2 />} onClick={() => setDeleteOpen(true)} disabled={!!termDeletion}>
              {termDeletion ? 'Deletion scheduled' : 'Delete term…'}
            </Button>
          </CardBody>
        </Card>
      </div>

      <Dialog
        open={recordOpen}
        onClose={() => setRecordOpen(false)}
        title="Prepare record copy"
        description={`${term.name} · ${fmtDate(term.start, 'd MMM')} to ${fmtDate(term.end, 'd MMM yyyy')}`}
        icon={<Archive />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecordOpen(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                logAction('Prepared record copy (simulated)', term.name, undefined, 'Bundle queued for archive');
                setRecordOpen(false);
                toast.success('Record copy prepared (simulated)', 'In production this is filed to the University records system and acknowledged by email.');
              }}
            >
              Prepare (simulated)
            </Button>
          </>
        }
      >
        <ul className="space-y-2 text-[13px] text-ink-2">
          {['Final published master snapshot (PDF and JSON)', 'All daily publications with change log', 'Approved leave register', 'Complete audit trail with IST timestamps', 'Checksum and committee sign-off page'].map((x) => (
            <li key={x} className="flex items-center gap-2">
              <FileCheck2 className="size-4 text-success" aria-hidden /> {x}
            </li>
          ))}
        </ul>
        <p className="mt-4">
          <Badge tone="accent">Placeholder</Badge> <span className="text-[12.5px] text-muted">The archive integration is part of the production build.</span>
        </p>
      </Dialog>

      <Dialog
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setTyped('');
        }}
        tone="danger"
        icon={<ShieldAlert />}
        title={`Delete ${term.name}?`}
        description="This schedules permanent deletion of the term's timetable, changes, leave and bookings."
        footer={
          <>
            <Button variant="ghost" onClick={() => (setDeleteOpen(false), setTyped(''))}>
              Keep the term
            </Button>
            <Button
              variant="danger"
              disabled={typed.trim() !== termCode}
              onClick={() => {
                requestTermDeletion();
                setDeleteOpen(false);
                setTyped('');
                toast.warning('Term scheduled for deletion', 'You can cancel any time in the next 30 days.');
              }}
            >
              Schedule deletion
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-[13px] text-ink-2">
          <p className="rounded-xl border border-critical-line bg-critical-soft px-3 py-2.5 text-critical">
            A 30-day grace period applies. Nothing is removed before {fmtDate(new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10))}, and the deletion can be cancelled until then.
          </p>
          <Field label={<>Type <code className="rounded bg-surface-2 px-1 font-semibold text-ink">{termCode}</code> to confirm</>}>
            {(p) => <Input {...p} data-autofocus value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />}
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
