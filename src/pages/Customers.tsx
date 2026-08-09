import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, Input, Badge } from '../components/ui';
import { formatCurrency } from '../lib/format';
import type { Ledger } from '../lib/types';

export function CustomersPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [rows, setRows] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase.from('ledgers')
      .select('*')
      .eq('company_id', activeCompany.id)
      .eq('is_customer', true)
      .order('closing_balance', { ascending: false, nullsFirst: false })
      .then(({ data }) => { setRows((data || []) as Ledger[]); setLoading(false); });
  }, [activeCompany]);

  const filtered = rows.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  if (!activeCompany) return <Spinner />;

  return (
    <div>
      <PageHeader title="Customers" subtitle={`${activeCompany.name} · ${rows.length} customers`} />
      <Card className="p-4 mb-4">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers" />
      </Card>
      <Card>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No customers" /> : (
          <Table headers={['Name', 'GST', 'Phone', 'Closing Balance']}>
            {filtered.map(c => (
              <Tr key={c.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/ledger/${c.id}`)}>
                <Td className="font-medium">{c.name}</Td>
                <Td className="font-mono text-xs">{c.gst_number || '—'}</Td>
                <Td>{c.phone || '—'}</Td>
                <Td className="text-right font-medium text-emerald-700">{formatCurrency(c.closing_balance)}</Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
