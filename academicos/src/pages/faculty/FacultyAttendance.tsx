import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { TimetableRow } from '../../lib/types';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
interface RosterRow { student_id: string; usn: string; full_name: string; section: string }

export default function FacultyAttendance() {
  const { session } = useAuth();
  const [code, setCode] = useState<string | null>(null);
  const [date, setDate] = useState('2027-01-05'); // a teaching day in the semester
  const [classes, setClasses] = useState<TimetableRow[]>([]);
  const [active, setActive] = useState<TimetableRow | null>(null);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [marks, setMarks] = useState<Record<string, 'present' | 'absent'>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const weekday = useMemo(() => DAYS[new Date(date + 'T00:00:00').getDay()], [date]);

  useEffect(() => {
    if (!session) return;
    supabase.from('faculty').select('short_code').eq('profile_id', session.user.id).maybeSingle()
      .then(({ data }) => setCode((data as { short_code: string } | null)?.short_code ?? null));
  }, [session]);

  useEffect(() => {
    if (!code) return;
    supabase.from('v_timetable_display').select('*')
      .eq('version_status', 'published').eq('faculty_code', code).eq('day_of_week', weekday)
      .then(({ data }) => { setClasses((data ?? []) as TimetableRow[]); setActive(null); });
  }, [code, weekday]);

  async function open(c: TimetableRow) {
    setActive(c); setMsg(null); setRoster([]);
    const { data } = await supabase.from('v_entry_roster').select('*').eq('entry_id', c.id).order('usn');
    const r = (data ?? []) as RosterRow[];
    setRoster(r);
    setMarks(Object.fromEntries(r.map((s) => [s.student_id, 'present'])) as Record<string, 'present' | 'absent'>);
  }

  async function submit() {
    if (!active) return;
    setBusy(true); setMsg(null);
    const records = roster.map((s) => ({ student_id: s.student_id, status: marks[s.student_id] ?? 'present' }));
    const { error } = await supabase.rpc('mark_attendance', { p_entry: active.id, p_date: date, p_records: records });
    setBusy(false);
    setMsg(error ? error.message : `Attendance submitted for ${roster.length} students.`);
  }

  const present = Object.values(marks).filter((m) => m === 'present').length;
  return (
    <Layout title="Attendance">
      <FacultyNav />
      {!code ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No faculty profile linked to this account.</p> : (
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <div className="flex items-center gap-2 mb-4">
            <label className="text-[13px]" style={{ color: 'var(--muted)' }}>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
              className="rounded px-2 py-1.5 text-[13px]" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} />
            <span className="text-[13px]" style={{ color: 'var(--muted)' }}>{weekday} · {classes.length} classes</span>
          </div>

          {!active ? (
            classes.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>No classes on this day.</p> :
            <div className="grid gap-2">
              {classes.map((c) => (
                <button key={c.id} onClick={() => open(c)} className="text-left rounded-lg p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <div className="font-medium">{c.subject_name ?? c.course_code} · P{c.period_number} {c.start_time?.slice(0,5)}</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{c.sections.join(', ')}{c.room_number ? ` · Room ${c.room_number}` : ''}</div>
                </button>
              ))}
            </div>
          ) : (
            <div>
              <button onClick={() => setActive(null)} className="text-[12.5px] mb-3" style={{ color: 'var(--brand)' }}>← Back to classes</button>
              <div className="font-medium mb-1">{active.subject_name ?? active.course_code} · {active.sections.join(', ')}</div>
              <div className="text-[12px] mb-3" style={{ color: 'var(--muted)' }}>{roster.length} students · {present} present · {roster.length - present} absent</div>
              <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--line)', maxHeight: 420, overflowY: 'auto' }}>
                {roster.map((s) => {
                  const p = (marks[s.student_id] ?? 'present') === 'present';
                  return (
                    <div key={s.student_id} className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--line)' }}>
                      <div className="flex-1"><span className="text-[12px] font-mono" style={{ color: 'var(--muted)' }}>{s.usn}</span> <span className="text-[13px]">{s.full_name}</span></div>
                      <button onClick={() => setMarks((m) => ({ ...m, [s.student_id]: p ? 'absent' : 'present' }))}
                        className="text-[12px] rounded px-3 py-1 font-medium"
                        style={{ background: p ? 'var(--accent)' : '#b4473f', color: '#fff' }}>{p ? 'Present' : 'Absent'}</button>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-3">
                <button onClick={submit} disabled={busy || !roster.length} className="rounded px-4 py-2 font-medium text-white" style={{ background: 'var(--brand)' }}>
                  {busy ? 'Submitting…' : 'Submit attendance'}</button>
                {msg && <span className="text-[12.5px]" style={{ color: msg.includes('submitted') ? 'var(--accent)' : '#b4473f' }}>{msg}</span>}
              </div>
            </div>
          )}
        </div>
      )}
    </Layout>
  );
}
