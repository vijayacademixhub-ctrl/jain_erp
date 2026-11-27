import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Ev {
  assessment_date: string; title: string; assessment_type: string | null;
  max_marks: number | null; subject_code: string; faculty_code: string | null;
}

function typeTone(t: string | null): string {
  const x = (t ?? '').toLowerCase();
  if (x.includes('end') || x.includes('final')) return '#b4473f';
  if (x.includes('exam') || x.includes('test')) return '#c0552d';
  if (x.includes('assign')) return '#c08a2d';
  if (x.includes('seminar') || x.includes('present')) return '#7a4fb0';
  return '#2d7d9a';
}
function countdown(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00');
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 864e5);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return `in ${days} days`;
  if (days < 14) return 'next week';
  return `in ${Math.round(days / 7)} weeks`;
}

export function UpcomingEvents({ sectionId }: { sectionId: string | null }) {
  const [rows, setRows] = useState<Ev[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!sectionId) { setRows([]); setLoaded(false); return; }
    setLoaded(false);
    supabase.rpc('section_upcoming_events', { p_section_id: sectionId })
      .then(({ data }) => { setRows((data ?? []) as Ev[]); setLoaded(true); });
  }, [sectionId]);

  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <h3 className="text-[13px] font-semibold mb-3">Upcoming events</h3>
      {!sectionId ? (
        <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>Select your section to see tests, exams and seminars.</p>
      ) : loaded && rows.length === 0 ? (
        <p className="text-[13px] py-3 text-center" style={{ color: 'var(--muted)' }}>No upcoming assessments announced.</p>
      ) : (
        <div className="grid gap-2">
          {rows.map((e, i) => {
            const tone = typeTone(e.assessment_type);
            return (
              <div key={i} className="rounded-lg p-2.5 flex items-center gap-3" style={{ background: 'var(--bg)', border: '1px solid var(--line)' }}>
                <div className="flex flex-col items-center justify-center rounded-md px-2 py-1 text-white" style={{ background: tone, minWidth: 54 }}>
                  <span className="text-[15px] font-bold leading-none">{new Date(e.assessment_date + 'T00:00').getDate()}</span>
                  <span className="text-[10px] uppercase">{new Date(e.assessment_date + 'T00:00').toLocaleDateString(undefined, { month: 'short' })}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-medium truncate" style={{ color: 'var(--ink)' }}>{e.title}</div>
                  <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                    {e.subject_code}{e.assessment_type ? ` · ${e.assessment_type}` : ''}{e.max_marks ? ` · ${e.max_marks} marks` : ''}{e.faculty_code ? ` · ${e.faculty_code}` : ''}
                  </div>
                </div>
                <span className="text-[11px] rounded px-2 py-0.5 font-medium whitespace-nowrap" style={{ background: 'var(--panel)', border: `1px solid ${tone}`, color: tone }}>
                  {countdown(e.assessment_date)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
