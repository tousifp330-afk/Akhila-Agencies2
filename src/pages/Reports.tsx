import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, StatCard, Select } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import { FileBarChart, TrendingUp, TrendingDown, Wallet } from 'lucide-react';

export function ReportsPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [report, setReport] = useState<'sales' | 'purchases' | 'receipts' | 'payments'>('sales');
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    const table = report === 'sales' ? 'sales_vouchers' : report === 'purchases' ? 'purchase_vouchers' : report === 'receipts' ? 'receipt_vouchers' : 'payment_vouchers';
    supabase.from(table).select('*').eq('company_id', activeCompany.id).order('voucher_date', { ascending: false }).limit(1000)
      .then(({ data }) => { setRows(data || []); setLoading(false); });
  }, [activeCompany, report]);

  if (!activeCompany) return <Spinner />;
  const total = rows.reduce((s, r) => s + Number(r.total_amount ?? r.amount ?? 0), 0);

  return (
    <div>
      <PageHeader title="Reports" subtitle={activeCompany.name} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Selected Report" value={report.charAt(0).toUpperCase() + report.slice(1)} icon={FileBarChart} accent="blue" />
        <StatCard label="Entries" value={String(rows.length)} icon={report === 'sales' || report === 'receipts' ? TrendingUp : TrendingDown} accent="slate" />
        <StatCard label="Total" value={formatCurrency(total)} icon={Wallet} accent="emerald" />
      </div>
      <Card className="p-4 mb-4"><div className="flex items-center gap-3"><label className="text-sm font-medium text-slate-600">Report type</label><Select value={report} onChange={e => setReport(e.target.value as any)} className="max-w-xs"><option value="sales">Sales</option><option value="purchases">Purchases</option><option value="receipts">Receipts</option><option value="payments">Payments</option></Select></div></Card>
      <Card>{loading ? <Spinner /> : rows.length === 0 ? <EmptyState message="No data for this report" /> : (<Table headers={['Date', 'Voucher #', 'Party', 'Amount']}>{rows.map(r => (<Tr key={r.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => { const vType = report === 'sales' ? 'Sales' : report === 'purchases' ? 'Purchase' : report === 'receipts' ? 'Receipt' : 'Payment'; navigate(`/voucher/${vType}/${encodeURIComponent(r.voucher_number)}`); }}><Td className="whitespace-nowrap">{formatDate(r.voucher_date)}</Td><Td className="font-mono text-xs">{r.voucher_number}</Td><Td>{r.party_name || '—'}</Td><Td className="text-right font-medium">{formatCurrency(r.total_amount ?? r.amount)}</Td></Tr>))}</Table>)}</Card>
    </div>
  );
}
