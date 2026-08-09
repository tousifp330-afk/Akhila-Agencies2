import React from 'react';
import { useAuth } from '../lib/auth';
import { useCompany } from '../lib/company';
import { useAdmin } from '../lib/admin';
import { useRouter, navigate } from '../lib/router';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/', icon: '📊' }, { label: 'Daybook', path: '/daybook', icon: '📖' },
  { label: 'Sales', path: '/sales', icon: '💰' }, { label: 'Purchases', path: '/purchases', icon: '🛒' },
  { label: 'Receipts', path: '/reports/receipts', icon: '📥' }, { label: 'Payments', path: '/reports/payments', icon: '📤' },
  { label: 'Customers', path: '/customers', icon: '👤' }, { label: 'Suppliers', path: '/suppliers', icon: '🏢' },
  { label: 'Ledgers', path: '/ledgers', icon: '📒' }, { label: 'Outstanding', path: '/outstanding', icon: '⏳' },
  { label: 'Stock', path: '/stock', icon: '📦' }, { label: 'Bank', path: '/bank', icon: '🏦' },
  { label: 'Admin', path: '/admin', icon: '⚙️', adminOnly: true },
];

function Sidebar() {
  const { path } = useRouter(); const { user } = useAuth(); const { isAdmin } = useAdmin();
  const visible = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);
  return (
    <aside className="w-56 bg-erp-sidebar text-white flex flex-col shrink-0 overflow-y-auto">
      <div className="px-5 py-4 border-b border-white/10"><div className="text-sm font-bold tracking-wide">AKHILA AGENCIES</div><div className="text-[10px] text-slate-400 uppercase tracking-widest">ERP System</div></div>
      <nav className="flex-1 py-2">{visible.map(item => (<button key={item.path} onClick={() => navigate(item.path)} className={`w-full text-left px-5 py-2.5 text-sm flex items-center gap-3 transition-colors ${(path==='/'&&item.path==='/')||(item.path!=='/'&&path.startsWith(item.path))?'bg-erp-sidebar-active text-white font-medium':'text-slate-300 hover:bg-erp-sidebar-hover hover:text-white'}`}><span className="text-base w-5 text-center">{item.icon}</span>{item.label}</button>))}</nav>
      {user && <div className="px-5 py-3 border-t border-white/10 text-xs text-slate-400"><div className="truncate">{user.email}</div>{isAdmin && <div className="text-blue-400 mt-0.5">Administrator</div>}</div>}
    </aside>
  );
}

function Header() {
  const { user, signOut } = useAuth(); const { company, companies, setCompany } = useCompany(); const { isAdmin } = useAdmin();
  return (
    <header className="h-14 bg-erp-header border-b border-erp-border flex items-center justify-between px-6 shrink-0">
      <div className="flex items-center gap-4">{companies.length > 1 ? <select value={company?.id||''} onChange={e=>{const c=companies.find(co=>co.id===e.target.value);if(c)setCompany(c)}} className="erp-input text-sm min-w-[200px]">{companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select> : company && <span className="text-sm font-medium text-slate-700">{company.name}</span>}</div>
      <div className="flex items-center gap-4">{isAdmin && <span className="erp-badge erp-badge-blue">Admin</span>}<span className="text-sm text-slate-500 truncate max-w-[200px]">{user?.email}</span><button onClick={signOut} className="text-sm text-slate-500 hover:text-slate-700">Sign Out</button></div>
    </header>
  );
}

export function Layout({ children }: { children: React.ReactNode }) { return (<div className="h-full flex"><Sidebar/><div className="flex-1 flex flex-col min-w-0"><Header/><main className="flex-1 overflow-auto p-6">{children}</main></div></div>); }
