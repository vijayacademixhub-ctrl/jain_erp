# CMS AcademicOS — Assessment & Exports design (for migration 0005 + M5 UI)

## Faculty assessment workflow
- Faculty **design** their own assessment: type is their choice — written, group, project,
  presentation, etc. The ERP stores the definition; it does not constrain the pedagogy.
- Two authoring paths, both supported:
  1. **In-ERP:** create/edit the assessment and enter marks directly on the site.
  2. **Excel round-trip:** download a template (Excel) pre-filled with the class roster,
     fill marks offline, re-import. Import is validated (USN match, max-mark bounds) with a
     preview + error report before commit — no silent discards.
- On the website faculty **publish marks**. Marks are invisible to students until published
  (`publication_status = published`).

## Limits (enforced in DB + UI)
- Max **6–7 assessments** per class (per subject+section+semester).
- Max **5 exams** (midterm, faculty's own Google-form exams, etc.) per class.
- Exceeding either limit requires an **approval request to a super_admin**; the extra slot is
  only created once approved. Approvals recorded in the governance `approvals` table.

## Exports — every record, PDF + Excel, by default
- Default access: anyone who can see a record can export it as **both PDF and Excel**.
- Covers: daily timetable, master timetable, assignments, assessments, marks, attendance,
  workload, verification/NAAC reports.
- **Daily timetable is WhatsApp-ready:** clean, fixed-width layout, no column misalignment,
  readable on a phone. PDF is the shareable artifact; Excel is the editable one.
- Export layout is a shared, tested component so alignment is consistent across every module.

## Data decisions locked
- D-TT — The **provided Master Timetable (Even Sem 2027)** is authoritative. Build strictly to it.
- Externals (external faculty/examiners) deferred until college approval.
