-- CMS AcademicOS · M1 · 0002 academic identity & roles
-- Reuses public.profiles (already linked to auth.users). Adds institution-wide roles,
-- the faculty/student domain identities, and the role-grant table. Not yet applied.

-- Spec §4 access categories + the hidden master tier. coordinator/member from the
-- existing app_role enum remain for the academic-office app and are untouched.
do $$ begin
  create type public.academic_role as enum
    ('master_admin','super_admin','admin','committee','iqac','faculty','student');
exception when duplicate_object then null; end $$;

-- Multi-role per person. A grant may be scoped (e.g. a committee for one department).
create table if not exists public.user_academic_roles (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  role          public.academic_role not null,
  department_id uuid references public.departments(id),  -- null = institution-wide
  granted_by    uuid references public.profiles(id),
  granted_at    timestamptz not null default now(),
  revoked_at    timestamptz,
  unique (profile_id, role, department_id)
);
create index if not exists idx_uar_profile on public.user_academic_roles(profile_id);
create index if not exists idx_uar_role    on public.user_academic_roles(role) where revoked_at is null;

-- Faculty domain identity. profile_id is null until the person is given a login.
create table if not exists public.faculty (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id),
  department_id    uuid references public.departments(id),
  short_code       text not null unique,       -- 'DA','GSR' — the TT identifier
  full_name        text not null,
  max_weekly_hours int,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now()
);

-- Student domain identity. USN is the institutional key.
create table if not exists public.students (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references public.profiles(id),
  usn              text not null unique,        -- '26BBAR0425'
  full_name        text not null,
  programme_id     uuid references public.programmes(id),
  batch_label      text,                        -- '2026-29'
  created_at       timestamptz not null default now()
);

-- A student's section membership for one academic year (authoritative over any
-- denormalised section pointer). Supports promotion across years.
create table if not exists public.student_enrolments (
  id               uuid primary key default gen_random_uuid(),
  student_id       uuid not null references public.students(id),
  section_id       uuid not null references public.sections(id),
  academic_year_id uuid not null references public.academic_years(id),
  semester_id      uuid not null references public.semesters(id),
  status           text not null default 'active',
  created_at       timestamptz not null default now(),
  unique (student_id, academic_year_id, semester_id)
);
create index if not exists idx_enrol_section on public.student_enrolments(section_id);

-- Faculty login / punch-in times (spec: "pull out faculty PUNCH IN time / login times").
create table if not exists public.faculty_login_events (
  id          uuid primary key default gen_random_uuid(),
  faculty_id  uuid not null references public.faculty(id),
  profile_id  uuid references public.profiles(id),
  event_type  text not null default 'login' check (event_type in ('login','logout','punch_in','punch_out')),
  occurred_at timestamptz not null default now(),
  source      text                                  -- 'web','daily_tt', etc.
);
create index if not exists idx_login_faculty on public.faculty_login_events(faculty_id, occurred_at);

-- back-references deferred from 0001
alter table public.sections
  add column if not exists class_teacher_fk uuid references public.faculty(id),
  add column if not exists home_room_fk     uuid references public.rooms(id);
