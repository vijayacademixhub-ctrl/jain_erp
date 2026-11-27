import { Link, useLocation } from 'react-router-dom';
const tabs = [{ to: '/admin', label: 'Overview' }, { to: '/admin/timetable-approvals', label: 'Timetable Approvals' }, { to: '/admin/leave', label: 'Leave Approvals' }, { to: '/admin/rooms', label: 'Room Bookings' }, { to: '/admin/workload', label: 'Faculty Workload' }, { to: '/admin/audit', label: 'Audit Trail' }, { to: '/admin/analytics', label: 'Analytics' }];
export function AdminNav() {
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
