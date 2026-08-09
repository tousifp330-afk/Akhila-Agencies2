import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Landmark, Banknote, Package,
  AlertCircle, ArrowUpRight, ArrowDownRight, Wallet, Activity,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, StatCard, Spinner, Table, Td, Tr, Badge, EmptyState } from '../components/ui';
import { formatCurrency, formatDateTime, timeAgo } from '../lib/format';
import type { DashboardPayload } from '../lib/types';

export function DashboardPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase
      .from('dashboard_cache')
      .select('payload, computed_at')
      .eq('company_id', activeCompany.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        if (data?.payload) setData(data.payload as DashboardPayload);
        else setData(null);
        setLoading(false);
      });
  }, [activeCompany]);

  if (!activeCompany) return <Spinner label="Select a company" />;
  if (loading) return <Spinner label="Loading dashboard" />;
  if (error) return <EmptyState message={error} />;
  if (!data) return (
    <Card className="p-8 text-center text-slate-500">
      <p className="mb-2">No dashboard data yet.</p>
      <p className="text-sm">Once the Windows Sync Agent runs and synchronizes TallyPrime, your dashboard will populate automatically.</p>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={`${activeCompany.name} · computed ${timeAgo(data.computed_at)}`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Outstanding Receivables" value={formatCurrency(data.outstanding_receivables)} icon={ArrowUpRight} accent="emerald" />
        <StatCard label="Outstanding Payables" value={formatCurrency(data.outstanding_payables)} icon={ArrowDownRight} accent="rose" />
        <StatCard label="Bank Balance" value={formatCurrency(data.bank_balance)} icon={Landmark} accent="blue" />
        <StatCard label="Cash Balance" value={formatCurrency(data.cash_balance)} icon={Banknote} accent="amber" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Current Stock Value" value={formatCurrency(data.current_stock_value)} icon={Package} accent="slate" />
        <StatCard label="Sales Total" value={formatCurrency(data.sales_total)} icon={TrendingUp} accent="emerald" />
        <StatCard label="Purchases Total" value={formatCurrency(data.purchases_total)} icon={TrendingDown} accent="amber" />
        <StatCard label="Net Cash Flow" value={formatCurrency(data.cash_flow)} icon={Activity} accent={data.cash_flow >= 0 ? 'emerald' : 'rose'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowUpRight className="w-4 h-4 text-emerald-600" /> Top Debtors
          </h3>
          {data.top_debtors?.length ? (
            <Table headers={['Ledger', 'Amount']}>
              {data.top_debtors.map((d, i) => (
                <Tr key={i}>
                  <Td>{d.ledger_name}</Td>
                  <Td className="text-right font-medium text-emerald-700">{formatCurrency(d.amount)}</Td>
                </Tr>
              ))}
            </Table>
          ) : <EmptyState message="No debtors" />}
        </Card>

        <Card className="p-5">
          <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <ArrowDownRight className="w-4 h-4 text-rose-600" /> Top Creditors
          </h3>
          {data.top_creditors?.length ? (
            <Table headers={['Ledger', 'Amount']}>
              {data.top_creditors.map((c, i) => (
                <Tr key={i}>
                  <Td>{c.ledger_name}</Td>
                  <Td className="text-right font-medium text-rose-700">{formatCurrency(c.amount)}</Td>
                </Tr>
              ))}
            </Table>
          ) : <EmptyState message="No creditors" />}
        </Card>
      </div>

      <Card className="p-5 mt-6">
        <h3 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="w-4 h-4 text-slate-600" /> Recent Activity
        </h3>
        {data.recent_activity?.length ? (
          <Table headers={['Date', 'Type', 'Voucher #', 'Party/Ledger', 'Amount']}>
            {data.recent_activity.map((a, i) => (
              <Tr key={i} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/voucher/${encodeURIComponent(a.type)}/${encodeURIComponent(a.number)}`)}>
                <Td className="whitespace-nowrap">{formatDateTime(a.date)}</Td>
                <Td><Badge color="blue">{a.type}</Badge></Td>
                <Td className="font-mono text-xs">{a.number}</Td>
                <Td>{a.party_name || '—'}</Td>
                <Td className="text-right font-medium">{formatCurrency(a.amount)}</Td>
              </Tr>
            ))}
          </Table>
        ) : <EmptyState message="No recent activity" />}
      </Card>
    </div>
  );
}
