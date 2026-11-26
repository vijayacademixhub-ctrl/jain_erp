import { Building2, CalendarPlus, DoorOpen, Trash2, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState, Segmented } from '../../components/ui/Controls';
import { Dialog } from '../../components/ui/Dialog';
import { Field, Input, Select } from '../../components/ui/Field';
import { ALL_PERIODS, COMMITTEE_USER, DAY_INDEXES, DAY_SHORT, periodInfo } from '../../domain/constants';
import type { Period, Room, RoomType } from '../../domain/types';
import { addDaysISO, dayIndexOf, fmtDate, weekStartOf } from '../../lib/dates';
import { cn } from '../../lib/util';
import { dayEntries, sectionShort, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';

type TypeFilter = 'all' | RoomType;

interface Occupant {
  kind: 'class' | 'booking';
  label: string;
}

export default function Rooms() {
  const today = useData((s) => s.today);
  const roomList = useData((s) => s.roomList);
  const snapshots = useData((s) => s.snapshots);
  const changes = useData((s) => s.changes);
  const bookings = useData((s) => s.bookings);
  const cancelBooking = useData((s) => s.cancelBooking);
  const lookup = useLookup();
  const [date, setDate] = useState(dayIndexOf(today) === null ? addDaysISO(today, 1) : today);
  const [period, setPeriod] = useState<Period>(5);
  const [minCap, setMinCap] = useState(0);
  const [type, setType] = useState<TypeFilter>('all');
  const [booking, setBooking] = useState<Room | null>(null);

  const occupancy = useMemo(() => {
    const m = new Map<string, Occupant>();
    for (const e of dayEntries({ snapshots, changes }, date, false)) {
      if (e.status === 'cancelled' || !e.roomId) continue;
      m.set(`${e.roomId}|${e.period}`, { kind: 'class', label: `${lookup.subjects[e.subjectId ?? '']?.code ?? e.label} · ${sectionShort(lookup, e.sectionIds)}` });
    }
    for (const b of bookings) if (b.date === date) m.set(`${b.roomId}|${b.period}`, { kind: 'booking', label: b.purpose });
    return m;
  }, [date, snapshots, changes, bookings, lookup]);

  const rooms = roomList.filter((r) => r.capacity >= minCap && (type === 'all' || r.type === type));
  const free = rooms.filter((r) => !occupancy.has(`${r.id}|${period}`));
  const busy = rooms.filter((r) => occupancy.has(`${r.id}|${period}`));
  const isSunday = dayIndexOf(date) === null;

  const heat = useMemo(() => {
    const week = weekStartOf(date);
    const rows = DAY_INDEXES.map((d) => {
      const dt = addDaysISO(week, d);
      const used = new Set<string>();
      for (const e of dayEntries({ snapshots, changes }, dt, false)) if (e.status !== 'cancelled' && e.roomId) used.add(`${e.roomId}|${e.period}`);
      for (const b of bookings) if (b.date === dt) used.add(`${b.roomId}|${b.period}`);
      return { d, dt, cells: ALL_PERIODS.map((p) => roomList.filter((r) => used.has(`${r.id}|${p}`)).length), used };
    });
    const perRoom = roomList.map((r) => ({ r, n: rows.reduce((acc, row) => acc + ALL_PERIODS.filter((p) => row.used.has(`${r.id}|${p}`)).length, 0) }));
    return { rows, perRoom, week };
  }, [date, snapshots, changes, bookings, roomList]);

  const upcoming = bookings.filter((b) => b.date >= today).sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Rooms & Booking"
        docTitle="Rooms & Booking"
        description="Find a free room by date, period, capacity and type. Labs, the Seminar Hall, the Boardroom and Meeting Rooms can be booked; double bookings are refused."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-1">
        <Field label="Date" className="w-40">
          {(p) => <Input {...p} type="date" value={date} min={today} onChange={(e) => e.target.value && setDate(e.target.value)} />}
        </Field>
        <Field label="Period" className="w-44">
          {(p) => (
            <Select {...p} value={period} onChange={(e) => setPeriod(Number(e.target.value) as Period)}>
              {ALL_PERIODS.map((x) => (
                <option key={x} value={x}>
                  P{x} · {periodInfo(x).start}–{periodInfo(x).end}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Minimum capacity" className="w-40">
          {(p) => (
            <Select {...p} value={minCap} onChange={(e) => setMinCap(Number(e.target.value))}>
              {[0, 10, 20, 40, 60, 100, 150].map((c) => (
                <option key={c} value={c}>
                  {c ? `${c}+ seats` : 'Any size'}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-medium text-ink-2">Type</p>
          <Segmented<TypeFilter>
            label="Room type"
            value={type}
            onChange={setType}
            options={[
              { value: 'all', label: 'All' },
              { value: 'Classroom', label: 'Classrooms' },
              { value: 'Lab', label: 'Labs' },
              { value: 'Seminar Hall', label: 'Seminar' },
              { value: 'Boardroom', label: 'Boardroom' },
              { value: 'Meeting Room', label: 'Meeting' },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={isSunday ? 'Campus closed on Sundays' : `${free.length} free at P${period}, ${fmtDate(date, 'EEE d MMM')}`}
            description={isSunday ? 'Pick a weekday.' : `${busy.length} in use. Live from the published timetable plus bookings.`}
            icon={<DoorOpen />}
          />
          <CardBody>
            {isSunday ? (
              <EmptyState icon={<Building2 />} title="No rooms to show">
                Choose Monday to Saturday.
              </EmptyState>
            ) : free.length === 0 ? (
              <EmptyState icon={<Building2 />} title="Nothing free with these filters">
                Lower the capacity or try another period.
              </EmptyState>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {free.map((r) => (
                  <li key={r.id} className="animate-fade-up flex items-center gap-3 rounded-xl border border-line px-3 py-2.5">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-success-soft text-success">
                      <DoorOpen className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13.5px] font-semibold text-ink">{r.name}</span>
                      <span className="flex items-center gap-1.5 text-[12px] text-muted">
                        <Users className="size-3" aria-hidden /> {r.capacity} · {r.type} · {r.floor}
                      </span>
                    </span>
                    {r.bookable ? (
                      <Button size="sm" variant="subtle" onClick={() => setBooking(r)}>
                        Book
                      </Button>
                    ) : (
                      <span className="text-right text-[11px] leading-tight text-muted">{r.type === 'Auditorium' ? 'Events office' : 'Via daily timetable'}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {busy.length > 0 && !isSunday && (
              <details className="mt-4 rounded-xl border border-line px-3 py-2">
                <summary className="cursor-pointer text-[13px] font-medium text-ink-2">In use at P{period} ({busy.length})</summary>
                <ul className="mt-2 space-y-1">
                  {busy.map((r) => {
                    const o = occupancy.get(`${r.id}|${period}`)!;
                    return (
                      <li key={r.id} className="flex items-center gap-2 text-[12.5px]">
                        <span className="w-32 shrink-0 font-medium text-ink">{r.name}</span>
                        <Badge tone={o.kind === 'booking' ? 'accent' : 'neutral'}>{o.kind === 'booking' ? 'Booked' : 'Class'}</Badge>
                        <span className="truncate text-muted">{o.label}</span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            )}
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Occupancy heatmap" description={`Share of the 20 rooms in use, week of ${fmtDate(heat.week, 'd MMM')}`} />
            <CardBody>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] border-separate border-spacing-1 text-[11px]">
                  <caption className="sr-only">Room occupancy by day and period</caption>
                  <thead>
                    <tr>
                      <th scope="col" className="w-10" />
                      {ALL_PERIODS.map((p) => (
                        <th key={p} scope="col" className="font-medium text-muted">
                          P{p}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {heat.rows.map((row) => (
                      <tr key={row.d}>
                        <th scope="row" className={cn('text-left font-medium', row.dt === date ? 'text-primary-ink' : 'text-muted')}>
                          {DAY_SHORT[row.d]}
                        </th>
                        {row.cells.map((n, i) => {
                          const pct = Math.round((n / roomList.length) * 100);
                          const selected = row.dt === date && ALL_PERIODS[i] === period;
                          return (
                            <td key={i} className="p-0">
                              <button
                                type="button"
                                title={`${DAY_SHORT[row.d]} P${i + 1}: ${n} of ${roomList.length} rooms (${pct}%)`}
                                aria-label={`${DAY_SHORT[row.d]} period ${i + 1}: ${pct} percent occupied`}
                                onClick={() => {
                                  setDate(row.dt);
                                  setPeriod((i + 1) as Period);
                                }}
                                className={cn('tabular grid h-8 w-full place-items-center rounded-md font-semibold transition-transform hover:scale-105', selected && 'ring-2 ring-[var(--focus)]')}
                                style={{
                                  background: `color-mix(in srgb, var(--primary) ${Math.round(8 + pct * 0.82)}%, var(--surface))`,
                                  color: pct > 60 ? 'var(--on-primary)' : 'var(--ink)',
                                }}
                              >
                                {pct}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">Values are percentages. Click a cell to check that slot.</p>
              <div className="mt-4 space-y-1.5">
                {heat.perRoom
                  .sort((a, b) => b.n - a.n)
                  .slice(0, 8)
                  .map(({ r, n }) => (
                    <div key={r.id} className="flex items-center gap-2 text-[12px]">
                      <span className="w-28 shrink-0 truncate text-ink-2">{r.name}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                        <span className="block h-full origin-left rounded-full bg-primary-ink" style={{ transform: `scaleX(${n / 48})` }} />
                      </span>
                      <span className="tabular w-10 text-right text-muted">{Math.round((n / 48) * 100)}%</span>
                    </div>
                  ))}
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Upcoming bookings" icon={<CalendarPlus />} />
            <CardBody>
              {upcoming.length === 0 ? (
                <p className="text-[12.5px] text-muted">No bookings yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {upcoming.map((b) => (
                    <li key={b.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[12.5px]">
                      <span className="tabular w-24 shrink-0 font-medium text-ink">
                        {fmtDate(b.date, 'EEE d MMM')} P{b.period}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-ink-2">
                        {lookup.rooms[b.roomId]?.name} · {b.purpose}
                      </span>
                      <Button size="icon-sm" variant="ghost" aria-label={`Cancel booking: ${b.purpose}`} onClick={() => (cancelBooking(b.id), toast.info('Booking cancelled', `${lookup.rooms[b.roomId]?.name} is free again.`))}>
                        <Trash2 />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <BookingDialog room={booking} date={date} period={period} onClose={() => setBooking(null)} />
    </div>
  );
}

function BookingDialog({ room, date, period, onClose }: { room: Room | null; date: string; period: Period; onClose: () => void }) {
  const bookRoom = useData((s) => s.bookRoom);
  const [purpose, setPurpose] = useState('');
  const [by, setBy] = useState(COMMITTEE_USER);
  const [error, setError] = useState<string | undefined>();
  const close = () => {
    setPurpose('');
    setError(undefined);
    onClose();
  };
  const submit = () => {
    if (!room) return;
    if (purpose.trim().length < 3) {
      setError('Add a short purpose so others know why the room is held.');
      return;
    }
    const res = bookRoom({ roomId: room.id, date, period, purpose: purpose.trim(), bookedBy: by.trim() || COMMITTEE_USER });
    if (!res.ok) {
      setError(res.error);
      toast.error('Booking refused', res.error);
      return;
    }
    toast.success(`${room.name} booked`, `${fmtDate(date, 'EEE d MMM')}, P${period} · ${purpose.trim()}`);
    close();
  };
  return (
    <Dialog
      open={!!room}
      onClose={close}
      title={room ? `Book ${room.name}` : ''}
      description={room ? `${fmtDate(date)} · P${period} (${periodInfo(period).start}–${periodInfo(period).end}) · ${room.capacity} seats` : undefined}
      icon={<CalendarPlus />}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={close}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Confirm booking
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Purpose" error={error}>
          {(p) => <Input {...p} data-autofocus value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Guest lecture, club meeting" onKeyDown={(e) => e.key === 'Enter' && submit()} />}
        </Field>
        <Field label="Booked by">{(p) => <Input {...p} value={by} onChange={(e) => setBy(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}
