import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileWarning, Sparkles, UploadCloud, XCircle } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { PageHeader, SimulatedNote } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { downloadFile, cn } from '../../lib/util';
import { useData } from '../../store/data';
import { toast } from '../../store/toast';
import { sampleWithErrors, simulateExcel, templates, validateCsv, type Report } from './upload/validate';

export default function Upload() {
  const facultyList = useData((s) => s.facultyList);
  const subjectList = useData((s) => s.subjectList);
  const roomList = useData((s) => s.roomList);
  const sectionList = useData((s) => s.sectionList);
  const logAction = useData((s) => s.logAction);
  const ref = useMemo(() => ({ faculty: facultyList, subjects: subjectList, rooms: roomList, sections: sectionList }), [facultyList, subjectList, roomList, sectionList]);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [imported, setImported] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = async (file: File) => {
    setError(null);
    setImported(false);
    const name = file.name.toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      setReport(simulateExcel(file.name, file.size, ref));
      return;
    }
    if (!name.endsWith('.csv')) {
      setReport(null);
      setError('Please upload an Excel (.xlsx, .xls) or CSV file.');
      return;
    }
    const text = await file.text();
    const res = validateCsv(file.name, text, ref);
    if ('error' in res) {
      setReport(null);
      setError(res.error);
    } else setReport(res);
  };

  const errors = report?.issues.filter((i) => i.severity === 'error').length ?? 0;
  const warnings = report?.issues.filter((i) => i.severity === 'warning').length ?? 0;
  const duplicates = report?.issues.filter((i) => i.message.startsWith('Duplicate')).length ?? 0;
  const missing = report?.issues.filter((i) => /Missing|Unknown/.test(i.message)).length ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Data Upload"
        docTitle="Data Upload"
        description="Drop the committee's Excel or CSV sheet. It is checked in your browser for missing codes, unknown faculty and rooms, and duplicate slots before anything is imported."
        actions={<SimulatedNote>Excel parsing and import are simulated; CSV checks are real</SimulatedNote>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files[0];
              if (f) void handle(f);
            }}
            className={cn(
              'flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors',
              drag ? 'border-primary-ink bg-primary-soft' : 'border-line-strong bg-surface',
            )}
          >
            <span className="grid size-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
              <UploadCloud className="size-6" aria-hidden />
            </span>
            <p className="mt-4 text-[16px] font-semibold text-ink">Drag and drop your timetable sheet</p>
            <p className="mt-1 text-[13px] text-muted">.xlsx, .xls or .csv · checked locally, nothing is uploaded</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="primary" icon={<FileSpreadsheet />} onClick={() => inputRef.current?.click()}>
                Choose a file
              </Button>
              <Button
                variant="secondary"
                icon={<Sparkles />}
                onClick={() => {
                  setError(null);
                  setImported(false);
                  const res = validateCsv('sample_with_errors.csv', sampleWithErrors(ref), ref);
                  if (!('error' in res)) setReport(res);
                }}
              >
                Try a sample file
              </Button>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="sr-only"
              aria-label="Choose a timetable file"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handle(f);
                e.target.value = '';
              }}
            />
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-critical-line bg-critical-soft px-4 py-3 text-[13px] text-critical">
              <XCircle className="size-4 shrink-0" aria-hidden /> {error}
            </p>
          )}

          {report && (
            <Card className="animate-fade-up">
              <CardHeader
                title={`Validation report · ${report.fileName}`}
                description={`${report.kind} · ${errors} error${errors === 1 ? '' : 's'}, ${warnings} warning${warnings === 1 ? '' : 's'}${report.simulated ? ' · Excel contents simulated for the demo' : ''}`}
                icon={<FileWarning />}
                actions={
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={imported || report.valid === 0}
                    onClick={() => {
                      setImported(true);
                      logAction('Imported data (simulated)', report.fileName, undefined, `${report.valid} valid rows, ${errors} skipped`);
                      toast.success(`Imported ${report.valid} rows (simulated)`, `${errors} row${errors === 1 ? '' : 's'} with errors were skipped. Recorded in the audit trail.`);
                    }}
                  >
                    {imported ? 'Imported' : `Import ${report.valid} valid rows`}
                  </Button>
                }
              />
              <CardBody className="space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ['Rows', report.rows, 'text-ink'],
                    ['Valid', report.valid, 'text-success'],
                    ['Errors', errors, errors ? 'text-critical' : 'text-ink'],
                    ['Missing codes', missing, missing ? 'text-critical' : 'text-ink'],
                    ['Duplicates', duplicates, duplicates ? 'text-warning' : 'text-ink'],
                  ].map(([l, v, c]) => (
                    <div key={l as string} className="rounded-xl border border-line px-3 py-2">
                      <p className="text-[11.5px] text-muted">{l}</p>
                      <p className={cn('font-display-tight tabular text-[26px] leading-tight', c as string)}>{v as number}</p>
                    </div>
                  ))}
                </div>
                {report.issues.length === 0 ? (
                  <p className="flex items-center gap-2 rounded-xl border border-success-line bg-success-soft px-3 py-2.5 text-[13px] font-medium text-success">
                    <CheckCircle2 className="size-4" aria-hidden /> No problems found. Ready to import.
                  </p>
                ) : (
                  <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-xl border border-line">
                    {report.issues.map((i, k) => (
                      <li key={k} className="flex items-start gap-2.5 px-3 py-2 text-[12.5px]">
                        {i.severity === 'error' ? <XCircle className="mt-0.5 size-3.5 shrink-0 text-critical" aria-label="Error" /> : <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-icon" aria-label="Warning" />}
                        <span className="tabular w-14 shrink-0 font-semibold text-ink">Row {i.row}</span>
                        <Badge tone="neutral">{i.column}</Badge>
                        <span className="text-ink-2">{i.message}</span>
                      </li>
                    ))}
                  </ul>
                )}
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-ink">Import preview</p>
                  <div className="overflow-x-auto rounded-xl border border-line">
                    <table className="w-full min-w-[640px] border-collapse text-[12px]">
                      <caption className="sr-only">First rows of the file</caption>
                      <thead>
                        <tr className="bg-grid-head">
                          <th scope="col" className="w-10 px-2 py-2" />
                          {report.header.map((h) => (
                            <th key={h} scope="col" className="px-2.5 py-2 text-left font-semibold text-muted">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.preview.map((r, i) => (
                          <tr key={i} className={cn('border-t border-line', !r.ok && 'bg-critical-soft/60')}>
                            <td className="px-2 py-1.5 text-center">
                              {r.ok ? <CheckCircle2 className="mx-auto size-3.5 text-success" aria-label="Valid" /> : <XCircle className="mx-auto size-3.5 text-critical" aria-label="Has errors" />}
                            </td>
                            {report.header.map((_, ci) => (
                              <td key={ci} className="px-2.5 py-1.5 text-ink-2">
                                {r.cells[ci] || <span className="text-critical">empty</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader title="Sample templates" description="CSV, opens in Excel. Keep the column names." icon={<Download />} />
          <CardBody className="space-y-2">
            {templates(ref).map((t) => (
              <button
                key={t.file}
                type="button"
                onClick={() => {
                  downloadFile(t.file, t.csv, 'text/csv');
                  toast.success(`${t.label} template downloaded`, t.file);
                }}
                className="flex w-full items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
              >
                <FileSpreadsheet className="size-4 text-success" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-ink">{t.label}</span>
                  <span className="block truncate text-[11.5px] text-muted">{t.file}</span>
                </span>
                <Download className="size-4 text-muted" aria-hidden />
              </button>
            ))}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
