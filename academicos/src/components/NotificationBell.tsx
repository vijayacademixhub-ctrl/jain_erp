import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface Item { id: string; kind: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string }

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Item[]>([]);
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  async function load() {
    const { data } = await supabase.rpc('my_notifications', { p_limit: 30 });
    if (data) { setUnread((data as { unread: number }).unread ?? 0); setItems(((data as { items: Item[] }).items) ?? []); }
  }
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, []);

  async function openPanel() {
    setOpen((o) => !o);
    if (!open && unread > 0) { await supabase.rpc('mark_notifications_read'); setUnread(0); load(); }
  }
  const ago = (iso: string) => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 60) return 'just now'; if (s < 3600) return `${Math.floor(s / 60)}m`; if (s < 86400) return `${Math.floor(s / 3600)}h`;
    return `${Math.floor(s / 86400)}d`;
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={openPanel} className="relative h-8 w-8 rounded flex items-center justify-center" style={{ border: '1px solid var(--line)' }} aria-label="Notifications">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        {unread > 0 && <span className="absolute -top-1.5 -right-1.5 text-[10px] rounded-full px-1.5 py-0.5 text-white font-semibold" style={{ background: '#b4473f' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-xl overflow-hidden z-20" style={{ background: 'var(--panel)', border: '1px solid var(--line)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}>
          <div className="px-3 py-2 text-[12.5px] font-medium" style={{ borderBottom: '1px solid var(--line)' }}>Notifications</div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {items.length === 0 ? <div className="px-3 py-6 text-center text-[12.5px]" style={{ color: 'var(--muted)' }}>No notifications.</div> :
              items.map((n) => (
                <button key={n.id} onClick={() => { setOpen(false); if (n.link) nav(n.link); }} className="w-full text-left px-3 py-2"
                  style={{ borderBottom: '1px solid var(--line)', background: n.is_read ? 'transparent' : 'var(--bg)' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-[12.5px] font-medium flex-1">{n.title}</span>
                    <span className="text-[10.5px]" style={{ color: 'var(--muted)' }}>{ago(n.created_at)}</span>
                  </div>
                  {n.body && <div className="text-[11.5px]" style={{ color: 'var(--muted)' }}>{n.body}</div>}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
