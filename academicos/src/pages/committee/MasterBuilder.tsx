import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

interface Version { id: string; name: string; status: string; semester_id: string; semester_number: number }
interface Section { id: string; label: string }
interface Opt { id: string; code?: string; name?: string; number?: string; n?: number }
interface Options { subjects: Opt[]; faculty: Opt[]; rooms: Opt[]; periods: Opt[] }
interface GridEntry { entry_id: string; day_of_week: string; period_number: number; subject_code: string | null; faculty_code: string | null; room_number: string | null }
interface Sem { id: string; semester_number: number; academic_year: string }

const STATUS_TONE: Record<string, string> = { draft: '#8a8a8a', returned: '#b4473f', pending_approval: '#c08a2d', published: '#3d8168', withdrawn: '#8a8a8a' };

export default function MasterBuilder() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [verId, setVerId] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [secId, setSecId] = useState('');
  const [opts, setOpts] = useState<Options | null>(null);
  const [grid, setGrid] = useState<GridEntry[]>([]);
  const [cell, setCell] = useState<{ day: string; period: Opt } | null>(null);
  const [form, setForm] = useState({ subject: '', faculty: '', room: '' });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // new draft
  const [sems, setSems] = useState<Sem[]>([]);
  const [newSem, setNewSem] = useState('');
  const [newName, setNewName] = useState('');

  const ver = versions.find((v) => v.id === verId) ?? null;
  const editable = !!ver && (ver.status === 'draft' || ver.status === 'returned');

  function loadVersions(keep?: string) {
    supabase.from('v_timetable_approvals').select('id,name,status,semester_id,semester_number').order('semester_number')
      .then(({ data }) => { setVersions((data ?? []) as Version[]); if (keep) setVerId(keep); });
  }
  useEffect(() => { loadVersions(); supabase.rpc('tt_semesters').then(({ data }) => setSems((data ?? []) as Sem[])); }, []);

  useEffect(() => {
    if (!ver) { setSections([]); setSecId(''); return; }
    supabase.from('sections').select('id,label').eq('semester_id', ver.semester_id).order('label')
      .then(({ data }) => setSections((data ?? []) as Section[]));
  }, [verId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadGrid = useCallback(() => {
    if (!verId || !secId) { setGrid([]); return; }
    supabase.rpc('tt_grid', { p_version: verId, p_section: secId }).then(({ data }) => setGrid((data ?? []) as GridEntry[]));
  }, [verId, secId]);

  useEffect(() => {
    if (secId) { supabase.rpc('tt_builder_options', { p_section: secId }).then(({ data }) => setOpts(data as Options)); loadGrid(); }
    else setOpts(null);
  }, [secId]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (day: string, n: number) => grid.find((g) => g.day_of_week === day && g.period_number === n);

  async function add() {
    if (!cell || !form.subject) { setMsg('Pick a subject.'); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('tt_add_entry', {
      p_version: verId, p_day: cell.day, p_period: cell.period.id,
      p_subject: form.subject, p_faculty: form.faculty || null, p_room: form.room || null, p_section: secId,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else { setCell(null); setForm({ subject: '', faculty: '', room: '' }); loadGrid(); }
  }
  async function del(id: string) { const { error } = await supabase.rpc('tt_delete_entry', { p_entry: id }); if (error) setMsg(error.message); else loadGrid(); }
  async function submit() {
    if (!ver) return;
    const { error } = await supabase.rpc('submit_timetable', { p_version: ver.id });
    if (error) setMsg(error.message); else { setMsg('Submitted for Super-Admin approval.'); loadVersions(ver.id); }
  }
  async function createDraft() {
    if (!newSem || !newName.trim()) { setMsg('Pick a semester and name the draft.'); return; }
    const { data, error } = await supabase.rpc('tt_create_draft', { p_semester: newSem, p_name: newName.trim() });
    if (error) setMsg(error.message);
    else { setNewName(''); setMsg('Draft created — select a section to start adding classes.'); loadVersions(data as string); }
  }

  const sel = 'rounded px-2 py-1.5 text-[12.5px]';
  const periods = opts?.periods ?? [];

  return (
    <Layout title="Master Timetable Builder">
      <CommitteeNav />

      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <select value={verId} onChange={(e) => { setVerId(e.target.value); setSecId(''); }} className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 260 }}>
            <option value="">Select a timetable version…</option>
            {versions.map((v) => <option key={v.id} value={v.id}>Sem {v.semester_number} · {v.name} ({v.status})</option>)}
          </select>
          {ver && <select value={secId} onChange={(e) => setSecId(e.target.value)} className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
            <option value="">Select section…</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>}
          {ver && <span className="text-[12px] rounded px-2 py-0.5 text-white font-medium" style={{ background: STATUS_TONE[ver.status] ?? '#8a8a8a' }}>{ver.status}</span>}
          <div className="flex-1" />
          {editable && secId && <button onClick={submit} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--brand)' }}>Submit for approval</button>}
        </div>
        {ver && !editable && <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>This version is <b>{ver.status}</b> and is read-only. Create a new draft or select a draft/returned version to edit.</p>}

        {/* new draft */}
        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
          <span className="text-[12px]" style={{ color: 'var(--muted)' }}>New draft:</span>
          <select value={newSem} onChange={(e) => setNewSem(e.target.value)} className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
            <option value="">Semester…</option>
            {sems.map((s) => <option key={s.id} value={s.id}>Sem {s.semester_number} · {s.academic_year}</option>)}
          </select>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Draft name (e.g. Even Sem 2027 v2)" className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 220 }} />
          <button onClick={createDraft} className="text-[12.5px] rounded px-3 py-1.5 font-medium" style={{ border: '1px solid var(--line)' }}>Create draft</button>
        </div>
        {msg && <p className="text-[12.5px] mt-2" style={{ color: msg.includes('approval') || msg.includes('created') ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
      </div>

      {secId && (
        <div className="rounded-xl p-3 overflow-auto" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <table className="w-full text-[12px]" style={{ borderCollapse: 'collapse', minWidth: 720 }}>
            <thead>
              <tr style={{ color: 'var(--muted)' }}>
                <th className="text-left px-2 py-1.5">Day</th>
                {periods.map((p) => <th key={p.id} className="text-left px-2 py-1.5">P{p.n}</th>)}
              </tr>
            </thead>
            <tbody>
              {DAYS.map((day) => (
                <tr key={day} style={{ borderTop: '1px solid var(--line)' }}>
                  <td className="px-2 py-1.5 font-medium whitespace-nowrap">{day}</td>
                  {periods.map((p) => {
                    const e = at(day, p.n!);
                    return (
                      <td key={p.id} className="px-1.5 py-1.5 align-top" style={{ minWidth: 110 }}>
                        {e ? (
                          <div className="rounded-lg p-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                            <div className="font-medium">{e.subject_code}</div>
                            <div style={{ color: 'var(--muted)' }}>{e.faculty_code ?? 'TBD'}{e.room_number ? ` · ${e.room_number}` : ''}</div>
                            {editable && <button onClick={() => del(e.entry_id)} className="text-[10.5px] mt-0.5" style={{ color: '#b4473f' }}>remove</button>}
                          </div>
                        ) : editable ? (
                          <button onClick={() => { setCell({ day, period: p }); setForm({ subject: '', faculty: '', room: '' }); setMsg(null); }}
                            className="w-full rounded-lg py-2 text-[11px]" style={{ border: '1px dashed var(--line)', color: 'var(--muted)' }}>+ add</button>
                        ) : <span style={{ color: 'var(--muted)' }}>—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {periods.length === 0 && <p className="text-[12.5px] mt-2" style={{ color: 'var(--muted)' }}>No period structure found for this semester yet.</p>}
        </div>
      )}

      {/* add-class modal */}
      {cell && opts && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} onClick={() => setCell(null)}>
          <div className="rounded-xl p-4 w-full max-w-sm" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-[13px] font-semibold mb-1">Add class — {cell.day} P{cell.period.n}</div>
            <p className="text-[11.5px] mb-3" style={{ color: 'var(--muted)' }}>Clashes (faculty / room / section) are blocked automatically.</p>
            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Subject</label>
            <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={sel + ' w-full mb-2'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
              <option value="">Choose subject…</option>
              {opts.subjects.map((s) => <option key={s.id} value={s.id}>{s.code}{s.name && s.name !== s.code ? ` — ${s.name}` : ''}</option>)}
            </select>
            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Faculty</label>
            <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} className={sel + ' w-full mb-2'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
              <option value="">TBD</option>
              {opts.faculty.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
            </select>
            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Room</label>
            <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={sel + ' w-full mb-3'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
              <option value="">No room</option>
              {opts.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}</option>)}
            </select>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setCell(null)} className="text-[12.5px] rounded px-3 py-1.5" style={{ border: '1px solid var(--line)' }}>Cancel</button>
              <button onClick={add} disabled={busy} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: 'var(--brand)' }}>{busy ? 'Adding…' : 'Add class'}</button>
            </div>
            {msg && <p className="text-[12px] mt-2" style={{ color: '#b4473f' }}>{msg}</p>}
          </div>
        </div>
      )}
    </Layout>
  );
}
