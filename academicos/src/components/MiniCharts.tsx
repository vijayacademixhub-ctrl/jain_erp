// Dependency-free, theme-aware mini charts (inline SVG + CSS).
import { Link } from 'react-router-dom';

export const CHART_COLORS = ['#1f3864', '#3d8168', '#c08a2d', '#7a4fb0', '#b4473f', '#2d7d9a', '#8a6d3b', '#4a7a3a'];

export function BarList({ data, unit = '' }: { data: { label: string; value: number; sub?: string; href?: string }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="grid gap-2">
      {data.map((d, i) => {
        const body = (
          <>
            <div className="flex items-baseline justify-between text-[12px] mb-0.5">
              <span className="truncate pr-2" style={{ color: d.href ? 'var(--brand)' : 'var(--ink)' }}>{d.label}{d.sub ? <span style={{ color: 'var(--muted)' }}> · {d.sub}</span> : null}</span>
              <span className="font-medium tabular-nums" style={{ color: 'var(--muted)' }}>{d.value}{unit}</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg)' }}>
              <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
            </div>
          </>
        );
        return d.href
          ? <Link key={d.label + i} to={d.href} className="block rounded hover:opacity-80 transition-opacity">{body}</Link>
          : <div key={d.label + i}>{body}</div>;
      })}
      {data.length === 0 && <p className="text-[12.5px]" style={{ color: 'var(--muted)' }}>No data.</p>}
    </div>
  );
}

export function Donut({ data, size = 132 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((a, b) => a + b.value, 0);
  const r = size / 2 - 12, cx = size / 2, cy = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg)" strokeWidth={12} />
        {total > 0 && data.map((d, i) => {
          const frac = d.value / total;
          const dash = frac * C;
          const el = (
            <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.color} strokeWidth={12}
              strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-acc * C}
              transform={`rotate(-90 ${cx} ${cy})`} strokeLinecap="butt" />
          );
          acc += frac;
          return el;
        })}
        <text x={cx} y={cy - 2} textAnchor="middle" fontSize="20" fontWeight="600" fill="var(--ink)">{total}</text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9" fill="var(--muted)">total</text>
      </svg>
      <div className="grid gap-1.5">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-[12px]">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
            <span style={{ color: 'var(--ink)' }}>{d.label}</span>
            <span className="tabular-nums" style={{ color: 'var(--muted)' }}>{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Card({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}
