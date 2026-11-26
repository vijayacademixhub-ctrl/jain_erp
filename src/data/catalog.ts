import type { Area, Faculty, Period, Program, Room, Section, Semester, ShiftId, Subject, SubjectKind } from '../domain/types';

/* ------------------------------------------------------------------ */
/* Faculty — all names are fictional.                                  */
/* ------------------------------------------------------------------ */

type FacultyRow = [name: string, area: Area, type: 'I' | 'E', window?: [Period, Period]];

const FACULTY_ROWS: FacultyRow[] = [
  ['Dr. Meera Iyer', 'Finance', 'I'],
  ['Prof. Arjun Rao', 'Finance', 'I'],
  ['Dr. Kavitha Menon', 'Finance', 'I'],
  ['Prof. Rohan Deshpande', 'Finance', 'I'],
  ['Dr. Sunita Hegde', 'Finance', 'I'],
  ['Dr. Ananya Kulkarni', 'Finance', 'I'],
  ['Prof. Farah Siddiqui', 'Finance', 'I'],
  ['CA Nikhil Bhat', 'Finance', 'E', [5, 8]],
  ['Mr. Vikram Shetty', 'Finance', 'E', [1, 4]],
  ['Dr. Priya Raghavan', 'Marketing', 'I'],
  ['Prof. Karthik Narayan', 'Marketing', 'I'],
  ['Dr. Sneha Joshi', 'Marketing', 'I'],
  ['Prof. Aditya Malhotra', 'Marketing', 'I'],
  ['Dr. Neha Varma', 'Marketing', 'I'],
  ['Ms. Ritu Kapoor', 'Marketing', 'E', [3, 6]],
  ['Mr. Varun Mehta', 'Marketing', 'E', [5, 8]],
  ['Dr. Deepa Nair', 'HR & OB', 'I'],
  ['Prof. Suresh Gowda', 'HR & OB', 'I'],
  ['Dr. Anjali Reddy', 'HR & OB', 'I'],
  ['Prof. Manish Tiwari', 'HR & OB', 'I'],
  ['Dr. Pooja Srinivasan', 'HR & OB', 'I'],
  ['Dr. Ravi Kumar', 'HR & OB', 'I'],
  ['Prof. Asha Pillai', 'HR & OB', 'I'],
  ['Ms. Shalini Rao', 'HR & OB', 'E', [5, 8]],
  ['Dr. Harish Murthy', 'Analytics & Ops', 'I'],
  ['Prof. Divya Shankar', 'Analytics & Ops', 'I'],
  ['Dr. Imran Khan', 'Analytics & Ops', 'I'],
  ['Prof. Nandini Bose', 'Analytics & Ops', 'I'],
  ['Dr. Gautam Sinha', 'Analytics & Ops', 'I'],
  ['Dr. Swati Agarwal', 'Analytics & Ops', 'I'],
  ['Prof. Kiran Patil', 'Analytics & Ops', 'I'],
  ['Dr. Leela Fernandes', 'Analytics & Ops', 'I'],
  ['Mr. Rahul Jain', 'Analytics & Ops', 'E', [1, 4]],
  ['Ms. Tara Menon', 'Analytics & Ops', 'E', [3, 6]],
  ['Dr. Ashok Bhat', 'Economics', 'I'],
  ['Prof. Rekha Venkatesh', 'Economics', 'I'],
  ['Dr. Sanjay Mishra', 'Economics', 'I'],
  ['Prof. Lata Krishnan', 'Economics', 'I'],
  ['Mr. Abhishek Dutta', 'Economics', 'E', [3, 6]],
  ['Dr. Ramesh Iyengar', 'Strategy', 'I'],
  ['Prof. Shweta Saxena', 'Strategy', 'I'],
  ['Dr. Naveen Prakash', 'Strategy', 'I'],
  ['Prof. Tanvi Desai', 'Strategy', 'I'],
  ['Dr. Mohan Raj', 'Strategy', 'I'],
  ['Dr. Geeta Sharma', 'Strategy', 'I'],
  ['Prof. Vinod Chandra', 'Strategy', 'I'],
  ['Mr. Arvind Subramanian', 'Strategy', 'E', [5, 8]],
  ['Dr. Sarah Thomas', 'Communication', 'I'],
  ["Prof. Joseph D'Souza", 'Communication', 'I'],
  ['Dr. Radhika Sen', 'Communication', 'I'],
  ['Ms. Nisha George', 'Communication', 'E', [1, 4]],
  ['Dr. Usha Rani', 'Law & Tax', 'I'],
  ['Adv. Prakash Hegde', 'Law & Tax', 'E', [5, 8]],
  ['CA Sneha Pai', 'Law & Tax', 'E', [3, 8]],
  ['Ms. Megha Kulkarni', 'Careers', 'I'],
  ['Mr. Vivek Anand', 'Careers', 'I'],
  ['Dr. Fatima Sheikh', 'Careers', 'I'],
  ['Mr. Rajat Arora', 'Careers', 'E', [1, 8]],
  ['Mr. Siddharth Rao', 'Careers', 'E', [1, 8]],
  ['Ms. Kavya Ramesh', 'Careers', 'E', [3, 8]],
];

const DESIGNATIONS = ['Professor', 'Associate Professor', 'Assistant Professor', 'Assistant Professor'];

function initials(name: string): string {
  const parts = name.replace(/^(Dr|Prof|Mr|Ms|CA|Adv)\.?\s+/, '').split(/\s+/);
  return parts.map((p) => p[0]).join('').toUpperCase();
}

function slugEmail(name: string): string {
  const parts = name
    .replace(/^(Dr|Prof|Mr|Ms|CA|Adv)\.?\s+/, '')
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .split(/\s+/);
  return `${parts.join('.')}@cms.example`;
}

export function buildFaculty(): Faculty[] {
  const used = new Map<string, number>();
  return FACULTY_ROWS.map(([name, area, type, window], i) => {
    let short = initials(name);
    const n = used.get(short) ?? 0;
    used.set(short, n + 1);
    if (n > 0) short = `${short}${n + 1}`;
    return {
      id: `f${String(i + 1).padStart(2, '0')}`,
      name,
      short,
      designation: type === 'E' ? 'Visiting Faculty' : DESIGNATIONS[i % DESIGNATIONS.length],
      area,
      type: type === 'E' ? 'External' : 'Internal',
      email: slugEmail(name),
      window: window ?? [1, 8],
      weeklyTarget: 0, // filled in by the seed once loads are known
    };
  });
}

/* ------------------------------------------------------------------ */
/* Subjects (40)                                                        */
/* ------------------------------------------------------------------ */

type SubjectRow = [code: string, name: string, program: Program, sem: Semester, kind: SubjectKind, hours: number, area: Area, lab?: boolean];

const SUBJECT_ROWS: SubjectRow[] = [
  ['BBA101', 'Principles of Management', 'BBA', 1, 'Core', 4, 'Strategy'],
  ['BBA102', 'Financial Accounting', 'BBA', 1, 'Core', 4, 'Finance'],
  ['BBA103', 'Business Economics', 'BBA', 1, 'Core', 4, 'Economics'],
  ['BBA104', 'Business Communication', 'BBA', 1, 'Core', 3, 'Communication'],
  ['BBA105', 'Business Mathematics', 'BBA', 1, 'Core', 3, 'Analytics & Ops'],
  ['BBA106', 'Digital Fluency', 'BBA', 1, 'Core', 2, 'Analytics & Ops', true],
  ['BBA301', 'Corporate Finance', 'BBA', 3, 'Core', 4, 'Finance'],
  ['BBA302', 'Marketing Management', 'BBA', 3, 'Core', 4, 'Marketing'],
  ['BBA303', 'Human Resource Management', 'BBA', 3, 'Core', 4, 'HR & OB'],
  ['BBA304', 'Business Statistics', 'BBA', 3, 'Core', 3, 'Analytics & Ops'],
  ['BBA305', 'Organisational Behaviour', 'BBA', 3, 'Core', 3, 'HR & OB'],
  ['BBA501', 'Strategic Management', 'BBA', 5, 'Core', 4, 'Strategy'],
  ['BBA502', 'Business Analytics', 'BBA', 5, 'Core', 3, 'Analytics & Ops', true],
  ['BBA503', 'Income Tax', 'BBA', 5, 'Core', 3, 'Law & Tax'],
  ['BBA504', 'Entrepreneurship Development', 'BBA', 5, 'Core', 3, 'Strategy'],
  ['IR', 'Industrial Relations', 'BBA', 5, 'Core', 3, 'HR & OB'],
  ['OE01', 'Digital Marketing', 'BBA', 3, 'OE', 2, 'Marketing'],
  ['OE02', 'Design Thinking', 'BBA', 3, 'OE', 2, 'Strategy'],
  ['OE03', 'Behavioural Finance', 'BBA', 3, 'OE', 2, 'Finance'],
  ['OE04', 'Psychology at Work', 'BBA', 3, 'OE', 2, 'HR & OB'],
  ['OE05', 'Sports Management', 'BBA', 5, 'OE', 2, 'Marketing'],
  ['OE06', 'Sustainability & ESG', 'BBA', 5, 'OE', 2, 'Economics'],
  ['OE07', 'Business Law in Practice', 'BBA', 5, 'OE', 2, 'Law & Tax'],
  ['OE08', 'Data Storytelling', 'BBA', 5, 'OE', 2, 'Analytics & Ops'],
  ['ME01', 'Investment Banking', 'BBA', 5, 'ME', 2, 'Finance'],
  ['ME02', 'Brand Management', 'BBA', 5, 'ME', 2, 'Marketing'],
  ['ME03', 'Talent Acquisition', 'BBA', 5, 'ME', 2, 'HR & OB'],
  ['ME04', 'Supply Chain Analytics', 'BBA', 5, 'ME', 2, 'Analytics & Ops'],
  ['WOW101', 'Foundations of Business', 'WOW', 1, 'Core', 4, 'Strategy'],
  ['WOW102', 'Workplace Communication', 'WOW', 1, 'Core', 4, 'Communication'],
  ['WOW103', 'Quantitative Aptitude', 'WOW', 1, 'Core', 4, 'Analytics & Ops'],
  ['WOW104', 'Accounting for Managers', 'WOW', 1, 'Core', 4, 'Finance'],
  ['WOW301', 'Consumer Behaviour', 'WOW', 3, 'Core', 4, 'Marketing'],
  ['WOW302', 'Operations Management', 'WOW', 3, 'Core', 4, 'Analytics & Ops'],
  ['WOW303', 'Financial Management', 'WOW', 3, 'Core', 4, 'Finance'],
  ['WOW304', 'Business Research Methods', 'WOW', 3, 'Core', 3, 'Analytics & Ops'],
  ['WOW501', 'Project Management', 'WOW', 5, 'Core', 4, 'Analytics & Ops'],
  ['WOW502', 'International Business', 'WOW', 5, 'Core', 4, 'Economics'],
  ['WOW503', 'Leadership Lab', 'WOW', 5, 'Core', 3, 'HR & OB'],
  ['WOW504', 'Retail & E-commerce', 'WOW', 5, 'Core', 4, 'Marketing'],
];

export function buildSubjects(): Subject[] {
  return SUBJECT_ROWS.map(([code, name, program, semester, kind, hours, area, lab]) => ({
    id: `s-${code.toLowerCase()}`,
    code,
    name,
    program,
    semester,
    kind,
    credits: hours,
    weeklyHours: hours,
    area,
    needsLab: lab ?? false,
  }));
}

/* ------------------------------------------------------------------ */
/* Rooms (20)                                                           */
/* ------------------------------------------------------------------ */

export function buildRooms(): Room[] {
  const classrooms: [string, number][] = [
    ['201', 66], ['202', 66], ['203', 70], ['204', 70], ['205', 72], ['206', 60],
    ['301', 66], ['302', 70], ['303', 70], ['304', 72], ['305', 72], ['306', 60], ['401', 75],
  ];
  const rooms: Room[] = classrooms.map(([name, capacity]) => ({
    id: `r${name}`,
    name: `Room ${name}`,
    type: 'Classroom',
    capacity,
    floor: `Floor ${name[0]}`,
    bookable: false,
  }));
  rooms.push(
    { id: 'rlab1', name: 'Computer Lab 1', type: 'Lab', capacity: 40, floor: 'Floor 1', bookable: true },
    { id: 'rlab2', name: 'Computer Lab 2', type: 'Lab', capacity: 66, floor: 'Floor 1', bookable: true },
    { id: 'rsem', name: 'Seminar Hall', type: 'Seminar Hall', capacity: 180, floor: 'Ground', bookable: true },
    { id: 'raud', name: 'Auditorium', type: 'Auditorium', capacity: 400, floor: 'Ground', bookable: false },
    { id: 'rbrd', name: 'Boardroom', type: 'Boardroom', capacity: 18, floor: 'Floor 4', bookable: true },
    { id: 'rmr1', name: 'Meeting Room 1', type: 'Meeting Room', capacity: 8, floor: 'Floor 4', bookable: true },
    { id: 'rmr2', name: 'Meeting Room 2', type: 'Meeting Room', capacity: 12, floor: 'Floor 4', bookable: true },
  );
  return rooms;
}

/* ------------------------------------------------------------------ */
/* Sections (18)                                                        */
/* ------------------------------------------------------------------ */

type SectionRow = [program: Program, sem: Semester, name: string, strength: number, shift: ShiftId, home: string];

const SECTION_ROWS: SectionRow[] = [
  ['BBA', 1, 'A', 62, 1, 'r201'],
  ['BBA', 1, 'B', 60, 1, 'r202'],
  ['BBA', 1, 'C', 64, 1, 'r203'],
  ['BBA', 1, 'D', 58, 1, 'r204'],
  ['BBA', 3, 'A', 64, 2, 'r301'],
  ['BBA', 3, 'B', 61, 2, 'r302'],
  ['BBA', 3, 'C', 66, 2, 'r303'],
  ['BBA', 3, 'D', 63, 2, 'r304'],
  ['BBA', 5, 'A', 64, 3, 'r201'],
  ['BBA', 5, 'B', 62, 3, 'r202'],
  ['BBA', 5, 'C', 65, 3, 'r203'],
  ['BBA', 5, 'D', 68, 3, 'r204'],
  ['WOW', 1, 'A', 56, 2, 'r306'],
  ['WOW', 1, 'B', 54, 2, 'r206'],
  ['WOW', 3, 'A', 58, 3, 'r205'],
  ['WOW', 3, 'B', 55, 3, 'r305'],
  ['WOW', 5, 'A', 57, 1, 'r205'],
  ['WOW', 5, 'B', 59, 1, 'r305'],
];

export function buildSections(): Section[] {
  return SECTION_ROWS.map(([program, semester, name, strength, shift, homeRoomId]) => ({
    id: `${program.toLowerCase()}${semester}${name.toLowerCase()}`,
    program,
    semester,
    name,
    strength,
    shift,
    homeRoomId,
  }));
}
