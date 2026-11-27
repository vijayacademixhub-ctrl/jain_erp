import * as XLSX from 'xlsx';

export interface RosterRow { student_id: string; usn: string; full_name: string }

export function downloadMarksTemplate(roster: RosterRow[], title: string, maxMarks: number | null) {
  const header = ['USN', 'Name', `Marks${maxMarks ? ` (out of ${maxMarks})` : ''}`];
  const body = roster.map((r) => [r.usn, r.full_name, '']);
  const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
  ws['!cols'] = [{ wch: 16 }, { wch: 30 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Marks');
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}_marks_template.xlsx`);
}

/** Parse an uploaded marks workbook -> { USN: marks }. Tolerant of column order. */
export async function parseMarksFile(file: File): Promise<Record<string, number>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const out: Record<string, number> = {};
  for (const row of rows) {
    const keys = Object.keys(row);
    const usnKey = keys.find((k) => /usn|reg/i.test(k));
    const markKey = keys.find((k) => /mark|score/i.test(k));
    if (!usnKey || !markKey) continue;
    const usn = String(row[usnKey]).trim();
    const raw = String(row[markKey]).trim();
    if (usn && raw !== '' && !isNaN(Number(raw))) out[usn] = Number(raw);
  }
  return out;
}
