import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';

interface Room { id: string; room_number: string; building: string | null; room_type: string | null; capacity_label: string | null }
interface Booking {
  id: string; room_number: string; purpose: string; booking_date: string;
  start_time: string; end_time: string; status: string; decision_comments: string | null;
}
interface Conflict { kind: string; label: string; c_start: string; c_end: string }

const STATUS_TONE: Record<string, string> = { pending: '#c08a2d', approved: '#3d8168', rejected: '#b4473f', cancelled: '#8a8a8a' };
const hhmm = (t: string) => t?.slice(0, 5);

export default function FacultyRooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [mine, setMine] = useState<Booking[]>([]);
  const [room, setRoom] = useState('');
  const [date, setDate] = useState('');
  const [start, setStart] = useState('17:30');
  const [end, setEnd] = useState('18:30');
  const [purpose, setPurpose] = useState('');
  const [check, setCheck] = useState<{ ok: boolean; conflicts: Conflict[] } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function loadMine() {
    supabase.from('v_room_bookings').select('id,room_number,purpose,booking_date,start_time,end_time,status,decision_comments')
      .order('booking_date', { ascending: false }).then(({ data }) => setMine((data ?? []) as Booking[]));
  }
  useEffect(() => {
    supabase.from('rooms').select('id,room_number,building,room_type,capacity_label').eq('bookable', true)
      .order('room_number').then(({ data }) => setRooms((data ?? []) as Room[]));
    loadMine();
  }, []);

  async function runCheck() {
    setCheck(null); setMsg(null);
    if (!room || !date) { setMsg('Pick a room and date first.'); return; }
    const { data, error } = await supabase.rpc('room_conflicts', { p_room: room, p_date: date, p_start: start, p_end: end });
    if (error) { setMsg(error.message); return; }
    const conflicts = (data ?? []) as Conflict[];
    setCheck({ ok: conflicts.length === 0, conflicts });
  }

  async function request() {
    setBusy(true); setMsg(null);
    const { error } = await supabase.rpc('request_room_booking', {
      p_room: room, p_date: date, p_start: start, p_end: end, p_purpose: purpose,
    });
    setBusy(false);
    if (error) setMsg(error.message);
    else { setMsg('Booking requested — awaiting admin approval.'); setPurpose(''); setCheck(null); loadMine(); }
  }

  async function cancel(id: string) {
    const { error } = await supabase.rpc('cancel_room_booking', { p_booking: id });
    if (error) setMsg(error.message); else loadMine();
  }

  const inp = 'rounded px-2 py-1.5 text-[12.5px]';
  const inpStyle = { border: '1px solid var(--line)', background: 'var(--bg)' };
  return (
    <Layout title="Room Booking">
      <FacultyNav />
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h3 className="text-[13px] font-semibold mb-3">Request a room</h3>
          <div className="grid gap-2">
            <select value={room} onChange={(e) => { setRoom(e.target.value); setCheck(null); }} className={inp} style={inpStyle}>
              <option value="">Select room…</option>
              {rooms.map((r) => <option key={r.id} value={r.id}>
                {r.room_number}{r.room_type ? ` · ${r.room_type}` : ''}{r.capacity_label ? ` · ${r.capacity_label}` : ''}
              </option>)}
            </select>
            <div className="flex gap-2">
              <input type="date" value={date} onChange={(e) => { setDate(e.target.value); setCheck(null); }} className={`${inp} flex-1`} style={inpStyle} />
              <input type="time" value={start} onChange={(e) => { setStart(e.target.value); setCheck(null); }} className={inp} style={inpStyle} />
              <input type="time" value={end} onChange={(e) => { setEnd(e.target.value); setCheck(null); }} className={inp} style={inpStyle} />
            </div>
            <input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Purpose (e.g. guest lecture, club event)" className={inp} style={inpStyle} />
            <div className="flex gap-2">
              <button onClick={runCheck} className={`${inp} font-medium`} style={{ border: '1px solid var(--line)' }}>Check availability</button>
              <button onClick={request} disabled={busy || !room || !date || !purpose}
                className={`${inp} font-medium text-white disabled:opacity-50`} style={{ background: 'var(--brand)' }}>
                {busy ? 'Requesting…' : 'Request booking'}
              </button>
            </div>
            {check && (
              <div className="rounded px-3 py-2 text-[12.5px]" style={{
                background: 'var(--bg)', border: `1px solid ${check.ok ? '#3d8168' : '#b4473f'}`,
                color: check.ok ? '#3d8168' : '#b4473f',
              }}>
                {check.ok ? '✓ Available — no clashes at this time.' : (
                  <div>
                    <div className="font-medium mb-1">Occupied at that time:</div>
                    {check.conflicts.map((c, i) => <div key={i}>• {c.label} ({hhmm(c.c_start)}–{hhmm(c.c_end)})</div>)}
                  </div>
                )}
              </div>
            )}
            {msg && <p className="text-[12.5px]" style={{ color: 'var(--accent)' }}>{msg}</p>}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <h3 className="text-[13px] font-semibold mb-3">My bookings</h3>
          <div className="grid gap-2">
            {mine.map((b) => (
              <div key={b.id} className="rounded-lg p-2.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[12.5px] font-medium">Room {b.room_number} · {b.booking_date}</div>
                  <span className="text-[11px] rounded px-2 py-0.5 text-white font-medium capitalize" style={{ background: STATUS_TONE[b.status] }}>{b.status}</span>
                </div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{hhmm(b.start_time)}–{hhmm(b.end_time)} · {b.purpose}</div>
                {b.decision_comments && <div className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>Note: {b.decision_comments}</div>}
                {(b.status === 'pending' || b.status === 'approved') && (
                  <button onClick={() => cancel(b.id)} className="text-[11.5px] mt-1 rounded px-2 py-0.5" style={{ border: '1px solid var(--line)' }}>Cancel</button>
                )}
              </div>
            ))}
            {mine.length === 0 && <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>No bookings yet.</p>}
          </div>
        </div>
      </div>
    </Layout>
  );
}
