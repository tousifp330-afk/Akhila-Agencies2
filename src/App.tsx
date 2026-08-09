import { AuthProvider, useAuth } from './lib/auth';
import { CompanyProvider, useCompany } from './lib/company';
import { AdminProvider } from './lib/admin';
import { RouterProvider, useRouter } from './lib/router';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { Spinner } from './components/ui';
import { DashboardPage } from './pages/Dashboard';
import { DaybookPage } from './pages/Daybook';
import { LedgersPage } from './pages/Ledgers';
import { CustomersPage } from './pages/Customers';
import { SuppliersPage } from './pages/Suppliers';
import { StockSummaryPage } from './pages/StockSummary';
import { SalesPage } from './pages/Sales';
import { PurchasesPage } from './pages/Purchases';
import { BankPage } from './pages/Bank';
import { CashPage } from './pages/Cash';
import { OutstandingPage } from './pages/Outstanding';
import { ReportsPage } from './pages/Reports';
import { UsersPage } from './pages/Users';
import { AuditLogsPage } from './pages/AuditLogs';
import { SyncStatusPage } from './pages/SyncStatus';
import { SettingsPage } from './pages/Settings';
import { VoucherDetailsPage } from './pages/VoucherDetails';
import { LedgerDetailsPage } from './pages/LedgerDetails';
import { StockDetailsPage } from './pages/StockDetails';
import { BankLedgerPage } from './pages/BankLedger';

function Routes() {
  const { path } = useRouter();
  switch (path) {
    case '/': return <DashboardPage />;
    case '/daybook': return <DaybookPage />;
    case '/ledgers': return <LedgersPage />;
    case '/customers': return <CustomersPage />;
    case '/suppliers': return <SuppliersPage />;
    case '/stock': return <StockSummaryPage />;
    case '/purchases': return <PurchasesPage />;
    case '/sales': return <SalesPage />;
    case '/bank': return <BankPage />;
    case '/cash': return <CashPage />;
    case '/outstanding': return <OutstandingPage />;
    case '/reports': return <ReportsPage />;
    case '/users': return <UsersPage />;
    case '/audit': return <AuditLogsPage />;
    case '/sync': return <SyncStatusPage />;
    case '/settings': return <SettingsPage />;
    default:
      if (path.startsWith('/voucher/')) return <VoucherDetailsPage />;
      if (path.startsWith('/ledger/')) return <LedgerDetailsPage />;
      if (path.startsWith('/stock/')) return <StockDetailsPage />;
      if (path.startsWith('/bank/')) return <BankLedgerPage />;
      return <DashboardPage />;
  }
}

function Shell() {
  const { user, loading } = useAuth();
  const { loading: companyLoading } = useCompany();

  if (loading || (user && companyLoading)) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner label="Loading ERP..." />
      </div>
    );
  }

  if (!user) return <AuthPage />;

  return (
    <AdminProvider>
      <Layout>
        <Routes />
      </Layout>
    </AdminProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CompanyProvider>
        <RouterProvider>
          <Shell />
        </RouterProvider>
      </CompanyProvider>
    </AuthProvider>
  );
}
