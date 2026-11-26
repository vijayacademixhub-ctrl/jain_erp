-- CMS AcademicOS · M1 · 0006 governance, import pipeline, assessment limits

create table if not exists public.approvals (
  id            uuid primary key default gen_random_uuid(),
  request_type  text not null,            -- 'extra_assessment','extra_exam',...
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_by  uuid references public.profiles(id),
  decided_by    uuid references public.profiles(id),
  scope         jsonb,                    -- {subject_id, section_id, academic_year_id, kind}
  reason        text,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);

create table if not exists public.import_jobs (
  id            uuid primary key default gen_random_uuid(),
  source_file   text not null,
  entity        text not null,            -- 'students','faculty','timetable',...
  status        text not null default 'preview' check (status in ('preview','approved','imported','failed')),
  total_rows    int,
  inserted_rows int,
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  completed_at  timestamptz
);

create table if not exists public.import_errors (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.import_jobs(id) on delete cascade,
  row_number  int,
  column_name text,
  message     text not null,
  raw_value   text
);

create table if not exists public.data_sync_logs (
  id          uuid primary key default gen_random_uuid(),
  source      text not null,             -- 'erp','excel',...
  entity      text,
  state       text,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

-- ---- assessment / exam per-class limits ------------------------------------
-- Max 7 assessments and 5 exams per (subject, section, academic_year). Beyond the
-- cap an approved 'extra_assessment'/'extra_exam' approval must exist for that class.
create or replace function public.guard_assessment_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cap int;
  v_count int;
  v_req text;
  v_ok boolean;
begin
  if new.kind = 'exam' then v_cap := 5; v_req := 'extra_exam';
  else v_cap := 7; v_req := 'extra_assessment'; end if;

  select count(*) into v_count from public.assessments a
   where a.subject_id = new.subject_id and a.section_id = new.section_id
     and a.academic_year_id is not distinct from new.academic_year_id
     and a.kind = new.kind;

  if v_count >= v_cap then
    select exists (
      select 1 from public.approvals ap
      where ap.request_type = v_req and ap.status = 'approved'
        and ap.scope->>'subject_id' = new.subject_id::text
        and ap.scope->>'section_id' = new.section_id::text
    ) into v_ok;
    if not v_ok then
      raise exception
        'Limit reached: % % for this class (cap %). A super_admin approval is required for more.',
        v_count, new.kind, v_cap using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_assessment_limit on public.assessments;
create trigger trg_assessment_limit
  before insert on public.assessments
  for each row execute function public.guard_assessment_limit();

alter table public.approvals enable row level security;
alter table public.import_jobs enable row level security;
alter table public.import_errors enable row level security;
alter table public.data_sync_logs enable row level security;
