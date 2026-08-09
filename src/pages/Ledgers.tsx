import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, Input, Badge } from '../components/ui';
import { formatCurrency } from '../lib/format';
import type { Ledger } from '../lib/types';

export function LedgersPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [rows, setRows] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    supabase
      .from('ledgers')
      .select('*')
      .eq('company_id', activeCompany.id)
      .order('closing_balance', { ascending: false, nullsFirst: false })
      .then(({ data }) => {
        setRows((data || []) as Ledger[]);
        setLoading(false);
      });
  }, [activeCompany]);

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) || (r.group_name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!activeCompany) return <Spinner />;

  return (
    <div>
      <PageHeader title="Ledgers" subtitle={`${activeCompany.name} · ${rows.length} ledgers`} />
      <Card className="p-4 mb-4">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ledgers by name or group" />
      </Card>
      <Card>
        {loading ? <Spinner /> : filtered.length === 0 ? <EmptyState message="No ledgers" /> : (
          <Table headers={['Name', 'Group', 'Opening', 'Closing', 'Flags']}>
            {filtered.map(l => (
              <Tr key={l.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/ledger/${l.id}`)}>
                <Td className="font-medium">{l.name}</Td>
                <Td className="text-slate-500">{l.group_name || '—'}</Td>
                <Td className="text-right">{formatCurrency(l.opening_balance)}</Td>
                <Td className="text-right">{formatCurrency(l.closing_balance)}</Td>
                <Td>
                  <div className="flex gap-1 flex-wrap">
                    {l.is_customer && <Badge color="emerald">Customer</Badge>}
                    {l.is_supplier && <Badge color="amber">Supplier</Badge>}
                    {l.is_bank && <Badge color="blue">Bank</Badge>}
                    {l.is_cash && <Badge>Cash</Badge>}
                  </div>
                </Td>
              </Tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}
