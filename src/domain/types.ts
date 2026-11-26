export type Program = 'BBA' | 'WOW';
export type Semester = 1 | 3 | 5;
/** 0 = Monday … 5 = Saturday */
export type DayIndex = 0 | 1 | 2 | 3 | 4 | 5;
export type Period = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type ShiftId = 1 | 2 | 3;

export type Area =
  | 'Finance'
  | 'Marketing'
  | 'HR & OB'
  | 'Analytics & Ops'
  | 'Economics'
  | 'Strategy'
  | 'Communication'
  | 'Law & Tax'
  | 'Careers';

export interface Faculty {
  id: string;
  name: string;
  short: string;
  designation: string;
  area: Area;
  type: 'Internal' | 'External';
  email: string;
  /** Inclusive window of periods the faculty member is available. */
  window: [Period, Period];
  weeklyTarget: number;
}

export type SubjectKind = 'Core' | 'OE' | 'ME';

export interface Subject {
  id: string;
  code: string;
  name: string;
  program: Program;
  semester: Semester;
  kind: SubjectKind;
  credits: number;
  /** Weekly contact hours the subject needs (one hour per period). */
  weeklyHours: number;
  area: Area;
  needsLab?: boolean;
}

export type RoomType = 'Classroom' | 'Lab' | 'Seminar Hall' | 'Auditorium' | 'Boardroom' | 'Meeting Room';

export interface Room {
  id: string;
  name: string;
  type: RoomType;
  capacity: number;
  floor: string;
  bookable: boolean;
}

export interface Section {
  id: string;
  program: Program;
  semester: Semester;
  name: string;
  strength: number;
  shift: ShiftId;
  homeRoomId: string;
}

export type SlotKind = 'Regular' | 'Combined' | 'OE' | 'ME' | 'Fixed' | 'Test';

export const FIXED_LABELS = [
  'Unit Test',
  'Master Talk',
  'CT/Orientation',
  'C2C',
  'LIB',
  'Training',
  'Workshop',
  'AI Toolkit',
  'Rock Your Profile',
] as const;
export type FixedLabel = (typeof FIXED_LABELS)[number];

export interface Slot {
  id: string;
  day: DayIndex;
  period: Period;
  sectionIds: string[];
  kind: SlotKind;
  subjectId?: string;
  facultyId?: string;
  roomId?: string;
  label?: FixedLabel;
  /** Parallel elective group id; slots in the same group run side by side by design. */
  group?: string;
}

export type Severity = 'critical' | 'warning' | 'advisory';

export type ClashType =
  | 'faculty-double'
  | 'room-double'
  | 'section-double'
  | 'faculty-leave'
  | 'capacity'
  | 'working-hours'
  | 'elective-overlap'
  | 'consecutive';

export interface Clash {
  id: string;
  type: ClashType;
  severity: Severity;
  slotIds: string[];
  day: DayIndex;
  period: Period;
  title: string;
  message: string;
}

export type LeaveType = 'Planned' | 'Unplanned';
export type LeaveStatus = 'Pending' | 'Approved' | 'Rejected';

export interface LeaveRequest {
  id: string;
  facultyId: string;
  type: LeaveType;
  from: string; // yyyy-MM-dd (IST calendar date)
  to: string;
  /** Optional subset of periods (unplanned partial-day leave). Empty = full day. */
  periods: Period[];
  reason: string;
  status: LeaveStatus;
  submittedAt: string; // ISO timestamp
  decidedAt?: string;
  decidedBy?: string;
  remark?: string;
}

export type ChangeType = 'swap' | 'substitution' | 'room-change' | 'cancellation' | 'extra-class' | 'workshop';

export interface DailyChange {
  id: string;
  date: string;
  type: ChangeType;
  status: 'draft' | 'published';
  scope: 'date' | 'master';
  slotId?: string;
  swapWithSlotId?: string;
  facultyId?: string;
  roomId?: string;
  sectionIds?: string[];
  period?: Period;
  subjectId?: string;
  label?: string;
  reason?: string;
  createdAt: string;
  createdBy: string;
  publicationId?: string;
}

export interface DailyPublication {
  id: string;
  date: string;
  publishedAt: string;
  publishedBy: string;
  changeIds: string[];
}

export interface Snapshot {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: string;
  slots: Slot[];
  summary: { critical: number; warning: number; advisory: number };
  override?: string;
}

export interface RoomBooking {
  id: string;
  roomId: string;
  date: string;
  period: Period;
  purpose: string;
  bookedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string; // ISO timestamp
  user: string;
  action: string;
  entity: string;
  before?: string;
  after?: string;
}

export interface Memory {
  id: string;
  text: string;
  kind: 'standing' | 'time-bound';
  createdAt: string;
  expires?: string; // yyyy-MM-dd
}

export type MailKind = 'leave-request' | 'leave-receipt' | 'leave-approved' | 'leave-rejected';

export interface MockMail {
  id: string;
  at: string;
  kind: MailKind;
  leaveId: string;
  from: string;
  to: string;
  toName: string;
  subject: string;
}

export type Role = 'committee' | 'faculty' | 'student';
