import { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`} onClick={onClick}>{children}</div>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label, value, icon: Icon, accent = 'emerald', hint,
}: { label: string; value: string; icon: any; accent?: string; hint?: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600',
    rose: 'bg-rose-50 text-rose-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-2 truncate">{value}</p>
          {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colors[accent] || colors.emerald}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </Card>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {headers.map((h, i) => (
              <th key={i} className="text-left px-4 py-3 font-semibold text-slate-600 uppercase tracking-wider text-xs">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Tr({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <tr className={`hover:bg-slate-50 ${className}`} onClick={onClick} style={onClick ? { cursor: 'pointer' } : undefined}>{children}</tr>;
}

export function Td({ children, className = '', colSpan }: { children: ReactNode; className?: string; colSpan?: number }) {
  return <td colSpan={colSpan} className={`px-4 py-3 text-slate-700 ${className}`}>{children}</td>;
}

export function Badge({ children, color = 'slate' }: { children: ReactNode; color?: string }) {
  const colors: Record<string, string> = {
    slate: 'bg-slate-100 text-slate-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[color] || colors.slate}`}>{children}</span>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-slate-500">
      <Loader2 className="w-5 h-5 animate-spin mr-2" />
      {label || 'Loading...'}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-12 text-slate-400 text-sm">{message}</div>;
}

export function Button({
  children, onClick, variant = 'primary', size = 'md', type = 'button', disabled, className = '',
}: { children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; type?: 'button' | 'submit'; disabled?: boolean; className?: string }) {
  const variants: Record<string, string> = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700',
    secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm ${props.className || ''}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm bg-white ${props.className || ''}`}
    />
  );
}
