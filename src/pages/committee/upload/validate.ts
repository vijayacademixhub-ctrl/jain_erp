import { DAY_SHORT } from '../../../domain/constants';
import type { Faculty, Room, Section, Subject } from '../../../domain/types';
import { hashString } from '../../../data/rng';
import { parseCSV, toCSV } from '../../../lib/util';

export interface Issue {
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface Report {
  fileName: string;
  kind: 'Master timetable' | 'Faculty' | 'Subjects' | 'Rooms';
  simulated: boolean;
  rows: number;
  valid: number;
  issues: Issue[];
  header: string[];
  preview: { cells: string[]; ok: boolean }[];
}

export interface RefData {
  faculty: Faculty[];
  subjects: Subject[];
  rooms: Room[];
  sections: Section[];
}

export const roomCode = (r: Room) => r.id.slice(1).toUpperCase();

const MASTER_HEADER = ['Program', 'Semester', 'Section', 'Day', 'Period', 'SubjectCode', 'FacultyCode', 'RoomCode', 'Kind'];
const FACULTY_HEADER = ['FacultyCode', 'Name', 'Area', 'Type', 'Email', 'AvailableFrom', 'AvailableTo', 'WeeklyTarget'];
const SUBJECT_HEADER = ['SubjectCode', 'Name', 'Program', 'Semester', 'Kind', 'WeeklyHours', 'Area'];
const ROOM_HEADER = ['RoomCode', 'Name', 'Type', 'Capacity', 'Floor', 'Bookable'];

export function templates(ref: RefData): { file: string; label: string; csv: string }[] {
  const sec = ref.sections.slice(0, 2);
  const sub = ref.subjects.filter((s) => s.program === 'BBA' && s.semester === 1).slice(0, 3);
  return [
    {
      file: 'master_timetable_template.csv',
      label: 'Master timetable',
      csv: toCSV([
        MASTER_HEADER,
        [sec[0].program, sec[0].semester, sec[0].name, 'Mon', 1, sub[0].code, ref.faculty[0].short, '201', 'Regular'],
        [sec[0].program, sec[0].semester, sec[0].name, 'Mon', 2, sub[1].code, ref.faculty[9].short, '201', 'Regular'],
        [sec[1].program, sec[1].semester, sec[1].name, 'Tue', 3, sub[2].code, ref.faculty[34].short, '202', 'Regular'],
      ]),
    },
    {
      file: 'faculty_template.csv',
      label: 'Faculty',
      csv: toCSV([FACULTY_HEADER, ...ref.faculty.slice(0, 3).map((f) => [f.short, f.name, f.area, f.type, f.email, f.window[0], f.window[1], f.weeklyTarget])]),
    },
    {
      file: 'subjects_template.csv',
      label: 'Subjects',
      csv: toCSV([SUBJECT_HEADER, ...ref.subjects.slice(0, 3).map((s) => [s.code, s.name, s.program, s.semester, s.kind, s.weeklyHours, s.area])]),
    },
    {
      file: 'rooms_template.csv',
      label: 'Rooms',
      csv: toCSV([ROOM_HEADER, ...ref.rooms.slice(0, 3).map((r) => [roomCode(r), r.name, r.type, r.capacity, r.floor, r.bookable ? 'Yes' : 'No'])]),
    },
  ];
}

/** A master-timetable sample with deliberate mistakes, for the "Try a sample file" button. */
export function sampleWithErrors(ref: RefData): string {
  const rows: (string | number)[][] = [MASTER_HEADER];
  const bba1 = ref.sections.filter((s) => s.program === 'BBA' && s.semester === 1);
  const subs = ref.subjects.filter((s) => s.program === 'BBA' && s.semester === 1);
  const fac = ref.faculty;
  let i = 0;
  for (const s of bba1) {
    for (let d = 0; d < 3; d++) {
      for (let p = 1; p <= 4; p++) {
        const sub = subs[(i + p) % subs.length];
        rows.push([s.program, s.semester, s.name, DAY_SHORT[d], p, sub.code, fac[(i * 3 + p) % 48].short, s.homeRoomId.slice(1), 'Regular']);
        i++;
      }
    }
  }
  // Deliberate problems:
  rows[5][5] = ''; // missing subject code
  rows[9][6] = 'ZZ'; // unknown faculty code
  rows[14][7] = '909'; // unknown room
  rows[18][4] = 9; // period out of range
  rows.push([...rows[3]]); // exact duplicate slot
  rows.push([...rows[22]]);
  rows[30][5] = 'BBA199'; // unknown subject
  rows[34][3] = 'Sun'; // Sunday
  return toCSV(rows);
}

function detectKind(header: string[]): Report['kind'] | null {
  const h = header.map((x) => x.trim().toLowerCase());
  if (h.includes('period') && h.includes('subjectcode')) return 'Master timetable';
  if (h.includes('facultycode') && h.includes('name') && !h.includes('period')) return 'Faculty';
  if (h.includes('subjectcode') && h.includes('weeklyhours')) return 'Subjects';
  if (h.includes('roomcode') && h.includes('capacity')) return 'Rooms';
  return null;
}

export function validateCsv(fileName: string, text: string, ref: RefData): Report | { error: string } {
  const rows = parseCSV(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  if (rows.length < 2) return { error: 'The file has no data rows. Use one of the templates.' };
  const header = rows[0].map((h) => h.trim());
  const kind = detectKind(header);
  if (!kind) return { error: `Unrecognised columns: ${header.slice(0, 5).join(', ')}. Use one of the templates so the columns match.` };
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const issues: Issue[] = [];
  const bad = new Set<number>();
  const add = (row: number, column: string, message: string, severity: Issue['severity'] = 'error') => {
    issues.push({ row, column, message, severity });
    if (severity === 'error') bad.add(row);
  };
  const data = rows.slice(1);
  const facultyCodes = new Set(ref.faculty.map((f) => f.short.toUpperCase()));
  const subjectCodes = new Set(ref.subjects.map((s) => s.code.toUpperCase()));
  const roomCodes = new Set(ref.rooms.map(roomCode));

  if (kind === 'Master timetable') {
    const seen = new Map<string, number>();
    const facSeen = new Map<string, number>();
    data.forEach((r, i) => {
      const n = i + 2;
      const get = (c: string) => (r[col(c)] ?? '').trim();
      const program = get('Program').toUpperCase();
      const sem = Number(get('Semester'));
      const secName = get('Section').toUpperCase();
      const day = get('Day');
      const period = Number(get('Period'));
      const subject = get('SubjectCode').toUpperCase();
      const facultyCode = get('FacultyCode').toUpperCase();
      const room = get('RoomCode').toUpperCase();
      if (program !== 'BBA' && program !== 'WOW') add(n, 'Program', `Unknown programme "${get('Program')}". Use BBA or WOW.`);
      if (![1, 3, 5].includes(sem)) add(n, 'Semester', `Semester must be 1, 3 or 5 (got "${get('Semester')}").`);
      if (!ref.sections.some((s) => s.program === program && s.semester === sem && s.name === secName)) add(n, 'Section', `No section ${program} Sem ${sem} · ${secName}.`);
      const di = DAY_SHORT.findIndex((d) => d.toLowerCase() === day.slice(0, 3).toLowerCase());
      if (di < 0) add(n, 'Day', `"${day}" is not a teaching day (Mon to Sat).`);
      if (!(period >= 1 && period <= 8)) add(n, 'Period', `Period must be 1 to 8 (got "${get('Period')}").`);
      if (!subject) add(n, 'SubjectCode', 'Missing subject code.');
      else if (!subjectCodes.has(subject)) add(n, 'SubjectCode', `Unknown subject code "${subject}".`);
      if (!facultyCode) add(n, 'FacultyCode', 'Missing faculty code.');
      else if (!facultyCodes.has(facultyCode)) add(n, 'FacultyCode', `Unknown faculty code "${facultyCode}".`);
      if (room && !roomCodes.has(room)) add(n, 'RoomCode', `Unknown room "${room}".`);
      if (!room) add(n, 'RoomCode', 'No room given; the section home room will be used.', 'warning');
      const key = `${program}|${sem}|${secName}|${di}|${period}`;
      if (seen.has(key)) add(n, 'Section', `Duplicate slot: same section, day and period as row ${seen.get(key)}.`);
      else seen.set(key, n);
      const fk = `${facultyCode}|${di}|${period}`;
      if (facultyCode && facSeen.has(fk) && seen.get(key) === n) add(n, 'FacultyCode', `Faculty ${facultyCode} already teaches at this time (row ${facSeen.get(fk)}).`, 'warning');
      else if (facultyCode) facSeen.set(fk, n);
    });
  } else {
    const keyCol = kind === 'Faculty' ? 'FacultyCode' : kind === 'Subjects' ? 'SubjectCode' : 'RoomCode';
    const seen = new Map<string, number>();
    data.forEach((r, i) => {
      const n = i + 2;
      const key = (r[col(keyCol)] ?? '').trim().toUpperCase();
      if (!key) add(n, keyCol, `Missing ${keyCol}.`);
      else if (seen.has(key)) add(n, keyCol, `Duplicate ${keyCol} "${key}" (also on row ${seen.get(key)}).`);
      else seen.set(key, n);
      header.forEach((h, ci) => {
        if (!(r[ci] ?? '').trim() && h !== keyCol) add(n, h, `Empty ${h}.`, 'warning');
      });
    });
  }

  return {
    fileName,
    kind,
    simulated: false,
    rows: data.length,
    valid: data.length - bad.size,
    issues: issues.sort((a, b) => a.row - b.row),
    header,
    preview: data.slice(0, 14).map((cells, i) => ({ cells, ok: !bad.has(i + 2) })),
  };
}

/** Excel files are not parsed in the demo; this builds a believable, deterministic report. */
export function simulateExcel(fileName: string, size: number, ref: RefData): Report {
  const h = hashString(`${fileName}|${size}`);
  const rows = 180 + (h % 140);
  const sample = parseCSV(sampleWithErrors(ref));
  const header = sample[0];
  const issues: Issue[] = [
    { row: 12 + (h % 20), column: 'SubjectCode', message: 'Missing subject code.', severity: 'error' },
    { row: 40 + (h % 30), column: 'FacultyCode', message: 'Unknown faculty code "XY".', severity: 'error' },
    { row: 77 + (h % 25), column: 'SubjectCode', message: 'Unknown subject code "BBA199".', severity: 'error' },
    { row: 95 + (h % 15), column: 'Section', message: 'Duplicate slot: same section, day and period as row 94.', severity: 'error' },
    { row: 131 + (h % 10), column: 'Section', message: 'Duplicate slot: same section, day and period as row 18.', severity: 'error' },
    { row: 150 + (h % 9), column: 'RoomCode', message: 'No room given; the section home room will be used.', severity: 'warning' },
  ];
  return {
    fileName,
    kind: 'Master timetable',
    simulated: true,
    rows,
    valid: rows - 5,
    issues,
    header,
    preview: sample.slice(1, 15).map((cells, i) => ({ cells, ok: ![3, 7].includes(i) })),
  };
}
