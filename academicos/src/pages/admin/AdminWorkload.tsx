import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';
import { WorkloadPanel, type Workload } from '../../components/WorkloadPanel';
import { DataTable } from '../../components/DataTable';

interface Fac { id: string; code: string; full_name: string; periods_week: number; hours_week: number; subjects: number; mentoring: number; conducted: number }

export default function AdminWorkload() {
  const [all, setAll] = useState<Fac[]>([]);
  const [sel, setSel] = useState('');
  const [w, setW] = useState<Workload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    supabase.rpc('all_faculty_workload').then(({ data }) => setAll((data ?? []) as Fac[]));
  }, []);

  // preselect from ?faculty=
  useEffect(() => {
    const f = params.get('faculty');
    if (f) setSel(f);
  }, [params]);

  useEffect(() => {
    if (!sel) { setW(null); return; }
    setW(null); setErr(null);
    supabase.rpc('faculty_workload', { p_faculty: sel }).then(({ data, error }) => {
      if (error) setErr(error.message); else setW(data as Workload);
    });
  }, [sel]);

  function pick(id: string) {
    setSel(id);
    setParams(id ? { faculty: id } : {});
  }

  const avg = all.length ? Math.round(all.reduce((a, b) => a + b.periods_week, 0) / all.length) : 0;

  return (
    <Layout title="Faculty Workload">
      <AdminNav />

      {/* Generic overview — every faculty's weekly load */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <Kpi label="Faculty" value={all.length} accent="#1f3864" />
        <Kpi label="Avg periods / week" value={avg} accent="#3d8168" />
        <Kpi label="Total periods / week" value={all.reduce((a, b) => a + b.periods_week, 0)} accent="#c08a2d" />
        <Kpi label="Class teachers" value={all.filter((f) => f.mentoring > 0).length} accent="#7a4fb0" />
      </div>

      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <h3 className="text-[13px] font-semibold mb-2">All faculty — weekly workload</h3>
        <p className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>Click any row to drill into that faculty's full breakdown.</p>
        <DataTable
          headers={['Code', 'Name', 'Periods/wk', 'Teaching hrs/wk', 'Subjects', 'Mentoring', 'Conducted']}
          exportName="Faculty_Workload" exportTitle="Faculty Workload — all"
          rows={all.map((f) => [
            f.code, f.full_name, f.periods_week, f.hours_week, f.subjects, f.mentoring, f.conducted,
          ])}
        />
        <div className="mt-2 text-[11.5px]" style={{ color: 'var(--muted)' }}>Tip: use the picker below (or the Faculty directory) to open one.</div>
      </div>

      {/* Drill-down */}
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[13px] font-semibold">Individual breakdown</span>
          <select value={sel} onChange={(e) => pick(e.target.value)} className="rounded px-2 py-1.5 text-[12.5px]"
            style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 300 }}>
            <option value="">Select faculty…</option>
            {all.map((f) => <option key={f.id} value={f.id}>{f.code} · {f.full_name}</option>)}
          </select>
        </div>
        {err && <p className="text-[13px]" style={{ color: '#b4473f' }}>{err}</p>}
        {w ? <WorkloadPanel w={w} />
          : sel && !err ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Loading…</p>
          : <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Select a faculty above to see their day-by-day and subject-wise breakdown.</p>}
      </div>
    </Layout>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl overflow-hidden flex" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div style={{ width: 5, background: accent, flexShrink: 0 }} />
      <div className="p-3"><div className="text-xl font-semibold tabular-nums" style={{ color: accent }}>{value}</div>
        <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--muted)' }}>{label}</div></div>
    </div>
  );
}
