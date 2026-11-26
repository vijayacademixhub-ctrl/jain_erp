import { parseIntent, type ChatCard, type RoomItem, type SubItem } from '../../../domain/chat';
import { DAY_SHORT } from '../../../domain/constants';
import { onLeave } from '../../../domain/leave';
import { rankSubstitutes } from '../../../domain/substitutes';
import type { Slot } from '../../../domain/types';
import { fmtDate, relativeLabel } from '../../../lib/dates';
import { dayEngine, useData, weeklyLoads } from '../../../store/data';

export interface Reply {
  text: string;
  card?: ChatCard;
}

const CAPABILITIES: Reply = {
  text: "I'm the demo assistant. I understand a fixed set of committee requests and always show you a preview first. I never publish anything myself.",
  card: { type: 'capabilities' },
};

/** Turns a committee message into a reply, using keyword intents and live timetable data. */
export function respond(text: string): Reply {
  const st = useData.getState();
  const intent = parseIntent(text, { faculty: st.facultyList, rooms: st.roomList, today: st.today });

  switch (intent.kind) {
    case 'absence': {
      const f = st.faculty[intent.facultyId];
      const { engine, entries } = dayEngine(st, intent.date, true);
      const loads = weeklyLoads(st);
      const affected = entries.filter((e) => e.facultyId === f.id && e.status !== 'cancelled' && e.slotId && e.period >= intent.from && e.period <= intent.to);
      const when = `${relativeLabel(intent.date, st.today)}${relativeLabel(intent.date, st.today).includes(' ') ? '' : ` (${fmtDate(intent.date, 'EEE d MMM')})`}`;
      const range = intent.wholeDay ? 'all day' : intent.from === intent.to ? `in P${intent.from}` : `in P${intent.from}–P${intent.to}`;
      if (!affected.length) {
        return { text: `${f.name} has no classes ${when} ${range}, so nothing needs cover. If this is a leave, ask them to apply in the Faculty Portal so it's on record.` };
      }
      const taken = new Set<string>();
      const items: SubItem[] = affected.map((e) => {
        const slot: Slot = { id: e.key, day: e.day, period: e.period, sectionIds: e.sectionIds, kind: e.kind, subjectId: e.subjectId, facultyId: e.facultyId, roomId: e.roomId };
        const options = rankSubstitutes({ dayEngine: engine, slot, date: intent.date, faculty: st.facultyList, subjects: st.subjects, leaves: st.leaves, loads, limit: 3 }).map((c) => c.faculty.id);
        const chosen = options.find((o) => !taken.has(`${e.period}|${o}`)) ?? null;
        if (chosen) taken.add(`${e.period}|${chosen}`);
        return { slotId: e.slotId!, options, chosen };
      });
      const leave = onLeave(st.leaves, f.id, intent.date);
      const note = leave ? '' : ' There is no approved leave on record for that date, so I will treat it as an absence report.';
      return {
        text: `${f.name} has ${affected.length} class${affected.length > 1 ? 'es' : ''} ${when} ${range}. Here are ranked substitutes: free in that period, not on leave, same subject area first, lowest workload. Each one passed the clash check.${note}`,
        card: { type: 'substitutes', date: intent.date, facultyId: f.id, items, status: 'proposed' },
      };
    }

    case 'room-closed': {
      const room = st.rooms[intent.roomId];
      const items: RoomItem[] = [];
      for (const date of intent.dates) {
        const { engine, entries } = dayEngine(st, date, true);
        for (const e of entries) {
          if (e.roomId !== room.id || e.status === 'cancelled' || !e.slotId) continue;
          const slot: Slot = { id: e.key, day: e.day, period: e.period, sectionIds: e.sectionIds, kind: e.kind, subjectId: e.subjectId, facultyId: e.facultyId, roomId: e.roomId };
          const need = engine.strengthOf(slot);
          const booked = new Set(st.bookings.filter((b) => b.date === date && b.period === e.period).map((b) => b.roomId));
          const options = st.roomList
            .filter((r) => r.id !== room.id && r.capacity >= need && (r.type === 'Classroom' || r.type === 'Lab' || r.type === 'Seminar Hall') && !booked.has(r.id) && engine.isRoomFree(r.id, e.day, e.period))
            .sort((a, b) => a.capacity - b.capacity)
            .slice(0, 3)
            .map((r) => r.id);
          items.push({ slotId: e.slotId, date, options, chosen: options[0] ?? null });
        }
      }
      if (!items.length) return { text: `${room.name} has no classes ${intent.scopeLabel}${intent.scopeLabel === 'this week' ? ' from today onwards' : ''}. Nothing to move.` };
      const stuck = items.filter((i) => !i.chosen).length;
      return {
        text: `${room.name} hosts ${items.length} class${items.length > 1 ? 'es' : ''} ${intent.scopeLabel}. I matched each one to the smallest free room that fits the class.${stuck ? ` ${stuck} could not be placed; consider a swap.` : ''}`,
        card: { type: 'rooms', roomId: room.id, items, status: 'proposed' },
      };
    }

    case 'remember': {
      const mem = st.addMemory({ text: intent.text, kind: intent.memKind, expires: intent.expires });
      return {
        text: intent.memKind === 'standing' ? 'Saved as a standing memory. It stays until you remove it.' : `Saved as a time-bound memory. It expires after ${fmtDate(intent.expires!, 'EEE d MMM')}.`,
        card: { type: 'memory', memoryId: mem.id },
      };
    }

    case 'free': {
      const { engine } = dayEngine(st, intent.date, true);
      const loads = weeklyLoads(st);
      const free = st.facultyList
        .filter((f) => f.area !== 'Careers' && engine.isFacultyFree(f.id, intent.day, intent.period) && !onLeave(st.leaves, f.id, intent.date, intent.period) && intent.period >= f.window[0] && intent.period <= f.window[1])
        .sort((a, b) => (loads.get(a.id) ?? 0) - (loads.get(b.id) ?? 0))
        .slice(0, 8);
      if (!free.length) return { text: `Nobody is free ${relativeLabel(intent.date, st.today)} in P${intent.period}.` };
      return {
        text: `Free ${relativeLabel(intent.date, st.today).toLowerCase() === 'today' ? 'today' : `on ${fmtDate(intent.date, 'EEE d MMM')}`} in P${intent.period} (${DAY_SHORT[intent.day]}), lowest workload first: ${free.map((f) => `${f.name} (${f.area}, ${loads.get(f.id) ?? 0} h)`).join('; ')}.`,
      };
    }

    case 'clashes': {
      const c = st.clashCounts;
      const total = c.critical + c.warning + c.advisory;
      return {
        text: total
          ? `The master draft has ${c.critical} critical, ${c.warning} warning and ${c.advisory} advisory clash${total > 1 ? 'es' : ''}. ${c.critical ? 'Publishing is blocked until the critical ones are resolved.' : 'Nothing blocks publishing.'}`
          : 'The master draft has no clashes. It is ready to publish.',
        card: { type: 'link', to: '/committee/builder', label: 'Open the clash panel' },
      };
    }

    case 'publish':
      return {
        text: 'I never publish by myself. Publishing is a committee decision: review the draft, then press Publish in the Master Builder or the Daily Timetable.',
        card: { type: 'link', to: '/committee/daily', label: 'Go to Daily Timetable' },
      };

    case 'ambiguous-faculty':
      return {
        text: `I found more than one person that matches. Who did you mean?`,
        card: {
          type: 'choices',
          prompt: intent.original,
          options: intent.matches.map((m) => m.name),
        },
      };

    case 'missing-faculty':
      return { text: "I couldn't tell which faculty member you mean. Use their name as it appears in the directory, for example: Dr. Meera Iyer is absent Tuesday periods 2 to 4." };

    case 'sunday':
      return { text: 'There are no classes on Sunday. Try a weekday.' };

    case 'help':
      return CAPABILITIES;

    default:
      return {
        text: "Sorry, I didn't catch that. I'm a scripted demo, so I only understand a few kinds of request:",
        card: { type: 'capabilities' },
      };
  }
}
