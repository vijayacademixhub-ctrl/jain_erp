import { create } from 'zustand';
import type { Program, Role, Semester } from '../domain/types';

const KEY = 'ttp:ui:v1';

export interface StudentPrefs {
  program: Program;
  semester: Semester;
  sectionId: string;
  oe: string | null;
  me: string | null;
}

export interface BuilderPrefs {
  program: Program;
  semester: Semester;
  sectionId: string;
  allPeriods: boolean;
}

interface UiPersisted {
  theme: 'light' | 'dark';
  role: Role;
  muted: boolean;
  facultyId: string;
  student: StudentPrefs | null;
  builder: BuilderPrefs;
}

interface UiState extends UiPersisted {
  paletteOpen: boolean;
  setTheme: (t: 'light' | 'dark') => void;
  toggleTheme: () => void;
  setRole: (r: Role) => void;
  setMuted: (m: boolean) => void;
  setFacultyId: (id: string) => void;
  setStudent: (s: StudentPrefs | null) => void;
  setBuilder: (b: Partial<BuilderPrefs>) => void;
  setPaletteOpen: (o: boolean) => void;
}

function initialTheme(): 'light' | 'dark' {
  if (typeof document !== 'undefined') {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') return t;
  }
  return 'light';
}

function read(): UiPersisted {
  const fallback: UiPersisted = {
    theme: initialTheme(),
    role: 'committee',
    muted: true, // off by default for shared workspaces
    facultyId: 'f01',
    student: null,
    builder: { program: 'BBA', semester: 1, sectionId: 'bba1a', allPeriods: false },
  };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<UiPersisted>;
    return { ...fallback, ...p, theme: initialTheme(), builder: { ...fallback.builder, ...p.builder } };
  } catch {
    return fallback;
  }
}

function applyTheme(t: 'light' | 'dark') {
  document.documentElement.setAttribute('data-theme', t);
}

export const useUi = create<UiState>()((set, get) => ({
  ...read(),
  paletteOpen: false,
  setTheme(theme) {
    applyTheme(theme);
    set({ theme });
  },
  toggleTheme() {
    get().setTheme(get().theme === 'dark' ? 'light' : 'dark');
  },
  setRole: (role) => set({ role }),
  setMuted: (muted) => set({ muted }),
  setFacultyId: (facultyId) => set({ facultyId }),
  setStudent: (student) => set({ student }),
  setBuilder: (b) => set({ builder: { ...get().builder, ...b } }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
}));

useUi.subscribe((s, prev) => {
  if (s.theme === prev.theme && s.role === prev.role && s.muted === prev.muted && s.facultyId === prev.facultyId && s.student === prev.student && s.builder === prev.builder) return;
  try {
    const data: UiPersisted = { theme: s.theme, role: s.role, muted: s.muted, facultyId: s.facultyId, student: s.student, builder: s.builder };
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* storage unavailable */
  }
});
