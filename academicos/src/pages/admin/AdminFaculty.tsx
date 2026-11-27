import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { DataTable } from '../../components/DataTable';
import { supabase } from '../../lib/supabase';

interface Row { id: string; code: string; full_name: string; periods_week: number; subjects: number; status: string }

export default function AdminFaculty() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState('');
  const load = useCallback(() => {
    supabase.rpc('admin_faculty', { p_search: search || null }).then(({ data }) => setRows((data ?? []) as Row[]));
  }, [search]);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout title="Faculty">
      <AdminNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <DataTable
          headers={['Code', 'Name', 'Periods/wk', 'Subjects', 'Status', '']}
          rows={rows.map((r) => [
            r.code, r.full_name, r.periods_week, r.subjects, r.status,
            <Link to={`/admin/workload?faculty=${r.id}`} className="text-[12px] rounded px-2 py-0.5" style={{ border: '1px solid var(--line)', color: 'var(--brand)' }}>Workload →</Link>,
          ])}
          exportName="Faculty" exportTitle="Faculty Directory"
          right={
            <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="Search code / name (Enter)" className="rounded px-2 py-1 text-[12.5px]"
              style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 220 }} />
          }
        />
      </div>
    </Layout>
  );
}
