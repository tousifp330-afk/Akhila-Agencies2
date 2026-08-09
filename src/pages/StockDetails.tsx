import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useCompany } from '../lib/company';
import { useRouter } from '../lib/router';
import { useAdmin } from '../lib/admin';
import { Card, PageHeader, Table, Td, Tr, Spinner, Button, Input } from '../components/ui';
import { formatCurrency, formatNumber, formatDate } from '../lib/format';
import { ArrowLeft, Save } from 'lucide-react';
import type { StockItem, ManualStockBaseline } from '../lib/types';

export function StockDetailsPage() {
  const { activeCompany } = useCompany();
  const { navigate, path } = useRouter();
  const { isAdmin } = useAdmin();
  const [item, setItem] = useState<StockItem | null>(null);
  const [baseline, setBaseline] = useState<ManualStockBaseline | null>(null);
  const [manualQty, setManualQty] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!activeCompany) return;
    const parts = path.split('/').filter(Boolean);
    if (parts.length < 2 || parts[0] !== 'stock') { setLoading(false); return; }
    const stockId = decodeURIComponent(parts[1]);
    loadStockDetails(activeCompany.id, stockId);
  }, [activeCompany, path]);

  async function loadStockDetails(companyId: string, stockId: string) {
    const [{ data: s }, { data: b }] = await Promise.all([
      supabase.from('stock_items').select('*').eq('company_id', companyId).eq('id', stockId).maybeSingle(),
      supabase.from('stock_manual_baselines').select('*').eq('company_id', companyId).eq('stock_item_id', stockId).maybeSingle(),
    ]);
    if (s) { setItem(s as StockItem); if (b) { setBaseline(b as ManualStockBaseline); setManualQty(String(b.manual_quantity)); } }
    setLoading(false);
  }

  async function saveBaseline() {
    if (!activeCompany || !item) return;
    setSaving(true);
    const qty = parseFloat(manualQty) || 0;
    await supabase.from('stock_manual_baselines').upsert({ company_id: activeCompany.id, stock_item_id: item.id, manual_quantity: qty, last_counted_at: new Date().toISOString() }, { onConflict: 'company_id,stock_item_id' });
    setBaseline({ id: '', company_id: activeCompany.id, stock_item_id: item.id, manual_quantity: qty, last_counted_at: new Date().toISOString(), counted_by: null, notes: null });
    setSaving(false);
  }

  if (!activeCompany) return <Spinner />;
  if (loading) return <Spinner label="Loading stock..." />;
  if (!item) return (<div><PageHeader title="Stock Details" subtitle="Item not found" action={<Button variant="secondary" onClick={() => navigate('/stock')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} /></div>);

  const effectiveStock = baseline ? baseline.manual_quantity : item.current_stock;
  return (<div>
    <PageHeader title={item.name} subtitle={`Stock Item · ${activeCompany.name}`} action={<Button variant="secondary" onClick={() => navigate('/stock')}><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>} />
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">ERP Stock</div><div className="text-lg font-bold mt-1 text-emerald-700">{formatNumber(effectiveStock)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Tally Stock</div><div className="text-lg font-bold mt-1">{formatNumber(item.current_stock)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Rate</div><div className="text-lg font-bold mt-1">{formatCurrency(item.rate)}</div></Card>
      <Card className="p-4"><div className="text-xs font-medium text-slate-500 uppercase">Value</div><div className="text-lg font-bold mt-1">{formatCurrency(item.current_value)}</div></Card>
    </div>
    {isAdmin && (<Card className="p-5 mb-4"><h3 className="font-semibold text-slate-900 mb-3">Manual Stock Baseline</h3><p className="text-xs text-slate-500 mb-3">Enter the actual physical stock count. This becomes the baseline for ERP stock calculation. Purchases will increase this, Sales will decrease it.</p><div className="flex items-center gap-3"><Input type="number" value={manualQty} onChange={e => setManualQty(e.target.value)} placeholder="Actual physical quantity" className="max-w-xs" /><Button onClick={saveBaseline} disabled={saving}><Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save Baseline'}</Button></div>{baseline && <p className="text-xs text-slate-400 mt-2">Last counted: {formatDate(baseline.last_counted_at)} · Baseline: {formatNumber(baseline.manual_quantity)}</p>}</Card>)}
    <Card className="p-5"><h3 className="font-semibold text-slate-900 mb-3">Stock Summary</h3><div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm"><div><span className="text-slate-500">Opening Stock:</span> <span className="font-medium">{formatNumber(item.opening_stock)}</span></div><div><span className="text-slate-500">Opening Value:</span> <span className="font-medium">{formatCurrency(item.opening_value)}</span></div><div><span className="text-slate-500">Current Value:</span> <span className="font-medium">{formatCurrency(item.current_value)}</span></div></div></Card>
  </div>);
}
