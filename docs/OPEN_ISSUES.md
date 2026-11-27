# CMS AcademicOS — Open Issues & Decisions

## Decisions locked (by Vijay)
- D1 — **One platform.** Extend the existing `academicos` Supabase project; do not create a
  second one. Single identity (`profiles`), single audit trail.
- D2 — **Staging only.** No public production deploy until approved. Hosting on Vercel.
- D3 — **Student PII authorised** for storage in Supabase (kept out of GitHub).
- D4 — **Roles:** master_admin (Vijay, hidden), super_admin (4–5), admin (2 shared),
  committee, iqac, faculty, student. Multi-role per person.
- D5 — **master_admin impersonation is audited**, not covert at the DB level (see role matrix §2).
- D6 — Faculty auto-attendance from the live daily TT; faculty track student attendance;
  faculty punch-in/login times captured.
- D7 — Substitute flow: workload moves to the substitute; both substitute and original
  subject faculty get an attendance record.

## Still open (not blocking the structural migrations)
- Q4 — Which timetable is authoritative for import: Master (Even Sem 2027) or the date-wise
  Jan–Apr expansion? (They appear consistent at 869/week.)
- Q5 — **Login identity for 2,603 students + 68 faculty.** No email in any source file.
  Options: ERP email, USN accounts with issued passwords, or university Google sign-in.
  Blocks account creation (M1 auth) and the portals (M4). **Needed soon.**
- Q6 — Department structure. All source programmes are BBA → one department for now.
- Q7 — Assessment / marks / faculty-record data not yet provided. Build schema + UI against
  empty tables, or wait for files?
- Q8 — ERP vendor/modules/APIs unidentified. M7 cannot be planned until named.

## Assumptions made
- A1 — Section labels carry the odd-semester ordinal (`5th A` = 6th-sem section). Verified
  against student-master strengths.
- A2 — Faculty natural key = short code; profile/login attached later via Q5.
- A3 — Course codes recur across programmes → composite subject key.

## Update — session 2
- D8 — **Free tier only** until college approval. No Supabase Pro / Vercel Pro yet. Supabase
  branching (Pro) skipped; academic schema applied additively to the free project instead,
  fully reversible via `supabase/migrations/academic/DOWN_0001-0003_rollback.sql`.
  Firebase not needed — free Supabase is sufficient for M1–M5 at this data scale.
- D9 — Logins: USN + issued passwords; Vijay supplies an ID/password document to load.
- D10 — Q4 resolved: the provided **Master Timetable (Even Sem 2027)** is authoritative.
- D11 — Assessments: faculty design their own type; publish marks only; 6–7 assessments +
  5 exams per class; beyond that needs super_admin approval. See ASSESSMENT_MODULE.md.
- D12 — Every record exportable as **PDF + Excel** by default; daily TT WhatsApp-ready,
  no alignment issues. Shared, tested export component.

## M1 progress
- [x] academic_0001 structure · [x] academic_0002 identity/roles · [x] academic_0003 timetable/attendance
- [x] RLS enabled default-deny on all 24 academic tables
- [ ] RLS policies per matrix (0007) · [ ] impersonation audit RPC (0008) · [ ] seed roles (0009)
- [ ] records/verification (0004) · [ ] assessments/notifications (0005) · [ ] governance/import (0006)

## M2 structural import — done (session 3)
- Imported 10 programmes, 3 semesters, 3 shifts, 35 rooms, 68 faculty, 48 courses,
  145 subjects, 237 allocations, 50 sections. All verified, 0 validation errors.
- Vijay ('VIJAY', Vijay Mourish DG) is present in the faculty workload sheet (Intro to AI,
  1 hr, BBA Branding 6th sem) — noted; his master_admin/super_admin grants come with 0009.
- Programme abbreviations used as codes (BBA-C, BBA-BA, BBA-SF, ...) — stable & unique;
  can be renamed later without data loss.
- Deferred to the student step: student_enrolments (needs USN accounts). Faculty short codes
  are the identity key until logins are issued.

## M4 frontend — started (session 4)
- Built academicos/ (Vite 8 + React 18 + TS + react-router 7 + Tailwind 4.3 + Supabase JS).
  Role-based portals: student, faculty, committee, admin. PDF + Excel export (SheetJS + jsPDF).
- Added v_timetable_display view (security_invoker) + migration 0011 granting table privileges
  to the authenticated role (RLS still gates rows; grants were missing from 0001-0009).
- Test account (staging, not a real person): admin@academicos.cms.test / master_admin,
  linked to the VIJAY faculty row. Verified end-to-end: login → 869 entries visible,
  anon denied. Real logins arrive with the credentials document (role seed 0009).
- TODO: lazy-load export libs (952KB chunk); M5 adds attendance/marks to the portals.
