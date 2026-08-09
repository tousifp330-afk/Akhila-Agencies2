import React, { useState } from 'react';
import { useAuth } from '../lib/auth';

export function AuthPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) { e.preventDefault(); setError(null); setLoading(true); const result = await signIn(email, password); setLoading(false); if (result.error) setError(result.error); }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-sm">
        <div className="text-center mb-6"><h1 className="text-xl font-bold text-slate-900">Akhila Agencies ERP</h1><p className="text-sm text-slate-500 mt-1">Sign in to continue</p></div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>}
          <div><label className="text-xs font-medium text-slate-500">Email</label><input type="email" className="erp-input mt-1" value={email} onChange={e => setEmail(e.target.value)} placeholder="tousifp330@gmail.com" required autoFocus /></div>
          <div><label className="text-xs font-medium text-slate-500">Password</label><input type="password" className="erp-input mt-1" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" required /></div>
          <button type="submit" disabled={loading} className="erp-btn erp-btn-primary w-full mt-2">{loading ? 'Signing in...' : 'Sign In'}</button>
        </form>
      </div>
    </div>
  );
}
