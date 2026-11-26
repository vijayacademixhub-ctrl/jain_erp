import { lazy } from 'react';
import { idle } from './lib/util';

/** Route chunks. Each is its own file so the landing page ships almost nothing. */
export const chunks = {
  committeeLayout: () => import('./pages/committee/CommitteeLayout'),
  dashboard: () => import('./pages/committee/Dashboard'),
  builder: () => import('./pages/committee/builder/Builder'),
  daily: () => import('./pages/committee/Daily'),
  leave: () => import('./pages/committee/LeaveApprovals'),
  rooms: () => import('./pages/committee/Rooms'),
  workload: () => import('./pages/committee/Workload'),
  assistant: () => import('./pages/committee/Assistant'),
  upload: () => import('./pages/committee/Upload'),
  audit: () => import('./pages/committee/Audit'),
  backup: () => import('./pages/committee/Backup'),
  calculator: () => import('./pages/Calculator'),
  facultyLayout: () => import('./pages/faculty/FacultyLayout'),
  myTimetable: () => import('./pages/faculty/MyTimetable'),
  applyLeave: () => import('./pages/faculty/ApplyLeave'),
  leaveHistory: () => import('./pages/faculty/LeaveHistory'),
  student: () => import('./pages/student/StudentView'),
  perf: () => import('./pages/Perf'),
  palette: () => import('./components/layout/CommandPalette'),
};

export const Pages = {
  CommitteeLayout: lazy(chunks.committeeLayout),
  Dashboard: lazy(chunks.dashboard),
  Builder: lazy(chunks.builder),
  Daily: lazy(chunks.daily),
  LeaveApprovals: lazy(chunks.leave),
  Rooms: lazy(chunks.rooms),
  Workload: lazy(chunks.workload),
  Assistant: lazy(chunks.assistant),
  Upload: lazy(chunks.upload),
  Audit: lazy(chunks.audit),
  Backup: lazy(chunks.backup),
  Calculator: lazy(chunks.calculator),
  FacultyLayout: lazy(chunks.facultyLayout),
  MyTimetable: lazy(chunks.myTimetable),
  ApplyLeave: lazy(chunks.applyLeave),
  LeaveHistory: lazy(chunks.leaveHistory),
  StudentView: lazy(chunks.student),
  Perf: lazy(chunks.perf),
  CommandPalette: lazy(chunks.palette),
};

const byPath: Record<string, (() => Promise<unknown>)[]> = {
  '/committee': [chunks.committeeLayout, chunks.dashboard],
  '/committee/builder': [chunks.committeeLayout, chunks.builder],
  '/committee/daily': [chunks.committeeLayout, chunks.daily],
  '/committee/leave': [chunks.committeeLayout, chunks.leave],
  '/committee/rooms': [chunks.committeeLayout, chunks.rooms],
  '/committee/workload': [chunks.committeeLayout, chunks.workload],
  '/committee/assistant': [chunks.committeeLayout, chunks.assistant],
  '/committee/upload': [chunks.committeeLayout, chunks.upload],
  '/committee/audit': [chunks.committeeLayout, chunks.audit],
  '/committee/backup': [chunks.committeeLayout, chunks.backup],
  '/calculator': [chunks.calculator],
  '/faculty': [chunks.facultyLayout, chunks.myTimetable],
  '/faculty/leave': [chunks.facultyLayout, chunks.applyLeave],
  '/faculty/history': [chunks.facultyLayout, chunks.leaveHistory],
  '/student': [chunks.student],
};

const done = new Set<string>();

/** Starts downloading a route's code (on hover, focus or idle). Safe to call repeatedly. */
export function prefetch(path: string): void {
  const clean = path.split('?')[0].replace(/\/$/, '') || '/';
  if (done.has(clean)) return;
  const loaders = byPath[clean];
  if (!loaders) return;
  done.add(clean);
  for (const l of loaders) void l().catch(() => done.delete(clean));
}

/** Once the current screen has settled, quietly warm the most likely next screens. */
export function prefetchOnIdle(paths: string[]): void {
  setTimeout(() => idle(() => paths.forEach(prefetch), 2500), 3500);
}
