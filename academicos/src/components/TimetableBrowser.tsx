import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTimetable } from '../lib/useTimetable';
import { TimetableGrid } from './TimetableGrid';
import { ExportButtons } from './ExportButtons';

const SEMS = [2, 4, 6];

export function TimetableBrowser() {
  const [sem, setSem] = useState(6);
  const [section, setSection] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  const { rows, loading, error } = useTimetable({ semester: sem, section: section || undefined });

  useEffect(() => {
    supabase.from('sections').select('label,semester_id,semesters!inner(semester_number)')
      .eq('semesters.semester_number', sem).order('label')
      .then(({ data }) => {
        setSections(((data ?? []) as { label: string }[]).map((s) => s.label));
        setSection('');
      });
  }, [sem]);

  const sel = 'rounded px-2.5 py-1.5 text-[13px]';
  const subtitle = `Even Sem 2027 · ${sem}th Semester${section ? ` · ${section}` : ' · all sections'}`;
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}
          value={sem} onChange={(e) => setSem(Number(e.target.value))}>
          {SEMS.map((s) => <option key={s} value={s}>{s}th Semester</option>)}
        </select>
        <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}
          value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex-1" />
        <ExportButtons rows={rows} name={`Timetable_${sem}Sem${section ? '_' + section.replace(/\s+/g, '') : ''}`} subtitle={subtitle} />
      </div>
      {loading ? <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Loading…</p>
        : error ? <p className="text-sm py-8 text-center" style={{ color: '#b4473f' }}>{error}</p>
        : <TimetableGrid rows={rows} />}
      <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>{rows.length} classes · published master timetable</p>
    </div>
  );
}
