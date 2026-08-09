import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, StatCard, Badge } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import type { OutstandingBalance } from '../lib/types';
import { ArrowUpRight, ArrowDownRight, AlertCircle } from 'lucide-react';

export function OutstandingPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [rows, setRows] = useState<OutstandingBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase.from('ledgers')
      .select('id, name, closing_balance, is_customer, is_supplier')
      .eq('company_id', activeCompany.id)
      .then(({ data }) => {
        const ledgers = (data || []) as any[];
        const today = new Date().toISOString().slice(0, 10);
        const derived: OutstandingBalance[] = [];
        for (const l of ledgers) {
          const closing = Number(l.closing_balance) || 0;
          if (closing === 0) continue;
          if (l.is_customer) {
            derived.push({ id: l.id, company_id: activeCompany.id, ledger_id: l.id, ledger_name: l.name, kind: 'receivable', amount: Math.abs(closing), overdue_amount: 0, as_of_date: today, updated_at: today });
          } else if (l.is_supplier) {
            derived.push({ id: l.id, company_id: activeCompany.id, ledger_id: l.id, ledger_name: l.name, kind: 'payable', amount: Math.abs(closing), overdue_amount: 0, as_of_date: today, updated_at: today });
          }
        }
        setRows(derived);
        setLoading(false);
      });
  }, [activeCompany]);

  const receivables = rows.filter(r => r.kind === 'receivable');
  const payables = rows.filter(r => r.kind === 'payable');
  const totalRec = receivables.reduce((s, r) => s + Number(r.amount), 0);
  const totalPay = payables.reduce((s, r) => s + Number(r.amount), 0);
  const overdue = rows.reduce((s, r) => s + Number(r.overdue_amount), 0);

  if (!activeCompany) return <Spinner />;

  return (
    <div>
      <PageHeader title="Outstanding Balances" subtitle={activeCompany.name} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Receivables" value={formatCurrency(totalRec)} icon={ArrowUpRight} accent="emerald" />
        <StatCard label="Payables" value={formatCurrency(totalPay)} icon={ArrowDownRight} accent="rose" />
        <StatCard label="Overdue" value={formatCurrency(overdue)} icon={AlertCircle} accent="amber" />
      </div>
      <Card className="p-5 mb-6"><h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><ArrowUpRight className="w-4 h-4 text-emerald-600" /> Receivables ({receivables.length})</h3>{receivables.length === 0 ? <EmptyState message="No receivables" /> : (<Table headers={['Ledger', 'Amount', 'Overdue', 'As of']}>{receivables.map(r => (<Tr key={r.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/ledger/${r.id}`)}><Td className="font-medium">{r.ledger_name}</Td><Td className="text-right">{formatCurrency(r.amount)}</Td><Td className="text-right">{r.overdue_amount ? <Badge color="red">{formatCurrency(r.overdue_amount)}</Badge> : '—'}</Td><Td>{formatDate(r.as_of_date)}</Td></Tr>))}</Table>)}</Card>
      <Card className="p-5"><h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2"><ArrowDownRight className="w-4 h-4 text-rose-600" /> Payables ({payables.length})</h3>{payables.length === 0 ? <EmptyState message="No payables" /> : (<Table headers={['Ledger', 'Amount', 'Overdue', 'As of']}>{payables.map(r => (<Tr key={r.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/ledger/${r.id}`)}><Td className="font-medium">{r.ledger_name}</Td><Td className="text-right">{formatCurrency(r.amount)}</Td><Td className="text-right">{r.overdue_amount ? <Badge color="red">{formatCurrency(r.overdue_amount)}</Badge> : '—'}</Td><Td>{formatDate(r.as_of_date)}</Td></Tr>))}</Table>)}</Card>
    </div>
  );
}
