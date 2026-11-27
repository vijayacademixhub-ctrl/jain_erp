import type { TimetableRow } from '../lib/types';
import { exportExcel, exportPDF } from '../lib/export';

export function ExportButtons({ rows, name, subtitle }: { rows: TimetableRow[]; name: string; subtitle: string }) {
  const btn = 'text-[12.5px] rounded px-3 py-1.5 font-medium';
  return (
    <div className="flex gap-2">
      <button className={btn} style={{ background: 'var(--brand)', color: '#fff' }}
        onClick={() => exportPDF(rows, name, subtitle)} disabled={!rows.length}>PDF</button>
      <button className={btn} style={{ border: '1px solid var(--line)' }}
        onClick={() => exportExcel(rows, name)} disabled={!rows.length}>Excel</button>
    </div>
  );
}
