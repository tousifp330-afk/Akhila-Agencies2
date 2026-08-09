import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { useAdmin } from '../lib/admin';
import { Card, PageHeader, Table, Td, Tr, Spinner, Button, Input, Badge, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import { ArrowLeft, Save } from 'lucide-react';
import type { BankAccount, ManualBankBalance, LedgerDetailVoucher } from '../lib/types';

export function BankLedgerPage() {
  const { activeCompany } = useCompany();
  const { navigate, path } = useRouter();
  const { isAdmin } = useAdmin();
  const [account, setAccount] = useState<BankAccount | null>(null);
  const [manualBalance, setManualBalance] = useState<ManualBankBalance | null>(null);
  const [vouchers, setVouchers] = useState<LedgerDetailVoucher[]>([]);
  const [manualBal, setManualBal] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCompany) return;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'bank') { setLoading(false); return; }
    const bankId = decodeURIComponent(parts[1]);
    loadBankLedger(activeCompany.id, bankId);
  }, [activeCompany, path]);

  async function loadBankLedger(companyId: string, bankId: string) {
    const [{ data: b }, { data: mb }, { data: entries }] = await Promise.all([
      supabase.from('bank_accounts').select('*').eq('company_id', companyId).eq('id', bankId).maybeSingle(),
      supabase.from('bank_manual_balances').select('*').eq('company_id', companyId).eq('bank_account_id', bankId).maybeSingle(),
      supabase.from('voucher_entries').select('voucher_type, voucher_number, voucher_date, party_name, ledger_name, debit, credit').eq('company_id', companyId).eq('ledger_id', bankId).order('voucher_date', { ascending: false }).limit(200),
    ]);
    if (b) { setAccount(b as BankAccount); if (mb) { setManualBalance(mb as ManualBankBalance); setManualBal(String(mb.manual_balance)); } }
    setVouchers((entries || []) as LedgerDetailVoucher[]);
    setLoading(false);
  }

  async function saveBalance() {
    if (!activeCompany || !account) return;
    setSaving(true);
    const bal = parseFloat(manualBal) || 0;
    await supabase.from('bank_manual_balances').upsert({ company_id: activeCompany.id, bank_account_id: account.id, manual_balance: bal, verified_at: new Date().toISOString() }, { onConflict: 'company_id,bank_account_id' });
    setManualBalance({ id: '', company_id: activeCompany.id, bank_account_id: account.id, manual_balance: bal, verified_at: new Date().toISOString(), verified_by: null, notes: null });
    setSaving(false);
  }

  if (!activeCompany) return <Spinner />;
  if (loading) return <Spinner label="Loading bank..." />;
  if (!account) return (<div><PageHeader title="Bank Ledger" subtitle="Account not found" action={<Button variant="secondary" onClick={() => navigate('/bank')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} /></div>);

  function openVoucher(vType: string, vNumber: string) { navigate(`/voucher/${encodeURIComponent(vType)}/${encodeURIComponent(vNumber)}`); }
  const runningBalance = vouchers.reduce((bal, v) => bal + (v.debit || 0) - (v.credit || 0), account.opening_balance);
  const displayBalance = manualBalance ? manualBalance.manual_balance + runningBalance - account.opening_balance : runningBalance;

  return (<div>
    <PageHeader title={account.name} subtitle={`Bank Account · ${activeCompany.name}`} action={<Button variant="secondary" onClick={() => navigate('/bank')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} />
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Opening Balance</div><div className="text-lg font-bold mt-1">{formatCurrency(account.opening_balance)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Running Balance</div><div className="text-lg font-bold mt-1">{formatCurrency(runningBalance)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Display Balance</div><div className="text-lg font-bold mt-1 text-emerald-700">{formatCurrency(displayBalance)}</div></Card>
    </div>
    {isAdmin && (<Card className="p-5 mb-4"><h3 className="font-semibold text-slate-900 mb-3">Manual Bank Balance (Corporate Internet Banking)</h3><p className="text-xs text-slate-500 mb-3">Enter the verified balance from Corporate Internet Banking. Future receipts/payments update this balance.</p><div className="flex items-center gap-3"><Input type="number" value={manualBal} onChange={e => setManualBal(e.target.value)} placeholder="Verified bank balance" className="max-w-xs" /><Button onClick={saveBalance} disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save Balance'}</Button></div>{manualBalance && <p className="text-xs text-slate-400 mt-2">Last verified: {formatDate(manualBalance.verified_at)} · Balance: {formatCurrency(manualBalance.manual_balance)}</p>}</Card>)}
    <Card>{vouchers.length === 0 ? <EmptyState message="No transactions" /> : (<Table headers={['Date', 'Voucher #', 'Party', 'Receipt/Payment', 'Amount']}>{vouchers.map((v, i) => (<Tr key={i} className="cursor-pointer hover:bg-emerald-50" onClick={() => openVoucher(v.voucher_type, v.voucher_number)}><Td className="whitespace-nowrap">{formatDate(v.voucher_date)}</Td><Td className="font-mono text-xs">{v.voucher_number}</Td><Td>{v.party_name || v.ledger_name || '—'}</Td><Td>{v.debit ? <Badge color="emerald">Receipt</Badge> : <Badge color="rose">Payment</Badge>}</Td><Td className="text-right font-medium">{formatCurrency(v.debit || v.credit)}</Td></Tr>))}</Table>)}</Card>
  </div>);
}
