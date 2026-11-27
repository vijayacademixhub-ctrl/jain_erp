import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';
import type { TimetableRow } from '../../lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
interface Faculty { id: string; short_code: string; full_name: string }
interface Change { id: string; subject_name: string | null; period_number: number; sections: string[] | null;
  change_type: string; original_faculty: string | null; new_faculty: string | null; new_faculty_name: string | null; reason: string | null }
interface Sec { id: string; label: string }
interface BOpt { id: string; code?: string; name?: string; n?: number }

const TYPES: [string, string][] = [
  ['substitution', 'Substitute'], ['room_change', 'Room change'], ['cancellation', 'Cancel'], ['swap', 'Swap'], ['extra_class', 'Extra class'],
];

export default function DailyChanges() {
  const [date, setDate] = useState('2027-01-05');
  const [sem, setSem] = useState(6);
  const [classes, setClasses] = useState<TimetableRow[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<{ id: string; room_number: string }[]>([]);
  const [sections, setSections] = useState<Sec[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [sel, setSel] = useState<TimetableRow | null>(null);
  const [ctype, setCtype] = useState('substitution');
  const [sub, setSub] = useState('');
  const [room, setRoom] = useState('');
  const [swapWith, setSwapWith] = useState('');
  const [reason, setReason] = useState('');
  // extra-class form
  const [xSection, setXSection] = useState('');
  const [xOpts, setXOpts] = useState<{ subjects: BOpt[]; periods: BOpt[] } | null>(null);
  const [xPeriod, setXPeriod] = useState('');
  const [xSubject, setXSubject] = useState('');
  const [xFaculty, setXFaculty] = useState('');
  const [xRoom, setXRoom] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekday = useMemo(() => DAYS[new Date(date + 'T00:00:00').getDay()], [date]);

  useEffect(() => {
    supabase.from('faculty').select('id,short_code,full_name').order('short_code').then(({ data }) => setFaculty((data ?? []) as Faculty[]));
    supabase.from('rooms').select('id,room_number').order('room_number').then(({ data }) => setRooms((data ?? []) as { id: string; room_number: string }[]));
  }, []);

  useEffect(() => {
    supabase.from('sections').select('id,label,semesters!inner(semester_number)').eq('semesters.semester_number', sem).order('label')
      .then(({ data }) => setSections(((data ?? []) as Sec[]).map((s) => ({ id: s.id, label: s.label }))));
  }, [sem]);

  // load builder options (subjects/periods) for the extra-class section
  useEffect(() => {
    if (!xSection) { setXOpts(null); return; }
    supabase.rpc('tt_builder_options', { p_section: xSection }).then(({ data }) => setXOpts((data ?? null) as { subjects: BOpt[]; periods: BOpt[] } | null));
  }, [xSection]);

  function loadChanges() {
    supabase.from('v_daily_changes').select('*').eq('class_date', date).then(({ data }) => setChanges((data ?? []) as Change[]));
  }
  useEffect(() => {
    supabase.from('v_timetable_display').select('*').eq('version_status', 'published')
      .eq('semester_number', sem).eq('day_of_week', weekday)
      .then(({ data }) => { setClasses((data ?? []) as TimetableRow[]); setSel(null); });
    loadChanges();
  }, [sem, weekday, date]);

  async function apply() {
    setMsg(null);
    if (ctype === 'extra_class') {
      if (!xSection || !xPeriod || !xSubject) { setMsg('Pick section, period and subject.'); return; }
      setBusy(true);
      const { error } = await supabase.rpc('tt_daily_extra', { p_date: date, p_period: xPeriod, p_subject: xSubject, p_faculty: xFaculty || null, p_room: xRoom || null, p_section: xSection, p_reason: reason || null });
      setBusy(false);
      if (error) setMsg(error.message); else { setMsg('Extra class scheduled; the section and faculty are notified.'); setXPeriod(''); setXSubject(''); setXFaculty(''); setXRoom(''); setReason(''); loadChanges(); }
      return;
    }
    if (!sel) { setMsg('Pick a class first.'); return; }
    setBusy(true);
    let error;
    if (ctype === 'swap') {
      if (!swapWith) { setMsg('Pick the class to swap with.'); setBusy(false); return; }
      ({ error } = await supabase.rpc('tt_daily_swap', { p_entry_a: sel.id, p_entry_b: swapWith, p_date: date, p_reason: reason || null }));
    } else {
      if (ctype === 'substitution' && !sub) { setMsg('Pick a substitute faculty.'); setBusy(false); return; }
      if (ctype === 'room_change' && !room) { setMsg('Pick the new room.'); setBusy(false); return; }
      ({ error } = await supabase.rpc('record_tt_change', {
        p_entry: sel.id, p_date: date, p_type: ctype,
        p_new_faculty: ctype === 'substitution' ? sub : null, p_new_room: ctype === 'room_change' ? room : null, p_reason: reason || null,
      }));
    }
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      const done: Record<string, string> = {
        substitution: 'Substitute assigned — workload credits the substitute; both faculty appear on the attendance record.',
        room_change: 'Room changed for this class; students and faculty are notified.',
        cancellation: 'Class cancelled for the day; students and faculty are notified.',
        swap: 'Classes swapped; both faculty and both sections are notified.',
      };
      setMsg(done[ctype] ?? 'Change applied.'); setSel(null); setSub(''); setRoom(''); setSwapWith(''); setReason(''); loadChanges();
    }
  }

  const i = 'rounded px-2.5 py-1.5 text-[13px]';
  const panelInput = { border: '1px solid var(--line)', background: 'var(--panel)' };
  const typeBtns = (
    <div className="flex flex-wrap gap-1 mb-2">
      {TYPES.map(([v, l]) => (
        <button key={v} onClick={() => { setCtype(v); setMsg(null); }} className="text-[12px] rounded px-2.5 py-1"
          style={{ background: ctype === v ? 'var(--brand)' : 'var(--panel)', color: ctype === v ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>{l}</button>
      ))}
    </div>
  );

  return (
    <Layout title="Daily Timetable">
      <CommitteeNav />
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={i} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
          <select className={i} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={sem} onChange={(e) => setSem(Number(e.target.value))}>
            {[2, 4, 6].map((s) => <option key={s} value={s}>{s}th Sem</option>)}
          </select>
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{weekday} · {classes.length} classes</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div style={{ maxHeight: 400, overflowY: 'auto' }} className="rounded-lg">
            {classes.map((c) => (
              <button key={c.id} onClick={() => { setSel(c); setMsg(null); }} className="w-full text-left px-3 py-2"
                style={{ borderBottom: '1px solid var(--line)', background: sel?.id === c.id ? 'var(--bg)' : 'transparent' }}>
                <div className="text-[13px] font-medium">{c.subject_name ?? c.course_code} · P{c.period_number}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{(c.faculty_name ?? c.faculty_code ?? 'TBD')} · {c.sections.join(', ')}</div>
              </button>
            ))}
            {classes.length === 0 && <p className="text-[12.5px] px-3 py-2" style={{ color: 'var(--muted)' }}>No scheduled classes this day. You can still add an extra class.</p>}
          </div>

          <div className="rounded-lg p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
            {typeBtns}

            {ctype === 'extra_class' ? (
              <div>
                <p className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>Schedule a class that is not in the master timetable (e.g. doubt-clearing, make-up).</p>
                <select value={xSection} onChange={(e) => setXSection(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={panelInput}>
                  <option value="">Section…</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <div className="flex gap-2 mb-2">
                  <select value={xPeriod} onChange={(e) => setXPeriod(e.target.value)} className="flex-1 rounded px-2 py-1.5 text-[13px]" style={panelInput}>
                    <option value="">Period…</option>
                    {(xOpts?.periods ?? []).map((p) => <option key={p.id} value={p.id}>P{p.n}</option>)}
                  </select>
                  <select value={xSubject} onChange={(e) => setXSubject(e.target.value)} className="flex-1 rounded px-2 py-1.5 text-[13px]" style={panelInput}>
                    <option value="">Subject…</option>
                    {(xOpts?.subjects ?? []).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 mb-2">
                  <select value={xFaculty} onChange={(e) => setXFaculty(e.target.value)} className="flex-1 rounded px-2 py-1.5 text-[13px]" style={panelInput}>
                    <option value="">Faculty (optional)…</option>
                    {faculty.map((f) => <option key={f.id} value={f.id}>{f.short_code} — {f.full_name}</option>)}
                  </select>
                  <select value={xRoom} onChange={(e) => setXRoom(e.target.value)} className="flex-1 rounded px-2 py-1.5 text-[13px]" style={panelInput}>
                    <option value="">Room (optional)…</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                  </select>
                </div>
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded px-2 py-1.5 text-[13px] mb-3" style={panelInput} />
                <button onClick={apply} disabled={busy} className="rounded px-4 py-2 font-medium text-white" style={{ background: 'var(--brand)' }}>{busy ? 'Adding…' : 'Add extra class'}</button>
              </div>
            ) : !sel ? (
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Select a class to apply a change.</p>
            ) : (
              <div>
                <div className="text-[13px] font-medium mb-1">{sel.subject_name ?? sel.course_code}</div>
                <div className="text-[11.5px] mb-3" style={{ color: 'var(--muted)' }}>Original: {sel.faculty_name ?? sel.faculty_code ?? 'TBD'}{sel.room_number ? ` · ${sel.room_number}` : ''} · {sel.sections.join(', ')}</div>
                {ctype === 'substitution' && (
                  <select value={sub} onChange={(e) => setSub(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={panelInput}>
                    <option value="">Choose substitute faculty…</option>
                    {faculty.map((f) => <option key={f.id} value={f.id}>{f.short_code} — {f.full_name}</option>)}
                  </select>
                )}
                {ctype === 'room_change' && (
                  <select value={room} onChange={(e) => setRoom(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={panelInput}>
                    <option value="">Choose new room…</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                  </select>
                )}
                {ctype === 'cancellation' && <p className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>The class will be marked cancelled for {date}.</p>}
                {ctype === 'swap' && (
                  <select value={swapWith} onChange={(e) => setSwapWith(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={panelInput}>
                    <option value="">Swap faculty with…</option>
                    {classes.filter((c) => c.id !== sel.id && (c.faculty_code || c.faculty_name)).map((c) => (
                      <option key={c.id} value={c.id}>{c.subject_name ?? c.course_code} · P{c.period_number} · {c.faculty_name ?? c.faculty_code}</option>
                    ))}
                  </select>
                )}
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="w-full rounded px-2 py-1.5 text-[13px] mb-3" style={panelInput} />
                <button onClick={apply} disabled={busy} className="rounded px-4 py-2 font-medium text-white" style={{ background: 'var(--brand)' }}>{busy ? 'Applying…' : 'Apply change'}</button>
              </div>
            )}
            {msg && <p className="text-[12px] mt-3" style={{ color: /assigned|scheduled|swapped|changed|cancelled|applied/i.test(msg) ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="text-[13px] font-medium mb-2">Changes on {date} ({changes.length})</div>
        {changes.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No changes recorded.</p> :
          <div className="grid gap-1.5">
            {changes.map((c) => (
              <div key={c.id} className="text-[12.5px] rounded px-3 py-2" style={{ background: 'var(--bg)' }}>
                <span className="font-medium capitalize">{c.change_type.replace('_', ' ')}</span> · {c.subject_name} · P{c.period_number} · {(c.sections ?? []).join(', ')}
                {c.new_faculty && <> · <span style={{ color: 'var(--muted)' }}>{c.original_faculty ? `${c.original_faculty} → ` : ''}</span><span style={{ color: 'var(--accent)' }}>{c.new_faculty_name ?? c.new_faculty}</span></>}
                {c.reason && <span style={{ color: 'var(--muted)' }}> · {c.reason}</span>}
              </div>
            ))}
          </div>}
      </div>
    </Layout>
  );
}
