import type { ReactNode } from 'react';
import { exportReportExcel, exportReportPDF } from '../lib/report';

export function DataTable({
  headers, rows, exportName, exportTitle, right, maxHeight = 620,
}: {
  headers: string[];
  rows: (string | number | ReactNode)[][];
  exportName?: string;
  exportTitle?: string;
  right?: ReactNode;
  maxHeight?: number;
}) {
  // export uses only primitive cells
  const matrix = rows.map((r) => r.map((c) => (typeof c === 'string' || typeof c === 'number' ? String(c) : '')));
  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[12.5px]" style={{ color: 'var(--muted)' }}>{rows.length} record{rows.length !== 1 ? 's' : ''}</div>
        <div className="flex items-center gap-2">
          {right}
          {exportName && (
            <>
              <button onClick={() => exportReportPDF(exportTitle ?? exportName, `${rows.length} records · ${new Date().toLocaleString()}`, headers, matrix)}
                disabled={!rows.length} className="text-[12px] rounded px-2.5 py-1 font-medium text-white disabled:opacity-50" style={{ background: 'var(--accent)' }}>PDF</button>
              <button onClick={() => exportReportExcel(exportName, headers, matrix)}
                disabled={!rows.length} className="text-[12px] rounded px-2.5 py-1" style={{ border: '1px solid var(--line)' }}>Excel</button>
            </>
          )}
        </div>
      </div>
      <div className="rounded-xl overflow-auto" style={{ border: '1px solid var(--line)', maxHeight }}>
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead className="sticky top-0" style={{ zIndex: 1 }}>
            <tr style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
              {headers.map((h) => <th key={h} className="text-left px-3 py-2 font-medium whitespace-nowrap" style={{ borderBottom: '1px solid var(--line)' }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} style={{ borderTop: i ? '1px solid var(--line)' : undefined }}>
                {r.map((c, j) => <td key={j} className="px-3 py-1.5" style={{ color: j === 0 ? 'var(--ink)' : 'var(--muted)' }}>{c as ReactNode}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={headers.length} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>No records.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
