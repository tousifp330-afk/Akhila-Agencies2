import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { Card, PageHeader, Table, Td, Tr, Spinner, EmptyState, Input, Badge } from '../components/ui';
import { formatCurrency, formatDate } from '../lib/format';
import { useRouter } from '../lib/router';
import type { DaybookEntry } from '../lib/types';

export function DaybookPage() {
  const { activeCompany } = useCompany();
  const { navigate } = useRouter();
  const [rows, setRows] = useState<DaybookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!activeCompany) return;
    setLoading(true);
    let q = supabase.from('daybook').select('*').eq('company_id', activeCompany.id).order('voucher_date', { ascending: false }).limit(500);
    if (from) q = q.gte('voucher_date', from);
    if (to) q = q.lte('voucher_date', to);
    if (search) q = q.or(`ledger_name.ilike.%${search}%,voucher_number.ilike.%${search}%`);
    q.then(({ data, error }) => {
      if (!error) setRows((data || []) as DaybookEntry[]);
      setLoading(false);
    });
  }, [activeCompany, from, to, search]);

  if (!activeCompany) return <Spinner />;
  const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
  const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);

  return (
    <div>
      <PageHeader title="Daybook" subtitle={`${activeCompany.name} · ${rows.length} entries`} />
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 mb-1">Search</label>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ledger or voucher number" />
          </div>
        </div>
      </Card>

      <Card>
        {loading ? <Spinner /> : rows.length === 0 ? <EmptyState message="No daybook entries" /> : (
          <Table headers={['Date', 'Type', 'Voucher #', 'Party', 'Amount']}>
            {rows.map(r => (
              <Tr key={r.id} className="cursor-pointer hover:bg-emerald-50" onClick={() => navigate(`/voucher/${encodeURIComponent(r.voucher_type)}/${encodeURIComponent(r.voucher_number)}`)}>
                <Td className="whitespace-nowrap">{formatDate(r.voucher_date)}</Td>
                <Td><Badge>{r.voucher_type}</Badge></Td>
                <Td className="font-mono text-xs">{r.voucher_number}</Td>
                <Td>{r.ledger_name || '—'}</Td>
                <Td className="text-right font-medium">{formatCurrency(r.debit || r.credit)}</Td>
              </Tr>
            ))}
            <Tr className="bg-slate-50 font-semibold">
              <Td colSpan={4}>Totals</Td>
              <Td className="text-right">{formatCurrency(totalDebit + totalCredit)}</Td>
            </Tr>
          </Table>
        )}
      </Card>
    </div>
  );
}
