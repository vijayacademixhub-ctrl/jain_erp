-- CMS AcademicOS · M1 · 0003 timetable, attendance, workload
-- Encodes the rules you specified: combined multi-section classes, auto-attendance from
-- the live daily TT, and the substitute flow crediting workload + recording both faculty.
-- Not yet applied.

-- Who teaches what, for one academic year.
create table if not exists public.faculty_allocations (
  id               uuid primary key default gen_random_uuid(),
  faculty_id       uuid not null references public.faculty(id),
  subject_id       uuid not null references public.subjects(id),
  academic_year_id uuid not null references public.academic_years(id),
  planned_hours    int,
  created_at       timestamptz not null default now()
);

-- A versioned master timetable. Draft and published versions are distinct rows; a
-- published version is never mutated in place (spec §7).
create table if not exists public.timetable_versions (
  id               uuid primary key default gen_random_uuid(),
  semester_id      uuid not null references public.semesters(id),
  academic_year_id uuid not null references public.academic_years(id),
  name             text not null,
  status           text not null default 'draft' check (status in ('draft','published','withdrawn')),
  version_number   int  not null default 1,
  created_by       uuid references public.profiles(id),
  published_by     uuid references public.profiles(id),   -- real user, never a constant
  published_at     timestamptz,
  created_at       timestamptz not null default now()
);

-- One recurring class in the master grid.
create table if not exists public.timetable_entries (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.timetable_versions(id) on delete cascade,
  allocation_id uuid references public.faculty_allocations(id),
  faculty_id    uuid references public.faculty(id),
  subject_id    uuid references public.subjects(id),
  room_id       uuid references public.rooms(id),
  period_id     uuid references public.periods(id),
  day_of_week   text not null check (day_of_week in
                 ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  created_at    timestamptz not null default now()
);
create index if not exists idx_tte_version on public.timetable_entries(version_id);

-- Combined classes: one entry can serve several sections. This also defines which
-- students an attendance session covers.
create table if not exists public.timetable_entry_sections (
  entry_id    uuid not null references public.timetable_entries(id) on delete cascade,
  section_id  uuid not null references public.sections(id),
  primary key (entry_id, section_id)
);

create table if not exists public.timetable_publications (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.timetable_versions(id),
  published_by  uuid references public.profiles(id),
  summary       jsonb,
  published_at  timestamptz not null default now()
);

-- Daily deviations from the master grid: substitution, room change, cancellation,
-- extra/special class. Authorised + audited.
create table if not exists public.timetable_change_logs (
  id                 uuid primary key default gen_random_uuid(),
  entry_id           uuid references public.timetable_entries(id),
  class_date         date not null,
  change_type        text not null check (change_type in
                       ('substitution','room_change','cancellation','extra_class',
                        'special_class','permanent_change','swap')),
  original_faculty_id uuid references public.faculty(id),
  new_faculty_id      uuid references public.faculty(id),   -- substitute / training faculty
  original_room_id    uuid references public.rooms(id),
  new_room_id         uuid references public.rooms(id),
  reason              text,
  created_by          uuid references public.profiles(id),
  created_at          timestamptz not null default now()
);

-- One real teaching occurrence on a date, generated from the live daily TT.
-- taken_by is who actually marked it; subject_faculty is the allocated owner. When a
-- substitute teaches, the two differ and both see the session in their records.
create table if not exists public.attendance_sessions (
  id                 uuid primary key default gen_random_uuid(),
  entry_id           uuid references public.timetable_entries(id),
  change_log_id      uuid references public.timetable_change_logs(id),
  class_date         date not null,
  subject_id         uuid references public.subjects(id),
  subject_faculty_id uuid references public.faculty(id),    -- allocated owner
  taken_by_faculty_id uuid references public.faculty(id),   -- actual teacher (sub or owner)
  status             text not null default 'open'
                       check (status in ('open','submitted','corrected')),
  submitted_at       timestamptz,
  created_at         timestamptz not null default now(),
  unique (entry_id, class_date)                             -- no duplicate sessions
);

create table if not exists public.attendance_records (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references public.attendance_sessions(id) on delete cascade,
  student_id    uuid not null references public.students(id),
  status        text not null check (status in ('present','absent','late','excused')),
  marked_at     timestamptz not null default now(),
  corrected     boolean not null default false,
  unique (session_id, student_id)
);

-- Workload is credited to taken_by_faculty_id from real sessions; planned vs recorded
-- stay distinct (spec §6). This view is a reference, not a table.
create or replace view public.v_faculty_recorded_hours as
  select taken_by_faculty_id as faculty_id,
         count(*) as sessions_taken
  from public.attendance_sessions
  where status in ('submitted','corrected')
  group by taken_by_faculty_id;
