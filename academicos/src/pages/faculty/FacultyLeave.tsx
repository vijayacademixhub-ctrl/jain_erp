import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Leave { id: string; leave_type: string; from_date: string; to_date: string; reason: string;
  status: string; decision_comments: string | null; created_at: string }
const SC: Record<string, string> = { pending: 'var(--muted)', approved: 'var(--accent)', rejected: '#b4473f', cancelled: 'var(--muted)' };

export default function FacultyLeave() {
  const { session } = useAuth();
  const [fid, setFid] = useState<string | null>(null);
  const [rows, setRows] = useState<Leave[]>([]);
  const [form, setForm] = useState({ leave_type: 'planned', from_date: '', to_date: '', reason: '' });
  const [sheet, setSheet] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => { if (session) supabase.from('faculty').select('id').eq('profile_id', session.user.id).maybeSingle().then(({ data }) => setFid((data as { id: string } | null)?.id ?? null)); }, [session]);
  function load() { supabase.from('faculty_leaves').select('id,leave_type,from_date,to_date,reason,status,decision_comments,created_at').order('created_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as Leave[])); }
  useEffect(() => { if (fid) load(); }, [fid]);

  async function apply() {
    if (!session) return;
    setMsg(null); setBusy(true);
    let adjustmentPath: string | null = null;
    if (sheet) {
      const path = `${session.user.id}/leave-adjustments/${Date.now()}_${sheet.name}`;
      const { error: upErr } = await supabase.storage.from('evidence').upload(path, sheet);
      if (upErr) { setMsg('Could not upload adjustment sheet: ' + upErr.message); setBusy(false); return; }
      adjustmentPath = path;
    }
    const { data: leaveId, error } = await supabase.rpc('apply_leave', {
      p_type: form.leave_type, p_from: form.from_date, p_to: form.to_date || form.from_date,
      p_reason: form.reason, p_periods: [], p_adjustment_path: adjustmentPath,
    });
    if (error) { setMsg(error.message); setBusy(false); return; }
    // fire the email trigger (no-op until the Resend key is configured)
    supabase.functions.invoke('send-leave-email', { body: { leave_id: leaveId, event: 'applied' } }).catch(() => {});
    setForm({ leave_type: 'planned', from_date: '', to_date: '', reason: '' }); setSheet(null);
    setMsg('Leave request submitted for approval.'); setBusy(false); load();
  }
  async function cancel(l: Leave) { await supabase.from('faculty_leaves').update({ status: 'cancelled' }).eq('id', l.id); load(); }

  const inp = 'rounded px-2 py-1.5 text-[13px]';
  return (
    <Layout title="Leave">
      <FacultyNav />
      {!fid ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No faculty profile linked.</p> : (
        <>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="text-[13px] font-medium mb-3">Apply for leave</div>
            <div className="flex flex-wrap gap-2 items-end mb-2">
              <div><label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Type</label>
                <select value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })} className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <option value="planned">Planned</option><option value="unplanned">Unplanned</option></select></div>
              <div><label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>From</label>
                <input type="date" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} /></div>
              <div><label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>To</label>
                <input type="date" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} /></div>
            </div>
            <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Reason" className={inp + ' w-full mb-2'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
            {form.leave_type === 'planned' && (
              <div className="mb-2">
                <label className="text-[12.5px] rounded px-3 py-1.5 cursor-pointer inline-block" style={{ border: '1px solid var(--line)' }}>
                  {sheet ? `📎 ${sheet.name}` : 'Attach adjustment sheet (image/PDF)'}
                  <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => setSheet(e.target.files?.[0] ?? null)} />
                </label>
                {sheet && <button onClick={() => setSheet(null)} className="text-[12px] ml-2" style={{ color: '#b4473f' }}>remove</button>}
                <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>The scanned adjustment sheet is stored securely and attached to the approval email.</p>
              </div>
            )}
            <button onClick={apply} disabled={busy} className="rounded px-4 py-2 font-medium text-white text-[13px] disabled:opacity-60" style={{ background: 'var(--brand)' }}>{busy ? 'Submitting…' : 'Submit request'}</button>
            {msg && <p className="text-[12px] mt-2" style={{ color: msg.includes('submitted') ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
          </div>
          <div className="grid gap-2">
            {rows.map((l) => (
              <div key={l.id} className="rounded-xl p-3 flex items-center" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <div className="flex-1">
                  <div className="text-[13px] font-medium capitalize">{l.leave_type} · {l.from_date}{l.to_date !== l.from_date ? ` → ${l.to_date}` : ''}</div>
                  <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{l.reason}{l.decision_comments ? ` · ${l.decision_comments}` : ''}</div>
                </div>
                <span className="text-[11px] rounded px-2 py-0.5 capitalize mr-2" style={{ background: 'var(--bg)', color: SC[l.status] }}>{l.status}</span>
                {l.status === 'pending' && <button onClick={() => cancel(l)} className="text-[11.5px] rounded px-2 py-1" style={{ border: '1px solid var(--line)' }}>Cancel</button>}
              </div>
            ))}
            {rows.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No leave requests yet.</p>}
          </div>
        </>
      )}
    </Layout>
  );
}
