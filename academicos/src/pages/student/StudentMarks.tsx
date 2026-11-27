import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StudentNav } from '../../components/StudentNav';
import { supabase } from '../../lib/supabase';

interface Row { subject_name: string | null; course_code: string | null; title: string; kind: string; assessment_type: string | null; marks_obtained: number | null; max_marks: number | null }

export default function StudentMarks() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    supabase.from('v_student_marks').select('*').order('assessment_date', { nullsFirst: false })
      .then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, []);
  return (
    <Layout title="My Marks">
      <StudentNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        {loading ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>Loading…</p> :
         rows.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>No published marks yet. Marks appear here once your faculty publishes them.</p> : (
          <div className="grid gap-2">
            {rows.map((r, i) => {
              const pct = r.max_marks && r.marks_obtained != null ? Math.round((r.marks_obtained / r.max_marks) * 100) : null;
              return (
                <div key={i} className="rounded-lg p-3 flex items-center" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{r.subject_name ?? r.course_code}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{r.title} · {r.kind}{r.assessment_type ? ` · ${r.assessment_type}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[15px] font-semibold">{r.marks_obtained ?? '—'}<span className="text-[12px]" style={{ color: 'var(--muted)' }}> / {r.max_marks ?? '—'}</span></div>
                    {pct != null && <div className="text-[11px]" style={{ color: 'var(--muted)' }}>{pct}%</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
