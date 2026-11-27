import { useEffect, useState, useCallback, useMemo } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const FIXED_LABELS = ['Unit Test', 'Master Talk', 'CT/Orientation', 'C2C', 'LIB', 'Training', 'Workshop', 'AI Toolkit', 'Rock Your Profile'];
const SEV_TONE: Record<string, string> = { critical: '#b4473f', warning: '#c08a2d', advisory: '#2d7d9a' };

interface Version { id: string; name: string; status: string; semester_id: string; semester_number: number }
interface Section { id: string; label: string }
interface Subject { id: string; code: string; name: string; credits: number }
interface Opt { id: string; code?: string; name?: string; number?: string; n?: number; cap?: number }
interface Options { subjects: Subject[]; faculty: Opt[]; rooms: Opt[]; periods: Opt[] }
interface GridEntry { entry_id: string; day_of_week: string; period_number: number; subject_code: string | null; faculty_code: string | null; room_number: string | null; fixed_label: string | null }
interface Sem { id: string; semester_number: number; academic_year: string }
interface Clash { severity: string; kind: string; detail: string }
interface FreeFac { id: string; code: string; name: string; load: number }
interface FreeRoom { id: string; number: string; cap: number | null; fits: boolean }

const STATUS_TONE: Record<string, string> = { draft: '#8a8a8a', returned: '#b4473f', pending_approval: '#c08a2d', published: '#3d8168', withdrawn: '#8a8a8a' };
function hueOf(code: string) { let h = 0; for (const c of code) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

export default function MasterBuilder() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [verId, setVerId] = useState('');
  const [sections, setSections] = useState<Section[]>([]);
  const [secId, setSecId] = useState('');
  const [opts, setOpts] = useState<Options | null>(null);
  const [grid, setGrid] = useState<GridEntry[]>([]);
  const [clashes, setClashes] = useState<Clash[]>([]);
  const [showClash, setShowClash] = useState(false);
  const [drag, setDrag] = useState<Subject | null>(null);
  const [dragFixed, setDragFixed] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [cell, setCell] = useState<{ day: string; period: Opt } | null>(null);
  const [fixedLabel, setFixedLabel] = useState<string | null>(null); // non-null => fixed-block modal
  const [form, setForm] = useState({ subject: '', faculty: '', room: '' });
  const [sug, setSug] = useState<{ free_faculty: FreeFac[]; free_rooms: FreeRoom[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sems, setSems] = useState<Sem[]>([]);
  const [newSem, setNewSem] = useState('');
  const [newName, setNewName] = useState('');

  const ver = versions.find((v) => v.id === verId) ?? null;
  const editable = !!ver && (ver.status === 'draft' || ver.status === 'returned');
  const sevCount = (s: string) => clashes.filter((c) => c.severity === s).length;
  const critical = sevCount('critical');

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
    if (!verId || !secId) { setGrid([]); setClashes([]); return; }
    supabase.rpc('tt_grid', { p_version: verId, p_section: secId }).then(({ data }) => setGrid((data ?? []) as GridEntry[]));
    supabase.rpc('tt_version_clashes', { p_version: verId }).then(({ data }) => setClashes((data ?? []) as Clash[]));
  }, [verId, secId]);

  useEffect(() => {
    if (secId) { supabase.rpc('tt_builder_options', { p_section: secId }).then(({ data }) => setOpts(data as Options)); loadGrid(); }
    else setOpts(null);
  }, [secId]); // eslint-disable-line react-hooks/exhaustive-deps

  const at = (day: string, n: number) => grid.find((g) => g.day_of_week === day && g.period_number === n);
  const periods = opts?.periods ?? [];

  const placed = useMemo(() => {
    const m = new Map<string, number>();
    for (const g of grid) if (g.subject_code) m.set(g.subject_code, (m.get(g.subject_code) ?? 0) + 1);
    return m;
  }, [grid]);
  const toPlace = (opts?.subjects ?? []).reduce((n, s) => n + Math.max(0, s.credits - (placed.get(s.code) ?? 0)), 0);

  async function loadSug(day: string, period: Opt) {
    const { data } = await supabase.rpc('tt_suggest', { p_version: verId, p_day: day, p_period: period.id, p_section: secId });
    return (data ?? { free_faculty: [], free_rooms: [] }) as { free_faculty: FreeFac[]; free_rooms: FreeRoom[] };
  }
  async function openAdd(day: string, period: Opt, subject?: Subject) {
    setCell({ day, period }); setFixedLabel(null); setMsg(null);
    setForm({ subject: subject?.id ?? '', faculty: '', room: '' }); setSug(null);
    const s = await loadSug(day, period); setSug(s);
    setForm((f) => ({ ...f, faculty: s.free_faculty[0]?.id ?? '', room: s.free_rooms.find((r) => r.fits)?.id ?? s.free_rooms[0]?.id ?? '' }));
  }
  async function openFixed(day: string, period: Opt, label: string) {
    setCell({ day, period }); setFixedLabel(label); setMsg(null);
    setForm({ subject: '', faculty: '', room: '' }); setSug(null);
    const s = await loadSug(day, period); setSug(s);
  }

  async function add() {
    if (!cell) return;
    setBusy(true); setMsg(null);
    let error;
    if (fixedLabel) {
      ({ error } = await supabase.rpc('tt_add_fixed', { p_version: verId, p_day: cell.day, p_period: cell.period.id, p_label: fixedLabel, p_section: secId, p_room: form.room || null }));
    } else {
      if (!form.subject) { setMsg('Pick a subject.'); setBusy(false); return; }
      ({ error } = await supabase.rpc('tt_add_entry', { p_version: verId, p_day: cell.day, p_period: cell.period.id, p_subject: form.subject, p_faculty: form.faculty || null, p_room: form.room || null, p_section: secId }));
    }
    setBusy(false);
    if (error) setMsg(error.message);
    else { setCell(null); setFixedLabel(null); setForm({ subject: '', faculty: '', room: '' }); loadGrid(); }
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
    if (error) setMsg(error.message); else { setNewName(''); setMsg('Draft created — select a section to start building.'); loadVersions(data as string); }
  }
  function dropOn(day: string, period: Opt) {
    if (!editable) return;
    if (drag) { const d = drag; setOver(null); openAdd(day, period, d); }
    else if (dragFixed) { const l = dragFixed; setOver(null); openFixed(day, period, l); }
  }

  const sel = 'rounded px-2 py-1.5 text-[12.5px]';
  const subjById = (id: string) => opts?.subjects.find((s) => s.id === id);

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
          {secId && (
            <button onClick={() => setShowClash((s) => !s)} className="text-[12.5px] rounded px-3 py-1.5 font-medium inline-flex items-center gap-1.5"
              style={{ border: `1px solid ${critical ? '#b4473f' : 'var(--line)'}`, background: critical ? '#b4473f' : 'var(--panel)', color: critical ? '#fff' : 'var(--ink)' }}>
              ⚠ Clashes
              {(['critical', 'warning', 'advisory'] as const).map((s) => (
                <span key={s} className="rounded-full px-1.5 text-[11px] font-semibold tabular-nums" style={{ background: critical && s === 'critical' ? 'rgba(255,255,255,0.25)' : SEV_TONE[s], color: '#fff' }}>{sevCount(s)}</span>
              ))}
            </button>
          )}
          {editable && secId && (
            <button onClick={submit} disabled={critical > 0} title={critical ? 'Resolve critical clashes first' : ''}
              className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-50" style={{ background: 'var(--brand)' }}>Submit for approval</button>
          )}
        </div>
        {ver && !editable && <p className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>This version is <b>{ver.status}</b> and read-only. Create a new draft or pick a draft/returned version to edit.</p>}
        {critical > 0 && editable && <p className="text-[12px] mt-2" style={{ color: '#b4473f' }}>Publishing is blocked: {critical} critical clash{critical > 1 ? 'es' : ''}. Warnings and advisories do not block.</p>}

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

      {showClash && secId && (
        <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: `1px solid ${critical ? '#b4473f' : 'var(--line)'}` }}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[13px] font-semibold">Clash panel ({clashes.length})</h3>
            <button onClick={() => setShowClash(false)} className="text-[12px]" style={{ color: 'var(--muted)' }}>close</button>
          </div>
          {clashes.length === 0 ? <p className="text-[12.5px]" style={{ color: '#3d8168' }}>✓ No clashes in this draft.</p> : (
            <div className="grid gap-1.5">
              {['critical', 'warning', 'advisory'].flatMap((sv) => clashes.filter((c) => c.severity === sv)).map((c, i) => (
                <div key={i} className="text-[12.5px] rounded px-3 py-1.5 flex items-center gap-2" style={{ background: 'var(--bg)', borderLeft: `3px solid ${SEV_TONE[c.severity]}` }}>
                  <span className="text-[10.5px] rounded px-1.5 py-0.5 text-white font-semibold uppercase" style={{ background: SEV_TONE[c.severity] }}>{c.severity}</span>
                  <span className="text-[11px]" style={{ color: 'var(--muted)' }}>{c.kind}</span>
                  {c.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {secId && opts && (
        <div className="grid lg:grid-cols-[230px_minmax(0,1fr)] gap-4">
          <div className="rounded-xl p-3 lg:sticky lg:top-4 self-start" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="text-[13px] font-semibold">Subjects</h3>
              <span className="text-[11.5px]" style={{ color: toPlace ? 'var(--accent)' : '#3d8168' }}>{toPlace ? `${toPlace} h to place` : 'all placed'}</span>
            </div>
            <p className="text-[11px] mb-2" style={{ color: 'var(--muted)' }}>✋ Drag onto the grid, or click a cell.</p>
            <div className="grid gap-1.5" style={{ maxHeight: 420, overflowY: 'auto' }}>
              {opts.subjects.map((s) => {
                const done = (placed.get(s.code) ?? 0) >= s.credits; const hue = hueOf(s.code);
                return (
                  <div key={s.id} draggable={editable} onDragStart={() => { setDrag(s); setDragFixed(null); }} onDragEnd={() => setDrag(null)}
                    className="rounded-lg px-2.5 py-1.5 select-none" style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderLeft: `4px solid hsl(${hue} 55% 45%)`, cursor: editable ? 'grab' : 'default' }}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px] font-semibold">{s.code}</span>
                      <span className="ml-auto text-[11px] font-semibold tabular-nums" style={{ color: done ? '#3d8168' : 'var(--accent)' }}>{placed.get(s.code) ?? 0}/{s.credits} h</span>
                    </div>
                    <div className="text-[11px] truncate" style={{ color: 'var(--muted)' }}>{s.name}</div>
                    <div className="h-1 mt-1 rounded-full overflow-hidden" style={{ background: 'var(--panel)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, ((placed.get(s.code) ?? 0) / s.credits) * 100)}%`, background: done ? '#3d8168' : `hsl(${hue} 55% 45%)` }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--line)' }}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--muted)' }}>Fixed blocks</h4>
              <div className="flex flex-wrap gap-1.5">
                {FIXED_LABELS.map((l) => (
                  <div key={l} draggable={editable} onDragStart={() => { setDragFixed(l); setDrag(null); }} onDragEnd={() => setDragFixed(null)}
                    className="rounded-lg px-2 py-1 text-[11px] font-medium select-none" style={{ border: '1px dashed var(--line)', background: 'var(--bg)', color: 'var(--ink)', cursor: editable ? 'grab' : 'default',
                      backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, color-mix(in srgb, var(--muted) 10%, transparent) 4px, color-mix(in srgb, var(--muted) 10%, transparent) 5px)' }}>
                    {l}
                  </div>
                ))}
              </div>
            </div>
          </div>

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
                      const e = at(day, p.n!); const key = `${day}-${p.n}`;
                      return (
                        <td key={p.id} className="px-1.5 py-1.5 align-top" style={{ minWidth: 118 }}
                          onDragOver={(ev) => { if (editable && (drag || dragFixed) && !e) { ev.preventDefault(); setOver(key); } }}
                          onDragLeave={() => setOver((o) => (o === key ? null : o))}
                          onDrop={() => { if (!e) dropOn(day, p); }}>
                          {e ? (
                            e.fixed_label ? (
                              <div className="rounded-lg p-1.5" style={{ background: 'var(--bg)', border: '1px dashed var(--line)',
                                backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 4px, color-mix(in srgb, var(--muted) 10%, transparent) 4px, color-mix(in srgb, var(--muted) 10%, transparent) 5px)' }}>
                                <div className="font-medium">{e.fixed_label}</div>
                                {e.room_number && <div style={{ color: 'var(--muted)' }}>{e.room_number}</div>}
                                {editable && <button onClick={() => del(e.entry_id)} className="text-[10.5px] mt-0.5" style={{ color: '#b4473f' }}>remove</button>}
                              </div>
                            ) : (
                              <div className="rounded-lg p-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)', borderLeft: `4px solid hsl(${hueOf(e.subject_code ?? '')} 55% 45%)` }}>
                                <div className="font-medium">{e.subject_code}</div>
                                <div style={{ color: 'var(--muted)' }}>{e.faculty_code ?? 'TBD'}{e.room_number ? ` · ${e.room_number}` : ''}</div>
                                {editable && <button onClick={() => del(e.entry_id)} className="text-[10.5px] mt-0.5" style={{ color: '#b4473f' }}>remove</button>}
                              </div>
                            )
                          ) : editable ? (
                            <button onClick={() => openAdd(day, p)}
                              className="w-full rounded-lg py-2 text-[11px]" style={{ border: `1px ${over === key ? 'solid var(--brand)' : 'dashed var(--line)'}`, background: over === key ? 'var(--bg)' : 'transparent', color: 'var(--muted)' }}>
                              {over === key ? 'drop here' : '+ add'}
                            </button>
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
        </div>
      )}

      {cell && opts && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} onClick={() => { setCell(null); setFixedLabel(null); }}>
          <div className="rounded-xl p-4 w-full max-w-md" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }} onClick={(e) => e.stopPropagation()}>
            <div className="text-[13px] font-semibold mb-1">{fixedLabel ? `Place ${fixedLabel}` : 'Place class'} — {cell.day} P{cell.period.n}</div>
            <p className="text-[11.5px] mb-3" style={{ color: 'var(--muted)' }}>Suggestions are clash-free for this slot. Faculty/room/section clashes are blocked.</p>

            {!fixedLabel && (
              <>
                <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Subject</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className={sel + ' w-full mb-3'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <option value="">Choose subject…</option>
                  {opts.subjects.map((s) => <option key={s.id} value={s.id}>{s.code}{s.name !== s.code ? ` — ${s.name}` : ''}</option>)}
                </select>
                <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Faculty {sug && <span style={{ color: '#3d8168' }}>· {sug.free_faculty.length} free</span>}</label>
                <select value={form.faculty} onChange={(e) => setForm({ ...form, faculty: e.target.value })} className={sel + ' w-full mb-1.5'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <option value="">TBD</option>
                  {opts.faculty.map((f) => <option key={f.id} value={f.id}>{f.code} — {f.name}</option>)}
                </select>
                {sug && <div className="flex flex-wrap gap-1 mb-3">
                  {sug.free_faculty.slice(0, 8).map((f) => (
                    <button key={f.id} onClick={() => setForm((x) => ({ ...x, faculty: f.id }))} className="text-[11px] rounded-full px-2 py-0.5"
                      style={{ border: `1px solid ${form.faculty === f.id ? 'var(--brand)' : 'var(--line)'}`, background: form.faculty === f.id ? 'var(--brand)' : 'var(--bg)', color: form.faculty === f.id ? '#fff' : 'var(--ink)' }}>
                      {f.code} <span style={{ opacity: 0.7 }}>{f.load}h</span>
                    </button>
                  ))}
                </div>}
              </>
            )}

            <label className="block text-[11.5px] mb-1" style={{ color: 'var(--muted)' }}>Room {sug && <span style={{ color: '#3d8168' }}>· {sug.free_rooms.length} free</span>}</label>
            <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} className={sel + ' w-full mb-1.5'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
              <option value="">No room</option>
              {opts.rooms.map((r) => <option key={r.id} value={r.id}>{r.number}{r.cap ? ` (${r.cap})` : ''}</option>)}
            </select>
            {sug && <div className="flex flex-wrap gap-1 mb-3">
              {sug.free_rooms.slice(0, 8).map((r) => (
                <button key={r.id} onClick={() => setForm((x) => ({ ...x, room: r.id }))} className="text-[11px] rounded-full px-2 py-0.5"
                  style={{ border: `1px solid ${form.room === r.id ? 'var(--brand)' : r.fits ? 'var(--line)' : '#c08a2d'}`, background: form.room === r.id ? 'var(--brand)' : 'var(--bg)', color: form.room === r.id ? '#fff' : r.fits ? 'var(--ink)' : '#c08a2d' }}
                  title={r.fits ? 'Fits the section' : 'Smaller than the section strength'}>
                  {r.number}{r.cap ? ` · ${r.cap}` : ''}{!r.fits ? ' ⚠' : ''}
                </button>
              ))}
            </div>}

            <div className="flex gap-2 justify-end">
              <button onClick={() => { setCell(null); setFixedLabel(null); }} className="text-[12.5px] rounded px-3 py-1.5" style={{ border: '1px solid var(--line)' }}>Cancel</button>
              <button onClick={add} disabled={busy || (!fixedLabel && !form.subject)} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: 'var(--brand)' }}>
                {busy ? 'Placing…' : `Place ${fixedLabel ?? subjById(form.subject)?.code ?? 'class'}`}
              </button>
            </div>
            {msg && <p className="text-[12px] mt-2" style={{ color: '#b4473f' }}>{msg}</p>}
          </div>
        </div>
      )}
    </Layout>
  );
}
