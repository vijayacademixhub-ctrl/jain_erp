import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';

interface Booking {
  id: string; room_number: string; building: string | null; room_type: string | null;
  purpose: string; booking_date: string; start_time: string; end_time: string; status: string;
  requested_by_name: string | null; decided_by_name: string | null; decision_comments: string | null;
}
const hhmm = (t: string) => t?.slice(0, 5);

export default function AdminRooms() {
  const [rows, setRows] = useState<Booking[]>([]);
  const [comment, setComment] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    supabase.from('v_room_bookings')
      .select('id,room_number,building,room_type,purpose,booking_date,start_time,end_time,status,requested_by_name,decided_by_name,decision_comments')
      .order('booking_date').then(({ data }) => setRows((data ?? []) as Booking[]));
  }
  useEffect(() => { load(); }, []);

  async function decide(b: Booking, approve: boolean) {
    setBusy(b.id); setMsg(null);
    const { error } = await supabase.rpc('decide_room_booking', { p_booking: b.id, p_approve: approve, p_comments: comment[b.id] || null });
    setBusy(null);
    if (error) setMsg(error.message); else { setMsg(approve ? 'Booking approved.' : 'Booking rejected.'); load(); }
  }

  const pending = rows.filter((b) => b.status === 'pending');
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = rows.filter((b) => b.status === 'approved' && b.booking_date >= today);
  const byDate = upcoming.reduce<Record<string, Booking[]>>((acc, b) => {
    (acc[b.booking_date] ??= []).push(b); return acc;
  }, {});

  return (
    <Layout title="Room Bookings">
      <AdminNav />

      <h2 className="text-[12px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted)' }}>
        Pending approval ({pending.length})
      </h2>
      <div className="grid gap-2 mb-6">
        {pending.map((b) => (
          <div key={b.id} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium">Room {b.room_number}{b.room_type ? ` · ${b.room_type}` : ''} — {b.purpose}</div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  {b.booking_date} · {hhmm(b.start_time)}–{hhmm(b.end_time)} · requested by {b.requested_by_name ?? '—'}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <input value={comment[b.id] ?? ''} onChange={(e) => setComment({ ...comment, [b.id]: e.target.value })}
                placeholder="Comment (optional)" className="rounded px-2 py-1.5 text-[12.5px] flex-1"
                style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 180 }} />
              <button disabled={busy === b.id} onClick={() => decide(b, true)}
                className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: 'var(--accent)' }}>Approve</button>
              <button disabled={busy === b.id} onClick={() => decide(b, false)}
                className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: '#b4473f' }}>Reject</button>
            </div>
          </div>
        ))}
        {pending.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No bookings awaiting approval.</p>}
      </div>

      <h2 className="text-[12px] uppercase tracking-wide font-semibold mb-2" style={{ color: 'var(--muted)' }}>Upcoming approved bookings</h2>
      <div className="grid gap-3">
        {Object.keys(byDate).sort().map((d) => (
          <div key={d} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="text-[12.5px] font-semibold mb-2" style={{ color: 'var(--brand)' }}>
              {new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' })}
            </div>
            <div className="grid gap-1.5">
              {byDate[d].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((b) => (
                <div key={b.id} className="flex items-center gap-3 text-[12.5px]">
                  <span className="tabular-nums whitespace-nowrap" style={{ color: 'var(--muted)', width: 96 }}>{hhmm(b.start_time)}–{hhmm(b.end_time)}</span>
                  <span className="rounded px-2 py-0.5 text-[11px] text-white font-medium" style={{ background: 'var(--brand)' }}>Room {b.room_number}</span>
                  <span>{b.purpose}</span>
                  <span style={{ color: 'var(--muted)' }}>· {b.requested_by_name ?? ''}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {upcoming.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No upcoming approved bookings.</p>}
      </div>

      {msg && <p className="text-[12.5px] mt-3" style={{ color: 'var(--accent)' }}>{msg}</p>}
    </Layout>
  );
}
