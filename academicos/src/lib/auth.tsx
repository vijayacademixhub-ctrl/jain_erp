import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { AcademicRole, Profile } from './types';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  roles: AcademicRole[];
  loading: boolean;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AcademicRole[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadContext(s: Session | null) {
    setLoading(true);
    if (!s) { setProfile(null); setRoles([]); setLoading(false); return; }
    const [{ data: prof }, { data: roleRows }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,email,status').eq('id', s.user.id).maybeSingle(),
      supabase.from('user_academic_roles').select('role').is('revoked_at', null).eq('profile_id', s.user.id),
    ]);
    setProfile(prof as Profile | null);
    setRoles(((roleRows ?? []) as { role: AcademicRole }[]).map((r) => r.role));
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); loadContext(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); loadContext(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <Ctx.Provider value={{ session, profile, roles, loading, signOut: async () => { await supabase.auth.signOut(); } }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside provider');
  return v;
}

export const ROLE_LABEL: Record<AcademicRole, string> = {
  master_admin: 'Master Admin', super_admin: 'Super Admin', admin: 'Administrator',
  committee: 'Timetable Committee', iqac: 'IQAC Reviewer', faculty: 'Faculty', student: 'Student',
};

/** Highest-privilege role for default landing. */
export function primaryRole(roles: AcademicRole[]): AcademicRole | null {
  const order: AcademicRole[] = ['master_admin','super_admin','admin','committee','iqac','faculty','student'];
  return order.find((r) => roles.includes(r)) ?? null;
}
