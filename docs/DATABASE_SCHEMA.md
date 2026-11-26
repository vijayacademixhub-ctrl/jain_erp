# CMS AcademicOS — Database Schema (M1)

Extends the existing `academicos` schema (37 tables: identity, meetings, tasks, registers,
audit). New academic tables live in `supabase/migrations/academic/`. **Nothing is applied to
the database yet** — these are reviewable files pending approval.

## Migration plan
| File | Contents | Status |
| --- | --- | --- |
| `0001_academic_structure.sql` | departments, programmes, academic_years, semesters, shifts, periods, period_timings, sections, rooms, courses, subjects | drafted |
| `0002_academic_identity_roles.sql` | `academic_role` enum, user_academic_roles, faculty, students, student_enrolments, faculty_login_events | drafted |
| `0003_timetable_attendance_workload.sql` | faculty_allocations, timetable_versions/entries, timetable_entry_sections (combined classes), publications, change_logs, attendance_sessions/records, recorded-hours view | drafted |
| `0004_records_verification.sql` | record_categories, faculty_records, supporting_documents, verification_records (reuse existing verification pattern) | to write |
| `0005_assessments_notifications.sql` | assessments, assessment_allocations, marks, announcements, notifications (reuse existing notifications) | to write |
| `0006_governance_import.sql` | approvals, import_jobs, import_errors, data_sync_logs (audit_logs already exists) | to write |
| `0007_rls_policies.sql` | RLS per the Role & Permission Matrix, default deny | to write |
| `0008_impersonation_audit.sql` | audited act-as RPC writing actor + acting_as to audit_logs | to write |
| `0009_seed_roles.sql` | seed master_admin (Vijay), super/shared admins | to write |

## Design choices that differ from the uploaded ER diagram
1. `timetable_entry_sections` join table → one class can serve several sections (real data).
2. `shifts` + `periods` + `period_timings(day_type)` → per-shift, per-day timings incl. Saturday.
3. `rooms.capacity_label` + parsed min/max → source ranges like "50-60".
4. Composite subject key (course+programme+semester) → recurring course codes.
5. `timetable_change_logs` + substitute fields → leave/substitution (274 real rows).
6. `attendance_sessions` separates `subject_faculty_id` from `taken_by_faculty_id` → the
   substitute rule, and `unique(entry_id, class_date)` prevents duplicate sessions.
7. Every `*_by` column references a real profile; `published_by` is never a hardcoded string.
