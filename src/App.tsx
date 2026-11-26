import { Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';
import { RootLayout } from './components/layout/RootLayout';
import { PageSkeleton } from './components/layout/PageSkeleton';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { Pages } from './routes';

/** Route tree, shared by the browser app and the build-time pre-render of the landing page. */
export function AppRoutes() {
  return (
    <Routes>
      <Route
        path="calculator"
        element={
          <Suspense fallback={<PageSkeleton />}>
            <Pages.Calculator />
          </Suspense>
        }
      />
      <Route element={<RootLayout />}>
        <Route index element={<Landing />} />
        <Route path="committee" element={<Pages.CommitteeLayout />}>
          <Route index element={<Pages.Dashboard />} />
          <Route path="builder" element={<Pages.Builder />} />
          <Route path="daily" element={<Pages.Daily />} />
          <Route path="leave" element={<Pages.LeaveApprovals />} />
          <Route path="rooms" element={<Pages.Rooms />} />
          <Route path="workload" element={<Pages.Workload />} />
          <Route path="assistant" element={<Pages.Assistant />} />
          <Route path="upload" element={<Pages.Upload />} />
          <Route path="audit" element={<Pages.Audit />} />
          <Route path="backup" element={<Pages.Backup />} />
        </Route>
        <Route path="faculty" element={<Pages.FacultyLayout />}>
          <Route index element={<Pages.MyTimetable />} />
          <Route path="leave" element={<Pages.ApplyLeave />} />
          <Route path="history" element={<Pages.LeaveHistory />} />
        </Route>
        <Route path="student" element={<Pages.StudentView />} />
        <Route path="perf" element={<Pages.Perf />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
