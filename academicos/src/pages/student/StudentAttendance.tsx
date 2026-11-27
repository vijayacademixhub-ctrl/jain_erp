import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StudentNav } from '../../components/StudentNav';
import { supabase } from '../../lib/supabase';

interface Row { course_code: string | null; subject_name: string | null; total: number; attended: number }
const THRESHOLD = 75;

export default function StudentAttendance() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.rpc('my_attendance').then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, []);

  const overallTotal = rows.reduce((a, r) => a + r.total, 0);
  const overallAtt = rows.reduce((a, r) => a + r.attended, 0);
  const overall = overallTotal ? Math.round((overallAtt / overallTotal) * 100) : 0;

  return (
    <Layout title="My Attendance">
      <StudentNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        {loading ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>Loading…</p> :
         rows.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>No attendance recorded yet.</p> : (
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="text-3xl font-semibold" style={{ color: overall < THRESHOLD ? '#b4473f' : 'var(--accent)' }}>{overall}%</div>
              <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>overall · {overallAtt}/{overallTotal} classes attended
                {overall < THRESHOLD && <span style={{ color: '#b4473f' }}> · below {THRESHOLD}% threshold</span>}</div>
            </div>
            <div className="grid gap-2">
              {rows.map((r, i) => {
                const pct = r.total ? Math.round((r.attended / r.total) * 100) : 0;
                const low = pct < THRESHOLD;
                return (
                  <div key={i} className="rounded-lg p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                    <div className="flex items-center">
                      <div className="flex-1 text-[13px] font-medium">{r.subject_name ?? r.course_code}</div>
                      <div className="text-[14px] font-semibold" style={{ color: low ? '#b4473f' : 'var(--accent)' }}>{pct}%</div>
                    </div>
                    <div className="mt-1 h-1.5 rounded" style={{ background: 'var(--line)' }}>
                      <div className="h-1.5 rounded" style={{ width: `${pct}%`, background: low ? '#b4473f' : 'var(--accent)' }} />
                    </div>
                    <div className="text-[11.5px] mt-1" style={{ color: 'var(--muted)' }}>{r.attended}/{r.total} attended{low && ' · shortage — attend upcoming classes'}</div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
