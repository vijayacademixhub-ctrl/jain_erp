import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr(error.message);
    else nav('/');
  }

  return (
    <div className="min-h-full flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-xl p-6"
        style={{ background: 'var(--panel)', border: '1px solid var(--line)' }}>
        <div className="flex items-center gap-2 mb-5">
          <div className="h-9 w-9 rounded-md flex items-center justify-center font-bold text-white" style={{ background: 'var(--brand)' }}>C</div>
          <div><div className="font-semibold">CMS AcademicOS</div>
            <div style={{ color: 'var(--muted)' }} className="text-[11px]">Sign in to continue</div></div>
        </div>
        <label className="block text-[12.5px] mb-1" style={{ color: 'var(--muted)' }}>Email or USN sign-in</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="username"
          className="w-full rounded px-3 py-2 mb-3 text-sm" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} required />
        <label className="block text-[12.5px] mb-1" style={{ color: 'var(--muted)' }}>Password</label>
        <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" autoComplete="current-password"
          className="w-full rounded px-3 py-2 mb-4 text-sm" style={{ border: '1px solid var(--line)', background: 'var(--bg)' }} required />
        {err && <div className="text-[12px] mb-3" style={{ color: '#b4473f' }}>{err}</div>}
        <button disabled={busy} className="w-full rounded py-2 font-medium text-white" style={{ background: 'var(--brand)' }}>
          {busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}
