import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { TimetableBrowser } from '../../components/TimetableBrowser';
import { AdminNav } from '../../components/AdminNav';

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="text-2xl font-semibold" style={{ color: 'var(--brand)' }}>{value}</div>
      <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{label}</div>
    </div>
  );
}

export default function AdminHome() {
  const [s, setS] = useState<Record<string, number>>({});
  useEffect(() => {
    (async () => {
      const t = async (tbl: string) => (await supabase.from(tbl).select('*', { count: 'exact', head: true })).count ?? 0;
      setS({
        faculty: await t('faculty'), sections: await t('sections'),
        subjects: await t('subjects'), entries: await t('timetable_entries'),
      });
    })();
  }, []);
  return (
    <Layout title="Institutional Overview">
      <AdminNav />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Faculty" value={s.faculty ?? '—'} />
        <Stat label="Sections" value={s.sections ?? '—'} />
        <Stat label="Subjects" value={s.subjects ?? '—'} />
        <Stat label="Timetable classes" value={s.entries ?? '—'} />
      </div>
      <TimetableBrowser />
    </Layout>
  );
}
