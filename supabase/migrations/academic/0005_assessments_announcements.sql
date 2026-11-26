-- CMS AcademicOS · M1 · 0005 assessments, assignments, marks, announcements
-- Faculty design their own assessment type; publish marks only. Limits (6-7 assessments,
-- 5 exams/class) enforced by a trigger added in 0006 once the approvals table exists.

create table if not exists public.assessments (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null references public.subjects(id),
  section_id       uuid not null references public.sections(id),
  faculty_id       uuid references public.faculty(id),
  academic_year_id uuid references public.academic_years(id),
  kind             text not null default 'assessment' check (kind in ('assessment','exam')),
  title            text not null,
  assessment_type  text,                 -- faculty's own choice: written, group, project, viva...
  max_marks        numeric,
  assessment_date  date,
  status           text not null default 'draft' check (status in ('draft','scheduled','completed')),
  is_published     boolean not null default false,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);
create index if not exists idx_assess_class on public.assessments(subject_id, section_id, academic_year_id, kind);

create table if not exists public.marks (
  id                 uuid primary key default gen_random_uuid(),
  assessment_id      uuid not null references public.assessments(id) on delete cascade,
  student_id         uuid not null references public.students(id),
  marks_obtained     numeric,
  publication_status text not null default 'unpublished'
                      check (publication_status in ('unpublished','published')),
  entered_by         uuid references public.profiles(id),
  entered_at         timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table if not exists public.assignments (
  id               uuid primary key default gen_random_uuid(),
  subject_id       uuid not null references public.subjects(id),
  section_id       uuid not null references public.sections(id),
  faculty_id       uuid references public.faculty(id),
  academic_year_id uuid references public.academic_years(id),
  title            text not null,
  description      text,
  due_date         date,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now()
);

-- Broadcast announcements, scoped by role / programme / section (unified notification
-- delivery via the existing notifications table is wired in M5).
create table if not exists public.announcements (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  body        text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now()
);

create table if not exists public.announcement_targets (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  role            public.academic_role,
  programme_id    uuid references public.programmes(id),
  section_id      uuid references public.sections(id)
);

alter table public.assessments enable row level security;
alter table public.marks enable row level security;
alter table public.assignments enable row level security;
alter table public.announcements enable row level security;
alter table public.announcement_targets enable row level security;
