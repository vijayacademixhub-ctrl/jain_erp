-- CMS AcademicOS · M1 · 0008 master-admin impersonation (audited, not covert)
-- master_admin is hidden from the product UI, but every act-as session is recorded here
-- AND in the append-only audit_logs. There is no code path that impersonates without a trace.

create table if not exists public.impersonation_sessions (
  id              uuid primary key default gen_random_uuid(),
  actor_profile   uuid not null references public.profiles(id),   -- the real master_admin
  target_profile  uuid not null references public.profiles(id),   -- who they acted as
  reason          text,
  started_at      timestamptz not null default now(),
  ended_at        timestamptz
);
alter table public.impersonation_sessions enable row level security;

-- Only master_admin may read the impersonation log through the API. (The physical rows
-- also exist in audit_logs, which the institution can inspect server-side for oversight.)
drop policy if exists imp_read on public.impersonation_sessions;
create policy imp_read on public.impersonation_sessions for select to authenticated
  using (public.is_master_admin());

-- Start an audited act-as session. Only master_admin may call it; the check cannot be
-- bypassed from the client because writes go only through this definer function.
create or replace function public.begin_impersonation(p_target uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not public.is_master_admin() then
    raise exception 'Only master_admin may impersonate' using errcode = 'insufficient_privilege';
  end if;
  insert into public.impersonation_sessions (actor_profile, target_profile, reason)
  values (public.current_profile_id(), p_target, p_reason)
  returning id into v_id;
  perform public.log_audit('IMPERSONATION_START', 'profile', p_target,
    null, jsonb_build_object('session_id', v_id, 'reason', p_reason), null,
    'master_admin act-as begun');
  return v_id;
end $$;

create or replace function public.end_impersonation(p_session uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_master_admin() then
    raise exception 'Only master_admin may end an impersonation' using errcode = 'insufficient_privilege';
  end if;
  update public.impersonation_sessions set ended_at = now()
   where id = p_session and ended_at is null;
  perform public.log_audit('IMPERSONATION_END', 'impersonation_session', p_session,
    null, null, null, 'master_admin act-as ended');
end $$;

revoke all on function public.begin_impersonation(uuid, text) from anon;
revoke all on function public.end_impersonation(uuid) from anon;
