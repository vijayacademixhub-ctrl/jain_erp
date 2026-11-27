import { useEffect, useState, type ChangeEvent } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface Cat { id: string; code: string; name: string }
interface Rec { id: string; title: string; description: string | null; record_date: string | null;
  submission_status: string; verification_status: string; category_id: string; record_categories?: { name: string }[] }

const STATUS_COLOR: Record<string, string> = { pending: 'var(--muted)', approved: 'var(--accent)', rejected: '#b4473f', returned: '#b4473f' };

export default function FacultyRecords() {
  const { session } = useAuth();
  const [fid, setFid] = useState<string | null>(null);
  const [cats, setCats] = useState<Cat[]>([]);
  const [ay, setAy] = useState<string | null>(null);
  const [recs, setRecs] = useState<Rec[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ category_id: '', title: '', description: '', record_date: '' });

  useEffect(() => {
    if (!session) return;
    supabase.from('faculty').select('id').eq('profile_id', session.user.id).maybeSingle()
      .then(({ data }) => setFid((data as { id: string } | null)?.id ?? null));
    supabase.from('record_categories').select('id,code,name').order('sort_order').then(({ data }) => setCats((data ?? []) as Cat[]));
    supabase.from('academic_years').select('id').eq('label', '2026-2027').maybeSingle().then(({ data }) => setAy((data as { id: string } | null)?.id ?? null));
  }, [session]);

  function load(id: string) {
    supabase.from('faculty_records').select('id,title,description,record_date,submission_status,verification_status,category_id,record_categories(name)')
      .eq('faculty_id', id).order('created_at', { ascending: false }).then(({ data }) => setRecs((data ?? []) as Rec[]));
  }
  useEffect(() => { if (fid) load(fid); }, [fid]);

  async function create() {
    if (!fid || !form.category_id || !form.title) { setMsg('Category and title are required.'); return; }
    const { error } = await supabase.from('faculty_records').insert({
      faculty_id: fid, category_id: form.category_id, title: form.title, description: form.description || null,
      record_date: form.record_date || null, academic_year_id: ay, submission_status: 'draft' });
    if (error) setMsg(error.message);
    else { setForm({ category_id: '', title: '', description: '', record_date: '' }); setMsg('Record added as draft.'); load(fid); }
  }

  async function submitRec(r: Rec) {
    const { error } = await supabase.from('faculty_records').update({ submission_status: 'submitted', verification_status: 'pending' }).eq('id', r.id);
    setMsg(error ? error.message : 'Submitted for verification.'); if (fid) load(fid);
  }

  async function upload(r: Rec, e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f || !session) return;
    const path = `${session.user.id}/${r.id}/${Date.now()}_${f.name}`;
    const { error } = await supabase.storage.from('evidence').upload(path, f);
    if (error) { setMsg(error.message); return; }
    const { error: e2 } = await supabase.from('supporting_documents').insert({ record_id: r.id, file_path: path, document_type: f.type, uploaded_by: session.user.id });
    setMsg(e2 ? e2.message : `Evidence "${f.name}" uploaded.`);
    e.target.value = '';
  }

  const inp = 'rounded px-2 py-1.5 text-[13px]';
  return (
    <Layout title="My Academic Records">
      <FacultyNav />
      {!fid ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No faculty profile linked to this account.</p> : (
        <>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="text-[13px] font-medium mb-3">Add a record</div>
            <div className="grid sm:grid-cols-2 gap-2 mb-2">
              <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                <option value="">Category…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input value={form.record_date} onChange={(e) => setForm({ ...form, record_date: e.target.value })} type="date" className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
            </div>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" className={inp + ' w-full mb-2'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Description (journal, venue, authors…)" className={inp + ' w-full mb-2'} rows={2} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
            <button onClick={create} className="rounded px-4 py-2 font-medium text-white text-[13px]" style={{ background: 'var(--brand)' }}>Add record</button>
          </div>

          <div className="grid gap-2">
            {recs.map((r) => (
              <div key={r.id} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{r.title}</div>
                    <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{r.record_categories?.[0]?.name}{r.record_date ? ` · ${r.record_date}` : ''}</div>
                    {r.description && <div className="text-[12px] mt-1" style={{ color: 'var(--muted)' }}>{r.description}</div>}
                  </div>
                  <span className="text-[11px] rounded px-2 py-0.5" style={{ background: 'var(--bg)', color: STATUS_COLOR[r.verification_status] ?? 'var(--muted)' }}>
                    {r.submission_status === 'draft' ? 'Draft' : r.verification_status}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  {r.submission_status === 'draft' && <button onClick={() => submitRec(r)} className="text-[12px] rounded px-3 py-1 font-medium text-white" style={{ background: 'var(--brand)' }}>Submit for verification</button>}
                  <label className="text-[12px] rounded px-3 py-1 cursor-pointer" style={{ border: '1px solid var(--line)' }}>Upload evidence
                    <input type="file" className="hidden" onChange={(e) => upload(r, e)} /></label>
                </div>
              </div>
            ))}
            {recs.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No records yet.</p>}
          </div>
          {msg && <p className="text-[12.5px] mt-3" style={{ color: /added|Submitted|uploaded|draft/i.test(msg) ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
        </>
      )}
    </Layout>
  );
}
