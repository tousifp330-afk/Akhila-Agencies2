import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, Badge, Button, Input, EmptyState } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import { ArrowLeft, FileText, FileSpreadsheet } from 'lucide-react';
import type { Ledger, LedgerDetailVoucher } from '../lib/types';

export function LedgerDetailsPage() {
  const { activeCompany } = useCompany();
  const { navigate, path } = useRouter();
  const [ledger, setLedger] = useState<Ledger | null>(null);
  const [vouchers, setVouchers] = useState<LedgerDetailVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'ledger') { setLoading(false); return; }
    const ledgerId = decodeURIComponent(parts[1]);
    setLoading(true);
    loadLedgerDetails(activeCompany.id, ledgerId);
  }, [activeCompany, path, from, to]);

  async function loadLedgerDetails(companyId: string, ledgerId: string) {
    const { data: l } = await supabase.from('ledgers').select('*').eq('company_id', companyId).eq('id', ledgerId).maybeSingle();
    if (!l) { setLoading(false); return; }
    setLedger(l as Ledger);
    let q = supabase.from('voucher_entries').select('voucher_type, voucher_number, voucher_date, party_name, ledger_name, debit, credit').eq('company_id', companyId).eq('ledger_id', ledgerId).order('voucher_date', { ascending: false }).order('id', { ascending: false }).limit(500);
    if (from) q = q.gte('voucher_date', from);
    if (to) q = q.lte('voucher_date', to);
    const { data: entries } = await q;
    setVouchers((entries || []) as LedgerDetailVoucher[]);
    setLoading(false);
  }

  if (!activeCompany) return <Spinner />;
  if (loading) return <Spinner label="Loading ledger..." />;
  if (!ledger) return (<div><PageHeader title="Ledger Details" subtitle="Ledger not found" action={<Button variant="secondary" onClick={() => navigate('/ledgers')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} /></div>);

  const opening = ledger.opening_balance || 0;
  const totalDebit = vouchers.reduce((s, v) => s + (v.debit || 0), 0);
  const totalCredit = vouchers.reduce((s, v) => s + (v.credit || 0), 0);
  const closing = opening + totalDebit - totalCredit;

  function openVoucher(vType: string, vNumber: string) { navigate(`/voucher/${encodeURIComponent(vType)}/${encodeURIComponent(vNumber)}`); }

  return (<div>
    <PageHeader title={ledger.name} subtitle={`${ledger.group_name || 'Ledger'} · ${activeCompany.name}`} action={<div className="flex items-center gap-2"><Button variant="secondary" size="sm" onClick={() => {}}><FileText className="w-4 h-4 mr-1" />PDF</Button><Button variant="secondary" size="sm" onClick={() => {}}><FileSpreadsheet className="w-4 h-4 mr-1" />Excel</Button><Button variant="secondary" onClick={() => navigate('/ledgers')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button></div>} />
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Group</div><div className="text-lg font-bold mt-1">{ledger.group_name || '—'}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Opening Balance</div><div className="text-lg font-bold mt-1">{formatCurrency(opening)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Current Total</div><div className="text-lg font-bold mt-1">{formatCurrency(totalDebit + totalCredit)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Closing Balance</div><div className="text-lg font-bold mt-1 text-emerald-700">{formatCurrency(closing)}</div></Card>
    </div>
    <Card className="p-4 mb-4"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div><label className="block text-xs font-medium text-slate-600 mb-1">From Date</label><Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></div><div><label className="block text-xs font-medium text-slate-600 mb-1">To Date</label><Input type="date" value={to} onChange={e => setTo(e.target.value)} /></div></div></Card>
    <Card>{vouchers.length === 0 ? <EmptyState message="No vouchers for this ledger" /> : (<Table headers={['Date', 'Particulars', 'Voucher Type', 'Voucher #', 'Debit', 'Credit']}>{vouchers.map((v, i) => (<Tr key={i} className="cursor-pointer hover:bg-emerald-50" onClick={() => openVoucher(v.voucher_type, v.voucher_number)}><Td className="whitespace-nowrap">{formatDate(v.voucher_date)}</Td><Td>{v.party_name || v.ledger_name || '—'}</Td><Td><Badge>{v.voucher_type}</Badge></Td><Td className="font-mono text-xs">{v.voucher_number}</Td><Td className="text-right">{v.debit ? formatCurrency(v.debit) : '—'}</Td><Td className="text-right">{v.credit ? formatCurrency(v.credit) : '—'}</Td></Tr>))}</Table>)}</Card>
  </div>);
}
