import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { DataTable } from '../../components/DataTable';
import { supabase } from '../../lib/supabase';

interface Row { usn: string; full_name: string; programme: string; section: string | null; semester: number | null; status: string }

export default function AdminStudents() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const load = useCallback(() => {
    supabase.rpc('admin_students', { p_search: search || null, p_limit: 3000 })
      .then(({ data }) => setRows((data ?? []) as Row[]));
  }, [search]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout title="Students">
      <AdminNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        {rows.length >= 1000 && <p className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>Showing the first 1,000 of 2,603 students — use search to find a specific USN or name.</p>}
        <DataTable
          headers={['USN', 'Name', 'Programme', 'Section', 'Sem', 'Status']}
          rows={rows.map((r) => [r.usn, r.full_name, r.programme, r.section ?? '—', r.semester ?? '—', r.status])}
          exportName="Students" exportTitle="Student Directory"
          right={
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search USN / name (Enter)" className="rounded px-2 py-1 text-[12.5px]"
              style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 220 }} />
          }
        />
      </div>
    </Layout>
  );
}
