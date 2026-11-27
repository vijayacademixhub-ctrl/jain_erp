import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';
import { WorkloadPanel, type Workload } from '../../components/WorkloadPanel';

export default function FacultyWorkload() {
  const [w, setW] = useState<Workload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('faculty_workload').then(({ data, error }) => {
      if (error) setErr(error.message); else setW(data as Workload);
    });
  }, []);

  return (
    <Layout title="My Workload">
      <FacultyNav />
      {err && <p className="text-[13px]" style={{ color: '#b4473f' }}>{err}</p>}
      {w ? <WorkloadPanel w={w} /> : !err && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Loading…</p>}
    </Layout>
  );
}
