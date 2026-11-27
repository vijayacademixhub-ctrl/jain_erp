import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportReportExcel(name: string, headers: string[], rows: (string | number)[][]) {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = headers.map((h) => ({ wch: Math.max(12, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, `${name}.xlsx`);
}

export function exportReportPDF(title: string, subtitle: string, headers: string[], rows: (string | number)[][], note?: string) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFontSize(14); doc.text(title, 40, 36);
  doc.setFontSize(9); doc.setTextColor(110); doc.text(subtitle, 40, 52);
  autoTable(doc, {
    startY: 66, head: [headers], body: rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak' },
    headStyles: { fillColor: [31, 56, 100], halign: 'left' },
    alternateRowStyles: { fillColor: [247, 246, 240] },
  });
  if (note) {
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 16;
    doc.setFontSize(7.5); doc.setTextColor(120); doc.text(note, 40, y, { maxWidth: 760 });
  }
  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
}
