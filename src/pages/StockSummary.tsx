import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, Input, StatCard } from '../components/ui';
import { formatCurrency, formatNumber } from '../lib/format';
import { useRouter } from '../lib/router';
import type { StockItem } from '../lib/types';
import { Package, Boxes, IndianRupee } from 'lucide-react';

export function StockSummaryPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [rows, setRows] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase.from('stock_items').select('*').eq('company_id', activeCompany.id).order('name')
      .then(({ data }) => { setRows((data || []) as StockItem[]); setLoading(false); });
  }, [activeCompany]);

  const filtered = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));
  const totalValue = rows.reduce((s, r) => s + Number(r.current_value), 0);
  const totalQty = rows.reduce((s, r) => s + Number(r.current_stock), 0);

  if (!activeCompany) return <Spinner />;

  return (
    <div>
      <PageHeader title="Stock Summary" subtitle={activeCompany.name} />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Items" value={String(rows.length)} icon={Package} accent="slate" />
        <StatCard label="Total Quantity" value={formatNumber(totalQty, 2)} icon={Boxes} accent="blue" />
        <StatCard label="Total Stock Value" value={formatCurrency(totalValue)} icon={IndianRupee} accent="emerald" />
      </div>
      <Card className="p-4 mb-4"><Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search stock items" /></Card>
      <Card>{loading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No stock items" /> : (<Table headers={['Item', 'Opening Stock', 'Current Stock', 'Rate', 'Current Value']}>{filtered.map(s => (<Tr key={s.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/stock/${s.id}`)}><Td className="font-medium">{s.name}</Td><Td className="text-right">{formatNumber(s.opening_stock)}</Td><Td className="text-right">{formatNumber(s.current_stock)}</Td><Td className="text-right">{formatCurrency(s.rate)}</Td><Td className="text-right font-medium">{formatCurrency(s.current_value)}</Td></Tr>))}</Table>)}</Card>
    </div>
  );
}
