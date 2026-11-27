import type { TimetableRow } from '../lib/types';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const fmt = (t: string | null) => (t ? t.slice(0, 5) : '');

export function TimetableGrid({ rows }: { rows: TimetableRow[] }) {
  if (rows.length === 0)
    return <p style={{ color: 'var(--muted)' }} className="text-sm py-8 text-center">No classes match this selection.</p>;

  const periods = [...new Set(rows.map((r) => r.period_number))].sort((a, b) => a - b);
  const cell = (day: string, p: number) =>
    rows.filter((r) => r.day_of_week === day && r.period_number === p);
  const timeOf = (p: number) => { const r = rows.find((x) => x.period_number === p); return r ? `${fmt(r.start_time)}–${fmt(r.end_time)}` : `P${p}`; };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12.5px]" style={{ minWidth: 820 }}>
        <thead>
          <tr>
            <th className="p-2 text-left" style={{ borderBottom: '2px solid var(--line)', color: 'var(--muted)' }}>Day</th>
            {periods.map((p) => (
              <th key={p} className="p-2 text-left align-bottom" style={{ borderBottom: '2px solid var(--line)' }}>
                <div style={{ color: 'var(--brand)' }} className="font-semibold">P{p}</div>
                <div style={{ color: 'var(--muted)' }} className="text-[10.5px] font-normal">{timeOf(p)}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.filter((d) => rows.some((r) => r.day_of_week === d)).map((day) => (
            <tr key={day}>
              <td className="p-2 font-semibold align-top" style={{ borderBottom: '1px solid var(--line)' }}>{day}</td>
              {periods.map((p) => (
                <td key={p} className="p-1.5 align-top" style={{ borderBottom: '1px solid var(--line)', borderLeft: '1px solid var(--line)' }}>
                  {cell(day, p).map((r) => (
                    <div key={r.id} className="mb-1 rounded px-1.5 py-1" style={{ background: 'var(--bg)' }}>
                      <div className="font-medium leading-tight">{r.subject_name ?? r.course_code}</div>
                      <div style={{ color: 'var(--muted)' }} className="text-[10.5px]">
                        {(r.faculty_name ?? r.faculty_code ?? 'TBD')}{r.room_number ? ` · ${r.room_number}` : ''}
                      </div>
                      <div style={{ color: 'var(--accent)' }} className="text-[10px]">{r.sections.join(', ')}</div>
                    </div>
                  ))}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
