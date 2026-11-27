import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';

interface Rev { id: string; title: string; description: string | null; record_date: string | null;
  verification_status: string; category_name: string; faculty_code: string; faculty_name: string; academic_year: string | null; documents: number }
interface Doc { id: string; file_path: string; document_type: string | null }

export default function RecordVerification() {
  const [rows, setRows] = useState<Rev[]>([]);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'returned'>('pending');
  const [active, setActive] = useState<Rev | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [comments, setComments] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    let q = supabase.from('v_record_review').select('*').eq('submission_status', 'submitted');
    q = q.eq('verification_status', filter);
    q.order('record_date', { nullsFirst: false }).then(({ data }) => setRows((data ?? []) as Rev[]));
  }
  useEffect(() => { load(); setActive(null); }, [filter]);

  async function open(r: Rev) {
    setActive(r); setComments(''); setMsg(null);
    const { data } = await supabase.from('supporting_documents').select('id,file_path,document_type').eq('record_id', r.id);
    setDocs((data ?? []) as Doc[]);
  }
  async function viewDoc(d: Doc) {
    const { data } = await supabase.storage.from('evidence').createSignedUrl(d.file_path, 120);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }
  async function decide(decision: 'approved' | 'rejected' | 'returned') {
    if (!active) return;
    const { error } = await supabase.rpc('verify_record', { p_record: active.id, p_decision: decision, p_comments: comments || null });
    if (error) setMsg(error.message);
    else { setMsg(`Record ${decision}.`); setActive(null); load(); }
  }

  const tab = (f: typeof filter) => (
    <button onClick={() => setFilter(f)} className="text-[12.5px] rounded px-3 py-1.5 capitalize"
      style={{ background: filter === f ? 'var(--brand)' : 'var(--panel)', color: filter === f ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>{f}</button>
  );

  return (
    <Layout title="Faculty Record Verification">
      <CommitteeNav />
      <div className="flex gap-1 mb-3">{tab('pending')}{tab('approved')}{tab('returned')}{tab('rejected')}</div>
      {!active ? (
        <div className="grid gap-2">
          {rows.map((r) => (
            <button key={r.id} onClick={() => open(r)} className="text-left rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div className="text-[13px] font-medium">{r.title}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{r.category_name} · {r.faculty_name} ({r.faculty_code}) · {r.academic_year ?? ''} · {r.documents} evidence file(s)</div>
            </button>
          ))}
          {rows.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No {filter} records.</p>}
        </div>
      ) : (
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <button onClick={() => setActive(null)} className="text-[12.5px] mb-3" style={{ color: 'var(--brand)' }}>← Back</button>
          <div className="text-[14px] font-medium">{active.title}</div>
          <div className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>{active.category_name} · {active.faculty_name} ({active.faculty_code}) · {active.record_date ?? ''}</div>
          {active.description && <p className="text-[12.5px] mb-3">{active.description}</p>}
          <div className="mb-3">
            <div className="text-[12px] mb-1" style={{ color: 'var(--muted)' }}>Evidence</div>
            {docs.length === 0 ? <span className="text-[12px]" style={{ color: 'var(--muted)' }}>No files attached.</span> :
              <div className="flex flex-wrap gap-2">{docs.map((d) => <button key={d.id} onClick={() => viewDoc(d)} className="text-[12px] rounded px-3 py-1" style={{ border: '1px solid var(--line)' }}>View file</button>)}</div>}
          </div>
          <textarea value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Reviewer comments (required for reject/return)" rows={2}
            className="w-full rounded px-2 py-1.5 text-[13px] mb-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
          <div className="flex gap-2">
            <button onClick={() => decide('approved')} className="text-[13px] rounded px-4 py-2 font-medium text-white" style={{ background: 'var(--accent)' }}>Approve</button>
            <button onClick={() => decide('returned')} className="text-[13px] rounded px-4 py-2 font-medium text-white" style={{ background: '#c98a2b' }}>Return</button>
            <button onClick={() => decide('rejected')} className="text-[13px] rounded px-4 py-2 font-medium text-white" style={{ background: '#b4473f' }}>Reject</button>
          </div>
          {msg && <p className="text-[12.5px] mt-3" style={{ color: 'var(--accent)' }}>{msg}</p>}
        </div>
      )}
    </Layout>
  );
}
