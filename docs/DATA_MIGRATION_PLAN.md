# CMS AcademicOS — Data Migration Log

Pipeline: `tools/importer/` reads the institutional workbooks → preview + validation →
idempotent batched SQL → applied to Supabase → verified counts. No student PII in the
structural stage. Generated SQL/catalogs are kept out of git (data lives only in Supabase).

## M2 · Structural master data — IMPORTED (verified)
Source: Master_Student_List_Nov2026, Workload_Template_Updated_2nd_3rd_Year,
BBA_Master_Timetable_Even_Sem_2027. Academic year 2026-2027.

| Entity | Rows | Source |
| --- | --- | --- |
| departments | 1 | all programmes are BBA |
| programmes | 10 | student master |
| academic_years | 1 | 2026-2027 |
| semesters | 3 | 2, 4, 6 |
| shifts | 3 | master TT Read Me |
| periods | 15 | 5 per shift |
| period_timings | 27 | exact weekday + Saturday times from the TT |
| rooms | 35 | Room Timetable |
| faculty | 68 | Workload Check (short code + name + max weekly hrs) |
| courses | 48 | Allotment |
| subjects | 145 | course × programme × semester |
| faculty_allocations | 237 | Allotment, aggregated |

Validation passed: 0 unallocated faculty, 0 faculty over max weekly hours, 0 subjects
without faculty, programme mapping explicit & complete, all FK references resolved.
Recorded in `public.import_jobs`.

## Pending (authorised but needs the login decision)
- students (2,603) + student_enrolments (50 sections) — needs USN account creation (Q5 decided:
  USN + issued passwords; awaiting Vijay's credentials document).

## M3 (next milestone, not M2)
- Timetable entries from the master TT "Session List" (869 sessions) → timetable_versions/
  entries/entry_sections, with combined-section handling and time→period mapping.

## M3 · Master timetable — IMPORTED (verified)
Source: BBA_Master_Timetable_Even_Sem_2027.xlsx · "Session List" (869 sessions).

| Entity | Rows |
| --- | --- |
| timetable_versions (published) | 3 (one per semester 2/4/6) |
| timetable_entries | 869 |
| timetable_entry_sections | 1,339 (combined classes supported) |
| new courses created | 2 (MILES Major 1 & 2 — elective baskets) |
| new rooms created | 1 (Auditorium) |

Resolution: period 100%, sections 100% (1,339 links), subjects 100%, faculty 821/869.
The 48 faculty-less entries are MILES elective sessions (Faculty='MILES' placeholder) —
imported with faculty_id NULL; real teachers (externals) attach post-approval. Every entry
carries source_ref (Session List row id) for traceability.

Validation (clash engine, actual time windows incl. cross-shift overlap):
**0 faculty double-bookings, 0 room double-bookings** — the master timetable is clash-free.
Recorded in import_jobs.
