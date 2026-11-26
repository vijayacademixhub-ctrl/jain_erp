-- CMS AcademicOS · M1 · 0004 role helpers + faculty academic records & verification
-- Builds on existing helpers: current_profile_id(), is_active_user(), is_super_admin(), log_audit().

-- ---- academic role helpers --------------------------------------------------
create or replace function public.has_academic_role(p_roles public.academic_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_academic_roles ur
    where ur.profile_id = public.current_profile_id()
      and ur.revoked_at is null
      and ur.role = any (p_roles)
  );
$$;

create or replace function public.is_master_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_academic_role(array['master_admin']::public.academic_role[]);
$$;

-- master_admin implicitly holds admin/super powers everywhere.
create or replace function public.is_academic_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_academic_role(array['master_admin','super_admin','admin']::public.academic_role[]);
$$;

create or replace function public.current_faculty_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.faculty where profile_id = public.current_profile_id();
$$;

create or replace function public.current_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.students where profile_id = public.current_profile_id();
$$;

-- is this faculty on a given timetable entry today (owner or substitute)?
create or replace function public.faculty_can_mark(p_entry uuid, p_date date)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.timetable_entries te
    where te.id = p_entry and te.faculty_id = public.current_faculty_id()
  )
  or exists (
    select 1 from public.timetable_change_logs c
    where c.entry_id = p_entry and c.class_date = p_date
      and c.change_type in ('substitution','swap')
      and c.new_faculty_id = public.current_faculty_id()
  );
$$;

-- ---- faculty academic records ----------------------------------------------
create table if not exists public.record_categories (
  id        uuid primary key default gen_random_uuid(),
  code      text not null unique,
  name      text not null,
  sort_order int not null default 0
);

insert into public.record_categories (code, name, sort_order) values
  ('research_paper','Research Paper',1),
  ('journal','Journal Publication',2),
  ('conference_paper','Conference Paper',3),
  ('book_chapter','Book / Book Chapter',4),
  ('fdp','Faculty Development Programme',5),
  ('workshop','Workshop',6),
  ('seminar','Seminar',7),
  ('conference','Conference',8),
  ('research_project','Research Project',9),
  ('consultancy','Consultancy Project',10),
  ('patent','Patent',11),
  ('award','Award',12),
  ('achievement','Academic Achievement',13),
  ('other','Other Institutional Contribution',14)
on conflict (code) do nothing;

create table if not exists public.faculty_records (
  id               uuid primary key default gen_random_uuid(),
  faculty_id       uuid not null references public.faculty(id),
  category_id      uuid not null references public.record_categories(id),
  title            text not null,
  description      text,
  record_date      date,
  academic_year_id uuid references public.academic_years(id),
  submission_status text not null default 'draft'
                     check (submission_status in ('draft','submitted')),
  verification_status text not null default 'pending'
                     check (verification_status in ('pending','approved','rejected','returned')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_frec_faculty on public.faculty_records(faculty_id);

create table if not exists public.supporting_documents (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references public.faculty_records(id) on delete cascade,
  file_path    text not null,
  document_type text,
  uploaded_by  uuid references public.profiles(id),
  uploaded_at  timestamptz not null default now()
);

-- append-only review history for faculty records (distinct from the existing
-- verification_records table, which reviews AI extractions).
create table if not exists public.faculty_record_verifications (
  id          uuid primary key default gen_random_uuid(),
  record_id   uuid not null references public.faculty_records(id),
  reviewer_id uuid references public.profiles(id),
  decision    text not null check (decision in ('approved','rejected','returned')),
  comments    text,
  reviewed_at timestamptz not null default now()
);
