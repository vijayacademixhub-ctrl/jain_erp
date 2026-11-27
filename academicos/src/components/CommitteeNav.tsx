import { Link, useLocation } from 'react-router-dom';
const tabs = [{ to: '/committee', label: 'Timetable Console' }, { to: '/committee/daily', label: 'Daily Changes' }, { to: '/committee/verify', label: 'Record Verification' }];
export function CommitteeNav() {
  const { pathname } = useLocation();
  return (
    <div className="flex gap-1 mb-4">
      {tabs.map((t) => {
        const on = pathname === t.to;
        return <Link key={t.to} to={t.to} className="text-[13px] rounded px-3 py-1.5"
          style={{ background: on ? 'var(--brand)' : 'var(--panel)', color: on ? '#fff' : 'var(--ink)', border: '1px solid var(--line)' }}>{t.label}</Link>;
      })}
    </div>
  );
}
