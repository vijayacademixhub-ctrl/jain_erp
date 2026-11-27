import { useEffect, useState, useCallback } from 'react';
import { Layout } from '../../components/Layout';
import { AdminNav } from '../../components/AdminNav';
import { supabase } from '../../lib/supabase';
import { exportReportExcel, exportReportPDF } from '../../lib/report';

interface Row {
  id: number; created_at: string; actor: string; actor_email: string | null;
  action: string; entity_type: string | null; entity_id: string | null; note: string | null;
}

// colour the action tag by family
function actionTone(action: string): string {
  const a = action.toUpperCase();
  if (a.includes('REJECT') || a.includes('DELETE') || a.includes('REVOKE')) return '#b4473f';
  if (a.includes('APPROVE') || a.includes('PUBLISH') || a.includes('CREATE') || a.includes('VERIFY')) return '#3d8168';
  if (a.includes('LEAVE')) return '#2d7d9a';
  if (a.includes('LOGIN') || a.includes('IMPERSONAT') || a.includes('GHOST')) return '#7a4fb0';
  return '#8a6d3b';
}

export default function AuditTrail() {
  const [rows, setRows] = useState<Row[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.rpc('audit_filters').then(({ data }) => {
      const d = (data ?? {}) as { actions?: string[]; entities?: string[] };
      setActions(d.actions ?? []); setEntities(d.entities ?? []);
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    supabase.rpc('recent_audit', {
      p_limit: 200, p_action: action || null, p_entity: entity || null, p_search: search || null,
    }).then(({ data }) => { setRows((data ?? []) as Row[]); setLoading(false); });
  }, [action, entity, search]);

  useEffect(() => { load(); }, [action, entity]); // eslint-disable-line react-hooks/exhaustive-deps

  const matrix = rows.map((r) => [
    new Date(r.created_at).toLocaleString(), r.actor, r.action,
    r.entity_type ?? '', r.note ?? '',
  ]);
  const headers = ['When', 'Actor', 'Action', 'Entity', 'Note'];
  const sub = `${rows.length} events · generated ${new Date().toLocaleString()}`;

  const sel = 'rounded px-2 py-1.5 text-[12.5px]';
  return (
    <Layout title="Audit Trail">
      <AdminNav />
      <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
        Tamper-proof, append-only record of every action across the platform — approvals, leave decisions, verifications,
        timetable changes, logins and master-admin access. Use the filters to trace any record.
      </p>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select value={action} onChange={(e) => setAction(e.target.value)} className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <option value="">All actions</option>
          {actions.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <select value={entity} onChange={(e) => setEntity(e.target.value)} className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)' }}>
          <option value="">All entities</option>
          {entities.map((x) => <option key={x} value={x}>{x}</option>)}
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Search actor / note… (Enter)" className={sel} style={{ border: '1px solid var(--line)', background: 'var(--bg)', minWidth: 200, flex: 1 }} />
        <button onClick={load} className={`${sel} font-medium text-white`} style={{ background: 'var(--brand)' }}>Search</button>
        <button onClick={() => exportReportPDF('Audit Trail', sub, headers, matrix)} disabled={!rows.length}
          className={`${sel} font-medium text-white disabled:opacity-50`} style={{ background: 'var(--accent)' }}>PDF</button>
        <button onClick={() => exportReportExcel('Audit_Trail', headers, matrix)} disabled={!rows.length}
          className={sel} style={{ border: '1px solid var(--line)' }}>Excel</button>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--line)' }}>
        <table className="w-full text-[12.5px]" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: 'var(--panel)', color: 'var(--muted)' }}>
              <th className="text-left px-3 py-2 font-medium">When</th>
              <th className="text-left px-3 py-2 font-medium">Actor</th>
              <th className="text-left px-3 py-2 font-medium">Action</th>
              <th className="text-left px-3 py-2 font-medium">Entity</th>
              <th className="text-left px-3 py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: '1px solid var(--line)' }}>
                <td className="px-3 py-2 whitespace-nowrap" style={{ color: 'var(--muted)' }}>{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.actor}</td>
                <td className="px-3 py-2">
                  <span className="rounded px-2 py-0.5 text-[11px] text-white font-medium" style={{ background: actionTone(r.action) }}>{r.action}</span>
                </td>
                <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>{r.entity_type ?? '—'}</td>
                <td className="px-3 py-2" style={{ color: 'var(--ink)' }}>{r.note ?? ''}</td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>No audit events match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <p className="text-[12.5px] mt-2" style={{ color: 'var(--muted)' }}>Loading…</p>}
    </Layout>
  );
}
