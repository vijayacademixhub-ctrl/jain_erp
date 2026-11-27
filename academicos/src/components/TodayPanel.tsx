import type { TimetableRow } from '../lib/types';
import { CHART_COLORS } from './MiniCharts';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const hhmm = (t: string) => t?.slice(0, 5);
const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };

export function TodayPanel({ rows }: { rows: TimetableRow[] }) {
  const now = new Date();
  const todayName = DAYS[now.getDay()];
  const nowMin = now.getHours() * 60 + now.getMinutes();

  const today = rows
    .filter((r) => r.day_of_week === todayName)
    .sort((a, b) => a.period_number - b.period_number);

  // deterministic colour per subject
  const subjects = Array.from(new Set(today.map((r) => r.subject_name ?? r.course_code ?? '—')));
  const colourOf = (r: TimetableRow) => CHART_COLORS[subjects.indexOf(r.subject_name ?? r.course_code ?? '—') % CHART_COLORS.length];

  // find ongoing + next
  const ongoingId = today.find((r) => toMin(r.start_time) <= nowMin && nowMin < toMin(r.end_time))?.id;
  const nextId = today.find((r) => toMin(r.start_time) > nowMin)?.id;

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-[13px] font-semibold">Today · {todayName}</h3>
        <span className="text-[12px]" style={{ color: 'var(--muted)' }}>{today.length} class{today.length !== 1 ? 'es' : ''}</span>
      </div>
      {today.length === 0 ? (
        <p className="text-[13px] py-4 text-center" style={{ color: 'var(--muted)' }}>No classes scheduled today. Enjoy the break.</p>
      ) : (
        <div className="grid gap-2">
          {today.map((r) => {
            const c = colourOf(r);
            const ongoing = r.id === ongoingId;
            const next = r.id === nextId;
            return (
              <div key={r.id} className="rounded-lg overflow-hidden flex items-stretch"
                style={{ background: 'var(--bg)', border: `1px solid ${ongoing ? c : 'var(--line)'}`,
                  boxShadow: ongoing ? `0 0 0 1px ${c}` : undefined }}>
                <div style={{ width: 6, background: c, flexShrink: 0 }} />
                <div className="p-2.5 flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                      {r.subject_name ?? r.course_code ?? 'Class'}
                    </div>
                    {ongoing && <span className="text-[10.5px] rounded px-1.5 py-0.5 text-white font-semibold" style={{ background: c }}>NOW</span>}
                    {next && !ongoing && <span className="text-[10.5px] rounded px-1.5 py-0.5 font-semibold" style={{ background: 'var(--panel)', border: `1px solid ${c}`, color: c }}>NEXT</span>}
                  </div>
                  <div className="text-[12px] mt-0.5" style={{ color: 'var(--muted)' }}>
                    P{r.period_number} · {hhmm(r.start_time)}–{hhmm(r.end_time)}
                    {r.room_number ? ` · Room ${r.room_number}` : ''}
                    {(r.faculty_name || r.faculty_code) ? ` · ${r.faculty_name ?? r.faculty_code}` : ''}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
