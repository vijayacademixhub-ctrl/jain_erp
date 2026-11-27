import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';
import { exportReportExcel, exportReportPDF } from '../../lib/report';

interface Data {
  generated_at: string;
  students_total: number; faculty_total: number; faculty_allocated: number; faculty_with_records: number;
  sections_total: number; subjects_total: number; rooms_total: number; rooms_used: number;
  tt_versions_published: number; tt_entries: number; tt_combined: number; tt_changes: number; tt_substitutions: number;
  att_sessions: number; att_records: number; att_present: number;
  assess_total: number; assess_published: number; marks_published: number;
  students_by_programme: { code: string; name: string; count: number }[];
  students_by_semester: { sem: number; count: number }[];
  verification: { pending: number; approved: number; returned: number; rejected: number };
  top_faculty_load: { code: string; name: string; classes: number }[];
}

function Card({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--brand)' }}>{value}</div>
      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{label}</div>
      {sub && <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

function Bars({ title, rows, max }: { title: string; rows: { label: string; value: number }[]; max: number }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="text-[13px] font-medium mb-3">{title}</div>
      <div className="grid gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <div className="text-[11.5px] w-40 truncate" style={{ color: 'var(--muted)' }}>{r.label}</div>
            <div className="flex-1 h-4 rounded" style={{ background: 'var(--bg)' }}>
              <div className="h-4 rounded" style={{ width: `${max ? (r.value / max) * 100 : 0}%`, background: 'var(--brand)', minWidth: r.value ? 4 : 0 }} />
            </div>
            <div className="text-[12px] w-10 text-right font-medium">{r.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Analytics() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('analytics_overview').then(({ data, error }) => { if (error) setErr(error.message); else setD(data as Data); }); }, []);

  if (err) return <Layout title="Institutional Analytics"><AdminNav /><p className="text-sm" style={{ color: '#b4473f' }}>{err}</p></Layout>;
  if (!d) return <Layout title="Institutional Analytics"><AdminNav /><p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p></Layout>;

  const attPct = d.att_records ? Math.round((d.att_present / d.att_records) * 100) : 0;
  const progMax = Math.max(1, ...d.students_by_programme.map((p) => p.count));
  const loadMax = Math.max(1, ...d.top_faculty_load.map((f) => f.classes));

  function exportSummary(kind: 'pdf' | 'excel') {
    const headers = ['Metric', 'Value'];
    const rows: (string | number)[][] = [
      ['Students', d!.students_total], ['Faculty', d!.faculty_total], ['Sections', d!.sections_total],
      ['Subjects', d!.subjects_total], ['Rooms (used/total)', `${d!.rooms_used}/${d!.rooms_total}`],
      ['Published timetable classes', d!.tt_entries], ['Combined classes', d!.tt_combined],
      ['Daily changes (substitutions)', `${d!.tt_changes} (${d!.tt_substitutions})`],
      ['Attendance sessions', d!.att_sessions], ['Attendance %', `${attPct}%`],
      ['Assessments (published)', `${d!.assess_total} (${d!.assess_published})`], ['Marks published', d!.marks_published],
      ['Records pending verification', d!.verification.pending], ['Records approved', d!.verification.approved],
      ...d!.students_by_programme.map((p) => [`Students · ${p.name}`, p.count] as (string | number)[]),
    ];
    const sub = `CMS Business School · generated ${new Date(d!.generated_at).toLocaleString()}`;
    if (kind === 'pdf') exportReportPDF('Institutional Analytics', sub, headers, rows, 'All figures derive from authorised live records at the generated time.');
    else exportReportExcel('Institutional_Analytics', headers, rows);
  }

  return (
    <Layout title="Institutional Analytics">
      <AdminNav />
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>Live · generated {new Date(d.generated_at).toLocaleString()}</span>
        <div className="flex-1" />
        <button onClick={() => exportSummary('pdf')} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--brand)' }}>PDF</button>
        <button onClick={() => exportSummary('excel')} className="text-[12.5px] rounded px-3 py-1.5 font-medium" style={{ border: '1px solid var(--line)' }}>Excel</button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Card label="Students" value={d.students_total} />
        <Card label="Faculty" value={d.faculty_total} sub={`${d.faculty_allocated} allocated`} />
        <Card label="Sections" value={d.sections_total} />
        <Card label="Subjects" value={d.subjects_total} />
        <Card label="Published classes" value={d.tt_entries} sub={`${d.tt_combined} combined`} />
        <Card label="Rooms used" value={`${d.rooms_used}/${d.rooms_total}`} />
        <Card label="Attendance %" value={`${attPct}%`} sub={`${d.att_sessions} sessions`} />
        <Card label="Records verified" value={d.verification.approved} sub={`${d.verification.pending} pending`} />
      </div>

      <div className="grid md:grid-cols-2 gap-3 mb-4">
        <Bars title="Students by programme" max={progMax}
          rows={d.students_by_programme.map((p) => ({ label: p.name, value: p.count }))} />
        <Bars title="Faculty teaching load (top 8, weekly classes)" max={loadMax}
          rows={d.top_faculty_load.map((f) => ({ label: `${f.name} (${f.code})`, value: f.classes }))} />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="text-[13px] font-medium mb-3">Record verification</div>
          {([['Pending', d.verification.pending, 'var(--muted)'], ['Approved', d.verification.approved, 'var(--accent)'],
             ['Returned', d.verification.returned, '#c98a2b'], ['Rejected', d.verification.rejected, '#b4473f']] as [string, number, string][])
            .map(([l, n, c]) => (
            <div key={l} className="flex items-center justify-between py-1 text-[13px]" style={{ borderBottom: '1px solid var(--line)' }}>
              <span>{l}</span><span className="font-semibold" style={{ color: c }}>{n}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="text-[13px] font-medium mb-3">Students by semester</div>
          {d.students_by_semester.map((s) => (
            <div key={s.sem} className="flex items-center justify-between py-1 text-[13px]" style={{ borderBottom: '1px solid var(--line)' }}>
              <span>{s.sem}th Semester</span><span className="font-semibold">{s.count}</span>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
