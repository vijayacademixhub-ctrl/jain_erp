import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';
import { WorkloadPanel, type Workload } from '../../components/WorkloadPanel';

interface Fac { id: string; short_code: string; full_name: string }

export default function AdminWorkload() {
  const [faculty, setFaculty] = useState<Fac[]>([]);
  const [sel, setSel] = useState('');
  const [w, setW] = useState<Workload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.from('faculty').select('id,short_code,full_name').order('short_code')
      .then(({ data }) => setFaculty((data ?? []) as Fac[]));
  }, []);

  useEffect(() => {
    if (!sel) { setW(null); return; }
    setW(null); setErr(null);
    supabase.rpc('faculty_workload', { p_faculty: sel }).then(({ data, error }) => {
      if (error) setErr(error.message); else setW(data as Workload);
    });
  }, [sel]);

  return (
    <Layout title="Faculty Workload">
      <AdminNav />
      <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
        Inspect any faculty member's teaching load, mentoring, substitutions and attendance trend. Select a faculty to begin.
      </p>
      <select value={sel} onChange={(e) => setSel(e.target.value)} className="rounded px-2 py-1.5 text-[12.5px] mb-4"
        style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 320 }}>
        <option value="">Select faculty…</option>
        {faculty.map((f) => <option key={f.id} value={f.id}>{f.short_code} · {f.full_name}</option>)}
      </select>
      {err && <p className="text-[13px]" style={{ color: '#b4473f' }}>{err}</p>}
      {w ? <WorkloadPanel w={w} />
        : sel && !err ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Loading…</p>
        : null}
    </Layout>
  );
}
