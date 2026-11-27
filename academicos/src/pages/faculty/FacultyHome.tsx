import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useTimetable } from '../../lib/useTimetable';
import { TimetableGrid } from '../../components/TimetableGrid';
import { ExportButtons } from '../../components/ExportButtons';

export default function FacultyHome() {
  const { session, profile } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (!session) return;
    supabase.from('faculty').select('short_code').eq('profile_id', session.user.id).maybeSingle()
      .then(({ data }) => { setCode((data as { short_code: string } | null)?.short_code ?? null); setResolved(true); });
  }, [session]);

  const { rows } = useTimetable({ facultyCode: code ?? '__none__' });
  return (
    <Layout title="My Timetable">
      {!resolved ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        : !code ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No faculty profile is linked to this account yet.</p>
        : <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="flex items-center mb-3">
              <div className="text-[13px]" style={{ color: 'var(--muted)' }}>{profile?.full_name} · {code} · {rows.length} weekly classes</div>
              <div className="flex-1" />
              <ExportButtons rows={rows} name={`My_Timetable_${code}`} subtitle={`${profile?.full_name} · Even Sem 2027`} />
            </div>
            <TimetableGrid rows={rows} />
          </div>}
    </Layout>
  );
}
