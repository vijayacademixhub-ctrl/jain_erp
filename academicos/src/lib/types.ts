export type AcademicRole =
  | 'master_admin' | 'super_admin' | 'admin' | 'committee' | 'iqac' | 'faculty' | 'student';

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string;
}

export interface TimetableRow {
  id: string;
  day_of_week: string;
  period_number: number;
  start_time: string;
  end_time: string;
  subject_name: string | null;
  course_code: string | null;
  faculty_code: string | null;
  faculty_name: string | null;
  room_number: string | null;
  sections: string[];
  semester_number: number;
}
