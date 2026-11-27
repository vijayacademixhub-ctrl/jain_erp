import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';
import { exportReportExcel, exportReportPDF } from '../../lib/report';
import { BarList, Donut, Card as Panel, CHART_COLORS } from '../../components/MiniCharts';

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

function Kpi({ label, value, accent, sub, to }: { label: string; value: number | string; accent: string; sub?: string; to?: string }) {
  const inner = (
    <div className="rounded-xl overflow-hidden flex h-full transition-transform hover:-translate-y-0.5" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div className="p-4">
        <div className="text-2xl font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
        <div className="text-[12px] mt-0.5 flex items-center gap-1" style={{ color: 'var(--muted)' }}>{label}{to && <span style={{ color: accent }}>›</span>}</div>
        {sub && <div className="text-[11px] mt-0.5" style={{ color: 'var(--muted)' }}>{sub}</div>}
      </div>
    </div>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}

export default function Analytics() {
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { supabase.rpc('analytics_overview').then(({ data, error }) => { if (error) setErr(error.message); else setD(data as Data); }); }, []);

  if (err) return <Layout title="Institutional Analytics"><AdminNav /><p className="text-sm" style={{ color: '#b4473f' }}>{err}</p></Layout>;
  if (!d) return <Layout title="Institutional Analytics"><AdminNav /><p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p></Layout>;

  const attPct = d.att_records ? Math.round((d.att_present / d.att_records) * 100) : 0;
  const roomPct = d.rooms_total ? Math.round((d.rooms_used / d.rooms_total) * 100) : 0;

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
        <button onClick={() => exportSummary('pdf')} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--accent)' }}>PDF</button>
        <button onClick={() => exportSummary('excel')} className="text-[12.5px] rounded px-3 py-1.5 font-medium" style={{ border: '1px solid var(--line)' }}>Excel</button>
      </div>

      {/* colour-accented, clickable KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi label="Students" value={d.students_total} accent="#1f3864" to="/admin/students" />
        <Kpi label="Faculty" value={d.faculty_total} accent="#3d8168" sub={`${d.faculty_allocated} allocated`} to="/admin/faculty" />
        <Kpi label="Sections" value={d.sections_total} accent="#c08a2d" to="/admin/sections" />
        <Kpi label="Subjects" value={d.subjects_total} accent="#7a4fb0" to="/admin/subjects" />
        <Kpi label="Published classes" value={d.tt_entries} accent="#2d7d9a" sub={`${d.tt_combined} combined`} />
        <Kpi label="Rooms in use" value={`${roomPct}%`} accent="#4a7a3a" sub={`${d.rooms_used}/${d.rooms_total}`} to="/admin/rooms" />
        <Kpi label="Attendance" value={`${attPct}%`} accent="#b4473f" sub={`${d.att_sessions} sessions`} />
        <Kpi label="Records verified" value={d.verification.approved} accent="#8a6d3b" sub={`${d.verification.pending} pending`} to="/committee/verify" />
      </div>

      <div className="grid lg:grid-cols-3 gap-3 mb-4">
        <Panel title="Students by programme" right={<Link to="/admin/students" className="text-[12px]" style={{ color: 'var(--brand)' }}>Open ›</Link>}>
          <BarList data={d.students_by_programme.map((p) => ({ label: p.code, sub: p.name, value: p.count, href: '/admin/students' }))} />
        </Panel>
        <Panel title="Record verification" right={<Link to="/committee/verify" className="text-[12px]" style={{ color: 'var(--brand)' }}>Review ›</Link>}>
          <Donut data={[
            { label: 'Approved', value: d.verification.approved, color: '#3d8168' },
            { label: 'Pending', value: d.verification.pending, color: '#c08a2d' },
            { label: 'Returned', value: d.verification.returned, color: '#b4473f' },
            { label: 'Rejected', value: d.verification.rejected, color: '#8a8a8a' },
          ]} />
        </Panel>
        <Panel title="Busiest faculty (weekly classes)" right={<Link to="/admin/workload" className="text-[12px]" style={{ color: 'var(--brand)' }}>Workload ›</Link>}>
          <BarList data={d.top_faculty_load.map((f) => ({ label: f.code, sub: f.name, value: f.classes }))} />
        </Panel>
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Panel title="Students by semester">
          <BarList data={d.students_by_semester.map((s) => ({ label: `Sem ${s.sem}`, value: s.count }))} />
        </Panel>
        <Panel title="Timetable & changes">
          <BarList data={[
            { label: 'Published classes', value: d.tt_entries },
            { label: 'Combined classes', value: d.tt_combined },
            { label: 'Daily changes', value: d.tt_changes },
            { label: 'Substitutions', value: d.tt_substitutions },
          ]} />
        </Panel>
        <Panel title="Assessment & marks">
          <BarList data={[
            { label: 'Assessments', value: d.assess_total },
            { label: 'Published', value: d.assess_published },
            { label: 'Marks published', value: d.marks_published },
            { label: 'Attendance sessions', value: d.att_sessions },
          ]} />
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[['Allocated faculty', d.faculty_allocated, CHART_COLORS[1]], ['With records', d.faculty_with_records, CHART_COLORS[3]],
          ['Rooms total', d.rooms_total, CHART_COLORS[5]], ['Published versions', d.tt_versions_published, CHART_COLORS[0]]].map(([l, v, c]) => (
          <span key={l as string} className="text-[12px] rounded-full px-3 py-1" style={{ background: 'var(--panel)', border: `1px solid ${c}`, color: c as string }}>
            {l}: <b>{v}</b>
          </span>
        ))}
      </div>
    </Layout>
  );
}
