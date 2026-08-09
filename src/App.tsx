import React from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { CompanyProvider, useCompany } from './lib/company';
import { AdminProvider } from './lib/admin';
import { RouterProvider, useRouter, navigate } from './lib/router';
import { Spinner } from './components/ui';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/Auth';
import { DashboardPage } from './pages/Dashboard';
import { DaybookPage } from './pages/Daybook';
import { LedgersPage } from './pages/Ledgers';
import { LedgerDetailsPage } from './pages/LedgerDetails';
import { CustomersPage } from './pages/Customers';
import { SuppliersPage } from './pages/Suppliers';
import { StockSummaryPage } from './pages/StockSummary';
import { StockDetailsPage } from './pages/StockDetails';
import { SalesPage } from './pages/Sales';
import { PurchasesPage } from './pages/Purchases';
import { BankPage } from './pages/Bank';
import { BankLedgerPage } from './pages/BankLedger';
import { OutstandingPage } from './pages/Outstanding';
import { ReportsPage } from './pages/Reports';
import { AdminPage } from './pages/Admin';
import { VoucherDetailsPage } from './pages/VoucherDetails';

function Routes() {
  const { path, params } = useRouter();

  switch (path) {
    case '/':
    case '/dashboard':
      return <DashboardPage />;
    case '/daybook':
      return <DaybookPage />;
    case '/ledgers':
      return <LedgersPage />;
    case '/ledger':
      return <LedgerDetailsPage />;
    case '/customers':
      return <CustomersPage />;
    case '/suppliers':
      return <SuppliersPage />;
    case '/stock':
      return <StockSummaryPage />;
    case '/stock-detail':
      return <StockDetailsPage />;
    case '/sales':
      return <SalesPage />;
    case '/purchases':
      return <PurchasesPage />;
    case '/bank':
      return <BankPage />;
    case '/bank-detail':
      return <BankLedgerPage />;
    case '/outstanding':
      return <OutstandingPage />;
    case '/reports':
      return <ReportsPage />;
    case '/voucher':
      return <VoucherDetailsPage />;
    case '/admin':
      return <AdminPage />;
    default:
      if (path.startsWith('/ledger/')) return <LedgerDetailsPage />;
      if (path.startsWith('/ledgers/')) return <LedgerDetailsPage />;
      if (path.startsWith('/voucher/')) return <VoucherDetailsPage />;
      if (path.startsWith('/vouchers/')) return <VoucherDetailsPage />;
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
