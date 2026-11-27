import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { StudentNav } from '../../components/StudentNav';
import { supabase } from '../../lib/supabase';

interface Item { id: string; kind: string; title: string; body: string | null; created_at: string }
export default function StudentNotifications() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { supabase.rpc('my_notifications', { p_limit: 50 }).then(({ data }) => { setItems(((data as { items: Item[] } | null)?.items) ?? []); setLoading(false); }); }, []);
  return (
    <Layout title="Notifications">
      <StudentNav />
      <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        {loading ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>Loading…</p> :
         items.length === 0 ? <p className="text-sm py-6 text-center" style={{ color: 'var(--muted)' }}>No notifications yet. Class changes and updates will appear here.</p> :
         <div className="grid gap-2">{items.map((n) => (
           <div key={n.id} className="rounded-lg p-3" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
             <div className="text-[13px] font-medium">{n.title}</div>
             {n.body && <div className="text-[12px]" style={{ color: 'var(--muted)' }}>{n.body}</div>}
             <div className="text-[10.5px] mt-1" style={{ color: 'var(--muted)' }}>{new Date(n.created_at).toLocaleString()}</div>
           </div>))}</div>}
      </div>
    </Layout>
  );
}
