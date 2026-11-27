import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';

interface Leave { id: string; leave_type: string; from_date: string; to_date: string; reason: string; status: string;
  faculty?: { full_name: string; short_code: string } | { full_name: string; short_code: string }[] }

export default function LeaveApprovals({ area = 'committee' }: { area?: 'committee' | 'admin' }) {
  const [rows, setRows] = useState<Leave[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [comment, setComment] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    supabase.from('faculty_leaves').select('id,leave_type,from_date,to_date,reason,status,faculty(full_name,short_code)')
      .eq('status', filter).order('from_date').then(({ data }) => setRows((data ?? []) as Leave[]));
  }
  useEffect(() => { load(); }, [filter]);

  async function decide(l: Leave, decision: 'approved' | 'rejected') {
    const { error } = await supabase.rpc('decide_leave', { p_leave: l.id, p_decision: decision, p_comments: comment[l.id] || null });
    if (error) setMsg(error.message); else { setMsg(`Leave ${decision}.`); load(); }
  }
  const tab = (f: typeof filter) => <button onClick={() => setFilter(f)} className="text-[12.5px] rounded px-3 py-1.5 capitalize"
    style={{ background: filter === f ? 'var(--brand)' : 'var(--panel)', color: filter === f ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>{f}</button>;

  return (
    <Layout title="Leave Approvals">
      {area === 'admin' ? <AdminNav /> : <CommitteeNav />}
      <div className="flex gap-1 mb-3">{tab('pending')}{tab('approved')}{tab('rejected')}</div>
      <div className="grid gap-2">
        {rows.map((l) => {
          const f = Array.isArray(l.faculty) ? l.faculty[0] : l.faculty;
          return (
            <div key={l.id} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div className="text-[13px] font-medium">{f?.full_name} <span style={{ color: 'var(--muted)' }}>({f?.short_code})</span></div>
              <div className="text-[12px] capitalize" style={{ color: 'var(--muted)' }}>{l.leave_type} · {l.from_date}{l.to_date !== l.from_date ? ` → ${l.to_date}` : ''} · {l.reason}</div>
              {filter === 'pending' && (
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <input value={comment[l.id] ?? ''} onChange={(e) => setComment({ ...comment, [l.id]: e.target.value })} placeholder="Comment (optional)"
                    className="rounded px-2 py-1.5 text-[12.5px] flex-1" style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 180 }} />
                  <button onClick={() => decide(l, 'approved')} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--accent)' }}>Approve</button>
                  <button onClick={() => decide(l, 'rejected')} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: '#b4473f' }}>Reject</button>
                </div>
              )}
            </div>
          );
        })}
        {rows.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No {filter} leave requests.</p>}
      </div>
      {msg && <p className="text-[12.5px] mt-3" style={{ color: 'var(--accent)' }}>{msg}</p>}
    </Layout>
  );
}
