import { useEffect, useState, type ChangeEvent } from 'react';
import { Layout } from '../../components/Layout';
import { FacultyNav } from '../../components/FacultyNav';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { downloadMarksTemplate, parseMarksFile, type RosterRow } from '../../lib/marks';

interface Subj { subject_id: string; subject_name: string; course_code: string; section_id: string; section_label: string; academic_year_id: string }
interface Assessment { id: string; title: string; kind: string; assessment_type: string | null; max_marks: number | null; assessment_date: string | null; is_published: boolean }

export default function FacultyAssessments() {
  const { session } = useAuth();
  const [fid, setFid] = useState<string | null>(null);
  const [subs, setSubs] = useState<Subj[]>([]);
  const [key, setKey] = useState('');
  const [list, setList] = useState<Assessment[]>([]);
  const [roster, setRoster] = useState<RosterRow[]>([]);
  const [active, setActive] = useState<Assessment | null>(null);
  const [marks, setMarks] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);
  // create form
  const [title, setTitle] = useState(''); const [kind, setKind] = useState<'assessment' | 'exam'>('assessment');
  const [atype, setAtype] = useState('Written'); const [maxM, setMaxM] = useState('20');

  const sub = subs.find((s) => `${s.subject_id}|${s.section_id}` === key);

  useEffect(() => {
    if (!session) return;
    supabase.from('faculty').select('id').eq('profile_id', session.user.id).maybeSingle()
      .then(({ data }) => setFid((data as { id: string } | null)?.id ?? null));
  }, [session]);

  useEffect(() => {
    if (!fid) return;
    supabase.from('v_faculty_subjects').select('*').eq('faculty_id', fid).order('semester_number')
      .then(({ data }) => setSubs((data ?? []) as Subj[]));
  }, [fid]);

  function loadList(s: Subj) {
    supabase.from('assessments').select('id,title,kind,assessment_type,max_marks,assessment_date,is_published')
      .eq('subject_id', s.subject_id).eq('section_id', s.section_id).eq('faculty_id', fid!)
      .order('assessment_date', { nullsFirst: false })
      .then(({ data }) => setList((data ?? []) as Assessment[]));
    supabase.from('v_section_roster').select('student_id,usn,full_name').eq('section_id', s.section_id).order('usn')
      .then(({ data }) => setRoster((data ?? []) as RosterRow[]));
  }
  useEffect(() => { if (sub) { loadList(sub); setActive(null); } }, [key]);

  async function create() {
    if (!sub || !title) { setMsg('Enter a title.'); return; }
    setMsg(null);
    const { error } = await supabase.from('assessments').insert({
      subject_id: sub.subject_id, section_id: sub.section_id, faculty_id: fid,
      academic_year_id: sub.academic_year_id, kind, title, assessment_type: atype,
      max_marks: Number(maxM) || null, assessment_date: new Date().toISOString().slice(0, 10),
      status: 'completed', created_by: session!.user.id,
    });
    if (error) setMsg(error.message.includes('Limit reached') ? error.message : `Could not create: ${error.message}`);
    else { setTitle(''); loadList(sub); setMsg('Assessment created.'); }
  }

  async function openAssessment(a: Assessment) {
    setActive(a); setMsg(null);
    const { data } = await supabase.from('marks').select('student_id,marks_obtained').eq('assessment_id', a.id);
    const m: Record<string, string> = {};
    for (const r of (data ?? []) as { student_id: string; marks_obtained: number | null }[]) m[r.student_id] = r.marks_obtained?.toString() ?? '';
    setMarks(m);
  }

  async function save() {
    if (!active) return;
    setMsg(null);
    const rows = roster.filter((r) => marks[r.student_id] !== undefined && marks[r.student_id] !== '')
      .map((r) => ({ assessment_id: active.id, student_id: r.student_id, marks_obtained: Number(marks[r.student_id]), entered_by: session!.user.id }));
    if (!rows.length) { setMsg('Enter at least one mark.'); return; }
    const { error } = await supabase.from('marks').upsert(rows, { onConflict: 'assessment_id,student_id' });
    setMsg(error ? error.message : `Saved ${rows.length} marks (unpublished — students cannot see them yet).`);
  }

  async function publish(p: boolean) {
    if (!active) return;
    const { error } = await supabase.rpc('set_marks_published', { p_assessment: active.id, p_published: p });
    if (error) setMsg(error.message);
    else { setActive({ ...active, is_published: p }); setMsg(p ? 'Marks published — students can now see them.' : 'Marks unpublished.'); loadList(sub!); }
  }

  async function onImport(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return;
    const byUsn = await parseMarksFile(f);
    const next = { ...marks };
    for (const r of roster) if (byUsn[r.usn] !== undefined) next[r.student_id] = String(byUsn[r.usn]);
    setMarks(next); setMsg(`Imported ${Object.keys(byUsn).length} marks from file — review and Save.`);
    e.target.value = '';
  }

  const inp = 'rounded px-2 py-1.5 text-[13px]';
  return (
    <Layout title="Assessments & Marks">
      <FacultyNav />
      {!fid ? <p className="text-sm" style={{ color: 'var(--muted)' }}>No faculty profile linked to this account.</p> : (
        <>
          <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <label className="block text-[12px] mb-1" style={{ color: 'var(--muted)' }}>Subject &amp; section you teach</label>
            <select value={key} onChange={(e) => setKey(e.target.value)} className={inp + ' w-full max-w-xl'} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
              <option value="">Choose…</option>
              {subs.map((s) => <option key={`${s.subject_id}|${s.section_id}`} value={`${s.subject_id}|${s.section_id}`}>{s.subject_name} — {s.section_label}</option>)}
            </select>
          </div>

          {sub && !active && (
            <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <div className="text-[13px] font-medium mb-3">Create assessment <span style={{ color: 'var(--muted)' }}>· max 7 assessments + 5 exams per class</span></div>
              <div className="flex flex-wrap gap-2 items-end mb-3">
                <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Unit Test 1)" className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 200 }} />
                <select value={kind} onChange={(e) => setKind(e.target.value as 'assessment' | 'exam')} className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                  <option value="assessment">Assessment</option><option value="exam">Exam</option>
                </select>
                <input value={atype} onChange={(e) => setAtype(e.target.value)} placeholder="Type (Written, Group…)" className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)', width: 150 }} />
                <input value={maxM} onChange={(e) => setMaxM(e.target.value)} type="number" placeholder="Max" className={inp} style={{ border: '1px solid var(--line)', background: 'var(--bg)', width: 80 }} />
                <button onClick={create} className="rounded px-4 py-2 font-medium text-white text-[13px]" style={{ background: 'var(--brand)' }}>Create</button>
              </div>
              <div className="grid gap-1.5">
                {list.map((a) => (
                  <button key={a.id} onClick={() => openAssessment(a)} className="text-left rounded-lg px-3 py-2 flex items-center" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
                    <div className="flex-1"><span className="font-medium text-[13px]">{a.title}</span> <span className="text-[11.5px]" style={{ color: 'var(--muted)' }}>· {a.kind} · {a.assessment_type} · max {a.max_marks ?? '—'}</span></div>
                    <span className="text-[11px] rounded px-2 py-0.5" style={{ background: a.is_published ? 'var(--accent)' : 'var(--line)', color: a.is_published ? '#fff' : 'var(--muted)' }}>{a.is_published ? 'Published' : 'Draft'}</span>
                  </button>
                ))}
                {list.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No assessments yet for this class.</p>}
              </div>
            </div>
          )}

          {active && (
            <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
              <button onClick={() => setActive(null)} className="text-[12.5px] mb-3" style={{ color: 'var(--brand)' }}>← Back</button>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <div className="flex-1"><span className="font-medium">{active.title}</span> <span className="text-[12px]" style={{ color: 'var(--muted)' }}>· max {active.max_marks ?? '—'} · {roster.length} students</span></div>
                <button onClick={() => downloadMarksTemplate(roster, active.title, active.max_marks)} className="text-[12.5px] rounded px-3 py-1.5" style={{ border: '1px solid var(--line)' }}>Excel template</button>
                <label className="text-[12.5px] rounded px-3 py-1.5 cursor-pointer" style={{ border: '1px solid var(--line)' }}>Import Excel
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={onImport} className="hidden" /></label>
                <button onClick={save} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--brand)' }}>Save marks</button>
                <button onClick={() => publish(!active.is_published)} className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: active.is_published ? '#b4473f' : 'var(--accent)' }}>{active.is_published ? 'Unpublish' : 'Publish'}</button>
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--line)', maxHeight: 460, overflowY: 'auto' }}>
                {roster.map((r) => (
                  <div key={r.student_id} className="flex items-center gap-2 px-3 py-1.5" style={{ borderBottom: '1px solid var(--line)' }}>
                    <span className="text-[11.5px] font-mono w-28" style={{ color: 'var(--muted)' }}>{r.usn}</span>
                    <span className="text-[13px] flex-1">{r.full_name}</span>
                    <input type="number" value={marks[r.student_id] ?? ''} onChange={(e) => setMarks((m) => ({ ...m, [r.student_id]: e.target.value }))}
                      className="rounded px-2 py-1 text-[13px] w-20 text-right" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} placeholder="—" />
                  </div>
                ))}
              </div>
            </div>
          )}
          {msg && <p className="text-[12.5px] mt-3" style={{ color: /created|Saved|published|Imported/i.test(msg) ? 'var(--accent)' : '#b4473f' }}>{msg}</p>}
        </>
      )}
    </Layout>
  );
}
