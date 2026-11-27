# CMS AcademicOS — Enhancement v2 Checklist (from the detailed role/flow spec)

Legend: ✅ have · 🟡 partial · ⬜ to build. Status as of session 4.

## 1. User roles
- 🟡 Master Admin (Vijay) — role + hidden + audited impersonation exist; seed Vijay's real account
- ✅ Super Admins — named accounts seeded (Sharda Kanwar, Krishna Koppa, Jayashree, Chaitra, Yamini A V, Karishma, Hephzibah A Lazar), each `<local>@admin.cms-academicos.app`, role super_admin
- 🟡 TTC dashboard — timetable console + daily changes ✅; leave, room bookings, change requests, audit, notifications ⬜
- 🟡 Faculty dashboard — timetable/workload/attendance/assessments/records ✅; Faculty Notes ⬜, Leave module ⬜, richer workload breakdown ⬜
- ✅ Student portal — auto section + timetable/attendance/marks + colour-coded today + upcoming events + notifications feed

## 2. Student portal
- ✅ Auto-identify programme/semester/section from enrolment
- ✅ Today / weekly timetable, faculty info, marks, attendance
- ✅ **Colour-coded Today** (per-subject colours, NOW/NEXT highlight by current time), **Upcoming events** feed (unit tests/exams/seminars/assignments via section_upcoming_events, date-chips + countdown), weekly grid; notifications feed (bell + /student/notifications)
- ✅ PDF + Excel downloads (timetable)

## 3. Timetable flow
- ✅ Committee builds → **submit for approval** → Super-Admin approves → publish → auto workload (recorded) → faculty/student see it → audit
- ✅ **Super Admin approval gate** between draft and publish — committee "Publish & Approval" page (submit / see returned comments); super-admin "Timetable Approvals" page (approve & publish / return with comments); approval supersedes the prior published version for that semester; both sides notified
- ✅ System audit entry on changes

## 4. Timetable modules
- ✅ Master timetable (semester/programme/faculty/room data), grid view, Excel/PDF
- ✅ Daily timetable (substitution/room change/cancellation)
- 🟡 Semester-wise dedicated generation — data present; per-sem builder ⬜
- ⬜ Faculty View and Room View of the grid (data exists)

## 5. Faculty workload engine  ✅
- ✅ Scheduled weekly load per faculty; recorded hours from attendance
- ✅ Breakdown via faculty_workload() RPC + WorkloadPanel: periods & teaching hrs/week, planned hrs, by **course category** (pie), by **day** (bar), by **subject** (bar + PDF/Excel), mentoring sections, substitutions covered/delegated, **monthly conducted-sessions trend**. Faculty self-view (/faculty/workload); Super-Admin walk-in for any faculty (/admin/workload). (theory/lab split not in source data — categorised by course_type instead; invigilation not yet tracked.)

## 6. Leave approval workflow  ✅ (live)
- ✅ Faculty apply (planned/unplanned, rules) → super admin/admin approve/reject → faculty notified + committee asked to arrange substitutes
- ✅ Leave status + history (faculty page); 🟡 PDF download of leave record (later)

## 7. Room booking module  ✅ (live)
- ✅ Faculty request page with live **availability check**; **conflict detection** against published timetable classes (period_timings) and approved bookings; **approval workflow** (admin approve/reject with re-check); booking **calendar** (upcoming approved, grouped by day) on the admin page; cancel; notifications + audit on every step. Bookable rooms only.

## 8. Notification engine  ✅ (in-app bell live)
- ✅ Header bell (unread badge, dropdown, mark-read, deep links) for all roles; student Notifications page
- ✅ Triggers live: substitute assigned, class change/cancel/room; record verified. (leave/publish added with those modules)
- (email / mobile push: later)

## 9. Super Admin visual dashboard  ✅
- ✅ Analytics (KPIs, breakdowns, PDF/Excel)
- ✅ "Institutional Command Centre": colour-accented KPI cards, clickable **alerts panel** (timetable approvals, leave, room bookings, record verifications, on-leave-today, changes, audit), **charts** (students-by-programme bars, verification donut, busiest-faculty bars) via admin_alerts + analytics_overview

## 10. Audit trail  ✅
- ✅ Append-only audit_logs backend (tamper-proof)
- ✅ Audit Trail viewer UI (/admin/audit): filter by action/entity, search, colour-coded action tags, PDF/Excel export (recent_audit + audit_filters RPCs, admin-only)

## 11. Year-end backup  ⬜
- ⬜ Backup Center: Excel + PDF export of timetable/faculty/leave/room/management/academic/workload

## 12. Future phase (deferred, agreed)
- ⬜ AI chatbot, WhatsApp, attendance analytics, predictive workload, auto substitute suggestions

## Faculty research upload + verify
- ✅ My Records (14 categories, evidence upload to private bucket) + committee/IQAC verify + NAAC export

## Navigation target (from spec)
Dashboard · Timetable(Master/Semester/Daily/Publish) · Faculty(Dashboard/Workload/Leave/Research) ·
Students(Dashboard/Timetable/Notifications/Downloads) · Leave · Room Booking · Notifications ·
Reports · Audit Trail · Backup Center · Administration(Master/Super/Users/Permissions)

## Build order (one by one)
1. ✅ Notifications engine (bell) — DONE
2. ✅ Leave management — DONE
3. Super-admin accounts (named) + approval gate in publish
4. Room booking
5. Audit Trail viewer
6. Super Admin visual dashboard (charts) + alerts
7. Faculty Notes + workload breakdown
8. Student upcoming events + notifications feed
9. Backup Center
10. Timetable Faculty/Room views
