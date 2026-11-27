import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, primaryRole } from './lib/auth';
import Login from './pages/Login';
import StudentHome from './pages/student/StudentHome';
import StudentAttendance from './pages/student/StudentAttendance';
import StudentMarks from './pages/student/StudentMarks';
import StudentNotifications from './pages/student/StudentNotifications';
import FacultyHome from './pages/faculty/FacultyHome';
import FacultyAttendance from './pages/faculty/FacultyAttendance';
import FacultyAssessments from './pages/faculty/FacultyAssessments';
import FacultyRecords from './pages/faculty/FacultyRecords';
import FacultyLeave from './pages/faculty/FacultyLeave';
import CommitteeHome from './pages/committee/CommitteeHome';
import DailyChanges from './pages/committee/DailyChanges';
import RecordVerification from './pages/committee/RecordVerification';
import IQACReports from './pages/committee/IQACReports';
import LeaveApprovals from './pages/committee/LeaveApprovals';
import TimetablePublish from './pages/committee/TimetablePublish';
import AdminHome from './pages/admin/AdminHome';
import Analytics from './pages/admin/Analytics';
import TimetableApprovals from './pages/admin/TimetableApprovals';
import AuditTrail from './pages/admin/AuditTrail';

function Splash({ text }: { text: string }) {
  return <div className="min-h-full flex items-center justify-center text-sm" style={{ color: 'var(--muted)' }}>{text}</div>;
}

export default function App() {
  const { session, roles, loading } = useAuth();
  if (loading) return <Splash text="Loading…" />;
  if (!session) return <Routes><Route path="*" element={<Login />} /></Routes>;

  const role = primaryRole(roles);
  const landing =
    role === 'student' ? '/student'
    : role === 'faculty' ? '/faculty'
    : role === 'committee' || role === 'iqac' ? '/committee'
    : role ? '/admin'            // admin / super_admin / master_admin
    : '/no-access';

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Navigate to={landing} replace />} />
      <Route path="/student" element={<StudentHome />} />
      <Route path="/student/attendance" element={<StudentAttendance />} />
      <Route path="/student/marks" element={<StudentMarks />} />
      <Route path="/student/notifications" element={<StudentNotifications />} />
      <Route path="/faculty" element={<FacultyHome />} />
      <Route path="/faculty/attendance" element={<FacultyAttendance />} />
      <Route path="/faculty/assessments" element={<FacultyAssessments />} />
      <Route path="/faculty/records" element={<FacultyRecords />} />
      <Route path="/faculty/leave" element={<FacultyLeave />} />
      <Route path="/committee" element={<CommitteeHome />} />
      <Route path="/committee/publish" element={<TimetablePublish />} />
      <Route path="/committee/daily" element={<DailyChanges />} />
      <Route path="/committee/verify" element={<RecordVerification />} />
      <Route path="/committee/reports" element={<IQACReports />} />
      <Route path="/committee/leave" element={<LeaveApprovals />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/admin/timetable-approvals" element={<TimetableApprovals />} />
      <Route path="/admin/leave" element={<LeaveApprovals area="admin" />} />
      <Route path="/admin/audit" element={<AuditTrail />} />
      <Route path="/admin/analytics" element={<Analytics />} />
      <Route path="/no-access" element={<Splash text="No role is assigned to this account yet. Contact the Academic Office." />} />
      <Route path="*" element={<Navigate to={landing} replace />} />
    </Routes>
  );
}
