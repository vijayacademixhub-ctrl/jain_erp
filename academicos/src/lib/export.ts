import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // side-effect: registers doc.autoTable (bundler-interop-safe)
import type { TimetableRow } from './types';

type AutoTableDoc = jsPDF & { autoTable: (opts: Record<string, unknown>) => void };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function fmt(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  return `${h}:${m}`;
}

/** Flat rows for a spreadsheet. */
export function rowsToMatrix(rows: TimetableRow[]): (string | number)[][] {
  const header = ['Day', 'Period', 'Time', 'Subject', 'Faculty', 'Room', 'Sections', 'Sem'];
  const body = [...rows]
    .sort((a, b) => DAYS.indexOf(a.day_of_week) - DAYS.indexOf(b.day_of_week) || a.period_number - b.period_number)
    .map((r) => [
      r.day_of_week, `P${r.period_number}`, `${fmt(r.start_time)}-${fmt(r.end_time)}`,
      r.subject_name ?? r.course_code ?? '', r.faculty_name ?? r.faculty_code ?? 'TBD',
      r.room_number ?? '', r.sections.join(', '), r.semester_number,
    ]);
  return [header, ...body];
}

export function exportExcel(rows: TimetableRow[], name: string) {
  const ws = XLSX.utils.aoa_to_sheet(rowsToMatrix(rows));
  ws['!cols'] = [10, 7, 13, 34, 26, 8, 26, 6].map((w) => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Timetable');
  XLSX.writeFile(wb, `${name}.xlsx`);
}

/** Clean, phone-readable PDF — no column misalignment (fixed autotable grid). */
export function exportPDF(rows: TimetableRow[], title: string, subtitle: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' }) as AutoTableDoc;
  doc.setFontSize(14); doc.text(title, 40, 36);
  doc.setFontSize(9); doc.setTextColor(110); doc.text(subtitle, 40, 52);
  doc.autoTable({
    startY: 66,
    head: [['Day', 'P', 'Time', 'Subject', 'Faculty', 'Room', 'Sections']],
    body: rowsToMatrix(rows).slice(1).map((r) => [r[0], r[1], r[2], r[3], r[4], r[5], r[6]] as string[]),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 56, 100], halign: 'left' },
    columnStyles: {
      0: { cellWidth: 60 }, 1: { cellWidth: 22 }, 2: { cellWidth: 70 },
      3: { cellWidth: 190 }, 4: { cellWidth: 150 }, 5: { cellWidth: 44 }, 6: { cellWidth: 160 },
    },
    alternateRowStyles: { fillColor: [247, 246, 240] },
  });
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}
