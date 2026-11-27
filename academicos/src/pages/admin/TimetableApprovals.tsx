import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';

interface Version {
  id: string; name: string; status: string; version_number: number;
  semester_number: number; academic_year: string;
  submitted_by_name: string | null; submitted_at: string | null;
  created_by_name: string | null;
}

export default function TimetableApprovals() {
  const [rows, setRows] = useState<Version[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    supabase.from('v_timetable_approvals')
      .select('id,name,status,version_number,semester_number,academic_year,submitted_by_name,submitted_at,created_by_name')
      .eq('status', 'pending_approval').order('submitted_at')
      .then(({ data }) => setRows((data ?? []) as Version[]));
  }
  useEffect(() => { load(); }, []);

  async function decide(v: Version, approve: boolean) {
    setBusy(v.id); setMsg(null);
    const { error } = await supabase.rpc('approve_timetable', {
      p_version: v.id, p_approve: approve, p_comments: comment[v.id] || null,
    });
    setBusy(null);
    if (error) setMsg(error.message);
    else { setMsg(approve ? `"${v.name}" approved and published.` : `"${v.name}" returned to the committee.`); load(); }
  }

  return (
    <Layout title="Timetable Approvals">
      <AdminNav />
      <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
        Timetable versions submitted by the committee. Approving a version publishes it immediately and supersedes the previous published version for that semester.
      </p>
      <div className="grid gap-2">
        {rows.map((v) => (
          <div key={v.id} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="text-[13px] font-medium">{v.name}</div>
            <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
              Semester {v.semester_number} · {v.academic_year} · v{v.version_number}
            </div>
            <div className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>
              Submitted by {v.submitted_by_name ?? v.created_by_name ?? '—'}
              {v.submitted_at ? ` · ${new Date(v.submitted_at).toLocaleString()}` : ''}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input value={comment[v.id] ?? ''} onChange={(e) => setComment({ ...comment, [v.id]: e.target.value })}
                placeholder="Comment (required when returning)"
                className="rounded px-2 py-1.5 text-[12.5px] flex-1" style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 200 }} />
              <button disabled={busy === v.id} onClick={() => decide(v, true)}
                className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>
                Approve &amp; Publish
              </button>
              <button disabled={busy === v.id} onClick={() => decide(v, false)}
                className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: '#b4473f' }}>
                Return
              </button>
            </div>
          </div>
        ))}
        {rows.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No timetables are awaiting approval.</p>}
      </div>
      {msg && <p className="text-[12.5px] mt-3" style={{ color: 'var(--accent)' }}>{msg}</p>}
    </Layout>
  );
}
