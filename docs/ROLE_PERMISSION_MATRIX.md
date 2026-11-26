# CMS AcademicOS — Role & Permission Matrix

Authoritative source for authorisation. RLS policies in M1 are written to match this
table and nothing else. Default on every table is **deny**; access is granted only where
a cell below says so. Written before policy code per the build checklist.

## 1. Roles

One `profiles` row per real person (students, faculty, staff), linked to `auth.users`.
A person may hold several roles at once (`user_academic_roles`). Roles are institution-wide
unless a scope column narrows them (e.g. a committee scoped to a department).

| Role | Who | Granted by |
| --- | --- | --- |
| `master_admin` | Vijay only. Not published, not shown in user lists or role pickers. | Seeded once, directly. |
| `super_admin` | 4–5 named people (incl. Vijay). Full operational control. | `master_admin` |
| `admin` | 2 shared operational accounts. | `super_admin`+ |
| `committee` | Timetable Committee / Area Chairs. Build & publish timetables, verify records in scope. | `super_admin`+ |
| `iqac` | Institutional reviewers. Verify faculty records; read institutional reports. | `super_admin`+ |
| `faculty` | 68 teaching staff. | `admin`+ |
| `student` | 2,603 students. | bulk import / `admin`+ |

## 2. master_admin — the honest design

- Holds every super_admin capability by default.
- May **act as** any other user (break-glass / support impersonation).
- Is **hidden from the product**: never listed in user directories, role pickers, or admin
  screens; no UI advertises it.
- Is **not hidden from the database audit trail.** Every impersonated action writes to the
  append-only `audit_logs` with `actor = the real master_admin` and `acting_as = the target
  profile`. The academicos schema already makes `audit_logs` tamper-proof (no UPDATE/DELETE
  policy, privileges revoked). This protects the holder in any dispute; it is not a feature
  that can be switched off. An impersonation that left no trace will not be built.

## 3. Capability matrix

Legend: ✔ full · ○ own/in-scope only · R read-only · — none

| Capability | student | faculty | committee | iqac | admin | super_admin | master_admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| View own timetable | ○ | ○ | ✔ | R | ✔ | ✔ | ✔ |
| Build / edit timetable (draft) | — | — | ✔ | — | ○ | ✔ | ✔ |
| Publish / unpublish timetable | — | — | ✔ | — | — | ✔ | ✔ |
| Daily TT change / substitution | — | — | ✔ | — | ✔ | ✔ | ✔ |
| Mark attendance for a class | — | ○ (if on the live class) | — | — | — | ✔ (audited) | ✔ (audited) |
| Correct attendance after submit | — | — | ○ | — | ✔ (audited) | ✔ (audited) | ✔ (audited) |
| View student attendance | ○ own | ○ own classes | ✔ scope | R | ✔ | ✔ | ✔ |
| Enter / verify marks | — | ○ own subjects | R | — | ✔ | ✔ | ✔ |
| View published marks | ○ own | ○ own classes | R | — | ✔ | ✔ | ✔ |
| Submit faculty academic record | — | ○ own | — | — | ○ | ✔ | ✔ |
| Verify faculty record | — | — | ○ scope | ✔ | — | ✔ | ✔ |
| Faculty punch-in / login times | — | ○ own | — | — | ✔ | ✔ | ✔ |
| Workload reports | — | ○ own | ✔ scope | R | ✔ | ✔ | ✔ |
| Manage rooms / resources | — | — | ✔ | — | ✔ | ✔ | ✔ |
| NAAC / IQAC exports | — | — | R | ✔ | R | ✔ | ✔ |
| Manage users & role grants | — | — | — | — | ○ | ✔ | ✔ |
| Act-as (impersonate) | — | — | — | — | — | — | ✔ (audited) |
| Read audit log | — | — | — | — | R scope | ✔ | ✔ |

## 4. Hard invariants (enforced by RLS, not UI)

- A student reads only their own attendance, marks, timetable. Never another student's.
- A faculty reads only their own records and the classes/sections they teach.
- "Mark attendance" is granted **only** when the person's identity appears on that specific
  live daily-timetable entry (original faculty **or** assigned substitute).
- Marks are invisible to students until `publication_status = published`.
- No role except `master_admin` can impersonate; every impersonated write is audited.
- Admins do **not** receive unrestricted access by default (spec §20) — their grants are the
  `admin` column above, nothing wider.

## 5. Substitute / training-faculty rule (from the daily-TT flow)

When a daily-TT entry is reassigned to a substitute:
1. Workload for that session is credited to the **substitute**, not the original faculty.
2. If the substitute marks attendance, the attendance session records **both**:
   `taken_by = substitute` and `subject_faculty = original allocated faculty`.
3. Both faculty see the session in their own records, labelled by their role in it.
