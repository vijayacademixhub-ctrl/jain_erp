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
