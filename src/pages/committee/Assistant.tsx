import { m } from 'framer-motion';
import { ArrowRight, BotMessageSquare, Brain, CheckCircle2, Eye, Pin, SendHorizontal, Timer, Trash2, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader, SimulatedNote } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/Controls';
import { EXAMPLE_PROMPTS, type ChatCard, type ChatMessage } from '../../domain/chat';
import { fmtDate, fmtTimeIST } from '../../lib/dates';
import { cn } from '../../lib/util';
import { latestSnapshot, sectionShort, useData, useLookup } from '../../store/data';
import { toast } from '../../store/toast';
import { respond } from './assistant/brain';

/** Messages created in this session animate in; restored history does not. */
const fresh = new Set<string>();

export default function Assistant() {
  const chat = useData((s) => s.chat);
  const pushChat = useData((s) => s.pushChat);
  const clearChat = useData((s) => s.clearChat);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length, typing]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;
    pushChat({ role: 'user', text });
    setInput('');
    setTyping(true);
    const delay = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 50 : 650 + Math.min(500, text.length * 6);
    window.setTimeout(() => {
      const reply = respond(text);
      const msg = pushChat({ role: 'assistant', text: reply.text, card: reply.card });
      fresh.add(msg.id);
      setTyping(false);
      inputRef.current?.focus();
    }, delay);
  };

  return (
    <div>
      <PageHeader
        eyebrow="Committee Console"
        title="Committee Assistant"
        docTitle="Assistant"
        description="Describe a situation in plain words. The assistant proposes changes with a preview; nothing happens until you confirm, and it never publishes."
        actions={<SimulatedNote>Demo assistant (simulated): scripted, no AI service</SimulatedNote>}
      />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="flex h-[min(74dvh,760px)] min-h-[520px] flex-col overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3">
            <span className="relative grid size-9 place-items-center rounded-xl bg-primary text-on-primary">
              <BotMessageSquare className="size-[18px]" aria-hidden />
              <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-surface bg-success" aria-hidden />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">Demo assistant (simulated)</p>
              <p className="text-[11.5px] text-muted">Keyword templates on live demo data · never publishes</p>
            </div>
            <Button size="sm" variant="ghost" className="ml-auto" icon={<Trash2 />} onClick={clearChat} disabled={!chat.length}>
              Clear
            </Button>
          </div>

          <div ref={listRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6" role="log" aria-live="polite" aria-label="Conversation">
            {chat.length === 0 && (
              <div className="mx-auto max-w-md text-center">
                <p className="font-display-tight text-[26px] text-ink">How can I help the committee today?</p>
                <p className="mt-2 text-[13px] text-muted">Try one of these, or type your own.</p>
                <div className="mt-4 flex flex-col gap-2">
                  {EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => send(p)}
                      className="rounded-xl border border-line bg-surface px-4 py-2.5 text-left text-[13px] text-ink-2 shadow-1 transition-colors hover:border-line-strong hover:text-ink"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chat.map((msg) => (
              <Message key={msg.id} msg={msg} onChoose={send} />
            ))}
            {typing && (
              <div className="flex items-center gap-2 text-muted" aria-label="Assistant is typing">
                <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-primary-ink">
                  <BotMessageSquare className="size-3.5" aria-hidden />
                </span>
                <span className="flex items-center gap-1 rounded-2xl rounded-tl-md border border-line bg-surface px-3.5 py-3">
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                  <span className="typing-dot" />
                </span>
              </div>
            )}
          </div>

          <div className="border-t border-line px-4 py-3 sm:px-5">
            <div className="no-scrollbar mb-2 flex gap-1.5 overflow-x-auto">
              {EXAMPLE_PROMPTS.map((p) => (
                <button key={p} type="button" onClick={() => send(p)} disabled={typing} className="h-7 shrink-0 rounded-full border border-line bg-surface-2 px-2.5 text-[12px] text-ink-2 hover:border-line-strong hover:text-ink disabled:opacity-50">
                  {p}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <label htmlFor="chat-input" className="sr-only">
                Message the assistant
              </label>
              <textarea
                id="chat-input"
                ref={inputRef}
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="e.g. Dr. Kavitha Menon is absent tomorrow periods 3 to 5"
                className="max-h-32 min-h-[42px] flex-1 resize-none rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink shadow-1 outline-none placeholder:text-muted focus:border-[var(--focus)] focus:ring-3 focus:ring-[color-mix(in_srgb,var(--focus)_18%,transparent)]"
              />
              <Button type="submit" variant="primary" size="icon" aria-label="Send message" disabled={!input.trim() || typing} className="h-[42px] w-[42px]">
                <SendHorizontal />
              </Button>
            </form>
          </div>
        </Card>
        <MemoryPanel />
      </div>
    </div>
  );
}

function StreamText({ id, text }: { id: string; text: string }) {
  const [n, setN] = useState(() => (fresh.has(id) ? 0 : text.length));
  useEffect(() => {
    if (n >= text.length) return;
    const total = Math.min(900, text.length * 10);
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / total);
      setN(Math.ceil(text.length * k));
      if (k < 1) raf = requestAnimationFrame(tick);
      else fresh.delete(id);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <span aria-hidden={n < text.length}>{text.slice(0, n)}</span>
      {n < text.length && <span className="sr-only">{text}</span>}
    </>
  );
}

function Message({ msg, onChoose }: { msg: ChatMessage; onChoose: (t: string) => void }) {
  const isUser = msg.role === 'user';
  return (
    <m.div initial={fresh.has(msg.id) || isUser ? { opacity: 0, y: 6 } : false} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className={cn('flex gap-2.5', isUser && 'justify-end')}>
      {!isUser && (
        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary-ink">
          <BotMessageSquare className="size-3.5" aria-hidden />
        </span>
      )}
      <div className={cn('max-w-[min(640px,88%)]', isUser && 'text-right')}>
        <div
          className={cn(
            'inline-block rounded-2xl px-3.5 py-2.5 text-left text-[13.5px] leading-relaxed',
            isUser ? 'rounded-tr-md bg-primary text-on-primary' : 'rounded-tl-md border border-line bg-surface text-ink',
          )}
        >
          {isUser ? msg.text : <StreamText id={msg.id} text={msg.text} />}
        </div>
        {msg.card && (
          <div className="mt-2 text-left">
            <CardView msgId={msg.id} card={msg.card} onChoose={onChoose} />
          </div>
        )}
        <p className="mt-1 text-[10.5px] text-muted">{fmtTimeIST(msg.at)}</p>
      </div>
    </m.div>
  );
}

function CardView({ msgId, card, onChoose }: { msgId: string; card: ChatCard; onChoose: (t: string) => void }) {
  if (card.type === 'substitutes') return <SubstitutesCard msgId={msgId} card={card} />;
  if (card.type === 'rooms') return <RoomsCard msgId={msgId} card={card} />;
  if (card.type === 'memory') return <MemoryCard id={card.memoryId} />;
  if (card.type === 'link')
    return (
      <Link to={card.to} className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] font-semibold text-primary-ink shadow-1 hover:border-line-strong">
        {card.label} <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    );
  if (card.type === 'choices')
    return (
      <div className="flex flex-wrap gap-1.5">
        {card.options.map((o) => (
          <Button key={o} size="sm" variant="secondary" onClick={() => onChoose(`${card.prompt} (${o})`)}>
            {o}
          </Button>
        ))}
      </div>
    );
  return (
    <div className="rounded-xl border border-line bg-surface p-3 shadow-1">
      <p className="mb-2 text-[12px] font-semibold tracking-[0.04em] text-muted uppercase">What I can do</p>
      <ul className="space-y-1.5 text-[13px] text-ink-2">
        <li>
          <strong className="text-ink">Absences:</strong> "Faculty X is absent Tuesday periods 2 to 4" → ranked substitutes, preview, confirm into drafts.
        </li>
        <li>
          <strong className="text-ink">Room closures:</strong> "Room 305 is closed this week" → alternative rooms by capacity.
        </li>
        <li>
          <strong className="text-ink">Memory:</strong> "Remember: Master Talk is every Friday period 6" → standing or time-bound note.
        </li>
        <li>
          <strong className="text-ink">Lookups:</strong> "Who is free tomorrow period 3?", "How many clashes are open?"
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {EXAMPLE_PROMPTS.slice(0, 3).map((p) => (
          <Button key={p} size="sm" variant="subtle" onClick={() => onChoose(p)}>
            {p}
          </Button>
        ))}
      </div>
    </div>
  );
}

function SubstitutesCard({ msgId, card }: { msgId: string; card: Extract<ChatCard, { type: 'substitutes' }> }) {
  const lookup = useLookup();
  const snapshots = useData((s) => s.snapshots);
  const updateChatCard = useData((s) => s.updateChatCard);
  const addChange = useData((s) => s.addChange);
  const pushChat = useData((s) => s.pushChat);
  const [preview, setPreview] = useState(false);
  const snap = latestSnapshot({ snapshots });
  const absent = lookup.faculty[card.facultyId];
  const done = card.status !== 'proposed';

  const setChoice = (slotId: string, fid: string) => updateChatCard(msgId, { ...card, items: card.items.map((i) => (i.slotId === slotId ? { ...i, chosen: fid } : i)) });

  const confirm = () => {
    const ready = card.items.filter((i) => i.chosen);
    for (const i of ready) addChange({ date: card.date, type: 'substitution', scope: 'date', slotId: i.slotId, facultyId: i.chosen!, reason: `${absent?.name} absent (via assistant).` }, { by: 'Assistant (on behalf of TTC Admin)' });
    updateChatCard(msgId, { ...card, status: 'confirmed' });
    const reply = pushChat({ role: 'assistant', text: `Done. I created ${ready.length} draft substitution${ready.length > 1 ? 's' : ''} for ${fmtDate(card.date, 'EEE d MMM')}. They are not live yet: review and publish them in the Daily Timetable.`, card: { type: 'link', to: '/committee/daily', label: 'Review drafts in Daily Timetable' } });
    fresh.add(reply.id);
    toast.success(`${ready.length} draft change${ready.length > 1 ? 's' : ''} created`, 'Waiting for you to publish in the Daily Timetable.');
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-surface shadow-1', done ? 'border-line opacity-90' : 'border-primary-ink/30')}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2">
        <p className="text-[12.5px] font-semibold text-ink">Substitution plan · {fmtDate(card.date, 'EEE d MMM')}</p>
        {card.status === 'confirmed' && <Badge tone="success" icon={<CheckCircle2 />}>Drafts created</Badge>}
        {card.status === 'dismissed' && <Badge tone="neutral">Dismissed</Badge>}
      </div>
      <ul className="divide-y divide-line">
        {card.items.map((it) => {
          const slot = snap.slots.find((s) => s.id === it.slotId);
          const chosen = it.chosen ? lookup.faculty[it.chosen] : undefined;
          return (
            <li key={it.slotId} className="grid gap-2 px-3.5 py-2.5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center">
              <div className="min-w-0 text-[12.5px]">
                <p className="font-semibold text-ink">
                  P{slot?.period} · {lookup.subjects[slot?.subjectId ?? '']?.code ?? slot?.label} · {slot ? sectionShort(lookup, slot.sectionIds) : ''}
                </p>
                {preview && (
                  <p className="mt-0.5 text-muted">
                    <s>{absent?.name}</s> → <span className="font-medium text-success">{chosen?.name ?? 'no cover'}</span> · clash check passed
                  </p>
                )}
              </div>
              {it.options.length === 0 ? (
                <span className="text-[12px] text-critical">No free faculty</span>
              ) : (
                <select
                  aria-label={`Substitute for period ${slot?.period}`}
                  value={it.chosen ?? ''}
                  disabled={done}
                  onChange={(e) => setChoice(it.slotId, e.target.value)}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink"
                >
                  {it.options.map((o, i) => (
                    <option key={o} value={o}>
                      {i + 1}. {lookup.faculty[o]?.name} ({lookup.faculty[o]?.area})
                    </option>
                  ))}
                </select>
              )}
            </li>
          );
        })}
      </ul>
      {!done && (
        <div className="flex flex-wrap gap-2 border-t border-line px-3.5 py-2.5">
          <Button size="sm" variant="secondary" icon={<Eye />} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            {preview ? 'Hide preview' : 'Preview'}
          </Button>
          <Button size="sm" variant="primary" icon={<CheckCircle2 />} onClick={confirm} disabled={!card.items.some((i) => i.chosen)}>
            Confirm as drafts
          </Button>
          <Button size="sm" variant="ghost" icon={<X />} className="ml-auto" onClick={() => updateChatCard(msgId, { ...card, status: 'dismissed' })}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function RoomsCard({ msgId, card }: { msgId: string; card: Extract<ChatCard, { type: 'rooms' }> }) {
  const lookup = useLookup();
  const snapshots = useData((s) => s.snapshots);
  const updateChatCard = useData((s) => s.updateChatCard);
  const addChange = useData((s) => s.addChange);
  const pushChat = useData((s) => s.pushChat);
  const [preview, setPreview] = useState(false);
  const snap = latestSnapshot({ snapshots });
  const done = card.status !== 'proposed';
  const room = lookup.rooms[card.roomId];

  const confirm = () => {
    const ready = card.items.filter((i) => i.chosen);
    for (const i of ready) addChange({ date: i.date, type: 'room-change', scope: 'date', slotId: i.slotId, roomId: i.chosen!, reason: `${room?.name} closed (via assistant).` }, { by: 'Assistant (on behalf of TTC Admin)' });
    updateChatCard(msgId, { ...card, status: 'confirmed' });
    const reply = pushChat({ role: 'assistant', text: `Created ${ready.length} draft room change${ready.length > 1 ? 's' : ''}. Publish each day in the Daily Timetable when you are happy.`, card: { type: 'link', to: '/committee/daily', label: 'Open Daily Timetable' } });
    fresh.add(reply.id);
    toast.success(`${ready.length} draft room change${ready.length > 1 ? 's' : ''} created`);
  };

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-surface shadow-1', done ? 'border-line' : 'border-primary-ink/30')}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3.5 py-2">
        <p className="text-[12.5px] font-semibold text-ink">Alternative rooms for {room?.name}</p>
        {card.status === 'confirmed' && <Badge tone="success">Drafts created</Badge>}
        {card.status === 'dismissed' && <Badge tone="neutral">Dismissed</Badge>}
      </div>
      <ul className="max-h-72 divide-y divide-line overflow-y-auto">
        {card.items.map((it) => {
          const slot = snap.slots.find((s) => s.id === it.slotId);
          return (
            <li key={`${it.slotId}-${it.date}`} className="grid gap-2 px-3.5 py-2 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center">
              <p className="min-w-0 text-[12.5px]">
                <span className="font-semibold text-ink">
                  {fmtDate(it.date, 'EEE')} P{slot?.period}
                </span>{' '}
                · {lookup.subjects[slot?.subjectId ?? '']?.code ?? slot?.label} · {slot ? sectionShort(lookup, slot.sectionIds) : ''}
                {preview && it.chosen && (
                  <span className="block text-muted">
                    <s>{room?.name}</s> → <span className="font-medium text-success">{lookup.rooms[it.chosen]?.name}</span>
                  </span>
                )}
              </p>
              {it.options.length ? (
                <select
                  aria-label={`Room for ${fmtDate(it.date, 'EEE')} period ${slot?.period}`}
                  value={it.chosen ?? ''}
                  disabled={done}
                  onChange={(e) => updateChatCard(msgId, { ...card, items: card.items.map((x) => (x === it ? { ...x, chosen: e.target.value } : x)) })}
                  className="h-8 rounded-lg border border-line bg-surface px-2 text-[12.5px] text-ink"
                >
                  {it.options.map((o) => (
                    <option key={o} value={o}>
                      {lookup.rooms[o]?.name} · {lookup.rooms[o]?.capacity} seats
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[12px] text-critical">No free room fits</span>
              )}
            </li>
          );
        })}
      </ul>
      {!done && (
        <div className="flex flex-wrap gap-2 border-t border-line px-3.5 py-2.5">
          <Button size="sm" variant="secondary" icon={<Eye />} onClick={() => setPreview((p) => !p)} aria-pressed={preview}>
            {preview ? 'Hide preview' : 'Preview'}
          </Button>
          <Button size="sm" variant="primary" icon={<CheckCircle2 />} onClick={confirm} disabled={!card.items.some((i) => i.chosen)}>
            Confirm as drafts
          </Button>
          <Button size="sm" variant="ghost" icon={<X />} className="ml-auto" onClick={() => updateChatCard(msgId, { ...card, status: 'dismissed' })}>
            Dismiss
          </Button>
        </div>
      )}
    </div>
  );
}

function MemoryCard({ id }: { id: string }) {
  const mem = useData((s) => s.memories.find((x) => x.id === id));
  if (!mem) return <p className="text-[12px] text-muted">This memory was removed.</p>;
  return (
    <div className="inline-flex items-center gap-2 rounded-xl border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-accent-soft px-3 py-2 text-[12.5px] text-accent-ink">
      {mem.kind === 'standing' ? <Pin className="size-3.5" aria-hidden /> : <Timer className="size-3.5" aria-hidden />}
      <span className="font-medium">{mem.text}</span>
      <Badge tone={mem.kind === 'standing' ? 'primary' : 'accent'}>{mem.kind === 'standing' ? 'Standing' : `Until ${fmtDate(mem.expires!, 'd MMM')}`}</Badge>
    </div>
  );
}

function MemoryPanel() {
  const memories = useData((s) => s.memories);
  const removeMemory = useData((s) => s.removeMemory);
  const today = useData((s) => s.today);
  return (
    <Card className="self-start">
      <CardHeader title="Memory" description="Rules the assistant keeps in mind. Standing memories never expire." icon={<Brain />} />
      <CardBody>
        {memories.length === 0 ? (
          <EmptyState icon={<Brain />} title="Nothing remembered yet" className="py-6">
            Start a message with "Remember:" to save a rule.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {memories.map((mem) => {
              const expired = mem.kind === 'time-bound' && mem.expires! < today;
              return (
                <li key={mem.id} className={cn('animate-chip-in rounded-xl border px-3 py-2.5', expired ? 'border-dashed border-line-strong opacity-60' : 'border-line')}>
                  <div className="flex items-start gap-2">
                    {mem.kind === 'standing' ? <Pin className="mt-0.5 size-3.5 shrink-0 text-primary-ink" aria-hidden /> : <Timer className="mt-0.5 size-3.5 shrink-0 text-accent-ink" aria-hidden />}
                    <p className="min-w-0 flex-1 text-[13px] text-ink">{mem.text}</p>
                    <button type="button" onClick={() => removeMemory(mem.id)} aria-label={`Forget: ${mem.text}`} className="grid size-6 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-critical">
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5 pl-5.5">
                    <Badge tone={mem.kind === 'standing' ? 'primary' : 'accent'}>{mem.kind === 'standing' ? 'Standing' : 'Time-bound'}</Badge>
                    {mem.expires && <Badge tone={expired ? 'critical' : 'neutral'}>{expired ? 'Expired' : `Expires ${fmtDate(mem.expires, 'EEE d MMM')}`}</Badge>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
