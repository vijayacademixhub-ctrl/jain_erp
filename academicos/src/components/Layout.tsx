import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, ROLE_LABEL, primaryRole } from '../lib/auth';
import { NotificationBell } from './NotificationBell';

export function Layout({ title, children }: { title: string; children: ReactNode }) {
  const { profile, roles, signOut } = useAuth();
  const nav = useNavigate();
  const role = primaryRole(roles);
  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10" style={{ background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-md flex items-center justify-center font-bold text-white" style={{ background: 'var(--brand)' }}>C</div>
          <div className="flex-1">
            <div className="font-semibold leading-tight">CMS AcademicOS</div>
            <div style={{ color: 'var(--muted)' }} className="text-[11px]">Lalbagh Campus · {role ? ROLE_LABEL[role] : ''}</div>
          </div>
          <div className="text-right mr-2 hidden sm:block">
            <div className="text-[12.5px] font-medium">{profile?.full_name ?? '—'}</div>
            <div style={{ color: 'var(--muted)' }} className="text-[11px]">{profile?.email}</div>
          </div>
          <NotificationBell />
          <button onClick={async () => { await signOut(); nav('/login'); }}
            className="text-[12.5px] rounded px-3 py-1.5" style={{ border: '1px solid var(--line)' }}>Sign out</button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="text-xl font-semibold mb-4">{title}</h1>
        {children}
      </main>
    </div>
  );
}
