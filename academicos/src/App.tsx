import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth, primaryRole } from './lib/auth';
import Login from './pages/Login';
import StudentHome from './pages/student/StudentHome';
import FacultyHome from './pages/faculty/FacultyHome';
import CommitteeHome from './pages/committee/CommitteeHome';
import AdminHome from './pages/admin/AdminHome';

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
      <Route path="/faculty" element={<FacultyHome />} />
      <Route path="/committee" element={<CommitteeHome />} />
      <Route path="/admin" element={<AdminHome />} />
      <Route path="/no-access" element={<Splash text="No role is assigned to this account yet. Contact the Academic Office." />} />
      <Route path="*" element={<Navigate to={landing} replace />} />
    </Routes>
  );
}
