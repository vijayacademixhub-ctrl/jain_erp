import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';
import type { TimetableRow } from '../../lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
interface Faculty { id: string; short_code: string; full_name: string }
interface Change { id: string; subject_name: string | null; period_number: number; sections: string[] | null;
  change_type: string; original_faculty: string | null; new_faculty: string | null; new_faculty_name: string | null; reason: string | null }

export default function DailyChanges() {
  const [date, setDate] = useState('2027-01-05');
  const [sem, setSem] = useState(6);
  const [classes, setClasses] = useState<TimetableRow[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [rooms, setRooms] = useState<{ id: string; room_number: string }[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [sel, setSel] = useState<TimetableRow | null>(null);
  const [ctype, setCtype] = useState('substitution');
  const [sub, setSub] = useState('');
  const [room, setRoom] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const weekday = useMemo(() => DAYS[new Date(date + 'T00:00:00').getDay()], [date]);

  useEffect(() => {
    supabase.from('faculty').select('id,short_code,full_name').order('short_code').then(({ data }) => setFaculty((data ?? []) as Faculty[]));
    supabase.from('rooms').select('id,room_number').order('room_number').then(({ data }) => setRooms((data ?? []) as { id: string; room_number: string }[]));
  }, []);

  function loadChanges() {
    supabase.from('v_daily_changes').select('*').eq('class_date', date)
      .then(({ data }) => setChanges((data ?? []) as Change[]));
  }
  useEffect(() => {
    supabase.from('v_timetable_display').select('*').eq('version_status', 'published')
      .eq('semester_number', sem).eq('day_of_week', weekday)
      .then(({ data }) => { setClasses((data ?? []) as TimetableRow[]); setSel(null); });
    loadChanges();
  }, [sem, weekday, date]);

  async function assign() {
    if (!sel) { setMsg('Pick a class first.'); return; }
    if (ctype === 'substitution' && !sub) { setMsg('Pick a substitute faculty.'); return; }
    if (ctype === 'room_change' && !room) { setMsg('Pick the new room.'); return; }
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('record_tt_change', {
      p_entry: sel.id, p_date: date, p_type: ctype,
      p_new_faculty: ctype === 'substitution' ? sub : null,
      p_new_room: ctype === 'room_change' ? room : null,
      p_reason: reason || null,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else {
      const done = ctype === 'substitution' ? 'Substitute assigned — workload credits the substitute; both faculty appear on the attendance record.'
        : ctype === 'room_change' ? 'Room changed for this class; students and faculty are notified.'
        : 'Class cancelled for the day; students and faculty are notified.';
      setMsg(done); setSel(null); setSub(''); setRoom(''); setReason(''); loadChanges();
    }
  }

  const sel2 = 'rounded px-2.5 py-1.5 text-[13px]';
  return (
    <Layout title="Daily Timetable Changes">
      <CommitteeNav />
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={sel2} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
          <select className={sel2} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={sem} onChange={(e) => setSem(Number(e.target.value))}>
            {[2, 4, 6].map((s) => <option key={s} value={s}>{s}th Sem</option>)}
          </select>
          <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{weekday} · {classes.length} classes</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div style={{ maxHeight: 360, overflowY: 'auto' }} className="rounded-lg" >
            {classes.map((c) => (
              <button key={c.id} onClick={() => { setSel(c); setMsg(null); }} className="w-full text-left px-3 py-2"
                style={{ borderBottom: '1px solid var(--line)', background: sel?.id === c.id ? 'var(--bg)' : 'transparent' }}>
                <div className="text-[13px] font-medium">{c.subject_name ?? c.course_code} · P{c.period_number}</div>
                <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{(c.faculty_name ?? c.faculty_code ?? 'TBD')} · {c.sections.join(', ')}</div>
              </button>
            ))}
          </div>
          <div className="rounded-lg p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
            {!sel ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>Select a class to apply a change.</p> : (
              <div>
                <div className="text-[13px] font-medium mb-1">{sel.subject_name ?? sel.course_code}</div>
                <div className="text-[11.5px] mb-3" style={{ color: 'var(--muted)' }}>Original: {sel.faculty_name ?? sel.faculty_code ?? 'TBD'}{sel.room_number ? ` · ${sel.room_number}` : ''} · {sel.sections.join(', ')}</div>
                <label className="block text-[12px] mb-1" style={{ color: 'var(--muted)' }}>Change type</label>
                <div className="flex gap-1 mb-2">
                  {([['substitution', 'Substitute'], ['room_change', 'Room change'], ['cancellation', 'Cancel']] as [string, string][]).map(([v, l]) => (
                    <button key={v} onClick={() => setCtype(v)} className="text-[12px] rounded px-2.5 py-1"
                      style={{ background: ctype === v ? 'var(--brand)' : 'var(--panel)', color: ctype === v ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>{l}</button>
                  ))}
                </div>
                {ctype === 'substitution' && (
                  <select value={sub} onChange={(e) => setSub(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
                    <option value="">Choose substitute faculty…</option>
                    {faculty.map((f) => <option key={f.id} value={f.id}>{f.short_code} — {f.full_name}</option>)}
                  </select>
                )}
                {ctype === 'room_change' && (
                  <select value={room} onChange={(e) => setRoom(e.target.value)} className="w-full rounded px-2 py-1.5 text-[13px] mb-2" style={{ border: '1px solid var(--line)', background: 'var(--panel)' }}>
                    <option value="">Choose new room…</option>
                    {rooms.map((r) => <option key={r.id} value={r.id}>{r.room_number}</option>)}
                  </select>
                )}
                {ctype === 'cancellation' && <p className="text-[12px] mb-2" style={{ color: 'var(--muted)' }}>The class will be marked cancelled for {date}.</p>}
                <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)"
                  className="w-full rounded px-2 py-1.5 text-[13px] mb-3" style={{ border: '1px solid var(--line)', background: 'var(--panel)' }} />
                <button onClick={assign} disabled={busy} className="rounded px-4 py-2 font-medium text-white" style={{ background: 'var(--brand)' }}>
                  {busy ? 'Applying…' : 'Apply change'}</button>
              </div>
            )}
            {msg && <p className="text-[12px] mt-3" style={{ color: msg.includes('assigned') ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
          </div>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="text-[13px] font-medium mb-2">Changes on {date} ({changes.length})</div>
        {changes.length === 0 ? <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No changes recorded.</p> :
          <div className="grid gap-1.5">
            {changes.map((c) => (
              <div key={c.id} className="text-[12.5px] rounded px-3 py-2" style={{ background: 'var(--bg)' }}>
                <span className="font-medium">{c.change_type}</span> · {c.subject_name} · P{c.period_number} · {(c.sections ?? []).join(', ')}
                {c.new_faculty && <> · <span style={{ color: 'var(--muted)' }}>{c.original_faculty} → </span><span style={{ color: 'var(--accent)' }}>{c.new_faculty_name ?? c.new_faculty}</span></>}
                {c.reason && <span style={{ color: 'var(--muted)' }}> · {c.reason}</span>}
              </div>
            ))}
          </div>}
      </div>
    </Layout>
  );
}
