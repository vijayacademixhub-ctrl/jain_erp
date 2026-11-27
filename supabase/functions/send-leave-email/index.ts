// send-leave-email — delivers leave notifications via Resend, with the
// faculty's adjustment sheet attached. Gracefully no-ops until RESEND_API_KEY
// and LEAVE_NOTIFY_EMAIL are configured, so the UI can always call it safely.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
function json(o: unknown, status = 200) {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { leave_id, event } = await req.json();
    if (!leave_id || !event) return json({ error: 'leave_id and event required' }, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const svc = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromAddr = Deno.env.get('LEAVE_FROM_EMAIL') ?? 'CMS AcademicOS <onboarding@resend.dev>';
    const notify = Deno.env.get('LEAVE_NOTIFY_EMAIL');
    const sb = createClient(url, svc);

    const { data: leave } = await sb.from('faculty_leaves')
      .select('id,leave_type,from_date,to_date,reason,status,decision_comments,adjustment_sheet_path,faculty(full_name,short_code,profile_id)')
      .eq('id', leave_id).single();
    if (!leave) return json({ error: 'leave not found' }, 404);
    const fac = Array.isArray(leave.faculty) ? leave.faculty[0] : leave.faculty;

    let facultyEmail: string | undefined;
    if (fac?.profile_id) {
      const { data: prof } = await sb.from('profiles').select('email').eq('id', fac.profile_id).single();
      facultyEmail = prof?.email ?? undefined;
    }

    const subject = event === 'applied'
      ? `Leave request — ${fac?.full_name} (${leave.from_date})`
      : `Your leave was ${event}`;
    const html = [
      `<h3>CMS AcademicOS — Leave ${event}</h3>`,
      `<p><b>${fac?.full_name}</b> (${fac?.short_code})</p>`,
      `<p>${leave.leave_type} leave: <b>${leave.from_date}</b>${leave.to_date !== leave.from_date ? ' to <b>' + leave.to_date + '</b>' : ''}</p>`,
      `<p>Reason: ${leave.reason}</p>`,
      leave.decision_comments ? `<p>Note: ${leave.decision_comments}</p>` : '',
      event === 'applied' && leave.adjustment_sheet_path ? `<p>Adjustment sheet attached.</p>` : '',
    ].join('');

    // Recipients: login emails are synthetic, so prefer the configured real inbox.
    const to = event === 'applied'
      ? [notify].filter(Boolean)
      : [notify ?? facultyEmail].filter(Boolean);

    if (!to.length) return json({ skipped: true, reason: 'no recipient — set LEAVE_NOTIFY_EMAIL' });
    if (!resendKey) return json({ skipped: true, reason: 'RESEND_API_KEY not configured' });

    const attachments: { filename: string; content: string }[] = [];
    if (event === 'applied' && leave.adjustment_sheet_path) {
      const { data: file } = await sb.storage.from('evidence').download(leave.adjustment_sheet_path);
      if (file) {
        const buf = new Uint8Array(await file.arrayBuffer());
        let bin = ''; for (const b of buf) bin += String.fromCharCode(b);
        attachments.push({ filename: leave.adjustment_sheet_path.split('/').pop() ?? 'adjustment-sheet', content: btoa(bin) });
      }
    }

    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: fromAddr, to, subject, html, attachments: attachments.length ? attachments : undefined }),
    });
    const body = await r.json().catch(() => ({}));
    return json({ sent: r.ok, resend: body }, r.ok ? 200 : 502);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
