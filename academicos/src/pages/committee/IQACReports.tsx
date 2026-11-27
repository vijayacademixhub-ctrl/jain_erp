import { useEffect, useMemo, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';
import { exportReportExcel, exportReportPDF } from '../../lib/report';

interface Row { id: string; title: string; category_code: string; category_name: string;
  faculty_code: string; faculty_name: string; department: string | null; academic_year: string | null;
  record_date: string | null; verified_at: string | null }

const NOTE = 'Verified institutional records only. NAAC accreditation criteria are not auto-assigned; map to criteria per your approved institutional framework. Each row is traceable to its source record.';

export default function IQACReports() {
  const [rows, setRows] = useState<Row[]>([]);
  const [cat, setCat] = useState('');
  const [year, setYear] = useState('2026-2027');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    let q = supabase.from('v_iqac_report').select('*');
    if (year) q = q.eq('academic_year', year);
    if (cat) q = q.eq('category_code', cat);
    q.order('category_name').then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, [cat, year]);

  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) m.set(r.category_name, (m.get(r.category_name) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [rows]);

  const headers = ['Category', 'Title', 'Faculty', 'Code', 'Department', 'Year', 'Record date', 'Verified on'];
  const matrix = rows.map((r) => [r.category_name, r.title, r.faculty_name, r.faculty_code,
    r.department ?? '', r.academic_year ?? '', r.record_date ?? '', r.verified_at ? r.verified_at.slice(0, 10) : '']);
  const subtitle = `CMS Business School · Verified faculty contributions · ${year}${cat ? ` · ${cat}` : ''} · ${rows.length} records`;

  const sel = 'rounded px-2.5 py-1.5 text-[13px]';
  return (
    <Layout title="IQAC / NAAC Reporting">
      <CommitteeNav />
      <div className="rounded-xl p-4 mb-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={year} onChange={(e) => setYear(e.target.value)}>
            <option value="2026-2027">2026-2027</option>
          </select>
          <select className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">All categories</option>
            <option value="research_paper">Research Paper</option><option value="journal">Journal</option>
            <option value="conference_paper">Conference Paper</option><option value="book_chapter">Book / Chapter</option>
            <option value="fdp">FDP</option><option value="workshop">Workshop</option><option value="seminar">Seminar</option>
            <option value="conference">Conference</option><option value="research_project">Research Project</option>
            <option value="consultancy">Consultancy</option><option value="patent">Patent</option>
            <option value="award">Award</option><option value="achievement">Achievement</option><option value="other">Other</option>
          </select>
          <div className="flex-1" />
          <button onClick={() => exportReportPDF('IQAC Verified Contributions', subtitle, headers, matrix, NOTE)} disabled={!rows.length}
            className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white" style={{ background: 'var(--brand)' }}>PDF</button>
          <button onClick={() => exportReportExcel(`IQAC_Verified_${year}`, headers, matrix)} disabled={!rows.length}
            className="text-[12.5px] rounded px-3 py-1.5 font-medium" style={{ border: '1px solid var(--line)' }}>Excel</button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {byCategory.map(([name, n]) => (
            <div key={name} className="rounded-lg p-2.5" style={{ background: 'var(--bg)' }}>
              <div className="text-xl font-semibold" style={{ color: 'var(--brand)' }}>{n}</div>
              <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{name}</div>
            </div>
          ))}
          {byCategory.length === 0 && !loading && <div className="text-[13px] col-span-4" style={{ color: 'var(--muted)' }}>No verified records for this selection.</div>}
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px] border-collapse" style={{ minWidth: 760 }}>
            <thead><tr>{['Category', 'Title', 'Faculty', 'Year', 'Verified on'].map((h) => (
              <th key={h} className="text-left p-2" style={{ borderBottom: '2px solid var(--line)', color: 'var(--muted)' }}>{h}</th>))}</tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>{r.category_name}</td>
                  <td className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>{r.title}</td>
                  <td className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>{r.faculty_name} <span style={{ color: 'var(--muted)' }}>({r.faculty_code})</span></td>
                  <td className="p-2" style={{ borderBottom: '1px solid var(--line)' }}>{r.academic_year}</td>
                  <td className="p-2" style={{ borderBottom: '1px solid var(--line)', color: 'var(--muted)' }}>{r.verified_at ? r.verified_at.slice(0, 10) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] mt-3" style={{ color: 'var(--muted)' }}>{NOTE}</p>
      </div>
    </Layout>
  );
}
