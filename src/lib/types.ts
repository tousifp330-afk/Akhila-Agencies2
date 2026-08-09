export type Company = {
  id: string;
  name: string;
  tally_guid: string | null;
  is_active: boolean;
  gst_number: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
  created_at: string;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
};

export type Permission = {
  id: string;
  code: string;
  label: string;
};

export type Ledger = {
  id: string;
  company_id: string;
  tally_guid: string | null;
  name: string;
  group_id: string | null;
  group_name: string | null;
  opening_balance: number;
  closing_balance: number | null;
  is_customer: boolean;
  is_supplier: boolean;
  is_bank: boolean;
  is_cash: boolean;
  gst_number: string | null;
  phone: string | null;
  address: string | null;
  updated_at: string;
};

export type Customer = {
  id: string;
  company_id: string;
  ledger_id: string;
  tally_guid: string | null;
  name: string;
  gst_number: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  opening_balance: number;
  closing_balance: number | null;
  credit_limit: number | null;
  updated_at: string;
};

export type Supplier = Customer;

export type StockItem = {
  id: string;
  company_id: string;
  tally_guid: string | null;
  name: string;
  group_id: string | null;
  unit_id: string | null;
  gst_rate_id: string | null;
  opening_stock: number;
  opening_value: number;
  rate: number;
  current_stock: number;
  current_value: number;
  updated_at: string;
};

export type BankAccount = {
  id: string;
  company_id: string;
  ledger_id: string | null;
  name: string;
  account_number: string | null;
  ifsc: string | null;
  bank_name: string | null;
  branch: string | null;
  opening_balance: number;
  current_balance: number | null;
  updated_at: string;
};

export type CashAccount = {
  id: string;
  company_id: string;
  ledger_id: string | null;
  name: string;
  opening_balance: number;
  current_balance: number | null;
  updated_at: string;
};

export type VoucherBase = {
  id: string;
  company_id: string;
  tally_guid: string | null;
  voucher_number: string;
  voucher_date: string;
  party_ledger_id: string | null;
  party_name: string | null;
  narration: string | null;
  created_at: string;
  updated_at: string;
};

export type SalesVoucher = VoucherBase & {
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total_amount: number;
};

export type PurchaseVoucher = SalesVoucher;

export type ReceiptVoucher = VoucherBase & {
  bank_ledger_id: string | null;
  amount: number;
};

export type PaymentVoucher = ReceiptVoucher;

export type ContraVoucher = VoucherBase & {
  from_ledger_id: string | null;
  to_ledger_id: string | null;
  amount: number;
};

export type JournalVoucher = VoucherBase & {
  total_amount: number;
};

export type CreditNote = VoucherBase & { amount: number };
export type DebitNote = CreditNote;

export type VoucherEntry = {
  id: string;
  company_id: string;
  voucher_type: string;
  voucher_id: string;
  voucher_number: string;
  voucher_date: string;
  ledger_id: string | null;
  ledger_name: string | null;
  stock_item_id: string | null;
  godown_id: string | null;
  quantity: number | null;
  rate: number | null;
  debit: number;
  credit: number;
  narration: string | null;
};

export type DaybookEntry = {
  id: string;
  company_id: string;
  voucher_type: string;
  voucher_number: string;
  voucher_date: string;
  ledger_name: string | null;
  debit: number;
  credit: number;
  narration: string | null;
};

export type OutstandingBalance = {
  id: string;
  company_id: string;
  ledger_id: string | null;
  ledger_name: string;
  kind: 'receivable' | 'payable';
  amount: number;
  overdue_amount: number;
  as_of_date: string;
  updated_at: string;
};

export type SyncLog = {
  id: string;
  company_id: string | null;
  sync_type: 'full' | 'incremental';
  status: 'started' | 'success' | 'partial' | 'failed';
  records_synced: number;
  errors: number;
  error_detail: any;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
};

export type Heartbeat = {
  id: number;
  agent_connected: boolean;
  last_heartbeat: string | null;
  current_company: string | null;
  current_endpoint: string | null;
  last_sync_at: string | null;
  records_synced: number;
  errors: number;
  last_error: string | null;
};

export type DashboardPayload = {
  company_id: string;
  outstanding_receivables: number;
  outstanding_payables: number;
  bank_balance: number;
  cash_balance: number;
  current_stock_value: number;
  sales_total: number;
  purchases_total: number;
  receipts_total: number;
  payments_total: number;
  cash_flow: number;
  top_debtors: { ledger_name: string; amount: number }[];
  top_creditors: { ledger_name: string; amount: number }[];
  recent_activity: { type: string; number: string; date: string; party_name: string | null; amount: number }[];
  computed_at: string;
};

export type AuditLog = {
  id: string;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  detail: any;
  ip_address: string | null;
  created_at: string;
};

export type ManualStockBaseline = {
  id: string;
  company_id: string;
  stock_item_id: string;
  manual_quantity: number;
  last_counted_at: string | null;
  counted_by: string | null;
  notes: string | null;
};

export type ManualBankBalance = {
  id: string;
  company_id: string;
  bank_account_id: string;
  manual_balance: number;
  verified_at: string | null;
  verified_by: string | null;
  notes: string | null;
};

export type VoucherDetail = {
  id: string;
  voucher_type: string;
  voucher_number: string;
  voucher_date: string;
  company_id: string;
  party_name: string | null;
  narration: string | null;
  total_amount: number;
  taxable_amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  entries: VoucherDetailEntry[];
};

export type VoucherDetailEntry = {
  ledger_name: string | null;
  stock_item: string | null;
  quantity: number | null;
  rate: number | null;
  debit: number;
  credit: number;
  narration: string | null;
};

export type LedgerDetailVoucher = {
  voucher_type: string;
  voucher_number: string;
  voucher_date: string;
  party_name: string | null;
  ledger_name: string | null;
  debit: number;
  credit: number;
};
