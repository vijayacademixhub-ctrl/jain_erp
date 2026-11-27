import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { TimetableBrowser } from '../../components/TimetableBrowser';
import { AdminNav } from '../../components/AdminNav';
import { BarList, Donut, Card, CHART_COLORS } from '../../components/MiniCharts';

interface Overview {
  students_total: number; faculty_total: number; sections_total: number; subjects_total: number;
  rooms_total: number; rooms_used: number; tt_versions_published: number; tt_entries: number;
  att_sessions: number; att_present: number; att_records: number; marks_published: number;
  students_by_programme: { code: string; name: string; count: number }[];
  students_by_semester: { sem: number; count: number }[];
  verification: { pending: number; approved: number; returned: number; rejected: number };
  top_faculty_load: { code: string; name: string; classes: number }[];
}
interface Alerts {
  pending_leaves: number; pending_tt_approvals: number; pending_verifications: number;
  pending_bookings: number; on_leave_today: number; changes_today: number; audit_today: number;
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl overflow-hidden flex" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div className="p-4">
        <div className="text-2xl font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
        <div className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
      </div>
    </div>
  );
}

function AlertChip({ to, n, label, tone }: { to: string; n: number; label: string; tone: string }) {
  const active = n > 0;
  return (
    <Link to={to} className="rounded-xl px-4 py-3 flex items-center gap-3 transition-transform hover:-translate-y-0.5"
      style={{ background: active ? tone : 'var(--panel)', border: `1px solid ${active ? tone : 'var(--line)'}`,
        color: active ? '#fff' : 'var(--muted)' }}>
      <span className="text-xl font-bold tabular-nums">{n}</span>
      <span className="text-[12px] leading-tight font-medium">{label}</span>
    </Link>
  );
}

export default function AdminHome() {
  const [o, setO] = useState<Overview | null>(null);
  const [a, setA] = useState<Alerts | null>(null);

  useEffect(() => {
    supabase.rpc('analytics_overview').then(({ data }) => setO((data ?? null) as Overview | null));
    supabase.rpc('admin_alerts').then(({ data }) => setA((data ?? null) as Alerts | null));
  }, []);

  const attPct = o && o.att_records > 0 ? Math.round((o.att_present / o.att_records) * 100) : null;
  const roomPct = o && o.rooms_total > 0 ? Math.round((o.rooms_used / o.rooms_total) * 100) : null;

  return (
    <Layout title="Institutional Command Centre">
      <AdminNav />

      {/* Alerts panel */}
      <h2 className="text-[12px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted)' }}>Needs attention</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 mb-6">
        <AlertChip to="/admin/timetable-approvals" n={a?.pending_tt_approvals ?? 0} label="Timetable approvals" tone="#7a4fb0" />
        <AlertChip to="/admin/leave" n={a?.pending_leaves ?? 0} label="Leave requests" tone="#b4473f" />
        <AlertChip to="/admin/rooms" n={a?.pending_bookings ?? 0} label="Room bookings" tone="#2d7d9a" />
        <AlertChip to="/committee/verify" n={a?.pending_verifications ?? 0} label="Record verifications" tone="#c08a2d" />
        <AlertChip to="/admin/leave" n={a?.on_leave_today ?? 0} label="On leave today" tone="#4a7a3a" />
        <AlertChip to="/committee/daily" n={a?.changes_today ?? 0} label="Changes today" tone="#3d8168" />
        <AlertChip to="/admin/audit" n={a?.audit_today ?? 0} label="Audit events today" tone="#1f3864" />
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <Kpi label="Students" value={o?.students_total ?? '—'} accent="#1f3864" />
        <Kpi label="Faculty" value={o?.faculty_total ?? '—'} accent="#3d8168" />
        <Kpi label="Sections" value={o?.sections_total ?? '—'} accent="#c08a2d" />
        <Kpi label="Subjects" value={o?.subjects_total ?? '—'} accent="#7a4fb0" />
        <Kpi label="Rooms in use" value={roomPct != null ? `${roomPct}%` : '—'} accent="#2d7d9a" />
        <Kpi label="Attendance" value={attPct != null ? `${attPct}%` : '—'} accent="#b4473f" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-3 mb-6">
        <Card title="Students by programme">
          <BarList data={(o?.students_by_programme ?? []).map((p) => ({ label: p.code, sub: p.name, value: p.count }))} />
        </Card>
        <Card title="Faculty record verification">
          <Donut data={[
            { label: 'Approved', value: o?.verification.approved ?? 0, color: '#3d8168' },
            { label: 'Pending', value: o?.verification.pending ?? 0, color: '#c08a2d' },
            { label: 'Returned', value: o?.verification.returned ?? 0, color: '#b4473f' },
            { label: 'Rejected', value: o?.verification.rejected ?? 0, color: '#8a8a8a' },
          ]} />
        </Card>
        <Card title="Busiest faculty (scheduled classes)">
          <BarList unit="" data={(o?.top_faculty_load ?? []).slice(0, 6).map((f) => ({ label: f.code, sub: f.name, value: f.classes }))} />
        </Card>
      </div>

      {o && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Kpi label="Published timetables" value={o.tt_versions_published} accent={CHART_COLORS[0]} />
          <Kpi label="Scheduled classes" value={o.tt_entries} accent={CHART_COLORS[1]} />
          <Kpi label="Attendance sessions" value={o.att_sessions} accent={CHART_COLORS[2]} />
          <Kpi label="Marks published" value={o.marks_published} accent={CHART_COLORS[3]} />
        </div>
      )}

      <TimetableBrowser />
    </Layout>
  );
}
