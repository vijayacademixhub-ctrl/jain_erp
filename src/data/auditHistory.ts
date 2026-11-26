import { APPROVERS, COMMITTEE_USER, DAY_SHORT } from '../domain/constants';
import type { AuditEntry, Faculty, Room, Section, Subject } from '../domain/types';
import { addDaysISO, dayIndexOf, fmtDate, istTimestamp } from '../lib/dates';
import { createRng, pick, type Rng } from './rng';

interface Refs {
  faculty: Faculty[];
  rooms: Room[];
  sections: Section[];
  subjects: Subject[];
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Deterministic history of committee activity over the past ~6 weeks, so the
 * audit trail looks lived-in. Regenerated on load rather than stored.
 */
export function generateAuditHistory(today: string, refs: Refs, count = 1500): AuditEntry[] {
  const rng = createRng(9091);
  const people = [...APPROVERS.map((a) => a.name), COMMITTEE_USER, COMMITTEE_USER];
  const out: AuditEntry[] = [];
  const sec = () => pick(refs.sections, rng);
  const secLabel = (s: Section) => `${s.program}${s.semester}${s.name}`;
  const sub = (s: Section) => pick(refs.subjects.filter((x) => x.program === s.program && x.semester === s.semester), rng) ?? pick(refs.subjects, rng);
  const fac = () => pick(refs.faculty, rng);
  const room = () => pick(refs.rooms, rng);
  const period = () => 1 + Math.floor(rng() * 8);
  const day = () => pick(DAY_SHORT, rng);

  const templates: [number, (date: string) => Omit<AuditEntry, 'id' | 'at'>][] = [
    [
      14,
      (date) => ({
        user: pick(people, rng),
        action: 'Published daily timetable',
        entity: fmtDate(date),
        after: `${1 + Math.floor(rng() * 6)} change(s)`,
      }),
    ],
    [
      16,
      () => {
        const s = sec();
        const from = period();
        return { user: pick(people, rng), action: 'Moved class', entity: `${sub(s).code} · ${secLabel(s)}`, before: `${day()} P${from}`, after: `${day()} P${period()}` };
      },
    ],
    [
      14,
      () => {
        const s = sec();
        return { user: pick(people, rng), action: 'Edited class', entity: `${sub(s).code} · ${secLabel(s)}`, before: `${fac().name} · ${room().name}`, after: `${fac().name} · ${room().name}` };
      },
    ],
    [
      10,
      (date) => {
        const f = fac();
        return { user: f.name, action: 'Leave submitted', entity: `${f.name} · ${rng() < 0.6 ? 'Planned' : 'Unplanned'}`, after: fmtDate(addDaysISO(date, 1 + Math.floor(rng() * 3)), 'd MMM') };
      },
    ],
    [
      9,
      () => {
        const f = fac();
        const ok = rng() < 0.85;
        return { user: pick(APPROVERS, rng).name, action: ok ? 'Leave approved' : 'Leave rejected', entity: `${f.name} · Planned`, before: 'Pending', after: ok ? 'Approved' : 'Rejected: clashes with unit tests' };
      },
    ],
    [
      10,
      (date) => {
        const s = sec();
        return { user: pick(people, rng), action: 'Drafted substitution', entity: `Substitution · ${sub(s).code} ${secLabel(s)} · ${fmtDate(date, 'd MMM')} P${period()}`, after: fac().name };
      },
    ],
    [
      7,
      (date) => {
        const r = pick(
          refs.rooms.filter((x) => x.bookable),
          rng,
        );
        return { user: pick([...people, 'Ms. Megha Kulkarni', 'Dr. Fatima Sheikh'], rng), action: 'Booked room', entity: `${r.name} · ${fmtDate(date, 'd MMM')} P${period()}`, after: pick(['Guest lecture', 'Club meeting', 'Interview panel', 'Placement talk', 'Department review'], rng) };
      },
    ],
    [
      5,
      (date) => {
        const s = sec();
        return { user: pick(people, rng), action: 'Drafted room change', entity: `Room change · ${sub(s).code} ${secLabel(s)} · ${fmtDate(date, 'd MMM')}`, before: room().name, after: room().name };
      },
    ],
    [2, () => ({ user: COMMITTEE_USER, action: 'Imported data (simulated)', entity: pick(['faculty_master.xlsx', 'subjects_odd_sem.xlsx', 'rooms.csv'], rng), after: `${40 + Math.floor(rng() * 300)} rows` })],
    [3, () => ({ user: 'System', action: 'Nightly backup', entity: 'All modules', after: 'JSON snapshot stored' })],
  ];
  const totalWeight = templates.reduce((n, [w]) => n + w, 0);

  const choose = (r: Rng) => {
    let x = r() * totalWeight;
    for (const [w, fn] of templates) {
      x -= w;
      if (x <= 0) return fn;
    }
    return templates[0][1];
  };

  // Spread entries over the last 42 days, working hours only, newest first.
  for (let i = 0; i < count; i++) {
    const back = Math.floor(Math.pow(rng(), 1.3) * 42) + 1;
    let date = addDaysISO(today, -back);
    if (dayIndexOf(date) === null) date = addDaysISO(date, -1);
    const hh = 8 + Math.floor(rng() * 10);
    const mm = Math.floor(rng() * 60);
    const base = choose(rng)(date);
    out.push({ id: `h${i}`, at: istTimestamp(date, `${pad(hh)}:${pad(mm)}`), ...base });
  }

  // Weekly master publications v1..v11 (v12 was yesterday).
  for (let v = 11; v >= 1; v--) {
    const date = addDaysISO(today, -1 - (12 - v) * 4);
    out.push({
      id: `hv${v}`,
      at: istTimestamp(date, '18:20'),
      user: APPROVERS[v % 3].name,
      action: 'Published master timetable',
      entity: `Snapshot v${v}`,
      before: `v${v - 1}`,
      after: `0 critical, ${v % 3} warnings, ${(v + 1) % 2} advisory`,
    });
  }
  out.push({
    id: 'hv12',
    at: istTimestamp(addDaysISO(today, -1), '18:30'),
    user: APPROVERS[0].name,
    action: 'Published master timetable',
    entity: 'Snapshot v12',
    before: 'v11',
    after: '0 critical, 0 warnings, 0 advisory',
  });

  return out.sort((a, b) => b.at.localeCompare(a.at));
}
