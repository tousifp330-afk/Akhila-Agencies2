import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, Badge, Button } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import { ArrowLeft } from 'lucide-react';
import type { VoucherDetail, VoucherDetailEntry } from '../lib/types';

/**
 * Universal Voucher Details page — read only.
 * Shows voucher header, party info, items table, tax section, and totals.
 * All modules (Dashboard, Daybook, Ledgers, Sales, Purchases, Reports, Bank, Outstanding)
 * link to this same page.
 */

export function VoucherDetailsPage() {
  const { activeCompany } = useCompany();
  const { navigate, path } = useRouter();
  const [voucher, setVoucher] = useState<VoucherDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 3) { setLoading(false); return; }
    const vType = decodeURIComponent(parts[1]);
    const vNumber = decodeURIComponent(parts[2]);

    setLoading(true);
    loadVoucher(activeCompany.id, vType, vNumber);
  }, [activeCompany, path]);

  async function loadVoucher(companyId: string, vType: string, vNumber: string) {
    const tableMap: Record<string, string> = {
      'Sales': 'sales_vouchers',
      'Purchase': 'purchase_vouchers',
      'Receipt': 'receipt_vouchers',
      'Payment': 'payment_vouchers',
      'Contra': 'contra_vouchers',
      'Journal': 'journal_vouchers',
      'Credit Note': 'credit_notes',
      'Debit Note': 'debit_notes',
    };

    const table = tableMap[vType];
    if (!table) {
      const { data: entryData } = await supabase
        .from('voucher_entries')
        .select('voucher_type')
        .eq('company_id', companyId)
        .eq('voucher_number', vNumber)
        .limit(1);
      if (entryData && entryData.length > 0) {
        return loadVoucher(companyId, entryData[0].voucher_type, vNumber);
      }
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from(table)
      .select('*')
      .eq('company_id', companyId)
      .eq('voucher_number', vNumber)
      .maybeSingle();

    if (error || !data) { setLoading(false); return; }

    const { data: entries } = await supabase
      .from('voucher_entries')
      .select('*')
      .eq('company_id', companyId)
      .eq('voucher_type', vType)
      .eq('voucher_number', vNumber)
      .order('id');

    setVoucher({
      id: data.id, voucher_type: vType, voucher_number: data.voucher_number,
      voucher_date: data.voucher_date, company_id: companyId,
      party_name: data.party_name || null, narration: data.narration || null,
      total_amount: data.total_amount || data.amount || 0,
      taxable_amount: data.taxable_amount || 0,
      cgst: data.cgst || 0, sgst: data.sgst || 0, igst: data.igst || 0,
      entries: (entries || []).map((e: any) => ({
        ledger_name: e.ledger_name, stock_item: e.stock_item_id || e.batch_name || null,
        quantity: e.quantity, rate: e.rate, debit: e.debit || 0, credit: e.credit || 0, narration: e.narration || null,
      })),
    });
    setLoading(false);
  }

  if (!activeCompany) return <Spinner />;
  if (loading) return <Spinner label="Loading voucher..." />;
  if (!voucher) return (<div><PageHeader title="Voucher Details" subtitle="Voucher not found" action={<Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} /></div>);

  const itemEntries = voucher.entries.filter(e => e.quantity && e.quantity > 0);
  const ledgerEntries = voucher.entries.filter(e => !e.quantity || e.quantity === 0);
  const gstEntries = ledgerEntries.filter(e => /cgst|sgst|igst|round.?off/i.test((e.ledger_name || '').toLowerCase()));
  const otherEntries = ledgerEntries.filter(e => !/cgst|sgst|igst|round.?off/i.test((e.ledger_name || '').toLowerCase()));

  return (<div>
    <PageHeader title={`${voucher.voucher_type} • ${voucher.voucher_number}`} subtitle={`${formatDate(voucher.voucher_date)} · ${activeCompany.name}`} action={<Button variant="secondary" onClick={() => navigate('/')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} />
    <Card className="p-5 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div><div className="text-xs font-medium text-slate-500 uppercase">Voucher Type</div><div className="font-semibold mt-1"><Badge color="blue">{voucher.voucher_type}</Badge></div></div>
        <div><div className="text-xs font-medium text-slate-500 uppercase">Voucher Number</div><div className="font-semibold mt-1 font-mono">{voucher.voucher_number}</div></div>
        <div><div className="text-xs font-medium text-slate-500 uppercase">Date</div><div className="font-semibold mt-1">{formatDate(voucher.voucher_date)}</div></div>
      </div>
      {voucher.party_name && (<div className="mt-3 pt-3 border-t border-slate-100"><div className="text-xs font-medium text-slate-500 uppercase">Party</div><div className="font-semibold mt-1 text-emerald-700">{voucher.party_name}</div></div>)}
    </Card>
    {itemEntries.length > 0 && (<Card className="p-5 mb-4"><h3 className="font-semibold text-slate-900 mb-3">Items</h3><Table headers={['Item', 'Quantity', 'Rate', 'Amount']}>{itemEntries.map((e, i) => (<Tr key={i}><Td className="font-medium">{e.ledger_name || e.stock_item || '—'}</Td><Td className="text-right">{e.quantity ?? '—'}</Td><Td className="text-right">{e.rate ? formatCurrency(e.rate) : '—'}</Td><Td className="text-right font-medium">{formatCurrency(e.debit || e.credit)}</Td></Tr>))}</Table></Card>)}
    {gstEntries.length > 0 && (<Card className="p-5 mb-4"><h3 className="font-semibold text-slate-900 mb-3">Tax Details</h3><Table headers={['Tax Type', 'Amount']}>{gstEntries.map((e, i) => (<Tr key={i}><Td className="font-medium">{e.ledger_name || '—'}</Td><Td className="text-right font-medium">{formatCurrency(e.debit || e.credit)}</Td></Tr>))}</Table></Card>)}
    {otherEntries.length > 0 && (<Card className="p-5 mb-4"><h3 className="font-semibold text-slate-900 mb-3">Ledger Allocations</h3><Table headers={['Ledger', 'Debit', 'Credit']}>{otherEntries.map((e, i) => (<Tr key={i}><Td>{e.ledger_name || '—'}</Td><Td className="text-right">{e.debit ? formatCurrency(e.debit) : '—'}</Td><Td className="text-right">{e.credit ? formatCurrency(e.credit) : '—'}</Td></Tr>))}</Table></Card>)}
    <Card className="p-5"><div className="flex justify-between items-center"><span className="text-lg font-bold text-slate-900">Voucher Total</span><span className="text-2xl font-bold text-emerald-700">{formatCurrency(voucher.total_amount)}</span></div>{voucher.narration && <p className="mt-2 text-sm text-slate-500">Narration: {voucher.narration}</p>}</Card>
  </div>);
}
