import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { useAdmin } from '../lib/admin';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, Button, Input } from '../components/ui';
import { formatCurrency } from '../lib/format';
import type { BankAccount, ManualBankBalance } from '../lib/types';
import { Landmark, Save } from 'lucide-react';

export function BankPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const { isAdmin } = useAdmin();
  const [primaryBank, setPrimaryBank] = useState<BankAccount | null>(null);
  const [manualBalance, setManualBalance] = useState<ManualBankBalance | null>(null);
  const [manualBal, setManualBal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase.from('bank_accounts')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('is_primary', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrimaryBank(data as BankAccount);
          supabase.from('bank_manual_balances')
            .select('*')
            .eq('company_id', activeCompany.id)
            .eq('bank_account_id', data.id)
            .maybeSingle()
            .then(({ data: mb }) => {
              if (mb) { setManualBalance(mb as ManualBankBalance); setManualBal(String(mb.manual_balance)); }
            });
        }
        setLoading(false);
      });
  }, [activeCompany]);

  async function saveBalance() {
    if (!activeCompany || !primaryBank) return;
    setSaving(true);
    const bal = parseFloat(manualBal) || 0;
    await supabase.from('bank_manual_balances').upsert({
      company_id: activeCompany.id, bank_account_id: primaryBank.id,
      manual_balance: bal, verified_at: new Date().toISOString(),
    }, { onConflict: 'company_id,bank_account_id' });
    setManualBalance({ id: '', company_id: activeCompany.id, bank_account_id: primaryBank.id, manual_balance: bal, verified_at: new Date().toISOString(), verified_by: null, notes: null });
    setSaving(false);
  }

  if (!activeCompany) return <Spinner />;
  if (loading) return <Spinner label="Loading bank..." />;
  if (!primaryBank) return <EmptyState message="No bank accounts configured" />;

  const displayBalance = manualBalance ? manualBalance.manual_balance : (primaryBank.current_balance ?? primaryBank.opening_balance);

  return (
    <div>
      <PageHeader title="Primary Bank Account" subtitle={activeCompany.name} />
      <Card className="p-5 mb-6 cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/bank/${primaryBank.id}`)}>
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Landmark className="w-5 h-5 text-blue-600" /> {primaryBank.name}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div><div className="text-xs font-medium text-slate-500 uppercase">Account Number</div><div className="font-mono mt-1">{primaryBank.account_number || '—'}</div></div>
          <div><div className="text-xs font-medium text-slate-500 uppercase">IFSC</div><div className="font-mono mt-1">{primaryBank.ifsc || '—'}</div></div>
          <div><div className="text-xs font-medium text-slate-500 uppercase">{manualBalance ? 'Verified Balance' : 'Current Balance'}</div><div className="text-2xl font-bold mt-1 text-emerald-700">{formatCurrency(displayBalance)}</div></div>
        </div>
      </Card>
      {isAdmin && (<Card className="p-5"><h3 className="font-semibold text-slate-900 mb-3">Update Verified Balance (Corporate Internet Banking)</h3><p className="text-xs text-slate-500 mb-3">Enter the verified balance from your bank's Corporate Internet Banking. This becomes the trusted balance. Future receipts increase it, payments decrease it.</p><div className="flex items-center gap-3"><Input type="number" value={manualBal} onChange={e => setManualBal(e.target.value)} placeholder="Verified bank balance" className="max-w-xs" /><Button onClick={saveBalance} disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save Balance'}</Button></div></Card>)}
    </div>
  );
}
