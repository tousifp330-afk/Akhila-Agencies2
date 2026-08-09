import React, { useEffect, useState } from 'react';
import { useCompany } from '../lib/company';
import { getTopDebtors, getTopCreditors, getRecentVouchers } from '../lib/api';
import { navigate } from '../lib/router';
import { LoadingWrapper } from '../components/ui';
import { formatCurrency, formatDate, voucherTypeClass, truncate } from '../lib/utils';
import type { Ledger, Voucher } from '../lib/types';

export function DashboardPage() {
  const { company } = useCompany();
  const [debtors, setDebtors] = useState<Ledger[]>([]);
  const [creditors, setCreditors] = useState<Ledger[]>([]);
  const [recentVouchers, setRecentVouchers] = useState<Voucher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (!company) return; setLoading(true);
    Promise.all([getTopDebtors(company.id, 5), getTopCreditors(company.id, 5), getRecentVouchers(company.id, 20)])
      .then(([d, c, v]) => { if (d.error) setError(d.error); else setDebtors(d.data || []); if (c.error) setError(c.error); else setCreditors(c.data || []); if (v.error) setError(v.error); else setRecentVouchers(v.data || []); setLoading(false); });
  }, [company]);

  return (<LoadingWrapper loading={loading} error={error}>
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <div className="erp-stat"><div className="erp-stat-label">Customers</div><div className="erp-stat-value">{formatCurrency(debtors.reduce((sum, d) => sum + Math.abs(d.closing_balance), 0))}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">Suppliers</div><div className="erp-stat-value">{formatCurrency(creditors.reduce((sum, s) => sum + Math.abs(s.closing_balance), 0))}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">Top Debtors</div><div className="erp-stat-value">{debtors.length}</div></div>
        <div className="erp-stat"><div className="erp-stat-label">Recent Activity</div><div className="erp-stat-value">{recentVouchers.length}</div></div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        <div className="erp-card"><div className="erp-card-header"><div className="erp-section-title mb-0">Top Debtors</div></div>
          <div className="erp-card-body !p-0"><table className="erp-table"><thead><tr><th>Customer</th><th className="num">Closing Balance</th></tr></thead><tbody>{debtors.map(d => (<tr key={d.id}><td className="clickable" onClick={() => navigate(`/ledger/${d.id}`)}>{d.name}</td><td className="num amount-positive">{formatCurrency(Math.abs(d.closing_balance))}</td></tr>))}</tbody></table></div></div>
        <div className="erp-card"><div className="erp-card-header"><div className="erp-section-title mb-0">Top Creditors</div></div>
          <div className="erp-card-body !p-0"><table className="erp-table"><thead><tr><th>Supplier</th><th className="num">Closing Balance</th></tr></thead><tbody>{creditors.map(c => (<tr key={c.id}><td className="clickable" onClick={() => navigate(`/ledger/${c.id}`)}>{c.name}</td><td className="num amount-positive">{formatCurrency(Math.abs(c.closing_balance))}</td></tr>))}</tbody></table></div></div>
      </div>
      <div className="erp-card"><div className="erp-card-header"><div className="erp-section-title mb-0">Recent Activity</div></div>
        <div className="erp-card-body !p-0"><table className="erp-table"><thead><tr><th>Date</th><th>Voucher Type</th><th>Voucher No.</th><th>Party / Ledger</th><th className="num">Amount</th></tr></thead><tbody>{recentVouchers.map(v => (<tr key={v.id}><td>{formatDate(v.voucher_date)}</td><td><span className={voucherTypeClass(v.voucher_type)}>{v.voucher_type}</span></td><td className="clickable" onClick={() => navigate(`/voucher/${v.id}`)}>{v.voucher_number}</td><td>{truncate(v.party_name || '', 30)}</td><td className="num">{formatCurrency(Math.abs(v.total_amount))}</td></tr>))}</tbody></table></div></div>
    </div>
  </LoadingWrapper>);
}
