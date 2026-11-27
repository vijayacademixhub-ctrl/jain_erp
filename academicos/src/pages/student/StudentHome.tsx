import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StudentNav } from '../../components/StudentNav';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useTimetable } from '../../lib/useTimetable';
import { TimetableGrid } from '../../components/TimetableGrid';
import { ExportButtons } from '../../components/ExportButtons';

/** Students pick their section (enrolment auto-selects once loaded in a later milestone). */
export default function StudentHome() {
  const { session } = useAuth();
  const [sem, setSem] = useState(6);
  const [section, setSection] = useState('');
  const [sections, setSections] = useState<string[]>([]);
  useEffect(() => {
    supabase.from('sections').select('label,semesters!inner(semester_number)')
      .eq('semesters.semester_number', sem).order('label')
      .then(({ data }) => setSections(((data ?? []) as { label: string }[]).map((s) => s.label)));
  }, [sem]);
  useEffect(() => {
    if (!session) return;
    supabase.from('student_enrolments')
      .select('semesters!inner(semester_number),sections!inner(label)')
      .limit(1)
      .then(({ data }) => {
        const row = (data ?? [])[0] as { semesters?: { semester_number: number }[]; sections?: { label: string }[] } | undefined;
        const sm = row?.semesters?.[0]?.semester_number;
        const lb = row?.sections?.[0]?.label;
        if (sm) setSem(sm);
        if (lb) setSection(lb);
      });
  }, [session]);
  const { rows } = useTimetable({ semester: sem, section: section || undefined });
  const sel = 'rounded px-2.5 py-1.5 text-[13px]';
  return (
    <Layout title="My Classes">
      <StudentNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={sem} onChange={(e) => { setSem(Number(e.target.value)); setSection(''); }}>
            {[2, 4, 6].map((s) => <option key={s} value={s}>{s}th Semester</option>)}
          </select>
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">Choose your section…</option>
            {sections.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <div className="flex-1" />
          <ExportButtons rows={rows} name={`My_Timetable_${section.replace(/\s+/g, '') || sem + 'Sem'}`} subtitle={section || `${sem}th Semester`} />
        </div>
        {section ? <TimetableGrid rows={rows} /> : <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Select your section to view your weekly timetable.</p>}
      </div>
    </Layout>
  );
}
