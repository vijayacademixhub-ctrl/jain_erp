-- Full rollback for academic migrations 0001-0003 (+0003b RLS).
-- Drops ONLY the academic tables added by M1. Does not touch the existing
-- academicos tables, profiles, auth, or any existing row. Reversible safety net.
drop view if exists public.v_faculty_recorded_hours;
drop table if exists public.attendance_records cascade;
drop table if exists public.attendance_sessions cascade;
drop table if exists public.timetable_change_logs cascade;
drop table if exists public.timetable_publications cascade;
drop table if exists public.timetable_entry_sections cascade;
drop table if exists public.timetable_entries cascade;
drop table if exists public.timetable_versions cascade;
drop table if exists public.faculty_allocations cascade;
drop table if exists public.faculty_login_events cascade;
drop table if exists public.student_enrolments cascade;
drop table if exists public.students cascade;
drop table if exists public.faculty cascade;
drop table if exists public.user_academic_roles cascade;
drop table if exists public.subjects cascade;
drop table if exists public.courses cascade;
drop table if exists public.rooms cascade;
drop table if exists public.sections cascade;
drop table if exists public.period_timings cascade;
drop table if exists public.periods cascade;
drop table if exists public.shifts cascade;
drop table if exists public.semesters cascade;
drop table if exists public.academic_years cascade;
drop table if exists public.programmes cascade;
drop table if exists public.departments cascade;
drop type if exists public.academic_role;
