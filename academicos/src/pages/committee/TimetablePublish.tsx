import { useEffect, useState } from 'react';
import { Layout } from '../../components/Layout';
import { CommitteeNav } from '../../components/CommitteeNav';
import { supabase } from '../../lib/supabase';

interface Version {
  id: string; name: string; status: string; version_number: number;
  semester_number: number; academic_year: string;
  submitted_by_name: string | null; submitted_at: string | null;
  reviewed_by_name: string | null; reviewed_at: string | null; review_comments: string | null;
  published_at: string | null;
}

const STATUS_STYLE: Record<string, { bg: string; label: string }> = {
  draft: { bg: '#8a8a8a', label: 'Draft' },
  returned: { bg: '#b4473f', label: 'Returned for changes' },
  pending_approval: { bg: '#c08a2d', label: 'Pending Super-Admin approval' },
  published: { bg: '#3d8168', label: 'Published' },
  withdrawn: { bg: '#8a8a8a', label: 'Superseded' },
};

export default function TimetablePublish() {
  const [rows, setRows] = useState<Version[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function load() {
    supabase.from('v_timetable_approvals')
      .select('id,name,status,version_number,semester_number,academic_year,submitted_by_name,submitted_at,reviewed_by_name,reviewed_at,review_comments,published_at')
      .order('semester_number').order('version_number')
      .then(({ data }) => setRows((data ?? []) as Version[]));
  }
  useEffect(() => { load(); }, []);

  async function submit(v: Version) {
    setBusy(v.id); setMsg(null);
    const { error } = await supabase.rpc('submit_timetable', { p_version: v.id });
    setBusy(null);
    if (error) setMsg(error.message);
    else { setMsg(`"${v.name}" submitted for Super-Admin approval.`); load(); }
  }

  const badge = (status: string) => {
    const s = STATUS_STYLE[status] ?? { bg: '#8a8a8a', label: status };
    return <span className="text-[11px] rounded px-2 py-0.5 text-white font-medium" style={{ background: s.bg }}>{s.label}</span>;
  };

  return (
    <Layout title="Publish & Approval">
      <CommitteeNav />
      <p className="text-[12.5px] mb-3" style={{ color: 'var(--muted)' }}>
        A draft timetable must be submitted for Super-Admin approval before it goes live. Once approved, it is published and supersedes the previous version for that semester.
      </p>
      <div className="grid gap-2">
        {rows.map((v) => (
          <div key={v.id} className="rounded-xl p-3" style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[13px] font-medium">{v.name}</div>
                <div className="text-[12px]" style={{ color: 'var(--muted)' }}>
                  Semester {v.semester_number} · {v.academic_year} · v{v.version_number}
                </div>
              </div>
              {badge(v.status)}
            </div>
            {v.status === 'returned' && v.review_comments && (
              <div className="text-[12px] mt-2 rounded px-2 py-1.5" style={{ background: 'var(--bg)', border: '1px solid var(--line)', color: '#b4473f' }}>
                Returned by {v.reviewed_by_name}: {v.review_comments}
              </div>
            )}
            {v.status === 'pending_approval' && (
              <div className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>
                Awaiting decision · submitted {v.submitted_at ? new Date(v.submitted_at).toLocaleString() : ''}
              </div>
            )}
            {v.status === 'published' && (
              <div className="text-[12px] mt-2" style={{ color: 'var(--muted)' }}>
                Approved by {v.reviewed_by_name ?? '—'} · published {v.published_at ? new Date(v.published_at).toLocaleDateString() : ''}
              </div>
            )}
            {(v.status === 'draft' || v.status === 'returned') && (
              <div className="mt-2">
                <button disabled={busy === v.id} onClick={() => submit(v)}
                  className="text-[12.5px] rounded px-3 py-1.5 font-medium text-white disabled:opacity-60" style={{ background: 'var(--brand)' }}>
                  {busy === v.id ? 'Submitting…' : 'Submit for approval'}
                </button>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-[13px]" style={{ color: 'var(--muted)' }}>No timetable versions yet.</p>}
      </div>
      {msg && <p className="text-[12.5px] mt-3" style={{ color: 'var(--accent)' }}>{msg}</p>}
    </Layout>
  );
}
