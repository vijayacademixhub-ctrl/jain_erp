# CMS AcademicOS — Master Build Checklist

Status key: `[ ]` not started · `[~]` partially exists · `[x]` done · `[?]` blocked on a decision

This checklist mirrors the Master Project Prompt (§5–§16 modules, §22 milestones).
It is the single source of truth for scope. Nothing is marked `[x]` until it is tested
against real data with correct permissions (§23).

---

## 0. Assets we already hold

| Asset | State | Where |
| --- | --- | --- |
| Timetable demo source (~14k LOC, Vite+React+TS) | Verified byte-identical to live deploy | this repo |
| Clash engine, 8 rule types, 3 severities | Pure, dependency-free, has tests | `src/domain/clash.ts` |
| `academicos` Supabase project | 37 tables, 22 migrations, RLS throughout | Supabase `prxfztbafgbnxnglqaje` |
| Real master timetable (Even Sem 2027) | 869 sessions/week, 68 faculty, rooms | institutional Excel |
| Real date-wise timetable (Jan–Apr 2027) | 4,230 rows, 16 weeks | institutional Excel |
| Real student master (Nov 2026) | 2,603 students, 10 programmes, 50 sections | institutional Excel |
| Real workload allotment | 473 allocations, credit→hours rules | institutional Excel |
| Faculty leave plan + 274 substitutions | Operational history | institutional Excel |
| Upload templates (12 workbooks) | Ingestion schema | `docs/upload-templates/` |

**Not yet held:** faculty/student email identities, assessment & marks data, faculty academic
records, room equipment/building data, ERP identification, department structure.

---

## M0 — Audit `[~]`

- [x] Inspect repository and frontend architecture
- [x] Identify implemented features (16 routes, full inventory)
- [x] Assess existing database/backend (none — localStorage only)
- [x] Assess authentication (none — client-side role toggle)
- [x] Assess timetable create/edit/publish
- [x] Reusable component inventory
- [x] Hosting/deployment review (Cloudflare Pages via wrangler)
- [x] Security concerns and technical limitations
- [x] Inspect real institutional Excel files
- [x] Discover and assess existing `academicos` Supabase platform
- [?] Recommended target architecture — **blocked on Q1 (one platform or two)**
- [?] Phased plan sign-off — **blocked on Q1–Q9**

## M1 — Database & identity foundation `[ ]`

- [x] Academic schema 0001-0003 applied to Supabase (free tier, additive, RLS on, 24 tables)
- [x] Version-controlled migrations 0001-0008 (structure, identity, timetable, records, assessments, governance, RLS, impersonation)
- [ ] Supabase Auth; decide identity source for 2,603 students + 68 faculty (**Q5**)
- [x] Roles enum + grant table (7 roles, multi-role)
- [ ] Multi-role support per person
- [x] RLS on all 38 academic tables + policies per matrix
- [x] ROLE_PERMISSION_MATRIX.md written; policies coded to it
- [ ] Dev / staging / production environments separated
- [ ] RLS test suite: faculty cannot read another faculty's records; student cannot read another student's

## M2 — Real institutional data `[ ]`

- [ ] Python import pipeline (preview → error report → approval → import → verify totals)
- [ ] Import: departments, programmes (10), semesters, sections (50), rooms, periods/shifts
- [ ] Import: faculty (68) with short-code → identity mapping
- [ ] Import: students (2,603) — **requires Q3 PII authorisation**
- [ ] Import: subjects, credit→max-hours rules, faculty allocations (473)
- [ ] Import: master timetable (869 sessions), date-wise expansion (4,230 rows)
- [ ] Import: faculty leave plan, substitutions (274)
- [ ] Validation: unique USN, unique faculty code, valid FK references, no orphan allocations
- [ ] Source-file traceability retained on every imported row
- [ ] `import_jobs` / `import_errors` tables; no silent discards

## M3 — Timetable production system `[ ]`

- [ ] Port clash engine from demo to shared package (client + server)
- [ ] **Server-side re-validation on every write** (client check is advisory only)
- [ ] Committee builder: programme/year/semester/section/subject/faculty/room/day/period
- [ ] Draft vs published separation; publishing never mutates a published version
- [ ] Version history **without the demo's 6-snapshot cap**
- [ ] Publish workflow: validate → check conflicts → store version → fan out to dashboards → recalc workload → notify → retain history
- [ ] Authorised unpublish/withdrawal
- [ ] Change management: temporary, permanent, substitution, room change, special/extra class, cancellation
- [ ] Combined multi-section sessions (real data has 4-section classes)
- [ ] Clash rules: faculty double-book, room double-book, section conflict, invalid faculty–subject mapping, invalid room, overlapping periods, availability
- [ ] Real `publishedBy` from the authenticated user (demo hardcodes "TTC Admin")

## M4 — Role-based portals `[ ]`

- [ ] Student portal: today, week, subjects, faculty, rooms, attendance %, assessments, marks, announcements
- [ ] Faculty portal: profile, subjects, sections, daily/weekly/monthly timetable, workload, pending attendance, pending assessments, leave
- [ ] Admin portal
- [ ] Committee / Area Chair portal
- [ ] IQAC / reviewer portal
- [ ] Super Admin
- [ ] Role-specific navigation; protected routes server-side, not just hidden in UI

## M5 — Academic operations `[ ]`

- [ ] Attendance: timetable-linked sessions, duplicate-session prevention, submission, audit on correction
- [ ] Attendance analytics: subject-wise, shortage alerts, remedial tracking, correction requests
- [ ] Assessments: creation, schedule, allocation, completion tracking, marks entry/verification
- [ ] Marks visibility gated by publication status
- [ ] Faculty academic records (My Records): 14 categories, evidence upload, verification status
- [ ] Leave management + substitute assignment (real data already models this)
- [ ] Workload engine: daily/weekly/monthly/semester, planned vs recorded kept distinct
- [ ] Excel exports

## M6 — Institutional intelligence `[ ]`

- [ ] Analytics: student, faculty, timetable, academic office (with freshness + period labels)
- [ ] Committee verification workflow (approve/reject/return + comments + history)
- [ ] NAAC/IQAC exports traceable to verified source records — **no compliance claims without approved mapping**
- [ ] Academic Office operations — **much of this already exists in `academicos` (see Q1)**
- [ ] AI assistant over authorised data only, permission-aware retrieval
- [ ] AI may never modify records, publish marks, approve, or change timetables unaided

## M7 — ERP integration `[ ]`

- [?] Identify ERP vendor, modules, APIs, auth, data ownership, permissions — **blocked on Q8**
- [ ] Level 1 CSV/Excel import → Level 2 scheduled sync → Level 3 API → Level 4 two-way (only if approved)
- [ ] Treat ERP as source of truth where it already owns the record
- [ ] No writes to ERP without institutional + vendor approval

## M8 — Production readiness `[ ]`

- [ ] Security, functional, performance, UAT testing
- [ ] Backup and recovery validated
- [ ] All §25 documents written
- [ ] Institutional approval, controlled rollout

---

## ER diagram — corrections required before M1

The uploaded ER diagram is a sound core but will not hold the real data as drawn.

1. **Combined classes unsupported.** Real sessions serve several sections at once
   (`BAV-A/BAV-B/SPM/EEM`, `C/D`, `G/DB`). `TIMETABLE_ENTRIES → FACULTY_ALLOCATIONS`
   allows one `section_id`. Needs a `timetable_entry_sections` join table — this also
   determines which students an attendance session covers.
2. **Periods are not global.** Times differ per shift *and* per day:
   6th Sem 7:45–12:20, 4th Sem 8:45–1:20, 2nd Sem 11:40–4:25, and Saturday differs again.
   `PERIODS(period_number,start,end)` needs a `shifts` table and day-type dimension.
3. **No `shifts` entity** at all.
4. **`ROOMS.capacity` is `int`** but the source holds ranges (`"50-60"`, `"80-90"`).
5. **No leave or substitution entities**, though real data has a leave plan and 274 substitutions.
6. **No `timetable_publications` / `timetable_change_logs`** (required by §18).
7. **No `tasks`, `meetings`, `announcements`, `notifications`, `audit_logs`,
   `approvals`, `import_jobs`, `import_errors`, `data_sync_logs`** (required by §18).
8. **No electives / student elective choices**, though parallel elective sessions exist.
9. **`SUBJECTS.subject_code` is globally unique** but codes (`BE`, `PC`, `OB`) recur
   across programmes and semesters — needs a composite key.
10. **`STUDENTS.section_id` duplicates `STUDENT_ENROLMENTS`** — decide which is authoritative per year.
11. **`PROFILES` has no link to `auth.users`** — required for Supabase Auth + RLS.
12. **`ATTENDANCE_SESSIONS` needs substitute support** (actual teacher ≠ allocated faculty).
13. **No faculty workload limits** entity, though source data has max weekly hours per faculty.
14. **No `permissions` / `record_categories`** tables (§18).
15. **`DEPARTMENTS` has no source data** — every programme in the files is BBA.

## Verified data facts

- Section labels carry the **odd-semester ordinal**: `5th A` is a **6th-semester** section.
  Confirmed — section strengths in the student master match the timetable exactly (75/65/75/61/67/58).
- Semester period: **4 Jan 2027 → April 2027**, 16 weeks, 869 classes/week.
- Faculty are identified by **short code** (`DA`, `SHM`, `GSR`), not email or employee ID.
- Cell format in master timetable: `Subject (Faculty short code) [Room]`, two entries per cell
  where parallel electives run.
