-- CMS AcademicOS · M1 · 0001 academic structure
-- Extends the existing academicos schema. Structure only; identity, roles and RLS
-- follow in 0002 and 0003. Not yet applied — pending schema approval.

-- Every BBA programme in the source data is one department for now (see OPEN_ISSUES Q6).
create table if not exists public.departments (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  name          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.programmes (
  id            uuid primary key default gen_random_uuid(),
  department_id uuid not null references public.departments(id),
  code          text not null unique,          -- e.g. BBA-BAV, BBA-CORP
  name          text not null,                 -- 'BBA Branding & Advertising'
  created_at    timestamptz not null default now()
);

create table if not exists public.academic_years (
  id            uuid primary key default gen_random_uuid(),
  label         text not null unique,          -- '2026-2027'
  starts_on     date,
  ends_on       date
);

-- A term within a programme. semester_number is the official even/odd number (2,4,6).
create table if not exists public.semesters (
  id               uuid primary key default gen_random_uuid(),
  academic_year_id uuid not null references public.academic_years(id),
  semester_number  int  not null check (semester_number between 1 and 8),
  starts_on        date,
  ends_on          date,
  unique (academic_year_id, semester_number)
);

-- Shift = the daily window a cohort runs in. Timings differ per shift AND per day type,
-- so period times live in period_timings, not on a global periods table.
create table if not exists public.shifts (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,          -- SHIFT_6TH, SHIFT_4TH, SHIFT_2ND
  name          text not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.periods (
  id             uuid primary key default gen_random_uuid(),
  shift_id       uuid not null references public.shifts(id),
  period_number  int  not null,
  is_break       boolean not null default false,
  unique (shift_id, period_number)
);

-- Per-day timing: Saturday differs from Mon-Fri, so (period, day_type) -> start/end.
create table if not exists public.period_timings (
  id          uuid primary key default gen_random_uuid(),
  period_id   uuid not null references public.periods(id),
  day_type    text not null check (day_type in ('weekday','saturday')),
  start_time  time not null,
  end_time    time not null,
  unique (period_id, day_type)
);

create table if not exists public.sections (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid not null references public.programmes(id),
  semester_id       uuid not null references public.semesters(id),
  shift_id          uuid references public.shifts(id),
  label             text not null,             -- '5th A' (carries odd-sem ordinal, see note)
  ordinal_label     text,                      -- display ordinal as printed on the TT
  strength          int,                       -- enrolled count from the master student list
  class_teacher_id  uuid,                      -- -> faculty.id, added in 0002
  home_room_id      uuid,                      -- -> rooms.id
  created_at        timestamptz not null default now(),
  unique (programme_id, semester_id, label)
);

-- Rooms: source capacity is a range ('50-60'), kept verbatim plus parsed bounds.
create table if not exists public.rooms (
  id             uuid primary key default gen_random_uuid(),
  room_number    text not null unique,
  building       text,
  room_type      text,                         -- Classroom, Lab, Seminar Hall, ...
  capacity_label text,                          -- '50-60'
  capacity_min   int,
  capacity_max   int,
  equipment      text,
  bookable       boolean not null default true,
  created_at     timestamptz not null default now()
);

-- A course is the catalogue subject; subject is its offering in a programme+semester.
-- Codes (BE, PC, OB) recur across programmes, so the natural key is composite.
create table if not exists public.courses (
  id            uuid primary key default gen_random_uuid(),
  code          text not null,                 -- BE, PC, OB, QTDM ...
  name          text not null,
  course_type   text,                          -- Core, Language, Elective ...
  credits       int,
  max_hours     int,                           -- from credits->hours rule
  unique (code, name)
);

create table if not exists public.subjects (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references public.courses(id),
  programme_id  uuid not null references public.programmes(id),
  semester_id   uuid not null references public.semesters(id),
  short_form    text,                          -- short label used in the TT cell
  created_at    timestamptz not null default now(),
  unique (course_id, programme_id, semester_id)
);
