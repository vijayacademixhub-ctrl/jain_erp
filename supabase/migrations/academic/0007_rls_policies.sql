-- CMS AcademicOS · M1 · 0007 RLS policies (enforces ROLE_PERMISSION_MATRIX.md)
-- Base gate: is_active_user(). anon has no profile -> denied by default.
-- is_academic_admin() = master_admin | super_admin | admin, so admin policies also cover master.

-- ---------- reference / structure: read-all, write-admin-or-committee ----------
do $$
declare t text;
begin
  foreach t in array array['departments','programmes','academic_years','semesters','shifts',
    'periods','period_timings','sections','rooms','courses','subjects','record_categories']
  loop
    execute format($f$
      drop policy if exists %1$s_read on public.%1$s;
      create policy %1$s_read on public.%1$s for select to authenticated
        using (public.is_active_user());
      drop policy if exists %1$s_write on public.%1$s;
      create policy %1$s_write on public.%1$s for all to authenticated
        using (public.is_academic_admin()
               or public.has_academic_role(array['committee']::public.academic_role[]))
        with check (public.is_academic_admin()
               or public.has_academic_role(array['committee']::public.academic_role[]));
    $f$, t);
  end loop;
end $$;

-- ---------- faculty directory: read-all active, write-admin ----------
drop policy if exists faculty_read on public.faculty;
create policy faculty_read on public.faculty for select to authenticated using (public.is_active_user());
drop policy if exists faculty_write on public.faculty;
create policy faculty_write on public.faculty for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- ---------- students: own row, or faculty/committee/iqac/admin ----------
drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
  using (profile_id = public.current_profile_id()
         or public.has_academic_role(array['faculty','committee','iqac']::public.academic_role[])
         or public.is_academic_admin());
drop policy if exists students_write on public.students;
create policy students_write on public.students for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- ---------- role grants: own read; admin manage ----------
drop policy if exists uar_read on public.user_academic_roles;
create policy uar_read on public.user_academic_roles for select to authenticated
  using (profile_id = public.current_profile_id() or public.is_academic_admin());
drop policy if exists uar_write on public.user_academic_roles;
create policy uar_write on public.user_academic_roles for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- ---------- enrolments ----------
drop policy if exists enrol_read on public.student_enrolments;
create policy enrol_read on public.student_enrolments for select to authenticated
  using (student_id = public.current_student_id()
         or public.has_academic_role(array['faculty','committee','iqac']::public.academic_role[])
         or public.is_academic_admin());
drop policy if exists enrol_write on public.student_enrolments;
create policy enrol_write on public.student_enrolments for all to authenticated
  using (public.is_academic_admin()) with check (public.is_academic_admin());

-- ---------- faculty login/punch events: own + admin ----------
drop policy if exists fle_read on public.faculty_login_events;
create policy fle_read on public.faculty_login_events for select to authenticated
  using (faculty_id = public.current_faculty_id() or public.is_academic_admin());
drop policy if exists fle_insert on public.faculty_login_events;
create policy fle_insert on public.faculty_login_events for insert to authenticated
  with check (faculty_id = public.current_faculty_id() or public.is_academic_admin());

-- ---------- allocations ----------
drop policy if exists alloc_read on public.faculty_allocations;
create policy alloc_read on public.faculty_allocations for select to authenticated
  using (public.is_active_user());
drop policy if exists alloc_write on public.faculty_allocations;
create policy alloc_write on public.faculty_allocations for all to authenticated
  using (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]))
  with check (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]));

-- ---------- timetable (read-all active, write committee/admin) ----------
do $$
declare t text;
begin
  foreach t in array array['timetable_versions','timetable_entries','timetable_entry_sections',
    'timetable_publications','timetable_change_logs']
  loop
    execute format($f$
      drop policy if exists %1$s_read on public.%1$s;
      create policy %1$s_read on public.%1$s for select to authenticated using (public.is_active_user());
      drop policy if exists %1$s_write on public.%1$s;
      create policy %1$s_write on public.%1$s for all to authenticated
        using (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]))
        with check (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]));
    $f$, t);
  end loop;
end $$;

-- ---------- attendance sessions: involved faculty + admin; mark-gated ----------
drop policy if exists att_sess_read on public.attendance_sessions;
create policy att_sess_read on public.attendance_sessions for select to authenticated
  using (taken_by_faculty_id = public.current_faculty_id()
         or subject_faculty_id = public.current_faculty_id()
         or public.is_academic_admin()
         or public.has_academic_role(array['committee']::public.academic_role[]));
drop policy if exists att_sess_write on public.attendance_sessions;
create policy att_sess_write on public.attendance_sessions for all to authenticated
  using (public.faculty_can_mark(entry_id, class_date) or public.is_academic_admin())
  with check (public.faculty_can_mark(entry_id, class_date) or public.is_academic_admin());

-- ---------- attendance records: student own; involved faculty; admin ----------
drop policy if exists att_rec_read on public.attendance_records;
create policy att_rec_read on public.attendance_records for select to authenticated
  using (student_id = public.current_student_id()
         or public.is_academic_admin()
         or exists (select 1 from public.attendance_sessions s
                    where s.id = session_id
                      and (s.taken_by_faculty_id = public.current_faculty_id()
                           or s.subject_faculty_id = public.current_faculty_id())));
drop policy if exists att_rec_write on public.attendance_records;
create policy att_rec_write on public.attendance_records for all to authenticated
  using (public.is_academic_admin()
         or exists (select 1 from public.attendance_sessions s
                    where s.id = session_id and s.taken_by_faculty_id = public.current_faculty_id()))
  with check (public.is_academic_admin()
         or exists (select 1 from public.attendance_sessions s
                    where s.id = session_id and s.taken_by_faculty_id = public.current_faculty_id()));

-- ---------- faculty records: owner manage; committee/iqac verify/read; admin ----------
drop policy if exists frec_read on public.faculty_records;
create policy frec_read on public.faculty_records for select to authenticated
  using (faculty_id = public.current_faculty_id()
         or public.has_academic_role(array['committee','iqac']::public.academic_role[])
         or public.is_academic_admin());
drop policy if exists frec_write on public.faculty_records;
create policy frec_write on public.faculty_records for all to authenticated
  using (faculty_id = public.current_faculty_id() or public.is_academic_admin())
  with check (faculty_id = public.current_faculty_id() or public.is_academic_admin());

drop policy if exists sdoc_read on public.supporting_documents;
create policy sdoc_read on public.supporting_documents for select to authenticated
  using (exists (select 1 from public.faculty_records r where r.id = record_id
                 and (r.faculty_id = public.current_faculty_id()
                      or public.has_academic_role(array['committee','iqac']::public.academic_role[])
                      or public.is_academic_admin())));
drop policy if exists sdoc_write on public.supporting_documents;
create policy sdoc_write on public.supporting_documents for all to authenticated
  using (exists (select 1 from public.faculty_records r where r.id = record_id
                 and (r.faculty_id = public.current_faculty_id() or public.is_academic_admin())))
  with check (exists (select 1 from public.faculty_records r where r.id = record_id
                 and (r.faculty_id = public.current_faculty_id() or public.is_academic_admin())));

drop policy if exists frv_read on public.faculty_record_verifications;
create policy frv_read on public.faculty_record_verifications for select to authenticated
  using (exists (select 1 from public.faculty_records r where r.id = record_id
                 and (r.faculty_id = public.current_faculty_id()
                      or public.has_academic_role(array['committee','iqac']::public.academic_role[])
                      or public.is_academic_admin())));
drop policy if exists frv_insert on public.faculty_record_verifications;
create policy frv_insert on public.faculty_record_verifications for insert to authenticated
  with check (public.has_academic_role(array['committee','iqac']::public.academic_role[])
              or public.is_academic_admin());

-- ---------- assessments: faculty own + admin manage; students read published; committee read ----------
drop policy if exists assess_read on public.assessments;
create policy assess_read on public.assessments for select to authenticated
  using (faculty_id = public.current_faculty_id()
         or public.is_academic_admin()
         or public.has_academic_role(array['committee']::public.academic_role[])
         or (is_published and exists (
              select 1 from public.student_enrolments e
              where e.student_id = public.current_student_id() and e.section_id = assessments.section_id)));
drop policy if exists assess_write on public.assessments;
create policy assess_write on public.assessments for all to authenticated
  using (faculty_id = public.current_faculty_id() or public.is_academic_admin())
  with check (faculty_id = public.current_faculty_id() or public.is_academic_admin());

-- ---------- marks: student own published; owning faculty; admin ----------
drop policy if exists marks_read on public.marks;
create policy marks_read on public.marks for select to authenticated
  using (public.is_academic_admin()
         or (student_id = public.current_student_id() and publication_status = 'published')
         or exists (select 1 from public.assessments a where a.id = assessment_id
                    and a.faculty_id = public.current_faculty_id()));
drop policy if exists marks_write on public.marks;
create policy marks_write on public.marks for all to authenticated
  using (public.is_academic_admin()
         or exists (select 1 from public.assessments a where a.id = assessment_id
                    and a.faculty_id = public.current_faculty_id()))
  with check (public.is_academic_admin()
         or exists (select 1 from public.assessments a where a.id = assessment_id
                    and a.faculty_id = public.current_faculty_id()));

-- ---------- assignments: faculty own + admin manage; section students read ----------
drop policy if exists assign_read on public.assignments;
create policy assign_read on public.assignments for select to authenticated
  using (faculty_id = public.current_faculty_id() or public.is_academic_admin()
         or public.has_academic_role(array['committee']::public.academic_role[])
         or exists (select 1 from public.student_enrolments e
                    where e.student_id = public.current_student_id() and e.section_id = assignments.section_id));
drop policy if exists assign_write on public.assignments;
create policy assign_write on public.assignments for all to authenticated
  using (faculty_id = public.current_faculty_id() or public.is_academic_admin())
  with check (faculty_id = public.current_faculty_id() or public.is_academic_admin());

-- ---------- announcements: read-all active; write committee/admin ----------
drop policy if exists ann_read on public.announcements;
create policy ann_read on public.announcements for select to authenticated using (public.is_active_user());
drop policy if exists ann_write on public.announcements;
create policy ann_write on public.announcements for all to authenticated
  using (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]))
  with check (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]));
drop policy if exists annt_read on public.announcement_targets;
create policy annt_read on public.announcement_targets for select to authenticated using (public.is_active_user());
drop policy if exists annt_write on public.announcement_targets;
create policy annt_write on public.announcement_targets for all to authenticated
  using (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]))
  with check (public.is_academic_admin() or public.has_academic_role(array['committee']::public.academic_role[]));

-- ---------- approvals: requester own; super_admin/master manage ----------
drop policy if exists appr_read on public.approvals;
create policy appr_read on public.approvals for select to authenticated
  using (requested_by = public.current_profile_id()
         or public.has_academic_role(array['super_admin','master_admin']::public.academic_role[]));
drop policy if exists appr_insert on public.approvals;
create policy appr_insert on public.approvals for insert to authenticated
  with check (requested_by = public.current_profile_id() or public.is_academic_admin());
drop policy if exists appr_decide on public.approvals;
create policy appr_decide on public.approvals for update to authenticated
  using (public.has_academic_role(array['super_admin','master_admin']::public.academic_role[]))
  with check (public.has_academic_role(array['super_admin','master_admin']::public.academic_role[]));

-- ---------- import/sync: admin only ----------
do $$
declare t text;
begin
  foreach t in array array['import_jobs','import_errors','data_sync_logs']
  loop
    execute format($f$
      drop policy if exists %1$s_all on public.%1$s;
      create policy %1$s_all on public.%1$s for all to authenticated
        using (public.is_academic_admin()) with check (public.is_academic_admin());
    $f$, t);
  end loop;
end $$;
