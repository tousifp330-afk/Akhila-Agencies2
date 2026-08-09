import React from 'react';

export function Spinner({ label = 'Loading...' }: { label?: string }) { return (<div className="flex flex-col items-center gap-3"><div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" /><span className="text-sm text-slate-500">{label}</span></div>); }

export function Input({ label, error, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (<div className="flex flex-col gap-1">{label && <label className="text-xs font-medium text-slate-500">{label}</label>}<input className={`erp-input ${error ? 'border-red-400' : ''} ${className}`} {...props} />{error && <span className="text-xs text-red-500">{error}</span>}</div>);
}

export function Select({ label, options, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  return (<div className="flex flex-col gap-1">{label && <label className="text-xs font-medium text-slate-500">{label}</label>}<select className={`erp-select ${className}`} {...props}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>);
}

export function Button({ variant = 'primary', size = 'md', className = '', children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger'; size?: 'sm' | 'md' | 'lg' }) {
  const v = { primary: 'erp-btn-primary', secondary: 'erp-btn-secondary', danger: 'erp-btn-danger' }[variant];
  const s = { sm: 'erp-btn-sm', md: '', lg: 'erp-btn-lg' }[size];
  return <button className={`erp-btn ${v} ${s} ${className}`} {...props}>{children}</button>;
}

export function Pagination({ page, pageSize, totalCount, onPageChange }: { page: number; pageSize: number; totalCount: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize)); const start = (page - 1) * pageSize + 1; const end = Math.min(page * pageSize, totalCount);
  return (<div className="erp-pagination"><span className="erp-pagination-info">{totalCount > 0 ? <>Showing {start}–{end} of {totalCount}</> : 'No records'}</span>{totalPages > 1 && (<div className="erp-pagination-btns"><button onClick={() => onPageChange(1)} disabled={page===1}>««</button><button onClick={() => onPageChange(page-1)} disabled={page===1}>«</button>{(()=>{const b:React.ReactNode[]=[];let s=Math.max(1,page-2);let e=Math.min(totalPages,s+4);if(e-s<4)s=Math.max(1,e-4);for(let i=s;i<=e;i++)b.push(<button key={i} className={i===page?'active':''} onClick={()=>onPageChange(i)}>{i}</button>);return b;})()}<button onClick={() => onPageChange(page+1)} disabled={page===totalPages}>»</button><button onClick={() => onPageChange(totalPages)} disabled={page===totalPages}>»»</button></div>)}</div>);
}

export function SearchBar({ value, onChange, placeholder = 'Search...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (<div className="erp-search"><svg className="erp-search-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg><input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} /></div>);
}

export function DateRangeFilter({ fromDate, toDate, onFromChange, onToChange }: { fromDate: string; toDate: string; onFromChange: (v: string) => void; onToChange: (v: string) => void }) {
  return (<div className="erp-filter-bar"><label>From:</label><input type="date" className="erp-input" value={fromDate} onChange={e => onFromChange(e.target.value)} /><label>To:</label><input type="date" className="erp-input" value={toDate} onChange={e => onToChange(e.target.value)} /></div>);
}

export function Badge({ label, color = 'slate' }: { label: string; color?: 'blue' | 'green' | 'red' | 'yellow' | 'slate' }) {
  const c = { blue: 'erp-badge-blue', green: 'erp-badge-green', red: 'erp-badge-red', yellow: 'erp-badge-yellow', slate: 'erp-badge-slate' }[color];
  return <span className={`erp-badge ${c}`}>{label}</span>;
}

export function EmptyState({ message = 'No data available' }: { message?: string }) { return <div className="erp-empty">{message}</div>; }

export function LoadingWrapper({ loading, error, children }: { loading: boolean; error?: string | null; children: React.ReactNode }) {
  if (loading) return <div className="flex justify-center py-16"><Spinner label="Loading..." /></div>;
  if (error) return <div className="text-center py-16"><div className="text-red-500 font-medium mb-2">Error</div><div className="text-sm text-slate-500">{error}</div></div>;
  return <>{children}</>;
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  if (!open) return null;
  return (<div className="fixed inset-0 z-50 flex items-center justify-center"><div className="absolute inset-0 bg-black/40" onClick={onClose} /><div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-auto"><div className="flex items-center justify-between px-6 py-4 border-b"><h3 className="text-lg font-semibold">{title}</h3><button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button></div><div className="px-6 py-4">{children}</div>{footer && <div className="px-6 py-4 border-t bg-slate-50 flex gap-3 justify-end">{footer}</div>}</div></div>);
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }: { open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; danger?: boolean }) {
  return (<Modal open={open} onClose={onClose} title={title} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger?'danger':'primary'} onClick={onConfirm}>{confirmLabel}</Button></>}><p className="text-slate-600">{message}</p></Modal>);
}
