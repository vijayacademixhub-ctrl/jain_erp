import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StudentNav } from '../../components/StudentNav';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { useTimetable } from '../../lib/useTimetable';
import { TimetableGrid } from '../../components/TimetableGrid';
import { ExportButtons } from '../../components/ExportButtons';
import { TodayPanel } from '../../components/TodayPanel';
import { UpcomingEvents } from '../../components/UpcomingEvents';

interface Sec { id: string; label: string }

export default function StudentHome() {
  const { session } = useAuth();
  const [sem, setSem] = useState(6);
  const [section, setSection] = useState('');
  const [sections, setSections] = useState<Sec[]>([]);

  useEffect(() => {
    supabase.from('sections').select('id,label,semesters!inner(semester_number)')
      .eq('semesters.semester_number', sem).order('label')
      .then(({ data }) => setSections(((data ?? []) as Sec[]).map((s) => ({ id: s.id, label: s.label }))));
  }, [sem]);

  useEffect(() => {
    if (!session) return;
    // SECURITY DEFINER RPC — avoids the RLS statement-timeout on student_enrolments
    supabase.rpc('my_enrolment').then(({ data }) => {
      const r = (data ?? [])[0] as { semester_number: number; section_label: string } | undefined;
      if (r?.semester_number) setSem(r.semester_number);
      if (r?.section_label) setSection(r.section_label);
    });
  }, [session]);

  const { rows } = useTimetable({ semester: sem, section: section || undefined });
  const sectionId = sections.find((s) => s.label === section)?.id ?? null;
  const sel = 'rounded px-2.5 py-1.5 text-[13px]';

  return (
    <Layout title="My Classes">
      <StudentNav />
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2">
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={sem} onChange={(e) => { setSem(Number(e.target.value)); setSection(''); }}>
            {[2, 4, 6].map((s) => <option key={s} value={s}>{s}th Semester</option>)}
          </select>
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={section} onChange={(e) => setSection(e.target.value)}>
            <option value="">Choose your section…</option>
            {sections.map((s) => <option key={s.id} value={s.label}>{s.label}</option>)}
          </select>
          <div className="flex-1" />
          <ExportButtons rows={rows} name={`My_Timetable_${section.replace(/\s+/g, '') || sem + 'Sem'}`} subtitle={section || `${sem}th Semester`} />
        </div>
      </div>

      {section ? (
        <>
          <div className="grid lg:grid-cols-2 gap-4 mb-4">
            <TodayPanel rows={rows} />
            <UpcomingEvents sectionId={sectionId} />
          </div>
          <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <h3 className="text-[13px] font-semibold mb-3">Weekly timetable</h3>
            <TimetableGrid rows={rows} />
          </div>
        </>
      ) : (
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
          <p className="text-sm py-8 text-center" style={{ color: 'var(--muted)' }}>Select your section to view today's classes, upcoming events and your weekly timetable.</p>
        </div>
      )}
    </Layout>
  );
}
