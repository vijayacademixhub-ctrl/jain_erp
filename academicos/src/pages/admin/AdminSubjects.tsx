import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { DataTable } from '../../components/DataTable';
import { supabase } from '../../lib/supabase';

interface Row { code: string; name: string; course_type: string | null; credits: number | null; semester: number | null; programme: string | null }

export default function AdminSubjects() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const [sem, setSem] = useState('');
  const load = useCallback(() => {
    supabase.rpc('admin_subjects', { p_search: search || null }).then(({ data }) => setRows((data ?? []) as Row[]));
  }, [search]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sems = Array.from(new Set(rows.map((r) => r.semester).filter((x): x is number => x != null))).sort((a, b) => a - b);
  const shown = sem ? rows.filter((r) => String(r.semester) === sem) : rows;

  return (
    <Layout title="Subjects">
      <AdminNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <DataTable
          headers={['Code', 'Name', 'Type', 'Credits', 'Sem', 'Programme']}
          rows={shown.map((r) => [r.code, r.name, r.course_type ?? '—', r.credits ?? '—', r.semester ?? '—', r.programme ?? '—'])}
          exportName="Subjects" exportTitle="Subject Catalogue"
          right={
            <div className="flex items-center gap-2">
              <select value={sem} onChange={(e) => setSem(e.target.value)} className="rounded px-2 py-1 text-[12.5px]" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                <option value="">All semesters</option>
                {sems.map((s) => <option key={s} value={s}>Sem {s}</option>)}
              </select>
              <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
                placeholder="Search code / name (Enter)" className="rounded px-2 py-1 text-[12.5px]"
                style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 200 }} />
            </div>
          }
        />
      </div>
    </Layout>
  );
}
