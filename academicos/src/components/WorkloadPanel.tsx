import { BarList, Donut, Card, CHART_COLORS } from './MiniCharts';
import { exportReportExcel, exportReportPDF } from '../lib/report';

export interface Workload {
  faculty: { id: string; name: string; code: string };
  scheduled_periods_week: number; scheduled_hours_week: number; planned_hours: number;
  distinct_subjects: number; mentoring_sections: number; conducted_sessions: number;
  substitutions_covered: number; classes_delegated: number;
  by_category: { category: string; periods: number }[];
  by_day: { day: string; periods: number }[];
  by_subject: { code: string; name: string; periods: number; planned_hours: number }[];
  trend_monthly: { month: string; sessions: number }[];
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Kpi({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl overflow-hidden flex" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div className="p-3">
        <div className="text-xl font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
        <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div>
      </div>
    </div>
  );
}

export function WorkloadPanel({ w }: { w: Workload }) {
  const dayData = DAYS.map((d) => ({ label: d.slice(0, 3), value: w.by_day.find((x) => x.day === d)?.periods ?? 0 }));
  const catData = w.by_category.map((c, i) => ({ label: c.category, value: c.periods, color: CHART_COLORS[i % CHART_COLORS.length] }));
  const subMatrix = w.by_subject.map((s) => [s.code, String(s.periods), String(s.planned_hours)]);
  const sub = `${w.faculty.name} (${w.faculty.code}) · generated ${new Date().toLocaleString()}`;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <Kpi label="Periods / week" value={w.scheduled_periods_week} accent="#1f3864" />
        <Kpi label="Teaching hrs / week" value={w.scheduled_hours_week} accent="#3d8168" />
        <Kpi label="Planned hrs (year)" value={w.planned_hours} accent="#c08a2d" />
        <Kpi label="Subjects" value={w.distinct_subjects} accent="#7a4fb0" />
        <Kpi label="Mentoring sections" value={w.mentoring_sections} accent="#2d7d9a" />
        <Kpi label="Conducted sessions" value={w.conducted_sessions} accent="#4a7a3a" />
        <Kpi label="Substitutions covered" value={w.substitutions_covered} accent="#b4473f" />
      </div>

      <div className="grid lg:grid-cols-3 gap-3">
        <Card title="Load by course category">
          {catData.length ? <Donut data={catData} /> : <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>No scheduled classes.</p>}
        </Card>
        <Card title="Weekly load by day (periods)">
          <BarList data={dayData} />
        </Card>
        <Card title="Monthly conducted sessions (trend)">
          {w.trend_monthly.length
            ? <BarList data={w.trend_monthly.map((m) => ({ label: m.month, value: m.sessions }))} />
            : <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>No attendance recorded yet.</p>}
        </Card>
      </div>

      <Card title="Load by subject" right={
        <div className="flex gap-2">
          <button onClick={() => exportReportPDF(`Workload — ${w.faculty.code}`, sub, ['Subject', 'Periods/wk', 'Planned hrs'], subMatrix)}
            disabled={!subMatrix.length} className="text-[12px] rounded px-2.5 py-1 font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>PDF</button>
          <button onClick={() => exportReportExcel(`Workload_${w.faculty.code}`, ['Subject', 'Periods/wk', 'Planned hrs'], subMatrix)}
            disabled={!subMatrix.length} className="text-[12px] rounded px-2.5 py-1" style={{ border: '1px solid var(--line)' }}>Excel</button>
        </div>
      }>
        <BarList unit=" / wk" data={w.by_subject.map((s) => ({ label: s.code, value: s.periods }))} />
        {w.classes_delegated > 0 && (
          <p className="text-[12px] mt-3" style={{ color: 'var(--muted)' }}>
            {w.classes_delegated} class{w.classes_delegated > 1 ? 'es' : ''} delegated to substitutes during leave.
          </p>
        )}
      </Card>
    </div>
  );
}
