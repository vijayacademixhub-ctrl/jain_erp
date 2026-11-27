import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { DataTable } from '../../components/DataTable';
import { supabase } from '../../lib/supabase';

interface Row { label: string; programme: string; semester: number; strength: number | null; class_teacher: string | null; home_room: string | null }

export default function AdminSections() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => { supabase.rpc('admin_sections').then(({ data }) => setRows((data ?? []) as Row[])); }, []);
  return (
    <Layout title="Sections">
      <AdminNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <DataTable
          headers={['Section', 'Programme', 'Sem', 'Strength', 'Class teacher', 'Home room']}
          rows={rows.map((r) => [r.label, r.programme, r.semester, r.strength ?? '—', r.class_teacher ?? '—', r.home_room ?? '—'])}
          exportName="Sections" exportTitle="Section Directory"
        />
      </div>
    </Layout>
  );
}
